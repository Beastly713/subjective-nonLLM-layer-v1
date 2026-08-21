import {
  EngagementReminderViewSchema,
  PatientHomeResponseSchema,
  PatientMonitoringResponseSchema,
  type PatientHomeResponse,
  type PatientMonitoringResponse,
} from '@aud-subjective/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { SUBJECTIVE_MONITORING_V1 } from '../../policy/subjective-monitoring-v1.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { readPatientSupport } from '../content/service.js';
import { resolveRecoveryGoalForPeriod } from '../profiles/period-context.js';
import { loadPatientSafetyProjection } from '../safety/projections.js';
import { ensureRelevantPeriodsInTransaction } from '../scheduling/service.js';
import { evaluateEngagement } from './domain/evaluate-engagement.js';

type Tx = Prisma.TransactionClient;
const DAY_MS = 24 * 60 * 60 * 1_000;

type ReconcileInput = {
  tx: Tx;
  clock: Clock;
  patientId: string;
  actorId?: string;
  requestId?: string;
};

type StateWithPeriod = Prisma.EngagementStateGetPayload<{
  include: { missedCyclePeriod: true };
}>;

type PeriodWithAssessment = Prisma.ScheduledPeriodGetPayload<{
  include: {
    weeklyAssessments: {
      select: {
        authoritativeRevision: {
          select: {
            id: true;
            completionStatus: true;
            submissionClassification: true;
            submittedAt: true;
          };
        };
      };
    };
  };
}>;

function periodWithAssessmentInclude() {
  return {
    weeklyAssessments: {
      select: {
        authoritativeRevision: {
          select: {
            id: true,
            completionStatus: true,
            submissionClassification: true,
            submittedAt: true,
          },
        },
      },
    },
  } as const;
}

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function periodView(period: {
  id: string;
  periodStartAt: Date;
  periodEndAt: Date;
  openAt: Date;
  originalDueAt?: Date;
  effectiveDueAt: Date;
}) {
  return {
    periodId: period.id,
    periodStartAt: period.periodStartAt.toISOString(),
    periodEndAt: period.periodEndAt.toISOString(),
    ...(period.originalDueAt
      ? { originalDueAt: period.originalDueAt.toISOString() }
      : {}),
    openAt: period.openAt.toISOString(),
    effectiveDueAt: period.effectiveDueAt.toISOString(),
  };
}

async function loadState(tx: Tx, patientId: string) {
  return tx.engagementState.findUnique({
    where: { patientId },
    include: { missedCyclePeriod: true },
  });
}

async function ensureState(input: ReconcileInput, now: Date) {
  const existing = await loadState(input.tx, input.patientId);
  if (existing) return existing;
  const created = await input.tx.engagementState.create({
    data: {
      patientId: input.patientId,
      state: 'ENGAGED',
      version: 1,
      lastTransitionAt: now,
      updatedAt: now,
    },
    include: { missedCyclePeriod: true },
  });
  await input.tx.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      action: 'ENGAGEMENT_STATE_INITIALIZED',
      entityType: 'ENGAGEMENT_STATE',
      entityId: input.patientId,
      patientId: input.patientId,
      occurredAt: now,
      configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      requestId: input.requestId ?? null,
      metadata: json({ state: created.state }),
    },
  });
  return created;
}

async function findEarliestMissedPeriod(
  tx: Tx,
  patientId: string,
  now: Date,
  state: StateWithPeriod,
) {
  if (state.missedCyclePeriod) return state.missedCyclePeriod;

  const periods = (await tx.scheduledPeriod.findMany({
    where: {
      patientId,
      effectiveDueAt: { lte: now },
      ...(state.cycleTrackingFromAt
        ? { periodStartAt: { gte: state.cycleTrackingFromAt } }
        : {}),
    },
    include: periodWithAssessmentInclude(),
    orderBy: [{ periodStartAt: 'asc' }, { id: 'asc' }],
  })) as PeriodWithAssessment[];

  return (
    periods.find(
      (period) =>
        !period.weeklyAssessments.some(
          (assessment) => assessment.authoritativeRevision !== null,
        ),
    ) ?? null
  );
}

