import type { PatientSafetyProjection } from '@aud-subjective/contracts';
import { ShieldAlert } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const stateLabels: Record<PatientSafetyProjection['safetyState'], string> = {
  NOT_ASSESSED: 'Safety assessment not yet complete',
  MONITORING_AVAILABLE: 'Assessment complete for later setup',
  ROUTINE_CONTEXT: 'Routine safety context',
  REVIEW_REQUIRED: 'Safety review active',
  HANDOFF_REQUIRED: 'Safety handoff required',
};

const handoffLabels: Record<PatientSafetyProjection['handoffStatus'], string> =
  {
    NONE: 'No active handoff',
    PENDING: 'Handoff pending',
    ACKNOWLEDGED: 'Handoff acknowledged',
    REVIEW_IN_PROGRESS: 'Clinical review in progress',
    PLAN_ESTABLISHED: 'Clinical plan established',
    EMERGENCY_HANDOFF: 'Emergency handoff active',
  };

export function PatientSafetyStatus({
  projection,
}: {
  projection: PatientSafetyProjection;
}) {
  if (
    projection.safetyState !== 'REVIEW_REQUIRED' &&
    projection.safetyState !== 'HANDOFF_REQUIRED'
  ) {
    return null;
  }

  return (
    <Card className="border-restricted-border bg-restricted-surface/50">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-restricted-surface text-restricted">
          <ShieldAlert aria-hidden="true" className="size-5" />
        </div>
        <div>
          <Badge variant="restricted">
            {stateLabels[projection.safetyState]}
          </Badge>
          <h2 className="mb-0 mt-2 text-lg font-semibold">
            Your setup is safety-controlled
          </h2>
          <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
            {handoffLabels[projection.handoffStatus]}. Some recovery-direction
            changes may remain unavailable until the review is complete.
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <p className="m-0">
            Prompts: <strong>{projection.monitoringPromptPolicy}</strong>
          </p>
          <p className="m-0">
            Goal changes:{' '}
            <strong>
              {projection.goalChangeAllowed ? 'Allowed' : 'Restricted'}
            </strong>
          </p>
          <p className="m-0">
            Interventions:{' '}
            <strong>
              {projection.allowedSubjectiveInterventions.length || 'None'}
            </strong>
          </p>
        </div>
        {projection.reassessmentDueAt ? (
          <p className="m-0 text-sm text-muted-foreground">
            Reassessment due{' '}
            {new Date(projection.reassessmentDueAt).toLocaleString()}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { handoffLabels, stateLabels };
