import {
  CheckInStateResponseSchema,
  SaveWeeklyAssessmentDraftRequestSchema,
  SubmitWeeklyAssessmentRequestSchema,
  type CheckInStateResponse,
  type CheckInAvailability,
  type WeeklyAssessmentDraftAnswers,
  type WeeklyAssessmentDraftStep,
  type WeeklyConsumptionDraftDay,
} from '@aud-subjective/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { ErrorState, LoadingState, RestrictedState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiClientError, apiMutate } from '@/lib/api/client';
import { PatientShell } from '@/app/shells/patient-shell';
import { WeeklyConsumptionCalendar } from './weekly-consumption-calendar';
import { BooleanChoice, WeeklyScale } from './weekly-scale';

const steps: readonly WeeklyAssessmentDraftStep[] = [
  'ALCOHOL_USE',
  'CHALLENGES',
  'RECOVERY_SUPPORT',
  'REVIEW',
];

const stepLabels: Record<WeeklyAssessmentDraftStep, string> = {
  ALCOHOL_USE: 'Alcohol use',
  CHALLENGES: 'Challenges',
  RECOVERY_SUPPORT: 'Recovery / support',
  REVIEW: 'Review',
};

type LocalDraft = {
  assessmentId: string;
  draftVersion: number;
  currentStep: WeeklyAssessmentDraftStep;
  answers: WeeklyAssessmentDraftAnswers;
  weeklyConsumptionDays: WeeklyConsumptionDraftDay[];
};

export function PatientCheckInPage() {
  return (
    <WorkspaceBoundary workspace="PATIENT">
      <PatientCheckInContent />
    </WorkspaceBoundary>
  );
}

