import type { Prisma } from '../../generated/prisma/client.js';
import { AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION } from '../../policy/instruments/aud-weekly-checkin-v1.js';
import { SUBJECTIVE_MONITORING_V1 } from '../../policy/subjective-monitoring-v1.js';
import {
  resolvePreferencesForPeriod,
  resolveRecoveryGoalForPeriod,
} from '../profiles/period-context.js';
import { loadPatientSafetyProjection } from '../safety/projections.js';
import {
  resolveContentForEvaluation,
  safetyContextFromProjection,
} from '../content/service.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { evaluateWeeklyAssessment } from '../monitoring/domain/evaluate-weekly-assessment.js';
import {
  finalizeReductionWeek,
  loadHistoricalWeeklyObservations,
  persistMonitoringEvaluationHistory,
  preferenceContextFromVersion,
  reconcileCurrentStateProjection,
  summaryInputFromRow,
} from '../monitoring/service.js';
import type {
  HistoricalWeeklyObservation,
  ReductionWeeklySummaryInput,
  WeeklyAnswers,
} from '../monitoring/types.js';
import { periodLocalDates } from './projections.js';

type Tx = Prisma.TransactionClient;

function answersFromResponses(
  responses: ReadonlyArray<{
    itemId: string;
    booleanValue: boolean | null;
    integerValue: number | null;
  }>,
): WeeklyAnswers {
  const answers: WeeklyAnswers = {};

  for (const response of responses) {
    if (response.itemId === 'U1' && response.booleanValue !== null) {
      answers.U1 = response.booleanValue;
    } else if (response.integerValue !== null) {
      (answers as Record<string, number | boolean | undefined>)[
        response.itemId
      ] = response.integerValue;
    }
  }

  return answers;
}

