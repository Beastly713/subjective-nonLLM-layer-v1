import type { Prisma } from '../../generated/prisma/client.js';
import {
  AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
  AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
} from '../../policy/instruments/aud-weekly-checkin-v1.js';
import { SUBJECTIVE_MONITORING_V1 } from '../../policy/subjective-monitoring-v1.js';
import {
  heavyDayThresholdTenths,
  standardDrinksToEthanolGrams,
} from '../consumption/reduction-domain.js';
import { evaluateWeeklyAssessment } from './domain/evaluate-weekly-assessment.js';
import type {
  EvaluateWeeklyAssessmentInput,
  HistoricalWeeklyObservation,
  ReductionWeeklySummaryInput,
  WeeklyAnswers,
  WeeklyEvaluationResult,
} from './types.js';

type Tx = Prisma.TransactionClient;

function asNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function round(value: number, decimalPlaces = 4) {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

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
      if (
        response.itemId === 'R1' ||
        response.itemId === 'R2' ||
        response.itemId === 'R3' ||
        response.itemId === 'R4' ||
        response.itemId === 'R5' ||
        response.itemId === 'P1' ||
        response.itemId === 'P2' ||
        response.itemId === 'P3' ||
        response.itemId === 'P4' ||
        response.itemId === 'P5'
      ) {
        (answers as Record<string, number | boolean | undefined>)[response.itemId] =
          response.integerValue;
      }
    }
  }
  return answers;
}

function useStatus(answers: WeeklyAnswers) {
  if (answers.U1 === true) return 'POSITIVE' as const;
  if (answers.U1 === false) return 'NEGATIVE' as const;
  return 'UNKNOWN' as const;
}

function summaryInputFromRow(
  row: {
    observedDayCount: number;
    unknownDayCount: number;
    coverageRatio: unknown;
    knownStandardDrinksTotal: unknown;
    completeWeekTotalStandardDrinks: unknown;
    completeWeekEthanolGrams: unknown;
    drinkingDays: number;
    alcoholFreeDays: number | null;
    averageDrinksPerDrinkingDay: unknown;
    maximumDailyStandardDrinks: unknown;
    heavyDrinkingDays: number;
    targetWeeklyStandardDrinks: unknown;
    targetStatus: 'MET' | 'NOT_MET' | 'UNRESOLVED';
    baselineAverageWeeklyDrinks: unknown;
    reductionFromBaselinePercent: unknown;
    whoWindowComplete: boolean;
    whoRiskRank: number | null;
    whoRiskRankChange: number | null;
    whoTwoLevelReduction: boolean | null;
  },
  days?: Array<{
    localDate: Date;
    status: 'KNOWN_ZERO' | 'KNOWN_QUANTITY' | 'UNKNOWN';
    standardDrinks: unknown;
    ethanolGrams: unknown;
  }>,
): ReductionWeeklySummaryInput {
  return {
    observedDayCount: row.observedDayCount,
    unknownDayCount: row.unknownDayCount,
    coverageRatio: Number(row.coverageRatio),
    knownStandardDrinksTotal: Number(row.knownStandardDrinksTotal),
    completeWeekTotalStandardDrinks: asNumber(row.completeWeekTotalStandardDrinks),
    completeWeekEthanolGrams: asNumber(row.completeWeekEthanolGrams),
    drinkingDays: row.drinkingDays,
    alcoholFreeDays: row.alcoholFreeDays,
    averageDrinksPerDrinkingDay: asNumber(row.averageDrinksPerDrinkingDay),
    maximumDailyStandardDrinks: asNumber(row.maximumDailyStandardDrinks),
    heavyDrinkingDays: row.heavyDrinkingDays,
    targetWeeklyStandardDrinks: asNumber(row.targetWeeklyStandardDrinks),
    targetStatus: row.targetStatus,
    baselineAverageWeeklyDrinks: asNumber(row.baselineAverageWeeklyDrinks),
    reductionFromBaselinePercent: asNumber(row.reductionFromBaselinePercent),
    whoWindowComplete: row.whoWindowComplete,
    whoRiskRank: row.whoRiskRank,
    whoRiskRankChange: row.whoRiskRankChange,
    whoTwoLevelReduction: row.whoTwoLevelReduction,
    ...(days
      ? {
          days: days.map((day) => ({
            localDate: dateKey(day.localDate),
            status: day.status,
            standardDrinks: asNumber(day.standardDrinks),
            ethanolGrams: asNumber(day.ethanolGrams),
          })),
        }
      : {}),
  };
}

