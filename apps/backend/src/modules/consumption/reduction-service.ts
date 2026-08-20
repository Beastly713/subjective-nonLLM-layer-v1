import { randomUUID } from 'node:crypto';

import {
  OnboardingDraftSchema,
  ReductionSetupResponseSchema,
  type ReductionBaselineDayInput,
  type ReductionSetupResponse,
} from '@aud-subjective/contracts';
import { DateTime } from 'luxon';

import type { Prisma } from '../../generated/prisma/client.js';
import type { Clock } from '../../shared/clock/clock.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { loadPatientSafetyProjection } from '../safety/projections.js';
import {
  calculateReductionBaselineMetrics,
  DEFAULT_THRESHOLD_PROFILE,
  DEFAULT_THRESHOLD_PROFILE_SOURCE,
  PATIENT_INPUT_DECIMAL_PLACES,
  REDUCTION_UNIT_POLICY_VERSION,
  STANDARD_DRINK_GRAMS_ETHANOL,
  standardDrinksToEthanolGrams,
} from './reduction-domain.js';

const reductionStateInclude = {
  draftBaselineRevision: {
    include: {
      days: { orderBy: { localDate: 'asc' as const } },
    },
  },
  authoritativeBaselineRevision: {
    include: {
      days: { orderBy: { localDate: 'asc' as const } },
    },
  },
} as const;

type ReductionDatabase = Pick<
  Prisma.TransactionClient,
  | 'patientProfile'
  | 'patientOnboardingState'
  | 'onboardingRevision'
  | 'reductionSetupState'
  | 'reductionBaselineRevision'
  | 'reductionBaselineDay'
  | 'auditEvent'
  | 'safetyCase'
  | 'safetyEvaluationResult'
>;

type ReductionTransaction = Prisma.TransactionClient;

type ReductionState = Prisma.ReductionSetupStateGetPayload<{
  include: typeof reductionStateInclude;
}>;

type ReductionDraftRevision = NonNullable<
  ReductionState['draftBaselineRevision']
>;
type ReductionDay = ReductionDraftRevision['days'][number];

type MutationContext = {
  tx: ReductionTransaction;
  patientId: string;
  actorId: string;
  requestId: string;
  clock: Clock;
};

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new DomainError(
      500,
      'REDUCTION_BASELINE_INVALID',
      'The stored reduction baseline contains an invalid number.',
    );
  }
  return parsed;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dbDate(value: string) {
  return DateTime.fromISO(value, { zone: 'UTC' }).toJSDate();
}

function dateWindow(start: Date, end: Date) {
  const startDate = DateTime.fromISO(dateKey(start), { zone: 'UTC' });
  const endDate = DateTime.fromISO(dateKey(end), { zone: 'UTC' });
  const result: string[] = [];
  for (
    let current = startDate;
    current.toMillis() <= endDate.toMillis();
    current = current.plus({ days: 1 })
  ) {
    result.push(current.toISODate()!);
  }
  return result;
}

function frozenBaselineWindow(now: Date, monitoringTimezone: string) {
  const localNow = DateTime.fromJSDate(now, { zone: monitoringTimezone });
  if (!localNow.isValid) {
    throw new DomainError(
      500,
      'MONITORING_TIMEZONE_INVALID',
      'The patient monitoring timezone is invalid.',
    );
  }
  const baselineEnd = localNow.startOf('day').minus({ days: 1 });
  const baselineStart = baselineEnd.minus({ days: 27 });
  return {
    baselineStart: baselineStart.toISODate()!,
    baselineEnd: baselineEnd.toISODate()!,
  };
}

function assertExpectedVersion(
  state: ReductionState | null,
  expectedVersion: number,
) {
  if (
    (!state && expectedVersion !== 0) ||
    (state && state.version !== expectedVersion)
  ) {
    throw new DomainError(
      409,
      'VERSION_CONFLICT',
      'The reduction setup changed before this update.',
    );
  }
}

async function loadReductionState(
  db: ReductionDatabase,
  patientId: string,
): Promise<ReductionState | null> {
  return db.reductionSetupState.findUnique({
    where: { patientId },
    include: reductionStateInclude,
  });
}

