import {
  ClinicianPatientDetailResponseSchema,
  type ClinicianPatientDetailResponse,
  type PatientProgressPoint,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardCheck, HeartHandshake, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { ClinicianShell } from '@/app/shells/clinician-shell';
import { TrendChart, type TrendPoint } from '@/components/charts/trend-chart';
import { PageHeader } from '@/components/patterns/page-header';
import { StateBadge } from '@/components/patterns/state-badge';
import { ErrorState, EmptyState, LoadingState, RestrictedState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ApiClientError, apiGet } from '@/lib/api/client';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';

type DetailSection = 'overview' | 'check-ins' | 'consumption' | 'cases' | 'timeline';

const sections: Array<{ key: DetailSection; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'check-ins', label: 'Check-ins' },
  { key: 'consumption', label: 'Consumption' },
  { key: 'cases', label: 'Cases' },
  { key: 'timeline', label: 'Timeline' },
];

function humanize(value: string) {
  if (value === 'AT_RISK_OF_DISENGAGEMENT') return 'Check-in follow-up';
  if (value === 'CLEARANCE_PENDING') return 'Clearance pending';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Not recorded';
}

function formatPeriod(point: PatientProgressPoint) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(point.periodStartAt)) +
    ' – ' +
    new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(point.periodEndAt));
}

function chartPoints(data: ClinicianPatientDetailResponse, key: 'craving' | 'recoveryConfidence' | 'moodDifficulty'): TrendPoint[] {
  return data.trajectories.map((point) => ({
    label: formatPeriod(point),
    shortLabel: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(point.periodStartAt)),
    value: point.answers[key],
    status: point.status,
    detail: point.corrected ? 'Corrected authoritative revision' : undefined,
  }));
}

export function ClinicianPatientDetailPage() {
  return (
    <WorkspaceBoundary workspace="CLINICIAN">
      <ClinicianPatientDetailContent />
    </WorkspaceBoundary>
  );
}

function ClinicianPatientDetailContent() {
  const { patientId } = useParams();
  const [section, setSection] = useState<DetailSection>('overview');
  const query = useQuery({
    enabled: Boolean(patientId),
    queryKey: ['clinician', 'patient-detail', patientId],
    queryFn: ({ signal }) =>
      apiGet<ClinicianPatientDetailResponse>(
        `/api/v1/clinician/patients/${patientId}/detail` as `/api/v1/${string}`,
        { schema: ClinicianPatientDetailResponseSchema, signal },
      ),
  });

  return (
    <ClinicianShell>
      <div className="grid gap-8">
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError || !query.data ? (
          query.error instanceof ApiClientError && query.error.status === 403 ? (
            <RestrictedState />
          ) : (
            <ErrorState action={<Button onClick={() => void query.refetch()}>Try again</Button>} />
          )
        ) : (
          <DetailContent data={query.data} section={section} onSectionChange={setSection} />
        )}
      </div>
    </ClinicianShell>
  );
}

