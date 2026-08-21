import {
  WeeklyAssessmentDraftAnswersSchema,
  WeeklyAlcoholDayInputSetSchema,
  type CheckInStateResponse,
  type SubmitWeeklyAssessmentRequest,
} from '@aud-subjective/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
  AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
  AUD_WEEKLY_CHECKIN_SCALE_VERSION,
  AUD_WEEKLY_CHECKIN_WORDING_VERSION,
} from '../../policy/instruments/aud-weekly-checkin-v1.js';
import { SUBJECTIVE_MONITORING_V1 } from '../../policy/subjective-monitoring-v1.js';
import { REDUCTION_UNIT_POLICY_VERSION } from '../consumption/reduction-domain.js';
import type { Clock } from '../../shared/clock/clock.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import {
  resolvePreferencesForPeriod,
  resolveRecoveryGoalForPeriod,
} from '../profiles/period-context.js';
import { loadPatientSafetyProjection } from '../safety/projections.js';
import {
  periodAvailability,
  periodLocalDates,
  projectCheckInState,
} from './projections.js';
import { classifyFirstWeeklyAssessmentSubmission } from './service.js';
import type { AssessmentPeriodRecord } from './types.js';
import {
  finalizeReductionWeek,
  loadHistoricalWeeklyObservations,
} from '../monitoring/service.js';
import { recomputePatientMonitoringFromPeriod } from './recompute-service.js';
import type { WeeklyAnswers } from '../monitoring/types.js';
import { reconcileEngagementForPatient } from '../engagement/service.js';

type Tx = Prisma.TransactionClient;

function notFound(): never {
  throw new DomainError(
    404,
    'NOT_FOUND',
    'The requested resource was not found.',
  );
}

function periodInclude() {
  return {
    scheduleVersion: {
      select: {
        version: true,
      },
    },
  } as const;
}

function hasAnswer(answers: WeeklyAnswers, itemId: keyof WeeklyAnswers) {
  return Object.prototype.hasOwnProperty.call(answers, itemId);
}

function allRequiredAnswersPresent(answers: WeeklyAnswers) {
  return (
    ['U1', 'R1', 'R2', 'R3', 'R4', 'R5', 'P1', 'P2', 'P3', 'P4', 'P5'] as const
  ).every((itemId) => hasAnswer(answers, itemId));
}

function enforceSubmissionSafety(
  safety: Awaited<ReturnType<typeof loadPatientSafetyProjection>>,
  now: Date,
) {
  if (safety.requiresSafetyShell || safety.monitoringPromptPolicy === 'PAUSE') {
    throw new DomainError(
      409,
      'SAFETY_PAUSED',
      'Weekly check-ins are paused while the safety handoff is active.',
    );
  }

  if (safety.reassessmentDueAt && now >= new Date(safety.reassessmentDueAt)) {
    throw new DomainError(
      409,
      'SAFETY_REASSESSMENT_REQUIRED',
      'Complete the required safety reassessment before continuing.',
    );
  }
}

function baselineDaysInput(
  days: ReadonlyArray<{
    localDate: Date;
    status: 'KNOWN_ZERO' | 'KNOWN_QUANTITY' | 'UNKNOWN';
    standardDrinks: unknown;
    ethanolGrams: unknown;
  }>,
) {
  return days.map((day) => ({
    localDate: day.localDate.toISOString().slice(0, 10),
    status: day.status,
    standardDrinks:
      day.standardDrinks === null ? null : Number(day.standardDrinks),
    ethanolGrams: day.ethanolGrams === null ? null : Number(day.ethanolGrams),
  }));
}

function responseRows(answers: WeeklyAnswers) {
  const rows: Array<{
    itemId: string;
    itemKey: string;
    booleanValue?: boolean;
    integerValue?: number;
    instrumentVersion: string;
    wordingVersion: string;
    scaleVersion: string;
  }> = [];

  const items = [
    ['U1', 'alcohol_use_reported'],
    ['R1', 'sleep_difficulty'],
    ['R2', 'negative_mood'],
    ['R3', 'craving'],
    ['R4', 'risky_situations'],
    ['R5', 'relationship_problems'],
    ['P1', 'recovery_confidence'],
    ['P2', 'mutual_help_participation'],
    ['P3', 'spiritual_activity'],
    ['P4', 'productive_recreational_activity'],
    ['P5', 'family_friend_support'],
  ] as const;

  for (const [itemId, itemKey] of items) {
    if (!Object.prototype.hasOwnProperty.call(answers, itemId)) {
      continue;
    }

    const value = answers[itemId];

    rows.push({
      itemId,
      itemKey,
      ...(itemId === 'U1'
        ? {
            booleanValue: value as boolean,
          }
        : {
            integerValue: value as number,
          }),
      instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
      wordingVersion: AUD_WEEKLY_CHECKIN_WORDING_VERSION,
      scaleVersion: AUD_WEEKLY_CHECKIN_SCALE_VERSION,
    });
  }

  return rows;
}