async function loadEligibility(
  db: ReductionDatabase,
  patientId: string,
) {
  const state = await db.patientOnboardingState.findUnique({
    where: { patientId },
    select: { authoritativeRevisionId: true },
  });
  if (!state?.authoritativeRevisionId) {
    return { status: 'MISSING_AUTHORITATIVE_REVISION' as const };
  }

  const revision = await db.onboardingRevision.findUnique({
    where: { id: state.authoritativeRevisionId },
    select: { responseSnapshot: true },
  });
  if (!revision) {
    throw new DomainError(
      500,
      'ONBOARDING_REVISION_MISSING',
      'The authoritative onboarding revision could not be loaded.',
    );
  }

  const parsed = OnboardingDraftSchema.safeParse(revision.responseSnapshot);
  if (!parsed.success) {
    throw new DomainError(
      500,
      'ONBOARDING_REVISION_INVALID',
      'The authoritative onboarding revision is invalid.',
    );
  }

  const recoveryDirection =
    parsed.data.recoveryDirection.state === 'ANSWERED'
      ? parsed.data.recoveryDirection.value
      : 'UNSURE';

  return {
    status:
      recoveryDirection === 'REDUCTION'
        ? ('REDUCTION_REQUIRED' as const)
        : ('NOT_REQUIRED' as const),
  };
}

async function requireReductionEligibility(
  db: ReductionDatabase,
  patientId: string,
) {
  const eligibility = await loadEligibility(db, patientId);
  if (eligibility.status === 'MISSING_AUTHORITATIVE_REVISION') {
    throw new DomainError(
      409,
      'ONBOARDING_NOT_SUBMITTED',
      'Submit onboarding before starting reduction setup.',
    );
  }
  if (eligibility.status === 'NOT_REQUIRED') {
    throw new DomainError(
      409,
      'REDUCTION_SETUP_NOT_REQUIRED',
      'Reduction setup is not required for the authoritative recovery direction.',
    );
  }
}

async function requireMutationSafety(
  db: ReductionDatabase,
  patientId: string,
  goalChange: boolean,
) {
  const safety = await loadPatientSafetyProjection(db, patientId);
  if (safety.safetyState === 'NOT_ASSESSED') {
    throw new DomainError(
      409,
      'SAFETY_NOT_ASSESSED',
      'Complete the safety assessment before starting reduction setup.',
    );
  }
  if (
    safety.safetyState === 'HANDOFF_REQUIRED' ||
    safety.requiresSafetyShell
  ) {
    throw new DomainError(
      409,
      'SAFETY_HANDOFF_REQUIRED',
      'Reduction setup is unavailable while a safety handoff is required.',
    );
  }
  if (goalChange && !safety.goalChangeAllowed) {
    throw new DomainError(
      409,
      'GOAL_CHANGE_RESTRICTED',
      'Target changes are unavailable during the current safety review.',
    );
  }
  return safety;
}

function serializeDay(day: ReductionDay) {
  return {
    id: day.id,
    localDate: dateKey(day.localDate),
    status: day.status,
    standardDrinks: decimalToNumber(day.standardDrinks),
    ethanolGrams: decimalToNumber(day.ethanolGrams),
    source: day.source,
    unitPolicyVersion: day.unitPolicyVersion,
  };
}

function serializeDraft(revision: ReductionDraftRevision) {
  const days = revision.days.map(serializeDay);
  return {
    id: revision.id,
    revision: revision.revision,
    baselineStart: dateKey(revision.baselineStart),
    baselineEnd: dateKey(revision.baselineEnd),
    monitoringTimezone: revision.monitoringTimezone,
    knownDays: days.filter((day) => day.status !== 'UNKNOWN').length,
    unknownDays: days.filter((day) => day.status === 'UNKNOWN').length,
    days,
  };
}

function requiredMetric(value: unknown) {
  const parsed = decimalToNumber(value);
  if (parsed === null) {
    throw new DomainError(
      500,
      'REDUCTION_BASELINE_INVALID',
      'The confirmed reduction baseline is missing derived metrics.',
    );
  }
  return parsed;
}