function DetailContent({ data, section, onSectionChange }: { data: ClinicianPatientDetailResponse; section: DetailSection; onSectionChange: (section: DetailSection) => void }) {
  const currentSource = data.monitoring.source;
  const clinicalReasonCount = data.monitoring.currentReasons.length;
  return (
    <>
      <PageHeader
        eyebrow="Assigned patient"
        title={data.patientName}
        description="A cohesive view of current monitoring, longitudinal check-ins, separate case domains, and human-readable history."
        action={<Link to="/clinician/patients"><Button variant="outline"><ArrowLeft aria-hidden="true" className="size-4" /> Patients</Button></Link>}
      />

      <div className="flex gap-2 overflow-x-auto border-b pb-1" role="tablist" aria-label="Patient detail sections">
        {sections.map((item) => (
          <button
            aria-selected={section === item.key}
            className={section === item.key ? 'whitespace-nowrap rounded-t-md border-b-2 border-primary px-3 py-3 text-sm font-semibold text-primary' : 'whitespace-nowrap rounded-t-md px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-surface-subtle'}
            key={item.key}
            onClick={() => onSectionChange(item.key)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'overview' ? (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader><h2 className="m-0 text-xl font-semibold">Current monitoring</h2></CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <DetailFact label="Freshness" value={humanize(currentSource.freshness)} />
                <DetailFact label="Completion" value={currentSource.completionStatus ?? 'No current data'} />
                <DetailFact label="Goal" value={currentSource.goal ? humanize(currentSource.goal) : 'Not available'} />
              </div>
              <div className="rounded-lg border bg-surface-subtle p-4 text-sm">
                <p className="m-0 font-semibold">Latest authoritative check-in</p>
                <p className="mb-0 mt-2 text-muted-foreground">{currentSource.periodStartAt ? formatDate(currentSource.periodStartAt) : 'No current scheduled period'}</p>
                <p className="mb-0 mt-1 text-muted-foreground">Submitted {formatDate(currentSource.submittedAt)}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.monitoring.visibilityFlags.filter((flag) => flag.status !== 'CURRENT_CLEARED').map((flag) => (
                  <div className="rounded-lg border p-4" key={flag.flagKey}>
                    <div className="flex items-start justify-between gap-3"><p className="m-0 font-medium">{humanize(flag.flagKey)}</p><StateBadge label={humanize(flag.status)} state={flag.status === 'CURRENT_ACTIVE' ? 'warning' : 'stale'} /></div>
                    <p className="mb-0 mt-2 text-xs text-muted-foreground">{flag.sourceCompletionStatus ?? 'No completion status'} · {formatDate(flag.sourceSubmittedAt)}</p>
                  </div>
                ))}
                {data.monitoring.visibilityFlags.filter((flag) => flag.status !== 'CURRENT_CLEARED').length === 0 ? <p className="m-0 text-sm text-muted-foreground">No current Level-2 flags require attention.</p> : null}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-5">
            <Card>
              <CardHeader><div className="flex items-center gap-3"><HeartHandshake aria-hidden="true" className="size-5 text-primary" /><h2 className="m-0 text-lg font-semibold">Engagement</h2></div></CardHeader>
              <CardContent><StateBadge label={humanize(data.engagement.engagementState)} state={data.engagement.pause.timingPaused ? 'stale' : data.engagement.engagementState === 'DISENGAGED' ? 'warning' : 'current'} /><p className="mb-0 mt-3 text-sm text-muted-foreground">{data.engagement.daysOverdue} days past the effective due time. Engagement is separate from clinical review.</p></CardContent>
            </Card>
            <Card>
              <CardHeader><div className="flex items-center gap-3"><ShieldAlert aria-hidden="true" className="size-5 text-danger" /><h2 className="m-0 text-lg font-semibold">Safety context</h2></div></CardHeader>
              <CardContent><StateBadge label={data.safety.activeCaseCount > 0 ? `${data.safety.activeCaseCount} active case${data.safety.activeCaseCount === 1 ? '' : 's'}` : 'No active case'} state={data.safety.activeCaseCount > 0 ? 'danger' : 'current'} /><p className="mb-0 mt-3 text-sm text-muted-foreground">{data.safety.highestSeverity ? humanize(data.safety.highestSeverity) : 'No active safety severity is present in this assigned view.'}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><div className="flex items-center gap-3"><ClipboardCheck aria-hidden="true" className="size-5 text-primary" /><h2 className="m-0 text-lg font-semibold">Clinical review</h2></div></CardHeader>
              <CardContent><StateBadge label={data.monitoring.currentCase ? humanize(data.monitoring.currentCase.lifecycle) : 'No open case'} state={data.monitoring.currentCase ? 'warning' : 'current'} /><p className="mb-0 mt-3 text-sm text-muted-foreground">{clinicalReasonCount} current reason{clinicalReasonCount === 1 ? '' : 's'} and {data.monitoring.tasks.length} durable task{data.monitoring.tasks.length === 1 ? '' : 's'}.</p></CardContent>
            </Card>
          </div>
        </div>
      ) : section === 'check-ins' ? (
        <TrajectorySection data={data} />
      ) : section === 'consumption' ? (
        <ConsumptionSection data={data} />
      ) : section === 'cases' ? (
        <CasesSection data={data} />
      ) : (
        <TimelineSection data={data} />
      )}
    </>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return <div><p className="m-0 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className="mb-0 mt-1 font-semibold">{value}</p></div>;
}

function TrajectorySection({ data }: { data: ClinicianPatientDetailResponse }) {
  return <div className="grid gap-5 lg:grid-cols-2"><TrendChart data={chartPoints(data, 'craving')} description="Direct weekly craving responses; missing periods remain gaps." title="Cravings" /><TrendChart data={chartPoints(data, 'recoveryConfidence')} description="Direct weekly recovery-confidence responses; no composite score is calculated." title="Confidence" /><TrendChart data={chartPoints(data, 'moodDifficulty')} description="Direct weekly mood-difficulty responses; values are not smoothed across missing weeks." title="Mood difficulty" /><Card><CardHeader><h2 className="m-0 text-lg font-semibold">Check-in provenance</h2></CardHeader><CardContent className="grid gap-3">{data.trajectories.map((point) => <div className="flex flex-col justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0 sm:flex-row" key={point.periodId}><div><p className="m-0 font-medium">{formatPeriod(point)}</p><p className="mb-0 mt-1 text-sm text-muted-foreground">{point.revisionNumber ? `Revision ${point.revisionNumber} · ${formatDate(point.submittedAt)}` : 'No authoritative response'}</p></div><StateBadge label={point.corrected ? 'Corrected' : humanize(point.status)} state={point.corrected ? 'information' : point.status === 'COMPLETE' ? 'current' : point.status === 'PARTIAL' ? 'partial' : 'stale'} /></div>)}</CardContent></Card></div>;
}

function ConsumptionSection({ data }: { data: ClinicianPatientDetailResponse }) {
  const points = data.trajectories.filter((point) => point.consumption);
  return <Card><CardHeader><h2 className="m-0 text-xl font-semibold">Consumption context</h2><p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">Reduction quantities are shown with their coverage and goal context. This view does not turn partial data into a complete-week result.</p></CardHeader><CardContent className="grid gap-3">{points.length > 0 ? points.map((point) => <div className="grid gap-3 rounded-lg border bg-surface-subtle p-4 sm:grid-cols-[1.2fr_0.8fr_0.8fr]" key={point.periodId}><div><p className="m-0 font-semibold">{formatPeriod(point)}</p><p className="mb-0 mt-1 text-sm text-muted-foreground">{point.consumption?.observedDayCount} observed days · {point.consumption?.unknownDayCount} unknown</p></div><DetailFact label="Known quantity" value={`${point.consumption?.knownStandardDrinks ?? 0} standard drinks`} /><DetailFact label="Target" value={point.consumption?.targetWeeklyStandardDrinks === null ? 'Not set' : `${point.consumption?.targetWeeklyStandardDrinks} standard drinks`} /></div>) : <p className="m-0 text-sm text-muted-foreground">No reduction consumption summaries are available in this window.</p>}</CardContent></Card>;
}

function CasesSection({ data }: { data: ClinicianPatientDetailResponse }) {
  return <div className="grid gap-5 lg:grid-cols-3"><CaseCard icon={<ClipboardCheck aria-hidden="true" className="size-5" />} title="Clinical review" value={data.monitoring.currentCase ? humanize(data.monitoring.currentCase.lifecycle) : 'No open case'} description={data.monitoring.currentReasons.map((reason) => humanize(reason.reasonFamily)).join(' · ') || 'No active or clearance-pending reasons.'} /><CaseCard icon={<HeartHandshake aria-hidden="true" className="size-5" />} title="Engagement" value={humanize(data.engagement.engagementCase?.lifecycle ?? data.engagement.engagementState)} description={`${data.engagement.daysOverdue} days past effective due time.`} /><CaseCard icon={<ShieldAlert aria-hidden="true" className="size-5" />} title="Safety" value={data.safety.highestSeverity ? humanize(data.safety.highestSeverity) : 'No active case'} description="Safety remains a separate S0–S3 workflow." /></div>;
}

function CaseCard({ icon, title, value, description }: { icon: React.ReactNode; title: string; value: string; description: string }) {
  return <Card><CardHeader><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-surface-interactive text-primary">{icon}</span><h2 className="m-0 text-lg font-semibold">{title}</h2></div></CardHeader><CardContent><p className="m-0 font-semibold">{value}</p><p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">{description}</p></CardContent></Card>;
}

function TimelineSection({ data }: { data: ClinicianPatientDetailResponse }) {
  return <Card><CardHeader><h2 className="m-0 text-xl font-semibold">Patient timeline</h2><p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">Meaningful assigned-patient history. Administrative forensic details remain in the Admin Audit Explorer.</p></CardHeader><CardContent><ol className="grid gap-5">{data.timeline.map((item) => <li className="relative grid gap-2 border-l-2 border-border-strong pl-5" key={item.id}><span aria-hidden="true" className="absolute -left-[0.42rem] top-1 size-3 rounded-full bg-primary" /><div className="flex flex-wrap items-center gap-2"><p className="m-0 font-semibold">{item.title}</p><StateBadge label={humanize(item.type)} state="information" /></div><p className="m-0 text-sm leading-6 text-muted-foreground">{item.description}</p><p className="m-0 text-xs text-subtle-foreground">{formatDate(item.occurredAt)}</p></li>)}</ol>{data.timeline.length === 0 ? <p className="m-0 text-sm text-muted-foreground">No timeline events are available yet.</p> : null}</CardContent></Card>;
}
