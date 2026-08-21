import {
  TechnicalFailureListResponseSchema,
  TechnicalFailureViewSchema,
  type RecordTechnicalFailureRequest,
  type TechnicalFailureView,
} from '@aud-subjective/contracts';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { SUBJECTIVE_MONITORING_V1 } from '../../policy/subjective-monitoring-v1.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import {
  reconcileEngagementForPatient,
  resolveOpenEngagementCase,
} from '../engagement/service.js';

type Tx = Prisma.TransactionClient;
const HOUR_MS = 60 * 60 * 1_000;

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function evidenceSummary(value: Prisma.JsonValue) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const summary = (value as Record<string, Prisma.JsonValue>).summary;
    if (typeof summary === 'string' && summary.trim()) return summary;
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function timingImpact(row: {
  status: 'SUSPECTED' | 'CONFIRMED' | 'RESOLVED' | 'CORRECTED_FALSE_POSITIVE';
  recalculatedEffectiveDueAt: Date | null;
}) {
  if (row.status === 'CONFIRMED') return 'PAUSED' as const;
  if (row.status === 'RESOLVED' && row.recalculatedEffectiveDueAt) {
    return 'RECALCULATED' as const;
  }
  if (row.status === 'CORRECTED_FALSE_POSITIVE') return 'CORRECTED' as const;
  return 'NONE' as const;
}

async function technicalFailureView(
  tx: Tx,
  row: Awaited<ReturnType<Tx['technicalFailure']['findUnique']>>,
): Promise<TechnicalFailureView> {
  if (!row) {
    throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
  }
  const patient = await tx.user.findUnique({
    where: { id: row.patientId },
    select: { name: true },
  });
  if (!patient) {
    throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
  }
  return TechnicalFailureViewSchema.parse({
    id: row.id,
    patientId: row.patientId,
    patientName: patient.name,
    failureType: row.failureType,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    evidenceSummary: evidenceSummary(row.evidence),
    version: row.version,
    confirmedBy: row.confirmedBy,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    resolvedBy: row.resolvedBy,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    correctedBy: row.correctedBy,
    correctedAt: row.correctedAt?.toISOString() ?? null,
    reason: row.reason,
    sourcePeriodId: row.sourcePeriodId,
    previousEffectiveDueAt: row.previousEffectiveDueAt?.toISOString() ?? null,
    recalculatedEffectiveDueAt:
      row.recalculatedEffectiveDueAt?.toISOString() ?? null,
    timingImpact: timingImpact(row),
  });
}

export async function readTechnicalFailures(
  prisma: PrismaClient,
): Promise<{ items: TechnicalFailureView[] }> {
  const rows = await prisma.technicalFailure.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  const items: TechnicalFailureView[] = [];
  for (const row of rows) {
    items.push(
      await prisma.$transaction((tx) => technicalFailureView(tx, row)),
    );
  }
  return TechnicalFailureListResponseSchema.parse({ items });
}

async function loadFailure(tx: Tx, failureId: string) {
  const row = await tx.technicalFailure.findUnique({
    where: { id: failureId },
  });
  if (!row) {
    throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
  }
  return row;
}

async function assertPatientAndPeriod(
  tx: Tx,
  patientId: string,
  periodId: string | null,
) {
  const patient = await tx.patientProfile.findUnique({
    where: { patientId },
    select: { patientId: true },
  });
  if (!patient) {
    throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
  }
  if (!periodId) return null;
  const period = await tx.scheduledPeriod.findFirst({
    where: { id: periodId, patientId },
  });
  if (!period) {
    throw new DomainError(409, 'VERSION_CONFLICT', 'The scheduled period is not valid for this patient.');
  }
  return period;
}

