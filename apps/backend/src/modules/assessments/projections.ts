import { DateTime } from 'luxon';
import {
  CheckInStateResponseSchema,
  WeeklyAssessmentDraftAnswersSchema,
  WeeklyAssessmentDraftProjectionSchema,
  SubmittedWeeklyAssessmentProjectionSchema,
  WeeklyCheckInGoalContextSchema,
  WeeklyCheckInInstrumentProjectionSchema,
  WeeklyCheckInPeriodProjectionSchema,
  WeeklyCheckInPreferenceContextSchema,
  WeeklyConsumptionDraftDaysSchema,
  type CheckInAvailability,
  type PatientSafetyProjection,
} from '@aud-subjective/contracts';

import {
  p1WordingForGoal,
  type WeeklyCheckInGoal,
} from '../../policy/instruments/aud-weekly-checkin-v1.js';
import { getWeeklyCheckInPolicy } from '../../policy/policy-registry.js';
import type { AssessmentContext, AssessmentPeriodRecord } from './types.js';

function asNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function periodLocalDates(period: AssessmentPeriodRecord) {
  const start = DateTime.fromJSDate(period.periodStartAt, {
    zone: period.monitoringTimezone,
  });
  if (!start.isValid) throw new Error('The persisted monitoring timezone is invalid.');
  return Array.from({ length: 7 }, (_, index) =>
    start.plus({ days: index }).toISODate(),
  ).filter((date): date is string => date !== null);
}

export function projectInstrument(goal: WeeklyCheckInGoal) {
  const policy = getWeeklyCheckInPolicy();
  const items = policy.instrument.items.map((item) => {
    if (item.itemId === 'U1') {
      return {
        itemId: item.itemId,
        key: item.key,
        type: item.type,
        prompt: item.prompt,
        responseLabels: item.responseLabels,
      };
    }
    if (item.itemId === 'P1') {
      return {
        itemId: item.itemId,
        key: item.key,
        type: item.type,
        direction: item.direction,
        prompt: p1WordingForGoal(goal),
        anchors: item.anchors,
      };
    }
    return {
      itemId: item.itemId,
      key: item.key,
      type: item.type,
      direction: item.direction,
      prompt: item.prompt,
      anchors: item.anchors,
    };
  });

  return WeeklyCheckInInstrumentProjectionSchema.parse({
    instrumentId: policy.instrument.instrumentId,
    instrumentVersion: policy.instrument.instrumentVersion,
    displayName: policy.instrument.displayName,
    type: policy.instrument.type,
    exactBam: policy.instrument.exactBam,
    exactAChessReplication: policy.instrument.exactAChessReplication,
    wordingVersion: policy.instrument.wordingVersion,
    scaleVersion: policy.instrument.scaleVersion,
    policy: {
      ruleSetVersion: policy.monitoring.ruleSetVersion,
      configurationVersion: policy.monitoring.configurationVersion,
    },
    requiredItemIds: policy.instrument.requiredItemIds,
    items,
  });
}

export function periodAvailability(
  period: AssessmentPeriodRecord,
  now: Date,
): Exclude<CheckInAvailability, 'NOT_ACTIVATED' | 'HISTORICAL' | 'SAFETY_PAUSED' | 'SAFETY_REASSESSMENT_REQUIRED'> {
  if (now < period.openAt) return 'UPCOMING';
  return now <= period.effectiveDueAt ? 'OPEN' : 'LATE';
}

export function projectPeriod(
  period: AssessmentPeriodRecord,
  now: Date,
) {
  const localStart = DateTime.fromJSDate(period.periodStartAt, {
    zone: period.monitoringTimezone,
  });
  const localEnd = DateTime.fromJSDate(period.periodEndAt, {
    zone: period.monitoringTimezone,
  }).minus({ days: 1 });

  return WeeklyCheckInPeriodProjectionSchema.parse({
    periodId: period.id,
    scheduleVersionId: period.scheduleVersionId,
    scheduleVersion: period.scheduleVersion.version,
    monitoringTimezone: period.monitoringTimezone,
    periodStartAt: period.periodStartAt.toISOString(),
    periodEndAt: period.periodEndAt.toISOString(),
    openAt: period.openAt.toISOString(),
    originalDueAt: period.originalDueAt.toISOString(),
    effectiveDueAt: period.effectiveDueAt.toISOString(),
    version: period.version,
    status: periodAvailability(period, now),
    displayRecallStartDate: localStart.toISODate(),
    displayRecallEndDate: localEnd.toISODate(),
  });
}

export function projectGoalContext(goal: AssessmentContext['goal']) {
  return WeeklyCheckInGoalContextSchema.parse({
    goalVersionId: goal?.id ?? null,
    goalVersion: goal?.goalVersion ?? null,
    goal: goal?.goal ?? 'UNSURE',
    status: goal?.status ?? null,
    effectiveFromPeriodId: goal?.effectiveFromPeriodId ?? null,
    baselineRevisionId: goal?.baselineRevisionId ?? null,
    baselineAverageWeeklyDrinks: asNumber(goal?.baselineAverageWeeklyDrinks),
    targetWeeklyStandardDrinks: asNumber(goal?.targetWeeklyStandardDrinks),
  });
}

