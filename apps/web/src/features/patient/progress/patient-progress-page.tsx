import {
  PatientProgressResponseSchema,
  ProgressMetricSchema,
  type PatientProgressPoint,
  type PatientProgressResponse,
  type ProgressMetric,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarCheck2, CircleHelp, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { PatientShell } from '@/app/shells/patient-shell';
import { ChartDataTable } from '@/components/charts/chart-data-table';
import { TrendChart, type TrendPoint } from '@/components/charts/trend-chart';
import { PageHeader } from '@/components/patterns/page-header';
import { StateBadge } from '@/components/patterns/state-badge';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PatientSafetyBoundary } from '@/features/patient/safety/patient-safety-boundary';
import { ApiClientError, apiGet } from '@/lib/api/client';

const metricLabels: Record<ProgressMetric, { label: string; description: string }> = {
  craving: {
    label: 'Cravings',
    description: 'Your weekly craving response, recorded on a 0–7 scale. Higher values mean stronger cravings.',
  },
  recoveryConfidence: {
    label: 'Confidence',
    description: 'Your weekly recovery-confidence response, recorded on a 0–7 scale. Higher values mean more confidence.',
  },
  moodDifficulty: {
    label: 'Mood difficulty',
    description: 'Your weekly mood-difficulty response, recorded on a 0–7 scale. Higher values mean more difficulty.',
  },
};

function formatPeriod(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
}

function metricValue(point: PatientProgressPoint, metric: ProgressMetric) {
  return point.answers[metric];
}

function statusTone(status: PatientProgressPoint['status']) {
  if (status === 'COMPLETE') return 'current' as const;
  if (status === 'PARTIAL') return 'partial' as const;
  return 'stale' as const;
}

function statusLabel(status: PatientProgressPoint['status']) {
  if (status === 'COMPLETE') return 'Complete';
  if (status === 'PARTIAL') return 'Partial';
  return 'Missing';
}

function chartData(data: PatientProgressResponse, metric: ProgressMetric): TrendPoint[] {
  return data.points.map((point) => ({
    label: formatPeriod(point.periodStartAt, point.periodEndAt),
    shortLabel: new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(point.periodStartAt)),
    value: metricValue(point, metric),
    status: point.status,
    detail: point.corrected
      ? 'Current authoritative correction'
      : point.submissionClassification === 'HISTORICAL_BACKFILL'
        ? 'Historical backfill'
        : undefined,
  }));
}

export function PatientProgressPage() {
  return (
    <PatientSafetyBoundary>
      <PatientProgressContent />
    </PatientSafetyBoundary>
  );
}

function PatientProgressContent() {
  const query = useQuery({
    queryKey: ['patient', 'progress'],
    queryFn: ({ signal }) =>
      apiGet<PatientProgressResponse>('/api/v1/patient/progress', {
        schema: PatientProgressResponseSchema,
        signal,
      }),
  });
  const [metric, setMetric] = useState<ProgressMetric>('craving');

  return (
    <PatientShell>
      <div className="grid gap-8">
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          query.error instanceof ApiClientError && query.error.status === 403 ? (
            <EmptyState />
          ) : (
            <ErrorState
              action={<Button onClick={() => void query.refetch()}>Try again</Button>}
            />
          )
        ) : query.data ? (
          <ProgressContent data={query.data} metric={metric} onMetricChange={setMetric} />
        ) : (
          <EmptyState />
        )}
      </div>
    </PatientShell>
  );
}

