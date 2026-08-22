import { z } from 'zod';

import { ClinicianEngagementItemSchema } from './engagement.js';
import { ClinicianPatientMonitoringResponseSchema } from './review.js';
import { PatientProgressPointSchema } from '../patient/progress.js';

export const ClinicianTimelineItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'ASSESSMENT',
    'CORRECTION',
    'BACKFILL',
    'CLINICAL_CASE',
    'ENGAGEMENT',
    'SAFETY',
    'SUPPORT',
    'GOAL',
  ]),
  title: z.string().min(1),
  description: z.string().min(1),
  occurredAt: z.iso.datetime(),
  periodId: z.uuid().nullable(),
  status: z.string().nullable(),
});

export const ClinicianPatientDetailResponseSchema = z.object({
  patientId: z.uuid(),
  patientName: z.string().min(1),
  monitoring: ClinicianPatientMonitoringResponseSchema,
  engagement: ClinicianEngagementItemSchema,
  safety: z.object({
    activeCaseCount: z.number().int().nonnegative(),
    highestSeverity: z
      .enum(['S0_EMERGENCY', 'S1_URGENT', 'S2_PRIORITY', 'S3_ROUTINE'])
      .nullable(),
  }),
  trajectories: z.array(PatientProgressPointSchema),
  timeline: z.array(ClinicianTimelineItemSchema),
});

export type ClinicianTimelineItem = z.infer<
  typeof ClinicianTimelineItemSchema
>;
export type ClinicianPatientDetailResponse = z.infer<
  typeof ClinicianPatientDetailResponseSchema
>;
