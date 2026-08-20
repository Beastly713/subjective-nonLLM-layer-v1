import { z } from 'zod';

export const RecoveryGoalSchema = z.enum(['ABSTINENCE', 'REDUCTION', 'UNSURE']);

export const RecoveryGoalStatusSchema = z.enum([
  'PENDING_CLINICAL_SAFETY_REVIEW',
  'ACTIVE',
  'SUSPENDED_SAFETY_HANDOFF',
  'SUPERSEDED',
  'ENDED',
]);

export const RecoveryGoalSetBySchema = z.enum([
  'PATIENT',
  'CLINICIAN',
  'SHARED',
]);

export const RecoveryGoalProjectionSchema = z.object({
  id: z.uuid(),
  goalVersion: z.number().int().positive(),
  goal: RecoveryGoalSchema,
  status: RecoveryGoalStatusSchema,
  baselineRevisionId: z.uuid().nullable(),
  targetWeeklyStandardDrinks: z.number().nullable(),
  effectiveFromPeriodId: z.uuid().nullable(),
  setBy: RecoveryGoalSetBySchema,
  createdAt: z.iso.datetime(),
});

export type RecoveryGoal = z.infer<typeof RecoveryGoalSchema>;
export type RecoveryGoalStatus = z.infer<typeof RecoveryGoalStatusSchema>;
export type RecoveryGoalSetBy = z.infer<typeof RecoveryGoalSetBySchema>;
export type RecoveryGoalProjection = z.infer<
  typeof RecoveryGoalProjectionSchema
>;