function serializeAuthoritative(
  revision: NonNullable<ReductionState['authoritativeBaselineRevision']>,
) {
  if (!revision.confirmedAt) {
    throw new DomainError(
      500,
      'REDUCTION_BASELINE_INVALID',
      'The confirmed reduction baseline is missing confirmation metadata.',
    );
  }
  return {
    id: revision.id,
    revision: revision.revision,
    baselineStart: dateKey(revision.baselineStart),
    baselineEnd: dateKey(revision.baselineEnd),
    monitoringTimezone: revision.monitoringTimezone,
    metrics: {
      baselineTotalStandardDrinks28d: requiredMetric(
        revision.baselineTotalStandardDrinks28d,
      ),
      baselineTotalEthanolGrams28d: requiredMetric(
        revision.baselineTotalEthanolGrams28d,
      ),
      baselineDrinkingDays28d: revision.baselineDrinkingDays28d ?? 0,
      baselineHeavyDrinkingDays28d:
        revision.baselineHeavyDrinkingDays28d ?? 0,
      baselineMaxStandardDrinksDay: requiredMetric(
        revision.baselineMaxStandardDrinksDay,
      ),
      baselineAverageDrinksPerDrinkingDay: requiredMetric(
        revision.baselineAverageDrinksPerDrinkingDay,
      ),
      baselineAverageWeeklyDrinks: requiredMetric(
        revision.baselineAverageWeeklyDrinks,
      ),
    },
    confirmedAt: revision.confirmedAt.toISOString(),
  };
}

function proposalProjection(state: ReductionState) {
  if (
    !state.proposalKind ||
    state.targetWeeklyStandardDrinks === null ||
    !state.proposalBaselineRevisionId ||
    !state.proposalUpdatedAt
  ) {
    return null;
  }
  const target = decimalToNumber(state.targetWeeklyStandardDrinks);
  if (target === null) return null;
  return {
    kind: state.proposalKind,
    targetWeeklyStandardDrinks: target,
    baselineRevisionId: state.proposalBaselineRevisionId,
    updatedAt: state.proposalUpdatedAt.toISOString(),
  };
}

export async function loadReductionSetupProjection(
  db: ReductionDatabase,
  patientId: string,
): Promise<ReductionSetupResponse> {
  const [state, eligibility] = await Promise.all([
    loadReductionState(db, patientId),
    loadEligibility(db, patientId),
  ]);

  if (eligibility.status !== 'REDUCTION_REQUIRED') {
    return ReductionSetupResponseSchema.parse({
      required: false,
      state: 'NOT_REQUIRED',
      version: state?.version ?? 0,
      unitPolicy: {
        version: REDUCTION_UNIT_POLICY_VERSION,
        standardDrinkGramsEthanol: STANDARD_DRINK_GRAMS_ETHANOL,
        patientInputDecimalPlaces: PATIENT_INPUT_DECIMAL_PLACES,
      },
      thresholdProfile: DEFAULT_THRESHOLD_PROFILE,
      draftBaseline: null,
      authoritativeBaseline: null,
      proposal: null,
    });
  }

  const draftBaseline = state?.draftBaselineRevision
    ? serializeDraft(state.draftBaselineRevision)
    : null;
  const authoritativeBaseline = state?.authoritativeBaselineRevision
    ? serializeAuthoritative(state.authoritativeBaselineRevision)
    : null;
  const thresholdProfile =
    state?.draftBaselineRevision?.thresholdProfile ??
    state?.authoritativeBaselineRevision?.thresholdProfile ??
    DEFAULT_THRESHOLD_PROFILE;

  const currentState = !state
    ? 'NOT_STARTED'
    : draftBaseline
      ? 'BASELINE_DRAFT'
      : state.proposalKind && state.proposalBaselineRevisionId
        ? 'PROPOSED'
        : authoritativeBaseline
          ? 'BASELINE_CONFIRMED'
          : 'NOT_STARTED';

  return ReductionSetupResponseSchema.parse({
    required: true,
    state: currentState,
    version: state?.version ?? 0,
    unitPolicy: {
      version: REDUCTION_UNIT_POLICY_VERSION,
      standardDrinkGramsEthanol: STANDARD_DRINK_GRAMS_ETHANOL,
      patientInputDecimalPlaces: PATIENT_INPUT_DECIMAL_PLACES,
    },
    thresholdProfile,
    draftBaseline,
    authoritativeBaseline,
    proposal: state ? proposalProjection(state) : null,
  });
}

