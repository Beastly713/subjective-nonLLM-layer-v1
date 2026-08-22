import { z } from 'zod';

export const ClinicianOverviewMonitoringDistributionSchema = z.object({
  current: z.number().int().nonnegative(),
  stale: z.number().int().nonnegative(),
  unavailable: z.number().int().nonnegative(),
});

export const ClinicianOverviewResponseSchema = z.object({
  assignedPatients: z.number().int().nonnegative(),
  openClinicalReviewWork: z.number().int().nonnegative(),
  engagementAttention: z.number().int().nonnegative(),
  activeSafetyWork: z.number().int().nonnegative(),
  monitoring: ClinicianOverviewMonitoringDistributionSchema,
  clinicalReview: z.array(
    z.object({
      patientId: z.uuid(),
      patientName: z.string().min(1),
      lifecycle: z.enum([
        'NEW',
        'ACKNOWLEDGED',
        'ACTIVE',
        'CLEARANCE_PENDING',
      ]),
      reasons: z.array(z.string().min(1)),
      updatedAt: z.iso.datetime(),
    }),
  ),
  engagement: z.array(
    z.object({
      patientId: z.uuid(),
      patientName: z.string().min(1),
      state: z.enum([
        'OVERDUE',
        'AT_RISK_OF_DISENGAGEMENT',
        'DISENGAGED',
        'TECHNICAL_FAILURE',
      ]),
      daysOverdue: z.number().int().nonnegative(),
    }),
  ),
  safety: z.array(
    z.object({
      patientId: z.uuid(),
      patientName: z.string().min(1),
      severity: z.enum([
        'S0_EMERGENCY',
        'S1_URGENT',
        'S2_PRIORITY',
        'S3_ROUTINE',
      ]),
      domain: z.string().min(1),
      lifecycle: z.string().min(1),
    }),
  ),
});

export type ClinicianOverviewResponse = z.infer<
  typeof ClinicianOverviewResponseSchema
>;
