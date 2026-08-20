import type { OnboardingStep } from '@aud-subjective/contracts';

import { ONBOARDING_STEPS, STEP_LABELS } from './types';

export function OnboardingProgress({
  currentStep,
}: {
  currentStep: OnboardingStep;
}) {
  const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
  return (
    <div className="grid gap-3" aria-label="Onboarding progress">
      <div className="flex items-center justify-between gap-4">
        <p className="m-0 text-sm font-semibold text-primary">
          Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
        </p>
        <p className="m-0 text-sm text-muted-foreground">
          {STEP_LABELS[currentStep]}
        </p>
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {ONBOARDING_STEPS.map((step, index) => (
          <li key={step}>
            <div
              aria-current={step === currentStep ? 'step' : undefined}
              aria-label={`${index + 1}. ${STEP_LABELS[step]}`}
              className={`h-2 rounded-full ${
                index <= currentIndex ? 'bg-primary' : 'bg-surface-interactive'
              }`}
              role="img"
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
