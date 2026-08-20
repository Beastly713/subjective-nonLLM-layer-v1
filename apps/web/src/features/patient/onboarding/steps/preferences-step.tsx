import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ResponseControls } from '../onboarding-response-controls';
import type { OnboardingStepProps } from '../types';

const mutualHelpOptions = [
  { value: 'NONE' as const, label: 'None' },
  { value: 'AA_12_STEP' as const, label: 'AA / 12-step' },
  { value: 'ALTERNATIVE' as const, label: 'Alternative mutual help' },
  { value: 'UNSURE' as const, label: 'Unsure' },
  { value: 'PREFER_NOT_TO_SAY' as const, label: 'Prefer not to say' },
];

const spiritualOptions = [
  { value: 'ALLOW' as const, label: 'Allow spiritual content' },
  { value: 'DO_NOT_ALLOW' as const, label: 'Do not allow spiritual content' },
  { value: 'UNSURE' as const, label: 'Unsure' },
];

export function PreferencesStep({ draft, updateDraft }: OnboardingStepProps) {
  return (
    <Card>
      <CardHeader>
        <p className="m-0 text-sm font-semibold text-primary">Preferences</p>
        <h2 className="m-0 mt-1 text-2xl font-semibold">
          Shape the kind of support you see
        </h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          These choices describe content preferences. They do not activate a
          schedule or change the safety assessment.
        </p>
      </CardHeader>
      <CardContent className="grid gap-7">
        <ResponseControls
          label="Mutual-help preference"
          onChange={(value) => updateDraft('mutualHelpPreference', value)}
          options={mutualHelpOptions}
          value={draft.mutualHelpPreference}
        />
        <ResponseControls
          label="Spiritual content preference"
          onChange={(value) => updateDraft('spiritualContentPreference', value)}
          options={spiritualOptions}
          value={draft.spiritualContentPreference}
        />
      </CardContent>
    </Card>
  );
}
