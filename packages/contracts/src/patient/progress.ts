import { z } from 'zod';

import { PatientSafetyProjectionSchema } from '../safety/safety.js';

export const ProgressPointStatusSchema = z.enum([
  'MISSING',
  'PARTIAL',
  'COMPLETE',
]);

export const ProgressMetricSchema = z.enum([
  'craving',
  'recoveryConfidence',
  'moodDifficulty',
]);

const ProgressAnswersSchema = z.object({
  craving: z.number().int().min(0).max(7).nullable(),
  recoveryConfidence: z.number().int().min(0).max(7).nullable(),
  moodDifficulty: z.number().int().min(0).max(7).nullable(),
});

export const ProgressConsumptionSchema = z.object({
  knownStandardDrinks: z.number().nonnegative(),
  completeWeekTotalStandardDrinks: z.number().nonnegative().nullable(),
  coverageRatio: z.number().min(0).max(1),
  observedDayCount: z.number().int().nonnegative(),
  unknownDayCount: z.number().int().nonnegative(),
  targetWeeklyStandardDrinks: z.number().nonnegative().nullable(),
  targetStatus: z.enum(['MET', 'NOT_MET', 'UNRESOLVED']),
});

export const PatientProgressPointSchema = z.object({
  periodId: z.uuid(),
  periodStartAt: z.iso.datetime(),
  periodEndAt: z.iso.datetime(),
  status: ProgressPointStatusSchema,
  goal: z.enum(['ABSTINENCE', 'REDUCTION', 'UNSURE']).nullable(),
  revisionNumber: z.number().int().positive().nullable(),
  revisionId: z.uuid().nullable(),
  submittedAt: z.iso.datetime().nullable(),
  submissionClassification: z
    .enum([
      'CURRENT',
      'LATE_CURRENT',
      'HISTORICAL_BACKFILL',
      'PATIENT_CORRECTION',
      'STAFF_CORRECTION',
    ])
    .nullable(),
  corrected: z.boolean(),
  answers: ProgressAnswersSchema,
  consumption: ProgressConsumptionSchema.nullable(),
});

export const PatientProgressResponseSchema = z.object({
  patientId: z.uuid(),
  windowSize: z.number().int().positive(),
  points: z.array(PatientProgressPointSchema),
  summary: z.object({
    complete: z.number().int().nonnegative(),
    partial: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    currentGoal: z.enum(['ABSTINENCE', 'REDUCTION', 'UNSURE']).nullable(),
  }),
  safety: PatientSafetyProjectionSchema,
});

export type ProgressPointStatus = z.infer<typeof ProgressPointStatusSchema>;
export type ProgressMetric = z.infer<typeof ProgressMetricSchema>;
export type ProgressConsumption = z.infer<typeof ProgressConsumptionSchema>;
export type PatientProgressPoint = z.infer<typeof PatientProgressPointSchema>;
export type PatientProgressResponse = z.infer<
  typeof PatientProgressResponseSchema
>;
