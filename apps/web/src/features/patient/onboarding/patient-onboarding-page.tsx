import {
  OnboardingStateResponseSchema,
  SaveOnboardingDraftRequestSchema,
  SaveOnboardingDraftResponseSchema,
  SafetyEvaluationResponseSchema,
  SafetyInputSchema,
  SubmitOnboardingRequestSchema,
  SubmitOnboardingResponseSchema,
  type OnboardingDraft,
  type OnboardingStep,
  type SafetyDraftInput,
} from '@aud-subjective/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';

import { ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiClientError, apiGet, apiMutate } from '@/lib/api/client';
import {
  PatientSafetyBoundary,
  usePatientSafetyProjection,
} from '@/features/patient/safety/patient-safety-boundary';
import { PatientSafetyStatus } from '@/features/patient/safety/patient-safety-status';
import { AccountStep } from './steps/account-step';
import { AuditCStep } from './steps/audit-c-step';
import { DrinkingContextStep } from './steps/drinking-context-step';
import { PreferencesStep } from './steps/preferences-step';
import { RecoveryDirectionStep } from './steps/recovery-direction-step';
import { ResultStep } from './steps/result-step';
import { SafetyStep } from './steps/safety-step';
import { OnboardingNavigation } from './onboarding-navigation';
import { OnboardingProgress } from './onboarding-progress';
import { createInitialDraft } from './types';

type OnboardingState = z.infer<typeof OnboardingStateResponseSchema>;

type LocalOnboardingState = {
  draft: OnboardingDraft;
  step: OnboardingStep;
  version: number;
};

const nextStep: Partial<Record<OnboardingStep, OnboardingStep>> = {
  ACCOUNT: 'AUDIT_C',
  AUDIT_C: 'DRINKING_CONTEXT',
  DRINKING_CONTEXT: 'RECOVERY_DIRECTION',
  RECOVERY_DIRECTION: 'PREFERENCES',
  PREFERENCES: 'SAFETY',
};

export function PatientOnboardingPage() {
  return (
    <PatientSafetyBoundary>
      <PatientOnboardingContent />
    </PatientSafetyBoundary>
  );
}