async function findReturningSubmission(
  tx: Tx,
  patientId: string,
  anchor: { periodStartAt: Date },
) {
  const assessments = await tx.weeklyAssessment.findMany({
    where: {
      patientId,
      scheduledPeriod: { periodStartAt: { gte: anchor.periodStartAt } },
      authoritativeRevisionId: { not: null },
    },
    select: {
      scheduledPeriod: {
        select: {
          id: true,
          periodStartAt: true,
        },
      },
      authoritativeRevision: {
        select: {
          id: true,
          completionStatus: true,
          submissionClassification: true,
        },
      },
    },
    orderBy: [{ scheduledPeriod: { periodStartAt: 'asc' } }, { id: 'asc' }],
  });

  return (
    assessments.find((assessment) => {
      const classification = assessment.authoritativeRevision
        ?.submissionClassification;
      return classification === 'CURRENT' || classification === 'LATE_CURRENT';
    }) ?? null
  );
}

async function cancelReminders(
  tx: Tx,
  patientId: string,
  now: Date,
  reason: string,
  periodId?: string,
) {
  await tx.missedCheckinReminder.updateMany({
    where: {
      patientId,
      cancelledAt: null,
      ...(periodId ? { missedCyclePeriodId: periodId } : {}),
    },
    data: {
      cancelledAt: now,
      cancellationReason: reason,
    },
  });
}

async function upsertReminderSlots(
  tx: Tx,
  input: {
    patientId: string;
    periodId: string;
    effectiveDueAt: Date;
    now: Date;
  },
) {
  const policy = SUBJECTIVE_MONITORING_V1.engagement;
  const slots: Array<{ reminderNumber: 1 | 2; eligibleAt: Date }> = [
    {
      reminderNumber: 1,
      eligibleAt: new Date(
        input.effectiveDueAt.getTime() +
          policy.firstReminderDaysAfterEffectiveDue * DAY_MS,
      ),
    },
    {
      reminderNumber: 2,
      eligibleAt: new Date(
        input.effectiveDueAt.getTime() +
          policy.secondFinalReminderDaysAfterEffectiveDue * DAY_MS,
      ),
    },
  ];

  for (const slot of slots.slice(0, policy.maxAutomatedRemindersPerCycle)) {
    await tx.missedCheckinReminder.upsert({
      where: {
        patientId_missedCyclePeriodId_reminderNumber: {
          patientId: input.patientId,
          missedCyclePeriodId: input.periodId,
          reminderNumber: slot.reminderNumber,
        },
      },
      create: {
        patientId: input.patientId,
        missedCyclePeriodId: input.periodId,
        reminderNumber: slot.reminderNumber,
        eligibleAt: slot.eligibleAt,
        createdAt: input.now,
        updatedAt: input.now,
      },
      update: {
        eligibleAt: slot.eligibleAt,
      },
    });
  }
}

