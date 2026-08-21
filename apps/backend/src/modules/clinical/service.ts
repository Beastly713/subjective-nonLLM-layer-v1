import {
  ClinicalReasonFamilySchema,
  type ClinicalCaseView,
  type ClinicalReasonFamily,
  type ClinicalReasonView,
  type ClinicianPatientMonitoringResponse,
  type ClinicianReviewQueueItem,
  type ClinicianReviewQueueResponse,
  type ClinicianTaskView,
} from '@aud-subjective/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Clock } from '../../shared/clock/clock.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import {
  deriveOpenCaseLifecycle,
  materiallyNewReasonFamilies,
} from './lifecycle.js';
import { CLINICAL_REASON_FAMILIES } from './types.js';

type Tx = Prisma.TransactionClient;

const OPEN_CASE_LIFECYCLES = [
  'NEW',
  'ACKNOWLEDGED',
  'ACTIVE',
  'CLEARANCE_PENDING',
] as const;

type JsonRecord = Record<string, Prisma.JsonValue>;

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function objectValue(value: Prisma.JsonValue | null | undefined): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringArray(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function clinicalReasonFamily(value: Prisma.JsonValue | undefined) {
  return ClinicalReasonFamilySchema.safeParse(value).success
    ? (value as ClinicalReasonFamily)
    : null;
}

function clinicalReasonFamilies(value: Prisma.JsonValue | null | undefined) {
  return stringArray(value).flatMap((item) => {
    const family = clinicalReasonFamily(item);
    return family ? [family] : [];
  });
}

function clinicalReasonSnapshot(value: Prisma.JsonValue | undefined) {
  const record = objectValue(value);
  const status = record.status;
  if (
    status !== 'INACTIVE' &&
    status !== 'ACTIVE' &&
    status !== 'CLEARANCE_PENDING' &&
    status !== 'RESOLVED'
  ) {
    return null;
  }
  return {
    status,
    clearanceCount:
      typeof record.clearanceCount === 'number' && record.clearanceCount >= 0
        ? record.clearanceCount
        : 0,
  } as const;
}

function clinicalReasonEffect(value: Prisma.JsonValue | undefined) {
  return value === 'ELIGIBLE' ||
    value === 'SUPPRESSED_TRIGGER' ||
    value === 'HISTORICAL_ONLY' ||
    value === 'REVOKED_BY_REVISION'
    ? value
    : null;
}

async function loadEvaluation(tx: Tx, evaluationId: string) {
  return tx.assessmentEvaluation.findUnique({
    where: { id: evaluationId },
    select: {
      id: true,
      patientId: true,
      assessmentRevisionId: true,
      scheduledPeriodId: true,
      trigger: true,
      evaluatedAt: true,
      inputSnapshot: true,
      resultSnapshot: true,
      effectPlanSnapshot: true,
      scheduledPeriod: {
        select: {
          id: true,
          periodStartAt: true,
          periodEndAt: true,
          effectiveDueAt: true,
        },
      },
      assessmentRevision: {
        select: {
          id: true,
          completionStatus: true,
          submittedAt: true,
        },
      },
    },
  });
}

async function persistVisibility(
  tx: Tx,
  evaluation: NonNullable<Awaited<ReturnType<typeof loadEvaluation>>>,
  flagKey: string,
  status: 'CURRENT_ACTIVE' | 'CURRENT_CLEARED' | 'REVOKED_BY_REVISION',
) {
  await tx.clinicianVisibilityFlag.upsert({
    where: {
      patientId_flagKey: {
        patientId: evaluation.patientId,
        flagKey,
      },
    },
    create: {
      patientId: evaluation.patientId,
      flagKey,
      status,
      sourceEvaluationId: evaluation.id,
      sourceRevisionId: evaluation.assessmentRevisionId,
      sourcePeriodId: evaluation.scheduledPeriodId,
      sourceCompletionStatus: evaluation.assessmentRevision.completionStatus,
      sourceSubmittedAt: evaluation.assessmentRevision.submittedAt,
    },
    update: {
      status,
      sourceEvaluationId: evaluation.id,
      sourceRevisionId: evaluation.assessmentRevisionId,
      sourcePeriodId: evaluation.scheduledPeriodId,
      sourceCompletionStatus: evaluation.assessmentRevision.completionStatus,
      sourceSubmittedAt: evaluation.assessmentRevision.submittedAt,
    },
  });
}

async function reconcileVisibility(
  tx: Tx,
  evaluation: NonNullable<Awaited<ReturnType<typeof loadEvaluation>>>,
) {
  const result = objectValue(evaluation.resultSnapshot);
  const flags = Array.isArray(result.flags) ? result.flags : [];
  for (const item of flags) {
    const flag = objectValue(item);
    const flagKey = typeof flag.flagKey === 'string' ? flag.flagKey : null;
    const state = flag.state;
    if (!flagKey || (state !== 'ACTIVE' && state !== 'CLEAR')) continue;
    await persistVisibility(
      tx,
      evaluation,
      flagKey,
      state === 'ACTIVE' ? 'CURRENT_ACTIVE' : 'CURRENT_CLEARED',
    );
  }

  const consumption = objectValue(result.consumption);
  if (consumption.targetStatus === 'NOT_MET') {
    await persistVisibility(
      tx,
      evaluation,
      'REDUCTION_TARGET_NOT_MET',
      'CURRENT_ACTIVE',
    );
  } else if (
    consumption.targetStatus === 'MET' ||
    (consumption.targetStatus === undefined &&
      objectValue(evaluation.inputSnapshot).goal !== 'REDUCTION')
  ) {
    await persistVisibility(
      tx,
      evaluation,
      'REDUCTION_TARGET_NOT_MET',
      'CURRENT_CLEARED',
    );
  }

  if (
    evaluation.trigger === 'CURRENT_PATIENT_CORRECTION' ||
    evaluation.trigger === 'STAFF_CORRECTION'
  ) {
    const persisted = await tx.clinicianVisibilityFlag.findMany({
      where: {
        patientId: evaluation.patientId,
        sourceRevisionId: { not: evaluation.assessmentRevisionId },
        status: 'CURRENT_ACTIVE',
      },
      select: { id: true, flagKey: true },
    });
    const currentKeys = new Set(
      flags.flatMap((item) => {
        const flag = objectValue(item);
        return typeof flag.flagKey === 'string' && flag.state !== 'UNKNOWN'
          ? [flag.flagKey]
          : [];
      }),
    );
    for (const oldFlag of persisted) {
      if (!currentKeys.has(oldFlag.flagKey)) {
        await tx.clinicianVisibilityFlag.update({
          where: { id: oldFlag.id },
          data: {
            status: 'REVOKED_BY_REVISION',
            sourceEvaluationId: evaluation.id,
            sourceRevisionId: evaluation.assessmentRevisionId,
            sourcePeriodId: evaluation.scheduledPeriodId,
            sourceCompletionStatus:
              evaluation.assessmentRevision.completionStatus,
            sourceSubmittedAt: evaluation.assessmentRevision.submittedAt,
          },
        });
      }
    }
  }
}

async function reconcileReasonStates(
  tx: Tx,
  evaluation: NonNullable<Awaited<ReturnType<typeof loadEvaluation>>>,
) {
  const result = objectValue(evaluation.resultSnapshot);
  const longitudinal = objectValue(result.longitudinal);
  const snapshots = objectValue(longitudinal.clearanceReasonStateSnapshot);
  const effectPlan = objectValue(evaluation.effectPlanSnapshot);
  const candidateRows = Array.isArray(effectPlan.candidateClinicianReasons)
    ? effectPlan.candidateClinicianReasons
    : [];
  const effects = new Map<ClinicalReasonFamily, string>();
  for (const item of candidateRows) {
    const candidate = objectValue(item);
    const family = clinicalReasonFamily(candidate.reasonFamily);
    if (!family || typeof candidate.effect !== 'string') continue;
    effects.set(family, candidate.effect);
  }

  const existing = await tx.clinicalReasonState.findMany({
    where: { patientId: evaluation.patientId },
  });
  const existingByFamily = new Map(
    existing.map((state) => [state.reasonFamily, state]),
  );

  for (const family of CLINICAL_REASON_FAMILIES) {
    const snapshot = clinicalReasonSnapshot(snapshots[family]);
    if (!snapshot) continue;
    const prior = existingByFamily.get(family);
    const candidateEffect = clinicalReasonEffect(
      effects.get(family) as Prisma.JsonValue | undefined,
    );

    if (
      candidateEffect === 'HISTORICAL_ONLY' ||
      candidateEffect === 'SUPPRESSED_TRIGGER'
    ) {
      continue;
    }

    if (snapshot.status === 'ACTIVE' && !candidateEffect && !prior) {
      continue;
    }

    const isCorrection =
      evaluation.trigger === 'CURRENT_PATIENT_CORRECTION' ||
      evaluation.trigger === 'STAFF_CORRECTION';
    const isCorrectionRevocation =
      isCorrection &&
      Boolean(prior) &&
      prior!.sourceRevisionId !== evaluation.assessmentRevisionId &&
      snapshot.status !== 'ACTIVE' &&
      (prior!.status === 'ACTIVE' || prior!.status === 'CLEARANCE_PENDING');

    const nextStatus = snapshot.status;
    const nextEffect = isCorrectionRevocation
      ? 'REVOKED_BY_REVISION'
      : (candidateEffect ?? prior?.effect ?? 'ELIGIBLE');
    const changed =
      !prior || prior.status !== nextStatus || prior.effect !== nextEffect;

    if (!changed) {
      await tx.clinicalReasonState.update({
        where: { id: prior.id },
        data: {
          sourceEvaluationId: evaluation.id,
          sourceRevisionId: evaluation.assessmentRevisionId,
          sourcePeriodId: evaluation.scheduledPeriodId,
          lastObservedAt: evaluation.evaluatedAt,
          clearanceCount: snapshot.clearanceCount,
        },
      });
      continue;
    }

    const stateData = {
      status: nextStatus,
      effect: nextEffect,
      sourceEvaluationId: evaluation.id,
      sourceRevisionId: evaluation.assessmentRevisionId,
      sourcePeriodId: evaluation.scheduledPeriodId,
      firstActiveAt:
        nextStatus === 'ACTIVE'
          ? (prior?.firstActiveAt ?? evaluation.evaluatedAt)
          : (prior?.firstActiveAt ?? null),
      lastObservedAt: evaluation.evaluatedAt,
      clearanceCount: snapshot.clearanceCount,
    } as const;

    if (prior) {
      await tx.clinicalReasonState.update({
        where: { id: prior.id },
        data: {
          ...stateData,
          version: { increment: 1 },
        },
      });
    } else {
      await tx.clinicalReasonState.create({
        data: {
          patientId: evaluation.patientId,
          reasonFamily: family,
          ...stateData,
        },
      });
    }

    await tx.clinicalReasonHistory.create({
      data: {
        patientId: evaluation.patientId,
        reasonFamily: family,
        fromStatus: prior?.status ?? null,
        toStatus: nextStatus,
        effect: nextEffect,
        sourceEvaluationId: evaluation.id,
        sourceRevisionId: evaluation.assessmentRevisionId,
        sourcePeriodId: evaluation.scheduledPeriodId,
        cause: isCorrectionRevocation
          ? 'CORRECTION_REVOCATION'
          : prior
            ? 'AUTHORITATIVE_STATE_CHANGE'
            : 'AUTHORITATIVE_REASON_ELIGIBLE',
        trigger: evaluation.trigger,
        ...(isCorrectionRevocation
          ? {
              metadata: json({
                invalidatedRevisionId: prior?.sourceRevisionId,
              }),
            }
          : {}),
      },
    });
  }
}

async function addCaseEvent(
  tx: Tx,
  input: {
    caseId: string;
    patientId: string;
    eventType:
      | 'CASE_CREATED'
      | 'CASE_ACKNOWLEDGED'
      | 'REASON_ADDED'
      | 'REASON_CLEARED'
      | 'REASON_REVOKED'
      | 'LIFECYCLE_CHANGED'
      | 'TASK_CREATED'
      | 'TASK_UPDATE_REQUIRED';
    fromLifecycle?:
      | 'NEW'
      | 'ACKNOWLEDGED'
      | 'ACTIVE'
      | 'CLEARANCE_PENDING'
      | 'RESOLVED'
      | 'RESOLVED_CORRECTION'
      | null;
    toLifecycle?:
      | 'NEW'
      | 'ACKNOWLEDGED'
      | 'ACTIVE'
      | 'CLEARANCE_PENDING'
      | 'RESOLVED'
      | 'RESOLVED_CORRECTION'
      | null;
    reasonFamily?: ClinicalReasonFamily | null;
    sourceEvaluationId?: string | null;
    sourceRevisionId?: string | null;
    sourcePeriodId?: string | null;
    actorId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.clinicalCaseEvent.create({
    data: {
      caseId: input.caseId,
      patientId: input.patientId,
      eventType: input.eventType,
      fromLifecycle: input.fromLifecycle ?? null,
      toLifecycle: input.toLifecycle ?? null,
      reasonFamily: input.reasonFamily ?? null,
      sourceEvaluationId: input.sourceEvaluationId ?? null,
      sourceRevisionId: input.sourceRevisionId ?? null,
      sourcePeriodId: input.sourcePeriodId ?? null,
      actorId: input.actorId ?? null,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    },
  });
}

async function routeTask(
  tx: Tx,
  input: {
    caseId: string;
    patientId: string;
    reasonFamily: ClinicalReasonFamily;
    evaluationId: string;
    revisionId: string;
    periodId: string;
    now: Date;
    requestId?: string;
  },
) {
  const existing = await tx.clinicianTask.findUnique({
    where: {
      caseType_caseId_taskIdentity: {
        caseType: 'CLINICAL',
        caseId: input.caseId,
        taskIdentity: input.reasonFamily,
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
      caseType: 'CLINICAL',
      recipientType: routed ? 'PRIMARY_CLINICIAN' : 'SYSTEM_UNROUTED_QUEUE',
      recipientId: directClinician?.id ?? null,
      deliveryStatus: routed ? 'DELIVERED' : 'UNROUTED',
      createdReason: input.reasonFamily,
      taskIdentity: input.reasonFamily,
      sourceEvaluationId: input.evaluationId,
      sourceRevisionId: input.revisionId,
      sourcePeriodId: input.periodId,
      eligibilityRecordedAt: input.now,
      attemptCount: 1,
      nextAttemptAt: null,
      title: 'Subjective monitoring review required',
      detail: json({ reasonFamily: input.reasonFamily }),
      createdAt: input.now,
    },
  });

  await addCaseEvent(tx, {
    caseId: input.caseId,
    patientId: input.patientId,
    eventType: 'TASK_CREATED',
    sourceEvaluationId: input.evaluationId,
    sourceRevisionId: input.revisionId,
    sourcePeriodId: input.periodId,
    metadata: json({
      taskId: task.id,
      recipientType: task.recipientType,
      requestId: input.requestId ?? null,
    }),
  });

  if (!routed) {
    const existingIncident = await tx.operationalIncident.findFirst({
      where: {
        code: 'CLINICAL_REVIEW_UNROUTED',
        provenanceReference: input.caseId,
        status: { not: 'RESOLVED' },
      },
    });
    const incident =
      existingIncident ??
      (await tx.operationalIncident.create({
        data: {
          incidentType: 'CLINICAL_REVIEW',
          code: 'CLINICAL_REVIEW_UNROUTED',
          status: 'OPEN',
          summary: 'Subjective clinical review could not be directly assigned.',
          metadata: json({
            patientId: input.patientId,
            caseId: input.caseId,
            reasonFamily: input.reasonFamily,
          }),
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

async function markTasksUpdateRequired(
  tx: Tx,
  caseId: string,
  patientId: string,
  source: {
    evaluationId: string;
    revisionId: string;
    periodId: string;
  },
  reasonFamily?: ClinicalReasonFamily,
) {
  const tasks = await tx.clinicianTask.findMany({
    where: {
      caseId,
      alertUpdateRequired: false,
      ...(reasonFamily ? { createdReason: reasonFamily } : {}),
    },
    select: { id: true, createdReason: true },
  });
  if (tasks.length === 0) return;
  await tx.clinicianTask.updateMany({
    where: {
      caseId,
      alertUpdateRequired: false,
      ...(reasonFamily ? { createdReason: reasonFamily } : {}),
    },
    data: {
      alertUpdateRequired: true,
      deliveryStatus: 'UPDATE_REQUIRED',
    },
  });
  for (const task of tasks) {
    await addCaseEvent(tx, {
      caseId,
      patientId,
      eventType: 'TASK_UPDATE_REQUIRED',
      sourceEvaluationId: source.evaluationId,
      sourceRevisionId: source.revisionId,
      sourcePeriodId: source.periodId,
      reasonFamily: task.createdReason,
      metadata: json({ taskId: task.id }),
    });
  }
}

async function reconcileCase(
  tx: Tx,
  evaluation: NonNullable<Awaited<ReturnType<typeof loadEvaluation>>>,
  requestId?: string,
) {
  const states = await tx.clinicalReasonState.findMany({
    where: { patientId: evaluation.patientId },
  });
  const active = states
    .filter(
      (state) =>
        state.status === 'ACTIVE' && state.effect !== 'REVOKED_BY_REVISION',
    )
    .map((state) => state.reasonFamily);
  const pending = states
    .filter(
      (state) =>
        state.status === 'CLEARANCE_PENDING' &&
        state.effect !== 'REVOKED_BY_REVISION',
    )
    .map((state) => state.reasonFamily);
  const stateByFamily = new Map(
    states.map((state) => [state.reasonFamily, state]),
  );

  let currentCase = await tx.clinicalReviewCase.findFirst({
    where: {
      patientId: evaluation.patientId,
      lifecycle: { in: [...OPEN_CASE_LIFECYCLES] },
    },
    orderBy: { openedAt: 'desc' },
  });

  if (!currentCase && active.length > 0) {
    currentCase = await tx.clinicalReviewCase.create({
      data: {
        patientId: evaluation.patientId,
        tier: 'LEVEL_3',
        lifecycle: 'NEW',
        activeReasonFamilies: json(active),
        clearancePendingReasonFamilies: json(pending),
        highestHistoricalTier: 'LEVEL_3',
        followupVisibility: true,
        sourceEvaluationId: evaluation.id,
        sourceRevisionId: evaluation.assessmentRevisionId,
        sourcePeriodId: evaluation.scheduledPeriodId,
        openedAt: evaluation.evaluatedAt,
      },
    });
    await addCaseEvent(tx, {
      caseId: currentCase.id,
      patientId: evaluation.patientId,
      eventType: 'CASE_CREATED',
      toLifecycle: 'NEW',
      sourceEvaluationId: evaluation.id,
      sourceRevisionId: evaluation.assessmentRevisionId,
      sourcePeriodId: evaluation.scheduledPeriodId,
    });
    for (const reasonFamily of active) {
      await addCaseEvent(tx, {
        caseId: currentCase.id,
        patientId: evaluation.patientId,
        eventType: 'REASON_ADDED',
        reasonFamily,
        sourceEvaluationId: evaluation.id,
        sourceRevisionId: evaluation.assessmentRevisionId,
        sourcePeriodId: evaluation.scheduledPeriodId,
      });
    }
    for (const reasonFamily of active) {
      await routeTask(tx, {
        caseId: currentCase.id,
        patientId: evaluation.patientId,
        reasonFamily,
        evaluationId: evaluation.id,
        revisionId: evaluation.assessmentRevisionId,
        periodId: evaluation.scheduledPeriodId,
        now: evaluation.evaluatedAt,
        ...(requestId ? { requestId } : {}),
      });
    }
    return currentCase;
  }

  if (!currentCase) return null;

  const oldActive = clinicalReasonFamilies(currentCase.activeReasonFamilies);
  const oldPending = clinicalReasonFamilies(
    currentCase.clearancePendingReasonFamilies,
  );
  const oldLifecycle = currentCase.lifecycle;
  const oldReasonFamilies = [...new Set([...oldActive, ...oldPending])];
  const correctionRevokedFamilies = oldReasonFamilies.filter((reasonFamily) => {
    const state = stateByFamily.get(reasonFamily);
    return state?.effect === 'REVOKED_BY_REVISION' && state.status !== 'ACTIVE';
  });
  const revoked = correctionRevokedFamilies.length > 0;
  const source = {
    evaluationId: evaluation.id,
    revisionId: evaluation.assessmentRevisionId,
    periodId: evaluation.scheduledPeriodId,
  };

  for (const reasonFamily of correctionRevokedFamilies) {
    const existingEvent = await tx.clinicalCaseEvent.findFirst({
      where: {
        caseId: currentCase.id,
        eventType: 'REASON_REVOKED',
        reasonFamily,
        sourceEvaluationId: evaluation.id,
      },
      select: { id: true },
    });
    if (existingEvent) continue;
    await addCaseEvent(tx, {
      caseId: currentCase.id,
      patientId: evaluation.patientId,
      eventType: 'REASON_REVOKED',
      reasonFamily,
      ...source,
      metadata: json({
        invalidatedByRevisionId: evaluation.assessmentRevisionId,
      }),
    });
    await markTasksUpdateRequired(
      tx,
      currentCase.id,
      evaluation.patientId,
      source,
      reasonFamily,
    );
  }

  if (active.length === 0 && pending.length === 0) {
    const nextLifecycle = revoked ? 'RESOLVED_CORRECTION' : 'RESOLVED';
    if (oldLifecycle !== nextLifecycle) {
      await tx.clinicalReviewCase.update({
        where: { id: currentCase.id },
        data: {
          lifecycle: nextLifecycle,
          tier: 'NONE',
          activeReasonFamilies: json([]),
          clearancePendingReasonFamilies: json([]),
          sourceEvaluationId: evaluation.id,
          sourceRevisionId: evaluation.assessmentRevisionId,
          sourcePeriodId: evaluation.scheduledPeriodId,
          resolvedAt: evaluation.evaluatedAt,
          resolutionReason: revoked
            ? 'CORRECTION_REVOCATION'
            : 'ALL_REASONS_RESOLVED',
          caseVersion: { increment: 1 },
        },
      });
      await addCaseEvent(tx, {
        caseId: currentCase.id,
        patientId: evaluation.patientId,
        eventType: 'LIFECYCLE_CHANGED',
        fromLifecycle: oldLifecycle,
        toLifecycle: nextLifecycle,
        sourceEvaluationId: evaluation.id,
        sourceRevisionId: evaluation.assessmentRevisionId,
        sourcePeriodId: evaluation.scheduledPeriodId,
        metadata: json({
          resolutionReason: revoked
            ? 'CORRECTION_REVOCATION'
            : 'ALL_REASONS_RESOLVED',
        }),
      });
      if (revoked) {
        for (const reasonFamily of correctionRevokedFamilies) {
          await markTasksUpdateRequired(
            tx,
            currentCase.id,
            evaluation.patientId,
            source,
            reasonFamily,
          );
        }
      }
    }
    return tx.clinicalReviewCase.findUnique({ where: { id: currentCase.id } });
  }

  const nextLifecycle = deriveOpenCaseLifecycle({
    activeReasonCount: active.length,
    clearancePendingReasonCount: pending.length,
    previousLifecycle: OPEN_CASE_LIFECYCLES.includes(
      oldLifecycle as (typeof OPEN_CASE_LIFECYCLES)[number],
    )
      ? (oldLifecycle as (typeof OPEN_CASE_LIFECYCLES)[number])
      : 'ACKNOWLEDGED',
  });
  const arraysChanged =
    JSON.stringify(oldActive) !== JSON.stringify(active) ||
    JSON.stringify(oldPending) !== JSON.stringify(pending);
  const lifecycleChanged = oldLifecycle !== nextLifecycle;
  if (arraysChanged || lifecycleChanged) {
    await tx.clinicalReviewCase.update({
      where: { id: currentCase.id },
      data: {
        lifecycle: nextLifecycle,
        tier: active.length > 0 ? 'LEVEL_3' : 'NONE',
        activeReasonFamilies: json(active),
        clearancePendingReasonFamilies: json(pending),
        sourceEvaluationId: evaluation.id,
        sourceRevisionId: evaluation.assessmentRevisionId,
        sourcePeriodId: evaluation.scheduledPeriodId,
        caseVersion: { increment: 1 },
      },
    });
    if (lifecycleChanged) {
      await addCaseEvent(tx, {
        caseId: currentCase.id,
        patientId: evaluation.patientId,
        eventType: 'LIFECYCLE_CHANGED',
        fromLifecycle: oldLifecycle,
        toLifecycle: nextLifecycle,
        sourceEvaluationId: evaluation.id,
        sourceRevisionId: evaluation.assessmentRevisionId,
        sourcePeriodId: evaluation.scheduledPeriodId,
      });
    }
  } else {
    await tx.clinicalReviewCase.update({
      where: { id: currentCase.id },
      data: {
        sourceEvaluationId: evaluation.id,
        sourceRevisionId: evaluation.assessmentRevisionId,
        sourcePeriodId: evaluation.scheduledPeriodId,
      },
    });
  }

  const newReasonFamilies = materiallyNewReasonFamilies({
    current: active,
    previouslyKnown: new Set([...oldActive, ...oldPending]),
  });
  for (const reasonFamily of newReasonFamilies) {
    const priorEvent = await tx.clinicalCaseEvent.findFirst({
      where: {
        caseId: currentCase.id,
        eventType: 'REASON_ADDED',
        reasonFamily,
      },
    });
    if (!priorEvent) {
      await addCaseEvent(tx, {
        caseId: currentCase.id,
        patientId: evaluation.patientId,
        eventType: 'REASON_ADDED',
        reasonFamily,
        sourceEvaluationId: evaluation.id,
        sourceRevisionId: evaluation.assessmentRevisionId,
        sourcePeriodId: evaluation.scheduledPeriodId,
      });
      await routeTask(tx, {
        caseId: currentCase.id,
        patientId: evaluation.patientId,
        reasonFamily,
        evaluationId: evaluation.id,
        revisionId: evaluation.assessmentRevisionId,
        periodId: evaluation.scheduledPeriodId,
        now: evaluation.evaluatedAt,
        ...(requestId ? { requestId } : {}),
      });
    }
  }

  for (const reasonFamily of oldActive) {
    if (
      !active.includes(reasonFamily) &&
      !correctionRevokedFamilies.includes(reasonFamily)
    ) {
      const existingEvent = await tx.clinicalCaseEvent.findFirst({
        where: {
          caseId: currentCase.id,
          eventType: 'REASON_CLEARED',
          reasonFamily,
          sourceEvaluationId: evaluation.id,
        },
        select: { id: true },
      });
      if (existingEvent) continue;
      await addCaseEvent(tx, {
        caseId: currentCase.id,
        patientId: evaluation.patientId,
        eventType: 'REASON_CLEARED',
        reasonFamily,
        ...source,
      });
    }
  }

  for (const reasonFamily of oldPending) {
    if (
      !active.includes(reasonFamily) &&
      !pending.includes(reasonFamily) &&
      !correctionRevokedFamilies.includes(reasonFamily)
    ) {
      const existingEvent = await tx.clinicalCaseEvent.findFirst({
        where: {
          caseId: currentCase.id,
          eventType: 'REASON_CLEARED',
          reasonFamily,
          sourceEvaluationId: evaluation.id,
        },
        select: { id: true },
      });
      if (existingEvent) continue;
      await addCaseEvent(tx, {
        caseId: currentCase.id,
        patientId: evaluation.patientId,
        eventType: 'REASON_CLEARED',
        reasonFamily,
        ...source,
      });
    }
  }

  return tx.clinicalReviewCase.findUnique({ where: { id: currentCase.id } });
}

export async function reconcileClinicalEvaluation(input: {
  tx: Tx;
  evaluationId: string;
  requestId?: string;
}) {
  const evaluation = await loadEvaluation(input.tx, input.evaluationId);
  if (!evaluation) return null;
  if (objectValue(evaluation.inputSnapshot).effectScope === 'HISTORICAL') {
    return null;
  }
  await reconcileVisibility(input.tx, evaluation);
  await reconcileReasonStates(input.tx, evaluation);
  return reconcileCase(input.tx, evaluation, input.requestId);
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

async function latestSource(tx: Tx, patientId: string) {
  const assessment = await tx.weeklyAssessment.findFirst({
    where: {
      patientId,
      authoritativeRevisionId: { not: null },
    },
    orderBy: { scheduledPeriod: { periodStartAt: 'desc' } },
    include: {
      scheduledPeriod: true,
      authoritativeRevision: {
        select: { id: true, completionStatus: true, submittedAt: true },
      },
    },
  });
  if (!assessment?.authoritativeRevision) return null;
  const evaluation = await tx.assessmentEvaluation.findFirst({
    where: {
      assessmentRevisionId: assessment.authoritativeRevision.id,
      lifecycle: 'ACTIVE',
    },
    orderBy: { evaluatedAt: 'desc' },
    select: { id: true, inputSnapshot: true },
  });
  return { assessment, evaluation };
}

async function freshnessForSource(
  tx: Tx,
  patientId: string,
  sourcePeriodId: string | null,
  current: Awaited<ReturnType<typeof latestSource>>,
  now: Date,
) {
  if (!sourcePeriodId) return 'NO_CURRENT_DATA' as const;
  const sourcePeriod = await tx.scheduledPeriod.findUnique({
    where: { id: sourcePeriodId },
    select: { periodStartAt: true },
  });
  if (!sourcePeriod) return 'NO_CURRENT_DATA' as const;
  const overdueNewerPeriod = await tx.scheduledPeriod.findFirst({
    where: {
      patientId,
      periodStartAt: { gt: sourcePeriod.periodStartAt },
      effectiveDueAt: { lte: now },
    },
    orderBy: { periodStartAt: 'asc' },
    select: { id: true, periodStartAt: true, effectiveDueAt: true },
  });
  if (overdueNewerPeriod) {
    return 'STALE' as const;
  }
  if (!current) return 'CURRENT' as const;
  return 'CURRENT' as const;
}

async function sourceView(
  tx: Tx,
  patientId: string,
  sourcePeriodId: string | null,
  now: Date,
) {
  const current = await latestSource(tx, patientId);
  const freshness = await freshnessForSource(
    tx,
    patientId,
    sourcePeriodId ?? current?.assessment.scheduledPeriod.id ?? null,
    current,
    now,
  );
  const sourceGoal = objectValue(current?.evaluation?.inputSnapshot).goal;
  const goal: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE' | null =
    sourceGoal === 'ABSTINENCE' ||
    sourceGoal === 'REDUCTION' ||
    sourceGoal === 'UNSURE'
      ? sourceGoal
      : null;
  return {
    periodId: current?.assessment.scheduledPeriod.id ?? null,
    revisionId: current?.assessment.authoritativeRevision?.id ?? null,
    evaluationId: current?.evaluation?.id ?? null,
    periodStartAt:
      current?.assessment.scheduledPeriod.periodStartAt.toISOString() ?? null,
    periodEndAt:
      current?.assessment.scheduledPeriod.periodEndAt.toISOString() ?? null,
    completionStatus:
      current?.assessment.authoritativeRevision?.completionStatus ?? null,
    submittedAt:
      current?.assessment.authoritativeRevision?.submittedAt.toISOString() ??
      null,
    goal,
    freshness,
  };
}

function reasonView(state: {
  reasonFamily: ClinicalReasonFamily;
  status: 'INACTIVE' | 'ACTIVE' | 'CLEARANCE_PENDING' | 'RESOLVED';
  effect:
    | 'ELIGIBLE'
    | 'SUPPRESSED_TRIGGER'
    | 'HISTORICAL_ONLY'
    | 'REVOKED_BY_REVISION';
  sourceEvaluationId: string | null;
  sourceRevisionId: string | null;
  sourcePeriodId: string | null;
  firstActiveAt: Date | null;
  lastObservedAt: Date;
  clearanceCount: number;
}): ClinicalReasonView {
  return {
    reasonFamily: state.reasonFamily,
    status: state.status,
    effect: state.effect,
    sourceEvaluationId: state.sourceEvaluationId,
    sourceRevisionId: state.sourceRevisionId,
    sourcePeriodId: state.sourcePeriodId,
    firstActiveAt: state.firstActiveAt?.toISOString() ?? null,
    lastObservedAt: state.lastObservedAt.toISOString(),
    clearanceCount: state.clearanceCount,
  };
}

function taskView(task: {
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

function caseView(caseRow: {
  id: string;
  patientId: string;
  tier: 'NONE' | 'LEVEL_3';
  lifecycle:
    | 'NEW'
    | 'ACKNOWLEDGED'
    | 'ACTIVE'
    | 'CLEARANCE_PENDING'
    | 'RESOLVED'
    | 'RESOLVED_CORRECTION';
  caseVersion: number;
  activeReasonFamilies: Prisma.JsonValue;
  clearancePendingReasonFamilies: Prisma.JsonValue;
  highestHistoricalTier: 'NONE' | 'LEVEL_3';
  followupVisibility: boolean;
  openedAt: Date;
  acknowledgedAt: Date | null;
  updatedAt: Date;
  resolvedAt: Date | null;
  resolutionReason: string | null;
}): ClinicalCaseView {
  return {
    id: caseRow.id,
    patientId: caseRow.patientId,
    tier: caseRow.tier === 'NONE' ? 'NONE' : 'LEVEL_3',
    lifecycle: caseRow.lifecycle,
    caseVersion: caseRow.caseVersion,
    activeReasonFamilies: clinicalReasonFamilies(caseRow.activeReasonFamilies),
    clearancePendingReasonFamilies: clinicalReasonFamilies(
      caseRow.clearancePendingReasonFamilies,
    ),
    highestHistoricalTier: 'LEVEL_3',
    followupVisibility: caseRow.followupVisibility,
    openedAt: caseRow.openedAt.toISOString(),
    acknowledgedAt: caseRow.acknowledgedAt?.toISOString() ?? null,
    updatedAt: caseRow.updatedAt.toISOString(),
    resolvedAt: caseRow.resolvedAt?.toISOString() ?? null,
    resolutionReason: caseRow.resolutionReason,
  };
}

async function buildQueueItem(
  tx: Tx,
  caseRow: NonNullable<Awaited<ReturnType<typeof reconcileCase>>>,
  now: Date,
): Promise<ClinicianReviewQueueItem> {
  const [patient, states, tasks, source] = await Promise.all([
    tx.user.findUnique({
      where: { id: caseRow.patientId },
      select: { name: true },
    }),
    tx.clinicalReasonState.findMany({
      where: { patientId: caseRow.patientId },
    }),
    tx.clinicianTask.findMany({
      where: { caseId: caseRow.id },
      orderBy: { createdAt: 'asc' },
    }),
    sourceView(tx, caseRow.patientId, caseRow.sourcePeriodId, now),
  ]);
  if (!patient) {
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  }
  return {
    patientId: caseRow.patientId,
    patientName: patient.name,
    case: caseView(caseRow),
    activeReasons: states
      .filter(
        (state) =>
          state.status === 'ACTIVE' && state.effect !== 'REVOKED_BY_REVISION',
      )
      .map(reasonView),
    clearancePendingReasons: states
      .filter(
        (state) =>
          state.status === 'CLEARANCE_PENDING' &&
          state.effect !== 'REVOKED_BY_REVISION',
      )
      .map(reasonView),
    tasks: tasks.map(taskView),
    source,
  };
}

export async function readClinicalReviewQueue(
  tx: Tx,
  clock: Clock,
  clinicianId: string,
): Promise<ClinicianReviewQueueResponse> {
  const assignments = await tx.clinicianPatientAssignment.findMany({
    where: { clinicianUserId: clinicianId, endedAt: null },
    select: { patientId: true },
  });
  const patientIds = [...new Set(assignments.map((item) => item.patientId))];
  if (patientIds.length === 0) return { items: [] };
  const cases = await tx.clinicalReviewCase.findMany({
    where: {
      patientId: { in: patientIds },
      lifecycle: { in: [...OPEN_CASE_LIFECYCLES] },
    },
    orderBy: { updatedAt: 'desc' },
  });
  const items = await Promise.all(
    cases.map((caseRow) => buildQueueItem(tx, caseRow, clock.now())),
  );
  return { items };
}

export async function readClinicianPatientMonitoring(input: {
  tx: Tx;
  clock: Clock;
  clinicianId: string;
  patientId: string;
}): Promise<ClinicianPatientMonitoringResponse> {
  await assertAssignedPatient(input.tx, input.clinicianId, input.patientId);
  const [patient, flags, states, currentCase, tasks, history] =
    await Promise.all([
      input.tx.user.findUnique({
        where: { id: input.patientId },
        select: { name: true },
      }),
      input.tx.clinicianVisibilityFlag.findMany({
        where: { patientId: input.patientId },
        orderBy: { flagKey: 'asc' },
      }),
      input.tx.clinicalReasonState.findMany({
        where: { patientId: input.patientId },
      }),
      input.tx.clinicalReviewCase.findFirst({
        where: { patientId: input.patientId },
        orderBy: { openedAt: 'desc' },
      }),
      input.tx.clinicianTask.findMany({
        where: {
          patientId: input.patientId,
          caseType: { in: ['CLINICAL', 'SUBJECTIVE_LEVEL_3_REVIEW'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
      input.tx.clinicalReasonHistory.findMany({
        where: { patientId: input.patientId },
        orderBy: { recordedAt: 'desc' },
      }),
    ]);
  if (!patient) {
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  }
  const source = await sourceView(
    input.tx,
    input.patientId,
    currentCase?.sourcePeriodId ?? null,
    input.clock.now(),
  );
  const freshnessForFlag = async (flag: (typeof flags)[number]) =>
    flag.status === 'REVOKED_BY_REVISION'
      ? ('REVOKED_BY_REVISION' as const)
      : await freshnessForSource(
          input.tx,
          input.patientId,
          flag.sourcePeriodId,
          await latestSource(input.tx, input.patientId),
          input.clock.now(),
        );
  const visibilityFlags = await Promise.all(
    flags.map(async (flag) => {
      const freshness = await freshnessForFlag(flag);
      const status =
        freshness === 'CURRENT'
          ? flag.status
          : freshness === 'REVOKED_BY_REVISION'
            ? 'REVOKED_BY_REVISION'
            : 'STALE_DATA_UNAVAILABLE';
      return {
        flagKey: flag.flagKey,
        status,
        sourceEvaluationId: flag.sourceEvaluationId,
        sourceRevisionId: flag.sourceRevisionId,
        sourcePeriodId: flag.sourcePeriodId,
        sourceCompletionStatus: flag.sourceCompletionStatus,
        sourceSubmittedAt: flag.sourceSubmittedAt?.toISOString() ?? null,
      };
    }),
  );
  return {
    patientId: input.patientId,
    patientName: patient.name,
    source,
    visibilityFlags,
    currentReasons: states
      .filter(
        (state) =>
          (state.status === 'ACTIVE' || state.status === 'CLEARANCE_PENDING') &&
          state.effect !== 'REVOKED_BY_REVISION',
      )
      .map(reasonView),
    currentCase: currentCase ? caseView(currentCase) : null,
    tasks: tasks.map(taskView),
    reasonHistory: history.map((item) => ({
      reasonFamily: item.reasonFamily,
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      effect: item.effect,
      cause: item.cause,
      recordedAt: item.recordedAt.toISOString(),
    })),
  };
}

export async function acknowledgeClinicalCase(input: {
  tx: Tx;
  clock: Clock;
  clinicianId: string;
  caseId: string;
  expectedCaseVersion: number;
  requestId: string;
}) {
  let currentCase = await input.tx.clinicalReviewCase.findUnique({
    where: { id: input.caseId },
  });
  if (!currentCase) {
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  }
  await assertAssignedPatient(
    input.tx,
    input.clinicianId,
    currentCase.patientId,
  );
  await lockPatientForProcessing(input.tx, currentCase.patientId);
  currentCase = await input.tx.clinicalReviewCase.findUnique({
    where: { id: input.caseId },
  });
  if (!currentCase) {
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  }
  if (currentCase.caseVersion !== input.expectedCaseVersion) {
    throw new DomainError(
      409,
      'VERSION_CONFLICT',
      'The review case has changed.',
    );
  }
  if (
    currentCase.lifecycle === 'RESOLVED' ||
    currentCase.lifecycle === 'RESOLVED_CORRECTION'
  ) {
    throw new DomainError(
      409,
      'CASE_NOT_OPEN',
      'The review case is no longer open.',
    );
  }
  if (currentCase.lifecycle === 'NEW') {
    const activeReasons = clinicalReasonFamilies(
      currentCase.activeReasonFamilies,
    );
    const pendingReasons = clinicalReasonFamilies(
      currentCase.clearancePendingReasonFamilies,
    );
    const nextLifecycle =
      activeReasons.length > 0
        ? 'ACTIVE'
        : pendingReasons.length > 0
          ? 'CLEARANCE_PENDING'
          : 'ACKNOWLEDGED';
    await input.tx.clinicalReviewCase.update({
      where: { id: currentCase.id },
      data: {
        lifecycle: nextLifecycle,
        tier: activeReasons.length > 0 ? 'LEVEL_3' : 'NONE',
        acknowledgedAt: input.clock.now(),
        caseVersion: { increment: 1 },
      },
    });
    await addCaseEvent(input.tx, {
      caseId: currentCase.id,
      patientId: currentCase.patientId,
      eventType: 'CASE_ACKNOWLEDGED',
      fromLifecycle: 'NEW',
      toLifecycle: nextLifecycle,
      actorId: input.clinicianId,
      metadata: json({ requestId: input.requestId }),
    });
    await input.tx.clinicianTask.updateMany({
      where: {
        caseId: currentCase.id,
        alertUpdateRequired: false,
        deliveryStatus: { in: ['DELIVERED', 'UNROUTED'] },
      },
      data: {
        deliveryStatus: 'ACKNOWLEDGED',
        acknowledgedAt: input.clock.now(),
      },
    });
    await input.tx.auditEvent.create({
      data: {
        actorId: input.clinicianId,
        action: 'CLINICAL_REVIEW_CASE_ACKNOWLEDGED',
        entityType: 'CLINICAL_REVIEW_CASE',
        entityId: currentCase.id,
        patientId: currentCase.patientId,
        requestId: input.requestId,
      },
    });
  }
  return readClinicianPatientMonitoring({
    tx: input.tx,
    clock: input.clock,
    clinicianId: input.clinicianId,
    patientId: currentCase.patientId,
  });
}
