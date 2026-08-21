import {
  CheckInAssessmentDetailSchema,
  CheckInStateResponseSchema,
  SaveWeeklyAssessmentDraftRequestSchema,
  SubmitWeeklyAssessmentRequestSchema,
  WeeklyAssessmentCorrectionRequestSchema,
  type CheckInAssessmentDetail,
  type CheckInStateResponse,
  type WeeklyAssessmentDraftAnswers,
  type WeeklyConsumptionDraftDay,
} from '@aud-subjective/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiGet, apiMutate } from '@/lib/api/client';
import { PatientShell } from '@/app/shells/patient-shell';
import { WeeklyConsumptionCalendar } from './weekly-consumption-calendar';

function stableKey(prefix: string) {
  return `${prefix}:${globalThis.crypto.randomUUID()}`;
}

export function PatientCheckInActionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const backfillPeriodId = searchParams.get('backfillPeriodId');
  const correctionAssessmentId = searchParams.get('correctionAssessmentId');
  const backfillStartKey = useState(() => stableKey('backfill-start'))[0];
  const [answers, setAnswers] = useState<WeeklyAssessmentDraftAnswers>({});
  const [weeklyDays, setWeeklyDays] = useState<WeeklyConsumptionDraftDay[]>([]);
  const [seed, setSeed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string>();

  const backfillQuery = useQuery({
    queryKey: ['patient', 'check-in', 'backfill', backfillPeriodId],
    enabled: Boolean(backfillPeriodId),
    queryFn: ({ signal }) =>
      apiMutate<CheckInStateResponse>(
        `/api/v1/patient/check-in/backfill/${backfillPeriodId}/start` as `/api/v1/${string}`,
        'POST',
        {},
        {
          schema: CheckInStateResponseSchema,
          signal,
          headers: { 'Idempotency-Key': backfillStartKey },
        },
      ),
  });
  const correctionQuery = useQuery({
    queryKey: ['patient', 'check-in', 'correction', correctionAssessmentId],
    enabled: Boolean(correctionAssessmentId),
    queryFn: ({ signal }) =>
      apiGet<CheckInAssessmentDetail>(
        `/api/v1/patient/assessments/${correctionAssessmentId}` as `/api/v1/${string}`,
        { schema: CheckInAssessmentDetailSchema, signal },
      ),
  });

  const backfillData = backfillQuery.data;
  const correctionData = correctionQuery.data;
  const sourceKey = backfillData
    ? `backfill:${backfillData.assessment?.assessmentId ?? 'none'}`
    : correctionData
      ? `correction:${correctionData.assessmentId}:${correctionData.authoritativeRevision?.revisionId ?? 'none'}`
      : null;
  useEffect(() => {
    if (!sourceKey || sourceKey === seed) return;
    if (backfillData?.assessment?.completionStatus === 'DRAFT') {
      setAnswers(backfillData.assessment.answers);
      setWeeklyDays(backfillData.assessment.weeklyConsumptionDays);
    } else if (correctionData?.authoritativeRevision) {
      setAnswers(correctionData.authoritativeRevision.answers);
      setWeeklyDays(correctionData.authoritativeRevision.weeklyConsumptionDays);
    }
    setSeed(sourceKey);
  }, [backfillData, correctionData, seed, sourceKey]);

  const loading = (Boolean(backfillPeriodId) && backfillQuery.isLoading) ||
    (Boolean(correctionAssessmentId) && correctionQuery.isLoading);
  const error = backfillQuery.error ?? correctionQuery.error;
  if (loading) return <PatientShell><LoadingState /></PatientShell>;
  if (error || (!backfillData && !correctionData)) {
    return <PatientShell><ErrorState /></PatientShell>;
  }

  const instrument = backfillData?.instrument ?? correctionData!.instrument;
  const period = backfillData?.period ?? correctionData!.period;
  const goal = backfillData?.goalContext.goal ?? correctionData!.goalContext.goal;
  const dates = backfillData?.weeklyConsumptionDates ?? (
    goal === 'REDUCTION'
      ? Array.from({ length: 7 }, (_, index) => {
          const start = new Date(period.displayRecallStartDate);
          start.setUTCDate(start.getUTCDate() + index);
          return start.toISOString().slice(0, 10);
        })
      : []
  );
  const isBackfill = Boolean(backfillData);
  const allAnswered = ['U1', 'R1', 'R2', 'R3', 'R4', 'R5', 'P1', 'P2', 'P3', 'P4', 'P5'].every(
    (itemId) => Object.prototype.hasOwnProperty.call(answers, itemId),
  );

  const saveBackfillDraft = async (): Promise<CheckInStateResponse | null> => {
    const draft = backfillData?.assessment;
    if (!isBackfill || !backfillData || !draft || draft.completionStatus !== 'DRAFT') return null;
    setSaving(true);
    try {
      const request = SaveWeeklyAssessmentDraftRequestSchema.parse({
        expectedDraftVersion: draft.draftVersion,
        currentStep: 'REVIEW',
        answers,
        weeklyConsumptionDays: weeklyDays,
      });
      const response = await apiMutate<CheckInStateResponse>(
        `/api/v1/patient/assessments/${draft.assessmentId}/draft` as `/api/v1/${string}`,
        'PUT',
        request,
        { schema: CheckInStateResponseSchema },
      );
      queryClient.setQueryData(
        ['patient', 'check-in', 'backfill', backfillPeriodId],
        response,
      );
      setMessage('Your past check-in draft was saved.');
      return response;
    } catch {
      setMessage('The past check-in draft could not be saved.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setMessage(undefined);
    try {
      if (isBackfill) {
        const saved = await saveBackfillDraft();
        if (!saved?.assessment || saved.assessment.completionStatus !== 'DRAFT') return;
        const body = SubmitWeeklyAssessmentRequestSchema.parse({
          expectedDraftVersion: saved.assessment.draftVersion,
          completionIntent: allAnswered ? 'COMPLETE' : 'PARTIAL',
        });
        const response = await apiMutate<CheckInStateResponse>(
          `/api/v1/patient/assessments/${saved.assessment.assessmentId}/backfill-submit` as `/api/v1/${string}`,
          'POST',
          body,
          {
            schema: CheckInStateResponseSchema,
            headers: { 'Idempotency-Key': stableKey('backfill-submit') },
          },
        );
        if (response.assessment?.completionStatus !== 'DRAFT') navigate('/patient/check-in/history');
      } else if (correctionData?.authoritativeRevision) {
        const body = WeeklyAssessmentCorrectionRequestSchema.parse({
          expectedAuthoritativeRevisionId: correctionData.authoritativeRevision.revisionId,
          expectedRevisionNumber: correctionData.authoritativeRevision.revisionNumber,
          completionIntent: allAnswered ? 'COMPLETE' : 'PARTIAL',
          answers,
          weeklyConsumptionDays: weeklyDays,
        });
        await apiMutate<CheckInStateResponse>(
          `/api/v1/patient/assessments/${correctionData.assessmentId}/corrections` as `/api/v1/${string}`,
          'POST',
          body,
          {
            schema: CheckInStateResponseSchema,
            headers: { 'Idempotency-Key': stableKey('correction') },
          },
        );
        navigate('/patient/check-in/history');
      }
    } catch {
      setMessage('This check-in could not be submitted. The saved record was not replaced.');
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  };

  return (
    <PatientShell>
      <div className="grid gap-6">
        <header className="grid gap-3 border-b pb-6">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            {isBackfill ? 'Past check-in' : 'Correction'}
          </p>
          <h1 className="m-0 text-3xl font-semibold">
            {isBackfill ? 'Complete a past check-in' : 'Correct this check-in'}
          </h1>
          <p className="m-0 text-sm leading-6 text-muted-foreground">
            Recall dates: {period.displayRecallStartDate} – {period.displayRecallEndDate}.
            {isBackfill
              ? ' This updates your record and history; it does not promise retroactive support or notification.'
              : ' This creates a new revision. The previous version remains in history.'}
          </p>
        </header>
        {message ? <div className="rounded-lg border border-warning-border bg-warning-surface/60 p-4 text-sm" role="status">{message}</div> : null}
        <section className="grid gap-5">
          {instrument.items.map((item) => (
            <div className="grid gap-2 rounded-xl border bg-surface p-5" key={item.itemId}>
              <label className="grid gap-2 text-sm font-semibold">
                {item.prompt}
                {item.type === 'BOOLEAN' ? (
                  <span className="flex gap-2">
                    {([true, false] as const).map((value) => (
                      <Button
                        key={String(value)}
                        onClick={() => setAnswers((previous) => ({ ...previous, U1: value }))}
                        type="button"
                        variant={answers.U1 === value ? 'primary' : 'outline'}
                      >
                        {item.responseLabels[String(value) as 'true' | 'false']}
                      </Button>
                    ))}
                  </span>
                ) : (
                  <Input
                    max="7"
                    min="0"
                    onChange={(event) => setAnswers((previous) => ({ ...previous, [item.itemId]: Number(event.target.value) }))}
                    type="number"
                    value={
                      typeof answers[item.itemId as keyof WeeklyAssessmentDraftAnswers] === 'number'
                        ? answers[item.itemId as keyof WeeklyAssessmentDraftAnswers]
                        : ''
                    }
                  />
                )}
              </label>
            </div>
          ))}
        </section>
        {goal === 'REDUCTION' ? (
          <WeeklyConsumptionCalendar dates={dates} days={weeklyDays} onChange={setWeeklyDays} />
        ) : null}
        <div className="flex flex-wrap gap-3 border-t pt-5">
          {isBackfill ? (
            <Button disabled={saving || submitting} onClick={() => void saveBackfillDraft()} variant="outline">
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
          ) : null}
          {!confirming ? (
            <Button disabled={submitting} onClick={() => setConfirming(true)}>
              {isBackfill ? 'Submit past check-in' : 'Review correction'}
            </Button>
          ) : (
            <div className="grid gap-3 rounded-lg border border-warning-border bg-warning-surface/50 p-4 sm:flex sm:items-center">
              <p className="m-0 text-sm">Confirm: this creates a new revision and keeps the previous version in history.</p>
              <Button disabled={submitting} onClick={() => void submit()}>
                {submitting ? 'Submitting…' : 'Confirm and submit'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </PatientShell>
  );
}
