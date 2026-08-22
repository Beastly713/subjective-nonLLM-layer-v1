import {
  SafetyCaseListResponseSchema,
  SafetyCaseMutationRequestSchema,
  SafetyCaseProjectionSchema,
  SafetyDispositionRequestSchema,
  SUBJECTIVE_INTERVENTION_CLASSES,
  type SafetyCaseLifecycle,
  type SafetyCaseProjection,
  type SafetyDisposition,
  type SafetyRestrictionInput,
  type SubjectiveInterventionClass,
} from '@aud-subjective/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ClinicianShell } from '@/app/shells/clinician-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { ConfirmActionDialog } from '@/components/patterns/confirm-action-dialog';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/patterns/system-state';
import { StateBadge } from '@/components/patterns/state-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiClientError, apiGet, apiMutate } from '@/lib/api/client';

const dispositionOptions: readonly SafetyDisposition[] = [
  'SAFE_TO_CONTINUE_STANDARD_MONITORING',
  'SAFE_TO_CONTINUE_WITH_RESTRICTIONS',
  'CONTINUE_CLINICAL_HANDOFF',
  'EMERGENCY_EXTERNAL_MANAGEMENT',
  'MONITORING_TEMPORARILY_PAUSED',
];

const severityLabels: Record<string, string> = {
  S0_EMERGENCY: 'Emergency',
  S1_URGENT: 'Urgent',
  S2_PRIORITY: 'Priority',
  S3_ROUTINE: 'Routine',
};

const lifecycleLabels: Record<SafetyCaseLifecycle, string> = {
  DETECTED: 'Detected',
  HANDOFF_INITIATED: 'Handoff initiated',
  ACKNOWLEDGED: 'Acknowledged',
  CLINICAL_REVIEW_IN_PROGRESS: 'Clinical review in progress',
  PLAN_ESTABLISHED: 'Plan established',
  RESOLVED: 'Resolved',
  ESCALATED_TO_EMERGENCY: 'Escalated to emergency',
  RESOLVED_EXTERNAL_HANDOFF: 'Resolved external handoff',
};

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace('S0 Emergency', 'Emergency');
}

