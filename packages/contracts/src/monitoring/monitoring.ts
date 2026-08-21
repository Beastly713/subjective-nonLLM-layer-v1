import { z } from 'zod';

import { SubjectiveInterventionClassSchema } from '../safety/safety.js';

export const SubjectiveMonitoringPolicyProvenanceSchema = z.object({
  ruleSetVersion: z.string().min(1),
  configurationVersion: z.string().min(1),
});

export const AssessmentEvaluationTriggerSchema = z.enum([
  'CURRENT_PATIENT_SUBMISSION',
  'CURRENT_PATIENT_CORRECTION',
  'STAFF_CORRECTION',
  'HISTORICAL_BACKFILL',
  'POLICY_MIGRATION',
  'ADMINISTRATIVE_RECOMPUTE',
]);

export const AssessmentEvaluationLifecycleSchema = z.enum([
  'ACTIVE',
  'SUPERSEDED_BY_REVISION',
  'REVOKED_BY_REVISION',
]);

export const UseObservationStatusSchema = z.enum([
  'POSITIVE',
  'NEGATIVE',
  'UNKNOWN',
]);

export const StateFlagObservationStateSchema = z.enum([
  'ACTIVE',
  'CLEAR',
  'UNKNOWN',
]);

export const CurrentStateFlagStateSchema = z.enum([
  'CURRENT_ACTIVE',
  'CURRENT_CLEARED',
  'STALE_DATA_UNAVAILABLE',
  'REVOKED_BY_REVISION',
]);

export const AggregateContextTagSchema = z.enum([
  'HIGH_RISK',
  'NOT_HIGH',
  'WEAK_PROTECTION',
  'INTERMEDIATE_PROTECTION',
  'STRONG_PROTECTION',
  'HIGH_RISK_WEAK_PROTECTION_CONTEXT',
  'HIGH_RISK_STRONG_PROTECTION_CONTEXT',
]);

export const ClinicalReasonFamilySchema = z.enum([
  'CRAVING_LOW_CONFIDENCE',
  'MOOD_CRAVING',
  'PERSISTENT_HIGH_CRAVING',
  'PERSISTENT_HIGH_NEGATIVE_MOOD',
  'CONSECUTIVE_USE',
  'RECURRENT_USE',
]);

export const PatientInterventionIntentEffectSchema = z.enum([
  'ELIGIBLE',
  'SUPPRESSED_SAFETY',
  'SUPPRESSED_TRIGGER',
  'HISTORICAL_ONLY',
]);

export const ClinicianReasonEffectSchema = z.enum([
  'ELIGIBLE',
  'SUPPRESSED_TRIGGER',
  'HISTORICAL_ONLY',
]);

export const WeeklyConsumptionTargetStatusSchema = z.enum([
  'MET',
  'NOT_MET',
  'UNRESOLVED',
]);

export const WeeklyUseObservationSchema = z.object({
  status: UseObservationStatusSchema,
  periodStartAt: z.iso.datetime(),
  periodEndAt: z.iso.datetime(),
});

export type SubjectiveMonitoringPolicyProvenance = z.infer<
  typeof SubjectiveMonitoringPolicyProvenanceSchema
>;
export type AssessmentEvaluationTrigger = z.infer<
  typeof AssessmentEvaluationTriggerSchema
>;
export type AssessmentEvaluationLifecycle = z.infer<
  typeof AssessmentEvaluationLifecycleSchema
>;
export type UseObservationStatus = z.infer<typeof UseObservationStatusSchema>;
export type StateFlagObservationState = z.infer<
  typeof StateFlagObservationStateSchema
>;
export type CurrentStateFlagState = z.infer<
  typeof CurrentStateFlagStateSchema
>;
export type AggregateContextTag = z.infer<typeof AggregateContextTagSchema>;
export type ClinicalReasonFamily = z.infer<typeof ClinicalReasonFamilySchema>;
export type PatientInterventionIntentEffect = z.infer<
  typeof PatientInterventionIntentEffectSchema
>;
export type ClinicianReasonEffect = z.infer<typeof ClinicianReasonEffectSchema>;
export type WeeklyConsumptionTargetStatus = z.infer<
  typeof WeeklyConsumptionTargetStatusSchema
>;
export type SubjectiveInterventionClass = z.infer<
  typeof SubjectiveInterventionClassSchema
>;