async function sourcePeriodForFailure(tx: Tx, failure: {
  patientId: string;
  sourcePeriodId: string | null;
}) {
  if (failure.sourcePeriodId) {
    const period = await tx.scheduledPeriod.findFirst({
      where: { id: failure.sourcePeriodId, patientId: failure.patientId },
    });
    if (period) return period;
  }
  const state = await tx.engagementState.findUnique({
    where: { patientId: failure.patientId },
    select: { missedCyclePeriodId: true },
  });
  if (state?.missedCyclePeriodId) {
    const period = await tx.scheduledPeriod.findFirst({
      where: { id: state.missedCyclePeriodId, patientId: failure.patientId },
    });
    if (period) return period;
  }
  return tx.scheduledPeriod.findFirst({
    where: { patientId: failure.patientId },
    orderBy: [{ effectiveDueAt: 'desc' }, { periodStartAt: 'desc' }],
  });
}

async function recordAudit(
  tx: Tx,
  input: {
    action: string;
    failureId: string;
    patientId: string;
    actorId: string;
    requestId: string;
    now: Date;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: 'TECHNICAL_FAILURE',
      entityId: input.failureId,
      patientId: input.patientId,
      occurredAt: input.now,
      requestId: input.requestId,
      configurationVersion: SUBJECTIVE_MONITORING_V1.configurationVersion,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    },
  });
}

export async function recordTechnicalFailure(input: {
  tx: Tx;
  clock: Clock;
  actorId: string;
  requestId: string;
  body: RecordTechnicalFailureRequest;
}) {
  const now = input.clock.now();
  const period = await assertPatientAndPeriod(
    input.tx,
    input.body.patientId,
    input.body.periodId ?? null,
  );
  const row = await input.tx.technicalFailure.create({
    data: {
      patientId: input.body.patientId,
      failureType: input.body.failureType,
      affectedScope: json({ kind: 'PATIENT', patientId: input.body.patientId }),
      startedAt: new Date(input.body.startedAt),
      evidence: json({ summary: input.body.evidence }),
      status: 'SUSPECTED',
      sourcePeriodId: period?.id ?? null,
      createdAt: now,
      updatedAt: now,
    },
  });
  await recordAudit(input.tx, {
    action: 'TECHNICAL_FAILURE_RECORDED_SUSPECTED',
    failureId: row.id,
    patientId: row.patientId,
    actorId: input.actorId,
    requestId: input.requestId,
    now,
    metadata: json({ failureType: row.failureType, sourcePeriodId: row.sourcePeriodId }),
  });
  return technicalFailureView(input.tx, row);
}

export async function confirmTechnicalFailure(input: {
  tx: Tx;
  clock: Clock;
  failureId: string;
  expectedVersion: number;
  reason: string;
  actorId: string;
  requestId: string;
}) {
  const current = await loadFailure(input.tx, input.failureId);
  await lockPatientForProcessing(input.tx, current.patientId);
  const locked = await loadFailure(input.tx, input.failureId);
  if (locked.version !== input.expectedVersion) {
    throw new DomainError(409, 'VERSION_CONFLICT', 'The technical-failure record changed before this action.');
  }
  if (locked.status === 'CONFIRMED') return technicalFailureView(input.tx, locked);
  if (locked.status !== 'SUSPECTED') {
    throw new DomainError(409, 'INVALID_TECHNICAL_FAILURE_TRANSITION', 'This technical-failure record cannot be confirmed.');
  }
  const period = await sourcePeriodForFailure(input.tx, locked);
  const now = input.clock.now();
  const row = await input.tx.technicalFailure.update({
    where: { id: locked.id },
    data: {
      status: 'CONFIRMED',
      confirmedBy: input.actorId,
      confirmedAt: now,
      reason: input.reason,
      sourcePeriodId: period?.id ?? locked.sourcePeriodId,
      previousEffectiveDueAt: period?.effectiveDueAt ?? null,
      version: { increment: 1 },
      updatedAt: now,
    },
  });
  await recordAudit(input.tx, {
    action: 'TECHNICAL_FAILURE_CONFIRMED',
    failureId: row.id,
    patientId: row.patientId,
    actorId: input.actorId,
    requestId: input.requestId,
    now,
    metadata: json({ sourcePeriodId: row.sourcePeriodId, evidence: row.evidence }),
  });
  await reconcileEngagementForPatient({
    tx: input.tx,
    clock: input.clock,
    patientId: row.patientId,
    actorId: input.actorId,
    requestId: input.requestId,
  });
  return technicalFailureView(input.tx, row);
}

