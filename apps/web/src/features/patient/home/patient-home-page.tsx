import {
  PatientHomeResponseSchema,
  type PatientHomeResponse,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CirclePause,
  HeartHandshake,
  LifeBuoy,
} from 'lucide-react';
import { Link } from 'react-router';

import { PatientShell } from '@/app/shells/patient-shell';
import { PageHeader } from '@/components/patterns/page-header';
import { StateBadge } from '@/components/patterns/state-badge';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/patterns/system-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PatientSafetyBoundary } from '@/features/patient/safety/patient-safety-boundary';
import { ApiClientError, apiGet } from '@/lib/api/client';

const stateLabels: Record<PatientHomeResponse['engagement']['state'], string> =
  {
    ENGAGED: 'Monitoring active',
    OVERDUE: 'Check-in available',
    AT_RISK_OF_DISENGAGEMENT: 'Check-in available',
    DISENGAGED: 'Return is available',
    RETURNED_AFTER_GAP: 'Monitoring active',
    OPTED_OUT: 'Monitoring paused',
    TECHNICAL_FAILURE: 'Timing paused',
  };

function stateTone(state: PatientHomeResponse['engagement']['state']) {
  if (state === 'TECHNICAL_FAILURE' || state === 'OPTED_OUT') {
    return 'stale' as const;
  }
  if (state === 'DISENGAGED' || state === 'AT_RISK_OF_DISENGAGEMENT') {
    return 'warning' as const;
  }
  if (state === 'OVERDUE') return 'information' as const;
  return 'current' as const;
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value))
    : 'Not scheduled';
}

function reminderLabel(
  status: PatientHomeResponse['engagement']['reminders'][number]['presentationStatus'],
) {
  if (status === 'PRESENTED') return 'Shown in this space';
  if (status === 'ELIGIBLE') return 'Available now';
  if (status === 'CANCELLED') return 'Paused or completed';
  return 'Upcoming';
}

export function selectCurrentReminder(
  reminders: PatientHomeResponse['engagement']['reminders'],
) {
  const eligible = reminders
    .filter(
      (reminder) =>
        reminder.presentationStatus === 'ELIGIBLE' ||
        reminder.presentationStatus === 'PRESENTED',
    )
    .sort((left, right) => right.reminderNumber - left.reminderNumber)[0];
  if (eligible) return [eligible];

  const upcoming = reminders
    .filter((reminder) => reminder.presentationStatus === 'UPCOMING')
    .sort(
      (left, right) =>
        new Date(left.eligibleAt).getTime() -
        new Date(right.eligibleAt).getTime(),
    )[0];
  return upcoming ? [upcoming] : [];
}

export function PatientHomePage() {
  return (
    <PatientSafetyBoundary>
      <PatientHomeContent />
    </PatientSafetyBoundary>
  );
}

function PatientHomeContent() {
  const query = useQuery({
    queryKey: ['patient', 'home'],
    queryFn: ({ signal }) =>
      apiGet<PatientHomeResponse>('/api/v1/patient/home', {
        schema: PatientHomeResponseSchema,
        signal,
      }),
  });

  return (
    <PatientShell>
      <div className="grid gap-8">
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          query.error instanceof ApiClientError &&
          query.error.status === 403 ? (
            <EmptyState />
          ) : (
            <ErrorState
              action={
                <Button onClick={() => void query.refetch()}>Try again</Button>
              }
            />
          )
        ) : query.data ? (
          <HomeContent data={query.data} />
        ) : (
          <EmptyState />
        )}
      </div>
    </PatientShell>
  );
}

