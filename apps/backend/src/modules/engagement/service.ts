import {
  EngagementReminderViewSchema,
  ClinicianEngagementItemSchema,
  ClinicianEngagementResponseSchema,
  type ClinicalReasonFamily,
  type ClinicianEngagementItem,
  type ClinicianEngagementResponse,
  type ClinicianTaskView,
  PatientHomeResponseSchema,
  PatientMonitoringResponseSchema,
  type PatientHomeResponse,
  type PatientMonitoringResponse,
} from '@aud-subjective/contracts';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
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

const OPEN_ENGAGEMENT_CASE_LIFECYCLES = [
  'NEW',
  'ACKNOWLEDGED',
  'OUTREACH_IN_PROGRESS',
] as const;

type EngagementCaseLifecycle =
  | 'NEW'
  | 'ACKNOWLEDGED'
  | 'OUTREACH_IN_PROGRESS'
  | 'RESOLVED_RETURNED'
  | 'RESOLVED_OPT_OUT'
  | 'RESOLVED_PROGRAM_CLOSED'
  | 'RESOLVED_TECHNICAL_CORRECTION';

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

async function loadActiveTechnicalFailure(tx: Tx, patientId: string) {
  return tx.technicalFailure.findFirst({
    where: { patientId, status: 'CONFIRMED' },
    orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
  });
}

async function addEngagementCaseEvent(
  tx: Tx,
  input: {
    caseId: string;
    patientId: string;
    eventType:
      | 'CASE_CREATED'
      | 'CASE_ACKNOWLEDGED'
      | 'OUTREACH_STARTED'
      | 'CASE_RESOLVED_RETURNED'
      | 'CASE_RESOLVED_OPT_OUT'
      | 'CASE_RESOLVED_PROGRAM_CLOSED'
      | 'CASE_RESOLVED_TECHNICAL_CORRECTION';
    fromLifecycle?: EngagementCaseLifecycle | null;
    toLifecycle?: EngagementCaseLifecycle | null;
    actorId?: string | null;
    metadata?: Prisma.InputJsonValue;
    occurredAt: Date;
  },
) {
  await tx.engagementCaseEvent.create({
    data: {
      caseId: input.caseId,
      patientId: input.patientId,
      eventType: input.eventType,
      fromLifecycle: input.fromLifecycle ?? null,
      toLifecycle: input.toLifecycle ?? null,
      actorId: input.actorId ?? null,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      occurredAt: input.occurredAt,
    },
  });
}

async function routeEngagementTask(
  tx: Tx,
  input: {
    caseId: string;
    patientId: string;
    periodId: string;
    effectiveDueAt: Date;
    now: Date;
    requestId?: string;
  },
) {
  const taskIdentity = 'DISENGAGEMENT_REVIEW';
  const existing = await tx.clinicianTask.findUnique({
    where: {
      caseType_caseId_taskIdentity: {
        caseType: 'ENGAGEMENT',
        caseId: input.caseId,
        taskIdentity,
      },
    },
  });
  if (existing) return existing;

  const assignments = await tx.clinicianPatientAssignment.findMany({
    where: { patientId: input.patientId, endedAt: null },
    include: {
      clinician: {
        select: {
          id: true,
          applicationAccount: { select: { state: true } },
          roleAssignments: {
            where: {
              workspace: 'CLINICIAN',
              role: 'CLINICIAN',
              revokedAt: null,
            },
            select: { id: true },
          },
        },
      },
    },
  });
  const eligibleClinicians = [
    ...new Map(
      assignments
        .filter(
          (assignment) =>
            assignment.clinician.applicationAccount?.state === 'ACTIVE' &&
            assignment.clinician.roleAssignments.length > 0,
        )
        .map((assignment) => [assignment.clinician.id, assignment.clinician]),
    ).values(),
  ];
  const directClinician =
    eligibleClinicians.length === 1 ? eligibleClinicians[0] : null;
  const routed = Boolean(directClinician);
  const task = await tx.clinicianTask.create({
    data: {
      patientId: input.patientId,
      caseId: input.caseId,
      caseType: 'ENGAGEMENT',
      taskIdentity,
      recipientType: routed ? 'PRIMARY_CLINICIAN' : 'SYSTEM_UNROUTED_QUEUE',
      recipientId: directClinician?.id ?? null,
      deliveryStatus: routed ? 'DELIVERED' : 'UNROUTED',
      createdReason: null,
      sourceEvaluationId: null,
      sourceRevisionId: null,
      sourcePeriodId: input.periodId,
      eligibilityRecordedAt: input.now,
      attemptCount: 1,
      nextAttemptAt: null,
      title: 'Missed check-in engagement review required',
      detail: json({
        taskIdentity,
        effectiveDueAt: input.effectiveDueAt.toISOString(),
      }),
      createdAt: input.now,
    },
  });

  if (!routed) {
    const existingIncident = await tx.operationalIncident.findFirst({
      where: {
        code: 'ENGAGEMENT_UNROUTED',
        provenanceReference: input.caseId,
        status: { not: 'RESOLVED' },
      },
    });
    const incident =
      existingIncident ??
      (await tx.operationalIncident.create({
        data: {
          incidentType: 'ENGAGEMENT',
          code: 'ENGAGEMENT_UNROUTED',
          status: 'OPEN',
          summary: 'Missed check-in engagement review could not be directly assigned.',
          metadata: json({ patientId: input.patientId, caseId: input.caseId }),
          requestId: input.requestId ?? null,
          provenanceReference: input.caseId,
        },
      }));
    await tx.clinicianTask.update({
      where: { id: task.id },
      data: { operationalIncidentId: incident.id },
    });
  }
  return task;
}

