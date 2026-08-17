import { PatientProfileResponseSchema } from '@aud-subjective/contracts';

export function projectPatientProfile(profile: {
  patientId: string;
  monitoringTimezone: string;
  version: number;
  patient: {
    name: string;
    email: string;
    applicationAccount: { state: 'PENDING' | 'ACTIVE' | 'DISABLED' } | null;
  };
  preferences: Array<{
    version: number;
    mutualHelpPreference:
      | 'NONE'
      | 'AA_12_STEP'
      | 'ALTERNATIVE'
      | 'UNSURE'
      | 'PREFER_NOT_TO_SAY'
      | null;
    spiritualContentPreference: 'ALLOW' | 'DO_NOT_ALLOW' | 'UNSURE' | null;
  }>;
}) {
  const preference = profile.preferences[0];
  if (!preference || !profile.patient.applicationAccount) return null;
  return PatientProfileResponseSchema.parse({
    patientId: profile.patientId,
    name: profile.patient.name,
    email: profile.patient.email,
    accountState: profile.patient.applicationAccount.state,
    onboardingStatus: 'INCOMPLETE',
    monitoringTimezone: profile.monitoringTimezone,
    version: profile.version,
    preferences: preference,
  });
}

export const patientProfileInclude = {
  patient: { include: { applicationAccount: true } },
  preferences: { orderBy: { version: 'desc' as const }, take: 1 },
} as const;