async function reopenTechnicalReminderSlots(
  tx: Tx,
  patientId: string,
  periodId: string | null,
) {
  if (!periodId) return;
  await tx.missedCheckinReminder.updateMany({
    where: {
      patientId,
      missedCyclePeriodId: periodId,
      cancellationReason: 'TECHNICAL_FAILURE',
    },
    data: { cancelledAt: null, cancellationReason: null },
  });
}

export async function resolveTechnicalFailure(input: {
  tx: Tx;
  clock: Clock;
  failureId: string;
  expectedVersion: number;
  reason: string;
  actorId: string;
  requestId: string;
}) {
  const current = await loadFailure(input.tx, input.failureId);
  await lockPatientForProcessing(input.tx, current.patientId);
  const locked = await loadFailure(input.tx, input.failureId);
  if (locked.version !== input.expectedVersion) {
    throw new DomainError(409, 'VERSION_CONFLICT', 'The technical-failure record changed before this action.');
  }
  if (locked.status === 'RESOLVED') return technicalFailureView(input.tx, locked);
  if (locked.status !== 'CONFIRMED') {
    throw new DomainError(409, 'INVALID_TECHNICAL_FAILURE_TRANSITION', 'Only a confirmed technical failure can be resolved.');
  }
  const period = await sourcePeriodForFailure(input.tx, locked);
  if (!period) {
    throw new DomainError(409, 'VERSION_CONFLICT', 'A scheduled period is required to recalculate monitoring timing.');
  }
  const now = input.clock.now();
  const pauseDurationMs = now.getTime() - locked.startedAt.getTime();
  if (pauseDurationMs < 0) {
    throw new DomainError(409, 'INVALID_TECHNICAL_FAILURE_TRANSITION', 'The failure start cannot be after its resolution time.');
  }
  const recalculatedEffectiveDueAt = new Date(
    Math.max(
      period.originalDueAt.getTime() + pauseDurationMs,
      now.getTime() +
        SUBJECTIVE_MONITORING_V1.engagement.technicalRecoveryGraceHours * HOUR_MS,
    ),
  );
  const previousEffectiveDueAt = period.effectiveDueAt;
  if (previousEffectiveDueAt.getTime() !== recalculatedEffectiveDueAt.getTime()) {
    await input.tx.scheduledPeriod.update({
      where: { id: period.id },
      data: {
        effectiveDueAt: recalculatedEffectiveDueAt,
        version: { increment: 1 },
      },
    });
    await input.tx.periodRescheduleAudit.create({
      data: {
        periodId: period.id,
        previousEffectiveDue: previousEffectiveDueAt,
        newEffectiveDue: recalculatedEffectiveDueAt,
        actorUserId: input.actorId,
        reason: `TECHNICAL_FAILURE_RESOLVED: ${input.reason}`,
        occurredAt: now,
      },
    });
  }
  const row = await input.tx.technicalFailure.update({
    where: { id: locked.id },
    data: {
      status: 'RESOLVED',
      resolvedBy: input.actorId,
      resolvedAt: now,
      reason: input.reason,
      sourcePeriodId: period.id,
      previousEffectiveDueAt,
      recalculatedEffectiveDueAt,
      version: { increment: 1 },
      updatedAt: now,
    },
  });
  await reopenTechnicalReminderSlots(input.tx, row.patientId, period.id);
  await recordAudit(input.tx, {
    action: 'TECHNICAL_FAILURE_RESOLVED',
    failureId: row.id,
    patientId: row.patientId,
    actorId: input.actorId,
    requestId: input.requestId,
    now,
    metadata: json({
      sourcePeriodId: period.id,
      previousEffectiveDueAt: previousEffectiveDueAt.toISOString(),
      recalculatedEffectiveDueAt: recalculatedEffectiveDueAt.toISOString(),
      pauseDurationMs,
    }),
  });
  await reconcileEngagementForPatient({
    tx: input.tx,
    clock: input.clock,
    patientId: row.patientId,
    actorId: input.actorId,
    requestId: input.requestId,
  });
  return technicalFailureView(input.tx, row);
}