export async function loadHistoricalWeeklyObservations(
  tx: Tx,
  patientId: string,
  periodStartAt: Date,
): Promise<HistoricalWeeklyObservation[]> {
  const periods = await tx.scheduledPeriod.findMany({
    where: { patientId, periodStartAt: { lt: periodStartAt } },
    orderBy: { periodStartAt: 'asc' },
  });
  if (periods.length === 0) return [];
  const periodIds = periods.map((period) => period.id);
  const assessments = await tx.weeklyAssessment.findMany({
    where: {
      patientId,
      scheduledPeriodId: { in: periodIds },
      instrumentId: AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
      instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
      authoritativeRevisionId: { not: null },
    },
    include: {
      authoritativeRevision: { include: { itemResponses: true } },
    },
  });
  const revisionIds = assessments
    .map((assessment) => assessment.authoritativeRevision?.id)
    .filter((id): id is string => Boolean(id));
  const [summaries, consumptionDays, evaluations] = await Promise.all([
    tx.weeklyConsumptionSummary.findMany({
      where: { assessmentRevisionId: { in: revisionIds } },
    }),
    tx.alcoholConsumptionDay.findMany({
      where: { assessmentRevisionId: { in: revisionIds } },
      orderBy: { localDate: 'asc' },
    }),
    tx.assessmentEvaluation.findMany({
      where: {
        assessmentRevisionId: { in: revisionIds },
        lifecycle: 'ACTIVE',
      },
      include: { aggregateContext: true },
    }),
  ]);
  const assessmentByPeriod = new Map(
    assessments.map((assessment) => [assessment.scheduledPeriodId, assessment]),
  );
  const summaryByRevision = new Map(
    summaries.map((summary) => [summary.assessmentRevisionId, summary]),
  );
  const daysByRevision = new Map<string, typeof consumptionDays>();
  for (const day of consumptionDays) {
    const existing = daysByRevision.get(day.assessmentRevisionId) ?? [];
    existing.push(day);
    daysByRevision.set(day.assessmentRevisionId, existing);
  }
  const aggregateByRevision = new Map(
    evaluations
      .filter((evaluation) => evaluation.aggregateContext)
      .map((evaluation) => [
        evaluation.assessmentRevisionId,
        evaluation.aggregateContext!,
      ]),
  );

  return periods.map((period) => {
    const assessment = assessmentByPeriod.get(period.id);
    const revision = assessment?.authoritativeRevision;
    if (!revision) {
      return {
        periodId: period.id,
        periodStartAt: period.periodStartAt,
        periodEndAt: period.periodEndAt,
        authoritative: false,
        answers: null,
        useStatus: 'UNKNOWN' as const,
        riskScore: null,
        rawProtectionScore: null,
        recoveryProgress: null,
        consumption: null,
      };
    }
    const answers = answersFromResponses(revision.itemResponses);
    const summary = summaryByRevision.get(revision.id);
    const days = daysByRevision.get(revision.id);
    const aggregate = aggregateByRevision.get(revision.id);
    return {
      periodId: period.id,
      periodStartAt: period.periodStartAt,
      periodEndAt: period.periodEndAt,
      authoritative: true,
      answers,
      useStatus: useStatus(answers),
      riskScore: aggregate?.riskScore ?? null,
      rawProtectionScore: aggregate?.rawProtectionScore ?? null,
      recoveryProgress: aggregate?.recoveryProgress ?? null,
      consumption: summary
        ? summaryInputFromRow(summary, days)
        : null,
    };
  });
}

function whoRank(ethanolGrams: number, thresholdProfile: 'LOWER_THRESHOLD' | 'HIGHER_THRESHOLD') {
  const daily = ethanolGrams / 28;
  if (daily === 0) return 0;
  if (thresholdProfile === 'HIGHER_THRESHOLD') {
    if (daily <= 40) return 1;
    if (daily <= 60) return 2;
    if (daily <= 100) return 3;
    return 4;
  }
  if (daily <= 20) return 1;
  if (daily <= 40) return 2;
  if (daily <= 60) return 3;
  return 4;
}

