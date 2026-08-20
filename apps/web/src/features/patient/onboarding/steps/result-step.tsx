import { OnboardingStateResponseSchema } from '@aud-subjective/contracts';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { stateLabels } from '@/features/patient/safety/patient-safety-status';

type OnboardingState = z.infer<typeof OnboardingStateResponseSchema>;

const dependencyLabels: Record<OnboardingState['dependencyState'], string> = {
  SETUP_INCOMPLETE: 'Initial setup is still incomplete',
  REDUCTION_SETUP_REQUIRED: 'Reduction setup is the next step',
  SAFETY_REVIEW_REQUIRED: 'Safety review is active',
};

export function ResultStep({ data }: { data: OnboardingState }) {
  const review = data.dependencyState === 'SAFETY_REVIEW_REQUIRED';
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div
            className={`grid size-10 shrink-0 place-items-center rounded-lg ${review ? 'bg-restricted-surface text-restricted' : 'bg-success-surface text-success'}`}
          >
            {review ? (
              <ShieldAlert aria-hidden="true" />
            ) : (
              <CheckCircle2 aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="m-0 text-sm font-semibold text-primary">
              Backend-controlled result
            </p>
            <h2 className="m-0 mt-1 text-2xl font-semibold">
              Your initial setup is saved
            </h2>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="rounded-lg border bg-surface-subtle p-4">
          <Badge variant={review ? 'restricted' : 'success'}>
            {dependencyLabels[data.dependencyState]}
          </Badge>
          <p className="mb-0 mt-3 text-sm leading-6 text-muted-foreground">
            {data.dependencyState === 'REDUCTION_SETUP_REQUIRED'
              ? 'Reduction baseline setup is the next step. That future setup is intentionally not part of this release.'
              : data.dependencyState === 'SAFETY_REVIEW_REQUIRED'
                ? `The current safety state is ${stateLabels[data.safety.safetyState].toLowerCase()}. Follow the configured handoff actions in the safety-controlled workspace.`
                : 'The onboarding information is available to the next setup stage. No schedule or goal has been activated.'}
          </p>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="m-0">
            Safety state:{' '}
            <strong>{stateLabels[data.safety.safetyState]}</strong>
          </p>
          <p className="m-0">
            Route availability: <strong>{data.safety.routeAvailability}</strong>
          </p>
          {data.authoritativeRevision ? (
            <p className="m-0 text-muted-foreground sm:col-span-2">
              Authoritative onboarding revision{' '}
              {data.authoritativeRevision.revision} saved{' '}
              {new Date(
                data.authoritativeRevision.submittedAt,
              ).toLocaleString()}
              .
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
