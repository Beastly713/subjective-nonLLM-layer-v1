import { z } from 'zod';

import { ClinicalReasonFamilySchema } from '../monitoring/monitoring.js';

export const ClinicalReasonStatusSchema = z.enum([
  'INACTIVE',
  'ACTIVE',
  'CLEARANCE_PENDING',
  'RESOLVED',
]);

export const ClinicalReasonEffectSchema = z.enum([
  'ELIGIBLE',
  'SUPPRESSED_TRIGGER',
  'HISTORICAL_ONLY',
  'REVOKED_BY_REVISION',
]);

export const ClinicianVisibilityFlagStatusSchema = z.enum([
  'CURRENT_ACTIVE',
  'CURRENT_CLEARED',
  'STALE_DATA_UNAVAILABLE',
  'REVOKED_BY_REVISION',
]);

export const ClinicalCaseLifecycleSchema = z.enum([
  'NEW',
  'ACKNOWLEDGED',
  'ACTIVE',
  'CLEARANCE_PENDING',
  'RESOLVED',
  'RESOLVED_CORRECTION',
]);

export const ClinicalCaseTierSchema = z.enum(['NONE', 'LEVEL_3']);

export const ClinicianTaskRecipientTypeSchema = z.enum([
  'PRIMARY_CLINICIAN',
  'SYSTEM_UNROUTED_QUEUE',
]);

export const ClinicianTaskCaseTypeSchema = z.enum([
  'CLINICAL',
  'SUBJECTIVE_LEVEL_3_REVIEW',
  'ENGAGEMENT',
]);

export const ClinicianDeliveryStatusSchema = z.enum([
  'DELIVERED',
  'UNROUTED',
  'UPDATE_REQUIRED',
  'ACKNOWLEDGED',
]);

export const ClinicalReasonViewSchema = z.object({
  reasonFamily: ClinicalReasonFamilySchema,
  status: ClinicalReasonStatusSchema,
  effect: ClinicalReasonEffectSchema,
  sourceEvaluationId: z.uuid().nullable(),
  sourceRevisionId: z.uuid().nullable(),
  sourcePeriodId: z.uuid().nullable(),
  firstActiveAt: z.iso.datetime().nullable(),
  lastObservedAt: z.iso.datetime(),
  clearanceCount: z.number().int().nonnegative(),
});

export const ClinicianVisibilityFlagViewSchema = z.object({
  flagKey: z.string().min(1),
  status: ClinicianVisibilityFlagStatusSchema,
  sourceEvaluationId: z.uuid().nullable(),
  sourceRevisionId: z.uuid().nullable(),
  sourcePeriodId: z.uuid().nullable(),
  sourceCompletionStatus: z.enum(['PARTIAL', 'COMPLETE']).nullable(),
  sourceSubmittedAt: z.iso.datetime().nullable(),
});

export const ClinicianTaskViewSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  caseType: ClinicianTaskCaseTypeSchema,
  taskIdentity: z.string().min(1),
  createdReason: ClinicalReasonFamilySchema.nullable(),
  recipientType: ClinicianTaskRecipientTypeSchema,
  deliveryStatus: ClinicianDeliveryStatusSchema,
  title: z.string().min(1),
  alertUpdateRequired: z.boolean(),
  createdAt: z.iso.datetime(),
  acknowledgedAt: z.iso.datetime().nullable(),
});

export const ClinicalCaseViewSchema = z.object({
  id: z.uuid(),
  patientId: z.uuid(),
  tier: ClinicalCaseTierSchema,
  lifecycle: ClinicalCaseLifecycleSchema,
  caseVersion: z.number().int().positive(),
  activeReasonFamilies: z.array(ClinicalReasonFamilySchema),
  clearancePendingReasonFamilies: z.array(ClinicalReasonFamilySchema),
  highestHistoricalTier: ClinicalCaseTierSchema,
  followupVisibility: z.boolean(),
  openedAt: z.iso.datetime(),
  acknowledgedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  resolutionReason: z.string().nullable(),
});

export const ClinicalReviewSourceSchema = z.object({
  periodId: z.uuid().nullable(),
  revisionId: z.uuid().nullable(),
  evaluationId: z.uuid().nullable(),
  periodStartAt: z.iso.datetime().nullable(),
  periodEndAt: z.iso.datetime().nullable(),
  completionStatus: z.enum(['PARTIAL', 'COMPLETE']).nullable(),
  submittedAt: z.iso.datetime().nullable(),
  goal: z.enum(['ABSTINENCE', 'REDUCTION', 'UNSURE']).nullable(),
  freshness: z.enum(['CURRENT', 'STALE', 'REVOKED', 'NO_CURRENT_DATA']),
});

export const ClinicianReviewQueueItemSchema = z.object({
  patientId: z.uuid(),
  patientName: z.string().min(1),
  case: ClinicalCaseViewSchema,
  activeReasons: z.array(ClinicalReasonViewSchema),
  clearancePendingReasons: z.array(ClinicalReasonViewSchema),
  tasks: z.array(ClinicianTaskViewSchema),
  source: ClinicalReviewSourceSchema,
});

export const ClinicianReviewQueueResponseSchema = z.object({
  items: z.array(ClinicianReviewQueueItemSchema),
});

export const ClinicianPatientMonitoringResponseSchema = z.object({
  patientId: z.uuid(),
  patientName: z.string().min(1),
  source: ClinicalReviewSourceSchema,
  visibilityFlags: z.array(ClinicianVisibilityFlagViewSchema),
  currentReasons: z.array(ClinicalReasonViewSchema),
  currentCase: ClinicalCaseViewSchema.nullable(),
  tasks: z.array(ClinicianTaskViewSchema),
  reasonHistory: z.array(
    z.object({
      reasonFamily: ClinicalReasonFamilySchema,
      fromStatus: ClinicalReasonStatusSchema.nullable(),
      toStatus: ClinicalReasonStatusSchema,
      effect: ClinicalReasonEffectSchema,
      cause: z.string().min(1),
      recordedAt: z.iso.datetime(),
    }),
  ),
});

export const AcknowledgeClinicalCaseRequestSchema = z
  .object({
    expectedCaseVersion: z.number().int().positive(),
  })
  .strict();

export type ClinicalReasonStatus = z.infer<typeof ClinicalReasonStatusSchema>;
export type ClinicalReasonEffect = z.infer<typeof ClinicalReasonEffectSchema>;
export type ClinicianVisibilityFlagStatus = z.infer<
  typeof ClinicianVisibilityFlagStatusSchema
>;
export type ClinicalCaseLifecycle = z.infer<typeof ClinicalCaseLifecycleSchema>;
export type ClinicalReasonView = z.infer<typeof ClinicalReasonViewSchema>;
export type ClinicianTaskView = z.infer<typeof ClinicianTaskViewSchema>;
export type ClinicalCaseView = z.infer<typeof ClinicalCaseViewSchema>;
export type ClinicalReviewSource = z.infer<typeof ClinicalReviewSourceSchema>;
export type ClinicianReviewQueueItem = z.infer<
  typeof ClinicianReviewQueueItemSchema
>;
export type ClinicianReviewQueueResponse = z.infer<
  typeof ClinicianReviewQueueResponseSchema
>;
export type ClinicianPatientMonitoringResponse = z.infer<
  typeof ClinicianPatientMonitoringResponseSchema
>;
export type AcknowledgeClinicalCaseRequest = z.infer<
  typeof AcknowledgeClinicalCaseRequestSchema
>;
