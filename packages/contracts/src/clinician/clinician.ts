import { z } from 'zod';

import { PatientProfileResponseSchema } from '../patient/patient.js';

export const ClinicianPatientSummarySchema = PatientProfileResponseSchema.pick({
  patientId: true,
  name: true,
  monitoringTimezone: true,
  onboardingStatus: true,
  preferences: true,
});

export const ClinicianPatientListResponseSchema = z.object({
  items: z.array(ClinicianPatientSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export type ClinicianPatientListResponse = z.infer<
  typeof ClinicianPatientListResponseSchema
>;