export function projectPreferenceContext(
  preference: AssessmentContext['preference'],
) {
  return WeeklyCheckInPreferenceContextSchema.parse({
    preferenceVersionId: preference?.id ?? null,
    preferenceVersion: preference?.version ?? null,
    mutualHelpPreference: preference?.mutualHelpPreference ?? null,
    spiritualContentPreference: preference?.spiritualContentPreference ?? null,
  });
}

export function projectDraft(assessment: {
  id: string;
  scheduledPeriodId: string;
  instrumentId: string;
  instrumentVersion: string;
  draftVersion: number;
  draftCurrentStep: string;
  draftAnswerSnapshot: unknown;
  draftConsumptionSnapshot: unknown;
  completionStatus: string;
}) {
  return WeeklyAssessmentDraftProjectionSchema.parse({
    assessmentId: assessment.id,
    scheduledPeriodId: assessment.scheduledPeriodId,
    instrumentId: assessment.instrumentId,
    instrumentVersion: assessment.instrumentVersion,
    draftVersion: assessment.draftVersion,
    currentStep: assessment.draftCurrentStep,
    answers: WeeklyAssessmentDraftAnswersSchema.parse(
      assessment.draftAnswerSnapshot,
    ),
    weeklyConsumptionDays: WeeklyConsumptionDraftDaysSchema.parse(
      assessment.draftConsumptionSnapshot ?? [],
    ),
    completionStatus: assessment.completionStatus,
  });
}

export function projectSubmitted(assessment: {
  id: string;
  scheduledPeriodId: string;
  completionStatus: string;
  authoritativeRevision: {
    id: string;
    revisionNumber: number;
    completionStatus: string;
    submissionClassification: string;
    submittedAt: Date;
    sourceDraftVersion: number;
  } | null;
}) {
  if (!assessment.authoritativeRevision) {
    throw new Error('A submitted assessment is missing its authoritative revision.');
  }
  return SubmittedWeeklyAssessmentProjectionSchema.parse({
    assessmentId: assessment.id,
    periodId: assessment.scheduledPeriodId,
    scheduledPeriodId: assessment.scheduledPeriodId,
    revisionId: assessment.authoritativeRevision.id,
    revisionNumber: assessment.authoritativeRevision.revisionNumber,
    completionStatus: assessment.authoritativeRevision.completionStatus,
    submissionClassification: assessment.authoritativeRevision.submissionClassification,
    submittedAt: assessment.authoritativeRevision.submittedAt.toISOString(),
    sourceDraftVersion: assessment.authoritativeRevision.sourceDraftVersion,
  });
}

function projectAssessment(assessment: Parameters<typeof projectDraft>[0] & {
  authoritativeRevision?: Parameters<typeof projectSubmitted>[0]['authoritativeRevision'];
}) {
  if (assessment.completionStatus === 'DRAFT') return projectDraft(assessment);
  return projectSubmitted({
    id: assessment.id,
    scheduledPeriodId: assessment.scheduledPeriodId,
    completionStatus: assessment.completionStatus,
    authoritativeRevision: assessment.authoritativeRevision ?? null,
  });
}

export function projectCheckInState(input: {
  availability: CheckInAvailability;
  period: AssessmentPeriodRecord | null;
  assessment: (Parameters<typeof projectDraft>[0] & {
    authoritativeRevision?: Parameters<typeof projectSubmitted>[0]['authoritativeRevision'];
  }) | null;
  context: AssessmentContext | null;
  safety: PatientSafetyProjection;
  now: Date;
}) {
  const goal = projectGoalContext(input.context?.goal ?? null);
  const preference = projectPreferenceContext(input.context?.preference ?? null);
  const weeklyConsumptionRequired = goal.goal === 'REDUCTION';
  const weeklyConsumptionDates =
    weeklyConsumptionRequired && input.period
      ? periodLocalDates(input.period)
      : [];

  return CheckInStateResponseSchema.parse({
    availability: input.availability,
    assessment: input.assessment ? projectAssessment(input.assessment) : null,
    instrument: projectInstrument(goal.goal),
    period: input.period ? projectPeriod(input.period, input.now) : null,
    goalContext: goal,
    preferenceContext: preference,
    safety: input.safety,
    weeklyConsumptionRequired,
    weeklyConsumptionDates,
  });
}

export function safetyAvailability(
  safety: PatientSafetyProjection,
  now: Date,
): Extract<CheckInAvailability, 'SAFETY_PAUSED' | 'SAFETY_REASSESSMENT_REQUIRED'> | null {
  if (safety.requiresSafetyShell || safety.monitoringPromptPolicy === 'PAUSE') {
    return 'SAFETY_PAUSED';
  }
  if (
    safety.reassessmentDueAt !== null &&
    now >= new Date(safety.reassessmentDueAt)
  ) {
    return 'SAFETY_REASSESSMENT_REQUIRED';
  }
  return null;
}