async function transitionState(
  input: ReconcileInput,
  current: StateWithPeriod,
  next: {
    state: StateWithPeriod['state'];
    missedCyclePeriodId: string | null;
    sourceEffectiveDueAt: Date | null;
    cycleTrackingFromAt?: Date | null;
    optedOutAt?: Date | null;
    returnedAfterGapAt?: Date | null;
    lastValidAssessmentRevisionId?: string | null;
    lastValidPeriodId?: string | null;
  },
  now: Date,
) {
  const changed =
    current.state !== next.state ||
    current.missedCyclePeriodId !== next.missedCyclePeriodId ||
    current.sourceEffectiveDueAt?.getTime() !==
      next.sourceEffectiveDueAt?.getTime() ||
    (next.cycleTrackingFromAt !== undefined &&
      current.cycleTrackingFromAt?.getTime() !==
        next.cycleTrackingFromAt?.getTime()) ||
    (next.optedOutAt !== undefined &&
      current.optedOutAt?.getTime() !== next.optedOutAt?.getTime()) ||
    (next.returnedAfterGapAt !== undefined &&
      current.returnedAfterGapAt?.getTime() !==
        next.returnedAfterGapAt?.getTime()) ||
    (next.lastValidAssessmentRevisionId !== undefined &&
      current.lastValidAssessmentRevisionId !==
        next.lastValidAssessmentRevisionId) ||
    (next.lastValidPeriodId !== undefined &&
      current.lastValidPeriodId !== next.lastValidPeriodId);

  if (!changed) return current;

  const updated = await input.tx.engagementState.update({
    where: { patientId: input.patientId },
    data: {
      state: next.state,
      version: { increment: 1 },
      missedCyclePeriodId: next.missedCyclePeriodId,
      sourceEffectiveDueAt: next.sourceEffectiveDueAt,
      ...(next.cycleTrackingFromAt !== undefined
        ? { cycleTrackingFromAt: next.cycleTrackingFromAt }
        : {}),
      ...(next.optedOutAt !== undefined
        ? { optedOutAt: next.optedOutAt }
        : {}),
      ...(next.returnedAfterGapAt !== undefined
        ? { returnedAfterGapAt: next.returnedAfterGapAt }
        : {}),
      ...(next.lastValidAssessmentRevisionId !== undefined
        ? { lastValidAssessmentRevisionId: next.lastValidAssessmentRevisionId }
        : {}),
      ...(next.lastValidPeriodId !== undefined
        ? { lastValidPeriodId: next.lastValidPeriodId }
        : {}),
      lastTransitionAt: now,
      updatedAt: now,
    },
    include: { missedCyclePeriod: true },
  });

  await input.tx.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      action: 'ENGAGEMENT_STATE_CHANGED',
      entityType: 'ENGAGEMENT_STATE',
      entityId: input.patientId,
      patientId: input.patientId,
      occurredAt: now,
      configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      requestId: input.requestId ?? null,
      metadata: json({
        fromState: current.state,
        toState: next.state,
        fromMissedCyclePeriodId: current.missedCyclePeriodId,
        toMissedCyclePeriodId: next.missedCyclePeriodId,
      }),
    },
  });
  return updated;
}

async function applyReturnAfterGap(
  input: ReconcileInput,
  current: StateWithPeriod,
  returning: {
    scheduledPeriod: { id: string; periodStartAt: Date };
    authoritativeRevision: { id: string } | null;
  },
  now: Date,
) {
  if (!current.missedCyclePeriodId || !returning.authoritativeRevision) {
    return current;
  }

  await cancelReminders(
    input.tx,
    input.patientId,
    now,
    'RETURNED_AFTER_GAP',
    current.missedCyclePeriodId,
  );
  const returned = await transitionState(
    input,
    current,
    {
      state: 'RETURNED_AFTER_GAP',
      missedCyclePeriodId: current.missedCyclePeriodId,
      sourceEffectiveDueAt: current.sourceEffectiveDueAt,
      returnedAfterGapAt: now,
      lastValidAssessmentRevisionId: returning.authoritativeRevision.id,
      lastValidPeriodId: returning.scheduledPeriod.id,
    },
    now,
  );
  await input.tx.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      action: 'ENGAGEMENT_RETURNED_AFTER_GAP',
      entityType: 'ENGAGEMENT_STATE',
      entityId: input.patientId,
      patientId: input.patientId,
      occurredAt: now,
      configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      requestId: input.requestId ?? null,
      metadata: json({
        missedCyclePeriodId: current.missedCyclePeriodId,
        returningPeriodId: returning.scheduledPeriod.id,
        revisionId: returning.authoritativeRevision.id,
      }),
    },
  });
  return transitionState(
    input,
    returned,
    {
      state: 'ENGAGED',
      missedCyclePeriodId: null,
      sourceEffectiveDueAt: null,
      cycleTrackingFromAt: returning.scheduledPeriod.periodStartAt,
      returnedAfterGapAt: now,
      lastValidAssessmentRevisionId: returning.authoritativeRevision.id,
      lastValidPeriodId: returning.scheduledPeriod.id,
    },
    now,
  );
}

