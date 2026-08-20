import { OnboardingStateResponseSchema } from '@aud-subjective/contracts';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { z } from 'zod';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { stateLabels } from '@/features/patient/safety/patient-safety-status';

type OnboardingState = z.infer<typeof OnboardingStateResponseSchema>;

const dependencyLabels: Record<OnboardingState['dependencyState'], string> = {
  SETUP_INCOMPLETE: 'Initial setup is still incomplete',
  REDUCTION_SETUP_REQUIRED: 'Reduction setup is the next step',
  SAFETY_REVIEW_REQUIRED: 'Safety review is active',
  READY_TO_COMPLETE: 'Ready to finish setup',
  SETUP_COMPLETE: 'Setup complete',
};

export function ResultStep({
  data,
  finishing,
  onFinishSetup,
}: {
  data: OnboardingState;
  finishing: boolean;
  onFinishSetup?: () => void;
}) {
  const review = data.dependencyState === 'SAFETY_REVIEW_REQUIRED';
  const direction = data.draft?.recoveryDirection;
  const reduction =
    direction?.state === 'ANSWERED' && direction.value === 'REDUCTION';
  const ready = data.dependencyState === 'READY_TO_COMPLETE';
  const complete = data.dependencyState === 'SETUP_COMPLETE';
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
              {complete ? 'Setup complete' : 'Your initial setup is saved'}
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
              ? 'Your onboarding is saved. Continue to build the reduction baseline before proposing a target.'
              : data.dependencyState === 'SAFETY_REVIEW_REQUIRED'
                ? 'Your setup is saved and is waiting for the safety owner’s review.'
                : complete
                  ? 'Your goal is active and the monitoring schedule is ready.'
                  : ready && reduction
                    ? 'Your reduction plan is ready. Finish setup from the reduction setup page.'
                    : ready
                      ? 'Your onboarding is saved. Finish setup to activate your goal and monitoring schedule.'
                      : 'The onboarding information is available to the next setup stage.'}
          </p>
          {data.dependencyState === 'REDUCTION_SETUP_REQUIRED' ||
          (ready && reduction) ? (
            <Link className="mt-4 inline-flex" to="/patient/reduction-setup">
              <Button>
                {data.dependencyState === 'REDUCTION_SETUP_REQUIRED'
                  ? 'Continue reduction setup'
                  : 'Finish setup'}
              </Button>
            </Link>
          ) : null}
          {ready && !reduction && onFinishSetup ? (
            <Button
              className="mt-4"
              disabled={finishing}
              onClick={onFinishSetup}
            >
              Finish setup
            </Button>
          ) : null}
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
