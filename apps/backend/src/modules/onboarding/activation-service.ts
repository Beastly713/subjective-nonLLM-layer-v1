import {
  CompleteOnboardingResponseSchema,
  OnboardingDraftSchema,
  RecoveryGoalProjectionSchema,
  SafetyInputSchema,
  type OnboardingDraft,
  type PatientSafetyProjection,
} from '@aud-subjective/contracts';

import type { Prisma } from '../../generated/prisma/client.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { canonicalProlongedHeavyRegularUse } from '../consumption/reduction-domain.js';
import { evaluatePatientSafety } from '../safety/service.js';
import { loadPatientSafetyProjection } from '../safety/projections.js';
import {
  createInitialScheduleInTransaction,
  ensureGoalActivationPeriodInTransaction,
} from '../scheduling/service.js';

type Tx = Prisma.TransactionClient;

const CURRENT_GOAL_STATUSES = [
  'PENDING_CLINICAL_SAFETY_REVIEW',
  'ACTIVE',
  'SUSPENDED_SAFETY_HANDOFF',
] as const;

type CompletionInput = {
  tx: Tx;
  config: AppConfig;
  clock: Clock;
  patientId: string;
  actorId: string;
  requestId: string;
  authoritativeOnboardingRevisionId: string;
  expectedReductionSetupVersion?: number | null;
};

type DesiredPlan = {
  goal: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE';
  baselineRevisionId: string | null;
  baselineStart: Date | null;
  baselineEnd: Date | null;
  baselineAverageWeeklyDrinks: number | null;
  targetWeeklyStandardDrinks: number | null;
  sourceOnboardingRevisionId: string;
  thresholdProfile: 'LOWER_THRESHOLD' | 'HIGHER_THRESHOLD' | null;
};

function decimalToNumber(value: unknown, code = 'RECOVERY_GOAL_INVALID') {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new DomainError(
      500,
      code,
      'A persisted recovery value is not a valid number.',
    );
  }
  return number;
}

function recoveryDirection(draft: OnboardingDraft) {
  return draft.recoveryDirection.state === 'ANSWERED'
    ? draft.recoveryDirection.value
    : 'UNSURE';
}

function preferenceValue(
  value: OnboardingDraft['mutualHelpPreference'],
) {
  if (value.state === 'ANSWERED') return value.value;
  if (value.state === 'UNSURE') return 'UNSURE' as const;
  if (value.state === 'PREFER_NOT_TO_SAY') return 'PREFER_NOT_TO_SAY' as const;
  return null;
}

function spiritualPreferenceValue(
  value: OnboardingDraft['spiritualContentPreference'],
) {
  if (value.state === 'ANSWERED') return value.value;
  if (value.state === 'UNSURE') return 'UNSURE' as const;
  if (value.state === 'PREFER_NOT_TO_SAY') return null;
  return null;
}

function projectRecoveryGoal(goal: {
  id: string;
  goalVersion: number;
  goal: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE';
  status:
    | 'PENDING_CLINICAL_SAFETY_REVIEW'
    | 'ACTIVE'
    | 'SUSPENDED_SAFETY_HANDOFF'
    | 'SUPERSEDED'
    | 'ENDED';
  baselineRevisionId: string | null;
  targetWeeklyStandardDrinks: unknown;
  effectiveFromPeriodId: string | null;
  setBy: 'PATIENT' | 'CLINICIAN' | 'SHARED';
  createdAt: Date;
}) {
  return RecoveryGoalProjectionSchema.parse({
    id: goal.id,
    goalVersion: goal.goalVersion,
    goal: goal.goal,
    status: goal.status,
    baselineRevisionId: goal.baselineRevisionId,
    targetWeeklyStandardDrinks: decimalToNumber(
      goal.targetWeeklyStandardDrinks,
    ),
    effectiveFromPeriodId: goal.effectiveFromPeriodId,
    setBy: goal.setBy,
    createdAt: goal.createdAt.toISOString(),
  });
}