function assertStoredDraftWindow(revision: ReductionDraftRevision) {
  if (revision.days.length !== 28) {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_INVALID',
      'The baseline draft does not contain exactly 28 days.',
    );
  }
  const expectedDates = dateWindow(revision.baselineStart, revision.baselineEnd);
  const storedDates = revision.days.map((day) => dateKey(day.localDate));
  if (
    expectedDates.length !== 28 ||
    expectedDates.some((value, index) => value !== storedDates[index])
  ) {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_INVALID',
      'The baseline draft dates are not the frozen 28-day window.',
    );
  }
}

function assertInputMatchesWindow(
  revision: NonNullable<ReductionState['draftBaselineRevision']>,
  days: readonly ReductionBaselineDayInput[],
) {
  assertStoredDraftWindow(revision);
  const expectedDates = dateWindow(revision.baselineStart, revision.baselineEnd);
  const submittedDates = days.map((day) => day.localDate).sort();
  const sortedExpected = [...expectedDates].sort();
  if (
    submittedDates.length !== sortedExpected.length ||
    submittedDates.some((value, index) => value !== sortedExpected[index])
  ) {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_WINDOW_MISMATCH',
      'The submitted dates do not match the frozen baseline window.',
    );
  }
}

async function audit(
  tx: ReductionTransaction,
  context: MutationContext,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
  reason?: string,
) {
  await tx.auditEvent.create({
    data: {
      actorId: context.actorId,
      action,
      entityType,
      entityId,
      patientId: context.patientId,
      reason,
      metadata,
      requestId: context.requestId,
    },
  });
}

function baselineMetricData(metrics: ReturnType<typeof calculateReductionBaselineMetrics>) {
  return {
    baselineTotalStandardDrinks28d:
      metrics.baselineTotalStandardDrinks28d.toFixed(4),
    baselineTotalEthanolGrams28d:
      metrics.baselineTotalEthanolGrams28d.toFixed(4),
    baselineDrinkingDays28d: metrics.baselineDrinkingDays28d,
    baselineHeavyDrinkingDays28d: metrics.baselineHeavyDrinkingDays28d,
    baselineMaxStandardDrinksDay:
      metrics.baselineMaxStandardDrinksDay.toFixed(4),
    baselineAverageDrinksPerDrinkingDay:
      metrics.baselineAverageDrinksPerDrinkingDay.toFixed(4),
    baselineAverageWeeklyDrinks:
      metrics.baselineAverageWeeklyDrinks.toFixed(4),
  };
}

function storedDayInput(
  day: ReductionDay,
) {
  const quantity = decimalToNumber(day.standardDrinks);
  return {
    status: day.status,
    standardDrinks: quantity ?? 0,
  };
}

