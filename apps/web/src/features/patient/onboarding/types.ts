import type {
  OnboardingDraft,
  OnboardingStep,
  SafetyDraftInput,
  TriState,
} from '@aud-subjective/contracts';

export type ResponseValue<T> =
  | { state: 'ANSWERED'; value: T }
  | {
      state: 'UNKNOWN' | 'UNSURE' | 'PREFER_NOT_TO_SAY' | 'NOT_YET_ANSWERED';
    };

export type OnboardingStepProps = {
  draft: OnboardingDraft;
  safety: SafetyDraftInput;
  updateDraft: <K extends keyof OnboardingDraft>(
    key: K,
    value: OnboardingDraft[K],
  ) => void;
  updateSafety: (changes: Partial<SafetyDraftInput>) => void;
  updateCssrs: (
    key: keyof NonNullable<SafetyDraftInput['cssrs']>,
    value: TriState,
  ) => void;
  recoveryDirectionLocked?: boolean;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'ACCOUNT',
  'AUDIT_C',
  'DRINKING_CONTEXT',
  'RECOVERY_DIRECTION',
  'PREFERENCES',
  'SAFETY',
  'RESULT',
];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  ACCOUNT: 'Welcome',
  AUDIT_C: 'Alcohol screening',
  DRINKING_CONTEXT: 'Drinking context',
  RECOVERY_DIRECTION: 'Recovery direction',
  PREFERENCES: 'Preferences',
  SAFETY: 'Safety check',
  RESULT: 'Next steps',
};

export function response<T>(value: T): ResponseValue<T> {
  return { state: 'ANSWERED', value };
}

export function notYetAnswered() {
  return { state: 'NOT_YET_ANSWERED' } as const;
}

export function createInitialDraft(): OnboardingDraft {
  return {
    auditC: {
      frequency: notYetAnswered(),
      quantity: notYetAnswered(),
      heavy: notYetAnswered(),
    },
    drinkingDaysPerWeek: notYetAnswered(),
    drinksPerDrinkingDay: notYetAnswered(),
    heavyDrinkingDaysRecent: notYetAnswered(),
    lastDrink: { state: 'UNKNOWN' },
    recoveryDirection: notYetAnswered(),
    mutualHelpPreference: notYetAnswered(),
    spiritualContentPreference: notYetAnswered(),
  };
}

export function isAnswered<T>(value: ResponseValue<T>): value is {
  state: 'ANSWERED';
  value: T;
} {
  return value.state === 'ANSWERED';
}

export function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace('Aa 12 Step', 'AA / 12-step');
}