function reductionConflict(
  answers: WeeklyAnswers,
  days: ReadonlyArray<{
    status: 'KNOWN_ZERO' | 'KNOWN_QUANTITY' | 'UNKNOWN';
    standardDrinks: number | null;
  }>,
) {
  const hasPositiveQuantity = days.some(
    (day) => day.status === 'KNOWN_QUANTITY' && (day.standardDrinks ?? 0) > 0,
  );

  const allKnownZero =
    days.length === 7 && days.every((day) => day.status === 'KNOWN_ZERO');

  if (answers.U1 === false && hasPositiveQuantity) {
    return true;
  }

  if (answers.U1 === true && allKnownZero) {
    return true;
  }

  return false;
}

export async function submitWeeklyAssessment(input: {
  tx: Tx;
  clock: Clock;
  patientId: string;
  assessmentId: string;
  request: SubmitWeeklyAssessmentRequest;
  requestId: string;
  allowHistoricalBackfill?: boolean;
}): Promise<CheckInStateResponse> {
  const {
    tx,
    clock,
    patientId,
    assessmentId,
    request,
    requestId,
    allowHistoricalBackfill = false,
  } = input;

  await lockPatientForProcessing(tx, patientId);

  const assessment = await tx.weeklyAssessment.findUnique({
    where: {
      id: assessmentId,
    },
    include: {
      scheduledPeriod: {
        include: periodInclude(),
      },
      authoritativeRevision: {
        select: {
          id: true,
          revisionNumber: true,
          completionStatus: true,
          submissionClassification: true,
          submittedAt: true,
          sourceDraftVersion: true,
        },
      },
    },
  });

  if (!assessment || assessment.patientId !== patientId) {
    notFound();
  }

  if (
    assessment.instrumentId !== AUD_WEEKLY_CHECKIN_INSTRUMENT_ID ||
    assessment.instrumentVersion !== AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION
  ) {
    throw new DomainError(
      409,
      'ASSESSMENT_STATE_INVALID',
      'The assessment policy is not supported.',
    );
  }

  if (
    assessment.authoritativeRevisionId ||
    assessment.completionStatus !== 'DRAFT'
  ) {
    throw new DomainError(
      409,
      'ASSESSMENT_ALREADY_SUBMITTED',
      'This weekly assessment already has an authoritative submission.',
    );
  }

  if (assessment.draftVersion !== request.expectedDraftVersion) {
    throw new DomainError(
      409,
      'VERSION_CONFLICT',
      'The weekly check-in draft changed before submission.',
    );
  }

  const period = assessment.scheduledPeriod as AssessmentPeriodRecord;

  const now = clock.now();

  const submissionClassification =
    await classifyFirstWeeklyAssessmentSubmission(tx, patientId, period, now, {
      allowHistoricalBackfill,
    });

  const [goal, preference] = await Promise.all([
    resolveRecoveryGoalForPeriod(tx, patientId, period),
    resolvePreferencesForPeriod(tx, patientId, period),
  ]);

  const safety = await loadPatientSafetyProjection(tx, patientId);

  enforceSubmissionSafety(safety, now);

  const answers = WeeklyAssessmentDraftAnswersSchema.parse(
    assessment.draftAnswerSnapshot,
  ) as WeeklyAnswers;

  const allAnswered = allRequiredAnswersPresent(answers);

  if (request.completionIntent === 'COMPLETE' && !allAnswered) {
    throw new DomainError(
      400,
      'COMPLETE_REQUIRES_ALL_ITEMS',
      'Complete submission requires an answer for every weekly check-in item.',
    );
  }

  if (request.completionIntent === 'PARTIAL' && allAnswered) {
    throw new DomainError(
      400,
      'INCONSISTENT_COMPLETION_INTENT',
      'All answered items require a COMPLETE submission intent.',
    );
  }

  const draftDays = WeeklyAlcoholDayInputSetSchema.parse(
    assessment.draftConsumptionSnapshot ?? [],
  );

  let finalizedReduction: ReturnType<typeof finalizeReductionWeek> | null =
    null;

  let baseline: Prisma.ReductionBaselineRevisionGetPayload<{
    include: {
      days: {
        orderBy: {
          localDate: 'asc';
        };
      };
    };
  }> | null = null;

  const historical = await loadHistoricalWeeklyObservations(
    tx,
    patientId,
    period.periodStartAt,
  );

  if (goal?.goal === 'REDUCTION') {
    if (!goal.baselineRevisionId) {
      throw new DomainError(
        409,
        'REDUCTION_BASELINE_REQUIRED',
        'A confirmed reduction baseline is required before this check-in can be submitted.',
      );
    }

    baseline = await tx.reductionBaselineRevision.findUnique({
      where: {
        id: goal.baselineRevisionId,
      },
      include: {
        days: {
          orderBy: {
            localDate: 'asc',
          },
        },
      },
    });

    if (!baseline || baseline.lifecycle !== 'CONFIRMED') {
      throw new DomainError(
        409,
        'REDUCTION_BASELINE_REQUIRED',
        'The period-effective reduction baseline is not confirmed.',
      );
    }

    finalizedReduction = finalizeReductionWeek({
      dates: periodLocalDates(period),
      periodStartAt: period.periodStartAt,
      draftDays,
      targetWeeklyStandardDrinks:
        goal.targetWeeklyStandardDrinks === null
          ? null
          : Number(goal.targetWeeklyStandardDrinks),
      baselineAverageWeeklyDrinks:
        goal.baselineAverageWeeklyDrinks === null
          ? null
          : Number(goal.baselineAverageWeeklyDrinks),
      thresholdProfile: baseline.thresholdProfile,
      baselineDays: baselineDaysInput(baseline.days),
      history: historical,
    });

    if (reductionConflict(answers, finalizedReduction.days)) {
      throw new DomainError(
        400,
        'WEEKLY_ALCOHOL_CONFLICT',
        'The weekly alcohol answer conflicts with one or more calendar entries. Correct either source before submitting.',
      );
    }
  } else if (draftDays.length > 0) {
    throw new DomainError(
      400,
      'VALIDATION_ERROR',
      'Weekly consumption days are only available for a period-effective reduction goal.',
    );
  }

  const revision = await tx.assessmentRevision.create({
    data: {
      assessmentId: assessment.id,
      revisionNumber: 1,
      completionStatus: request.completionIntent,
      sourceDraftVersion: assessment.draftVersion,
      submittedAt: now,
      submittedBy: 'PATIENT',
      submittedByUserId: patientId,
      supersedesRevisionId: null,
      submissionClassification,
      instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
      wordingVersion: AUD_WEEKLY_CHECKIN_WORDING_VERSION,
      ruleSetVersion: SUBJECTIVE_MONITORING_V1.ruleSetVersion,
      configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      provenance: {
        source: 'SERVER_BACKED_WEEKLY_DRAFT',
        periodId: period.id,
        scheduleVersionId: period.scheduleVersionId,
        monitoringTimezone: period.monitoringTimezone,
      },
    },
  });

  if (revision.assessmentId !== assessment.id) {
    throw new DomainError(
      500,
      'ASSESSMENT_STATE_INVALID',
      'The authoritative revision did not remain bound to its logical assessment.',
    );
  }

  const rows = responseRows(answers).map((row) => ({
    ...row,
    assessmentRevisionId: revision.id,
  }));

  if (rows.length > 0) {
    await tx.assessmentItemResponse.createMany({
      data: rows,
    });
  }

  const weeklyUseStatus =
    answers.U1 === true
      ? ('POSITIVE' as const)
      : answers.U1 === false
        ? ('NEGATIVE' as const)
        : ('UNKNOWN' as const);

  await tx.useObservationLedger.create({
    data: {
      patientId,
      assessmentId: assessment.id,
      assessmentRevisionId: revision.id,
      scheduledPeriodId: period.id,
      source: 'WEEKLY_ASSESSMENT',
      periodStartAt: period.periodStartAt,
      periodEndAt: period.periodEndAt,
      status: weeklyUseStatus,
      observedAt: now,
      provenance: {
        itemId: 'U1',
        instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
      },
      evaluationId: null,
    },
  });

  if (finalizedReduction && goal) {
    await tx.alcoholConsumptionDay.createMany({
      data: finalizedReduction.days.map((day) => ({
        patientId,
        scheduledPeriodId: period.id,
        assessmentRevisionId: revision.id,
        localDate: new Date(`${day.localDate}T00:00:00.000Z`),
        status: day.status,
        standardDrinks: day.standardDrinks,
        ethanolGrams: day.ethanolGrams,
        source: 'WEEKLY_RECALL',
        unitPolicyVersion: REDUCTION_UNIT_POLICY_VERSION,
      })),
    });

    const summary = finalizedReduction.summary;

    await tx.weeklyConsumptionSummary.create({
      data: {
        patientId,
        scheduledPeriodId: period.id,
        assessmentRevisionId: revision.id,
        recoveryGoalVersionId: goal.id,
        baselineRevisionId: baseline?.id ?? null,
        observedDayCount: summary.observedDayCount,
        unknownDayCount: summary.unknownDayCount,
        coverageRatio: summary.coverageRatio,
        knownStandardDrinksTotal: summary.knownStandardDrinksTotal,
        completeWeekTotalStandardDrinks:
          summary.completeWeekTotalStandardDrinks,
        completeWeekEthanolGrams: summary.completeWeekEthanolGrams,
        drinkingDays: summary.drinkingDays,
        alcoholFreeDays: summary.alcoholFreeDays,
        averageDrinksPerDrinkingDay: summary.averageDrinksPerDrinkingDay,
        maximumDailyStandardDrinks: summary.maximumDailyStandardDrinks,
        heavyDrinkingDays: summary.heavyDrinkingDays,
        targetWeeklyStandardDrinks: summary.targetWeeklyStandardDrinks,
        targetStatus: summary.targetStatus,
        baselineAverageWeeklyDrinks: summary.baselineAverageWeeklyDrinks,
        reductionFromBaselinePercent: summary.reductionFromBaselinePercent,
        whoWindowComplete: summary.whoWindowComplete,
        whoRiskRank: summary.whoRiskRank,
        whoRiskRankChange: summary.whoRiskRankChange,
        whoTwoLevelReduction: summary.whoTwoLevelReduction,
      },
    });
  }

  const updated = await tx.weeklyAssessment.update({
    where: {
      id: assessment.id,
    },
    data: {
      authoritativeRevisionId: revision.id,
      completionStatus: request.completionIntent,
      updatedByUserId: patientId,
    },
    include: {
      authoritativeRevision: {
        select: {
          id: true,
          revisionNumber: true,
          completionStatus: true,
          submissionClassification: true,
          submittedAt: true,
          sourceDraftVersion: true,
        },
      },
    },
  });

  const recomputation = await recomputePatientMonitoringFromPeriod({
    tx,
    clock,
    patientId,
    periodId: period.id,
    authoritativeTrigger:
      submissionClassification === 'HISTORICAL_BACKFILL'
        ? 'HISTORICAL_BACKFILL'
        : 'CURRENT_PATIENT_SUBMISSION',
    actorId: patientId,
    requestId,
  });

  await reconcileEngagementForPatient({
    tx,
    clock,
    patientId,
    actorId: patientId,
    requestId,
  });

  await tx.auditEvent.create({
    data: {
      actorId: patientId,
      action:
        submissionClassification === 'HISTORICAL_BACKFILL'
          ? 'WEEKLY_ASSESSMENT_BACKFILLED'
          : 'WEEKLY_ASSESSMENT_SUBMITTED',
      entityType: 'ASSESSMENT_REVISION',
      entityId: revision.id,
      patientId,
      requestId,
      ruleSetVersion: SUBJECTIVE_MONITORING_V1.ruleSetVersion,
      instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
      configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      sourceRevisionReference: revision.id,
      metadata: {
        assessmentId: assessment.id,
        revisionId: revision.id,
        revisionNumber: revision.revisionNumber,
        periodId: period.id,
        completionStatus: request.completionIntent,
        submissionClassification,
        sourceDraftVersion: assessment.draftVersion,
        recoveryGoalVersionId: goal?.id ?? null,
        preferenceVersionId: preference?.id ?? null,
        evaluationIds: recomputation.evaluationIds,
      },
    },
  });

  return projectCheckInState({
    availability:
      submissionClassification === 'HISTORICAL_BACKFILL'
        ? 'HISTORICAL'
        : periodAvailability(period, now),
    period,
    assessment: updated,
    context: {
      period,
      goal,
      preference,
    },
    safety,
    now,
  });
}