export async function correctTechnicalFailure(input: {
  tx: Tx;
  clock: Clock;
  failureId: string;
  expectedVersion: number;
  reason: string;
  actorId: string;
  requestId: string;
}) {
  const current = await loadFailure(input.tx, input.failureId);
  await lockPatientForProcessing(input.tx, current.patientId);
  const locked = await loadFailure(input.tx, input.failureId);
  if (locked.version !== input.expectedVersion) {
    throw new DomainError(409, 'VERSION_CONFLICT', 'The technical-failure record changed before this action.');
  }
  if (locked.status === 'CORRECTED_FALSE_POSITIVE') {
    return technicalFailureView(input.tx, locked);
  }
  if (locked.status !== 'CONFIRMED') {
    throw new DomainError(409, 'INVALID_TECHNICAL_FAILURE_TRANSITION', 'Only a confirmed technical failure can be corrected.');
  }
  const period = await sourcePeriodForFailure(input.tx, locked);
  const now = input.clock.now();
  if (period && locked.previousEffectiveDueAt) {
    if (period.effectiveDueAt.getTime() !== locked.previousEffectiveDueAt.getTime()) {
      await input.tx.scheduledPeriod.update({
        where: { id: period.id },
        data: {
          effectiveDueAt: locked.previousEffectiveDueAt,
          version: { increment: 1 },
        },
      });
      await input.tx.periodRescheduleAudit.create({
        data: {
          periodId: period.id,
          previousEffectiveDue: period.effectiveDueAt,
          newEffectiveDue: locked.previousEffectiveDueAt,
          actorUserId: input.actorId,
          reason: `TECHNICAL_FAILURE_FALSE_POSITIVE_CORRECTION: ${input.reason}`,
          occurredAt: now,
        },
      });
    }
  }
  const row = await input.tx.technicalFailure.update({
    where: { id: locked.id },
    data: {
      status: 'CORRECTED_FALSE_POSITIVE',
      correctedBy: input.actorId,
      correctedAt: now,
      reason: input.reason,
      sourcePeriodId: period?.id ?? locked.sourcePeriodId,
      version: { increment: 1 },
      updatedAt: now,
    },
  });
  await reopenTechnicalReminderSlots(input.tx, row.patientId, period?.id ?? row.sourcePeriodId);
  await resolveOpenEngagementCase(
    {
      tx: input.tx,
      clock: input.clock,
      patientId: row.patientId,
      actorId: input.actorId,
      requestId: input.requestId,
    },
    'RESOLVED_TECHNICAL_CORRECTION',
    'CASE_RESOLVED_TECHNICAL_CORRECTION',
    'TECHNICAL_FAILURE_CORRECTED_FALSE_POSITIVE',
    now,
    row.id,
  );
  await recordAudit(input.tx, {
    action: 'TECHNICAL_FAILURE_CORRECTED_FALSE_POSITIVE',
    failureId: row.id,
    patientId: row.patientId,
    actorId: input.actorId,
    requestId: input.requestId,
    now,
    metadata: json({ sourcePeriodId: row.sourcePeriodId }),
  });
  await reconcileEngagementForPatient({
    tx: input.tx,
    clock: input.clock,
    patientId: row.patientId,
    actorId: input.actorId,
    requestId: input.requestId,
  });
  return technicalFailureView(input.tx, row);
}
