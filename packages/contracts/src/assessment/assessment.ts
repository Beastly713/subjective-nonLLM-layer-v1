import { z } from 'zod';

import {
  RecoveryGoalSchema,
  RecoveryGoalStatusSchema,
} from '../recovery/recovery.js';
import {
  WeeklyAlcoholDayInputSchema,
  WeeklyAlcoholDayInputSetSchema,
  type WeeklyAlcoholDayInput,
} from '../reduction/reduction.js';
import { SubjectiveMonitoringPolicyProvenanceSchema } from '../monitoring/monitoring.js';

export const WeeklyAssessmentItemIdSchema = z.enum([
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
]);

export const WeeklyAssessmentDraftAnswersSchema = z
  .object({
    U1: z.boolean().optional(),
    R1: z.number().int().min(0).max(7).optional(),
    R2: z.number().int().min(0).max(7).optional(),
    R3: z.number().int().min(0).max(7).optional(),
    R4: z.number().int().min(0).max(7).optional(),
    R5: z.number().int().min(0).max(7).optional(),
    P1: z.number().int().min(0).max(7).optional(),
    P2: z.number().int().min(0).max(7).optional(),
    P3: z.number().int().min(0).max(7).optional(),
    P4: z.number().int().min(0).max(7).optional(),
    P5: z.number().int().min(0).max(7).optional(),
  })
  .strict();

export const WeeklyAssessmentDraftStepSchema = z.enum([
  'ALCOHOL_USE',
  'CHALLENGES',
  'RECOVERY_SUPPORT',
  'REVIEW',
]);

export const AssessmentCompletionStatusSchema = z.enum([
  'DRAFT',
  'PARTIAL',
  'COMPLETE',
]);

export const AssessmentRevisionCompletionStatusSchema = z.enum([
  'PARTIAL',
  'COMPLETE',
]);

export const AssessmentSubmissionClassificationSchema = z.enum([
  'CURRENT',
  'LATE_CURRENT',
]);

export const SubmittedWeeklyAssessmentProjectionSchema = z.object({
  assessmentId: z.uuid(),
  periodId: z.uuid(),
  scheduledPeriodId: z.uuid(),
  revisionId: z.uuid(),
  revisionNumber: z.number().int().positive(),
  completionStatus: AssessmentRevisionCompletionStatusSchema,
  submissionClassification: AssessmentSubmissionClassificationSchema,
  submittedAt: z.iso.datetime(),
  sourceDraftVersion: z.number().int().nonnegative(),
});

export const WeeklyCheckInInstrumentItemProjectionSchema = z.discriminatedUnion(
  'type',
  [
    z.object({
      itemId: z.literal('U1'),
      key: z.literal('alcohol_use_reported'),
      type: z.literal('BOOLEAN'),
      prompt: z.string().min(1),
      responseLabels: z.object({ false: z.string(), true: z.string() }),
    }),
    z.object({
      itemId: z.enum([
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
      ]),
      key: z.string().min(1),
      type: z.literal('INTEGER_0_7'),
      direction: z.enum(['HIGHER_IS_WORSE', 'HIGHER_IS_BETTER']),
      prompt: z.string().min(1),
      anchors: z.object({ zero: z.string().min(1), seven: z.string().min(1) }),
    }),
  ],
);

export const WeeklyCheckInInstrumentProjectionSchema = z.object({
  instrumentId: z.literal('AUD_WEEKLY_CHECKIN'),
  instrumentVersion: z.literal('1.0'),
  displayName: z.literal('Weekly Recovery Check-In'),
  type: z.literal('CUSTOM_A_CHESS_BAM_INFORMED'),
  exactBam: z.literal(false),
  exactAChessReplication: z.literal(false),
  wordingVersion: z.string().min(1),
  scaleVersion: z.string().min(1),
  policy: SubjectiveMonitoringPolicyProvenanceSchema,
  requiredItemIds: z.array(WeeklyAssessmentItemIdSchema).length(11),
  items: z.array(WeeklyCheckInInstrumentItemProjectionSchema).length(11),
});

export const WeeklyCheckInPeriodStatusSchema = z.enum([
  'OPEN',
  'LATE',
  'UPCOMING',
]);

