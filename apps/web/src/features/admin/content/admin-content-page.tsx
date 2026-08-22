import {
  AdminContentListResponseSchema,
  AdminContentVersionSchema,
  ContentInterventionClassSchema,
  CreateAdminContentRequestSchema,
  TransitionAdminContentRequestSchema,
  UpdateAdminContentRequestSchema,
  type AdminContentVersion,
  type CreateAdminContentRequest,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpenText, Check, FilePenLine, Plus, Send, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { AdminShell } from '@/app/shells/admin-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { SafeMarkdown } from '@/components/patterns/safe-markdown';
import { PageHeader } from '@/components/patterns/page-header';
import { StateBadge } from '@/components/patterns/state-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentSession } from '@/features/auth/use-auth-data';
import { ApiClientError, apiGet, apiMutate } from '@/lib/api/client';

type Status = 'ALL' | 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'RETIRED' | 'REJECTED';
type DraftFields = Omit<CreateAdminContentRequest, 'resourceId'>;

const statusTabs: Array<{ key: Status; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'UNDER_REVIEW', label: 'In review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'RETIRED', label: 'Retired' },
  { key: 'REJECTED', label: 'Rejected' },
];

const defaultDraft = (source?: AdminContentVersion): DraftFields => ({
  interventionClass: source?.interventionClass ?? 'CRAVING_COPING_SUPPORT',
  locale: source?.locale ?? 'en-US',
  language: source?.language ?? 'en',
  recoveryGoalsAllowed: source?.recoveryGoalsAllowed ?? ['ABSTINENCE', 'REDUCTION', 'UNSURE'],
  deliveryChannels: source?.deliveryChannels ?? ['IN_APP'],
  mutualHelpRequirement: source?.mutualHelpRequirement ?? 'ANY',
  spiritualRequirement: source?.spiritualRequirement ?? 'ANY',
  contraindications: source?.contraindications ?? [],
  safetyGateCompatibility: source?.safetyGateCompatibility ?? ['ALLOW_MONITORING', 'ALLOW_WITH_HANDOFF'],
  estimatedDurationSeconds: source?.estimatedDurationSeconds ?? 120,
  title: source ? `${source.title} — revision` : 'New support resource',
  markdownBody: source?.markdownBody ?? 'Write a short, practical support resource here.',
  effectiveFrom: source?.effectiveFrom ?? '2026-01-01T00:00:00.000Z',
  enabled: source?.enabled ?? true,
});

function humanize(value: string) {
  return value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function statusTone(status: AdminContentVersion['reviewStatus']) {
  if (status === 'APPROVED') return 'current' as const;
  if (status === 'UNDER_REVIEW') return 'warning' as const;
  if (status === 'REJECTED') return 'danger' as const;
  if (status === 'RETIRED') return 'stale' as const;
  return 'information' as const;
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded';
}

export function AdminContentPage() {
  return <WorkspaceBoundary workspace="ADMIN"><AdminContentContent /></WorkspaceBoundary>;
}

function AdminContentContent() {
  const { resourceId } = useParams();
  const session = useCurrentSession();
  const permissions = session.data?.authenticated ? session.data.session.access.permissions : [];
  const [status, setStatus] = useState<Status>('ALL');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DraftFields>(() => defaultDraft());
  const [message, setMessage] = useState<string>();
  const listQuery = useQuery({
    enabled: !resourceId,
    queryKey: ['admin', 'content', status],
    queryFn: ({ signal }) => apiGet((status === 'ALL' ? '/api/v1/admin/content' : `/api/v1/admin/content?status=${status}`) as `/api/v1/${string}`, {
      schema: AdminContentListResponseSchema,
      signal,
    }),
  });
  const detailQuery = useQuery({
    enabled: Boolean(resourceId),
    queryKey: ['admin', 'content', resourceId],
    queryFn: ({ signal }) => apiGet(`/api/v1/admin/content/${resourceId}` as `/api/v1/${string}`, { schema: AdminContentListResponseSchema, signal }),
  });
  const rows = resourceId ? detailQuery.data?.items ?? [] : listQuery.data?.items ?? [];
  const selected = rows[0];
  const refresh = async () => {
    setMessage(undefined);
    await Promise.all([listQuery.refetch(), detailQuery.refetch()]);
  };

  const create = async () => {
    setMessage(undefined);
    try {
      const body = CreateAdminContentRequestSchema.parse(resourceId ? { ...draft, resourceId } : draft);
      await apiMutate(resourceId ? `/api/v1/admin/content/${resourceId}/versions` as `/api/v1/${string}` : '/api/v1/admin/content', 'POST', body, { schema: AdminContentVersionSchema, headers: { 'Idempotency-Key': crypto.randomUUID() } });
      setCreating(false);
      await refresh();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  return <AdminShell permissions={permissions}><div className="grid gap-8">
    {resourceId ? <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" to="/admin/content"><ArrowLeft aria-hidden="true" className="size-4" /> Back to content library</Link> : null}
    <PageHeader eyebrow="Governed support library" title={resourceId ? 'Content resource detail' : 'Content management'} description="Review deterministic in-app support resources with explicit lifecycle actions. Approved content is immutable and never force-delivered." action={!resourceId ? <Button onClick={() => { setDraft(defaultDraft()); setCreating(true); }}><Plus aria-hidden="true" className="size-4" /> New resource</Button> : null} />
    {message ? <p className="m-0 rounded-lg border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger" role="alert">{message}</p> : null}
    {creating ? <DraftForm draft={draft} onChange={setDraft} onCancel={() => setCreating(false)} onSave={() => void create()} /> : null}
    {resourceId ? detailQuery.isLoading ? <LoadingState /> : detailQuery.isError ? <ErrorState action={<Button onClick={() => void detailQuery.refetch()}>Try again</Button>} /> : <ResourceDetail rows={rows} onRefresh={refresh} onMessage={setMessage} onCreateDraft={(source) => { setDraft(defaultDraft(source)); setCreating(true); }} /> : <>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Content lifecycle filters">{statusTabs.map((tab) => <button className={status === tab.key ? 'rounded-full bg-primary px-4 py-2 text-sm font-semibold text-inverse-foreground' : 'rounded-full border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-surface-subtle'} key={tab.key} onClick={() => setStatus(tab.key)} role="tab" type="button">{tab.label}</button>)}</div>
      {listQuery.isLoading ? <LoadingState /> : listQuery.isError ? <ErrorState action={<Button onClick={() => void listQuery.refetch()}>Try again</Button>} /> : rows.length === 0 ? <EmptyState /> : <div className="grid gap-3">{rows.map((row) => <Link className="grid gap-3 rounded-xl border bg-surface p-5 shadow-[var(--shadow-sm)] transition-colors hover:border-primary hover:bg-surface-subtle sm:grid-cols-[1fr_auto]" key={row.versionId} to={`/admin/content/${row.resourceId}`}><div><div className="flex flex-wrap items-center gap-2"><BookOpenText aria-hidden="true" className="size-5 text-primary" /><h2 className="m-0 text-lg font-semibold">{row.title}</h2><StateBadge label={humanize(row.reviewStatus)} state={statusTone(row.reviewStatus)} /></div><p className="mb-0 mt-2 text-sm text-muted-foreground">{humanize(row.interventionClass)} · {row.locale} · version {row.version}</p><p className="mb-0 mt-2 text-sm text-muted-foreground">Updated {formatDate(row.updatedAt)} · effective {formatDate(row.effectiveFrom)}</p></div><div className="self-center text-sm font-semibold text-primary">Open resource →</div></Link>)}</div>}
    </>}
  </div></AdminShell>;
}

function ResourceDetail({ rows, onRefresh, onMessage, onCreateDraft }: { rows: AdminContentVersion[]; onRefresh: () => Promise<void>; onMessage: (message: string | undefined) => void; onCreateDraft: (source: AdminContentVersion) => void }) {
  const [selectedId, setSelectedId] = useState(rows[0]?.versionId);
  const selected = rows.find((row) => row.versionId === selectedId) ?? rows[0];
  const [title, setTitle] = useState(selected?.title ?? '');
  const [body, setBody] = useState(selected?.markdownBody ?? '');
  const [reason, setReason] = useState('');
  const update = async () => {
    if (!selected || selected.reviewStatus !== 'DRAFT') return;
    try {
      const payload = UpdateAdminContentRequestSchema.parse({ expectedRowVersion: selected.rowVersion, title, markdownBody: body });
      await apiMutate(`/api/v1/admin/content/${selected.resourceId}/versions/${selected.versionId}` as `/api/v1/${string}`, 'PUT', payload, { schema: AdminContentVersionSchema, headers: { 'Idempotency-Key': crypto.randomUUID() } });
      await onRefresh();
      onMessage('Draft saved.');
    } catch (error) { onMessage(errorMessage(error)); }
  };
  const transition = async (action: 'submit-review' | 'approve' | 'reject' | 'retire') => {
    if (!selected) return;
    try {
      const payload = TransitionAdminContentRequestSchema.parse({ expectedRowVersion: selected.rowVersion, reason: reason.trim() || undefined });
      await apiMutate(`/api/v1/admin/content/${selected.resourceId}/versions/${selected.versionId}/${action}` as `/api/v1/${string}`, 'POST', payload, { schema: AdminContentVersionSchema, headers: { 'Idempotency-Key': crypto.randomUUID() } });
      setReason('');
      await onRefresh();
      onMessage(`Content ${action.replace('-', ' ')} recorded.`);
    } catch (error) { onMessage(errorMessage(error)); }
  };
  if (!selected) return <EmptyState />;
  return <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
    <Card><CardHeader><h2 className="m-0 text-xl font-semibold">Versions</h2><p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">Select a historical version to inspect its lifecycle and provenance.</p></CardHeader><CardContent className="grid gap-2">{rows.map((row) => <button className={row.versionId === selected.versionId ? 'rounded-lg border-2 border-primary bg-primary/[0.04] p-4 text-left' : 'rounded-lg border p-4 text-left hover:bg-surface-subtle'} key={row.versionId} onClick={() => { setSelectedId(row.versionId); setTitle(row.title); setBody(row.markdownBody); }} type="button"><div className="flex items-center justify-between gap-3"><span className="font-semibold">Version {row.version}</span><StateBadge label={humanize(row.reviewStatus)} state={statusTone(row.reviewStatus)} /></div><p className="mb-0 mt-2 text-xs text-muted-foreground">Row version {row.rowVersion} · {formatDate(row.updatedAt)}</p></button>)}</CardContent></Card>
    <div className="grid gap-5"><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-primary">Content preview</p><h2 className="mb-0 mt-2 text-xl font-semibold">{selected.title}</h2></div><StateBadge label={humanize(selected.reviewStatus)} state={statusTone(selected.reviewStatus)} /></div><p className="mb-0 mt-3 text-sm text-muted-foreground">{humanize(selected.interventionClass)} · {selected.locale}/{selected.language} · {selected.estimatedDurationSeconds}s</p></CardHeader><CardContent><SafeMarkdown value={selected.markdownBody} /></CardContent></Card>
      <Card><CardHeader><h2 className="m-0 text-lg font-semibold">Eligibility and review</h2></CardHeader><CardContent className="grid gap-4 text-sm"><Info label="Goals" value={selected.recoveryGoalsAllowed.join(', ')} /><Info label="Channels" value={selected.deliveryChannels.join(', ')} /><Info label="Safety compatibility" value={selected.safetyGateCompatibility.join(', ')} /><Info label="Contraindications" value={selected.contraindications.length ? selected.contraindications.join(', ') : 'None recorded'} /><Info label="Effective" value={formatDate(selected.effectiveFrom)} /><Info label="Reviewed" value={formatDate(selected.reviewedAt)} /></CardContent></Card>
      {selected.reviewStatus === 'DRAFT' ? <Card><CardHeader><div className="flex items-center gap-3"><FilePenLine aria-hidden="true" className="size-5 text-primary" /><h2 className="m-0 text-lg font-semibold">Edit draft</h2></div><p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">Only DRAFT content can be edited. A stale row version is rejected and must be reloaded.</p></CardHeader><CardContent className="grid gap-4"><Field label="Title"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Markdown body"><textarea className="min-h-40 w-full rounded-md border bg-surface px-3 py-3 text-sm" value={body} onChange={(event) => setBody(event.target.value)} /></Field><div className="flex flex-wrap gap-2"><Button onClick={() => void update()}><Check aria-hidden="true" className="size-4" /> Save draft</Button><Button onClick={() => void transition('submit-review')} variant="outline"><Send aria-hidden="true" className="size-4" /> Submit for review</Button></div></CardContent></Card> : null}
      {selected.reviewStatus === 'UNDER_REVIEW' || selected.reviewStatus === 'APPROVED' ? <Card><CardHeader><h2 className="m-0 text-lg font-semibold">Governance actions</h2><p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">Transitions are explicit, audited, and do not provide force delivery or safety bypasses.</p></CardHeader><CardContent className="grid gap-4"><Field label="Reason"><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Document the governance decision" /></Field><div className="flex flex-wrap gap-2">{selected.reviewStatus === 'UNDER_REVIEW' ? <><Button onClick={() => void transition('approve')}><Check aria-hidden="true" className="size-4" /> Approve</Button><Button variant="destructive" onClick={() => void transition('reject')}><X aria-hidden="true" className="size-4" /> Reject</Button></> : <><Button variant="outline" onClick={() => onCreateDraft(selected)}><FilePenLine aria-hidden="true" className="size-4" /> Create next draft</Button><Button variant="destructive" onClick={() => void transition('retire')}>Retire approved version</Button></>}</div></CardContent></Card> : null}
    </div>
  </div>;
}

function DraftForm({ draft, onChange, onCancel, onSave }: { draft: DraftFields; onChange: (draft: DraftFields) => void; onCancel: () => void; onSave: () => void }) {
  return <Card><CardHeader><h2 className="m-0 text-xl font-semibold">Create a draft resource</h2><p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">A new resource starts as DRAFT and is not eligible for patient delivery until governed.</p></CardHeader><CardContent className="grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Intervention class"><select className="h-[var(--control-height)] rounded-md border bg-surface px-3 text-sm" value={draft.interventionClass} onChange={(event) => { const parsed = ContentInterventionClassSchema.safeParse(event.target.value); if (parsed.success) onChange({ ...draft, interventionClass: parsed.data }); }}>{ContentInterventionClassSchema.options.map((key) => <option key={key} value={key}>{humanize(key)}</option>)}</select></Field><Field label="Title"><Input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} /></Field></div><Field label="Markdown body"><textarea className="min-h-40 w-full rounded-md border bg-surface px-3 py-3 text-sm" value={draft.markdownBody} onChange={(event) => onChange({ ...draft, markdownBody: event.target.value })} /></Field><div className="flex flex-wrap gap-2"><Button onClick={onSave}><Plus aria-hidden="true" className="size-4" /> Create draft</Button><Button onClick={onCancel} variant="outline">Cancel</Button></div></CardContent></Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-semibold"><span>{label}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 border-b pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[0.8fr_1.2fr]"><span className="font-semibold text-muted-foreground">{label}</span><span>{value}</span></div>; }
function errorMessage(error: unknown) { if (error instanceof ApiClientError && error.response?.error.code === 'VERSION_CONFLICT') return 'This draft changed elsewhere. Reload the current version before saving.'; return 'The content action could not be completed. Review the current lifecycle and permissions.'; }
