import {
  AdminSafetyCaseListResponseSchema,
  AdminSafetyCaseProjectionSchema,
  type AdminSafetyCaseProjection,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { Activity, X } from 'lucide-react';
import { useState } from 'react';

import { AdminShell } from '@/app/shells/admin-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/patterns/system-state';
import { StateBadge } from '@/components/patterns/state-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useCurrentSession } from '@/features/auth/use-auth-data';
import { apiGet } from '@/lib/api/client';

const severityLabels: Record<string, string> = {
  S0_EMERGENCY: 'Emergency',
  S1_URGENT: 'Urgent',
  S2_PRIORITY: 'Priority',
  S3_ROUTINE: 'Routine',
};

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

function severityTone(severity: string) {
  if (severity === 'S0_EMERGENCY') return 'danger' as const;
  if (severity === 'S1_URGENT') return 'warning' as const;
  if (severity === 'S2_PRIORITY') return 'stale' as const;
  return 'information' as const;
}

export function AdminSafetyPage() {
  const session = useCurrentSession();
  const permissions = session.data?.authenticated
    ? session.data.session.access.permissions
    : [];
  return (
    <WorkspaceBoundary workspace="ADMIN">
      <AdminSafetyWorkspace permissions={permissions} />
    </WorkspaceBoundary>
  );
}

function AdminSafetyWorkspace({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const cases = useQuery({
    queryKey: ['admin', 'safety-cases'],
    queryFn: ({ signal }) =>
      apiGet('/api/v1/admin/safety-cases', {
        schema: AdminSafetyCaseListResponseSchema,
        signal,
      }),
  });
  const detail = useQuery({
    enabled: Boolean(selectedId),
    queryKey: ['admin', 'safety-case', selectedId],
    queryFn: ({ signal }) =>
      apiGet<AdminSafetyCaseProjection>(
        `/api/v1/admin/safety-cases/${selectedId}`,
        { schema: AdminSafetyCaseProjectionSchema, signal },
      ),
  });

  return (
    <AdminShell permissions={permissions}>
      <div className="mb-6">
        <div className="flex items-start gap-3">
          <Activity className="mt-1 size-6 text-primary" />
          <div>
            <p className="m-0 text-sm font-semibold text-primary">
              Operational visibility
            </p>
            <h1 className="mb-0 mt-1 text-3xl font-semibold">
              Safety operations
            </h1>
            <p className="mb-0 mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Read-only visibility into safety cases, routing configuration, and
              operational incidents. Clinical mutations remain in the assigned
              clinician workspace.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.4fr)]">
        <section className="grid content-start gap-3">
          {cases.isLoading ? <LoadingState /> : null}
          {cases.isError ? (
            <ErrorState
              action={
                <Button onClick={() => void cases.refetch()}>Try again</Button>
              }
            />
          ) : null}
          {!cases.isLoading &&
          !cases.isError &&
          cases.data?.items.length === 0 ? (
            <EmptyState />
          ) : null}
          {!cases.isLoading && !cases.isError
            ? cases.data?.items.map((item) => (
                <button
                  className={`rounded-xl border bg-surface p-4 text-left shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle ${selectedId === item.id ? 'border-primary ring-2 ring-ring/30' : ''}`}
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="m-0 font-mono text-xs text-muted-foreground">
                        {item.patientId}
                      </p>
                      <h2 className="mb-0 mt-1 text-base font-semibold">
                        {formatEnum(item.domain)}
                      </h2>
                    </div>
                    <StateBadge
                      label={severityLabels[item.severity] ?? item.severity}
                      state={severityTone(item.severity)}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge>{formatEnum(item.lifecycle)}</Badge>
                    <Badge variant={item.resolvedAt ? 'neutral' : 'warning'}>
                      {item.resolvedAt ? 'Resolved' : 'Open'}
                    </Badge>
                    <Badge
                      variant={
                        item.routeStatus === 'AVAILABLE' ? 'success' : 'warning'
                      }
                    >
                      {item.routeStatus}
                    </Badge>
                  </div>
                  <p className="mb-0 mt-3 text-xs text-muted-foreground">
                    Owner {formatEnum(item.ownerRole)} · Route profile v
                    {item.routeProfileLogicalVersion ?? '—'}
                  </p>
                  <p className="mb-0 mt-1 text-xs text-muted-foreground">
                    Detected {formatDate(item.detectedAt)} · Updated{' '}
                    {formatDate(item.updatedAt)}
                  </p>
                </button>
              ))
            : null}
        </section>

        <section>
          {!selectedId ? (
            <Card>
              <CardContent>
                <p className="m-0 text-sm text-muted-foreground">
                  Select a case to inspect its operational projection.
                </p>
              </CardContent>
            </Card>
          ) : detail.isLoading ? (
            <LoadingState />
          ) : detail.isError || !detail.data ? (
            <ErrorState
              action={
                <Button onClick={() => void detail.refetch()}>Try again</Button>
              }
            />
          ) : (
            <AdminSafetyDetail
              detail={detail.data}
              onClose={() => setSelectedId(undefined)}
            />
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function AdminSafetyDetail({
  detail,
  onClose,
}: {
  detail: AdminSafetyCaseProjection;
  onClose: () => void;
}) {
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="m-0 font-mono text-xs text-muted-foreground">
                {detail.id}
              </p>
              <h2 className="mb-0 mt-1 text-2xl font-semibold">
                {formatEnum(detail.domain)}
              </h2>
            </div>
            <Button
              aria-label="Close safety detail"
              onClick={onClose}
              size="icon"
              variant="outline"
            >
              <X className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 text-sm">
          <div className="flex flex-wrap gap-2">
            <StateBadge
              label={severityLabels[detail.severity] ?? detail.severity}
              state={severityTone(detail.severity)}
            />
            <Badge>{formatEnum(detail.lifecycle)}</Badge>
            <Badge variant={detail.resolvedAt ? 'neutral' : 'warning'}>
              {detail.resolvedAt ? 'Resolved' : 'Open'}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Patient reference" value={detail.patientId} />
            <Detail label="Owner role" value={formatEnum(detail.ownerRole)} />
            <Detail label="Gate status" value={formatEnum(detail.gateStatus)} />
            <Detail label="Route status" value={detail.routeStatus} />
            <Detail
              label="Route profile"
              value={
                detail.routeProfileId ? detail.routeProfileId : 'Not assigned'
              }
            />
            <Detail
              label="Route profile version"
              value={String(
                detail.routeProfileLogicalVersion ?? 'Not assigned',
              )}
            />
            <Detail label="Detected" value={formatDate(detail.detectedAt)} />
            <Detail label="Updated" value={formatDate(detail.updatedAt)} />
            <Detail label="Resolved" value={formatDate(detail.resolvedAt)} />
            <Detail
              label="Response target"
              value={responseTargetText(detail)}
            />
          </div>
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reason codes
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {detail.reasonCodes.length ? (
                detail.reasonCodes.map((code) => (
                  <Badge key={code}>{formatEnum(code)}</Badge>
                ))
              ) : (
                <span className="text-muted-foreground">None returned</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-semibold">Current route snapshot</h2>
        </CardHeader>
        <CardContent>
          {detail.currentRouteSnapshot ? (
            <RouteSnapshotSummary snapshot={detail.currentRouteSnapshot} />
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              No current route snapshot returned.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-semibold">Current restrictions</h2>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {detail.currentRestriction ? (
            <>
              <Detail
                label="Gate"
                value={formatEnum(detail.currentRestriction.gateStatus)}
              />
              <Detail
                label="Monitoring prompts"
                value={detail.currentRestriction.monitoringPromptPolicy}
              />
              <Detail
                label="Goal changes"
                value={
                  detail.currentRestriction.goalChangeAllowed
                    ? 'Allowed'
                    : 'Restricted'
                }
              />
              <Detail
                label="Reassessment due"
                value={formatDate(detail.currentRestriction.reassessmentDueAt)}
              />
              <Detail
                label="Allowed interventions"
                value={
                  detail.currentRestriction.allowedSubjectiveInterventions
                    .map(formatEnum)
                    .join(', ') || 'None listed'
                }
              />
            </>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              No current restriction projection returned.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-semibold">Lifecycle history</h2>
        </CardHeader>
        <CardContent className="grid gap-3">
          {detail.lifecycleEvents.length ? (
            detail.lifecycleEvents.map((event) => (
              <div className="border-l-2 border-primary pl-4" key={event.id}>
                <p className="m-0 font-semibold">
                  {event.fromState ? `${formatEnum(event.fromState)} → ` : ''}
                  {formatEnum(event.toState)}
                </p>
                <p className="m-0 text-sm text-muted-foreground">
                  {event.reason ?? 'No reason recorded'} ·{' '}
                  {formatDate(event.occurredAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              No lifecycle events returned.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-semibold">Disposition history</h2>
        </CardHeader>
        <CardContent className="grid gap-3">
          {detail.dispositions.length ? (
            detail.dispositions.map((item) => (
              <div className="rounded-lg border p-4" key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-semibold">
                    {formatEnum(item.disposition)}
                  </p>
                  <Badge>v{item.version}</Badge>
                </div>
                <p className="mb-0 mt-2 text-sm text-muted-foreground">
                  {item.reason} · {formatDate(item.createdAt)}
                </p>
                {item.restrictions ? (
                  <p className="mb-0 mt-2 text-xs text-muted-foreground">
                    {formatEnum(item.restrictions.gateStatus)} · prompts{' '}
                    {item.restrictions.monitoringPromptPolicy} · goals{' '}
                    {item.restrictions.goalChangeAllowed
                      ? 'allowed'
                      : 'restricted'}
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              No dispositions returned.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-semibold">Operational incidents</h2>
        </CardHeader>
        <CardContent className="grid gap-3">
          {detail.operationalIncidents.length ? (
            detail.operationalIncidents.map((incident) => (
              <div className="rounded-lg border p-4" key={incident.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-semibold">{incident.code}</p>
                  <Badge
                    variant={
                      incident.status === 'RESOLVED' ? 'success' : 'warning'
                    }
                  >
                    {incident.status}
                  </Badge>
                </div>
                <p className="mb-0 mt-2 text-sm">{incident.summary}</p>
                <p className="mb-0 mt-2 text-xs text-muted-foreground">
                  {formatEnum(incident.incidentType)} · Created{' '}
                  {formatDate(incident.createdAt)} · Resolved{' '}
                  {formatDate(incident.resolvedAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              No routing incidents returned.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="m-0 mt-1 break-words">{value}</p>
    </div>
  );
}

function responseTargetText(item: AdminSafetyCaseProjection) {
  const target = item.responseTarget;
  if (target.maximumSystemResponseSeconds)
    return `${target.maximumSystemResponseSeconds}s maximum system response`;
  if (target.acknowledgementMinutes)
    return `Acknowledge within ${target.acknowledgementMinutes} minutes`;
  if (target.acknowledgementHours)
    return `Acknowledge within ${target.acknowledgementHours} hours`;
  if (target.reviewBusinessDays)
    return `Review within ${target.reviewBusinessDays} business days`;
  return 'No additional response target';
}

function RouteSnapshotSummary({ snapshot }: { snapshot: unknown }) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return (
      <pre className="max-h-80 overflow-auto rounded-lg bg-foreground p-4 text-xs text-inverse-foreground">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    );
  }
  const record = snapshot as Record<string, unknown>;
  const targetLabel = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return 'Not configured';
    const target = value as Record<string, unknown>;
    return typeof target.label === 'string'
      ? target.label
      : 'Configured target';
  };
  return (
    <div className="grid gap-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <Detail
          label="Status"
          value={typeof record.status === 'string' ? record.status : 'Unknown'}
        />
        <Detail label="Primary target" value={targetLabel(record.primary)} />
        <Detail label="Fallback target" value={targetLabel(record.fallback)} />
      </div>
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
          View full route metadata
        </summary>
        <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-foreground p-4 text-xs text-inverse-foreground">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </details>
    </div>
  );
}