function samePlan(
  current: {
    sourceOnboardingRevisionId: string;
    goal: string;
    baselineRevisionId: string | null;
    targetWeeklyStandardDrinks: unknown;
  },
  desired: DesiredPlan,
) {
  return (
    current.sourceOnboardingRevisionId ===
      desired.sourceOnboardingRevisionId &&
    current.goal === desired.goal &&
    current.baselineRevisionId === desired.baselineRevisionId &&
    decimalToNumber(current.targetWeeklyStandardDrinks) ===
      desired.targetWeeklyStandardDrinks
  );
}

async function resolveDesiredPlan(
  tx: Tx,
  patientId: string,
  authoritativeRevisionId: string,
  draft: OnboardingDraft,
  expectedReductionSetupVersion?: number | null,
): Promise<DesiredPlan> {
  const direction = recoveryDirection(draft);
  if (direction === 'ABSTINENCE' || direction === 'UNSURE') {
    return {
      goal: direction,
      baselineRevisionId: null,
      baselineStart: null,
      baselineEnd: null,
      baselineAverageWeeklyDrinks: null,
      targetWeeklyStandardDrinks: null,
      sourceOnboardingRevisionId: authoritativeRevisionId,
      thresholdProfile: null,
    };
  }

  const reductionState = await tx.reductionSetupState.findUnique({
    where: { patientId },
    include: { authoritativeBaselineRevision: true },
  });

  if (
    !reductionState ||
    expectedReductionSetupVersion === null ||
    expectedReductionSetupVersion === undefined ||
    reductionState.version !== expectedReductionSetupVersion
  ) {
    throw new DomainError(
      409,
      'REDUCTION_SETUP_INCOMPLETE',
      'Complete the reduction baseline and proposal before finishing setup.',
    );
  }

  const baseline = reductionState.authoritativeBaselineRevision;
  if (
    !baseline ||
    baseline.lifecycle !== 'CONFIRMED' ||
    reductionState.proposalBaselineRevisionId !== baseline.id ||
    baseline.confirmedAt === null
  ) {
    throw new DomainError(
      409,
      'REDUCTION_SETUP_INCOMPLETE',
      'Complete the reduction baseline and proposal before finishing setup.',
    );
  }

  const baselineAverageWeeklyDrinks = decimalToNumber(
    baseline.baselineAverageWeeklyDrinks,
    'REDUCTION_BASELINE_INVALID',
  );
  const targetWeeklyStandardDrinks = decimalToNumber(
    reductionState.targetWeeklyStandardDrinks,
    'REDUCTION_TARGET_INVALID',
  );

  if (
    !reductionState.proposalKind ||
    targetWeeklyStandardDrinks === null ||
    baselineAverageWeeklyDrinks === null ||
    reductionState.proposalBaselineRevisionId !== baseline.id
  ) {
    throw new DomainError(
      409,
      'REDUCTION_SETUP_INCOMPLETE',
      'Complete the reduction baseline and proposal before finishing setup.',
    );
  }

  if (reductionState.proposalKind === 'REDUCTION') {
    if (
      targetWeeklyStandardDrinks <= 0 ||
      targetWeeklyStandardDrinks >= baselineAverageWeeklyDrinks
    ) {
      throw new DomainError(
        409,
        'REDUCTION_TARGET_INVALID',
        'The reduction target must be positive and below the baseline average.',
      );
    }
    return {
      goal: 'REDUCTION',
      baselineRevisionId: baseline.id,
      baselineStart: baseline.baselineStart,
      baselineEnd: baseline.baselineEnd,
      baselineAverageWeeklyDrinks,
      targetWeeklyStandardDrinks,
      sourceOnboardingRevisionId: authoritativeRevisionId,
      thresholdProfile: baseline.thresholdProfile,
    };
  }

  if (targetWeeklyStandardDrinks !== 0) {
    throw new DomainError(
      409,
      'REDUCTION_TARGET_INVALID',
      'An abstinence proposal must have a zero target.',
    );
  }

  return {
    goal: 'ABSTINENCE',
    baselineRevisionId: baseline.id,
    baselineStart: baseline.baselineStart,
    baselineEnd: baseline.baselineEnd,
    baselineAverageWeeklyDrinks,
    targetWeeklyStandardDrinks: null,
    sourceOnboardingRevisionId: authoritativeRevisionId,
    thresholdProfile: baseline.thresholdProfile,
  };
}

