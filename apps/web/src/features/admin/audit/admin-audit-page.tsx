import { AdminAuditListResponseSchema, type AdminAuditListResponse } from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { FileSearch, Filter } from 'lucide-react';
import { useState } from 'react';

import { AdminShell } from '@/app/shells/admin-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentSession } from '@/features/auth/use-auth-data';
import { apiGet } from '@/lib/api/client';

function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }

export function AdminAuditPage() { return <WorkspaceBoundary workspace="ADMIN"><AdminAuditContent /></WorkspaceBoundary>; }

function AdminAuditContent() {
  const session = useCurrentSession();
  const permissions = session.data?.authenticated ? session.data.session.access.permissions : [];
  const [patientId, setPatientId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [action, setAction] = useState('');
  const [cursor, setCursor] = useState<string>();
  const [filters, setFilters] = useState({ patientId: '', entityId: '', action: '' });
  const query = useQuery({
    queryKey: ['admin', 'audit', filters, cursor],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ limit: '25' });
      if (filters.patientId) params.set('patientId', filters.patientId);
      if (filters.entityId) params.set('entityId', filters.entityId);
      if (filters.action) params.set('action', filters.action);
      if (cursor) params.set('cursor', cursor);
      return apiGet<AdminAuditListResponse>(`/api/v1/admin/audit?${params.toString()}` as `/api/v1/${string}`, { schema: AdminAuditListResponseSchema, signal });
    },
  });
  const apply = () => { setCursor(undefined); setFilters({ patientId: patientId.trim(), entityId: entityId.trim(), action: action.trim() }); };
  return <AdminShell permissions={permissions}><div className="grid gap-8"><PageHeader eyebrow="Forensic product history" title="Audit Explorer" description="A bounded, read-only view of deterministic state changes. Sensitive questionnaire and safety payloads are intentionally projected out." /><Card><CardHeader><div className="flex items-center gap-3"><Filter aria-hidden="true" className="size-5 text-primary" /><div><h2 className="m-0 text-lg font-semibold">Filter events</h2><p className="mb-0 mt-2 text-sm text-muted-foreground">Use exact identifiers or an action name; results are paginated by timestamp and event ID.</p></div></div></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><Field label="Patient ID"><Input value={patientId} onChange={(event) => setPatientId(event.target.value)} placeholder="Optional UUID" /></Field><Field label="Entity ID"><Input value={entityId} onChange={(event) => setEntityId(event.target.value)} placeholder="Optional ID" /></Field><Field label="Action"><Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="e.g. ASSESSMENT_SUBMITTED" /></Field><Button className="sm:w-fit" onClick={apply}>Search audit</Button></CardContent></Card>{query.isLoading ? <LoadingState /> : query.isError ? <ErrorState action={<Button onClick={() => void query.refetch()}>Try again</Button>} /> : query.data?.items.length ? <AuditTable data={query.data} onNext={() => { setCursor(query.data?.nextCursor ?? undefined); }} /> : <EmptyState />}</div></AdminShell>;
}

function AuditTable({ data, onNext }: { data: AdminAuditListResponse; onNext: () => void }) { return <Card><CardHeader><div className="flex items-center gap-3"><FileSearch aria-hidden="true" className="size-5 text-primary" /><h2 className="m-0 text-xl font-semibold">Recent events</h2></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead className="bg-surface-subtle text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-3" scope="col">When</th><th className="px-3 py-3" scope="col">Action</th><th className="px-3 py-3" scope="col">Actor</th><th className="px-3 py-3" scope="col">Entity</th><th className="px-3 py-3" scope="col">Context</th></tr></thead><tbody>{data.items.map((item) => <tr className="border-t" key={item.eventId}><td className="whitespace-nowrap px-3 py-4 text-muted-foreground">{formatDate(item.occurredAt)}</td><td className="px-3 py-4 font-semibold">{item.action.toLowerCase().replaceAll('_', ' ')}</td><td className="px-3 py-4">{item.actorName ?? 'System'}{item.actorRole ? <span className="block text-xs text-muted-foreground">{item.actorRole}</span> : null}</td><td className="px-3 py-4"><span>{item.entityType}</span>{item.entityId ? <span className="block max-w-48 truncate font-mono text-xs text-muted-foreground" title={item.entityId}>{item.entityId}</span> : null}</td><td className="px-3 py-4 text-muted-foreground">{item.reason ?? (item.metadataSummary ? Object.entries(item.metadataSummary).map(([key, value]) => `${key}: ${value}`).join(' · ') : 'Recorded event')}</td></tr>)}</tbody></table></div>{data.nextCursor ? <div className="mt-5 flex justify-end"><Button onClick={onNext} variant="outline">Next page</Button></div> : null}</CardContent></Card>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-semibold"><span>{label}</span>{children}</label>; }
