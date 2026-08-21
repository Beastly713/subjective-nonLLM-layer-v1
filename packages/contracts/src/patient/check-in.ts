import { z } from 'zod';

import {
  WeeklyAssessmentDraftAnswersSchema,
  WeeklyAssessmentDraftProjectionSchema,
  WeeklyAssessmentDraftStepSchema,
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
  assessment: WeeklyAssessmentDraftProjectionSchema.nullable(),
  instrument: WeeklyCheckInInstrumentProjectionSchema,
  period: WeeklyCheckInPeriodProjectionSchema.nullable(),
  goalContext: WeeklyCheckInGoalContextSchema,
  preferenceContext: WeeklyCheckInPreferenceContextSchema,
  safety: PatientSafetyProjectionSchema,
  weeklyConsumptionRequired: z.boolean(),
  weeklyConsumptionDates: WeeklyConsumptionDatesSchema,
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