function daysInputFromRows(
  days: ReadonlyArray<{
    localDate: Date;
    status: 'KNOWN_ZERO' | 'KNOWN_QUANTITY' | 'UNKNOWN';
    standardDrinks: unknown;
  }>,
) {
  return days.map((day) => ({
    localDate: day.localDate.toISOString().slice(0, 10),
    status: day.status,
    standardDrinks:
      day.standardDrinks === null ? null : Number(day.standardDrinks),
  }));
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

function effectScopeForPeriod(
  _trigger:
    | 'CURRENT_PATIENT_SUBMISSION'
    | 'CURRENT_PATIENT_CORRECTION'
    | 'STAFF_CORRECTION'
    | 'HISTORICAL_BACKFILL'
    | 'ADMINISTRATIVE_RECOMPUTE'
    | 'POLICY_MIGRATION',
  periodId: string,
  latestAuthoritativePeriodId: string | null,
) {
  return periodId === latestAuthoritativePeriodId
    ? ('CURRENT' as const)
    : ('HISTORICAL' as const);
}

async function refreshReductionSummary(input: {
  tx: Tx;
  patientId: string;

  period: {
    id: string;
    periodStartAt: Date;
    periodEndAt: Date;
    monitoringTimezone: string;
  };

  revisionId: string;

  goal: Awaited<ReturnType<typeof resolveRecoveryGoalForPeriod>>;

  summary: ReductionWeeklySummaryInput | null;

  days: ReadonlyArray<{
    localDate: Date;
    status: 'KNOWN_ZERO' | 'KNOWN_QUANTITY' | 'UNKNOWN';
    standardDrinks: unknown;
    ethanolGrams: unknown;
  }>;

  history: readonly HistoricalWeeklyObservation[];
}) {
  if (!input.goal || input.goal.goal !== 'REDUCTION') {
    return null;
  }

  if (input.days.length === 0) {
    return input.summary;
  }

  if (!input.goal.baselineRevisionId) {
    return input.summary;
  }

  const baseline = await input.tx.reductionBaselineRevision.findUnique({
    where: {
      id: input.goal.baselineRevisionId,
    },
    include: {
      days: {
        orderBy: {
          localDate: 'asc',
        },
      },
    },
  });

  if (!baseline) {
    return input.summary;
  }

  const finalized = finalizeReductionWeek({
    dates: periodLocalDates(input.period),
    periodStartAt: input.period.periodStartAt,
    draftDays: daysInputFromRows(input.days),
    targetWeeklyStandardDrinks:
      input.goal.targetWeeklyStandardDrinks === null
        ? null
        : Number(input.goal.targetWeeklyStandardDrinks),
    baselineAverageWeeklyDrinks:
      input.goal.baselineAverageWeeklyDrinks === null
        ? null
        : Number(input.goal.baselineAverageWeeklyDrinks),
    thresholdProfile: baseline.thresholdProfile,
    baselineDays: baselineDaysInput(baseline.days),
    history: input.history,
  });

  const summary = {
    ...finalized.summary,
    days: finalized.days,
  } satisfies ReductionWeeklySummaryInput;

  const data = {
    recoveryGoalVersionId: input.goal.id,
    baselineRevisionId: baseline.id,
    observedDayCount: summary.observedDayCount,
    unknownDayCount: summary.unknownDayCount,
    coverageRatio: summary.coverageRatio,
    knownStandardDrinksTotal: summary.knownStandardDrinksTotal,
    completeWeekTotalStandardDrinks: summary.completeWeekTotalStandardDrinks,
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
  };

  if (input.summary) {
    await input.tx.weeklyConsumptionSummary.update({
      where: {
        assessmentRevisionId: input.revisionId,
      },
      data,
    });
  } else {
    await input.tx.weeklyConsumptionSummary.create({
      data: {
        patientId: input.patientId,
        scheduledPeriodId: input.period.id,
        assessmentRevisionId: input.revisionId,
        ...data,
      },
    });
  }

  return summary;
}

export async function recomputePatientMonitoringFromPeriod(input: {
  tx: Tx;
  clock: Clock;
  patientId: string;
  periodId: string;

  authoritativeTrigger:
    | 'CURRENT_PATIENT_SUBMISSION'
    | 'CURRENT_PATIENT_CORRECTION'
    | 'STAFF_CORRECTION'
    | 'HISTORICAL_BACKFILL'
    | 'ADMINISTRATIVE_RECOMPUTE'
    | 'POLICY_MIGRATION';

  actorId?: string;
  requestId?: string;
}) {
  const { tx, clock, patientId, periodId, authoritativeTrigger } = input;

  await lockPatientForProcessing(tx, patientId);

  const changedPeriod = await tx.scheduledPeriod.findFirst({
    where: {
      id: periodId,
      patientId,
    },
  });

  if (!changedPeriod) {
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  }

  const periods = await tx.scheduledPeriod.findMany({
    where: {
      patientId,
      periodStartAt: {
        gte: changedPeriod.periodStartAt,
      },
    },
    orderBy: {
      periodStartAt: 'asc',
    },
  });

  const allPeriods = await tx.scheduledPeriod.findMany({
    where: {
      patientId,
    },
    orderBy: {
      periodStartAt: 'asc',
    },
  });

  const assessments = await tx.weeklyAssessment.findMany({
    where: {
      patientId,
      scheduledPeriodId: {
        in: allPeriods.map((period) => period.id),
      },
      instrumentId: 'AUD_WEEKLY_CHECKIN',
      instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
    },
    include: {
      authoritativeRevision: {
        include: {
          itemResponses: true,
        },
      },
    },
  });

  const assessmentByPeriod = new Map(
    assessments.map((assessment) => [assessment.scheduledPeriodId, assessment]),
  );

  const latestAuthoritativePeriodId =
    allPeriods
      .filter((period) =>
        Boolean(assessmentByPeriod.get(period.id)?.authoritativeRevision),
      )
      .at(-1)?.id ?? null;

  const revisionIds = assessments
    .map((assessment) => assessment.authoritativeRevision?.id)
    .filter((id): id is string => Boolean(id));

  const [summaries, days, safety] = await Promise.all([
    tx.weeklyConsumptionSummary.findMany({
      where: {
        assessmentRevisionId: {
          in: revisionIds,
        },
      },
    }),
    tx.alcoholConsumptionDay.findMany({
      where: {
        assessmentRevisionId: {
          in: revisionIds,
        },
      },
      orderBy: {
        localDate: 'asc',
      },
    }),
    loadPatientSafetyProjection(tx, patientId),
  ]);

  const summaryByRevision = new Map(
    summaries.map((summary) => [summary.assessmentRevisionId, summary]),
  );

  const daysByRevision = new Map<string, typeof days>();

  for (const day of days) {
    const existing = daysByRevision.get(day.assessmentRevisionId) ?? [];

    existing.push(day);

    daysByRevision.set(day.assessmentRevisionId, existing);
  }

  const history = await loadHistoricalWeeklyObservations(
    tx,
    patientId,
    changedPeriod.periodStartAt,
  );

  const evaluatedAt = clock.now();

  const evaluationIds: string[] = [];

  let createdEvaluationCount = 0;

  for (const period of periods) {
    const assessment = assessmentByPeriod.get(period.id);

    const revision = assessment?.authoritativeRevision;

    const [goal, preference] = await Promise.all([
      resolveRecoveryGoalForPeriod(tx, patientId, period),
      resolvePreferencesForPeriod(tx, patientId, period),
    ]);

    if (!assessment || !revision) {
      const previous = history.at(-1);

      history.push({
        periodId: period.id,
        periodStartAt: period.periodStartAt,
        periodEndAt: period.periodEndAt,
        authoritative: false,
        completionStatus: null,
        goal: goal?.goal ?? null,
        goalVersionId: goal?.id ?? null,
        preferenceVersionId: preference?.id ?? null,
        preferences: preferenceContextFromVersion(preference),
        answers: null,
        useStatus: 'UNKNOWN',
        riskScore: null,
        rawProtectionScore: null,
        recoveryProgress: null,
        consumption: null,

        reasonLifecycle: previous?.reasonLifecycle ?? {},

        persistenceStreakSnapshot: {},
      });

      continue;
    }

    const answers = answersFromResponses(revision.itemResponses);

    const summaryRow = summaryByRevision.get(revision.id);

    const revisionDays = daysByRevision.get(revision.id) ?? [];

    const priorConsumption = summaryRow
      ? summaryInputFromRow(summaryRow, revisionDays)
      : null;

    const consumption = await refreshReductionSummary({
      tx,
      patientId,
      period,
      revisionId: revision.id,
      goal,
      summary: priorConsumption,
      days: revisionDays,
      history,
    });

    const evaluationInput = {
      patientId,
      assessmentId: assessment.id,
      revisionId: revision.id,
      periodId: period.id,
      periodStartAt: period.periodStartAt,
      periodEndAt: period.periodEndAt,
      evaluatedAt,
      trigger: authoritativeTrigger,
      completionStatus: revision.completionStatus,
      goal: goal?.goal ?? 'UNSURE',
      goalVersionId: goal?.id ?? null,

      targetWeeklyStandardDrinks:
        goal?.targetWeeklyStandardDrinks === null ||
        goal?.targetWeeklyStandardDrinks === undefined
          ? null
          : Number(goal.targetWeeklyStandardDrinks),

      baselineAverageWeeklyDrinks:
        goal?.baselineAverageWeeklyDrinks === null ||
        goal?.baselineAverageWeeklyDrinks === undefined
          ? null
          : Number(goal.baselineAverageWeeklyDrinks),

      preferenceVersionId: preference?.id ?? null,

      preferences: {
        mutualHelpPreference: preference?.mutualHelpPreference ?? null,

        spiritualContentPreference:
          preference?.spiritualContentPreference ?? null,
      },

      answers,
      history,
      consumption,

      effectScope: effectScopeForPeriod(
        authoritativeTrigger,
        period.id,
        latestAuthoritativePeriodId,
      ),

      safety: {
        safetyState: safety.safetyState,

        requiresSafetyShell: safety.requiresSafetyShell,

        monitoringPromptPolicy: safety.monitoringPromptPolicy,

        allowedSubjectiveInterventions: safety.allowedSubjectiveInterventions,

        reassessmentDueAt: safety.reassessmentDueAt
          ? new Date(safety.reassessmentDueAt)
          : null,
      },
    } as const;

    const result = evaluateWeeklyAssessment(evaluationInput);

    const persisted = await persistMonitoringEvaluationHistory({
      tx,
      evaluationInput,
      result,
      recoveryGoalVersionId: goal?.id ?? null,
      preferenceVersionId: preference?.id ?? null,
    });

    evaluationIds.push(persisted.evaluation.id);

    if (persisted.created) {
      createdEvaluationCount += 1;
    }

    await tx.useObservationLedger.updateMany({
      where: {
        assessmentRevisionId: revision.id,
      },
      data: {
        evaluationId: persisted.evaluation.id,
      },
    });

    await resolveContentForEvaluation({
      tx,
      evaluationId: persisted.evaluation.id,
      safety: safetyContextFromProjection(safety),
      now: evaluatedAt,
    });

    history.push({
      periodId: period.id,
      periodStartAt: period.periodStartAt,
      periodEndAt: period.periodEndAt,
      authoritative: true,
      completionStatus: revision.completionStatus,
      goal: goal?.goal ?? 'UNSURE',
      goalVersionId: goal?.id ?? null,
      preferenceVersionId: preference?.id ?? null,
      preferences: preferenceContextFromVersion(preference),
      answers,
      useStatus: result.weeklyUseStatus,
      riskScore: result.aggregate.riskScore,
      rawProtectionScore: result.aggregate.rawProtectionScore,
      recoveryProgress: result.aggregate.recoveryProgress,
      consumption,
      reasonLifecycle: result.longitudinal.clearanceReasonStateSnapshot,
      persistenceStreakSnapshot: result.longitudinal.persistenceStreakSnapshot,
    });
  }

  await reconcileCurrentStateProjection(tx, patientId, evaluatedAt);

  if (createdEvaluationCount > 0) {
    await tx.auditEvent.create({
      data: {
        actorId: input.actorId ?? patientId,

        action: 'WEEKLY_MONITORING_RECOMPUTED',

        entityType: 'PATIENT_MONITORING',

        entityId: patientId,

        patientId,

        requestId: input.requestId ?? null,

        ruleSetVersion: SUBJECTIVE_MONITORING_V1.ruleSetVersion,

        configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,

        metadata: {
          periodId,
          trigger: authoritativeTrigger,
          evaluationIds,
          createdEvaluationCount,
        },
      },
    });
  }

  return {
    evaluationIds,
    createdEvaluationCount,
  };
}