export async function startReductionBaseline(
  context: MutationContext,
  expectedVersion: number,
) {
  await lockPatientForProcessing(context.tx, context.patientId);
  const state = await loadReductionState(context.tx, context.patientId);
  assertExpectedVersion(state, expectedVersion);
  await requireReductionEligibility(context.tx, context.patientId);
  await requireMutationSafety(context.tx, context.patientId, false);

  if (state?.draftBaselineRevision) {
    return loadReductionSetupProjection(context.tx, context.patientId);
  }
  if (state?.authoritativeBaselineRevisionId) {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_ALREADY_CONFIRMED',
      'A baseline is already confirmed. Start a correction instead.',
    );
  }

  const profile = await context.tx.patientProfile.findUnique({
    where: { patientId: context.patientId },
    select: { monitoringTimezone: true },
  });
  if (!profile) {
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  }

  const window = frozenBaselineWindow(
    context.clock.now(),
    profile.monitoringTimezone,
  );
  const latestRevision = await context.tx.reductionBaselineRevision.findFirst({
    where: { patientId: context.patientId },
    orderBy: { revision: 'desc' },
    select: { revision: true },
  });
  const revisionNumber = (latestRevision?.revision ?? 0) + 1;
  const revisionId = randomUUID();
  const revision = await context.tx.reductionBaselineRevision.create({
    data: {
      id: revisionId,
      patientId: context.patientId,
      revision: revisionNumber,
      lifecycle: 'DRAFT',
      baselineStart: dbDate(window.baselineStart),
      baselineEnd: dbDate(window.baselineEnd),
      monitoringTimezone: profile.monitoringTimezone,
      thresholdProfile: DEFAULT_THRESHOLD_PROFILE,
      thresholdProfileSource: DEFAULT_THRESHOLD_PROFILE_SOURCE,
      unitPolicyVersion: REDUCTION_UNIT_POLICY_VERSION,
      createdAt: context.clock.now(),
      createdByUserId: context.actorId,
      provenance: {
        source: 'PATIENT_RECALL',
        window: 'COMPLETED_LOCAL_CALENDAR_DAYS',
      },
    },
  });

  const days = dateWindow(revision.baselineStart, revision.baselineEnd);
  await context.tx.reductionBaselineDay.createMany({
    data: days.map((localDate) => ({
      id: randomUUID(),
      baselineRevisionId: revision.id,
      localDate: dbDate(localDate),
      status: 'UNKNOWN',
      standardDrinks: null,
      ethanolGrams: null,
      source: 'PATIENT_RECALL',
      unitPolicyVersion: REDUCTION_UNIT_POLICY_VERSION,
      createdAt: context.clock.now(),
      updatedByUserId: context.actorId,
    })),
  });

  if (state) {
    await context.tx.reductionSetupState.update({
      where: { patientId: context.patientId },
      data: {
        draftBaselineRevisionId: revision.id,
        version: { increment: 1 },
        updatedByUserId: context.actorId,
      },
    });
  } else {
    await context.tx.reductionSetupState.create({
      data: {
        patientId: context.patientId,
        version: 1,
        draftBaselineRevisionId: revision.id,
        createdAt: context.clock.now(),
        createdByUserId: context.actorId,
        updatedByUserId: context.actorId,
      },
    });
  }

  await audit(
    context.tx,
    context,
    'REDUCTION_BASELINE_DRAFT_STARTED',
    'REDUCTION_BASELINE_REVISION',
    revision.id,
    { revision: revisionNumber, baselineStart: window.baselineStart, baselineEnd: window.baselineEnd },
  );

  return loadReductionSetupProjection(context.tx, context.patientId);
}

export async function saveReductionBaselineDraft(
  context: MutationContext,
  expectedVersion: number,
  days: readonly ReductionBaselineDayInput[],
) {
  await lockPatientForProcessing(context.tx, context.patientId);
  const state = await loadReductionState(context.tx, context.patientId);
  assertExpectedVersion(state, expectedVersion);
  await requireReductionEligibility(context.tx, context.patientId);
  await requireMutationSafety(context.tx, context.patientId, false);

  if (!state?.draftBaselineRevision) {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_DRAFT_REQUIRED',
      'Start a baseline draft before saving daily values.',
    );
  }
  if (state.draftBaselineRevision.lifecycle !== 'DRAFT') {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_IMMUTABLE',
      'The confirmed baseline cannot be edited.',
    );
  }
  assertInputMatchesWindow(state.draftBaselineRevision, days);

  const byDate = new Map(days.map((day) => [day.localDate, day]));
  for (const storedDay of state.draftBaselineRevision.days) {
    const input = byDate.get(dateKey(storedDay.localDate));
    if (!input) {
      throw new DomainError(
        409,
        'REDUCTION_BASELINE_WINDOW_MISMATCH',
        'The submitted dates do not match the frozen baseline window.',
      );
    }
    const standardDrinks =
      input.status === 'UNKNOWN'
        ? null
        : input.status === 'KNOWN_ZERO'
          ? 0
          : input.standardDrinks!;
    await context.tx.reductionBaselineDay.update({
      where: { id: storedDay.id },
      data: {
        status: input.status,
        standardDrinks:
          standardDrinks === null ? null : standardDrinks.toFixed(4),
        ethanolGrams:
          standardDrinks === null
            ? null
            : standardDrinksToEthanolGrams(standardDrinks).toFixed(4),
        source: 'PATIENT_RECALL',
        unitPolicyVersion: REDUCTION_UNIT_POLICY_VERSION,
        updatedByUserId: context.actorId,
      },
    });
  }

  const knownDays = days.filter((day) => day.status !== 'UNKNOWN').length;
  await context.tx.reductionSetupState.update({
    where: { patientId: context.patientId },
    data: {
      version: { increment: 1 },
      updatedByUserId: context.actorId,
    },
  });
  await audit(
    context.tx,
    context,
    'REDUCTION_BASELINE_DRAFT_SAVED',
    'REDUCTION_BASELINE_REVISION',
    state.draftBaselineRevision.id,
    { revision: state.draftBaselineRevision.revision, knownDays },
  );
  return loadReductionSetupProjection(context.tx, context.patientId);
}

