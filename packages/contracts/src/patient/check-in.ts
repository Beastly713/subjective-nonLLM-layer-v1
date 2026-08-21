import { z } from 'zod';

import {
  WeeklyAssessmentDraftAnswersSchema,
  WeeklyAssessmentDraftStepSchema,
  WeeklyAssessmentStateProjectionSchema,
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
