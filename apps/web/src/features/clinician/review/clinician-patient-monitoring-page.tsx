import {
  ClinicianPatientMonitoringResponseSchema,
  type ClinicianPatientMonitoringResponse,
} from '@aud-subjective/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useState } from 'react';

import { ClinicianShell } from '@/app/shells/clinician-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { PageHeader } from '@/components/patterns/page-header';
import { StateBadge } from '@/components/patterns/state-badge';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  RestrictedState,
} from '@/components/patterns/system-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ApiClientError, apiGet, apiMutate } from '@/lib/api/client';

function humanize(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

function freshnessLabel(
  value: ClinicianPatientMonitoringResponse['source']['freshness'],
) {
  return value === 'CURRENT'
    ? 'Current'
    : value === 'STALE'
      ? 'Stale data'
      : value === 'REVOKED'
        ? 'Revision revoked'
        : 'No current data';
}

function freshnessTone(
  value: ClinicianPatientMonitoringResponse['source']['freshness'],
) {
  return value === 'CURRENT' ? ('current' as const) : ('stale' as const);
}

export function ClinicianPatientMonitoringPage() {
  return (
    <WorkspaceBoundary workspace="CLINICIAN">
      <ClinicianPatientMonitoringContent />
    </WorkspaceBoundary>
  );
}

function ClinicianPatientMonitoringContent() {
  const { patientId } = useParams();
  const queryClient = useQueryClient();
  const [acknowledging, setAcknowledging] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const query = useQuery({
    enabled: Boolean(patientId),
    queryKey: ['clinician', 'patient-monitoring', patientId],
    queryFn: ({ signal }) =>
      apiGet<ClinicianPatientMonitoringResponse>(
        `/api/v1/clinician/patients/${patientId}/monitoring` as `/api/v1/${string}`,
        { schema: ClinicianPatientMonitoringResponseSchema, signal },
      ),
  });

  const acknowledge = async () => {
    if (!query.data?.currentCase || !patientId) return;
    setAcknowledging(true);
    setActionError(undefined);
    try {
      const response = await apiMutate<ClinicianPatientMonitoringResponse>(
        `/api/v1/clinician/review-cases/${query.data.currentCase.id}/acknowledge`,
        'POST',
        { expectedCaseVersion: query.data.currentCase.caseVersion },
        {
          schema: ClinicianPatientMonitoringResponseSchema,
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        },
      );
      queryClient.setQueryData(
        ['clinician', 'patient-monitoring', patientId],
        response,
      );
      await queryClient.invalidateQueries({
        queryKey: ['clinician', 'review-queue'],
      });
    } catch (error) {
      setActionError(
        error instanceof ApiClientError &&
          error.response?.error.code === 'VERSION_CONFLICT'
          ? 'This review changed while it was open. The current state has been reloaded.'
          : 'The acknowledgement could not be completed. Review the current state and try again.',
      );
      await query.refetch();
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <ClinicianShell>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError || !query.data ? (
        query.error instanceof ApiClientError && query.error.status === 403 ? (
          <RestrictedState />
        ) : (
          <ErrorState
            action={
              <Button onClick={() => void query.refetch()}>Try again</Button>
            }
          />
        )
      ) : (
        <MonitoringDetail
          {...(actionError ? { actionError } : {})}
          acknowledging={acknowledging}
          data={query.data}
          onAcknowledge={acknowledge}
        />
      )}
    </ClinicianShell>
  );
}

function MonitoringDetail({
  data,
  acknowledging,
  actionError,
  onAcknowledge,
}: {
  data: ClinicianPatientMonitoringResponse;
  acknowledging: boolean;
  actionError?: string;
  onAcknowledge: () => Promise<void>;
}) {
  const currentCase = data.currentCase;
  return (
    <div className="grid gap-7">
      <PageHeader
        action={
          <Link to="/clinician/review-queue">
            <Button variant="outline">Back to Review Queue</Button>
          </Link>
        }
        description="Authoritative monitoring detail, Level-2 visibility, and the current Level-3 review state for this assigned patient."
        eyebrow={data.patientName}
        title="Monitoring detail"
      />

      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-semibold">Source and freshness</h2>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Freshness</dt>
              <dd className="m-0 mt-1">
                <StateBadge
                  label={freshnessLabel(data.source.freshness)}
                  state={freshnessTone(data.source.freshness)}
                />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Completion</dt>
              <dd className="m-0 mt-1 font-semibold">
                {data.source.completionStatus ?? 'Not available'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd className="m-0 mt-1 font-semibold">
                {formatDate(data.source.submittedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Period</dt>
              <dd className="m-0 mt-1 font-semibold">
                {formatDate(data.source.periodStartAt)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Goal context</dt>
              <dd className="m-0 mt-1 font-semibold">
                {data.source.goal ?? 'Not available'}
              </dd>
            </div>
          </dl>
          <p className="mb-0 mt-4 font-mono text-xs text-muted-foreground">
            Revision {data.source.revisionId ?? 'not available'} · Evaluation{' '}
            {data.source.evaluationId ?? 'not available'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Level 2
              </p>
              <h2 className="mb-0 mt-2 text-xl font-semibold">
                Monitoring visibility
              </h2>
            </div>
            <Badge variant="information">Visibility only</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {data.visibilityFlags.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.visibilityFlags.map((flag) => {
                const state =
                  flag.status === 'CURRENT_ACTIVE'
                    ? ('current' as const)
                    : flag.status === 'CURRENT_CLEARED'
                      ? ('information' as const)
                      : flag.status === 'REVOKED_BY_REVISION'
                        ? ('warning' as const)
                        : ('stale' as const);
                return (
                  <div
                    className="flex flex-col gap-2 rounded-lg border p-4"
                    key={flag.flagKey}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {humanize(flag.flagKey)}
                      </span>
                      <StateBadge label={humanize(flag.status)} state={state} />
                    </div>
                    <p className="m-0 text-xs text-muted-foreground">
                      {flag.sourceCompletionStatus ?? 'Source unavailable'} ·{' '}
                      {formatDate(flag.sourceSubmittedAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Level 3
          </p>
          <h2 className="mb-0 mt-2 text-xl font-semibold">
            Clinical review case
          </h2>
        </CardHeader>
        <CardContent className="grid gap-5">
          {currentCase ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StateBadge
                  label={humanize(currentCase.lifecycle)}
                  state={
                    currentCase.lifecycle === 'NEW'
                      ? 'warning'
                      : currentCase.lifecycle === 'CLEARANCE_PENDING'
                        ? 'stale'
                        : 'current'
                  }
                />
                <Badge variant="neutral">
                  Case version {currentCase.caseVersion}
                </Badge>
              </div>
              <div className="grid gap-2 text-sm">
                <p className="m-0 font-semibold">Active reasons</p>
                <p className="m-0 text-muted-foreground">
                  {currentCase.activeReasonFamilies.length > 0
                    ? currentCase.activeReasonFamilies.map(humanize).join(', ')
                    : 'None'}
                </p>
                <p className="m-0 font-semibold">Clearance pending</p>
                <p className="m-0 text-muted-foreground">
                  {currentCase.clearancePendingReasonFamilies.length > 0
                    ? currentCase.clearancePendingReasonFamilies
                        .map(humanize)
                        .join(', ')
                    : 'None'}
                </p>
              </div>
              {currentCase.lifecycle === 'NEW' ? (
                <Button
                  disabled={acknowledging}
                  onClick={() => void onAcknowledge()}
                >
                  {acknowledging ? 'Acknowledging…' : 'Acknowledge review'}
                </Button>
              ) : null}
              {actionError ? (
                <p className="m-0 text-sm font-medium text-danger" role="alert">
                  {actionError}
                </p>
              ) : null}
            </>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              No clinical review case is currently open for this patient.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-semibold">
            Tasks and correction history
          </h2>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3">
            {data.tasks.length > 0 ? (
              data.tasks.map((task) => (
                <div className="rounded-lg border p-4" key={task.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 font-semibold">{task.title}</p>
                    <StateBadge
                      label={humanize(task.deliveryStatus)}
                      state={
                        task.alertUpdateRequired
                          ? 'warning'
                          : task.deliveryStatus === 'UNROUTED'
                            ? 'stale'
                            : 'current'
                      }
                    />
                  </div>
                  <p className="mb-0 mt-2 text-sm text-muted-foreground">
                    Reason: {humanize(task.createdReason)} · Created{' '}
                    {formatDate(task.createdAt)}
                  </p>
                  {task.alertUpdateRequired ? (
                    <p className="mb-0 mt-2 text-sm font-semibold text-warning">
                      This task was invalidated by a later correction and
                      requires review of the updated state.
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="m-0 text-sm text-muted-foreground">
                No durable task is attached to the current case.
              </p>
            )}
          </div>
          {data.reasonHistory.length > 0 ? (
            <div className="grid gap-3 border-t pt-5">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Reason history
              </p>
              {data.reasonHistory.slice(0, 12).map((entry, index) => (
                <div
                  className="flex flex-wrap justify-between gap-2 text-sm"
                  key={`${entry.reasonFamily}-${entry.recordedAt}-${index}`}
                >
                  <span>
                    {humanize(entry.reasonFamily)} ·{' '}
                    {entry.fromStatus ? humanize(entry.fromStatus) : 'New'} →{' '}
                    {humanize(entry.toStatus)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(entry.recordedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