export async function confirmReductionBaseline(
  context: MutationContext,
  expectedVersion: number,
) {
  await lockPatientForProcessing(context.tx, context.patientId);
  const state = await loadReductionState(context.tx, context.patientId);
  assertExpectedVersion(state, expectedVersion);
  await requireReductionEligibility(context.tx, context.patientId);
  await requireMutationSafety(context.tx, context.patientId, false);

  const draft = state?.draftBaselineRevision;
  if (!draft || !state) {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_DRAFT_REQUIRED',
      'Start and complete a baseline draft before confirmation.',
    );
  }
  if (draft.lifecycle !== 'DRAFT') {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_IMMUTABLE',
      'The confirmed baseline cannot be edited.',
    );
  }
  assertStoredDraftWindow(draft);
  if (draft.days.some((day) => day.status === 'UNKNOWN')) {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_INCOMPLETE',
      'Every baseline day must be known before confirmation.',
    );
  }

  let metrics;
  try {
    metrics = calculateReductionBaselineMetrics(
      draft.days.map(storedDayInput),
      draft.thresholdProfile,
    );
  } catch (error) {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_INVALID',
      error instanceof Error ? error.message : 'The baseline is invalid.',
    );
  }

  const now = context.clock.now();
  await context.tx.reductionBaselineRevision.update({
    where: { id: draft.id },
    data: {
      lifecycle: 'CONFIRMED',
      ...baselineMetricData(metrics),
      confirmedAt: now,
      confirmedByUserId: context.actorId,
    },
  });

  const invalidatedProposal =
    state.proposalBaselineRevisionId &&
    state.proposalBaselineRevisionId !== draft.id;
  await context.tx.reductionSetupState.update({
    where: { patientId: context.patientId },
    data: {
      draftBaselineRevisionId: null,
      authoritativeBaselineRevisionId: draft.id,
      ...(invalidatedProposal
        ? {
            proposalKind: null,
            targetWeeklyStandardDrinks: null,
            proposalBaselineRevisionId: null,
            proposalUpdatedAt: null,
            proposalUpdatedByUserId: null,
          }
        : {}),
      version: { increment: 1 },
      updatedByUserId: context.actorId,
    },
  });

  await audit(
    context.tx,
    context,
    'REDUCTION_BASELINE_CONFIRMED',
    'REDUCTION_BASELINE_REVISION',
    draft.id,
    { revision: draft.revision, knownDays: 28 },
  );
  if (invalidatedProposal) {
    await audit(
      context.tx,
      context,
      'REDUCTION_TARGET_PROPOSAL_INVALIDATED',
      'REDUCTION_SETUP_STATE',
      context.patientId,
      {
        previousBaselineRevisionId: state.proposalBaselineRevisionId,
        authoritativeBaselineRevisionId: draft.id,
      },
    );
  }
  return loadReductionSetupProjection(context.tx, context.patientId);
}

