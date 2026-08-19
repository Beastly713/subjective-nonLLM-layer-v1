import { z } from 'zod';

export const RoutingTargetKindSchema = z.enum([
  'EMERGENCY_SERVICE',
  'CRISIS_SERVICE',
  'URGENT_MEDICAL_SERVICE',
  'ON_CALL_CLINICIAN_QUEUE',
]);
export const RoutingTargetRepresentationSchema = z.enum([
  'TELEPHONE',
  'DEEP_LINK',
  'INTERNAL_QUEUE',
  'EXTERNAL_SERVICE',
]);
const RoutingTargetBaseSchema = z.object({
  kind: RoutingTargetKindSchema,
  label: z.string().trim().min(1).max(255),
});
export const RoutingTargetInputSchema = z.discriminatedUnion('representation', [
  RoutingTargetBaseSchema.extend({
    representation: z.literal('TELEPHONE'),
    targetValue: z
      .string()
      .trim()
      .max(64)
      .regex(
        /^[+() .-]*[0-9][0-9() .-]*$/,
        'Provide a dial-safe telephone number.',
      ),
  }),
  RoutingTargetBaseSchema.extend({
    representation: z.literal('DEEP_LINK'),
    targetValue: z
      .string()
      .trim()
      .max(2000)
      .regex(/^https:\/\/[^\s/$.?#][^\s]*$/i, 'Provide an HTTPS URL.'),
  }),
  RoutingTargetBaseSchema.extend({
    representation: z.literal('INTERNAL_QUEUE'),
    targetValue: z
      .string()
      .trim()
      .max(128)
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9:_./-]*$/,
        'Provide a safe queue identifier.',
      ),
  }),
  RoutingTargetBaseSchema.extend({
    representation: z.literal('EXTERNAL_SERVICE'),
    targetValue: z
      .string()
      .trim()
      .max(256)
      .regex(
        /^(?:urn:[A-Za-z0-9][A-Za-z0-9:._/-]*|[A-Za-z0-9][A-Za-z0-9:._/-]*)$/,
        'Provide a safe service identifier.',
      ),
  }),
]);
export const RoutingEvidenceSchema = z.object({
  id: z.uuid(),
  targetKind: RoutingTargetKindSchema,
  configurationRevision: z.number().int().positive(),
  result: z.enum(['PASS', 'FAIL']),
  provenance: z.string(),
  testedAt: z.iso.datetime(),
  testedByUserId: z.uuid(),
});
export const RoutingProfileSummarySchema = z.object({
  id: z.uuid(),
  countryCode: z.string(),
  regionCode: z.string().nullable(),
  logicalVersion: z.number().int().positive(),
  rowVersion: z.number().int().positive(),
  configurationRevision: z.number().int().positive(),
  lifecycle: z.enum(['DRAFT', 'ACTIVE', 'SUPERSEDED']),
  effectiveAt: z.iso.datetime().nullable(),
  supersededAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export const RoutingTargetResponseSchema = z.object({
  id: z.uuid(),
  kind: RoutingTargetKindSchema,
  representation: RoutingTargetRepresentationSchema,
  targetValue: z.string(),
  label: z.string(),
});
export const RoutingProfileDetailSchema = RoutingProfileSummarySchema.extend({
  targets: z.array(RoutingTargetResponseSchema),
  testEvidence: z.array(RoutingEvidenceSchema),
});
export const RoutingProfileListSchema = z.object({
  items: z.array(RoutingProfileSummarySchema),
});
export const CreateRoutingDraftRequestSchema = z.object({
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/),
  regionCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]+$/)
    .min(1)
    .max(64)
    .nullable()
    .optional(),
  reason: z.string().trim().min(1).max(1000),
});
export const EditRoutingDraftRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  targets: z.array(RoutingTargetInputSchema).length(4),
  reason: z.string().trim().min(1).max(1000),
});
export const RecordRoutingEvidenceRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  targetKind: RoutingTargetKindSchema,
  result: z.enum(['PASS', 'FAIL']),
  provenance: z.string().trim().min(1).max(2000),
});
export const ActivateRoutingRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000),
});
export const RoutingResolverResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('UNAVAILABLE'),
    reason: z.enum(['NO_ACTIVE_PROFILE', 'PROFILE_NOT_EFFECTIVE']),
  }),
  z.object({
    status: z.literal('AVAILABLE'),
    profileId: z.uuid(),
    logicalVersion: z.number().int().positive(),
    effectiveAt: z.iso.datetime(),
    targets: z.array(RoutingTargetInputSchema),
  }),
]);

export type RoutingProfileDetail = z.infer<typeof RoutingProfileDetailSchema>;
export type RoutingProfileList = z.infer<typeof RoutingProfileListSchema>;