export const WeeklyCheckInPeriodProjectionSchema = z.object({
  periodId: z.uuid(),
  scheduleVersionId: z.uuid(),
  scheduleVersion: z.number().int().positive(),
  monitoringTimezone: z.string().min(1),
  periodStartAt: z.iso.datetime(),
  periodEndAt: z.iso.datetime(),
  openAt: z.iso.datetime(),
  originalDueAt: z.iso.datetime(),
  effectiveDueAt: z.iso.datetime(),
  version: z.number().int().positive(),
  status: WeeklyCheckInPeriodStatusSchema,
  displayRecallStartDate: z.iso.date(),
  displayRecallEndDate: z.iso.date(),
});

export const WeeklyCheckInGoalContextSchema = z.object({
  goalVersionId: z.uuid().nullable(),
  goalVersion: z.number().int().positive().nullable(),
  goal: RecoveryGoalSchema,
  status: RecoveryGoalStatusSchema.nullable(),
  effectiveFromPeriodId: z.uuid().nullable(),
  baselineRevisionId: z.uuid().nullable(),
  baselineAverageWeeklyDrinks: z.number().nullable(),
  targetWeeklyStandardDrinks: z.number().nullable(),
});

export const WeeklyCheckInPreferenceContextSchema = z.object({
  preferenceVersionId: z.uuid().nullable(),
  preferenceVersion: z.number().int().positive().nullable(),
  mutualHelpPreference: z
    .enum(['NONE', 'AA_12_STEP', 'ALTERNATIVE', 'UNSURE', 'PREFER_NOT_TO_SAY'])
    .nullable(),
  spiritualContentPreference: z
    .enum(['ALLOW', 'DO_NOT_ALLOW', 'UNSURE'])
    .nullable(),
});

export const WeeklyConsumptionDraftDaySchema = WeeklyAlcoholDayInputSchema;
export const WeeklyConsumptionDraftDaysSchema = WeeklyAlcoholDayInputSetSchema;

export const WeeklyAssessmentDraftProjectionSchema = z.object({
  assessmentId: z.uuid(),
  scheduledPeriodId: z.uuid(),
  instrumentId: z.literal('AUD_WEEKLY_CHECKIN'),
  instrumentVersion: z.literal('1.0'),
  draftVersion: z.number().int().nonnegative(),
  currentStep: WeeklyAssessmentDraftStepSchema,
  answers: WeeklyAssessmentDraftAnswersSchema,
  weeklyConsumptionDays: z.array(WeeklyConsumptionDraftDaySchema),
  completionStatus: z.literal('DRAFT'),
});

export const WeeklyAssessmentStateProjectionSchema = z.union([
  WeeklyAssessmentDraftProjectionSchema,
  SubmittedWeeklyAssessmentProjectionSchema,
]);

export type WeeklyAssessmentItemId = z.infer<
  typeof WeeklyAssessmentItemIdSchema
>;
export type WeeklyAssessmentDraftAnswers = z.infer<
  typeof WeeklyAssessmentDraftAnswersSchema
>;
export type WeeklyAssessmentDraftStep = z.infer<
  typeof WeeklyAssessmentDraftStepSchema
>;
export type AssessmentCompletionStatus = z.infer<
  typeof AssessmentCompletionStatusSchema
>;
export type AssessmentRevisionCompletionStatus = z.infer<
  typeof AssessmentRevisionCompletionStatusSchema
>;
export type AssessmentSubmissionClassification = z.infer<
  typeof AssessmentSubmissionClassificationSchema
>;
export type WeeklyCheckInInstrumentProjection = z.infer<
  typeof WeeklyCheckInInstrumentProjectionSchema
>;
export type WeeklyCheckInPeriodProjection = z.infer<
  typeof WeeklyCheckInPeriodProjectionSchema
>;
export type WeeklyCheckInGoalContext = z.infer<
  typeof WeeklyCheckInGoalContextSchema
>;
export type WeeklyCheckInPreferenceContext = z.infer<
  typeof WeeklyCheckInPreferenceContextSchema
>;
export type WeeklyConsumptionDraftDay = WeeklyAlcoholDayInput;
export type WeeklyAssessmentDraftProjection = z.infer<
  typeof WeeklyAssessmentDraftProjectionSchema
>;
export type SubmittedWeeklyAssessmentProjection = z.infer<
  typeof SubmittedWeeklyAssessmentProjectionSchema
>;
export type WeeklyAssessmentStateProjection = z.infer<
  typeof WeeklyAssessmentStateProjectionSchema
>;
