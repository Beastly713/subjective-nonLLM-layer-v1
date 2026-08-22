import {
  AdminOverviewResponseSchema,
  type AdminOverviewResponse,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, CircleAlert, Database, ShieldCheck, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { AdminShell } from '@/app/shells/admin-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { PageHeader } from '@/components/patterns/page-header';
import { StateBadge } from '@/components/patterns/state-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useCurrentSession } from '@/features/auth/use-auth-data';
import { ApiClientError, apiGet } from '@/lib/api/client';

export function AdminOverviewPage() {
  return (
    <WorkspaceBoundary workspace="ADMIN">
      <AdminOverviewContent />
    </WorkspaceBoundary>
  );
}

function AdminOverviewContent() {
  const session = useCurrentSession();
  const permissions = session.data?.authenticated
    ? session.data.session.access.permissions
    : [];
  const query = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: ({ signal }) =>
      apiGet<AdminOverviewResponse>('/api/v1/admin/overview', {
        schema: AdminOverviewResponseSchema,
        signal,
      }),
  });

  return (
    <AdminShell permissions={permissions}>
      <div className="grid gap-8">
        <PageHeader
          eyebrow="Governance workspace"
          title="Administrative overview"
          description="Factual application, content, and operations visibility for the local capstone. Clinical details stay in the clinician workspace."
        />
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          query.error instanceof ApiClientError && query.error.status === 403 ? (
            <EmptyState />
          ) : (
            <ErrorState action={<Button onClick={() => void query.refetch()}>Try again</Button>} />
          )
        ) : query.data ? (
          <OverviewContent data={query.data} />
        ) : (
          <EmptyState />
        )}
      </div>
    </AdminShell>
  );
}

function OverviewContent({ data }: { data: AdminOverviewResponse }) {
  return (
    <>
      <section aria-label="Administrative totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile icon={<UsersRound aria-hidden="true" className="size-5" />} label="Provisioned users" value={data.users.total} />
        <MetricTile icon={<BookOpenCheck aria-hidden="true" className="size-5" />} label="Approved content versions" value={data.content.approved} />
        <MetricTile icon={<CircleAlert aria-hidden="true" className="size-5" />} label="Open operational incidents" value={data.operations.openIncidents} />
        <MetricTile icon={<Database aria-hidden="true" className="size-5" />} label="Audit events, last 24 hours" value={data.operations.recentAuditEvents} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="m-0 text-xl font-semibold">Application status</h2>
            <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">The local demo shows the capabilities that actually exist in this repository.</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            <StatusRow label="Application/API" value="Available" tone="current" />
            <StatusRow label="PostgreSQL" value="Available" tone="current" />
            <StatusRow label="Prototype mode" value={data.localMode === 'prototype' ? 'Active' : 'Inactive'} tone="information" />
            <StatusRow label="Background jobs" value="Deferred for local capstone" tone="information" />
            <StatusRow label="External delivery" value="Deferred for local capstone" tone="information" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3"><ShieldCheck aria-hidden="true" className="size-5 text-primary" /><div><h2 className="m-0 text-xl font-semibold">Content governance</h2><p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">Lifecycle state is explicit; historical versions remain inspectable.</p></div></div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <StatusRow label="Draft" value={String(data.content.draft)} tone="information" />
            <StatusRow label="In review" value={String(data.content.underReview)} tone="warning" />
            <StatusRow label="Approved" value={String(data.content.approved)} tone="current" />
            <StatusRow label="Retired" value={String(data.content.retired)} tone="stale" />
            <StatusRow label="Rejected" value={String(data.content.rejected)} tone="danger" />
            <StatusRow label="Confirmed failures" value={String(data.operations.openTechnicalFailures)} tone="warning" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="m-0 text-xl font-semibold">Continue in a focused workspace</h2></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <WorkspaceLink href="/admin/content" title="Content management" description="Review versions, preview Markdown, and govern lifecycle transitions." />
          <WorkspaceLink href="/admin/operations" title="Operations" description="Inspect technical failures and system incidents." />
          <WorkspaceLink href="/admin/audit" title="Audit Explorer" description="Search bounded, privacy-aware provenance records." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-semibold">Content coverage</h2>
          <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">Logical approved resources are counted against the existing frequency policy; version rows are not double-counted.</p>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.content.coverage.map((item) => (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-surface-subtle p-3" key={item.interventionClass}>
              <span className="text-sm font-medium">{item.interventionClass.toLowerCase().replaceAll('_', ' ')} · {item.locale}</span>
              <StateBadge label={`${item.approvedLogicalResources} / ${item.minimumRequired}`} state={item.met ? 'current' : 'warning'} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-information-border bg-information-surface/40">
        <CardHeader><h2 className="m-0 text-lg font-semibold">Production-deferred boundary</h2></CardHeader>
        <CardContent className="grid gap-2 text-sm leading-6 text-muted-foreground">
          {data.productionDeferred.map((item) => <p className="m-0" key={item}>• {item}</p>)}
        </CardContent>
      </Card>
    </>
  );
}

function MetricTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <Card><CardContent className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-information-surface text-information">{icon}</span><div><p className="m-0 text-2xl font-semibold tabular-nums">{value}</p><p className="mb-0 mt-1 text-sm text-muted-foreground">{label}</p></div></CardContent></Card>;
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone: 'current' | 'information' | 'warning' | 'stale' | 'danger' }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border bg-surface-subtle p-3"><span className="text-sm font-medium">{label}</span><StateBadge label={value} state={tone} /></div>;
}

function WorkspaceLink({ href, title, description }: { href: string; title: string; description: string }) {
  return <Link className="rounded-lg border p-4 transition-colors hover:border-primary hover:bg-surface-subtle" to={href}><p className="m-0 font-semibold text-primary">{title}</p><p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">{description}</p></Link>;
}