function knownDays(
  days: ReadonlyArray<{
    localDate: string;
    status: 'KNOWN_ZERO' | 'KNOWN_QUANTITY' | 'UNKNOWN';
    standardDrinks: number | null;
    ethanolGrams: number | null;
  }>,
) {
  return days.length === 7 && days.every((day) => day.status !== 'UNKNOWN');
}

function whoContext(
  currentDays: ReductionWeeklySummaryInput['days'],
  history: readonly HistoricalWeeklyObservation[],
  currentPeriodStartAt: Date,
  thresholdProfile: 'LOWER_THRESHOLD' | 'HIGHER_THRESHOLD',
  baselineDays: ReductionWeeklySummaryInput['days'] | undefined,
) {
  const previous = history.slice(-3);
  const adjacent = previous.every((item, index) => {
    const nextStart = index === previous.length - 1
      ? currentPeriodStartAt
      : previous[index + 1]?.periodStartAt;
    return Boolean(nextStart && item.periodEndAt.getTime() === nextStart.getTime());
  });
  const complete =
    currentDays !== undefined &&
    previous.length === 3 &&
    adjacent &&
    knownDays(currentDays) &&
    previous.every((item) => item.consumption?.days && knownDays(item.consumption.days));
  if (!complete || !currentDays) {
    return {
      whoWindowComplete: false,
      whoRiskRank: null,
      whoRiskRankChange: null,
      whoTwoLevelReduction: null,
    };
  }
  const currentTotal = [
    ...previous.flatMap((item) => item.consumption!.days!),
    ...currentDays,
  ].reduce((total, day) => total + (day.ethanolGrams ?? 0), 0);
  const currentRank = whoRank(currentTotal, thresholdProfile);
  const baselineComplete = Boolean(baselineDays && baselineDays.length === 28 && baselineDays.every((day) => day.status !== 'UNKNOWN'));
  const baselineTotal = baselineComplete
    ? baselineDays!.reduce((total, day) => total + (day.ethanolGrams ?? 0), 0)
    : null;
  const change = baselineTotal === null
    ? null
    : whoRank(baselineTotal, thresholdProfile) - currentRank;
  return {
    whoWindowComplete: true,
    whoRiskRank: currentRank,
    whoRiskRankChange: change,
    whoTwoLevelReduction: change === null ? null : change >= 2,
  };
}

