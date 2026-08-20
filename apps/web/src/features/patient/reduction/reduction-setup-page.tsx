import {
  ConfirmReductionBaselineRequestSchema,
  ProposeReductionTargetRequestSchema,
  ReductionSetupResponseSchema,
  SaveReductionBaselineDraftRequestSchema,
  StartReductionBaselineCorrectionRequestSchema,
  StartReductionBaselineRequestSchema,
  type ReductionBaselineDayInput,
  type ReductionSetupResponse,
} from '@aud-subjective/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { z } from 'zod';

import { PatientShell } from '@/app/shells/patient-shell';
import { ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  PatientSafetyBoundary,
  usePatientSafetyProjection,
} from '@/features/patient/safety/patient-safety-boundary';
import { PatientSafetyStatus } from '@/features/patient/safety/patient-safety-status';
import { ApiClientError, apiGet, apiMutate } from '@/lib/api/client';
import { ReductionBaselineGrid } from './reduction-baseline-grid';
import { ReductionTargetCard } from './reduction-target-card';

type ReductionSetup = z.infer<typeof ReductionSetupResponseSchema>;

function inputsFromDraft(
  draft: NonNullable<ReductionSetup['draftBaseline']>,
): ReductionBaselineDayInput[] {
  return draft.days.map((day) => ({
    localDate: day.localDate,
    status: day.status,
    standardDrinks:
      day.status === 'UNKNOWN'
        ? undefined
        : day.standardDrinks === null
          ? 0
          : day.standardDrinks,
  }));
}

function errorCode(error: unknown) {
  return error instanceof ApiClientError ? error.response?.error.code : null;
}

function errorMessage(error: unknown, fallback: string) {
  switch (errorCode(error)) {
    case 'VERSION_CONFLICT':
      return 'This setup changed in another session. The latest saved version has been reloaded.';
    case 'REDUCTION_BASELINE_INCOMPLETE':
      return 'Mark all 28 days as known before confirming the baseline.';
    case 'SAFETY_NOT_ASSESSED':
      return 'Complete the safety assessment before starting reduction setup.';
    case 'SAFETY_HANDOFF_REQUIRED':
      return 'Reduction setup is unavailable while a safety handoff is required.';
    case 'GOAL_CHANGE_RESTRICTED':
      return 'Target changes are unavailable during the current safety review.';
    case 'REDUCTION_TARGET_NOT_BELOW_BASELINE':
      return 'A positive target must be below the baseline weekly average.';
    case 'REDUCTION_TARGET_BASELINE_ZERO':
      return 'A positive target requires a positive baseline weekly average.';
    default:
      return fallback;
  }
}

export function PatientReductionSetupPage() {
  return (
    <PatientSafetyBoundary>
      <PatientReductionSetupContent />
    </PatientSafetyBoundary>
  );
}