async function applyProfilePreferences(
  tx: Tx,
  input: CompletionInput,
  draft: OnboardingDraft,
) {
  const current = await tx.profilePreferenceVersion.findFirst({
    where: { patientId: input.patientId },
    orderBy: { version: 'desc' },
  });
  const mutualHelpPreference = preferenceValue(draft.mutualHelpPreference);
  const spiritualContentPreference = spiritualPreferenceValue(
    draft.spiritualContentPreference,
  );

  if (
    current &&
    current.mutualHelpPreference === mutualHelpPreference &&
    current.spiritualContentPreference === spiritualContentPreference
  ) {
    return;
  }

  const preference = await tx.profilePreferenceVersion.create({
    data: {
      patientId: input.patientId,
      version: (current?.version ?? 0) + 1,
      mutualHelpPreference,
      spiritualContentPreference,
      createdByUserId: input.actorId,
      createdAt: input.clock.now(),
    },
  });

  await tx.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: 'PATIENT_PREFERENCES_APPLIED_FROM_ONBOARDING',
      entityType: 'PROFILE_PREFERENCE_VERSION',
      entityId: preference.id,
      patientId: input.patientId,
      requestId: input.requestId,
    },
  });
}

async function loadCurrentGoal(tx: Tx, patientId: string) {
  return tx.recoveryGoalVersion.findFirst({
    where: {
      patientId,
      status: { in: [...CURRENT_GOAL_STATUSES] },
    },
    orderBy: { goalVersion: 'desc' },
  });
}

async function scheduleState(tx: Tx, patientId: string) {
  const active = await tx.monitoringScheduleVersion.findFirst({
    where: { patientId, lifecycle: 'ACTIVE' },
    select: { id: true },
  });
  return active ? ('ACTIVATED' as const) : ('NOT_ACTIVATED' as const);
}