export function finalizeReductionWeek(input: {
  dates: readonly string[];
  periodStartAt: Date;
  draftDays: ReadonlyArray<{
    localDate: string;
    status: 'KNOWN_ZERO' | 'KNOWN_QUANTITY' | 'UNKNOWN';
    standardDrinks?: number | null;
  }>;
  targetWeeklyStandardDrinks: number | null;
  baselineAverageWeeklyDrinks: number | null;
  thresholdProfile: 'LOWER_THRESHOLD' | 'HIGHER_THRESHOLD';
  baselineDays?: ReductionWeeklySummaryInput['days'];
  history: readonly HistoricalWeeklyObservation[];
}) {
  const draftByDate = new Map(input.draftDays.map((day) => [day.localDate, day]));
  const days = input.dates.map((localDate) => {
    const day = draftByDate.get(localDate);
    if (!day || day.status === 'UNKNOWN') {
      return {
        localDate,
        status: 'UNKNOWN' as const,
        standardDrinks: null,
        ethanolGrams: null,
      };
    }
    const standardDrinks = day.status === 'KNOWN_ZERO' ? 0 : day.standardDrinks ?? 0;
    return {
      localDate,
      status: day.status,
      standardDrinks,
      ethanolGrams: standardDrinks === 0 ? 0 : standardDrinksToEthanolGrams(standardDrinks),
    };
  });
  const known = days.filter((day) => day.status !== 'UNKNOWN');
  const quantities = known.map((day) => day.standardDrinks ?? 0);
  const observedDayCount = known.length;
  const unknownDayCount = days.length - observedDayCount;
  const knownTotal = round(quantities.reduce((total, value) => total + value, 0));
  const drinkingDays = quantities.filter((value) => value > 0).length;
  const complete = observedDayCount === 7;
  const completeTotal = complete ? knownTotal : null;
  const completeEthanol = complete
    ? round(days.reduce((total, day) => total + (day.ethanolGrams ?? 0), 0))
    : null;
  const target = input.targetWeeklyStandardDrinks;
  const targetStatus: ReductionWeeklySummaryInput['targetStatus'] = target === null
    ? 'UNRESOLVED'
    : complete
      ? knownTotal <= target ? 'MET' : 'NOT_MET'
      : knownTotal > target ? 'NOT_MET' : 'UNRESOLVED';
  const reductionFromBaselinePercent =
    complete &&
    input.baselineAverageWeeklyDrinks !== null &&
    input.baselineAverageWeeklyDrinks > 0
      ? round(
          ((input.baselineAverageWeeklyDrinks - knownTotal) /
            input.baselineAverageWeeklyDrinks) *
            100,
        )
      : null;
  const who = whoContext(
    days,
    input.history,
    input.periodStartAt,
    input.thresholdProfile,
    input.baselineDays,
  );
  return {
    days,
    summary: {
      observedDayCount,
      unknownDayCount,
      coverageRatio: observedDayCount / 7,
      knownStandardDrinksTotal: knownTotal,
      completeWeekTotalStandardDrinks: completeTotal,
      completeWeekEthanolGrams: completeEthanol,
      drinkingDays,
      alcoholFreeDays: complete ? 7 - drinkingDays : null,
      averageDrinksPerDrinkingDay:
        drinkingDays === 0
          ? complete
            ? 0
            : null
          : round(knownTotal / drinkingDays),
      maximumDailyStandardDrinks:
        quantities.length === 0 ? null : Math.max(...quantities),
      heavyDrinkingDays: quantities.filter(
        (value) => value * 10 >= heavyDayThresholdTenths(input.thresholdProfile),
      ).length,
      targetWeeklyStandardDrinks: target,
      targetStatus,
      baselineAverageWeeklyDrinks: input.baselineAverageWeeklyDrinks,
      reductionFromBaselinePercent,
      ...who,
    } satisfies ReductionWeeklySummaryInput,
  };
}