function severityTone(severity: string) {
  if (severity === 'S0_EMERGENCY') return 'danger' as const;
  if (severity === 'S1_URGENT') return 'warning' as const;
  if (severity === 'S2_PRIORITY') return 'stale' as const;
  return 'information' as const;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

function localDateTime(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

export function ClinicianSafetyPage() {
  return (
    <WorkspaceBoundary workspace="CLINICIAN">
      <ClinicianSafetyWorkspace />
    </WorkspaceBoundary>
  );
}

function ClinicianSafetyWorkspace() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [mutationError, setMutationError] = useState<string>();
  const [pending, setPending] = useState(false);

  const cases = useQuery({
    queryKey: ['clinician', 'safety-cases'],
    queryFn: ({ signal }) =>
      apiGet('/api/v1/clinician/safety-cases', {
        schema: SafetyCaseListResponseSchema,
        signal,
      }),
  });

  const detail = useQuery({
    enabled: Boolean(selectedId),
    queryKey: ['clinician', 'safety-case', selectedId],
    queryFn: ({ signal }) =>
      apiGet<SafetyCaseProjection>(
        `/api/v1/clinician/safety-cases/${selectedId}`,
        {
          schema: SafetyCaseProjectionSchema,
          signal,
        },
      ),
  });

  const selected = detail.data;

  const errorCode = (error: unknown) =>
    error instanceof ApiClientError ? error.response?.error.code : undefined;

  const refreshStaleCase = async () => {
    await Promise.all([cases.refetch(), detail.refetch()]);
  };

  const handleError = async (error: unknown) => {
    const code = errorCode(error);

    if (code === 'VERSION_CONFLICT') {
      setMutationError(
        'This safety case changed while it was open. The current case has been reloaded.',
      );
      await refreshStaleCase();
      return;
    }

    if (code === 'SAFETY_CASE_TRANSITION_INVALID') {
      setMutationError(
        'That action is not valid for the case’s current lifecycle.',
      );
      await refreshStaleCase();
      return;
    }

    if (code === 'SAFETY_RESTRICTION_BROADENING_NOT_ALLOWED') {
      setMutationError(
        'The requested restriction would broaden the current safety controls.',
      );
      await refreshStaleCase();
      return;
    }

    if (code === 'PERMISSION_DENIED') {
      setMutationError(
        'Your current permissions do not allow this safety action.',
      );
      return;
    }

    setMutationError(
      'The safety action could not be completed. Review the current case and try again.',
    );
  };

  const runMutation = async (
    safetyCase: SafetyCaseProjection,
    path: `/api/v1/${string}`,
    body: unknown,
  ) => {
    setPending(true);
    setMutationError(undefined);

    try {
      const result = await apiMutate<SafetyCaseProjection>(path, 'POST', body, {
        schema: SafetyCaseProjectionSchema,
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
        },
      });

      queryClient.setQueryData(
        ['clinician', 'safety-case', safetyCase.id],
        result,
      );

      await Promise.all([cases.refetch(), detail.refetch()]);
    } catch (error) {
      await handleError(error);
      throw error;
    } finally {
      setPending(false);
    }
  };

  const runLifecycle = async (
    safetyCase: SafetyCaseProjection,
    reason: string,
    endpoint: 'acknowledge' | 'begin-review' | 'establish-plan',
  ) => {
    if (!reason.trim()) {
      setMutationError('Enter a reason before changing the case lifecycle.');
      return;
    }

    const body = SafetyCaseMutationRequestSchema.parse({
      expectedVersion: safetyCase.version,
      reason: reason.trim(),
    });

    await runMutation(
      safetyCase,
      `/api/v1/clinician/safety-cases/${safetyCase.id}/${endpoint}`,
      body,
    );
  };

  const runDisposition = async (
    safetyCase: SafetyCaseProjection,
    reason: string,
    value: SafetyDisposition,
    restrictions: SafetyRestrictionInput,
  ) => {
    if (!reason.trim()) {
      setMutationError('Enter a reason before recording a disposition.');
      return;
    }

    const body = SafetyDispositionRequestSchema.parse({
      expectedVersion: safetyCase.version,
      reason: reason.trim(),
      disposition: value,
      ...(value === 'SAFE_TO_CONTINUE_WITH_RESTRICTIONS'
        ? { restrictions }
        : {}),
    });

    await runMutation(
      safetyCase,
      `/api/v1/clinician/safety-cases/${safetyCase.id}/disposition`,
      body,
    );
  };

  const runEmergency = async (
    safetyCase: SafetyCaseProjection,
    reason: string,
  ) => {
    if (!reason.trim()) {
      setMutationError('Enter a reason before escalating the case.');
      return;
    }

    const body = SafetyCaseMutationRequestSchema.parse({
      expectedVersion: safetyCase.version,
      reason: reason.trim(),
    });

    await runMutation(
      safetyCase,
      `/api/v1/clinician/safety-cases/${safetyCase.id}/escalate`,
      body,
    );
  };

  const runExternalResolution = async (
    safetyCase: SafetyCaseProjection,
    reason: string,
  ) => {
    if (!reason.trim()) {
      setMutationError('Enter a reason before resolving the external handoff.');
      return;
    }

    const body = SafetyCaseMutationRequestSchema.parse({
      expectedVersion: safetyCase.version,
      reason: reason.trim(),
    });

    await runMutation(
      safetyCase,
      `/api/v1/clinician/safety-cases/${safetyCase.id}/resolve-external-handoff`,
      body,
    );
  };

  const guarded = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch {
      // The local mutation error already explains the failure and stale data is refreshed above.
    }
  };

  const activeCases = cases.data?.items ?? [];

  return (
    <ClinicianShell>
      <div className="mb-6">
        <p className="m-0 text-sm font-semibold text-primary">
          Assigned patient operations
        </p>
        <h1 className="mb-0 mt-1 text-3xl font-semibold">Safety cases</h1>
        <p className="mb-0 mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Review operational safety projections, move cases through the
          canonical lifecycle, and record structured dispositions. Questionnaire
          answers are not shown here.
        </p>
      </div>

      {mutationError ? (
        <div
          className="mb-6 rounded-lg border border-danger-border bg-danger-surface/40 p-4 text-sm font-medium text-danger"
          role="alert"
        >
          {mutationError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.4fr)]">
        <section className="grid content-start gap-3">
          {cases.isLoading ? <LoadingState /> : null}

          {cases.isError ? (
            <ErrorState
              action={
                <Button onClick={() => void cases.refetch()}>Try again</Button>
              }
            />
          ) : null}

          {!cases.isLoading && !cases.isError && activeCases.length === 0 ? (
            <EmptyState />
          ) : null}

          {!cases.isLoading && !cases.isError
            ? activeCases.map((item) => (
                <button
                  className={`rounded-xl border bg-surface p-4 text-left shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-subtle ${
                    selectedId === item.id
                      ? 'border-primary ring-2 ring-ring/30'
                      : ''
                  }`}
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setMutationError(undefined);
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p
                        className="m-0 text-xs text-muted-foreground"
                        title={item.patientId}
                      >
                        Patient reference {item.patientId.slice(0, 8)}…
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
                    <Badge>{lifecycleLabels[item.lifecycle]}</Badge>

                    <Badge
                      variant={
                        item.gateStatus === 'BLOCK_AND_HANDOFF'
                          ? 'danger'
                          : item.gateStatus === 'ALLOW_WITH_HANDOFF'
                            ? 'restricted'
                            : 'success'
                      }
                    >
                      {formatEnum(item.gateStatus)}
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
                    Owner {formatEnum(item.ownerRole)} · Updated{' '}
                    {formatDate(item.updatedAt)}
                  </p>

                  <p className="mb-0 mt-1 text-xs text-muted-foreground">
                    {responseTargetText(item)} · Restriction v
                    {item.currentRestriction?.version ?? '—'}
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
                  Select an assigned case to review its operational detail.
                </p>
              </CardContent>
            </Card>
          ) : detail.isLoading ? (
            <LoadingState />
          ) : detail.isError || !selected ? (
            <ErrorState
              action={
                <Button onClick={() => void detail.refetch()}>Try again</Button>
              }
            />
          ) : (
            <SafetyCaseDetailEditor
              key={`${selected.id}:${selected.version}`}
              onAcknowledge={(reason) =>
                guarded(() => runLifecycle(selected, reason, 'acknowledge'))
              }
              onBeginReview={(reason) =>
                guarded(() => runLifecycle(selected, reason, 'begin-review'))
              }
              onDisposition={(reason, value, restrictions) =>
                guarded(() =>
                  runDisposition(selected, reason, value, restrictions),
                )
              }
              onEscalate={(reason) =>
                guarded(() => runEmergency(selected, reason))
              }
              onEstablishPlan={(reason) =>
                guarded(() => runLifecycle(selected, reason, 'establish-plan'))
              }
              onResolveExternal={(reason) =>
                guarded(() => runExternalResolution(selected, reason))
              }
              pending={pending}
              safetyCase={selected}
            />
          )}
        </section>
      </div>
    </ClinicianShell>
  );
}

function SafetyCaseDetailEditor({
  safetyCase,
  pending,
  onAcknowledge,
  onBeginReview,
  onEstablishPlan,
  onEscalate,
  onResolveExternal,
  onDisposition,
}: {
  safetyCase: SafetyCaseProjection;
  pending: boolean;
  onAcknowledge: (reason: string) => Promise<void>;
  onBeginReview: (reason: string) => Promise<void>;
  onEstablishPlan: (reason: string) => Promise<void>;
  onEscalate: (reason: string) => Promise<void>;
  onResolveExternal: (reason: string) => Promise<void>;
  onDisposition: (
    reason: string,
    disposition: SafetyDisposition,
    restrictions: SafetyRestrictionInput,
  ) => Promise<void>;
}) {
  const restriction = safetyCase.currentRestriction;

  const [reason, setReason] = useState('');
  const [disposition, setDisposition] = useState<SafetyDisposition>(
    'CONTINUE_CLINICAL_HANDOFF',
  );

  const [allowedInterventions, setAllowedInterventions] = useState<
    SubjectiveInterventionClass[]
  >(() => [...(restriction?.allowedSubjectiveInterventions ?? [])]);

  const [monitoringPromptPolicy, setMonitoringPromptPolicy] = useState<
    'CONTINUE' | 'PAUSE'
  >(() => restriction?.monitoringPromptPolicy ?? 'PAUSE');

  const [goalChangeAllowed, setGoalChangeAllowed] = useState(
    () => restriction?.goalChangeAllowed ?? false,
  );

  const [reassessmentDueAt, setReassessmentDueAt] = useState<string | null>(
    () => restriction?.reassessmentDueAt ?? null,
  );

  const restrictions: SafetyRestrictionInput = {
    allowedSubjectiveInterventions: allowedInterventions,
    monitoringPromptPolicy,
    goalChangeAllowed,
    reassessmentDueAt,
  };

  return (
    <ClinicianCaseDetail
      allowedInterventions={allowedInterventions}
      disposition={disposition}
      goalChangeAllowed={goalChangeAllowed}
      monitoringPromptPolicy={monitoringPromptPolicy}
      onAcknowledge={() => void onAcknowledge(reason)}
      onAllowedInterventionsChange={setAllowedInterventions}
      onBeginReview={() => void onBeginReview(reason)}
      onDisposition={() =>
        void onDisposition(reason, disposition, restrictions)
      }
      onDispositionChange={setDisposition}
      onEscalate={() => onEscalate(reason)}
      onEstablishPlan={() => void onEstablishPlan(reason)}
      onGoalChangeAllowedChange={setGoalChangeAllowed}
      onMonitoringPromptPolicyChange={setMonitoringPromptPolicy}
      onReassessmentDueAtChange={setReassessmentDueAt}
      onReasonChange={setReason}
      onResolveExternal={() => onResolveExternal(reason)}
      pending={pending}
      reason={reason}
      reassessmentDueAt={reassessmentDueAt}
      selected={safetyCase}
    />
  );
}

function ClinicianCaseDetail({
  selected,
  reason,
  onReasonChange,
  onAcknowledge,
  onBeginReview,
  onEstablishPlan,
  onEscalate,
  onResolveExternal,
  onDisposition,
  disposition,
  onDispositionChange,
  allowedInterventions,
  onAllowedInterventionsChange,
  monitoringPromptPolicy,
  onMonitoringPromptPolicyChange,
  goalChangeAllowed,
  onGoalChangeAllowedChange,
  reassessmentDueAt,
  onReassessmentDueAtChange,
  pending,
}: {
  selected: SafetyCaseProjection;
  reason: string;
  onReasonChange: (value: string) => void;
  onAcknowledge: () => void;
  onBeginReview: () => void;
  onEstablishPlan: () => void;
  onEscalate: () => void | Promise<void>;
  onResolveExternal: () => void | Promise<void>;
  onDisposition: () => void;
  disposition: SafetyDisposition;
  onDispositionChange: (value: SafetyDisposition) => void;
  allowedInterventions: SubjectiveInterventionClass[];
  onAllowedInterventionsChange: (value: SubjectiveInterventionClass[]) => void;
  monitoringPromptPolicy: 'CONTINUE' | 'PAUSE';
  onMonitoringPromptPolicyChange: (value: 'CONTINUE' | 'PAUSE') => void;
  goalChangeAllowed: boolean;
  onGoalChangeAllowedChange: (value: boolean) => void;
  reassessmentDueAt: string | null;
  onReassessmentDueAtChange: (value: string | null) => void;
  pending: boolean;
}) {
  const active = !selected.resolvedAt;
  const showRestrictions = disposition === 'SAFE_TO_CONTINUE_WITH_RESTRICTIONS';

  const allowedDispositions = dispositionOptions.filter((option) => {
    if (!active) return false;

    if (
      option === 'SAFE_TO_CONTINUE_STANDARD_MONITORING' ||
      option === 'SAFE_TO_CONTINUE_WITH_RESTRICTIONS'
    ) {
      return selected.lifecycle === 'PLAN_ESTABLISHED';
    }

    return (
      option !== 'CONTINUE_CLINICAL_HANDOFF' ||
      [
        'HANDOFF_INITIATED',
        'ACKNOWLEDGED',
        'CLINICAL_REVIEW_IN_PROGRESS',
        'PLAN_ESTABLISHED',
      ].includes(selected.lifecycle)
    );
  });

  const toggleIntervention = (value: SubjectiveInterventionClass) => {
    onAllowedInterventionsChange(
      allowedInterventions.includes(value)
        ? allowedInterventions.filter((item) => item !== value)
        : [...allowedInterventions, value],
    );
  };

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="m-0 font-mono text-xs text-muted-foreground">
                {selected.patientId}
              </p>

              <h2 className="mb-0 mt-1 text-2xl font-semibold">
                {formatEnum(selected.domain)}
              </h2>
            </div>

            <StateBadge
              label={severityLabels[selected.severity] ?? selected.severity}
              state={severityTone(selected.severity)}
            />
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail
              label="Lifecycle"
              value={lifecycleLabels[selected.lifecycle]}
            />
            <Detail label="Case version" value={String(selected.version)} />
            <Detail label="Owner" value={formatEnum(selected.ownerRole)} />
            <Detail label="Gate" value={formatEnum(selected.gateStatus)} />
            <Detail label="Route status" value={selected.routeStatus} />
            <Detail label="Detected" value={formatDate(selected.detectedAt)} />
            <Detail label="Updated" value={formatDate(selected.updatedAt)} />
            <Detail
              label="Reassessment due"
              value={
                selected.currentRestriction?.reassessmentDueAt
                  ? formatDate(selected.currentRestriction.reassessmentDueAt)
                  : 'Not set'
              }
            />
          </div>

          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reason codes
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {selected.reasonCodes.length ? (
                selected.reasonCodes.map((code) => (
                  <Badge key={code}>{formatEnum(code)}</Badge>
                ))
              ) : (
                <span className="text-muted-foreground">None returned</span>
              )}
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border bg-surface-subtle p-4 sm:grid-cols-2">
            <Detail
              label="Response target"
              value={responseTargetText(selected)}
            />

            <Detail
              label="Route profile"
              value={
                selected.routeProfileId
                  ? `${selected.routeProfileId} · v${
                      selected.routeProfileLogicalVersion ?? '—'
                    }`
                  : 'Not assigned'
              }
            />
          </div>

          {selected.currentRouteSnapshot ? (
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                Current route snapshot
              </summary>

              <pre className="mt-3 overflow-x-auto rounded-lg bg-foreground p-4 text-xs text-inverse-foreground">
                {JSON.stringify(selected.currentRouteSnapshot, null, 2)}
              </pre>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-semibold">Current restriction</h2>
        </CardHeader>

        <CardContent className="grid gap-3 text-sm">
          {selected.currentRestriction ? (
            <>
              <Detail
                label="Gate"
                value={formatEnum(selected.currentRestriction.gateStatus)}
              />

              <Detail
                label="Prompt policy"
                value={selected.currentRestriction.monitoringPromptPolicy}
              />

              <Detail
                label="Goal changes"
                value={
                  selected.currentRestriction.goalChangeAllowed
                    ? 'Allowed'
                    : 'Restricted'
                }
              />

              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Allowed interventions
                </p>

                <p className="mb-0 mt-1">
                  {selected.currentRestriction.allowedSubjectiveInterventions
                    .map(formatEnum)
                    .join(', ') || 'None listed'}
                </p>
              </div>
            </>
          ) : (
            <p className="m-0 text-muted-foreground">
              No restriction projection returned.
            </p>
          )}
        </CardContent>
      </Card>

      {active ? (
        <Card>
          <CardHeader>
            <h2 className="m-0 text-xl font-semibold">Lifecycle controls</h2>

            <p className="mb-0 mt-2 text-sm text-muted-foreground">
              Enter a concise reason, then choose only an action valid for the
              current lifecycle.
            </p>
          </CardHeader>

          <CardContent className="grid gap-4">
            <label className="grid gap-2 text-sm font-semibold">
              Action reason
              <textarea
                className="min-h-24 rounded-md border bg-surface px-3 py-2"
                maxLength={1000}
                onChange={(event) => onReasonChange(event.target.value)}
                value={reason}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {['DETECTED', 'HANDOFF_INITIATED'].includes(
                selected.lifecycle,
              ) ? (
                <Button disabled={pending} onClick={onAcknowledge}>
                  Acknowledge
                </Button>
              ) : null}

              {selected.lifecycle === 'ACKNOWLEDGED' ? (
                <Button disabled={pending} onClick={onBeginReview}>
                  Begin review
                </Button>
              ) : null}

              {selected.lifecycle === 'CLINICAL_REVIEW_IN_PROGRESS' ? (
                <Button disabled={pending} onClick={onEstablishPlan}>
                  Establish plan
                </Button>
              ) : null}

              {selected.lifecycle !== 'ESCALATED_TO_EMERGENCY' ? (
                <ConfirmActionDialog
                  confirmLabel="Escalate"
                  description="This moves the case into the emergency external-management path and applies the backend safety restriction."
                  disabled={pending}
                  intent="destructive"
                  onConfirm={onEscalate}
                  title="Escalate this case?"
                  triggerLabel="Escalate"
                />
              ) : null}

              {selected.lifecycle === 'ESCALATED_TO_EMERGENCY' ? (
                <ConfirmActionDialog
                  confirmLabel="Resolve handoff"
                  description="Confirm that the external emergency handoff has been resolved and record the current reason."
                  disabled={pending}
                  onConfirm={onResolveExternal}
                  title="Resolve the external handoff?"
                  triggerLabel="Resolve external handoff"
                />
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {active ? (
        <Card>
          <CardHeader>
            <h2 className="m-0 text-xl font-semibold">
              Structured disposition
            </h2>

            <p className="mb-0 mt-2 text-sm text-muted-foreground">
              The server remains authoritative for whether a disposition is
              valid for this case.
            </p>
          </CardHeader>

          <CardContent className="grid gap-4">
            <select
              className="h-11 rounded-md border bg-surface px-3 text-sm"
              onChange={(event) =>
                event.target.value &&
                onDispositionChange(event.target.value as SafetyDisposition)
              }
              value={
                allowedDispositions.includes(disposition) ? disposition : ''
              }
            >
              <option value="">Choose a valid disposition</option>

              {allowedDispositions.map((option) => (
                <option key={option} value={option}>
                  {formatEnum(option)}
                </option>
              ))}
            </select>

            {showRestrictions ? (
              <RestrictionForm
                allowedInterventions={allowedInterventions}
                goalChangeAllowed={goalChangeAllowed}
                monitoringPromptPolicy={monitoringPromptPolicy}
                onGoalChangeAllowedChange={onGoalChangeAllowedChange}
                onMonitoringPromptPolicyChange={onMonitoringPromptPolicyChange}
                onReassessmentDueAtChange={onReassessmentDueAtChange}
                onToggleIntervention={toggleIntervention}
                reassessmentDueAt={reassessmentDueAt}
              />
            ) : null}

            {disposition === 'SAFE_TO_CONTINUE_STANDARD_MONITORING' ? (
              <ConfirmActionDialog
                confirmLabel="Clear for monitoring"
                description="This resolves the case and clears the patient for standard monitoring according to the backend policy."
                disabled={pending || !allowedDispositions.includes(disposition)}
                onConfirm={onDisposition}
                title="Clear this case for standard monitoring?"
                triggerLabel="Clear for monitoring"
              />
            ) : (
              <Button
                disabled={pending || !allowedDispositions.includes(disposition)}
                onClick={onDisposition}
              >
                Record disposition
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-semibold">Lifecycle history</h2>
        </CardHeader>

        <CardContent className="grid gap-3">
          {selected.lifecycleEvents.length ? (
            selected.lifecycleEvents.map((event) => (
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
          {selected.dispositions.length ? (
            selected.dispositions.map((item) => (
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
              </div>
            ))
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              No dispositions returned.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RestrictionForm({
  allowedInterventions,
  onToggleIntervention,
  monitoringPromptPolicy,
  onMonitoringPromptPolicyChange,
  goalChangeAllowed,
  onGoalChangeAllowedChange,
  reassessmentDueAt,
  onReassessmentDueAtChange,
}: {
  allowedInterventions: SubjectiveInterventionClass[];
  onToggleIntervention: (value: SubjectiveInterventionClass) => void;
  monitoringPromptPolicy: 'CONTINUE' | 'PAUSE';
  onMonitoringPromptPolicyChange: (value: 'CONTINUE' | 'PAUSE') => void;
  goalChangeAllowed: boolean;
  onGoalChangeAllowedChange: (value: boolean) => void;
  reassessmentDueAt: string | null;
  onReassessmentDueAtChange: (value: string | null) => void;
}) {
  return (
    <fieldset className="grid gap-4 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">Restriction inputs</legend>

      <div className="grid gap-2 sm:grid-cols-2">
        {SUBJECTIVE_INTERVENTION_CLASSES.map((value) => (
          <label className="flex items-start gap-2 text-sm" key={value}>
            <input
              checked={allowedInterventions.includes(value)}
              className="mt-1 size-4 accent-primary"
              onChange={() => onToggleIntervention(value)}
              type="checkbox"
            />

            <span>{formatEnum(value)}</span>
          </label>
        ))}
      </div>

      <label className="grid gap-2 text-sm font-semibold">
        Monitoring prompt policy
        <select
          className="h-11 rounded-md border bg-surface px-3"
          onChange={(event) =>
            onMonitoringPromptPolicyChange(
              event.target.value as 'CONTINUE' | 'PAUSE',
            )
          }
          value={monitoringPromptPolicy}
        >
          <option value="CONTINUE">Continue</option>
          <option value="PAUSE">Pause</option>
        </select>
      </label>

      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          checked={goalChangeAllowed}
          className="size-4 accent-primary"
          onChange={(event) => onGoalChangeAllowedChange(event.target.checked)}
          type="checkbox"
        />
        Goal changes allowed
      </label>

      <label className="grid gap-2 text-sm font-semibold">
        Reassessment due (optional)
        <Input
          onChange={(event) =>
            onReassessmentDueAtChange(
              event.target.value
                ? new Date(event.target.value).toISOString()
                : null,
            )
          }
          type="datetime-local"
          value={localDateTime(reassessmentDueAt)}
        />
      </label>
    </fieldset>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="m-0 mt-1">{value}</p>
    </div>
  );
}

function responseTargetText(item: SafetyCaseProjection) {
  const target = item.responseTarget;

  if (target.maximumSystemResponseSeconds) {
    return `${target.maximumSystemResponseSeconds}s maximum system response`;
  }

  if (target.acknowledgementMinutes) {
    return `Acknowledge within ${target.acknowledgementMinutes} minutes`;
  }

  if (target.acknowledgementHours) {
    return `Acknowledge within ${target.acknowledgementHours} hours`;
  }

  if (target.reviewBusinessDays) {
    return `Review within ${target.reviewBusinessDays} business days`;
  }

  return 'No additional response target';
}
