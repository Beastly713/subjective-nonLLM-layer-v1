import type { PatientSafetyProjection } from '@aud-subjective/contracts';
import { HeartHandshake, ShieldAlert } from 'lucide-react';

import { PatientShell } from '@/app/shells/patient-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { handoffLabels, stateLabels } from './patient-safety-status';

const routeLabels = {
  AVAILABLE: 'Configured support route available',
  PARTIAL: 'Some configured support routes are unavailable',
  UNAVAILABLE: 'Configured support route unavailable',
  NOT_REQUIRED: 'No active support route is required',
} as const;

export function PatientSafetyShell({
  projection,
}: {
  projection: PatientSafetyProjection;
}) {
  return (
    <PatientShell navigation={false}>
      <div className="grid gap-6">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-danger-surface text-danger">
            <ShieldAlert aria-hidden="true" />
          </span>
          <div>
            <p className="m-0 text-sm font-semibold uppercase tracking-wide text-danger">
              Safety-controlled space
            </p>
            <h1 className="mb-0 mt-2 text-3xl font-semibold">
              A clinician needs to review your next steps
            </h1>
            <p className="mb-0 mt-3 text-base leading-7 text-muted-foreground">
              Your ordinary workspace is paused while the configured handoff is
              active. The information below comes from the current safety state.
            </p>
          </div>
        </div>

        <Card className="border-danger-border bg-danger-surface/30">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-xl font-semibold">Current status</h2>
              <Badge variant="danger">
                {stateLabels[projection.safetyState]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="m-0">
              Handoff:{' '}
              <strong>{handoffLabels[projection.handoffStatus]}</strong>
            </p>
            {projection.reassessmentDueAt ? (
              <p className="m-0 text-muted-foreground">
                Reassessment due{' '}
                {new Date(projection.reassessmentDueAt).toLocaleString()}.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="m-0 text-xl font-semibold">Configured support</h2>
            <p className="mb-0 mt-2 text-sm text-muted-foreground">
              {routeLabels[projection.routeAvailability]}
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {projection.patientRouteActions.length > 0 ? (
              projection.patientRouteActions.map((action) =>
                action.actionType === 'STATUS' || !action.href ? (
                  <div
                    className="flex items-center gap-3 rounded-lg border bg-surface-subtle p-4"
                    key={`${action.actionType}:${action.label}`}
                  >
                    <HeartHandshake
                      aria-hidden="true"
                      className="size-5 text-primary"
                    />
                    <div>
                      <p className="m-0 font-semibold">{action.label}</p>
                      <p className="m-0 text-sm text-muted-foreground">
                        Configured status action; no external link is available.
                      </p>
                    </div>
                  </div>
                ) : (
                  <a
                    className="inline-flex min-h-[var(--control-height)] items-center justify-center rounded-md bg-primary px-4 text-center text-sm font-semibold text-inverse-foreground hover:bg-primary-hover"
                    href={action.href}
                    key={`${action.actionType}:${action.href}:${action.label}`}
                    rel={
                      action.actionType === 'OPEN_LINK'
                        ? 'noreferrer'
                        : undefined
                    }
                    target={
                      action.actionType === 'OPEN_LINK' ? '_blank' : undefined
                    }
                  >
                    {action.label}
                  </a>
                ),
              )
            ) : (
              <div className="rounded-lg border border-warning-border bg-warning-surface/50 p-4 text-sm">
                <p className="m-0 font-semibold">
                  Routing is not currently available
                </p>
                <p className="mb-0 mt-1 text-muted-foreground">
                  The safety-controlled space remains active while the
                  configured support route is unavailable. You do not need to
                  resubmit setup.
                </p>
              </div>
            )}
            {projection.routeAvailability === 'PARTIAL' ||
            projection.routeAvailability === 'UNAVAILABLE' ? (
              <p className="m-0 text-sm text-muted-foreground">
                Some technical routing details are unavailable to this view. The
                clinical handoff state remains authoritative.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PatientShell>
  );
}