function PatientOnboardingContent() {
  const queryClient = useQueryClient();
  const safetyProjection = usePatientSafetyProjection();

  const query = useQuery({
    queryKey: ['patient', 'onboarding'],
    queryFn: ({ signal }) =>
      apiGet<OnboardingState>('/api/v1/patient/onboarding', {
        schema: OnboardingStateResponseSchema,
        signal,
      }),
  });

  const [local, setLocal] = useState<LocalOnboardingState>();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const data = query.data;
  const initialDraft = createInitialDraft();

  const serverState: LocalOnboardingState | null = data
    ? {
        version: data.version,
        step: data.currentStep,
        draft: data.draft ?? initialDraft,
      }
    : null;

  const current =
    local && serverState && local.version === serverState.version
      ? local
      : serverState;

  if (query.isError) {
    return (
      <ErrorState
        action={<Button onClick={() => void query.refetch()}>Try again</Button>}
      />
    );
  }

  if (query.isLoading || !data || !current) {
    return <LoadingState />;
  }

  const safety = current.draft.safetyDraft?.responses ?? {};

  const updateDraft = <K extends keyof OnboardingDraft>(
    key: K,
    value: OnboardingDraft[K],
  ) => {
    setLocal((previous) => {
      const base =
        previous && previous.version === current.version ? previous : current;

      return {
        ...base,
        draft: {
          ...base.draft,
          [key]: value,
        },
      };
    });

    setFormError(undefined);
  };

  const updateSafety = (changes: Partial<SafetyDraftInput>) => {
    setLocal((previous) => {
      const base =
        previous && previous.version === current.version ? previous : current;

      const existing = base.draft.safetyDraft?.responses ?? {};

      const nextResponses: SafetyDraftInput = {
        ...existing,
        ...changes,
        ...(changes.cssrs
          ? {
              cssrs: {
                ...existing.cssrs,
                ...changes.cssrs,
              },
            }
          : {}),
      };

      return {
        ...base,
        draft: {
          ...base.draft,
          safetyDraft: {
            schemaVersion: 'safety_draft_v1',
            responses: nextResponses,
          },
        },
      };
    });

    setFormError(undefined);
  };

  const updateCssrs = (
    key: keyof NonNullable<SafetyDraftInput['cssrs']>,
    value: 'YES' | 'NO' | 'UNSURE',
  ) =>
    updateSafety({
      cssrs: {
        ...(safety.cssrs ?? {}),
        [key]: value,
      },
    });

  const reloadAuthoritative = async () => {
    const refreshed = await query.refetch();

    if (refreshed.data) {
      setLocal(undefined);
    }
  };

  const errorCode = (error: unknown) =>
    error instanceof ApiClientError ? error.response?.error.code : undefined;

  const errorMessage = (error: unknown, fallback: string) => {
    if (errorCode(error) === 'VERSION_CONFLICT') {
      return 'This setup changed in another session. The latest saved version has been reloaded.';
    }

    if (errorCode(error) === 'ONBOARDING_INCOMPLETE') {
      return 'Complete the required onboarding responses before submitting.';
    }

    if (errorCode(error) === 'PERMISSION_DENIED') {
      return 'This setup is not available for the current account.';
    }

    return fallback;
  };

  const saveDraft = async (
    targetStep: OnboardingStep = current.step,
    draftToSave: OnboardingDraft = current.draft,
  ) => {
    setSaving(true);
    setFormError(undefined);
    setNotice(undefined);

    try {
      const body = SaveOnboardingDraftRequestSchema.parse({
        expectedVersion: current.version,
        currentStep: targetStep,
        draftResponses: draftToSave,
      });

      const result = await apiMutate(
        '/api/v1/patient/onboarding/draft',
        'PUT',
        body,
        {
          schema: SaveOnboardingDraftResponseSchema,
        },
      );

      setLocal({
        version: result.version,
        step: result.currentStep,
        draft: result.draft,
      });

      setNotice('Progress saved.');

      return result;
    } catch (error) {
      setFormError(errorMessage(error, 'Progress could not be saved.'));

      if (errorCode(error) === 'VERSION_CONFLICT') {
        await reloadAuthoritative();
      }

      return null;
    } finally {
      setSaving(false);
    }
  };

  const submitSafety = async () => {
    const parsed = SafetyInputSchema.safeParse({
      ...safety,
      reductionStartedAt: safety.reductionStartedAt ?? null,
      reductionPercent: safety.reductionPercent ?? null,
      currentWithdrawalSymptoms: safety.currentWithdrawalSymptoms ?? [],
      seriousMedicalContexts: safety.seriousMedicalContexts ?? [],
    });

    if (!parsed.success) {
      const missing = parsed.error.issues
        .slice(0, 4)
        .map((issue) => issue.path.join('.'))
        .filter(Boolean)
        .join(', ');

      setFormError(
        missing
          ? `Complete the safety responses before submitting: ${missing}.`
          : 'Complete the safety responses before submitting.',
      );

      return;
    }

    const saved = await saveDraft('RESULT', current.draft);

    if (!saved) return;

    setSaving(true);
    setFormError(undefined);
    setNotice(undefined);

    try {
      const submitBody = SubmitOnboardingRequestSchema.parse({
        expectedVersion: saved.version,
      });

      await apiMutate('/api/v1/patient/onboarding/submit', 'POST', submitBody, {
        schema: SubmitOnboardingResponseSchema,
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
        },
      });

      const evaluation = await apiMutate(
        '/api/v1/patient/onboarding/safety-evaluations',
        'POST',
        parsed.data,
        {
          schema: SafetyEvaluationResponseSchema,
          headers: {
            'Idempotency-Key': crypto.randomUUID(),
          },
        },
      );

      queryClient.setQueryData(['patient', 'safety'], evaluation.safety);

      await query.refetch();

      setNotice('Your onboarding and safety assessment are saved.');
    } catch (error) {
      setFormError(errorMessage(error, 'The setup could not be submitted.'));

      if (errorCode(error) === 'VERSION_CONFLICT') {
        await reloadAuthoritative();
      }
    } finally {
      setSaving(false);
    }
  };

  const continueStep = async () => {
    if (current.step === 'SAFETY') {
      await submitSafety();
      return;
    }

    const target = nextStep[current.step];

    if (target) {
      await saveDraft(target);
    }
  };

  const stepProps = {
    draft: current.draft,
    safety,
    updateDraft,
    updateSafety,
    updateCssrs,
    recoveryDirectionLocked: !safetyProjection.goalChangeAllowed,
  };

  return (
    <div className="grid gap-6">
      <header className="grid gap-5">
        <div>
          <p className="m-0 text-sm font-semibold text-success">Guided setup</p>

          <h1 className="mb-0 mt-2 text-3xl font-semibold sm:text-4xl">
            Set up your support plan
          </h1>

          <p className="mb-0 mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Answer at your own pace. The server keeps the current step and draft
            version authoritative when you return.
          </p>
        </div>

        <OnboardingProgress currentStep={current.step} />
      </header>

      <PatientSafetyStatus projection={safetyProjection} />

      {formError ? (
        <Card
          className="border-danger-border bg-danger-surface/40"
          role="alert"
        >
          <CardContent>
            <p className="m-0 text-sm font-semibold text-danger">{formError}</p>
          </CardContent>
        </Card>
      ) : null}

      {notice ? (
        <p
          className="m-0 rounded-lg border border-success-border bg-success-surface p-4 text-sm text-success"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {current.step === 'ACCOUNT' ? <AccountStep /> : null}

      {current.step === 'AUDIT_C' ? <AuditCStep {...stepProps} /> : null}

      {current.step === 'DRINKING_CONTEXT' ? (
        <DrinkingContextStep {...stepProps} />
      ) : null}

      {current.step === 'RECOVERY_DIRECTION' ? (
        <RecoveryDirectionStep {...stepProps} />
      ) : null}

      {current.step === 'PREFERENCES' ? (
        <PreferencesStep {...stepProps} />
      ) : null}

      {current.step === 'SAFETY' ? <SafetyStep {...stepProps} /> : null}

      {current.step === 'RESULT' ? (
        <ResultStep
          data={{
            ...data,
            draft: current.draft,
            currentStep: current.step,
          }}
        />
      ) : null}

      {current.step === 'RESULT' ? (
        <Button
          disabled={saving}
          onClick={() => void saveDraft('RESULT')}
          variant="secondary"
        >
          Save current progress
        </Button>
      ) : (
        <OnboardingNavigation
          {...(current.step === 'SAFETY'
            ? { continueLabel: 'Submit setup and safety assessment' }
            : {})}
          onContinue={() => void continueStep()}
          onSave={() => void saveDraft()}
          saving={saving}
        />
      )}
    </div>
  );
}