export async function persistMonitoringEvaluation(input: {
  tx: Tx;
  evaluationInput: EvaluateWeeklyAssessmentInput;
  result: WeeklyEvaluationResult;
  recoveryGoalVersionId: string | null;
  preferenceVersionId: string | null;
}) {
  const { tx, evaluationInput, result } = input;
  const json = (value: unknown) => value as Prisma.InputJsonValue;
  const evaluation = await tx.assessmentEvaluation.create({
    data: {
      patientId: evaluationInput.patientId,
      assessmentId: evaluationInput.assessmentId,
      assessmentRevisionId: evaluationInput.revisionId,
      scheduledPeriodId: evaluationInput.periodId,
      trigger: evaluationInput.trigger,
      lifecycle: 'ACTIVE',
      ruleSetVersion: SUBJECTIVE_MONITORING_V1.ruleSetVersion,
      configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
      recoveryGoalVersionId: input.recoveryGoalVersionId,
      preferenceVersionId: input.preferenceVersionId,
      evaluatedAt: evaluationInput.evaluatedAt,
      inputSnapshot: json({
        answers: evaluationInput.answers,
        goal: evaluationInput.goal,
        preferences: evaluationInput.preferences,
        periodId: evaluationInput.periodId,
      }),
      resultSnapshot: json(result),
      derivedStateChangesSnapshot: json(result.derivedStateChanges),
      effectPlanSnapshot: json(result.effectPlan),
      candidateClinicianReasonFamilies: json(
        result.candidateClinicianReasonFamilies,
      ),
    },
  });

  await tx.stateFlagObservation.createMany({
    data: result.flags.map((flag) => ({
      patientId: evaluationInput.patientId,
      assessmentRevisionId: evaluationInput.revisionId,
      scheduledPeriodId: evaluationInput.periodId,
      evaluationId: evaluation.id,
      flagKey: flag.flagKey,
      state: flag.state,
      observedValue: flag.value === null ? Prisma.DbNull : flag.value,
      observedAt: evaluationInput.evaluatedAt,
    })),
  });

  for (const flag of result.flags) {
    await tx.currentStateFlag.upsert({
      where: {
        patientId_flagKey: {
          patientId: evaluationInput.patientId,
          flagKey: flag.flagKey,
        },
      },
      create: {
        patientId: evaluationInput.patientId,
        flagKey: flag.flagKey,
        state:
          flag.state === 'ACTIVE'
            ? 'CURRENT_ACTIVE'
            : flag.state === 'CLEAR'
              ? 'CURRENT_CLEARED'
              : 'STALE_DATA_UNAVAILABLE',
        sourceEvaluationId: evaluation.id,
        sourceRevisionId: evaluationInput.revisionId,
        sourcePeriodId: evaluationInput.periodId,
        updatedAt: evaluationInput.evaluatedAt,
      },
      update: {
        state:
          flag.state === 'ACTIVE'
            ? 'CURRENT_ACTIVE'
            : flag.state === 'CLEAR'
              ? 'CURRENT_CLEARED'
              : 'STALE_DATA_UNAVAILABLE',
        sourceEvaluationId: evaluation.id,
        sourceRevisionId: evaluationInput.revisionId,
        sourcePeriodId: evaluationInput.periodId,
        updatedAt: evaluationInput.evaluatedAt,
      },
    });
  }

  await tx.aggregateContextRecord.create({
    data: {
      patientId: evaluationInput.patientId,
      assessmentRevisionId: evaluationInput.revisionId,
      scheduledPeriodId: evaluationInput.periodId,
      evaluationId: evaluation.id,
      riskScore: result.aggregate.riskScore,
      rawProtectionScore: result.aggregate.rawProtectionScore,
      recoveryProgress: result.aggregate.recoveryProgress,
      riskTag: result.aggregate.riskTag,
      protectionTag: result.aggregate.protectionTag,
      operationalProtectionDomainsObserved:
        result.aggregate.operationalProtectionDomainsObserved,
      operationalProtectionDomainsTotal:
        result.aggregate.operationalProtectionDomainsTotal,
      protectionCoverageRatio: result.aggregate.protectionCoverageRatio,
      minimumPossibleProtection: result.aggregate.minimumPossibleProtection,
      maximumPossibleProtection: result.aggregate.maximumPossibleProtection,
      interactionTags: json(result.aggregate.interactionTags),
    },
  });
  await tx.longitudinalFeatureRecord.create({
    data: {
      patientId: evaluationInput.patientId,
      assessmentRevisionId: evaluationInput.revisionId,
      scheduledPeriodId: evaluationInput.periodId,
      evaluationId: evaluation.id,
      cravingDelta: result.longitudinal.cravingDelta,
      confidenceDelta: result.longitudinal.confidenceDelta,
      negativeMoodDelta: result.longitudinal.negativeMoodDelta,
      riskScoreDelta: result.longitudinal.riskScoreDelta,
      rawProtectionScoreDelta: result.longitudinal.rawProtectionScoreDelta,
      recoveryProgressDelta: result.longitudinal.recoveryProgressDelta,
      persistenceStreakSnapshot: json(result.longitudinal.persistenceStreakSnapshot),
      clearanceReasonStateSnapshot: json(
        result.longitudinal.clearanceReasonStateSnapshot,
      ),
      consecutiveUse: result.longitudinal.consecutiveUse,
      recurrentUse: result.longitudinal.recurrentUse,
      useAfterStability: result.longitudinal.useAfterStability,
      trendDataValid: result.longitudinal.trendDataValid,
    },
  });

  if (result.candidatePatientInterventions.length > 0) {
    await tx.patientInterventionIntent.createMany({
      data: result.candidatePatientInterventions.map((candidate) => ({
        patientId: evaluationInput.patientId,
        assessmentRevisionId: evaluationInput.revisionId,
        scheduledPeriodId: evaluationInput.periodId,
        evaluationId: evaluation.id,
        interventionClass: candidate.interventionClass,
        sourceReasons: json(candidate.sourceReasons),
        resolverMetadata: json({ resolverPriority: candidate.resolverPriority }),
        effect: candidate.effect,
        suppressionReason: candidate.suppressionReason,
        trigger: evaluationInput.trigger,
      })),
    });
  }
  return evaluation;
}