async function ensureEngagementCase(
  input: ReconcileInput,
  anchor: { id: string; effectiveDueAt: Date },
  now: Date,
) {
  const existing = await input.tx.engagementCase.findFirst({
    where: {
      patientId: input.patientId,
      lifecycle: { in: [...OPEN_ENGAGEMENT_CASE_LIFECYCLES] },
    },
    orderBy: [{ openedAt: 'asc' }, { id: 'asc' }],
  });
  const engagementCase =
    existing ??
    (await input.tx.engagementCase.create({
      data: {
        patientId: input.patientId,
        lifecycle: 'NEW',
        caseVersion: 1,
        sourceMissedPeriodId: anchor.id,
        sourceEffectiveDueAt: anchor.effectiveDueAt,
        openedAt: now,
        updatedAt: now,
      },
    }));

  if (!existing) {
    await addEngagementCaseEvent(input.tx, {
      caseId: engagementCase.id,
      patientId: input.patientId,
      eventType: 'CASE_CREATED',
      toLifecycle: 'NEW',
      actorId: input.actorId ?? null,
      metadata: json({
        sourceMissedPeriodId: anchor.id,
        sourceEffectiveDueAt: anchor.effectiveDueAt.toISOString(),
      }),
      occurredAt: now,
    });
  }

  await routeEngagementTask(input.tx, {
    caseId: engagementCase.id,
    patientId: input.patientId,
    periodId: anchor.id,
    effectiveDueAt: anchor.effectiveDueAt,
    now,
    ...(input.requestId ? { requestId: input.requestId } : {}),
  });
  return engagementCase;
}