function HomeContent({ data }: { data: PatientHomeResponse }) {
  const notice = data.engagement.notice;
  const action = data.primaryAction;
  const checkInPeriod = data.checkIn.period;
  const displayReminders = selectCurrentReminder(data.engagement.reminders);

  return (
    <>
      <PageHeader
        eyebrow="Patient home"
        title={`Welcome back, ${data.patientName}`}
        description="A calm view of what is available now, what is coming next, and where to find support."
      />

      <section
        aria-labelledby="current-action-heading"
        className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.06] shadow-[var(--shadow-sm)]"
      >
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <StateBadge
                label={stateLabels[data.engagement.state]}
                state={stateTone(data.engagement.state)}
              />
              {data.engagement.timingPaused ? (
                <StateBadge label="Timing paused" state="stale" />
              ) : null}
            </div>
            <h2
              className="m-0 max-w-xl text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
              id="current-action-heading"
            >
              {notice?.title ?? action.label}
            </h2>
            <p className="mb-0 mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              {notice?.message ?? action.supportingText}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              {action.href ? (
                <Link className={buttonVariants()} to={action.href}>
                  {action.label}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-md border border-restricted-border bg-restricted-surface px-4 py-3 text-sm font-semibold text-restricted">
                  <CirclePause aria-hidden="true" className="size-4" />
                  Safety guidance takes priority
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                No explanation is needed beyond the check-in itself.
              </span>
            </div>
          </div>
          <div className="rounded-xl border bg-surface/80 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  This week
                </p>
                <p className="mb-0 mt-2 text-lg font-semibold">
                  {data.checkIn.availability === 'SUBMITTED'
                    ? 'Check-in recorded'
                    : data.checkIn.availability === 'UPCOMING'
                      ? 'Check-in coming up'
                      : data.checkIn.availability === 'NOT_ACTIVATED'
                        ? 'Setup still needed'
                        : 'Check-in available'}
                </p>
              </div>
              {data.checkIn.availability === 'SUBMITTED' ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="size-6 text-success"
                />
              ) : (
                <CalendarClock
                  aria-hidden="true"
                  className="size-6 text-primary"
                />
              )}
            </div>
            <dl className="mt-6 grid gap-4 border-t pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="m-0 font-medium">
                  {data.checkIn.availability.replaceAll('_', ' ').toLowerCase()}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Due</dt>
                <dd className="m-0 text-right font-medium">
                  {formatDate(checkInPeriod?.effectiveDueAt ?? null)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-information-surface text-information">
                <HeartHandshake aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="m-0 text-lg font-semibold">
                  Your monitoring plan
                </h2>
                <p className="mb-0 mt-1 text-sm text-muted-foreground">
                  {data.goalSummary.label}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="m-0 text-sm leading-6 text-muted-foreground">
              Your history stays available as you continue. You can take the
              next check-in at a pace that works for you.
            </p>
            <Link
              className="mt-5 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
              to="/patient/check-in/history"
            >
              View check-in history
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-success-surface text-success">
                <LifeBuoy aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="m-0 text-lg font-semibold">
                  Support when useful
                </h2>
                <p className="mb-0 mt-1 text-sm text-muted-foreground">
                  {data.supportSummary.label}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="m-0 text-sm leading-6 text-muted-foreground">
              Explore practical, preference-aware support without changing your
              monitoring plan.
            </p>
            {data.supportSummary.href ? (
              <Link
                className="mt-5 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
                to={data.supportSummary.href}
              >
                Open Support
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {displayReminders.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="m-0 text-lg font-semibold">Current reminder</h2>
            <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
              This is an in-app timing point for the current check-in. No
              external message is being sent.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {displayReminders.map((reminder) => (
              <div
                className="rounded-lg border bg-surface-subtle p-4"
                key={reminder.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="m-0 font-semibold">
                    {reminder.reminderNumber === 1
                      ? 'First reminder'
                      : 'Final reminder'}
                  </p>
                  <StateBadge
                    label={reminderLabel(reminder.presentationStatus)}
                    state={
                      reminder.presentationStatus === 'ELIGIBLE' ||
                      reminder.presentationStatus === 'PRESENTED'
                        ? 'information'
                        : reminder.presentationStatus === 'CANCELLED'
                          ? 'stale'
                          : 'current'
                    }
                  />
                </div>
                <p className="mb-0 mt-3 text-sm text-muted-foreground">
                  {formatDate(reminder.eligibleAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <p className="m-0 text-center text-sm text-muted-foreground">
        Monitoring state is updated when you open this space or complete a
        check-in.
      </p>
    </>
  );
}