async function auditGoalStatusChange(
  tx: Tx,
  input: CompletionInput,
  goal: {
    id: string;
    goalVersion: number;
    goal: string;
    status: string;
    baselineRevisionId: string | null;
    effectiveFromPeriodId: string | null;
    sourceSafetyEvaluationResultId: string;
  },
  previousStatus: string | null,
) {
  if (previousStatus === goal.status) return;
  await tx.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: 'RECOVERY_GOAL_STATUS_CHANGED',
      entityType: 'RECOVERY_GOAL_VERSION',
      entityId: goal.id,
      patientId: input.patientId,
      requestId: input.requestId,
      metadata: {
        goalVersionId: goal.id,
        goalVersion: goal.goalVersion,
        goal: goal.goal,
        previousStatus,
        goalStatus: goal.status,
        safetyEvaluationResultId: goal.sourceSafetyEvaluationResultId,
        effectiveFromPeriodId: goal.effectiveFromPeriodId,
        baselineRevisionId: goal.baselineRevisionId,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function completePatientOnboarding(input: CompletionInput) {
  const { tx } = input;
  await lockPatientForProcessing(tx, input.patientId);

  const state = await tx.patientOnboardingState.findUnique({
    where: { patientId: input.patientId },
  });
  if (!state || !state.authoritativeRevisionId) {
    throw new DomainError(
      409,
      'ONBOARDING_NOT_SUBMITTED',
      'Submit onboarding before finishing setup.',
    );
  }
  if (
    state.authoritativeRevisionId !==
    input.authoritativeOnboardingRevisionId
  ) {
    throw new DomainError(
      409,
      'VERSION_CONFLICT',
      'The authoritative onboarding revision changed before activation.',
    );
  }

  const authoritative = await tx.onboardingRevision.findUniqueOrThrow({
    where: { id: state.authoritativeRevisionId },
  });
  const draft = OnboardingDraftSchema.parse(authoritative.responseSnapshot);
  const desired = await resolveDesiredPlan(
    tx,
    input.patientId,
    authoritative.id,
    draft,
    input.expectedReductionSetupVersion,
  );
  const currentGoal = await loadCurrentGoal(tx, input.patientId);

  if (state.completionStatus === 'COMPLETE') {
    if (
      currentGoal?.status === 'ACTIVE' &&
      samePlan(currentGoal, desired)
    ) {
      const safety = await loadPatientSafetyProjection(
        tx,
        input.patientId,
      );
      return CompleteOnboardingResponseSchema.parse({
        completionStatus: state.completionStatus,
        recoveryGoal: projectRecoveryGoal(currentGoal),
        scheduleState: await scheduleState(tx, input.patientId),
        safety,
      });
    }
    throw new DomainError(
      409,
      'ONBOARDING_ALREADY_COMPLETE',
      'Completed onboarding cannot be silently changed through this flow.',
    );
  }

  const latestInput = await tx.safetyInputRevision.findFirst({
    where: {
      patientId: input.patientId,
      sourceOnboardingRevisionId: authoritative.id,
    },
    orderBy: { revision: 'desc' },
  });
  const parsedSafetyInput = latestInput
    ? SafetyInputSchema.safeParse(latestInput.inputSnapshot)
    : null;
  if (!parsedSafetyInput?.success) {
    throw new DomainError(
      409,
      'SAFETY_ASSESSMENT_REQUIRED',
      'Complete the safety assessment before finishing setup.',
    );
  }

  if (currentGoal?.status === 'ACTIVE') {
    throw new DomainError(
      409,
      'ONBOARDING_COMPLETION_STATE_INVALID',
      'An active recovery goal cannot be replaced through onboarding.',
    );
  }

  let previousStatus: string | null = currentGoal?.status ?? null;
  if (currentGoal && !samePlan(currentGoal, desired)) {
    await tx.recoveryGoalVersion.update({
      where: { id: currentGoal.id },
      data: {
        status: 'SUPERSEDED',
        updatedByUserId: input.actorId,
        updatedAt: input.clock.now(),
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: 'RECOVERY_GOAL_STATUS_CHANGED',
        entityType: 'RECOVERY_GOAL_VERSION',
        entityId: currentGoal.id,
        patientId: input.patientId,
        requestId: input.requestId,
        metadata: {
          goalVersionId: currentGoal.id,
          goalVersion: currentGoal.goalVersion,
          goal: currentGoal.goal,
          previousStatus: currentGoal.status,
          goalStatus: 'SUPERSEDED',
          safetyEvaluationResultId:
            currentGoal.sourceSafetyEvaluationResultId,
          effectiveFromPeriodId: currentGoal.effectiveFromPeriodId,
          baselineRevisionId: currentGoal.baselineRevisionId,
        } as Prisma.InputJsonValue,
      },
    });
    previousStatus = null;
  }

  await applyProfilePreferences(tx, input, draft);

  const canReuseActivationEvaluation =
    (state.completionStatus === 'PENDING_SAFETY_REVIEW' ||
      state.completionStatus === 'SAFETY_HANDOFF') &&
    state.completionSafetyEvaluationResultId !== null &&
    currentGoal !== null &&
    currentGoal.status !== 'ACTIVE' &&
    samePlan(currentGoal, desired);

  let safety: PatientSafetyProjection;
  let safetyEvaluationResultId = state.completionSafetyEvaluationResultId;
  if (canReuseActivationEvaluation) {
    safety = await loadPatientSafetyProjection(tx, input.patientId);
  } else {
    const activationContext =
      desired.goal === 'REDUCTION' ||
      (desired.goal === 'ABSTINENCE' && desired.baselineRevisionId)
        ? {
            plannedDirection: desired.goal,
            baselineAverageWeeklyDrinks:
              desired.baselineAverageWeeklyDrinks ?? undefined,
            ...(desired.goal === 'REDUCTION' &&
            desired.targetWeeklyStandardDrinks !== null
              ? {
                  targetWeeklyDrinks: desired.targetWeeklyStandardDrinks,
                }
              : {}),
            canonicalProlongedHeavyRegularUse:
              desired.baselineAverageWeeklyDrinks !== null &&
              desired.thresholdProfile !== null
                ? canonicalProlongedHeavyRegularUse(
                    desired.baselineAverageWeeklyDrinks,
                    desired.thresholdProfile,
                    parsedSafetyInput.data.similarHeavyRegularUseAtLeast3Months,
                  )
                : false,
          }
        : { plannedDirection: desired.goal };
    const evaluation = await evaluatePatientSafety({
      tx,
      config: input.config,
      clock: input.clock,
      patientId: input.patientId,
      actorId: input.actorId,
      requestId: input.requestId,
      input: parsedSafetyInput.data,
      activationContext,
      trigger: 'ACTIVATION',
    });
    safety = evaluation.safety;
    safetyEvaluationResultId = evaluation.evaluationId;
  }

  if (!safetyEvaluationResultId) {
    throw new DomainError(
      409,
      'SAFETY_ASSESSMENT_REQUIRED',
      'Complete the safety assessment before finishing setup.',
    );
  }
  if (safety.safetyState === 'NOT_ASSESSED') {
    throw new DomainError(
      409,
      'SAFETY_ASSESSMENT_REQUIRED',
      'Complete the safety assessment before finishing setup.',
    );
  }

  let goalStatus:
    | 'PENDING_CLINICAL_SAFETY_REVIEW'
    | 'ACTIVE'
    | 'SUSPENDED_SAFETY_HANDOFF';
  let effectivePeriod: { id: string; scheduleVersionId: string } | null = null;
  const scheduleInput = {
    patientId: input.patientId,
    actorUserId: input.actorId,
    provenance: 'ONBOARDING_ACTIVATION',
  };

  if (safety.safetyState === 'HANDOFF_REQUIRED') {
    goalStatus = 'SUSPENDED_SAFETY_HANDOFF';
  } else if (
    safety.safetyState === 'REVIEW_REQUIRED' &&
    !safety.goalChangeAllowed
  ) {
    goalStatus = 'PENDING_CLINICAL_SAFETY_REVIEW';
    if (safety.monitoringPromptPolicy === 'CONTINUE') {
      await createInitialScheduleInTransaction(tx, input.clock, scheduleInput);
    }
  } else if (safety.monitoringPromptPolicy === 'CONTINUE') {
    effectivePeriod = await ensureGoalActivationPeriodInTransaction(
      tx,
      input.clock,
      scheduleInput,
    );
    goalStatus = 'ACTIVE';
  } else {
    goalStatus = 'PENDING_CLINICAL_SAFETY_REVIEW';
  }

  let persistedGoal;
  if (
    currentGoal &&
    currentGoal.status !== 'ACTIVE' &&
    samePlan(currentGoal, desired)
  ) {
    persistedGoal = await tx.recoveryGoalVersion.update({
      where: { id: currentGoal.id },
      data: {
        status: goalStatus,
        effectiveFromPeriodId: effectivePeriod?.id ?? null,
        sourceSafetyEvaluationResultId: safetyEvaluationResultId,
        updatedByUserId: input.actorId,
        updatedAt: input.clock.now(),
      },
    });
  } else {
    const latest = await tx.recoveryGoalVersion.findFirst({
      where: { patientId: input.patientId },
      orderBy: { goalVersion: 'desc' },
      select: { goalVersion: true },
    });
    persistedGoal = await tx.recoveryGoalVersion.create({
      data: {
        patientId: input.patientId,
        goalVersion: (latest?.goalVersion ?? 0) + 1,
        goal: desired.goal,
        status: goalStatus,
        baselineRevisionId: desired.baselineRevisionId,
        baselineStart: desired.baselineStart,
        baselineEnd: desired.baselineEnd,
        baselineAverageWeeklyDrinks:
          desired.baselineAverageWeeklyDrinks?.toFixed(4) ?? null,
        targetWeeklyStandardDrinks:
          desired.targetWeeklyStandardDrinks?.toFixed(4) ?? null,
        effectiveFromPeriodId: effectivePeriod?.id ?? null,
        setBy: 'PATIENT',
        sourceOnboardingRevisionId: desired.sourceOnboardingRevisionId,
        sourceSafetyEvaluationResultId: safetyEvaluationResultId,
        createdAt: input.clock.now(),
        createdByUserId: input.actorId,
        updatedAt: input.clock.now(),
        updatedByUserId: input.actorId,
        provenance: {
          source: 'ONBOARDING_ACTIVATION',
          onboardingRevisionId: desired.sourceOnboardingRevisionId,
          baselineRevisionId: desired.baselineRevisionId,
        } as Prisma.InputJsonValue,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: 'RECOVERY_GOAL_VERSION_CREATED',
        entityType: 'RECOVERY_GOAL_VERSION',
        entityId: persistedGoal.id,
        patientId: input.patientId,
        requestId: input.requestId,
        metadata: {
          goalVersionId: persistedGoal.id,
          goal: persistedGoal.goal,
          goalStatus: persistedGoal.status,
          safetyEvaluationResultId,
          scheduleVersionId: effectivePeriod?.scheduleVersionId ?? null,
          effectiveFromPeriodId: effectivePeriod?.id ?? null,
          onboardingRevisionId: desired.sourceOnboardingRevisionId,
          baselineRevisionId: desired.baselineRevisionId,
        } as Prisma.InputJsonValue,
      },
    });
  }

  await auditGoalStatusChange(
    tx,
    input,
    persistedGoal,
    previousStatus,
  );

  const nextCompletionStatus =
    goalStatus === 'ACTIVE'
      ? ('COMPLETE' as const)
      : goalStatus === 'SUSPENDED_SAFETY_HANDOFF'
        ? ('SAFETY_HANDOFF' as const)
        : ('PENDING_SAFETY_REVIEW' as const);
  const completionChanged =
    state.completionStatus !== nextCompletionStatus ||
    state.completionSafetyEvaluationResultId !== safetyEvaluationResultId ||
    (nextCompletionStatus === 'COMPLETE' &&
      (state.completedAt === null || state.completedByUserId !== input.actorId));

  await tx.patientOnboardingState.update({
    where: { patientId: input.patientId },
    data: {
      completionStatus: nextCompletionStatus,
      completionSafetyEvaluationResultId: safetyEvaluationResultId,
      completedAt:
        nextCompletionStatus === 'COMPLETE' ? input.clock.now() : null,
      completedByUserId:
        nextCompletionStatus === 'COMPLETE' ? input.actorId : null,
      updatedByUserId: input.actorId,
      ...(completionChanged ? { version: { increment: 1 } } : {}),
    },
  });

  if (completionChanged) {
    await tx.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: 'ONBOARDING_COMPLETION_STATE_CHANGED',
        entityType: 'PATIENT_ONBOARDING_STATE',
        entityId: input.patientId,
        patientId: input.patientId,
        requestId: input.requestId,
        metadata: {
          completionStatus: nextCompletionStatus,
          safetyEvaluationResultId,
          onboardingRevisionId: desired.sourceOnboardingRevisionId,
          goalVersionId: persistedGoal.id,
        } as Prisma.InputJsonValue,
      },
    });
  }

  const activeSchedule = await tx.monitoringScheduleVersion.findFirst({
    where: { patientId: input.patientId, lifecycle: 'ACTIVE' },
    select: { id: true },
  });
  if (nextCompletionStatus === 'COMPLETE') {
    await tx.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: 'ONBOARDING_ACTIVATED',
        entityType: 'RECOVERY_GOAL_VERSION',
        entityId: persistedGoal.id,
        patientId: input.patientId,
        requestId: input.requestId,
        metadata: {
          goalVersionId: persistedGoal.id,
          goal: persistedGoal.goal,
          goalStatus: persistedGoal.status,
          safetyEvaluationResultId,
          scheduleVersionId:
            effectivePeriod?.scheduleVersionId ?? activeSchedule?.id ?? null,
          effectiveFromPeriodId: persistedGoal.effectiveFromPeriodId,
          onboardingRevisionId: desired.sourceOnboardingRevisionId,
          baselineRevisionId: desired.baselineRevisionId,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return CompleteOnboardingResponseSchema.parse({
    completionStatus: nextCompletionStatus,
    recoveryGoal: projectRecoveryGoal(persistedGoal),
    scheduleState: activeSchedule
      ? ('ACTIVATED' as const)
      : ('NOT_ACTIVATED' as const),
    safety,
  });
}
