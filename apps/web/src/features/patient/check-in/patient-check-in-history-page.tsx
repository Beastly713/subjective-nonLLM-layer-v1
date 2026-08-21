import {
  CheckInHistoryResponseSchema,
  type CheckInHistoryResponse,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';

import { ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { apiGet } from '@/lib/api/client';
import { PatientShell } from '@/app/shells/patient-shell';

export function PatientCheckInHistoryPage() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['patient', 'check-in', 'history'],
    queryFn: ({ signal }) =>
      apiGet<CheckInHistoryResponse>('/api/v1/patient/check-in/history', {
        schema: CheckInHistoryResponseSchema,
        signal,
      }),
  });

  if (query.isLoading) return <PatientShell><LoadingState /></PatientShell>;
  if (query.isError || !query.data) return <PatientShell><ErrorState action={<Button onClick={() => void query.refetch()}>Try again</Button>} /></PatientShell>;

  return (
    <PatientShell>
      <div className="grid gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-primary">Check-in history</p>
            <h1 className="mb-0 mt-2 text-3xl font-semibold">Your weekly records</h1>
            <p className="mb-0 mt-2 text-sm text-muted-foreground">Review submitted periods, complete a missing past week, or create a correction revision.</p>
          </div>
          <Link to="/patient/check-in"><Button variant="outline">Current check-in</Button></Link>
        </header>
        {query.data.items.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No scheduled check-in periods are available yet.</CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {query.data.items.map((item) => (
              <Card key={item.period.periodId}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-primary">
                        {item.submissionClassification === 'HISTORICAL_BACKFILL' || item.backfillAvailable ? 'Past check-in' : item.period.status === 'LATE' ? 'Late' : 'Scheduled period'}
                      </p>
                      <h2 className="mb-0 mt-1 text-lg font-semibold">
                        {item.period.displayRecallStartDate} – {item.period.displayRecallEndDate}
                      </h2>
                    </div>
                    <span className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-semibold">
                      {item.completionStatus === 'DRAFT' ? 'Draft' : item.completionStatus === 'PARTIAL' ? 'Partial' : item.completionStatus === 'COMPLETE' ? 'Complete' : 'Missing'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className="m-0 text-muted-foreground">
                    {item.authoritativeRevisionNumber ? `Authoritative revision ${item.authoritativeRevisionNumber}` : 'No submitted revision'}
                    {item.revisions.length > 1 ? ` · ${item.revisions.length} revisions in history` : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.backfillAvailable ? (
                      <Button onClick={() => navigate(`/patient/check-in/action?backfillPeriodId=${item.period.periodId}`)}>
                        Complete past check-in
                      </Button>
                    ) : null}
                    {item.correctionAvailable && item.assessmentId ? (
                      <Button onClick={() => navigate(`/patient/check-in/action?correctionAssessmentId=${item.assessmentId}`)} variant="outline">
                        Correct this check-in
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PatientShell>
  );
}
