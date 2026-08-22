import { z } from 'zod';

export const TechnicalFailureStatusSchema = z.enum([
  'SUSPECTED',
  'CONFIRMED',
  'RESOLVED',
  'CORRECTED_FALSE_POSITIVE',
]);

export const TechnicalFailureViewSchema = z.object({
  id: z.uuid(),
  patientId: z.uuid(),
  patientName: z.string().min(1),
  failureType: z.string().min(1),
  status: TechnicalFailureStatusSchema,
  startedAt: z.iso.datetime(),
  evidenceSummary: z.string().min(1),
  version: z.number().int().positive(),
  confirmedBy: z.uuid().nullable(),
  confirmedAt: z.iso.datetime().nullable(),
  resolvedBy: z.uuid().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  correctedBy: z.uuid().nullable(),
  correctedAt: z.iso.datetime().nullable(),
  reason: z.string().nullable(),
  sourcePeriodId: z.uuid().nullable(),
  previousEffectiveDueAt: z.iso.datetime().nullable(),
  recalculatedEffectiveDueAt: z.iso.datetime().nullable(),
  timingImpact: z.enum(['NONE', 'PAUSED', 'RECALCULATED', 'CORRECTED']),
});

export const TechnicalFailureListResponseSchema = z.object({
  items: z.array(TechnicalFailureViewSchema),
});

export const OperationalIncidentSchema = z.object({
  id: z.uuid(),
  incidentType: z.string().min(1),
  code: z.string().min(1),
  status: z.string().min(1),
  summary: z.string().min(1),
  requestId: z.string().nullable(),
  provenanceReference: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});

export const OperationalIncidentListResponseSchema = z.object({
  items: z.array(OperationalIncidentSchema),
});

export const RecordTechnicalFailureRequestSchema = z
  .object({
    patientId: z.uuid(),
    periodId: z.uuid().nullable().optional(),
    failureType: z.string().trim().min(1).max(128),
    startedAt: z.iso.datetime(),
    evidence: z.string().trim().min(1).max(2000),
  })
  .strict();

export const TechnicalFailureTransitionRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();

export type TechnicalFailureView = z.infer<typeof TechnicalFailureViewSchema>;
export type TechnicalFailureListResponse = z.infer<
  typeof TechnicalFailureListResponseSchema
>;
export type RecordTechnicalFailureRequest = z.infer<
  typeof RecordTechnicalFailureRequestSchema
>;
export type TechnicalFailureTransitionRequest = z.infer<
  typeof TechnicalFailureTransitionRequestSchema
>;
export type OperationalIncident = z.infer<typeof OperationalIncidentSchema>;
export type OperationalIncidentListResponse = z.infer<
  typeof OperationalIncidentListResponseSchema
>;