export async function resolveOpenEngagementCase(
  input: ReconcileInput,
  lifecycle: 'RESOLVED_RETURNED' | 'RESOLVED_OPT_OUT' | 'RESOLVED_TECHNICAL_CORRECTION',
  eventType:
    | 'CASE_RESOLVED_RETURNED'
    | 'CASE_RESOLVED_OPT_OUT'
    | 'CASE_RESOLVED_TECHNICAL_CORRECTION',
  reason: string,
  now: Date,
  sourceTechnicalFailureId?: string | null,
) {
  const current = await input.tx.engagementCase.findFirst({
    where: {
      patientId: input.patientId,
      lifecycle: { in: [...OPEN_ENGAGEMENT_CASE_LIFECYCLES] },
    },
    orderBy: [{ openedAt: 'asc' }, { id: 'asc' }],
  });
  if (!current) return null;
  const updated = await input.tx.engagementCase.update({
    where: { id: current.id },
    data: {
      lifecycle,
      caseVersion: { increment: 1 },
      resolvedAt: now,
      resolutionReason: reason,
      ...(sourceTechnicalFailureId === undefined
        ? {}
        : { sourceTechnicalFailureId }),
      updatedAt: now,
    },
  });
  await addEngagementCaseEvent(input.tx, {
    caseId: current.id,
    patientId: input.patientId,
    eventType,
    fromLifecycle: current.lifecycle,
    toLifecycle: lifecycle,
    actorId: input.actorId ?? null,
    metadata: json({ reason }),
    occurredAt: now,
  });
  return updated;
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
    sourceTechnicalFailureId?: string | null;
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
    (next.sourceTechnicalFailureId !== undefined &&
      current.sourceTechnicalFailureId !== next.sourceTechnicalFailureId) ||
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
      ...(next.sourceTechnicalFailureId !== undefined
        ? { sourceTechnicalFailureId: next.sourceTechnicalFailureId }
        : {}),
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
      sourceTechnicalFailureId: null,
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
  await resolveOpenEngagementCase(
    input,
    'RESOLVED_RETURNED',
    'CASE_RESOLVED_RETURNED',
    'PATIENT_RETURNED_AFTER_GAP',
    now,
  );
  return transitionState(
    input,
    returned,
    {
      state: 'ENGAGED',
      missedCyclePeriodId: null,
      sourceEffectiveDueAt: null,
      sourceTechnicalFailureId: null,
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
  const activeTechnicalFailure = await loadActiveTechnicalFailure(
    input.tx,
    input.patientId,
  );

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

  if (anchor && state.missedCyclePeriodId && !activeTechnicalFailure) {
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
    technicalFailureActive: Boolean(activeTechnicalFailure),
    optedOut: false,
  });

  if (activeTechnicalFailure) {
    await cancelReminders(
      input.tx,
      input.patientId,
      now,
      'TECHNICAL_FAILURE',
      anchor?.id,
    );
  } else if (anchor && evaluation.pauseReason === null) {
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
      sourceTechnicalFailureId: activeTechnicalFailure?.id ?? null,
    },
    now,
  );

  if (
    !activeTechnicalFailure &&
    evaluation.pauseReason === null &&
    evaluation.state === 'DISENGAGED' &&
    anchor
  ) {
    await ensureEngagementCase(input, anchor, now);
  }

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
        sourceTechnicalFailureId: null,
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
  await resolveOpenEngagementCase(
    {
      tx: input.tx,
      clock: input.clock,
      patientId: input.patientId,
      actorId: input.actorId,
      requestId: input.requestId,
    },
    'RESOLVED_OPT_OUT',
    'CASE_RESOLVED_OPT_OUT',
    'PATIENT_OPTED_OUT',
    now,
  );
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
        sourceTechnicalFailureId: null,
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

async function assertAssignedPatient(
  tx: Tx,
  clinicianId: string,
  patientId: string,
) {
  const assignment = await tx.clinicianPatientAssignment.findFirst({
    where: { clinicianUserId: clinicianId, patientId, endedAt: null },
    select: { id: true },
  });
  if (!assignment) {
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  }
}

function engagementTaskView(task: {
  id: string;
  caseId: string;
  caseType: 'CLINICAL' | 'SUBJECTIVE_LEVEL_3_REVIEW' | 'ENGAGEMENT';
  taskIdentity: string;
  createdReason: ClinicalReasonFamily | null;
  recipientType: 'PRIMARY_CLINICIAN' | 'SYSTEM_UNROUTED_QUEUE';
  deliveryStatus: 'DELIVERED' | 'UNROUTED' | 'UPDATE_REQUIRED' | 'ACKNOWLEDGED';
  title: string;
  alertUpdateRequired: boolean;
  createdAt: Date;
  acknowledgedAt: Date | null;
}): ClinicianTaskView {
  return {
    id: task.id,
    caseId: task.caseId,
    caseType: task.caseType,
    taskIdentity: task.taskIdentity,
    createdReason: task.createdReason,
    recipientType: task.recipientType,
    deliveryStatus: task.deliveryStatus,
    title: task.title,
    alertUpdateRequired: task.alertUpdateRequired,
    createdAt: task.createdAt.toISOString(),
    acknowledgedAt: task.acknowledgedAt?.toISOString() ?? null,
  };
}

async function latestCompletedCheckIn(tx: Tx, patientId: string) {
  const assessments = await tx.weeklyAssessment.findMany({
    where: {
      patientId,
      authoritativeRevisionId: { not: null },
    },
    select: {
      scheduledPeriod: { select: { id: true } },
      authoritativeRevision: {
        select: {
          completionStatus: true,
          submissionClassification: true,
          submittedAt: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 20,
  });
  const completed = assessments.find((assessment) => {
    const classification = assessment.authoritativeRevision?.submissionClassification;
    return classification === 'CURRENT' || classification === 'LATE_CURRENT';
  });
  if (!completed?.authoritativeRevision) return null;
  return {
    periodId: completed.scheduledPeriod.id,
    submittedAt: completed.authoritativeRevision.submittedAt.toISOString(),
    completionStatus: completed.authoritativeRevision.completionStatus,
  };
}

async function buildClinicianEngagementItem(
  tx: Tx,
  clock: Clock,
  patientId: string,
  result: Awaited<ReturnType<typeof reconcileEngagementForPatient>>,
): Promise<ClinicianEngagementItem> {
  const [patient, engagementCase, task, lastCompletedCheckIn] = await Promise.all([
    tx.user.findUnique({ where: { id: patientId }, select: { name: true } }),
    tx.engagementCase.findFirst({
      where: {
        patientId,
        lifecycle: { in: [...OPEN_ENGAGEMENT_CASE_LIFECYCLES] },
      },
      orderBy: [{ openedAt: 'asc' }, { id: 'asc' }],
    }),
    tx.engagementCase
      .findFirst({
        where: {
          patientId,
          lifecycle: { in: [...OPEN_ENGAGEMENT_CASE_LIFECYCLES] },
        },
        select: { id: true },
        orderBy: [{ openedAt: 'asc' }, { id: 'asc' }],
      })
      .then((caseRow) =>
        caseRow
          ? tx.clinicianTask.findUnique({
              where: {
                caseType_caseId_taskIdentity: {
                  caseType: 'ENGAGEMENT',
                  caseId: caseRow.id,
                  taskIdentity: 'DISENGAGEMENT_REVIEW',
                },
              },
            })
          : null,
      ),
    latestCompletedCheckIn(tx, patientId),
  ]);
  if (!patient) {
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  }
  const anchor = result.anchor;
  return ClinicianEngagementItemSchema.parse({
    patientId,
    patientName: patient.name,
    engagementState: result.state.state,
    missedCycle: anchor
      ? {
          periodId: anchor.id,
          periodStartAt: anchor.periodStartAt.toISOString(),
          periodEndAt: anchor.periodEndAt.toISOString(),
          effectiveDueAt: anchor.effectiveDueAt.toISOString(),
        }
      : null,
    effectiveDueAt: anchor?.effectiveDueAt.toISOString() ?? null,
    daysOverdue: result.evaluation.overdueDays,
    reminders: await loadReminders(
      tx,
      patientId,
      clock.now(),
      anchor?.id ?? null,
    ),
    pause: {
      timingPaused: result.evaluation.timingPaused,
      reason: result.evaluation.pauseReason,
    },
    engagementCase: engagementCase
      ? {
          id: engagementCase.id,
          lifecycle: engagementCase.lifecycle,
          caseVersion: engagementCase.caseVersion,
          openedAt: engagementCase.openedAt.toISOString(),
          acknowledgedAt: engagementCase.acknowledgedAt?.toISOString() ?? null,
          outreachStartedAt: engagementCase.outreachStartedAt?.toISOString() ?? null,
          resolvedAt: engagementCase.resolvedAt?.toISOString() ?? null,
          resolutionReason: engagementCase.resolutionReason,
        }
      : null,
    task: task ? engagementTaskView(task) : null,
    lastCompletedCheckIn,
  });
}

async function readClinicianEngagementForPatient(
  tx: Tx,
  clock: Clock,
  clinicianId: string,
  patientId: string,
) {
  await assertAssignedPatient(tx, clinicianId, patientId);
  const result = await reconcileEngagementForPatient({
    tx,
    clock,
    patientId,
    actorId: clinicianId,
  });
  return buildClinicianEngagementItem(tx, clock, patientId, result);
}

export async function readClinicianEngagementQueue(
  prisma: PrismaClient,
  clock: Clock,
  clinicianId: string,
): Promise<ClinicianEngagementResponse> {
  const assignments = await prisma.clinicianPatientAssignment.findMany({
    where: { clinicianUserId: clinicianId, endedAt: null },
    select: { patientId: true },
    orderBy: [{ patientId: 'asc' }, { id: 'asc' }],
  });
  const patientIds = [...new Set(assignments.map((assignment) => assignment.patientId))];
  const items: ClinicianEngagementItem[] = [];
  for (const patientId of patientIds) {
    const item = await prisma.$transaction((tx) =>
      readClinicianEngagementForPatient(tx, clock, clinicianId, patientId),
    );
    items.push(await item);
  }
  return ClinicianEngagementResponseSchema.parse({ items });
}

export async function readClinicianEngagementDetail(input: {
  tx: Tx;
  clock: Clock;
  clinicianId: string;
  patientId: string;
}) {
  return readClinicianEngagementForPatient(
    input.tx,
    input.clock,
    input.clinicianId,
    input.patientId,
  );
}

export async function transitionEngagementCase(input: {
  tx: Tx;
  clock: Clock;
  clinicianId: string;
  caseId: string;
  expectedCaseVersion: number;
  target: 'ACKNOWLEDGED' | 'OUTREACH_IN_PROGRESS';
  requestId: string;
}) {
  const caseIdentity = await input.tx.engagementCase.findUnique({
    where: { id: input.caseId },
    select: { patientId: true },
  });
  if (!caseIdentity) {
    throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
  }
  await assertAssignedPatient(input.tx, input.clinicianId, caseIdentity.patientId);
  await lockPatientForProcessing(input.tx, caseIdentity.patientId);
  const current = await input.tx.engagementCase.findUnique({
    where: { id: input.caseId },
  });
  if (!current) {
    throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
  }
  if (current.caseVersion !== input.expectedCaseVersion) {
    throw new DomainError(409, 'VERSION_CONFLICT', 'The engagement case changed before this action.');
  }
  if (current.lifecycle === input.target) {
    return readClinicianEngagementDetail({
      tx: input.tx,
      clock: input.clock,
      clinicianId: input.clinicianId,
      patientId: current.patientId,
    });
  }
  const allowed =
    input.target === 'ACKNOWLEDGED'
      ? current.lifecycle === 'NEW'
      : current.lifecycle === 'NEW' || current.lifecycle === 'ACKNOWLEDGED';
  if (!allowed) {
    throw new DomainError(
      409,
      'INVALID_CASE_TRANSITION',
      'The engagement case is no longer available for this action.',
    );
  }
  const now = input.clock.now();
  const updated = await input.tx.engagementCase.update({
    where: { id: current.id },
    data: {
      lifecycle: input.target,
      caseVersion: { increment: 1 },
      ...(input.target === 'ACKNOWLEDGED'
        ? { acknowledgedAt: now }
        : { outreachStartedAt: now }),
      updatedAt: now,
    },
  });
  await addEngagementCaseEvent(input.tx, {
    caseId: current.id,
    patientId: current.patientId,
    eventType:
      input.target === 'ACKNOWLEDGED'
        ? 'CASE_ACKNOWLEDGED'
        : 'OUTREACH_STARTED',
    fromLifecycle: current.lifecycle,
    toLifecycle: input.target,
    actorId: input.clinicianId,
    metadata: json({ requestId: input.requestId }),
    occurredAt: now,
  });
  await input.tx.clinicianTask.updateMany({
    where: {
      caseType: 'ENGAGEMENT',
      caseId: current.id,
      deliveryStatus: { in: ['DELIVERED', 'UNROUTED'] },
    },
    data: {
      deliveryStatus: 'ACKNOWLEDGED',
      acknowledgedAt: now,
    },
  });
  await input.tx.auditEvent.create({
    data: {
      actorId: input.clinicianId,
      action:
        input.target === 'ACKNOWLEDGED'
          ? 'ENGAGEMENT_CASE_ACKNOWLEDGED'
          : 'ENGAGEMENT_CASE_OUTREACH_STARTED',
      entityType: 'ENGAGEMENT_CASE',
      entityId: current.id,
      patientId: current.patientId,
      occurredAt: now,
      requestId: input.requestId,
      configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      metadata: json({
        fromLifecycle: current.lifecycle,
        toLifecycle: updated.lifecycle,
      }),
    },
  });
  return readClinicianEngagementDetail({
    tx: input.tx,
    clock: input.clock,
    clinicianId: input.clinicianId,
    patientId: current.patientId,
  });
}
