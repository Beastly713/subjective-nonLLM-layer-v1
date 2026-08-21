import {
  ClinicianReviewQueueResponseSchema,
  type ClinicianReviewQueueItem,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { ClinicianShell } from '@/app/shells/clinician-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
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
import { ApiClientError, apiGet } from '@/lib/api/client';

function humanize(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function lifecycleTone(value: ClinicianReviewQueueItem['case']['lifecycle']) {
  if (value === 'NEW') return 'warning' as const;
  if (value === 'CLEARANCE_PENDING') return 'stale' as const;
  return 'current' as const;
}

function sourceLabel(item: ClinicianReviewQueueItem) {
  if (item.source.freshness === 'STALE') return 'Stale data';
  if (item.source.freshness === 'REVOKED') return 'Revision revoked';
  if (item.source.freshness === 'NO_CURRENT_DATA') return 'No current data';
  return item.source.completionStatus === 'PARTIAL' ? 'Current · partial' : 'Current';
}

export function ClinicianReviewQueuePage() {
  return (
    <WorkspaceBoundary workspace="CLINICIAN">
      <ClinicianReviewQueueContent />
    </WorkspaceBoundary>
  );
}

function ClinicianReviewQueueContent() {
  const query = useQuery({
    queryKey: ['clinician', 'review-queue'],
    queryFn: ({ signal }) =>
      apiGet('/api/v1/clinician/review-queue', {
        schema: ClinicianReviewQueueResponseSchema,
        signal,
      }),
  });

  return (
    <ClinicianShell>
      <div className="grid gap-7">
        <PageHeader
          description="Level-3 subjective monitoring work for your assigned patients. Level-2 observations remain visible in each patient’s monitoring detail and do not appear here as tasks."
          eyebrow="Clinical review"
          title="Review Queue"
        />
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          query.error instanceof ApiClientError && query.error.status === 403 ? (
            <RestrictedState />
          ) : (
            <ErrorState action={<Button onClick={() => void query.refetch()}>Try again</Button>} />
          )
        ) : query.data?.items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-5">
            {query.data?.items.map((item) => (
              <ReviewQueueCard item={item} key={item.case.id} />
            ))}
          </div>
        )}
      </div>
    </ClinicianShell>
  );
}

function ReviewQueueCard({ item }: { item: ClinicianReviewQueueItem }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="m-0 text-sm font-semibold text-primary">{item.patientName}</p>
            <h2 className="mb-0 mt-1 text-xl font-semibold">Subjective monitoring review</h2>
            <p className="mb-0 mt-2 font-mono text-xs text-muted-foreground">{item.patientId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StateBadge label={humanize(item.case.lifecycle)} state={lifecycleTone(item.case.lifecycle)} />
            <StateBadge
              label={sourceLabel(item)}
              state={item.source.freshness === 'CURRENT' ? 'current' : 'stale'}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Active reasons</p>
          <div className="flex flex-wrap gap-2">
            {item.activeReasons.length > 0 ? item.activeReasons.map((reason) => (
              <span className="rounded-full border bg-surface-subtle px-3 py-1 text-sm" key={reason.reasonFamily}>
                {humanize(reason.reasonFamily)}
              </span>
            )) : <span className="text-sm text-muted-foreground">No currently active reason.</span>}
          </div>
        </div>
        {item.clearancePendingReasons.length > 0 ? (
          <p className="m-0 text-sm text-stale">
            Clearance pending: {item.clearancePendingReasons.map((reason) => humanize(reason.reasonFamily)).join(', ')}
          </p>
        ) : null}
        <div className="flex flex-col justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
          <div className="grid gap-1 text-sm text-muted-foreground">
            <span>{item.tasks.length} durable task{item.tasks.length === 1 ? '' : 's'}</span>
            <span>{item.tasks.some((task) => task.alertUpdateRequired) ? 'A correction update is required.' : 'No task update required.'}</span>
          </div>
          <Link to={`/clinician/patients/${item.patientId}/monitoring`}>
            <Button>Open review</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