export async function startReductionBaselineCorrection(
  context: MutationContext,
  expectedVersion: number,
  reason: string,
) {
  await lockPatientForProcessing(context.tx, context.patientId);
  const state = await loadReductionState(context.tx, context.patientId);
  assertExpectedVersion(state, expectedVersion);
  await requireReductionEligibility(context.tx, context.patientId);
  await requireMutationSafety(context.tx, context.patientId, false);

  const authoritative = state?.authoritativeBaselineRevision;
  if (!state || !authoritative) {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_REQUIRED',
      'Confirm a baseline before starting a correction.',
    );
  }
  if (state.draftBaselineRevision) {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_CORRECTION_EXISTS',
      'A baseline correction is already in progress.',
    );
  }
  assertStoredDraftWindow(authoritative);

  const latestRevision = await context.tx.reductionBaselineRevision.findFirst({
    where: { patientId: context.patientId },
    orderBy: { revision: 'desc' },
    select: { revision: true },
  });
  const revisionId = randomUUID();
  const revision = await context.tx.reductionBaselineRevision.create({
    data: {
      id: revisionId,
      patientId: context.patientId,
      revision: (latestRevision?.revision ?? authoritative.revision) + 1,
      lifecycle: 'DRAFT',
      baselineStart: authoritative.baselineStart,
      baselineEnd: authoritative.baselineEnd,
      monitoringTimezone: authoritative.monitoringTimezone,
      thresholdProfile: authoritative.thresholdProfile,
      thresholdProfileSource: authoritative.thresholdProfileSource,
      unitPolicyVersion: authoritative.unitPolicyVersion,
      correctionOfRevisionId: authoritative.id,
      correctionReason: reason,
      createdAt: context.clock.now(),
      createdByUserId: context.actorId,
      provenance: {
        source: 'PATIENT_CORRECTION',
        correctionOfRevisionId: authoritative.id,
      },
    },
  });
  await context.tx.reductionBaselineDay.createMany({
    data: authoritative.days.map((day) => ({
      id: randomUUID(),
      baselineRevisionId: revision.id,
      localDate: day.localDate,
      status: day.status,
      standardDrinks: day.standardDrinks,
      ethanolGrams: day.ethanolGrams,
      source: day.source,
      unitPolicyVersion: day.unitPolicyVersion,
      createdAt: context.clock.now(),
      updatedByUserId: context.actorId,
    })),
  });
  await context.tx.reductionSetupState.update({
    where: { patientId: context.patientId },
    data: {
      draftBaselineRevisionId: revision.id,
      version: { increment: 1 },
      updatedByUserId: context.actorId,
    },
  });
  await audit(
    context.tx,
    context,
    'REDUCTION_BASELINE_CORRECTION_STARTED',
    'REDUCTION_BASELINE_REVISION',
    revision.id,
    {
      revision: revision.revision,
      correctionOfRevisionId: authoritative.id,
    },
    reason,
  );
  return loadReductionSetupProjection(context.tx, context.patientId);
}

export async function proposeReductionTarget(
  context: MutationContext,
  expectedVersion: number,
  targetWeeklyStandardDrinks: number,
) {
  await lockPatientForProcessing(context.tx, context.patientId);
  const state = await loadReductionState(context.tx, context.patientId);
  assertExpectedVersion(state, expectedVersion);
  await requireReductionEligibility(context.tx, context.patientId);
  await requireMutationSafety(context.tx, context.patientId, true);

  const authoritative = state?.authoritativeBaselineRevision;
  if (!state || !authoritative) {
    throw new DomainError(
      409,
      'REDUCTION_BASELINE_REQUIRED',
      'Confirm a baseline before proposing a target.',
    );
  }
  const averageWeeklyDrinks = requiredMetric(
    authoritative.baselineAverageWeeklyDrinks,
  );
  const isAbstinence = targetWeeklyStandardDrinks === 0;
  if (!isAbstinence) {
    if (averageWeeklyDrinks <= 0) {
      throw new DomainError(
        409,
        'REDUCTION_TARGET_BASELINE_ZERO',
        'A positive reduction target requires a positive baseline weekly average.',
      );
    }
    if (targetWeeklyStandardDrinks >= averageWeeklyDrinks) {
      throw new DomainError(
        409,
        'REDUCTION_TARGET_NOT_BELOW_BASELINE',
        'A positive reduction target must be below the baseline weekly average.',
      );
    }
  }

  const now = context.clock.now();
  await context.tx.reductionSetupState.update({
    where: { patientId: context.patientId },
    data: {
      proposalKind: isAbstinence ? 'ABSTINENCE' : 'REDUCTION',
      targetWeeklyStandardDrinks: targetWeeklyStandardDrinks.toFixed(4),
      proposalBaselineRevisionId: authoritative.id,
      proposalUpdatedAt: now,
      proposalUpdatedByUserId: context.actorId,
      version: { increment: 1 },
      updatedByUserId: context.actorId,
    },
  });
  await audit(
    context.tx,
    context,
    'REDUCTION_TARGET_PROPOSED',
    'REDUCTION_SETUP_STATE',
    context.patientId,
    {
      kind: isAbstinence ? 'ABSTINENCE' : 'REDUCTION',
      targetWeeklyStandardDrinks,
      baselineRevisionId: authoritative.id,
    },
  );
  return loadReductionSetupProjection(context.tx, context.patientId);
}