function ProgressContent({
  data,
  metric,
  onMetricChange,
}: {
  data: PatientProgressResponse;
  metric: ProgressMetric;
  onMetricChange: (metric: ProgressMetric) => void;
}) {
  const selectedMetric = metricLabels[metric];
  const points = useMemo(() => chartData(data, metric), [data, metric]);
  const reductionPoints = data.points.filter((point) => point.consumption !== null);

  return (
    <>
      <PageHeader
        eyebrow="Your recent history"
        title="Progress"
        description="See your check-ins over scheduled weeks. Missing weeks stay visible as gaps, and corrections show the current recorded response."
        action={
          <Link to="/patient/check-in/history">
            <Button variant="outline">
              Check-in history <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </Link>
        }
      />

      <section aria-label="Check-in summary" className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          icon={<CalendarCheck2 aria-hidden="true" className="size-5" />}
          label="Complete"
          value={data.summary.complete}
        />
        <SummaryTile
          icon={<CircleHelp aria-hidden="true" className="size-5" />}
          label="Partial"
          value={data.summary.partial}
        />
        <SummaryTile
          icon={<TrendingUp aria-hidden="true" className="size-5" />}
          label="Scheduled weeks without a check-in"
          value={data.summary.missing}
        />
      </section>

      <Card className="border-primary/20 bg-primary/[0.035]">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-primary">
                Weekly responses
              </p>
              <h2 className="mb-0 mt-2 text-xl font-semibold">A simple view of your check-ins</h2>
            </div>
            <label className="grid gap-2 text-sm font-semibold sm:min-w-52">
              <span>Choose a response</span>
              <select
                className="h-[var(--control-height)] rounded-md border bg-surface px-3 text-sm font-medium"
                value={metric}
                onChange={(event) => {
                  const next = ProgressMetricSchema.safeParse(event.target.value);
                  if (next.success) onMetricChange(next.data);
                }}
              >
                {Object.entries(metricLabels).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mb-0 mt-3 text-sm leading-6 text-muted-foreground">
            {selectedMetric.description}
          </p>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={points}
            description="The line connects only recorded responses. A missing week is a gap, not a zero."
            title={selectedMetric.label}
          />
        </CardContent>
      </Card>

      {reductionPoints.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="m-0 text-xl font-semibold">Alcohol and goal context</h2>
            <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
              Quantity is shown only when the reduction calendar has enough information for that week. Partial weeks remain clearly marked.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {reductionPoints.map((point) => (
              <div
                className="grid gap-3 rounded-lg border bg-surface-subtle p-4 sm:grid-cols-[1.2fr_0.8fr_0.8fr] sm:items-center"
                key={point.periodId}
              >
                <div>
                  <p className="m-0 font-semibold">{formatPeriod(point.periodStartAt, point.periodEndAt)}</p>
                  <p className="mb-0 mt-1 text-sm text-muted-foreground">
                    {point.consumption?.observedDayCount ?? 0} of 7 days recorded
                  </p>
                </div>
                <div>
                  <p className="m-0 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Known quantity</p>
                  <p className="mb-0 mt-1 font-semibold">
                    {point.consumption?.completeWeekTotalStandardDrinks === null
                      ? `${point.consumption.knownStandardDrinks} standard drinks known`
                      : point.consumption
                        ? `${point.consumption.completeWeekTotalStandardDrinks} standard drinks`
                        : 'Not recorded'}
                  </p>
                </div>
                <div className="sm:text-right">
                  <StateBadge
                    label={point.consumption && point.consumption.unknownDayCount > 0 ? 'Partial coverage' : 'Complete coverage'}
                    state={point.consumption && point.consumption.unknownDayCount > 0 ? 'partial' : 'current'}
                  />
                  {point.consumption?.targetWeeklyStandardDrinks !== null && point.consumption ? (
                    <p className="mb-0 mt-2 text-xs text-muted-foreground">
                      Target: {point.consumption.targetWeeklyStandardDrinks} standard drinks
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="m-0 text-xl font-semibold">Scheduled check-ins</h2>
          <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
            Each week is shown in its scheduled period, including weeks without a current response.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {data.points.map((point) => (
              <div className="flex flex-col justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center" key={point.periodId}>
                <div>
                  <p className="m-0 font-medium">{formatPeriod(point.periodStartAt, point.periodEndAt)}</p>
                  <p className="mb-0 mt-1 text-sm text-muted-foreground">
                    {point.corrected ? 'Current corrected response' : point.submissionClassification === 'HISTORICAL_BACKFILL' ? 'Historical response' : 'Scheduled monitoring period'}
                  </p>
                </div>
                <StateBadge label={statusLabel(point.status)} state={statusTone(point.status)} />
              </div>
            ))}
          </div>
          <div className="mt-6">
            <ChartDataTable
              label="Scheduled check-in history"
              points={data.points.map((point) => ({
                label: formatPeriod(point.periodStartAt, point.periodEndAt),
                value: metricValue(point, metric),
                status: point.status,
                detail: point.corrected ? 'Corrected' : undefined,
              }))}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-information-surface text-information">
          {icon}
        </span>
        <div>
          <p className="m-0 text-2xl font-semibold tabular-nums">{value}</p>
          <p className="mb-0 mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