export async function reconcileEngagementForPatient(input: ReconcileInput) {
  const now = input.clock.now();
  await lockPatientForProcessing(input.tx, input.patientId);
  await ensureRelevantPeriodsInTransaction(input.tx, input.clock, input.patientId);

  let state = await ensureState(input, now);
  const safety = await loadPatientSafetyProjection(input.tx, input.patientId);

  if (state.state === 'OPTED_OUT' || state.optedOutAt) {
    await cancelReminders(
      input.tx,
      input.patientId,
      now,
      'MONITORING_OPTED_OUT',
    );
    return {
      state,
      safety,
      anchor: null,
      evaluation: evaluateEngagement({
        now,
        effectiveDueAt: null,
        hasMissedCycle: false,
        safetyPaused: false,
        technicalFailureActive: false,
        optedOut: true,
      }),
    };
  }

  let anchor = await findEarliestMissedPeriod(
    input.tx,
    input.patientId,
    now,
    state,
  );

  if (anchor && state.missedCyclePeriodId) {
    const returning = await findReturningSubmission(
      input.tx,
      input.patientId,
      anchor,
    );
    if (returning) {
      state = await applyReturnAfterGap(input, state, returning, now);
      anchor = null;
    }
  }

  if (!anchor && state.missedCyclePeriodId) {
    state = (await loadState(input.tx, input.patientId)) ?? state;
    anchor = await findEarliestMissedPeriod(
      input.tx,
      input.patientId,
      now,
      state,
    );
  }

  const evaluation = evaluateEngagement({
    now,
    effectiveDueAt: anchor?.effectiveDueAt ?? null,
    hasMissedCycle: Boolean(anchor),
    safetyPaused: safety.monitoringPromptPolicy === 'PAUSE',
    technicalFailureActive: false,
    optedOut: false,
  });

  if (anchor && evaluation.pauseReason === null) {
    await upsertReminderSlots(input.tx, {
      patientId: input.patientId,
      periodId: anchor.id,
      effectiveDueAt: anchor.effectiveDueAt,
      now,
    });
  }

  state = (await loadState(input.tx, input.patientId)) ?? state;
  state = await transitionState(
    input,
    state,
    {
      state: evaluation.state,
      missedCyclePeriodId: anchor?.id ?? null,
      sourceEffectiveDueAt: anchor?.effectiveDueAt ?? null,
    },
    now,
  );

  return { state, safety, anchor, evaluation };
}

function reminderView(
  reminder: {
    id: string;
    reminderNumber: number;
    eligibleAt: Date;
    presentedAt: Date | null;
    cancelledAt: Date | null;
    cancellationReason: string | null;
  },
  now: Date,
) {
  const reminderNumber = reminder.reminderNumber === 2 ? 2 : 1;
  const presentationStatus = reminder.cancelledAt
    ? 'CANCELLED'
    : reminder.presentedAt
      ? 'PRESENTED'
      : now >= reminder.eligibleAt
        ? 'ELIGIBLE'
        : 'UPCOMING';
  return EngagementReminderViewSchema.parse({
    id: reminder.id,
    reminderNumber,
    eligibleAt: reminder.eligibleAt.toISOString(),
    presentedAt: reminder.presentedAt?.toISOString() ?? null,
    cancelledAt: reminder.cancelledAt?.toISOString() ?? null,
    cancellationReason: reminder.cancellationReason,
    presentationStatus,
  });
}

