import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ResponseControls } from '../onboarding-response-controls';
import type { OnboardingStepProps } from '../types';

const options = [
  {
    value: 'ABSTINENCE' as const,
    label: 'Abstinence',
    description: 'I want support with stopping alcohol use.',
  },
  {
    value: 'REDUCTION' as const,
    label: 'Reduction',
    description: 'I want support with reducing alcohol use.',
  },
  {
    value: 'UNSURE' as const,
    label: 'I am unsure',
    description: 'I would like to keep this direction open for now.',
  },
];

export function RecoveryDirectionStep({
  draft,
  updateDraft,
  recoveryDirectionLocked = false,
}: OnboardingStepProps) {
  return (
    <Card>
      <CardHeader>
        <p className="m-0 text-sm font-semibold text-primary">
          Recovery direction
        </p>
        <h2 className="m-0 mt-1 text-2xl font-semibold">
          What direction feels right today?
        </h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          This records your current direction. Reduction setup and goals are not
          part of this step.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5">
        {recoveryDirectionLocked ? (
          <p className="m-0 rounded-lg border border-restricted-border bg-restricted-surface p-4 text-sm text-restricted">
            Recovery-direction changes are temporarily unavailable while the
            current safety review is active.
          </p>
        ) : null}
        <div className="grid gap-3">
          {options.map((option) => (
            <button
              className={`rounded-lg border p-4 text-left transition-colors ${
                !recoveryDirectionLocked &&
                draft.recoveryDirection.state === 'ANSWERED' &&
                draft.recoveryDirection.value === option.value
                  ? 'border-primary bg-information-surface'
                  : 'bg-surface hover:bg-surface-subtle'
              }`}
              disabled={recoveryDirectionLocked}
              key={option.value}
              onClick={() =>
                updateDraft('recoveryDirection', {
                  state: 'ANSWERED',
                  value: option.value,
                })
              }
              type="button"
            >
              <span className="block font-semibold">{option.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {option.description}
              </span>
            </button>
          ))}
        </div>
        {!recoveryDirectionLocked ? (
          <ResponseControls
            label="Or record an explicit missing response"
            onChange={(value) => updateDraft('recoveryDirection', value)}
            options={[]}
            value={draft.recoveryDirection}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
