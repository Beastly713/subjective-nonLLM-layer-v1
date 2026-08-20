import { z } from 'zod';

import { OnboardingCompletionStatusSchema } from '../onboarding/onboarding.js';

export const MutualHelpPreferenceSchema = z.enum([
  'NONE',
  'AA_12_STEP',
  'ALTERNATIVE',
  'UNSURE',
  'PREFER_NOT_TO_SAY',
]);
export const SpiritualContentPreferenceSchema = z.enum([
  'ALLOW',
  'DO_NOT_ALLOW',
  'UNSURE',
]);

export const PatientProfileResponseSchema = z.object({
  patientId: z.uuid(),
  name: z.string(),
  email: z.email(),
  accountState: z.enum(['PENDING', 'ACTIVE', 'DISABLED']),
  onboardingStatus: OnboardingCompletionStatusSchema,
  monitoringTimezone: z.string(),
  version: z.number().int().positive(),
  preferences: z.object({
    version: z.number().int().positive(),
    mutualHelpPreference: MutualHelpPreferenceSchema.nullable(),
    spiritualContentPreference: SpiritualContentPreferenceSchema.nullable(),
  }),
});

export const UpdatePatientProfileRequestSchema = z.object({
  monitoringTimezone: z.string().min(1).max(255),
  expectedVersion: z.number().int().positive(),
});

export const UpdatePatientPreferencesRequestSchema = z.object({
  mutualHelpPreference: MutualHelpPreferenceSchema.nullable(),
  spiritualContentPreference: SpiritualContentPreferenceSchema.nullable(),
  expectedVersion: z.number().int().positive(),
});

export type PatientProfileResponse = z.infer<
  typeof PatientProfileResponseSchema
>;
