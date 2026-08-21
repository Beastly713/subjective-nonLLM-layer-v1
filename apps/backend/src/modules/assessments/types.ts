import type { Prisma } from '../../generated/prisma/client.js';

export type AssessmentDatabase = Pick<
  Prisma.TransactionClient,
  | 'weeklyAssessment'
  | 'scheduledPeriod'
  | 'monitoringScheduleVersion'
  | 'profilePreferenceVersion'
  | 'recoveryGoalVersion'
  | 'reductionBaselineRevision'
  | 'safetyCase'
  | 'safetyEvaluationResult'
>;

export type AssessmentPeriodRecord = {
  id: string;
  scheduleVersionId: string;
  monitoringTimezone: string;
  periodStartAt: Date;
  periodEndAt: Date;
  openAt: Date;
  originalDueAt: Date;
  effectiveDueAt: Date;
  version: number;
  scheduleVersion: { version: number };
};

export type AssessmentContext = {
  period: AssessmentPeriodRecord;
  goal: Awaited<
    ReturnType<
      (typeof import('../profiles/period-context.js'))['resolveRecoveryGoalForPeriod']
    >
  >;
  preference: Awaited<
    ReturnType<
      (typeof import('../profiles/period-context.js'))['resolvePreferencesForPeriod']
    >
  >;
};
