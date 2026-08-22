import { z } from 'zod';

import { ContentInterventionClassSchema } from '../content/content.js';

export const ContentGovernanceStatusSchema = z.enum([
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'RETIRED',
  'REJECTED',
]);

const ContentStringArraySchema = z.array(z.string().min(1));

export const AdminContentVersionSchema = z.object({
  resourceId: z.uuid(),
  versionId: z.uuid(),
  version: z.number().int().positive(),
  interventionClass: ContentInterventionClassSchema,
  locale: z.string().min(1),
  language: z.string().min(1),
  recoveryGoalsAllowed: ContentStringArraySchema,
  deliveryChannels: ContentStringArraySchema,
  mutualHelpRequirement: z.string().min(1),
  spiritualRequirement: z.string().min(1),
  contraindications: ContentStringArraySchema,
  safetyGateCompatibility: ContentStringArraySchema,
  estimatedDurationSeconds: z.number().int().positive(),
  title: z.string().min(1),
  markdownBody: z.string().min(1),
  reviewStatus: ContentGovernanceStatusSchema,
  reviewedByUserId: z.uuid().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  effectiveFrom: z.iso.datetime(),
  retiredAt: z.iso.datetime().nullable(),
  enabled: z.boolean(),
  rowVersion: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const AdminContentListResponseSchema = z.object({
  items: z.array(AdminContentVersionSchema),
});

const ContentDraftFieldsSchema = z.object({
  interventionClass: ContentInterventionClassSchema,
  locale: z.string().trim().min(1).max(32),
  language: z.string().trim().min(1).max(16),
  recoveryGoalsAllowed: ContentStringArraySchema.min(1),
  deliveryChannels: ContentStringArraySchema.min(1),
  mutualHelpRequirement: z.string().trim().min(1).max(64),
  spiritualRequirement: z.string().trim().min(1).max(64),
  contraindications: ContentStringArraySchema,
  safetyGateCompatibility: ContentStringArraySchema,
  estimatedDurationSeconds: z.number().int().positive().max(86_400),
  title: z.string().trim().min(1).max(255),
  markdownBody: z.string().trim().min(1).max(50_000),
  effectiveFrom: z.iso.datetime(),
  enabled: z.boolean().default(true),
});

export const CreateAdminContentRequestSchema = ContentDraftFieldsSchema.extend({
  resourceId: z.uuid().optional(),
}).strict();

export const UpdateAdminContentRequestSchema = ContentDraftFieldsSchema.partial()
  .extend({ expectedRowVersion: z.number().int().positive() })
  .strict();

export const TransitionAdminContentRequestSchema = z
  .object({
    expectedRowVersion: z.number().int().positive(),
    reason: z.string().trim().max(2_000).optional(),
  })
  .strict();

export type AdminContentVersion = z.infer<typeof AdminContentVersionSchema>;
export type CreateAdminContentRequest = z.infer<
  typeof CreateAdminContentRequestSchema
>;
export type UpdateAdminContentRequest = z.infer<
  typeof UpdateAdminContentRequestSchema
>;
export type TransitionAdminContentRequest = z.infer<
  typeof TransitionAdminContentRequestSchema
>;