function PatientCheckInContent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['patient', 'check-in'],
    queryFn: ({ signal }) =>
      apiMutate<CheckInStateResponse>(
        '/api/v1/patient/check-in/start',
        'POST',
        {},
        { schema: CheckInStateResponseSchema, signal },
      ),
  });
  const [local, setLocal] = useState<LocalDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submissionAttempt, setSubmissionAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const [message, setMessage] = useState<string>();

  if (query.isLoading) {
    return (
      <PatientShell>
        <LoadingState />
      </PatientShell>
    );
  }

  if (query.isError || !query.data) {
    if (
      query.error instanceof ApiClientError &&
      query.error.response?.error.code === 'PERMISSION_DENIED'
    ) {
      return (
        <PatientShell>
          <RestrictedState />
        </PatientShell>
      );
    }
    return (
      <PatientShell>
        <ErrorState
          action={<Button onClick={() => void query.refetch()}>Try again</Button>}
        />
      </PatientShell>
    );
  }

  const data = query.data;
  if (data.assessment && data.assessment.completionStatus !== 'DRAFT') {
    return <SubmittedState data={data} />;
  }
  const serverDraft =
    data.assessment && data.assessment.completionStatus === 'DRAFT'
      ? data.assessment
      : null;
  const currentDraft =
    local &&
    serverDraft &&
    local.assessmentId === serverDraft.assessmentId &&
    local.draftVersion === serverDraft.draftVersion
      ? local
      : serverDraft
        ? fromServerDraft(serverDraft)
        : null;

  if (data.availability !== 'OPEN' && data.availability !== 'LATE') {
    return <NonActionableState data={data} />;
  }

  if (!currentDraft || !data.period) {
    return (
      <PatientShell>
        <ErrorState action={<Button onClick={() => void query.refetch()}>Reload</Button>} />
      </PatientShell>
    );
  }

  const updateAnswers = (changes: Partial<WeeklyAssessmentDraftAnswers>) => {
    setLocal((previous) => ({
      ...currentDraft,
      ...(previous && previous.assessmentId === currentDraft.assessmentId
        ? previous
        : {}),
      answers: {
        ...(previous && previous.assessmentId === currentDraft.assessmentId
          ? previous.answers
          : currentDraft.answers),
        ...changes,
      },
    }));
    setDraftDirty(true);
    setSubmissionAttempt(null);
    setMessage(undefined);
  };

  const updateConsumptionDays = (days: WeeklyConsumptionDraftDay[]) => {
    setLocal((previous) => ({
      ...currentDraft,
      ...(previous && previous.assessmentId === currentDraft.assessmentId
        ? previous
        : {}),
      weeklyConsumptionDays: days,
    }));
    setDraftDirty(true);
    setSubmissionAttempt(null);
    setMessage(undefined);
  };

  const saveDraft = async (targetStep: WeeklyAssessmentDraftStep) => {
    const draft =
      local && local.assessmentId === currentDraft.assessmentId
        ? local
        : currentDraft;
    setSaving(true);
    setMessage(undefined);
    try {
      const request = SaveWeeklyAssessmentDraftRequestSchema.parse({
        expectedDraftVersion: draft.draftVersion,
        currentStep: targetStep,
        answers: draft.answers,
        weeklyConsumptionDays: draft.weeklyConsumptionDays,
      });
      const response = await apiMutate<CheckInStateResponse>(
        `/api/v1/patient/assessments/${draft.assessmentId}/draft` as `/api/v1/${string}`,
        'PUT',
        request,
        { schema: CheckInStateResponseSchema },
      );
      queryClient.setQueryData(['patient', 'check-in'], response);
      setLocal(
        response.assessment && response.assessment.completionStatus === 'DRAFT'
          ? fromServerDraft(response.assessment)
          : null,
      );
      setDraftDirty(false);
      setSubmissionAttempt(null);
      return response;
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.response?.error.code === 'VERSION_CONFLICT'
      ) {
        setMessage(
          'This check-in changed in another session. The latest saved draft has been reloaded.',
        );
        setLocal(null);
        await query.refetch();
      } else if (
        error instanceof ApiClientError &&
        (error.response?.error.code === 'SAFETY_PAUSED' ||
          error.response?.error.code === 'SAFETY_REASSESSMENT_REQUIRED')
      ) {
        setMessage(
          'This check-in is now safety-controlled. Your draft was not changed.',
        );
        await query.refetch();
      } else if (
        error instanceof ApiClientError &&
        error.response?.error.code === 'HISTORICAL_BACKFILL_REQUIRED'
      ) {
        setMessage(
          'This period is now historical because a newer check-in was recorded. The latest state has been reloaded.',
        );
        setLocal(null);
        await query.refetch();
      } else if (
        error instanceof ApiClientError &&
        error.response?.error.code === 'WEEKLY_ALCOHOL_CONFLICT'
      ) {
        setMessage(alcoholConflictMessage(currentDraft));
      } else {
        setMessage('Your draft could not be saved. Please try again.');
      }
      return null;
    } finally {
      setSaving(false);
    }
  };

  const moveTo = async (targetStep: WeeklyAssessmentDraftStep) => {
    await saveDraft(targetStep);
  };

  const saveAndExit = async () => {
    const response = await saveDraft(currentDraft.currentStep);
    if (response) navigate('/patient/profile');
  };

  const submitAssessment = async () => {
    let draft = currentDraft;
    if (draftDirty) {
      const saved = await saveDraft('REVIEW');
      if (!saved?.assessment || saved.assessment.completionStatus !== 'DRAFT') {
        return;
      }
      draft = fromServerDraft(saved.assessment);
    }
    const unanswered = data.instrument.items.filter((item) =>
      item.itemId === 'U1'
        ? draft.answers.U1 === undefined
        : draft.answers[item.itemId] === undefined,
    );
    const completionIntent = unanswered.length === 0 ? 'COMPLETE' : 'PARTIAL';
    const request = SubmitWeeklyAssessmentRequestSchema.parse({
      expectedDraftVersion: draft.draftVersion,
      completionIntent,
    });
    const fingerprint = JSON.stringify({ assessmentId: draft.assessmentId, ...request });
    const attempt =
      submissionAttempt?.fingerprint === fingerprint
        ? submissionAttempt
        : { fingerprint, key: globalThis.crypto.randomUUID() };
    setSubmissionAttempt(attempt);
    setSubmitting(true);
    setMessage(undefined);
    try {
      const response = await apiMutate<CheckInStateResponse>(
        `/api/v1/patient/assessments/${draft.assessmentId}/submit` as `/api/v1/${string}`,
        'POST',
        request,
        {
          schema: CheckInStateResponseSchema,
          headers: { 'Idempotency-Key': attempt.key },
        },
      );
      queryClient.setQueryData(['patient', 'check-in'], response);
      setLocal(null);
      setDraftDirty(false);
      setSubmissionAttempt(null);
      setConfirmingSubmit(false);
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.response?.error.code === 'WEEKLY_ALCOHOL_CONFLICT'
      ) {
        setMessage(alcoholConflictMessage(draft));
      } else if (
        error instanceof ApiClientError &&
        error.response?.error.code === 'HISTORICAL_BACKFILL_REQUIRED'
      ) {
        setMessage(
          'This period is now historical because a newer check-in was recorded. Historical backfill is not available here.',
        );
        setLocal(null);
        await query.refetch();
      } else if (
        error instanceof ApiClientError &&
        error.response?.error.code === 'COMPLETE_REQUIRES_ALL_ITEMS'
      ) {
        setMessage('Answer every question before choosing the complete submission option.');
      } else if (
        error instanceof ApiClientError &&
        error.response?.error.code === 'SAFETY_PAUSED'
      ) {
        setMessage('This check-in is now safety-controlled. Your draft was not submitted.');
        await query.refetch();
      } else {
        setMessage('The check-in could not be submitted. Your saved draft remains available.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const stepIndex = steps.indexOf(currentDraft.currentStep);
  const item = (itemId: string) =>
    data.instrument.items.find((candidate) => candidate.itemId === itemId);

  return (
    <PatientShell>
      <div className="grid gap-6">
        <CheckInHeader data={data} />
        <StepProgress currentStep={currentDraft.currentStep} />
        {message ? (
          <div className="rounded-lg border border-warning-border bg-warning-surface/60 p-4 text-sm text-foreground" role="status">
            {message}
          </div>
        ) : null}
        {data.availability === 'LATE' ? (
          <div className="rounded-lg border border-warning-border bg-warning-surface/50 p-4 text-sm">
            This check-in is still for the completed period shown above. It is
            available late; the recall dates do not change.
          </div>
        ) : null}

        {currentDraft.currentStep === 'ALCOHOL_USE' ? (
          <AlcoholUseStep
            data={data}
            draft={currentDraft}
            item={item('U1')}
            onAnswers={updateAnswers}
            onConsumptionDays={updateConsumptionDays}
          />
        ) : null}
        {currentDraft.currentStep === 'CHALLENGES' ? (
          <ScaleStep
            description="Tell us what felt difficult during this completed period."
            draft={currentDraft}
            itemIds={['R1', 'R2', 'R3', 'R4', 'R5']}
            onAnswers={updateAnswers}
            title="Challenges"
          />
        ) : null}
        {currentDraft.currentStep === 'RECOVERY_SUPPORT' ? (
          <ScaleStep
            description="Reflect on the support and recovery resources that were present."
            draft={currentDraft}
            itemIds={['P1', 'P2', 'P3', 'P4', 'P5']}
            onAnswers={updateAnswers}
            title="Recovery / support"
          />
        ) : null}
        {currentDraft.currentStep === 'REVIEW' ? (
          <ReviewStep
            confirming={confirmingSubmit}
            data={data}
            draft={currentDraft}
            onCancelSubmit={() => setConfirmingSubmit(false)}
            onConfirmSubmit={() => void submitAssessment()}
            onRequestSubmit={() => setConfirmingSubmit(true)}
            submitting={submitting}
          />
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {stepIndex > 0 ? (
              <Button
                disabled={saving || submitting}
                onClick={() => void moveTo(steps[stepIndex - 1]!)}
                variant="outline"
              >
                <ChevronLeft className="size-4" />
                Back
              </Button>
            ) : null}
            <Button
              disabled={saving || submitting}
              onClick={() => void saveAndExit()}
              variant="ghost"
            >
              Save and exit
            </Button>
          </div>
          {stepIndex < steps.length - 1 ? (
            <Button
              disabled={saving || submitting}
              onClick={() => void moveTo(steps[stepIndex + 1]!)}
            >
              {saving ? 'Saving…' : stepIndex === steps.length - 2 ? 'Review' : 'Continue'}
              <ChevronRight className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </PatientShell>
  );
}

function CheckInHeader({ data }: { data: CheckInStateResponse }) {
  const period = data.period;
  return (
    <header className="grid gap-4 border-b pb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Weekly monitoring
          </p>
          <h1 className="mb-0 mt-2 text-3xl font-semibold tracking-[-0.03em]">
            Weekly Recovery Check-In
          </h1>
        </div>
        <CalendarDays aria-hidden="true" className="mt-1 size-7 text-primary" />
      </div>
      {period ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Recall period
          </p>
          <p className="mb-0 mt-1 text-lg font-semibold">
            {formatRecallDate(period.displayRecallStartDate)} –{' '}
            {formatRecallDate(period.displayRecallEndDate)}
          </p>
          <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
            Think only about the completed 7-day period from{' '}
            {formatRecallDate(period.displayRecallStartDate)} through{' '}
            {formatRecallDate(period.displayRecallEndDate)} when answering the
            following questions.
          </p>
        </div>
      ) : null}
      {data.goalContext.goal === 'REDUCTION' ? (
        <Badge variant="information">Reduction calendar included</Badge>
      ) : null}
    </header>
  );
}

function StepProgress({ currentStep }: { currentStep: WeeklyAssessmentDraftStep }) {
  return (
    <nav aria-label="Check-in sections" className="grid gap-2 sm:grid-cols-4">
      {steps.map((step, index) => (
        <div
          className={
            step === currentStep
              ? 'rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-inverse-foreground'
              : 'rounded-lg bg-surface-subtle px-3 py-2 text-sm font-medium text-muted-foreground'
          }
          key={step}
        >
          <span className="mr-2 text-xs opacity-70">0{index + 1}</span>
          {stepLabels[step]}
        </div>
      ))}
    </nav>
  );
}

function AlcoholUseStep({
  data,
  draft,
  item,
  onAnswers,
  onConsumptionDays,
}: {
  data: CheckInStateResponse;
  draft: LocalDraft;
  item:
    | Extract<CheckInStateResponse['instrument']['items'][number], { type: 'BOOLEAN' }>
    | undefined;
  onAnswers: (changes: Partial<WeeklyAssessmentDraftAnswers>) => void;
  onConsumptionDays: (days: WeeklyConsumptionDraftDay[]) => void;
}) {
  return (
    <section className="grid gap-5">
      <div>
        <p className="m-0 text-sm font-semibold text-success">Section 1 of 4</p>
        <h2 className="mb-0 mt-2 text-2xl font-semibold">Alcohol use</h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          Start with the overall alcohol-use question, then add optional daily
          entries when your active goal calls for them.
        </p>
      </div>
      {item ? (
        <BooleanChoice
          labels={item.responseLabels}
          onChange={(value) => onAnswers({ U1: value })}
          prompt={item.prompt}
          value={draft.answers.U1}
        />
      ) : null}
      {data.weeklyConsumptionRequired ? (
        <WeeklyConsumptionCalendar
          dates={data.weeklyConsumptionDates}
          days={draft.weeklyConsumptionDays}
          onChange={onConsumptionDays}
        />
      ) : null}
    </section>
  );
}

function ScaleStep({
  data,
  draft,
  itemIds,
  onAnswers,
  title,
  description,
}: {
  data: CheckInStateResponse;
  draft: LocalDraft;
  itemIds: string[];
  onAnswers: (changes: Partial<WeeklyAssessmentDraftAnswers>) => void;
  title: string;
  description: string;
}) {
  return (
    <section className="grid gap-5">
      <div>
        <p className="m-0 text-sm font-semibold text-success">
          Section {title === 'Challenges' ? '2' : '3'} of 4
        </p>
        <h2 className="mb-0 mt-2 text-2xl font-semibold">{title}</h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {itemIds.map((itemId) => {
        const candidate = data.instrument.items.find(
          (item) => item.itemId === itemId,
        );
        if (!candidate || candidate.type !== 'INTEGER_0_7') return null;
        return (
          <WeeklyScale
            item={candidate}
            key={candidate.itemId}
            onChange={(value) =>
              onAnswers({ [candidate.itemId]: value } as Partial<WeeklyAssessmentDraftAnswers>)
            }
            value={draft.answers[candidate.itemId]}
          />
        );
      })}
    </section>
  );
}

function ReviewStep({
  data,
  draft,
  confirming,
  submitting,
  onRequestSubmit,
  onCancelSubmit,
  onConfirmSubmit,
}: {
  data: CheckInStateResponse;
  draft: LocalDraft;
  confirming: boolean;
  submitting: boolean;
  onRequestSubmit: () => void;
  onCancelSubmit: () => void;
  onConfirmSubmit: () => void;
}) {
  const unanswered = data.instrument.items.filter((item) => {
    if (item.itemId === 'U1') return draft.answers.U1 === undefined;
    return draft.answers[item.itemId] === undefined;
  });

  return (
    <section className="grid gap-5">
      <div>
        <p className="m-0 text-sm font-semibold text-success">Section 4 of 4</p>
        <h2 className="mb-0 mt-2 text-2xl font-semibold">Review your draft</h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          Check what has been saved so far. Unanswered items remain visibly
          unanswered; this draft is not a submitted assessment.
        </p>
      </div>
      {unanswered.length > 0 ? (
        <div className="rounded-xl border border-warning-border bg-warning-surface/50 p-5">
          <p className="m-0 font-semibold">Still unanswered</p>
          <p className="mb-0 mt-2 text-sm text-muted-foreground">
            {unanswered.map((item) => item.itemId).join(', ')}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-success-border bg-success-surface/50 p-5 text-sm">
          All eleven questions have an answer. You can submit this check-in as
          a complete authoritative weekly record.
        </div>
      )}
      <Card>
        <CardHeader>
          <h3 className="m-0 text-lg font-semibold">Answers</h3>
        </CardHeader>
        <CardContent className="grid gap-2">
          {data.instrument.items.map((item) => {
            const value =
              item.itemId === 'U1'
                ? draft.answers.U1 === undefined
                  ? 'Unanswered'
                  : draft.answers.U1
                    ? 'Yes'
                    : 'No'
                : draft.answers[item.itemId] === undefined
                  ? 'Unanswered'
                  : String(draft.answers[item.itemId]);
            return (
              <div
                className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0"
                key={item.itemId}
              >
                <span className="text-sm font-semibold">{item.itemId}</span>
                <span className="text-right text-sm text-muted-foreground">{value}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
      {data.weeklyConsumptionRequired ? (
        <Card>
          <CardHeader>
            <h3 className="m-0 text-lg font-semibold">Alcohol days</h3>
          </CardHeader>
          <CardContent className="grid gap-2">
            {data.weeklyConsumptionDates.map((date) => {
              const day = draft.weeklyConsumptionDays.find(
                (candidate) => candidate.localDate === date,
              );
              return (
                <div className="flex justify-between border-b py-2 text-sm last:border-b-0" key={date}>
                  <span>{date}</span>
                  <span className="text-muted-foreground">
                    {!day || day.status === 'UNKNOWN'
                      ? !day
                        ? 'Not entered'
                        : 'Unknown'
                      : day.status === 'KNOWN_ZERO'
                        ? '0 drinks'
                        : `${day.standardDrinks ?? 'Incomplete'} drinks`}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <p className="m-0 font-semibold">
          {unanswered.length === 0 ? 'Submit check-in' : 'Submit available answers'}
        </p>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          This creates a real submitted check-in for the period above. Any
          unanswered questions remain unknown and are not filled in for you.
        </p>
        {!confirming ? (
          <Button
            className="mt-4"
            disabled={submitting}
            onClick={onRequestSubmit}
          >
            {unanswered.length === 0 ? 'Submit check-in' : 'Submit available answers'}
          </Button>
        ) : (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm">
              Confirm that you want to create this submitted weekly record.
            </p>
            <div className="flex gap-2">
              <Button disabled={submitting} onClick={onCancelSubmit} variant="outline">
                Cancel
              </Button>
              <Button disabled={submitting} onClick={onConfirmSubmit}>
                {submitting ? 'Submitting…' : 'Confirm submission'}
              </Button>
            </div>
          </div>
        )}
      </div>
      <p className="m-0 text-sm text-muted-foreground">
        Use Back to make changes or Save and exit to keep this draft for later.
      </p>
    </section>
  );
}

function SubmittedState({ data }: { data: CheckInStateResponse }) {
  const assessment = data.assessment;
  if (!assessment || assessment.completionStatus === 'DRAFT') {
    return <NonActionableState data={data} />;
  }
  return (
    <PatientShell>
      <div className="grid gap-6">
        <CheckInHeader data={data} />
        <div className="rounded-xl border border-success-border bg-success-surface/50 p-6" role="status">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-success">
            Check-in recorded
          </p>
          <h1 className="mb-0 mt-2 text-2xl font-semibold">
            Your weekly check-in was submitted.
          </h1>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Completion</dt>
              <dd className="m-0 font-semibold">
                {assessment.completionStatus === 'COMPLETE' ? 'Complete' : 'Partial'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd className="m-0 font-semibold">
                {new Date(assessment.submittedAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Revision</dt>
              <dd className="m-0 font-semibold">{assessment.revisionNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Timing</dt>
              <dd className="m-0 font-semibold">
                {assessment.submissionClassification === 'LATE_CURRENT'
                  ? 'Submitted late'
                  : 'Submitted during the current window'}
              </dd>
            </div>
          </dl>
          <p className="mb-0 mt-5 text-sm leading-6 text-muted-foreground">
            This page shows the submitted period and record status. It does not
            change the submitted answers.
          </p>
        </div>
      </div>
    </PatientShell>
  );
}

function alcoholConflictMessage(draft: LocalDraft) {
  const answer =
    draft.answers.U1 === undefined
      ? 'unanswered'
      : draft.answers.U1
        ? 'Yes'
        : 'No';
  const enteredDays = draft.weeklyConsumptionDays
    .filter(
      (day) =>
        day.status === 'KNOWN_QUANTITY' && (day.standardDrinks ?? 0) > 0,
    )
    .map((day) => day.localDate)
    .join(', ');
  const allKnownZero =
    draft.weeklyConsumptionDays.length === 7 &&
    draft.weeklyConsumptionDays.every((day) => day.status === 'KNOWN_ZERO');
  if (draft.answers.U1 === true && allKnownZero) {
    return 'Your U1 answer is Yes, but the weekly calendar records zero drinks for all seven days. Correct the U1 answer or the calendar entries before submitting.';
  }
  return enteredDays
    ? `Your U1 answer is ${answer}, but the calendar shows positive quantities on ${enteredDays}. Correct the U1 answer or those calendar entries before submitting.`
    : `Your U1 answer is ${answer}, but it conflicts with the weekly calendar. Correct one of the sources before submitting.`;
}

function NonActionableState({ data }: { data: CheckInStateResponse }) {
  const period = data.period;
  const title: Record<CheckInAvailability, string> = {
    NOT_ACTIVATED: 'Finish setup before your first check-in',
    UPCOMING: 'Your next check-in is not open yet',
    HISTORICAL: 'This check-in is historical',
    SAFETY_PAUSED: 'Check-ins are paused for safety',
    SAFETY_REASSESSMENT_REQUIRED: 'A safety reassessment is required',
    OPEN: 'Weekly Recovery Check-In',
    LATE: 'Weekly Recovery Check-In',
  }[data.availability];
  const description: Record<CheckInAvailability, string> = {
    NOT_ACTIVATED:
      'Your weekly monitoring schedule is not active yet. Complete the patient setup flow before starting a check-in.',
    UPCOMING:
      'The next persisted monitoring period will become available at its scheduled opening time.',
    HISTORICAL:
      'Historical check-in workflows are not available in this draft release.',
    SAFETY_PAUSED:
      'The backend safety state has paused weekly prompts. This page cannot override that state.',
    SAFETY_REASSESSMENT_REQUIRED:
      'The backend requires a safety reassessment before weekly monitoring can continue. There is no self-service bypass.',
    OPEN: '',
    LATE: '',
  }[data.availability];

  return (
    <PatientShell navigation={data.availability !== 'SAFETY_PAUSED' && data.availability !== 'SAFETY_REASSESSMENT_REQUIRED'}>
      <div className="grid gap-6">
        {period ? <CheckInHeader data={data} /> : null}
        <div className="flex items-start gap-4 rounded-xl border border-restricted-border bg-restricted-surface/50 p-6" role="status">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-restricted-surface text-restricted">
            <ShieldAlert aria-hidden="true" />
          </span>
          <div>
            <h1 className="m-0 text-2xl font-semibold">{title}</h1>
            <p className="mb-0 mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            {period && data.availability === 'UPCOMING' ? (
              <p className="mb-0 mt-4 text-sm font-semibold">
                Opens at {period.openAt}.
              </p>
            ) : null}
          </div>
        </div>
        {data.availability === 'NOT_ACTIVATED' ? (
          <Link to="/patient/onboarding">
            <Button>Continue setup</Button>
          </Link>
        ) : null}
        {(data.availability === 'SAFETY_PAUSED' ||
          data.availability === 'SAFETY_REASSESSMENT_REQUIRED') &&
        data.safety.patientRouteActions.length > 0 ? (
          <Card>
            <CardHeader>
              <h2 className="m-0 text-lg font-semibold">Configured support</h2>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.safety.patientRouteActions.map((action) =>
                action.href ? (
                  <a
                    className="inline-flex min-h-[var(--control-height)] items-center justify-center rounded-md bg-primary px-4 text-center text-sm font-semibold text-inverse-foreground"
                    href={action.href}
                    key={`${action.label}:${action.href}`}
                  >
                    {action.label}
                  </a>
                ) : (
                  <p className="m-0 rounded-lg border p-3 text-sm" key={action.label}>
                    {action.label}
                  </p>
                ),
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PatientShell>
  );
}

function fromServerDraft(
  draft: Extract<
    NonNullable<CheckInStateResponse['assessment']>,
    { completionStatus: 'DRAFT' }
  >,
): LocalDraft {
  return {
    assessmentId: draft.assessmentId,
    draftVersion: draft.draftVersion,
    currentStep: draft.currentStep,
    answers: draft.answers,
    weeklyConsumptionDays: draft.weeklyConsumptionDays,
  };
}

function formatRecallDate(localDate: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${localDate}T12:00:00Z`));
}
