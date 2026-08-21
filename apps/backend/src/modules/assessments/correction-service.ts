import {
  WeeklyAssessmentDraftAnswersSchema,
  WeeklyAlcoholDayInputSetSchema,
  type CheckInMutationReceipt,
  type CheckInStateResponse,
  type StaffWeeklyAssessmentCorrectionRequest,
  type WeeklyAssessmentCorrectionRequest,
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
import {
  resolvePreferencesForPeriod,
  resolveRecoveryGoalForPeriod,
} from '../profiles/period-context.js';
import { loadPatientSafetyProjection } from '../safety/projections.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import {
  finalizeReductionWeek,
  loadHistoricalWeeklyObservations,
  revokeEvaluationsForRevision,
} from '../monitoring/service.js';
import {
  periodAvailability,
  periodLocalDates,
  projectCheckInState,
} from './projections.js';
import type { AssessmentPeriodRecord } from './types.js';
import { recomputePatientMonitoringFromPeriod } from './recompute-service.js';
import { hasNewerAuthoritativeAssessment } from './service.js';

type Tx = Prisma.TransactionClient;

function notFound(): never {
  throw new DomainError(
    404,
    'NOT_FOUND',
    'The requested resource was not found.',
  );
}

function allRequiredAnswersPresent(answers: object) {
  return [
    'U1',
    'R1',
    'R2',
    'R3',
    'R4',
    'R5',
    'P1',
    'P2',
    'P3',
    'P4',
    'P5',
  ].every((itemId) => Object.prototype.hasOwnProperty.call(answers, itemId));
}

function responseRows(answers: object) {
  const values = answers as Record<string, unknown>;

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

  return items.flatMap(([itemId, itemKey]) => {
    if (!Object.prototype.hasOwnProperty.call(values, itemId)) {
      return [];
    }

    const value = values[itemId];

    return [
      {
        itemId,
        itemKey,
        ...(itemId === 'U1'
          ? { booleanValue: value as boolean }
          : { integerValue: value as number }),
        instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
        wordingVersion: AUD_WEEKLY_CHECKIN_WORDING_VERSION,
        scaleVersion: AUD_WEEKLY_CHECKIN_SCALE_VERSION,
      },
    ];
  });
}

function reductionConflict(
  answers: { U1?: boolean | undefined },
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

  return (
    (answers.U1 === false && hasPositiveQuantity) ||
    (answers.U1 === true && allKnownZero)
  );
}

