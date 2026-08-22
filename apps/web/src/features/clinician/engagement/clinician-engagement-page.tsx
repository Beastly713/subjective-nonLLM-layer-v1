import {
  ClinicianEngagementItemSchema,
  ClinicianEngagementResponseSchema,
  type ClinicianEngagementItem,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock3, HeartHandshake } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { ClinicianShell } from '@/app/shells/clinician-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { ConfirmActionDialog } from '@/components/patterns/confirm-action-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { StateBadge } from '@/components/patterns/state-badge';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  RestrictedState,
} from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ApiClientError, apiGet, apiMutate } from '@/lib/api/client';

type QueueFilter =
  'ALL' | 'OVERDUE' | 'AT_RISK_OF_DISENGAGEMENT' | 'DISENGAGED' | 'PAUSED';

const filterLabels: Record<QueueFilter, string> = {
  ALL: 'All assigned',
  OVERDUE: 'Overdue',
  AT_RISK_OF_DISENGAGEMENT: 'At risk',
  DISENGAGED: 'Outreach',
  PAUSED: 'Paused',
};

function humanize(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stateTone(state: ClinicianEngagementItem['engagementState']) {
  if (state === 'DISENGAGED') return 'danger' as const;
  if (state === 'AT_RISK_OF_DISENGAGEMENT') return 'warning' as const;
  if (state === 'OVERDUE') return 'stale' as const;
  if (state === 'TECHNICAL_FAILURE') return 'restricted' as const;
  if (state === 'OPTED_OUT') return 'information' as const;
  return 'current' as const;
}

function caseTone(
  lifecycle: NonNullable<
    ClinicianEngagementItem['engagementCase']
  >['lifecycle'],
) {
  if (lifecycle === 'NEW') return 'warning' as const;
  if (lifecycle === 'OUTREACH_IN_PROGRESS') return 'information' as const;
  return lifecycle.startsWith('RESOLVED')
    ? ('stale' as const)
    : ('current' as const);
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
    : 'Not recorded';
}

function reminderStatus(item: ClinicianEngagementItem, number: 1 | 2) {
  const reminder = item.reminders.find(
    (entry) => entry.reminderNumber === number,
  );
  if (!reminder) return 'Not materialized';
  if (reminder.presentationStatus === 'ELIGIBLE') return 'Available';
  if (reminder.presentationStatus === 'PRESENTED') return 'Shown in-app';
  if (reminder.presentationStatus === 'CANCELLED') return 'Cancelled';
  return `Upcoming · ${formatDate(reminder.eligibleAt)}`;
}

export function ClinicianEngagementPage() {
  return (
    <WorkspaceBoundary workspace="CLINICIAN">
      <ClinicianEngagementContent />
    </WorkspaceBoundary>
  );
}

function ClinicianEngagementContent() {
  const query = useQuery({
    queryKey: ['clinician', 'engagement'],
    queryFn: ({ signal }) =>
      apiGet('/api/v1/clinician/engagement', {
        schema: ClinicianEngagementResponseSchema,
        signal,
      }),
  });
  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const [mutationError, setMutationError] = useState<string>();

  const items = useMemo(() => {
    const source = query.data?.items ?? [];
    if (filter === 'PAUSED')
      return source.filter((item) => item.pause.timingPaused);
    if (filter === 'ALL') return source;
    return source.filter((item) => item.engagementState === filter);
  }, [filter, query.data?.items]);

  const runCaseAction = async (
    item: ClinicianEngagementItem,
    action: 'acknowledge' | 'start-outreach',
  ) => {
    if (!item.engagementCase) return;
    setMutationError(undefined);
    try {
      await apiMutate(
        `/api/v1/clinician/engagement-cases/${item.engagementCase.id}/${action}`,
        'POST',
        { expectedCaseVersion: item.engagementCase.caseVersion },
        {
          schema: ClinicianEngagementItemSchema,
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        },
      );
      await query.refetch();
    } catch (error) {
      setMutationError(
        error instanceof ApiClientError &&
          error.response?.error.code === 'VERSION_CONFLICT'
          ? 'This case changed while it was open. The current queue has been reloaded.'
          : 'The engagement action could not be completed. Review the current case and try again.',
      );
      throw error;
    }
  };

  return (
    <ClinicianShell>
      <div className="grid gap-7">
        <PageHeader
          eyebrow="Engagement operations"
          title="Engagement queue"
          description="A focused view of missed check-in timing for assigned patients. Engagement work is separate from clinical review and safety cases."
        />

        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          query.error instanceof ApiClientError &&
          query.error.status === 403 ? (
            <RestrictedState />
          ) : (
            <ErrorState
              action={
                <Button onClick={() => void query.refetch()}>Try again</Button>
              }
            />
          )
        ) : (
          <>
            <div className="grid gap-3 rounded-xl border bg-surface p-4 sm:grid-cols-5">
              {(Object.keys(filterLabels) as QueueFilter[]).map((key) => {
                const count =
                  key === 'ALL'
                    ? (query.data?.items.length ?? 0)
                    : key === 'PAUSED'
                      ? (query.data?.items.filter(
                          (item) => item.pause.timingPaused,
                        ).length ?? 0)
                      : (query.data?.items.filter(
                          (item) => item.engagementState === key,
                        ).length ?? 0);
                return (
                  <button
                    className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                      filter === key
                        ? 'border-primary bg-primary/[0.07] text-primary'
                        : 'border-transparent bg-surface-subtle text-muted-foreground hover:border-border-strong'
                    }`}
                    key={key}
                    onClick={() => setFilter(key)}
                    type="button"
                  >
                    <span className="block text-xs font-bold uppercase tracking-[0.1em]">
                      {filterLabels[key]}
                    </span>
                    <span className="mt-1 block text-xl font-semibold">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            {mutationError ? (
              <p
                className="m-0 rounded-lg border border-danger-border bg-danger-surface px-4 py-3 text-sm font-medium text-danger"
                role="alert"
              >
                {mutationError}
              </p>
            ) : null}
            {items.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-5">
                {items.map((item) => (
                  <EngagementCard
                    item={item}
                    key={item.patientId}
                    onAction={runCaseAction}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ClinicianShell>
  );
}

function EngagementCard({
  item,
  onAction,
}: {
  item: ClinicianEngagementItem;
  onAction: (
    item: ClinicianEngagementItem,
    action: 'acknowledge' | 'start-outreach',
  ) => Promise<void>;
}) {
  const engagementCase = item.engagementCase;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-information-surface text-information">
                <HeartHandshake aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="m-0 text-sm font-semibold text-primary">
                  {item.patientName}
                </p>
                <p
                  className="m-0 text-xs text-muted-foreground"
                  title={item.patientId}
                >
                  Patient reference {item.patientId.slice(0, 8)}…
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StateBadge
              label={humanize(item.engagementState)}
              state={stateTone(item.engagementState)}
            />
            {item.pause.timingPaused ? (
              <StateBadge
                label={
                  item.pause.reason === 'SAFETY'
                    ? 'Safety pause'
                    : 'Technical pause'
                }
                state="restricted"
              />
            ) : null}
            {engagementCase ? (
              <StateBadge
                label={humanize(engagementCase.lifecycle)}
                state={caseTone(engagementCase.lifecycle)}
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-4 rounded-lg bg-surface-subtle p-4 sm:grid-cols-4">
          <Metric
            label="Missed period"
            value={
              item.missedCycle
                ? formatDate(item.missedCycle.periodStartAt)
                : 'None'
            }
          />
          <Metric
            label="Effective due"
            value={formatDate(item.effectiveDueAt)}
          />
          <Metric
            label="Days overdue"
            value={item.daysOverdue ? String(item.daysOverdue) : '0'}
          />
          <Metric
            label="Last completed"
            value={
              item.lastCompletedCheckIn
                ? formatDate(item.lastCompletedCheckIn.submittedAt)
                : 'No current check-in'
            }
          />
        </div>
        <div className="grid gap-3 border-t pt-5 sm:grid-cols-3">
          <ReminderMetric label="Reminder 1" value={reminderStatus(item, 1)} />
          <ReminderMetric
            label="Final reminder"
            value={reminderStatus(item, 2)}
          />
          <ReminderMetric
            label="Task routing"
            value={item.task ? humanize(item.task.recipientType) : 'No task'}
          />
        </div>
        <div className="flex flex-col justify-between gap-4 border-t pt-5 sm:flex-row sm:items-center">
          <div>
            <p className="m-0 text-sm font-semibold">
              {engagementCase
                ? `Case opened ${formatDate(engagementCase.openedAt)}`
                : 'No engagement case is open'}
            </p>
            <p className="mb-0 mt-1 text-sm text-muted-foreground">
              {item.pause.timingPaused
                ? 'Timing is paused. No new engagement escalation is created during the pause.'
                : 'Use the current check-in and case lifecycle as the source of truth.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {engagementCase?.lifecycle === 'NEW' ? (
              <ConfirmActionDialog
                triggerLabel="Acknowledge"
                title="Acknowledge this engagement case?"
                description="This records that you have seen the missed check-in case. It does not change clinical or safety state."
                confirmLabel="Acknowledge case"
                onConfirm={() => onAction(item, 'acknowledge')}
              />
            ) : null}
            {engagementCase?.lifecycle === 'ACKNOWLEDGED' ? (
              <ConfirmActionDialog
                triggerLabel="Start outreach"
                title="Start outreach?"
                description="This marks the engagement workflow as in progress. It does not send an external message and does not alter the patient’s clinical record."
                confirmLabel="Start outreach"
                onConfirm={() => onAction(item, 'start-outreach')}
              />
            ) : null}
            <Link to={`/clinician/patients/${item.patientId}`}>
              <Button variant="outline">
                Open patient context
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="m-0 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mb-0 mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ReminderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Clock3
        aria-hidden="true"
        className="mt-0.5 size-4 text-muted-foreground"
      />
      <Metric label={label} value={value} />
    </div>
  );
}
