import type {
  ContentInterventionClass,
  PatientSupportTypeOption,
} from '@aud-subjective/contracts';

export const CONTENT_LOCALE = 'en-US';
export const CONTENT_LANGUAGE = 'en';
export const CONTENT_RESOLVER_VERSION = 'phase5-content-v1';
export const RESOURCE_COOLDOWN_DAYS = 7;
export const NOT_HELPFUL_SUPPRESSION_DAYS = 14;

export const CONTENT_INTERVENTION_CLASSES = [
  'CRAVING_COPING_SUPPORT',
  'SELF_EFFICACY_SUPPORT',
  'MOOD_COPING_SUPPORT',
  'TRIGGER_MANAGEMENT_SUPPORT',
  'RELATIONSHIP_COPING_SUPPORT',
  'SOCIAL_SUPPORT_ACTIVATION',
  'USE_EVENT_RECOVERY_SUPPORT',
  'RECURRENT_USE_RECOVERY_SUPPORT',
  'RECOVERY_PLAN_REVIEW',
  'POSITIVE_REINFORCEMENT',
] as const satisfies readonly ContentInterventionClass[];

export const HIGH_FREQUENCY_CLASSES = new Set<ContentInterventionClass>([
  'CRAVING_COPING_SUPPORT',
  'SELF_EFFICACY_SUPPORT',
  'MOOD_COPING_SUPPORT',
  'TRIGGER_MANAGEMENT_SUPPORT',
]);

export const SUPPORT_TYPE_LABELS: Record<ContentInterventionClass, string> = {
  CRAVING_COPING_SUPPORT: 'Working through cravings',
  SELF_EFFICACY_SUPPORT: 'Building confidence',
  MOOD_COPING_SUPPORT: 'Managing difficult emotions',
  TRIGGER_MANAGEMENT_SUPPORT: 'Handling difficult situations',
  RELATIONSHIP_COPING_SUPPORT: 'Navigating relationships',
  SOCIAL_SUPPORT_ACTIVATION: 'Connecting with support',
  USE_EVENT_RECOVERY_SUPPORT: 'Next steps after alcohol use',
  RECURRENT_USE_RECOVERY_SUPPORT: 'Reviewing your recovery plan',
  RECOVERY_PLAN_REVIEW: 'Reviewing your support plan',
  POSITIVE_REINFORCEMENT: 'Recognizing what is working',
};

export const SUPPORT_TYPE_OPTIONS: PatientSupportTypeOption[] =
  CONTENT_INTERVENTION_CLASSES.map((key) => ({
    key,
    label: SUPPORT_TYPE_LABELS[key],
  }));

export type ContentSafetyContext = {
  safetyState:
    | 'NOT_ASSESSED'
    | 'MONITORING_AVAILABLE'
    | 'ROUTINE_CONTEXT'
    | 'REVIEW_REQUIRED'
    | 'HANDOFF_REQUIRED';
  requiresSafetyShell: boolean;
  monitoringPromptPolicy: 'CONTINUE' | 'PAUSE';
  allowedSubjectiveInterventions: readonly string[];
};

export type ContentPreferenceContext = {
  mutualHelpPreference:
    | 'NONE'
    | 'AA_12_STEP'
    | 'ALTERNATIVE'
    | 'UNSURE'
    | 'PREFER_NOT_TO_SAY'
    | null;
  spiritualContentPreference: 'ALLOW' | 'DO_NOT_ALLOW' | 'UNSURE' | null;
};
