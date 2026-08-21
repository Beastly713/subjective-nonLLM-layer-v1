import type { ClinicalReasonFamily } from '@aud-subjective/contracts';

export const CLINICAL_REASON_FAMILIES = [
  'CRAVING_LOW_CONFIDENCE',
  'MOOD_CRAVING',
  'PERSISTENT_HIGH_CRAVING',
  'PERSISTENT_HIGH_NEGATIVE_MOOD',
  'CONSECUTIVE_USE',
  'RECURRENT_USE',
] as const satisfies readonly ClinicalReasonFamily[];

export type ClinicalReasonStatus =
  | 'INACTIVE'
  | 'ACTIVE'
  | 'CLEARANCE_PENDING'
  | 'RESOLVED';

export type ClinicalReasonEffect =
  | 'ELIGIBLE'
  | 'SUPPRESSED_TRIGGER'
  | 'HISTORICAL_ONLY'
  | 'REVOKED_BY_REVISION';

export type ClinicalReasonSnapshot = {
  status: ClinicalReasonStatus;
  clearanceCount: number;
};
