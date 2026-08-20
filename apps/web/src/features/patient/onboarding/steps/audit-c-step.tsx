import { auditCScore } from '@aud-subjective/contracts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ResponseControls } from '../onboarding-response-controls';
import type { OnboardingStepProps } from '../types';

const scoreOptions = [0, 1, 2, 3, 4].map((value) => ({
  value,
  label: String(value),
}));

export function AuditCStep({ draft, updateDraft }: OnboardingStepProps) {
  const score = auditCScore(draft.auditC);
  return (
    <Card>
      <CardHeader>
        <p className="m-0 text-sm font-semibold text-primary">
          Alcohol screening
        </p>
        <h2 className="m-0 mt-1 text-2xl font-semibold">
          A short look at recent drinking
        </h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          Choose the answer that best fits. You can use an explicit missing
          response when a question does not feel answerable.
        </p>
      </CardHeader>
      <CardContent className="grid gap-7">
        <ResponseControls
          label="How often did you have a drink containing alcohol in the past year?"
          onChange={(value) =>
            updateDraft('auditC', { ...draft.auditC, frequency: value })
          }
          options={scoreOptions}
          value={draft.auditC.frequency}
        />
        <ResponseControls
          label="How many drinks containing alcohol did you have on a typical day when drinking?"
          onChange={(value) =>
            updateDraft('auditC', { ...draft.auditC, quantity: value })
          }
          options={scoreOptions}
          value={draft.auditC.quantity}
        />
        <ResponseControls
          label="How often did you have six or more drinks on one occasion?"
          onChange={(value) =>
            updateDraft('auditC', { ...draft.auditC, heavy: value })
          }
          options={scoreOptions}
          value={draft.auditC.heavy}
        />
        {score !== null ? (
          <p className="m-0 rounded-lg bg-information-surface p-4 text-sm text-information">
            Screening context recorded: {score}. This is not a diagnosis.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