function PatientReductionSetupContent() {
  const queryClient = useQueryClient();
  const safety = usePatientSafetyProjection();
  const query = useQuery({
    queryKey: ['patient', 'reduction-setup'],
    queryFn: ({ signal }) =>
      apiGet<ReductionSetup>('/api/v1/patient/reduction-setup', {
        schema: ReductionSetupResponseSchema,
        signal,
      }),
  });
  const [localDays, setLocalDays] = useState<{
    version: number;
    days: ReductionBaselineDayInput[];
  } | null>(null);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const data = query.data;
  const days = useMemo(() => {
    if (!data?.draftBaseline) return [];
    if (localDays?.version === data.version) return localDays.days;
    return inputsFromDraft(data.draftBaseline);
  }, [data, localDays]);

  if (query.isError) {
    return (
      <PatientShell>
        <ErrorState action={<Button onClick={() => void query.refetch()}>Try again</Button>} />
      </PatientShell>
    );
  }
  if (query.isLoading || !data) {
    return (
      <PatientShell>
        <LoadingState />
      </PatientShell>
    );
  }

  const applyResponse = (response: ReductionSetupResponse) => {
    queryClient.setQueryData(['patient', 'reduction-setup'], response);
    setLocalDays(null);
  };

  const runMutation = async (
    action: () => Promise<ReductionSetupResponse>,
    successNotice?: string,
  ) => {
    setPending(true);
    setFormError(undefined);
    setNotice(undefined);
    try {
      const response = await action();
      applyResponse(response);
      if (successNotice) setNotice(successNotice);
    } catch (error) {
      setFormError(errorMessage(error, 'The reduction setup could not be saved.'));
      if (errorCode(error) === 'VERSION_CONFLICT') {
        setLocalDays(null);
        await query.refetch();
      }
    } finally {
      setPending(false);
    }
  };

  const startBaseline = () => {
    if (!data) return;
    const body = StartReductionBaselineRequestSchema.parse({
      expectedVersion: data.version,
    });
    return runMutation(
      () =>
        apiMutate(
          '/api/v1/patient/reduction-setup/baseline-draft',
          'POST',
          body,
          {
            schema: ReductionSetupResponseSchema,
            headers: { 'Idempotency-Key': crypto.randomUUID() },
          },
        ),
      'Your 28-day baseline draft is ready.',
    );
  };

  const saveBaseline = () => {
    if (!data?.draftBaseline) return;
    const parsed = SaveReductionBaselineDraftRequestSchema.safeParse({
      expectedVersion: data.version,
      days,
    });
    if (!parsed.success) {
      setFormError(
        'Complete each day with Unknown, Known zero, or a positive one-decimal quantity.',
      );
      return;
    }
    return runMutation(() =>
      apiMutate(
        '/api/v1/patient/reduction-setup/baseline-draft',
        'PUT',
        parsed.data,
        {
          schema: ReductionSetupResponseSchema,
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        },
      ),
    'Baseline progress saved.',
    );
  };

  const confirmBaseline = () => {
    if (!data?.draftBaseline) return;
    const body = ConfirmReductionBaselineRequestSchema.parse({
      expectedVersion: data.version,
    });
    return runMutation(
      () =>
        apiMutate(
          '/api/v1/patient/reduction-setup/baseline-confirm',
          'POST',
          body,
          {
            schema: ReductionSetupResponseSchema,
            headers: { 'Idempotency-Key': crypto.randomUUID() },
          },
        ),
      'Baseline confirmed.',
    );
  };

  const startCorrection = () => {
    if (!data?.authoritativeBaseline) return;
    const body = StartReductionBaselineCorrectionRequestSchema.parse({
      expectedVersion: data.version,
      reason,
    });
    return runMutation(
      () =>
        apiMutate(
          '/api/v1/patient/reduction-setup/baseline-correction',
          'POST',
          body,
          {
            schema: ReductionSetupResponseSchema,
            headers: { 'Idempotency-Key': crypto.randomUUID() },
          },
        ),
      'A correction draft is ready. Review and confirm it below.',
    );
  };

  const saveTarget = () => {
    if (!data?.authoritativeBaseline) return;
    const parsed = ProposeReductionTargetRequestSchema.safeParse({
      expectedVersion: data.version,
      targetWeeklyStandardDrinks: Number(target),
    });
    if (!parsed.success) {
      setFormError(
        'Enter a non-negative target using at most one decimal place.',
      );
      return;
    }
    return runMutation(
      () =>
        apiMutate(
          '/api/v1/patient/reduction-setup/target-proposal',
          'POST',
          parsed.data,
          {
            schema: ReductionSetupResponseSchema,
            headers: { 'Idempotency-Key': crypto.randomUUID() },
          },
        ),
      parsed.data.targetWeeklyStandardDrinks === 0
        ? 'Abstinence proposal saved.'
        : 'Target proposal saved.',
    );
  };

  const knownDays = days.filter((day) => day.status !== 'UNKNOWN').length;
  const hasUnknownDays = knownDays !== 28;
  const canConfirm =
    days.length === 28 &&
    days.every(
      (day) =>
        day.status === 'KNOWN_ZERO' ||
        (day.status === 'KNOWN_QUANTITY' &&
          day.standardDrinks !== undefined &&
          day.standardDrinks !== null &&
          day.standardDrinks > 0),
    );
  const safetyNotAssessed = safety.safetyState === 'NOT_ASSESSED';
  const baseline = data.authoritativeBaseline;

  return (
    <PatientShell>
      <div className="grid gap-6">
        <header className="grid gap-3">
          <div>
            <p className="m-0 text-sm font-semibold text-success">
              Reduction setup
            </p>
            <h1 className="mb-0 mt-2 text-3xl font-semibold sm:text-4xl">
              Build your 28-day baseline
            </h1>
            <p className="mb-0 mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              Record what you know directly in standard drinks. Unknown days
              remain unknown until you choose a status.
            </p>
          </div>
        </header>

        <PatientSafetyStatus projection={safety} />

        {formError ? (
          <Card className="border-danger-border bg-danger-surface/40" role="alert">
            <CardContent>
              <p className="m-0 text-sm font-semibold text-danger">{formError}</p>
            </CardContent>
          </Card>
        ) : null}
        {notice ? (
          <p className="m-0 rounded-lg border border-success-border bg-success-surface p-4 text-sm text-success" role="status">
            {notice}
          </p>
        ) : null}

        {!data.required ? (
          <Card>
            <CardContent>
              <p className="m-0 text-sm text-muted-foreground">
                Reduction setup is not required for the current authoritative
                recovery direction.
              </p>
            </CardContent>
          </Card>
        ) : data.state === 'NOT_STARTED' ? (
          <Card>
            <CardHeader>
              <h2 className="m-0 text-lg font-semibold">Start your baseline</h2>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="m-0 text-sm leading-6 text-muted-foreground">
                We will freeze the previous 28 completed local calendar days
                using your monitoring timezone. This draft stays resumable.
              </p>
              {safetyNotAssessed ? (
                <p className="m-0 rounded-lg border border-warning-border bg-warning-surface p-3 text-sm text-warning">
                  Complete the safety assessment before starting the reduction
                  baseline.
                </p>
              ) : null}
              <Button
                className="sm:w-fit"
                disabled={pending || safetyNotAssessed}
                onClick={() => void startBaseline()}
              >
                Start baseline
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {data.draftBaseline ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="m-0 text-lg font-semibold">
                    {baseline ? 'Corrected baseline draft' : 'Baseline draft'}
                  </h2>
                  <p className="mb-0 mt-1 text-sm text-muted-foreground">
                    {data.draftBaseline.baselineStart} –{' '}
                    {data.draftBaseline.baselineEnd} ·{' '}
                    {data.draftBaseline.monitoringTimezone}
                  </p>
                </div>
                <Badge variant={hasUnknownDays ? 'warning' : 'success'}>
                  {knownDays} / 28 known
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5">
              <p className="m-0 rounded-lg border bg-surface-subtle p-4 text-sm leading-6 text-muted-foreground">
                1 standard drink = {data.unitPolicy.standardDrinkGramsEthanol}{' '}
                g ethanol. The server derives ethanol grams from your
                standard-drink entries.
              </p>
              <ReductionBaselineGrid
                days={days}
                disabled={pending}
                onChange={(index, day) => {
                  setLocalDays({
                    version: data.version,
                    days: days.map((current, currentIndex) =>
                      currentIndex === index
                        ? day
                        : current,
                    ),
                  });
                  setFormError(undefined);
                }}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={pending || safetyNotAssessed}
                  onClick={() => void saveBaseline()}
                  variant="secondary"
                >
                  Save progress
                </Button>
                <Button
                  disabled={pending || !canConfirm || safetyNotAssessed}
                  onClick={() => void confirmBaseline()}
                >
                  {baseline ? 'Confirm correction' : 'Confirm baseline'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {baseline ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-lg font-semibold">Confirmed baseline</h2>
                    <p className="mb-0 mt-1 text-sm text-muted-foreground">
                      Revision {baseline.revision} · {baseline.baselineStart} –{' '}
                      {baseline.baselineEnd}
                    </p>
                  </div>
                  <Badge variant="success">CONFIRMED</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Metric label="28-day total" value={`${baseline.metrics.baselineTotalStandardDrinks28d} drinks`} />
                <Metric label="28-day ethanol" value={`${baseline.metrics.baselineTotalEthanolGrams28d} g`} />
                <Metric label="Drinking days" value={String(baseline.metrics.baselineDrinkingDays28d)} />
                <Metric label="Heavy drinking days" value={String(baseline.metrics.baselineHeavyDrinkingDays28d)} />
                <Metric label="Maximum day" value={`${baseline.metrics.baselineMaxStandardDrinksDay} drinks`} />
                <Metric label="Average per drinking day" value={`${baseline.metrics.baselineAverageDrinksPerDrinkingDay} drinks`} />
                <Metric label="Average weekly drinks" value={`${baseline.metrics.baselineAverageWeeklyDrinks} drinks`} />
              </CardContent>
            </Card>

            {!data.draftBaseline ? (
              <Card>
                <CardHeader>
                  <h2 className="m-0 text-lg font-semibold">Correct baseline</h2>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const parsed = StartReductionBaselineCorrectionRequestSchema.safeParse({
                        expectedVersion: data.version,
                        reason,
                      });
                      if (!parsed.success) {
                        setFormError('Provide a short reason for the correction.');
                        return;
                      }
                      void startCorrection();
                    }}
                  >
                    <Label htmlFor="correctionReason">Reason</Label>
                    <textarea
                      className="min-h-24 rounded-md border bg-surface px-3 py-2 text-sm"
                      id="correctionReason"
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="What needs correcting?"
                      required
                      value={reason}
                    />
                    <Button
                      className="sm:w-fit"
                      disabled={pending || safetyNotAssessed}
                      type="submit"
                      variant="outline"
                    >
                      Correct baseline
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}

            <ReductionTargetCard
              baseline={baseline}
              disabled={!safety.goalChangeAllowed || safetyNotAssessed}
              onChange={setTarget}
              onSubmit={() => void saveTarget()}
              pending={pending}
              proposal={data.proposal}
              value={target}
            />
          </>
        ) : null}
      </div>
    </PatientShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-surface-subtle p-3">
      <p className="m-0 text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="m-0 mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