function enforcePatientSafety(
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

export async function correctWeeklyAssessment(input: {
  tx: Tx;
  clock: Clock;
  patientId: string;
  assessmentId: string;
  request:
    WeeklyAssessmentCorrectionRequest | StaffWeeklyAssessmentCorrectionRequest;
  requestId: string;
  actorId: string;
  actorType: 'PATIENT' | 'CLINICIAN';
}): Promise<CheckInStateResponse | CheckInMutationReceipt> {
  const {
    tx,
    clock,
    patientId,
    assessmentId,
    request,
    requestId,
    actorId,
    actorType,
  } = input;

  if (actorType === 'CLINICIAN') {
    const assignment = await tx.clinicianPatientAssignment.findFirst({
      where: {
        clinicianUserId: actorId,
        patientId,
        endedAt: null,
      },
      select: { id: true },
    });

    if (!assignment) notFound();
  }

  await lockPatientForProcessing(tx, patientId);

  if (actorType === 'CLINICIAN') {
    const assignment = await tx.clinicianPatientAssignment.findFirst({
      where: {
        clinicianUserId: actorId,
        patientId,
        endedAt: null,
      },
      select: { id: true },
    });

    if (!assignment) notFound();
  }

  const assessment = await tx.weeklyAssessment.findFirst({
    where: {
      id: assessmentId,
      patientId,
      instrumentId: AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
      instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
    },
    include: {
      scheduledPeriod: {
        include: {
          scheduleVersion: {
            select: { version: true },
          },
        },
      },
      authoritativeRevision: {
        include: {
          itemResponses: true,
        },
      },
    },
  });

  if (!assessment || !assessment.authoritativeRevision) {
    notFound();
  }

  const previousRevision = assessment.authoritativeRevision;

  if (
    previousRevision.id !== request.expectedAuthoritativeRevisionId ||
    previousRevision.revisionNumber !== request.expectedRevisionNumber
  ) {
    throw new DomainError(
      409,
      'VERSION_CONFLICT',
      'The authoritative check-in changed before this correction.',
    );
  }

  const period = assessment.scheduledPeriod as AssessmentPeriodRecord;

  const now = clock.now();

  const [goal, preference, safety] = await Promise.all([
    resolveRecoveryGoalForPeriod(tx, patientId, period),
    resolvePreferencesForPeriod(tx, patientId, period),
    loadPatientSafetyProjection(tx, patientId),
  ]);

  if (actorType === 'PATIENT') {
    enforcePatientSafety(safety, now);
  }

  const answers = WeeklyAssessmentDraftAnswersSchema.parse(request.answers);

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
      'All answered items require a COMPLETE correction intent.',
    );
  }

  const days = WeeklyAlcoholDayInputSetSchema.parse(
    request.weeklyConsumptionDays ?? [],
  );

  const expectedDates = new Set(periodLocalDates(period));

  if (days.some((day) => !expectedDates.has(day.localDate))) {
    throw new DomainError(
      400,
      'VALIDATION_ERROR',
      'Every weekly consumption day must belong to the persisted assessment period.',
    );
  }

  if (goal?.goal !== 'REDUCTION' && days.length > 0) {
    throw new DomainError(
      400,
      'VALIDATION_ERROR',
      'Weekly consumption days are only available for a period-effective reduction goal.',
    );
  }

  const historical = await loadHistoricalWeeklyObservations(
    tx,
    patientId,
    period.periodStartAt,
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

  if (goal?.goal === 'REDUCTION') {
    if (!goal.baselineRevisionId) {
      throw new DomainError(
        409,
        'REDUCTION_BASELINE_REQUIRED',
        'A confirmed reduction baseline is required before this correction can be submitted.',
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
      draftDays: days,
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
  }

  await revokeEvaluationsForRevision(tx, previousRevision.id, now);

  const classification =
    actorType === 'PATIENT' ? 'PATIENT_CORRECTION' : 'STAFF_CORRECTION';

  const revision = await tx.assessmentRevision.create({
    data: {
      assessmentId: assessment.id,
      revisionNumber: previousRevision.revisionNumber + 1,
      completionStatus: request.completionIntent,
      sourceDraftVersion: null,
      submittedAt: now,
      submittedBy: actorType,
      submittedByUserId: actorId,
      supersedesRevisionId: previousRevision.id,
      submissionClassification: classification,
      instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
      wordingVersion: AUD_WEEKLY_CHECKIN_WORDING_VERSION,
      ruleSetVersion: SUBJECTIVE_MONITORING_V1.ruleSetVersion,
      configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      provenance: {
        source:
          actorType === 'PATIENT' ? 'PATIENT_CORRECTION' : 'STAFF_CORRECTION',
        actorId,
        previousRevisionId: previousRevision.id,
        periodId: period.id,
        trigger:
          actorType === 'PATIENT'
            ? 'CURRENT_PATIENT_CORRECTION'
            : 'STAFF_CORRECTION',
        ...(actorType === 'CLINICIAN'
          ? {
              reason: (request as StaffWeeklyAssessmentCorrectionRequest)
                .reason,
            }
          : {}),
      },
    },
  });

  const rows = responseRows(answers).map((row) => ({
    ...row,
    assessmentRevisionId: revision.id,
  }));

  if (rows.length > 0) {
    await tx.assessmentItemResponse.createMany({
      data: rows,
    });
  }

  await tx.useObservationLedger.create({
    data: {
      patientId,
      assessmentId: assessment.id,
      assessmentRevisionId: revision.id,
      scheduledPeriodId: period.id,
      source: 'WEEKLY_ASSESSMENT',
      periodStartAt: period.periodStartAt,
      periodEndAt: period.periodEndAt,
      status:
        answers.U1 === true
          ? 'POSITIVE'
          : answers.U1 === false
            ? 'NEGATIVE'
            : 'UNKNOWN',
      observedAt: now,
      provenance: {
        itemId: 'U1',
        instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
      },
      evaluationId: null,
    },
  });

  if (finalizedReduction && goal && baseline) {
    await tx.alcoholConsumptionDay.createMany({
      data: finalizedReduction.days.map((day) => ({
        patientId,
        scheduledPeriodId: period.id,
        assessmentRevisionId: revision.id,
        localDate: new Date(`${day.localDate}T00:00:00.000Z`),
        status: day.status,
        standardDrinks: day.standardDrinks,
        ethanolGrams: day.ethanolGrams,
        source: 'WEEKLY_RECALL_CORRECTION',
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
        baselineRevisionId: baseline.id,
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
      updatedByUserId: actorId,
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
      actorType === 'PATIENT'
        ? 'CURRENT_PATIENT_CORRECTION'
        : 'STAFF_CORRECTION',
    actorId,
    requestId,
  });

  await tx.auditEvent.create({
    data: {
      actorId,
      actorRole: actorType === 'PATIENT' ? 'PATIENT' : 'CLINICIAN',
      action:
        actorType === 'PATIENT'
          ? 'WEEKLY_ASSESSMENT_CORRECTED'
          : 'WEEKLY_ASSESSMENT_STAFF_CORRECTED',
      entityType: 'ASSESSMENT_REVISION',
      entityId: revision.id,
      patientId,
      requestId,
      reason:
        actorType === 'CLINICIAN'
          ? (request as StaffWeeklyAssessmentCorrectionRequest).reason
          : null,
      ruleSetVersion: SUBJECTIVE_MONITORING_V1.ruleSetVersion,
      instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
      configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      sourceRevisionReference: previousRevision.id,
      metadata: {
        assessmentId: assessment.id,
        previousRevisionId: previousRevision.id,
        newRevisionId: revision.id,
        periodId: period.id,
        submissionClassification: classification,
        trigger:
          actorType === 'PATIENT'
            ? 'CURRENT_PATIENT_CORRECTION'
            : 'STAFF_CORRECTION',
        completionStatus: request.completionIntent,
        evaluationIds: recomputation.evaluationIds,
      },
    },
  });

  const historicalCorrection =
    actorType === 'PATIENT'
      ? await hasNewerAuthoritativeAssessment(tx, patientId, period)
      : false;

  if (actorType === 'PATIENT') {
    return projectCheckInState({
      availability: historicalCorrection
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

  return {
    assessmentId: assessment.id,
    periodId: period.id,
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    submissionClassification: classification,
    evaluationIds: recomputation.evaluationIds,
  };
}
