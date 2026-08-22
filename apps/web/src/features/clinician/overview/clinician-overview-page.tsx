import {
  ClinicianOverviewResponseSchema,
  type ClinicianOverviewResponse,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { Activity, ClipboardList, HeartHandshake, ShieldAlert, UsersRound } from 'lucide-react';
import { Link } from 'react-router';

import { ClinicianShell } from '@/app/shells/clinician-shell';
import { PageHeader } from '@/components/patterns/page-header';
import { StateBadge } from '@/components/patterns/state-badge';
import { EmptyState, ErrorState, LoadingState, RestrictedState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ApiClientError, apiGet } from '@/lib/api/client';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';

function humanize(value: string) {
  if (value === 'AT_RISK_OF_DISENGAGEMENT') return 'Check-in follow-up';
  if (value === 'CLEARANCE_PENDING') return 'Clearance pending';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function lifecycleTone(value: string) {
  if (value === 'NEW') return 'warning' as const;
  if (value === 'CLEARANCE_PENDING') return 'stale' as const;
  return 'current' as const;
}

export function ClinicianOverviewPage() {
  return (
    <WorkspaceBoundary workspace="CLINICIAN">
      <ClinicianOverviewContent />
    </WorkspaceBoundary>
  );
}

function ClinicianOverviewContent() {
  const query = useQuery({
    queryKey: ['clinician', 'overview'],
    queryFn: ({ signal }) =>
      apiGet<ClinicianOverviewResponse>('/api/v1/clinician/overview', {
        schema: ClinicianOverviewResponseSchema,
        signal,
      }),
  });

  return (
    <ClinicianShell>
      <div className="grid gap-8">
        <PageHeader
          eyebrow="Assigned care workspace"
          title="Clinical overview"
          description="A focused view of your assigned patients, with clinical review, engagement, and safety work kept distinct."
        />
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          query.error instanceof ApiClientError && query.error.status === 403 ? (
            <RestrictedState />
          ) : (
            <ErrorState action={<Button onClick={() => void query.refetch()}>Try again</Button>} />
          )
        ) : query.data ? (
          <OverviewContent data={query.data} />
        ) : (
          <EmptyState />
        )}
      </div>
    </ClinicianShell>
  );
}

function OverviewContent({ data }: { data: ClinicianOverviewResponse }) {
  return (
    <>
      <section aria-label="Assigned workload" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile icon={<UsersRound aria-hidden="true" className="size-5" />} label="Assigned patients" value={data.assignedPatients} />
        <MetricTile icon={<ClipboardList aria-hidden="true" className="size-5" />} label="Open clinical review" value={data.openClinicalReviewWork} />
        <MetricTile icon={<HeartHandshake aria-hidden="true" className="size-5" />} label="Engagement attention" value={data.engagementAttention} />
        <MetricTile icon={<ShieldAlert aria-hidden="true" className="size-5" />} label="Active safety work" value={data.activeSafetyWork} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Activity aria-hidden="true" className="size-5 text-primary" />
            <div>
              <h2 className="m-0 text-xl font-semibold">Monitoring coverage</h2>
              <p className="mb-0 mt-1 text-sm text-muted-foreground">Freshness is based on assigned-patient scheduled periods and current authoritative check-ins.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <CoverageTile label="Current" value={data.monitoring.current} tone="current" />
          <CoverageTile label="Stale" value={data.monitoring.stale} tone="stale" />
          <CoverageTile label="No current data" value={data.monitoring.unavailable} tone="information" />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <AttentionSection
          title="Clinical review"
          description="Open Level-3 review work only. Level-2 visibility remains in patient detail."
          empty="No patients currently require clinical review."
        >
          {data.clinicalReview.map((item) => (
            <Link className="block rounded-lg border p-4 transition-colors hover:bg-surface-subtle" key={item.patientId} to={`/clinician/patients/${item.patientId}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 font-semibold">{item.patientName}</p>
                  <p className="mb-0 mt-1 text-sm text-muted-foreground">{item.reasons.map(humanize).join(' · ') || 'Clinical review'}</p>
                </div>
                <StateBadge label={humanize(item.lifecycle)} state={lifecycleTone(item.lifecycle)} />
              </div>
            </Link>
          ))}
        </AttentionSection>
        <AttentionSection
          title="Engagement"
          description="Missed check-in follow-up, separate from clinical interpretation."
          empty="No engagement attention is open."
        >
          {data.engagement.map((item) => (
            <Link className="block rounded-lg border p-4 transition-colors hover:bg-surface-subtle" key={item.patientId} to={`/clinician/patients/${item.patientId}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 font-semibold">{item.patientName}</p>
                  <p className="mb-0 mt-1 text-sm text-muted-foreground">{item.daysOverdue} days past effective due time</p>
                </div>
                <StateBadge label={humanize(item.state)} state={item.state === 'DISENGAGED' ? 'danger' : 'warning'} />
              </div>
            </Link>
          ))}
        </AttentionSection>
        <AttentionSection
          title="Safety"
          description="Safety cases use the separate S0–S3 namespace."
          empty="No active safety work is assigned."
        >
          {data.safety.map((item) => (
            <Link className="block rounded-lg border p-4 transition-colors hover:bg-surface-subtle" key={item.patientId} to="/clinician/safety">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 font-semibold">{item.patientName}</p>
                  <p className="mb-0 mt-1 text-sm text-muted-foreground">{humanize(item.domain)}</p>
                </div>
                <StateBadge label={item.severity.replace('_', ' ')} state="danger" />
              </div>
            </Link>
          ))}
        </AttentionSection>
      </div>
    </>
  );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-information-surface text-information">{icon}</span>
        <div>
          <p className="m-0 text-2xl font-semibold tabular-nums">{value}</p>
          <p className="mb-0 mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageTile({ label, value, tone }: { label: string; value: number; tone: 'current' | 'stale' | 'information' }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-surface-subtle p-4">
      <span className="text-sm font-medium">{label}</span>
      <StateBadge label={String(value)} state={tone} />
    </div>
  );
}

function AttentionSection({ title, description, empty, children }: { title: string; description: string; empty: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="m-0 text-lg font-semibold">{title}</h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {children || <p className="m-0 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}