async function loadReminders(
  tx: Tx,
  patientId: string,
  now: Date,
  periodId?: string | null,
) {
  const rows = await tx.missedCheckinReminder.findMany({
    where: {
      patientId,
      ...(periodId ? { missedCyclePeriodId: periodId } : {}),
    },
    orderBy: [{ reminderNumber: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map((row) => reminderView(row, now));
}

async function currentPeriod(tx: Tx, patientId: string, now: Date) {
  return (
    (await tx.scheduledPeriod.findFirst({
      where: { patientId, openAt: { lte: now } },
      include: {
        scheduleVersion: { select: { version: true } },
        weeklyAssessments: {
          where: {
            instrumentId: 'AUD_WEEKLY_CHECKIN',
            instrumentVersion: '1.0',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            authoritativeRevision: {
              select: {
                id: true,
                completionStatus: true,
                submittedAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ periodStartAt: 'desc' }, { id: 'desc' }],
    })) ??
    (await tx.scheduledPeriod.findFirst({
      where: { patientId },
      include: {
        scheduleVersion: { select: { version: true } },
        weeklyAssessments: {
          where: {
            instrumentId: 'AUD_WEEKLY_CHECKIN',
            instrumentVersion: '1.0',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            authoritativeRevision: {
              select: {
                id: true,
                completionStatus: true,
                submittedAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ periodStartAt: 'asc' }, { id: 'asc' }],
    }))
  );
}

function checkInProjection(
  period: Awaited<ReturnType<typeof currentPeriod>>,
  now: Date,
) {
  if (!period) {
    return {
      availability: 'NOT_ACTIVATED' as const,
      period: null,
      assessmentId: null,
      completionStatus: null,
      submittedAt: null,
    };
  }
  const assessment = period.weeklyAssessments[0] ?? null;
  const submitted = assessment?.authoritativeRevision ?? null;
  const availability =
    submitted !== null
      ? ('SUBMITTED' as const)
      : assessment
        ? ('IN_PROGRESS' as const)
        : now < period.openAt
          ? ('UPCOMING' as const)
          : now >= period.effectiveDueAt
            ? ('LATE' as const)
            : ('READY' as const);
  return {
    availability,
    period: period
      ? {
          periodId: period.id,
          periodStartAt: period.periodStartAt.toISOString(),
          periodEndAt: period.periodEndAt.toISOString(),
          openAt: period.openAt.toISOString(),
          originalDueAt: period.originalDueAt.toISOString(),
          effectiveDueAt: period.effectiveDueAt.toISOString(),
        }
      : null,
    assessmentId: assessment?.id ?? null,
    completionStatus: submitted?.completionStatus ?? assessment?.completionStatus ?? null,
    submittedAt: submitted?.submittedAt.toISOString() ?? null,
  };
}

function noticeForState(
  state: ReturnType<typeof evaluateEngagement>['state'],
  reminders: ReturnType<typeof reminderView>[],
) {
  if (state === 'OPTED_OUT') {
    return {
      kind: 'OPTED_OUT' as const,
      title: 'Monitoring is paused',
      message:
        'Your check-in reminders are paused. You can re-enable monitoring whenever you are ready.',
    };
  }
  if (state === 'TECHNICAL_FAILURE') {
    return {
      kind: 'TECHNICAL_FAILURE' as const,
      title: 'Check-in timing is paused',
      message:
        'We are reviewing an access issue. Your monitoring timing will resume when the issue is resolved.',
    };
  }
  const eligible = reminders
    .filter(
      (reminder) =>
        reminder.presentationStatus === 'ELIGIBLE' ||
        reminder.presentationStatus === 'PRESENTED',
    )
    .sort((left, right) => right.reminderNumber - left.reminderNumber)[0];
  if (state === 'DISENGAGED') {
    return {
      kind: 'DISENGAGED' as const,
      title: 'You can return when you are ready',
      message:
        'Your monitoring gap is still open. Completing the current check-in is the next step whenever it feels manageable.',
    };
  }
  if (eligible?.reminderNumber === 2 || state === 'AT_RISK_OF_DISENGAGEMENT') {
    return {
      kind: 'FINAL_REMINDER' as const,
      title: 'Your check-in is ready',
      message:
        'A current check-in is available. Completing it helps keep your monitoring record up to date.',
    };
  }
  if (eligible?.reminderNumber === 1) {
    return {
      kind: 'FIRST_REMINDER' as const,
      title: 'A gentle check-in reminder',
      message:
        'Your weekly check-in is available whenever you have a moment. There is no need to explain anything beyond the check-in itself.',
    };
  }
  if (state === 'OVERDUE') {
    return {
      kind: 'OVERDUE' as const,
      title: 'Your check-in is available',
      message:
        'Your weekly check-in is still available. You can complete it whenever you are ready.',
    };
  }
  return null;
}

export async function readPatientMonitoring(
  tx: Tx,
  clock: Clock,
  patientId: string,
  actorId?: string,
  requestId?: string,
): Promise<PatientMonitoringResponse> {
  const result = await reconcileEngagementForPatient({
    tx,
    clock,
    patientId,
    ...(actorId ? { actorId } : {}),
    ...(requestId ? { requestId } : {}),
  });
  const now = clock.now();
  const reminders = await loadReminders(
    tx,
    patientId,
    now,
    result.state.missedCyclePeriodId,
  );
  return PatientMonitoringResponseSchema.parse({
    patientId,
    state: result.state.state,
    version: result.state.version,
    optedOutAt: result.state.optedOutAt?.toISOString() ?? null,
    cycleTrackingFromAt: result.state.cycleTrackingFromAt?.toISOString() ?? null,
    missedCycle: result.anchor
      ? {
          periodId: result.anchor.id,
          periodStartAt: result.anchor.periodStartAt.toISOString(),
          periodEndAt: result.anchor.periodEndAt.toISOString(),
          effectiveDueAt: result.anchor.effectiveDueAt.toISOString(),
        }
      : null,
    reminders,
  });
}

export async function readPatientHome(
  tx: Tx,
  clock: Clock,
  patientId: string,
  actorId?: string,
  requestId?: string,
): Promise<PatientHomeResponse> {
  const result = await reconcileEngagementForPatient({
    tx,
    clock,
    patientId,
    ...(actorId ? { actorId } : {}),
    ...(requestId ? { requestId } : {}),
  });
  const now = clock.now();
  const [patient, period, support] = await Promise.all([
    tx.user.findUnique({ where: { id: patientId }, select: { name: true } }),
    currentPeriod(tx, patientId, now),
    readPatientSupport(tx, clock, patientId),
  ]);
  if (!patient) throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');

  const checkIn = checkInProjection(period, now);
  const reminders = await loadReminders(
    tx,
    patientId,
    now,
    result.state.missedCyclePeriodId,
  );
  const stateEvaluation = result.evaluation;
  const safetyControlled =
    result.safety.requiresSafetyShell ||
    result.safety.monitoringPromptPolicy === 'PAUSE';
  const goal = period
    ? await resolveRecoveryGoalForPeriod(tx, patientId, period as never)
    : null;
  const notice = safetyControlled
    ? null
    : noticeForState(stateEvaluation.state, reminders);

  let primaryAction: PatientHomeResponse['primaryAction'];
  if (safetyControlled) {
    primaryAction = {
      kind: 'SAFETY',
      label: 'View safety guidance',
      href: null,
      supportingText:
        'Your safety-controlled experience takes priority over ordinary monitoring.',
    };
  } else if (stateEvaluation.state === 'OPTED_OUT') {
    primaryAction = {
      kind: 'RE_ENABLE_MONITORING',
      label: 'Re-enable monitoring',
      href: '/patient/profile',
      supportingText:
        'Monitoring remains paused until you explicitly turn it back on.',
    };
  } else if (checkIn.availability === 'NOT_ACTIVATED') {
    primaryAction = {
      kind: 'SETUP',
      label: 'Continue setup',
      href: '/patient/onboarding',
      supportingText: 'Finish setup before starting weekly monitoring.',
    };
  } else if (checkIn.availability === 'UPCOMING') {
    primaryAction = {
      kind: 'UPCOMING_CHECK_IN',
      label: 'View this week’s check-in',
      href: '/patient/check-in',
      supportingText: 'Your next check-in will open at the scheduled time.',
    };
  } else if (checkIn.availability === 'IN_PROGRESS') {
    primaryAction = {
      kind: 'CONTINUE_CHECK_IN',
      label: 'Continue check-in',
      href: '/patient/check-in/action',
      supportingText: 'Pick up where you left off in your current check-in.',
    };
  } else if (checkIn.availability === 'SUBMITTED') {
    primaryAction = {
      kind: 'VIEW_SUBMISSION',
      label: 'View check-in history',
      href: '/patient/check-in/history',
      supportingText: 'Your current check-in has been recorded.',
    };
  } else {
    primaryAction = {
      kind: 'START_CHECK_IN',
      label: stateEvaluation.state === 'DISENGAGED' ? 'Return to check-in' : 'Start check-in',
      href: '/patient/check-in/action',
      supportingText:
        stateEvaluation.state === 'DISENGAGED'
          ? 'A new check-in is the simplest way to return to monitoring.'
          : 'Complete the current weekly check-in when you are ready.',
    };
  }

  return PatientHomeResponseSchema.parse({
    patientId,
    patientName: patient.name,
    presentationMode: safetyControlled ? 'SAFETY_CONTROLLED' : 'ORDINARY',
    safety: result.safety,
    primaryAction,
    checkIn,
    engagement: {
      state: stateEvaluation.state,
      timingPaused: stateEvaluation.timingPaused,
      pauseReason: stateEvaluation.pauseReason,
      missedCycle: result.anchor
        ? {
            periodId: result.anchor.id,
            periodStartAt: result.anchor.periodStartAt.toISOString(),
            periodEndAt: result.anchor.periodEndAt.toISOString(),
            effectiveDueAt: result.anchor.effectiveDueAt.toISOString(),
          }
        : null,
      overdueDays: stateEvaluation.overdueDays,
      reminders,
      notice,
    },
    monitoring: {
      state: result.state.state,
      version: result.state.version,
      optedOutAt: result.state.optedOutAt?.toISOString() ?? null,
    },
    goalSummary: {
      goal: goal?.goal ?? null,
      label: goal?.goal
        ? goal.goal === 'ABSTINENCE'
          ? 'Abstinence support'
          : goal.goal === 'REDUCTION'
            ? 'Reduction support'
            : 'Your monitoring plan'
        : 'Your monitoring plan',
    },
    supportSummary: {
      available: support.primary !== null || support.secondary !== null,
      label:
        support.primary?.title ??
        support.secondary?.title ??
        'Support is available from your Support space.',
      href: '/patient/support',
    },
  });
}

export async function optOutMonitoring(input: {
  tx: Tx;
  clock: Clock;
  patientId: string;
  expectedVersion: number;
  actorId: string;
  requestId: string;
}) {
  const now = input.clock.now();
  await lockPatientForProcessing(input.tx, input.patientId);
  const current = await ensureState(
    {
      tx: input.tx,
      clock: input.clock,
      patientId: input.patientId,
      actorId: input.actorId,
      requestId: input.requestId,
    },
    now,
  );
  if (current.version !== input.expectedVersion) {
    throw new DomainError(409, 'VERSION_CONFLICT', 'Monitoring changed before this action.');
  }
  if (current.state !== 'OPTED_OUT') {
    await input.tx.engagementState.update({
      where: { patientId: input.patientId },
      data: {
        state: 'OPTED_OUT',
        version: { increment: 1 },
        missedCyclePeriodId: null,
        sourceEffectiveDueAt: null,
        cycleTrackingFromAt: now,
        optedOutAt: now,
        lastTransitionAt: now,
        updatedAt: now,
      },
    });
    await input.tx.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: 'PATIENT_MONITORING_OPT_OUT',
        entityType: 'ENGAGEMENT_STATE',
        entityId: input.patientId,
        patientId: input.patientId,
        occurredAt: now,
        requestId: input.requestId,
        configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      },
    });
  }
  await cancelReminders(input.tx, input.patientId, now, 'MONITORING_OPTED_OUT');
  return readPatientMonitoring(
    input.tx,
    input.clock,
    input.patientId,
    input.actorId,
    input.requestId,
  );
}

export async function reEnableMonitoring(input: {
  tx: Tx;
  clock: Clock;
  patientId: string;
  expectedVersion: number;
  actorId: string;
  requestId: string;
}) {
  const now = input.clock.now();
  await lockPatientForProcessing(input.tx, input.patientId);
  const current = await ensureState(
    {
      tx: input.tx,
      clock: input.clock,
      patientId: input.patientId,
      actorId: input.actorId,
      requestId: input.requestId,
    },
    now,
  );
  if (current.version !== input.expectedVersion) {
    throw new DomainError(409, 'VERSION_CONFLICT', 'Monitoring changed before this action.');
  }
  if (current.state === 'OPTED_OUT') {
    await input.tx.engagementState.update({
      where: { patientId: input.patientId },
      data: {
        state: 'ENGAGED',
        version: { increment: 1 },
        missedCyclePeriodId: null,
        sourceEffectiveDueAt: null,
        cycleTrackingFromAt: now,
        optedOutAt: null,
        lastTransitionAt: now,
        updatedAt: now,
      },
    });
    await input.tx.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: 'PATIENT_MONITORING_RE_ENABLE',
        entityType: 'ENGAGEMENT_STATE',
        entityId: input.patientId,
        patientId: input.patientId,
        occurredAt: now,
        requestId: input.requestId,
        configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      },
    });
  }
  return readPatientMonitoring(
    input.tx,
    input.clock,
    input.patientId,
    input.actorId,
    input.requestId,
  );
}
