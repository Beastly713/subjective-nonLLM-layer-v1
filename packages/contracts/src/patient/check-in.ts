import { z } from 'zod';

import {
  WeeklyAssessmentDraftAnswersSchema,
  WeeklyAssessmentDraftStepSchema,
  WeeklyAssessmentStateProjectionSchema,
  AssessmentCompletionStatusSchema,
  AssessmentRevisionCompletionStatusSchema,
  AssessmentSubmissionClassificationSchema,
  WeeklyCheckInGoalContextSchema,
  WeeklyCheckInInstrumentProjectionSchema,
  WeeklyCheckInPeriodProjectionSchema,
  WeeklyCheckInPreferenceContextSchema,
  WeeklyConsumptionDraftDaysSchema,
} from '../assessment/assessment.js';
import { PatientSafetyProjectionSchema } from '../safety/safety.js';

export const CheckInAvailabilitySchema = z.enum([
  'NOT_ACTIVATED',
  'UPCOMING',
  'OPEN',
  'LATE',
  'HISTORICAL',
  'SAFETY_PAUSED',
  'SAFETY_REASSESSMENT_REQUIRED',
]);

const WeeklyConsumptionDatesSchema = z
  .array(z.iso.date())
  .refine((dates) => dates.length === 0 || dates.length === 7, {
    message: 'Weekly consumption dates must be empty or contain seven dates.',
  });

export const CheckInStateResponseSchema = z.object({
  availability: CheckInAvailabilitySchema,
  assessment: WeeklyAssessmentStateProjectionSchema.nullable(),
  instrument: WeeklyCheckInInstrumentProjectionSchema,
  period: WeeklyCheckInPeriodProjectionSchema.nullable(),
  goalContext: WeeklyCheckInGoalContextSchema,
  preferenceContext: WeeklyCheckInPreferenceContextSchema,
  safety: PatientSafetyProjectionSchema,
  weeklyConsumptionRequired: z.boolean(),
  weeklyConsumptionDates: WeeklyConsumptionDatesSchema,
});

export const SubmitWeeklyAssessmentRequestSchema = z
  .object({
    expectedDraftVersion: z.number().int().nonnegative(),
    completionIntent: z.enum(['PARTIAL', 'COMPLETE']),
  })
  .strict();

export const SubmitWeeklyAssessmentResponseSchema = CheckInStateResponseSchema;

export const WeeklyAssessmentCorrectionRequestSchema = z
  .object({
    expectedAuthoritativeRevisionId: z.uuid(),
    expectedRevisionNumber: z.number().int().positive(),
    completionIntent: z.enum(['PARTIAL', 'COMPLETE']),
    answers: WeeklyAssessmentDraftAnswersSchema,
    weeklyConsumptionDays: WeeklyConsumptionDraftDaysSchema.optional(),
  })
  .strict();

export const StaffWeeklyAssessmentCorrectionRequestSchema =
  WeeklyAssessmentCorrectionRequestSchema.extend({
    reason: z.string().trim().min(1).max(2000),
  }).strict();

export const CheckInHistoryRevisionSchema = z.object({
  revisionId: z.uuid(),
  revisionNumber: z.number().int().positive(),
  submittedAt: z.iso.datetime(),
  submittedBy: z.enum(['PATIENT', 'CLINICIAN', 'STAFF', 'IMPORT']),
  submissionClassification: AssessmentSubmissionClassificationSchema,
  completionStatus: AssessmentRevisionCompletionStatusSchema,
  isAuthoritative: z.boolean(),
});

export const CheckInHistoryItemSchema = z.object({
  assessmentId: z.uuid().nullable(),
  period: WeeklyCheckInPeriodProjectionSchema,
  completionStatus: AssessmentCompletionStatusSchema.nullable(),
  submissionClassification: AssessmentSubmissionClassificationSchema.nullable(),
  authoritativeRevisionId: z.uuid().nullable(),
  authoritativeRevisionNumber: z.number().int().positive().nullable(),
  submittedAt: z.iso.datetime().nullable(),
  hasDraft: z.boolean(),
  correctionAvailable: z.boolean(),
  backfillAvailable: z.boolean(),
  revisions: z.array(CheckInHistoryRevisionSchema),
});

export const CheckInHistoryResponseSchema = z.object({
  items: z.array(CheckInHistoryItemSchema),
});

export const CheckInAssessmentDetailSchema = z.object({
  assessmentId: z.uuid(),
  period: WeeklyCheckInPeriodProjectionSchema,
  instrument: WeeklyCheckInInstrumentProjectionSchema,
  goalContext: WeeklyCheckInGoalContextSchema,
  preferenceContext: WeeklyCheckInPreferenceContextSchema,
  weeklyConsumptionDates: WeeklyConsumptionDatesSchema,
  authoritativeRevision: CheckInHistoryRevisionSchema.extend({
    answers: WeeklyAssessmentDraftAnswersSchema,
    weeklyConsumptionDays: WeeklyConsumptionDraftDaysSchema,
  }).nullable(),
  priorRevisions: z.array(CheckInHistoryRevisionSchema),
});

export const CheckInMutationReceiptSchema = z.object({
  assessmentId: z.uuid(),
  periodId: z.uuid(),
  revisionId: z.uuid(),
  revisionNumber: z.number().int().positive(),
  submissionClassification: AssessmentSubmissionClassificationSchema,
  evaluationIds: z.array(z.uuid()),
});

export const SaveWeeklyAssessmentDraftRequestSchema = z.object({
  expectedDraftVersion: z.number().int().nonnegative(),
  currentStep: WeeklyAssessmentDraftStepSchema,
  answers: WeeklyAssessmentDraftAnswersSchema,
  weeklyConsumptionDays: WeeklyConsumptionDraftDaysSchema.optional(),
});

export const SaveWeeklyAssessmentDraftResponseSchema =
  CheckInStateResponseSchema;

export type CheckInAvailability = z.infer<typeof CheckInAvailabilitySchema>;
export type CheckInStateResponse = z.infer<typeof CheckInStateResponseSchema>;
export type SaveWeeklyAssessmentDraftRequest = z.infer<
  typeof SaveWeeklyAssessmentDraftRequestSchema
>;
export type SaveWeeklyAssessmentDraftResponse = z.infer<
  typeof SaveWeeklyAssessmentDraftResponseSchema
>;
export type SubmitWeeklyAssessmentRequest = z.infer<
  typeof SubmitWeeklyAssessmentRequestSchema
>;
export type SubmitWeeklyAssessmentResponse = z.infer<
  typeof SubmitWeeklyAssessmentResponseSchema
>;
export type WeeklyAssessmentCorrectionRequest = z.infer<
  typeof WeeklyAssessmentCorrectionRequestSchema
>;
export type StaffWeeklyAssessmentCorrectionRequest = z.infer<
  typeof StaffWeeklyAssessmentCorrectionRequestSchema
>;
export type CheckInHistoryItem = z.infer<typeof CheckInHistoryItemSchema>;
export type CheckInHistoryResponse = z.infer<
  typeof CheckInHistoryResponseSchema
>;
export type CheckInAssessmentDetail = z.infer<
  typeof CheckInAssessmentDetailSchema
>;
export type CheckInMutationReceipt = z.infer<
  typeof CheckInMutationReceiptSchema
>;
