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
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { PatientShell } from '@/app/shells/patient-shell';
import { ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { apiGet, apiMutate } from '@/lib/api/client';
import { WeeklyConsumptionCalendar } from './weekly-consumption-calendar';
import { BooleanChoice, WeeklyScale } from './weekly-scale';

function stableKey(prefix: string) {
  return `${prefix}:${globalThis.crypto.randomUUID()}`;
}

type ActionEditorProps = {
  backfillPeriodId: string | null;
  backfillData: CheckInStateResponse | undefined;
  correctionData: CheckInAssessmentDetail | undefined;
};

function PatientCheckInActionEditor({
  backfillPeriodId,
  backfillData,
  correctionData,
}: ActionEditorProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [answers, setAnswers] = useState<WeeklyAssessmentDraftAnswers>(() => {
    if (backfillData?.assessment?.completionStatus === 'DRAFT') {
      return {
        ...backfillData.assessment.answers,
      };
    }

    if (correctionData?.authoritativeRevision) {
      return {
        ...correctionData.authoritativeRevision.answers,
      };
    }

    return {};
  });

  const [weeklyDays, setWeeklyDays] = useState<WeeklyConsumptionDraftDay[]>(
    () => {
      if (backfillData?.assessment?.completionStatus === 'DRAFT') {
        return [...backfillData.assessment.weeklyConsumptionDays];
      }

      if (correctionData?.authoritativeRevision) {
        return [...correctionData.authoritativeRevision.weeklyConsumptionDays];
      }

      return [];
    },
  );

  const [saving, setSaving] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [confirming, setConfirming] = useState(false);

  const [submissionAttempt, setSubmissionAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);

  const [dirty, setDirty] = useState(false);

  const [message, setMessage] = useState<string>();

  const instrument = backfillData?.instrument ?? correctionData!.instrument;

  const period = backfillData?.period ?? correctionData!.period;

  const goal =
    backfillData?.goalContext.goal ?? correctionData!.goalContext.goal;

  const dates =
    backfillData?.weeklyConsumptionDates ??
    correctionData?.weeklyConsumptionDates ??
    [];

  const isBackfill = Boolean(backfillData);

  const allAnswered = [
    'U1',
    'R1',
    'R2',
    'R3',
    'R4',
    'R5',
    'P1',
    'P2',
    'P3',
    'P4',
    'P5',
  ].every((itemId) => Object.prototype.hasOwnProperty.call(answers, itemId));

  const saveBackfillDraft = async (): Promise<CheckInStateResponse | null> => {
    const draft = backfillData?.assessment;

    if (
      !isBackfill ||
      !backfillData ||
      !draft ||
      draft.completionStatus !== 'DRAFT'
    ) {
      return null;
    }

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
        {
          schema: CheckInStateResponseSchema,
        },
      );

      queryClient.setQueryData(
        ['patient', 'check-in', 'backfill', backfillPeriodId],
        response,
      );

      setDirty(false);
      setSubmissionAttempt(null);

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
        const existingDraft = backfillData?.assessment;

        if (!existingDraft || existingDraft.completionStatus !== 'DRAFT') {
          return;
        }

        const saved = dirty ? await saveBackfillDraft() : backfillData;

        const draft = saved?.assessment;

        if (!draft || draft.completionStatus !== 'DRAFT') {
          return;
        }

        const body = SubmitWeeklyAssessmentRequestSchema.parse({
          expectedDraftVersion: draft.draftVersion,
          completionIntent: allAnswered ? 'COMPLETE' : 'PARTIAL',
        });

        const fingerprint = JSON.stringify({
          action: 'BACKFILL_SUBMIT',
          assessmentId: draft.assessmentId,
          body,
        });

        const attempt =
          submissionAttempt?.fingerprint === fingerprint
            ? submissionAttempt
            : {
                fingerprint,
                key: globalThis.crypto.randomUUID(),
              };

        setSubmissionAttempt(attempt);

        const response = await apiMutate<CheckInStateResponse>(
          `/api/v1/patient/assessments/${draft.assessmentId}/backfill-submit` as `/api/v1/${string}`,
          'POST',
          body,
          {
            schema: CheckInStateResponseSchema,
            headers: {
              'Idempotency-Key': attempt.key,
            },
          },
        );

        setSubmissionAttempt(null);

        if (response.assessment?.completionStatus !== 'DRAFT') {
          navigate('/patient/check-in/history');
        }
      } else if (correctionData?.authoritativeRevision) {
        const body = WeeklyAssessmentCorrectionRequestSchema.parse({
          expectedAuthoritativeRevisionId:
            correctionData.authoritativeRevision.revisionId,

          expectedRevisionNumber:
            correctionData.authoritativeRevision.revisionNumber,

          completionIntent: allAnswered ? 'COMPLETE' : 'PARTIAL',

          answers,

          weeklyConsumptionDays: weeklyDays,
        });

        const fingerprint = JSON.stringify({
          action: 'PATIENT_CORRECTION',
          assessmentId: correctionData.assessmentId,
          body,
        });

        const attempt =
          submissionAttempt?.fingerprint === fingerprint
            ? submissionAttempt
            : {
                fingerprint,
                key: globalThis.crypto.randomUUID(),
              };

        setSubmissionAttempt(attempt);

        await apiMutate<CheckInStateResponse>(
          `/api/v1/patient/assessments/${correctionData.assessmentId}/corrections` as `/api/v1/${string}`,
          'POST',
          body,
          {
            schema: CheckInStateResponseSchema,
            headers: {
              'Idempotency-Key': attempt.key,
            },
          },
        );

        setSubmissionAttempt(null);

        navigate('/patient/check-in/history');
      }
    } catch {
      setMessage(
        'This check-in could not be submitted. The saved record was not replaced.',
      );
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
            Recall dates: {period.displayRecallStartDate} –{' '}
            {period.displayRecallEndDate}.
            {isBackfill
              ? ' This updates your record and history; it does not promise retroactive support or notification.'
              : ' This creates a new revision. The previous version remains in history.'}
          </p>
        </header>

        {message ? (
          <div
            className="rounded-lg border border-warning-border bg-warning-surface/60 p-4 text-sm"
            role="status"
          >
            {message}
          </div>
        ) : null}

        <section className="grid gap-5">
          {instrument.items.map((item) =>
            item.type === 'BOOLEAN' ? (
              <BooleanChoice
                key={item.itemId}
                labels={item.responseLabels}
                onChange={(value) => {
                  setAnswers((previous) => ({
                    ...previous,
                    U1: value,
                  }));

                  setDirty(true);
                  setSubmissionAttempt(null);
                }}
                prompt={item.prompt}
                value={answers.U1}
              />
            ) : (
              <WeeklyScale
                item={item}
                key={item.itemId}
                onChange={(value) => {
                  setAnswers((previous) => ({
                    ...previous,
                    [item.itemId]: value,
                  }));

                  setDirty(true);

                  setSubmissionAttempt(null);
                }}
                value={answers[item.itemId]}
              />
            ),
          )}
        </section>

        {goal === 'REDUCTION' ? (
          <WeeklyConsumptionCalendar
            dates={dates}
            days={weeklyDays}
            onChange={(next) => {
              setWeeklyDays(next);
              setDirty(true);
              setSubmissionAttempt(null);
            }}
          />
        ) : null}

        <div className="flex flex-wrap gap-3 border-t pt-5">
          {isBackfill ? (
            <Button
              disabled={saving || submitting}
              onClick={() => void saveBackfillDraft()}
              variant="outline"
            >
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
          ) : null}

          {!confirming ? (
            <Button disabled={submitting} onClick={() => setConfirming(true)}>
              {isBackfill ? 'Submit past check-in' : 'Review correction'}
            </Button>
          ) : (
            <div className="grid gap-3 rounded-lg border border-warning-border bg-warning-surface/50 p-4 sm:flex sm:items-center">
              <p className="m-0 text-sm">
                {isBackfill
                  ? 'Confirm: this records a submitted past check-in. Unanswered questions remain unknown.'
                  : 'Confirm: this creates a new revision. The previous version remains in history.'}
              </p>

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

export function PatientCheckInActionPage() {
  const [searchParams] = useSearchParams();

  const backfillPeriodId = searchParams.get('backfillPeriodId');

  const correctionAssessmentId = searchParams.get('correctionAssessmentId');

  const backfillStartKey = useState(() => stableKey('backfill-start'))[0];

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
          headers: {
            'Idempotency-Key': backfillStartKey,
          },
        },
      ),
  });

  const correctionQuery = useQuery({
    queryKey: ['patient', 'check-in', 'correction', correctionAssessmentId],

    enabled: Boolean(correctionAssessmentId),

    queryFn: ({ signal }) =>
      apiGet<CheckInAssessmentDetail>(
        `/api/v1/patient/assessments/${correctionAssessmentId}` as `/api/v1/${string}`,
        {
          schema: CheckInAssessmentDetailSchema,
          signal,
        },
      ),
  });

  const backfillData = backfillQuery.data;

  const correctionData = correctionQuery.data;

  const loading =
    (Boolean(backfillPeriodId) && backfillQuery.isLoading) ||
    (Boolean(correctionAssessmentId) && correctionQuery.isLoading);

  const error = backfillQuery.error ?? correctionQuery.error;

  if (loading) {
    return (
      <PatientShell>
        <LoadingState />
      </PatientShell>
    );
  }

  if (error || (!backfillData && !correctionData)) {
    return (
      <PatientShell>
        <ErrorState />
      </PatientShell>
    );
  }

  const sourceKey = backfillData
    ? `backfill:${backfillData.assessment?.assessmentId ?? 'none'}`
    : `correction:${correctionData!.assessmentId}:${correctionData!.authoritativeRevision?.revisionId ?? 'none'}`;

  return (
    <PatientCheckInActionEditor
      backfillData={backfillData}
      backfillPeriodId={backfillPeriodId}
      correctionData={correctionData}
      key={sourceKey}
    />
  );
}
