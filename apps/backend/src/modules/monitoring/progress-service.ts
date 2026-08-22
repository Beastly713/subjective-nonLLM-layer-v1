import {
  PatientProgressResponseSchema,
  type PatientProgressResponse,
} from '@aud-subjective/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { loadPatientSafetyProjection } from '../safety/projections.js';
import { resolveRecoveryGoalForPeriod } from '../profiles/period-context.js';
import type { Clock } from '../../shared/clock/clock.js';

type Tx = Prisma.TransactionClient;

const PROGRESS_WINDOW_SIZE = 8;

function numberValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function itemValue(
  responses: ReadonlyArray<{
    itemId: string;
    integerValue: number | null;
  }>,
  itemId: string,
) {
  return responses.find((response) => response.itemId === itemId)?.integerValue ?? null;
}

export async function readPatientProgress(
  tx: Tx,
  clock: Clock,
  patientId: string,
): Promise<PatientProgressResponse> {
  const now = clock.now();
  const periods = await tx.scheduledPeriod.findMany({
    where: { patientId, periodStartAt: { lte: now } },
    orderBy: [{ periodStartAt: 'desc' }, { id: 'desc' }],
    take: PROGRESS_WINDOW_SIZE,
  });
  const orderedPeriods = [...periods].reverse();
  const periodIds = orderedPeriods.map((period) => period.id);

  const [assessments, summaries, safety] = await Promise.all([
    periodIds.length === 0
      ? []
      : tx.weeklyAssessment.findMany({
          where: {
            patientId,
            scheduledPeriodId: { in: periodIds },
            authoritativeRevisionId: { not: null },
          },
          include: {
            authoritativeRevision: { include: { itemResponses: true } },
          },
        }),
    periodIds.length === 0
      ? []
      : tx.weeklyConsumptionSummary.findMany({
          where: { patientId, scheduledPeriodId: { in: periodIds } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
    loadPatientSafetyProjection(tx, patientId),
  ]);

  const assessmentByPeriod = new Map(
    assessments.map((assessment) => [assessment.scheduledPeriodId, assessment]),
  );
  const summaryByRevision = new Map<string, (typeof summaries)[number]>();
  for (const summary of summaries) {
    if (!summaryByRevision.has(summary.assessmentRevisionId)) {
      summaryByRevision.set(summary.assessmentRevisionId, summary);
    }
  }

  const points = await Promise.all(
    orderedPeriods.map(async (period) => {
      const assessment = assessmentByPeriod.get(period.id);
      const revision = assessment?.authoritativeRevision ?? null;
      const goal = await resolveRecoveryGoalForPeriod(tx, patientId, period);
      const completionStatus = revision?.completionStatus ?? null;
      const submissionClassification = revision?.submissionClassification ?? null;
      const consumption = revision
        ? summaryByRevision.get(revision.id)
        : undefined;

      return {
        periodId: period.id,
        periodStartAt: period.periodStartAt.toISOString(),
        periodEndAt: period.periodEndAt.toISOString(),
        status:
          completionStatus === 'COMPLETE'
            ? ('COMPLETE' as const)
            : completionStatus === 'PARTIAL'
              ? ('PARTIAL' as const)
              : ('MISSING' as const),
        goal: goal?.goal ?? null,
        revisionNumber: revision?.revisionNumber ?? null,
        revisionId: revision?.id ?? null,
        submittedAt: revision?.submittedAt.toISOString() ?? null,
        submissionClassification:
          submissionClassification === 'CURRENT' ||
          submissionClassification === 'LATE_CURRENT' ||
          submissionClassification === 'HISTORICAL_BACKFILL' ||
          submissionClassification === 'PATIENT_CORRECTION' ||
          submissionClassification === 'STAFF_CORRECTION'
            ? submissionClassification
            : null,
        corrected:
          submissionClassification === 'PATIENT_CORRECTION' ||
          submissionClassification === 'STAFF_CORRECTION',
        answers: {
          craving: revision ? itemValue(revision.itemResponses, 'R3') : null,
          recoveryConfidence: revision
            ? itemValue(revision.itemResponses, 'P1')
            : null,
          moodDifficulty: revision ? itemValue(revision.itemResponses, 'R2') : null,
        },
        consumption:
          consumption && goal?.goal === 'REDUCTION'
            ? {
                knownStandardDrinks: numberValue(
                  consumption.knownStandardDrinksTotal,
                ) ?? 0,
                completeWeekTotalStandardDrinks: numberValue(
                  consumption.completeWeekTotalStandardDrinks,
                ),
                coverageRatio: numberValue(consumption.coverageRatio) ?? 0,
                observedDayCount: consumption.observedDayCount,
                unknownDayCount: consumption.unknownDayCount,
                targetWeeklyStandardDrinks: numberValue(
                  consumption.targetWeeklyStandardDrinks,
                ),
                targetStatus: consumption.targetStatus,
              }
            : null,
      };
    }),
  );

  const complete = points.filter((point) => point.status === 'COMPLETE').length;
  const partial = points.filter((point) => point.status === 'PARTIAL').length;
  const missing = points.filter((point) => point.status === 'MISSING').length;
  const currentGoal = [...points].reverse().find((point) => point.goal)?.goal ?? null;

  return PatientProgressResponseSchema.parse({
    patientId,
    windowSize: PROGRESS_WINDOW_SIZE,
    points,
    summary: { complete, partial, missing, currentGoal },
    safety,
  });
}

export { PROGRESS_WINDOW_SIZE };
