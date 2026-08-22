import {
  OperationalIncidentListResponseSchema,
  RecordTechnicalFailureRequestSchema,
  TechnicalFailureListResponseSchema,
  TechnicalFailureTransitionRequestSchema,
  TechnicalFailureViewSchema,
  type OperationalIncidentListResponse,
  type TechnicalFailureView,
} from '@aud-subjective/contracts';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CirclePause, Wrench } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

import { AdminShell } from '@/app/shells/admin-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { ConfirmActionDialog } from '@/components/patterns/confirm-action-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { StateBadge } from '@/components/patterns/state-badge';
import {
  ErrorState,
  EmptyState,
  LoadingState,
} from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentSession } from '@/features/auth/use-auth-data';
import { ApiClientError, apiGet, apiMutate } from '@/lib/api/client';

function humanize(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusTone(status: TechnicalFailureView['status']) {
  if (status === 'CONFIRMED') return 'warning' as const;
  if (status === 'RESOLVED') return 'current' as const;
  if (status === 'CORRECTED_FALSE_POSITIVE') return 'stale' as const;
  return 'information' as const;
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Not recorded';
}

function timingLabel(value: TechnicalFailureView['timingImpact']) {
  if (value === 'PAUSED') return 'Engagement timing paused';
  if (value === 'RECALCULATED') return 'Due time recalculated';
  if (value === 'CORRECTED') return 'Timing correction recorded';
  return 'No timing change yet';
}

export function AdminOperationsPage() {
  return (
    <WorkspaceBoundary workspace="ADMIN">
      <AdminOperationsContent />
    </WorkspaceBoundary>
  );
}

function AdminOperationsContent() {
  const session = useCurrentSession();
  const permissions = session.data?.authenticated
    ? session.data.session.access.permissions
    : [];
  const canOverride = permissions.includes('ENGAGEMENT_TECHNICAL_OVERRIDE');
  const canReadIncidents = permissions.includes('OPERATIONAL_INCIDENT_READ');
  const [mutationError, setMutationError] = useState<string>();
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState({
    patientId: '',
    periodId: '',
    failureType: 'ASSESSMENT_ACCESS_UNAVAILABLE',
    startedAt: new Date().toISOString().slice(0, 16),
    evidence: '',
  });
  const failures = useQuery({
    queryKey: ['admin', 'operations', 'technical-failures'],
    queryFn: ({ signal }) =>
      apiGet('/api/v1/admin/operations/technical-failures', {
        schema: TechnicalFailureListResponseSchema,
        signal,
      }),
  });
  const incidents = useQuery({
    enabled: canReadIncidents,
    queryKey: ['admin', 'operations', 'incidents'],
    queryFn: ({ signal }) =>
      apiGet('/api/v1/admin/operations/incidents', {
        schema: OperationalIncidentListResponseSchema,
        signal,
      }),
  });

  const record = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMutationError(undefined);
    const parsed = RecordTechnicalFailureRequestSchema.parse({
      patientId: draft.patientId.trim(),
      periodId: draft.periodId.trim() || null,
      failureType: draft.failureType.trim(),
      startedAt: new Date(draft.startedAt).toISOString(),
      evidence: draft.evidence.trim(),
    });
    setRecording(true);
    try {
      await apiMutate(
        '/api/v1/admin/operations/technical-failures',
        'POST',
        parsed,
        {
          schema: TechnicalFailureViewSchema,
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        },
      );
      setDraft((current) => ({ ...current, evidence: '' }));
      await failures.refetch();
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      setRecording(false);
    }
  };

  const transition = async (
    row: TechnicalFailureView,
    action: 'confirm' | 'resolve' | 'correct',
    reason: string,
  ) => {
    setMutationError(undefined);
    const body = TechnicalFailureTransitionRequestSchema.parse({
      expectedVersion: row.version,
      reason: reason.trim(),
    });
    try {
      await apiMutate(
        `/api/v1/admin/operations/technical-failures/${row.id}/${action}`,
        'POST',
        body,
        {
          schema: TechnicalFailureViewSchema,
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        },
      );
      await failures.refetch();
    } catch (error) {
      setMutationError(errorMessage(error));
      throw error;
    }
  };

  return (
    <AdminShell permissions={permissions}>
      <div className="grid gap-7">
        <PageHeader
          eyebrow="Focused operations"
          title="Technical access failures"
          description="A patient-scoped manual workflow for confirmed assessment access failures. It changes engagement timing only; it does not alter clinical or safety records."
        />
        {canReadIncidents ? <IncidentPanel query={incidents} /> : null}
        {mutationError ? (
          <p
            className="m-0 rounded-lg border border-danger-border bg-danger-surface px-4 py-3 text-sm font-medium text-danger"
            role="alert"
          >
            {mutationError}
          </p>
        ) : null}
        {canOverride ? (
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-warning-surface text-warning">
                  <Wrench aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h2 className="m-0 text-lg font-semibold">
                    Record suspected failure
                  </h2>
                  <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
                    Record evidence that the assessment surface was unavailable
                    to this patient. A suspected record does not pause timing
                    until it is explicitly confirmed.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4"
                onSubmit={(event) => void record(event)}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Affected patient ID"
                    htmlFor="technical-patient-id"
                  >
                    <Input
                      id="technical-patient-id"
                      value={draft.patientId}
                      onChange={(event) =>
                        setDraft({ ...draft, patientId: event.target.value })
                      }
                      placeholder="Patient UUID"
                      required
                    />
                  </Field>
                  <Field
                    label="Source period ID (optional)"
                    htmlFor="technical-period-id"
                  >
                    <Input
                      id="technical-period-id"
                      value={draft.periodId}
                      onChange={(event) =>
                        setDraft({ ...draft, periodId: event.target.value })
                      }
                      placeholder="Scheduled period UUID"
                    />
                  </Field>
                  <Field label="Failure type" htmlFor="technical-failure-type">
                    <Input
                      id="technical-failure-type"
                      value={draft.failureType}
                      onChange={(event) =>
                        setDraft({ ...draft, failureType: event.target.value })
                      }
                      required
                    />
                  </Field>
                  <Field label="Started at" htmlFor="technical-started-at">
                    <Input
                      id="technical-started-at"
                      type="datetime-local"
                      value={draft.startedAt}
                      onChange={(event) =>
                        setDraft({ ...draft, startedAt: event.target.value })
                      }
                      required
                    />
                  </Field>
                </div>
                <Field label="Evidence summary" htmlFor="technical-evidence">
                  <textarea
                    className="min-h-24 w-full rounded-md border bg-surface px-3 py-3 text-sm shadow-[var(--shadow-sm)]"
                    id="technical-evidence"
                    value={draft.evidence}
                    onChange={(event) =>
                      setDraft({ ...draft, evidence: event.target.value })
                    }
                    placeholder="What was unavailable, for whom, and how was it verified?"
                    required
                  />
                </Field>
                <Button className="sm:w-fit" disabled={recording} type="submit">
                  {recording ? 'Recording…' : 'Record suspected failure'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {failures.isLoading ? (
          <LoadingState />
        ) : failures.isError ? (
          <ErrorState
            action={
              <Button onClick={() => void failures.refetch()}>Try again</Button>
            }
          />
        ) : failures.data?.items.length ? (
          <div className="grid gap-4">
            {failures.data.items.map((row) => (
              <FailureCard
                key={row.id}
                row={row}
                canOverride={canOverride}
                onTransition={transition}
              />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </AdminShell>
  );
}

function IncidentPanel({
  query,
}: {
  query: UseQueryResult<OperationalIncidentListResponse>;
}) {
  const data = query.data;
  return (
    <Card>
      <CardHeader>
        <h2 className="m-0 text-xl font-semibold">System incidents</h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          General operational incidents are shown separately from patient-scoped technical failures.
        </p>
      </CardHeader>
      <CardContent>
        {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState action={<Button onClick={() => void query.refetch()}>Try again</Button>} /> : data && data.items.length > 0 ? (
          <div className="grid gap-3">
            {data.items.map((incident) => (
              <div className="grid gap-2 rounded-lg border bg-surface-subtle p-4 sm:grid-cols-[auto_1fr_auto] sm:items-start" key={incident.id}>
                <StateBadge label={incident.status} state={incident.resolvedAt ? 'current' : 'warning'} />
                <div><p className="m-0 font-semibold">{incident.summary}</p><p className="mb-0 mt-1 text-sm text-muted-foreground">{incident.incidentType} · {incident.code}</p></div>
                <p className="m-0 text-xs text-muted-foreground">{formatDate(incident.createdAt)}</p>
              </div>
            ))}
          </div>
        ) : <p className="m-0 text-sm text-muted-foreground">No system incidents have been recorded.</p>}
      </CardContent>
    </Card>
  );
}

function FailureCard({
  row,
  canOverride,
  onTransition,
}: {
  row: TechnicalFailureView;
  canOverride: boolean;
  onTransition: (
    row: TechnicalFailureView,
    action: 'confirm' | 'resolve' | 'correct',
    reason: string,
  ) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  return (
    <Card>
      <CardContent className="grid gap-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge
                label={humanize(row.status)}
                state={statusTone(row.status)}
              />
              <span className="text-sm font-semibold">{row.failureType}</span>
            </div>
            <p className="mb-0 mt-2 font-mono text-xs text-muted-foreground">
              {row.patientId}
            </p>
            <p className="mb-0 mt-2 text-sm text-muted-foreground">
              Started {formatDate(row.startedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            {row.status === 'CONFIRMED' ? (
              <CirclePause aria-hidden="true" className="size-4" />
            ) : row.status === 'RESOLVED' ? (
              <CheckCircle2
                aria-hidden="true"
                className="size-4 text-success"
              />
            ) : (
              <AlertTriangle aria-hidden="true" className="size-4" />
            )}
            {timingLabel(row.timingImpact)}
          </div>
        </div>
        <div className="grid gap-4 rounded-lg bg-surface-subtle p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Evidence
            </p>
            <p className="mb-0 mt-1 leading-6">{row.evidenceSummary}</p>
          </div>
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Due provenance
            </p>
            <p className="mb-0 mt-1 leading-6">
              Previous: {formatDate(row.previousEffectiveDueAt)}
              <br />
              New: {formatDate(row.recalculatedEffectiveDueAt)}
            </p>
          </div>
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Operator history
            </p>
            <p className="mb-0 mt-1 leading-6">
              Confirmed: {formatDate(row.confirmedAt)}
              <br />
              Resolved/corrected:{' '}
              {formatDate(row.resolvedAt ?? row.correctedAt)}
            </p>
          </div>
        </div>
        {canOverride &&
        row.status !== 'RESOLVED' &&
        row.status !== 'CORRECTED_FALSE_POSITIVE' ? (
          <div className="flex flex-col gap-3 border-t pt-4">
            <Label htmlFor={`reason-${row.id}`}>Action reason</Label>
            <Input
              id={`reason-${row.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Document the operator decision"
            />
            <div className="flex flex-wrap gap-2">
              {row.status === 'SUSPECTED' ? (
                <ConfirmActionDialog
                  triggerLabel="Confirm access failure"
                  title="Confirm this technical access failure?"
                  description="Confirmation pauses engagement timing for the affected patient. Confirm only documented assessment access unavailability, not an unopened reminder or missing response."
                  confirmLabel="Confirm failure"
                  disabled={!reason.trim()}
                  onConfirm={() => onTransition(row, 'confirm', reason)}
                />
              ) : null}
              {row.status === 'CONFIRMED' ? (
                <ConfirmActionDialog
                  triggerLabel="Resolve and recalculate"
                  title="Resolve this access failure?"
                  description="Resolution applies the locked formula: original due time plus pause duration, with a minimum 24-hour recovery window from resolution. The recalculated due time is recorded in schedule provenance."
                  confirmLabel="Resolve failure"
                  disabled={!reason.trim()}
                  onConfirm={() => onTransition(row, 'resolve', reason)}
                />
              ) : null}
              {row.status === 'CONFIRMED' ? (
                <ConfirmActionDialog
                  triggerLabel="Correct false positive"
                  title="Correct this failure as a false positive?"
                  description="This restores the authoritative pre-failure timing, prevents a reminder backlog, and closes any engagement case caused only by the incorrect timing."
                  confirmLabel="Correct record"
                  intent="destructive"
                  disabled={!reason.trim()}
                  onConfirm={() => onTransition(row, 'correct', reason)}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function errorMessage(error: unknown) {
  if (
    error instanceof ApiClientError &&
    error.response?.error.code === 'VERSION_CONFLICT'
  ) {
    return 'This technical-failure record changed while it was open. Reload the current operations list.';
  }
  return 'The operations action could not be completed. Review the evidence and current record.';
}
