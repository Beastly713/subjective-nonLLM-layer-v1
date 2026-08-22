import { z } from 'zod';

export const AdminOverviewResponseSchema = z.object({
  users: z.object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    disabled: z.number().int().nonnegative(),
  }),
  content: z.object({
    draft: z.number().int().nonnegative(),
    underReview: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    retired: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    coverage: z.array(
      z.object({
        interventionClass: z.string().min(1),
        locale: z.string().min(1),
        approvedLogicalResources: z.number().int().nonnegative(),
        minimumRequired: z.number().int().positive(),
        met: z.boolean(),
      }),
    ),
  }),
  operations: z.object({
    openTechnicalFailures: z.number().int().nonnegative(),
    openIncidents: z.number().int().nonnegative(),
    recentAuditEvents: z.number().int().nonnegative(),
  }),
  localMode: z.enum(['prototype', 'real_patient']),
  productionDeferred: z.array(z.string().min(1)),
});

export type AdminOverviewResponse = z.infer<typeof AdminOverviewResponseSchema>;
