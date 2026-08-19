import { ScheduleReadResponseSchema } from '@aud-subjective/contracts';

import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { Clock } from '../../shared/clock/clock.js';
import { normalizeMonitoringTimezone } from '../../shared/authz/timezone.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import {
  firstCompletePeriodStart,
  weeklyPeriodWindow,
} from './schedule-math.js';

type ScheduleStore = PrismaClient | Prisma.TransactionClient;

export const lockSchedulePatient = lockPatientForProcessing;

function periodData(patientId: string, timezone: string, startAt: Date) {
  const window = weeklyPeriodWindow(startAt, timezone);
  return {
    patientId,
    monitoringTimezone: timezone,
    ...window,
    effectiveDueAt: window.originalDueAt,
  };
}

export async function createInitialSchedule(
  prisma: PrismaClient,
  clock: Clock,
  input: { patientId: string; actorUserId: string; provenance: string },
) {
  return prisma.$transaction(async (tx) => {
    await lockSchedulePatient(tx, input.patientId);
    const existing = await tx.monitoringScheduleVersion.findFirst({
      where: { patientId: input.patientId, lifecycle: 'ACTIVE' },
      include: { periods: { orderBy: { periodStartAt: 'asc' } } },
    });
    if (existing) return existing;
    const profile = await tx.patientProfile.findUniqueOrThrow({
      where: { patientId: input.patientId },
    });
    const timezone = normalizeMonitoringTimezone(profile.monitoringTimezone);
    const startAt = firstCompletePeriodStart(clock.now(), timezone);
    return tx.monitoringScheduleVersion.create({
      data: {
        patientId: input.patientId,
        version: 1,
        monitoringTimezone: timezone,
        effectiveBoundary: startAt,
        createdAt: clock.now(),
        createdByUserId: input.actorUserId,
        provenance: input.provenance,
        periods: {
          create: {
            ...periodData(input.patientId, timezone, startAt),
            createdAt: clock.now(),
          },
        },
      },
      include: { periods: true },
    });
  });
}

/** The next boundary is derived from persisted history; callers cannot choose it. */
export async function provisionNextPeriod(
  prisma: PrismaClient,
  clock: Clock,
  patientId: string,
) {
  return prisma.$transaction(async (tx) => {
    await lockSchedulePatient(tx, patientId);
    const latest = await tx.scheduledPeriod.findFirst({
      where: { patientId },
      orderBy: { periodEndAt: 'desc' },
    });
    if (!latest)
      throw new DomainError(
        409,
        'VERSION_CONFLICT',
        'Monitoring is not activated.',
      );
    const active = await tx.monitoringScheduleVersion.findFirstOrThrow({
      where: { patientId, lifecycle: 'ACTIVE' },
    });
    const pending = await tx.monitoringScheduleVersion.findFirst({
      where: { patientId, lifecycle: 'PENDING' },
    });
    const now = clock.now();
    let schedule = active;
    let startAt: Date;

    if (pending) {
      if (now < pending.effectiveBoundary) return latest;
      if (latest.periodEndAt > pending.effectiveBoundary)
        throw new DomainError(
          500,
          'INTERNAL_ERROR',
          'Persisted schedule history overlaps a pending transition boundary.',
        );
      schedule = pending;
      await tx.monitoringScheduleVersion.updateMany({
        where: { patientId, lifecycle: 'ACTIVE' },
        data: { lifecycle: 'SUPERSEDED', supersededAt: now },
      });
      await tx.monitoringScheduleVersion.update({
        where: { id: schedule.id },
        data: { lifecycle: 'ACTIVE' },
      });
      startAt = pending.effectiveBoundary;
    } else {
      if (
        latest.periodStartAt >=
        firstCompletePeriodStart(now, active.monitoringTimezone)
      )
        return latest;
      startAt = latest.periodEndAt;
    }
    const period = await tx.scheduledPeriod.create({
      data: {
        ...periodData(patientId, schedule.monitoringTimezone, startAt),
        scheduleVersionId: schedule.id,
        createdAt: now,
      },
    });
    return period;
  });
}

/** A changed timezone starts at the first new-zone Monday not before materialized history ends. */
export async function requestScheduleTimezoneChange(
  tx: Prisma.TransactionClient,
  clock: Clock,
  input: { patientId: string; timezone: string; actorUserId: string },
) {
  await lockSchedulePatient(tx, input.patientId);
  const active = await tx.monitoringScheduleVersion.findFirst({
    where: { patientId: input.patientId, lifecycle: 'ACTIVE' },
  });
  if (!active) return null;
  const timezone = normalizeMonitoringTimezone(input.timezone);
  let effectiveSchedule = active;
  let pending = await tx.monitoringScheduleVersion.findFirst({
    where: { patientId: input.patientId, lifecycle: 'PENDING' },
  });
  const now = clock.now();
  if (pending && now >= pending.effectiveBoundary) {
    await tx.monitoringScheduleVersion.update({
      where: { id: active.id },
      data: {
        lifecycle: 'SUPERSEDED',
        supersededAt: pending.effectiveBoundary,
      },
    });
    await tx.monitoringScheduleVersion.update({
      where: { id: pending.id },
      data: { lifecycle: 'ACTIVE' },
    });
    effectiveSchedule = pending;
    pending = null;
  }
  if (effectiveSchedule.monitoringTimezone === timezone) {
    if (pending)
      await tx.monitoringScheduleVersion.update({
        where: { id: pending.id },
        data: { lifecycle: 'SUPERSEDED', supersededAt: now },
      });
    return effectiveSchedule;
  }
  if (pending?.monitoringTimezone === timezone) return pending;
  const latestPeriod = await tx.scheduledPeriod.findFirst({
    where: { patientId: input.patientId },
    orderBy: { periodEndAt: 'desc' },
  });
  if (!latestPeriod) return active;
  const currentBoundary = firstCompletePeriodStart(
    now,
    effectiveSchedule.monitoringTimezone,
  );
  const protectedThrough =
    latestPeriod.periodEndAt > currentBoundary
      ? latestPeriod.periodEndAt
      : currentBoundary;
  await tx.monitoringScheduleVersion.updateMany({
    where: { patientId: input.patientId, lifecycle: 'PENDING' },
    data: { lifecycle: 'SUPERSEDED', supersededAt: now },
  });
  const latestVersion = await tx.monitoringScheduleVersion.findFirstOrThrow({
    where: { patientId: input.patientId },
    orderBy: { version: 'desc' },
  });
  return tx.monitoringScheduleVersion.create({
    data: {
      patientId: input.patientId,
      version: latestVersion.version + 1,
      monitoringTimezone: timezone,
      effectiveBoundary: firstCompletePeriodStart(protectedThrough, timezone),
      lifecycle: 'PENDING',
      createdAt: now,
      createdByUserId: input.actorUserId,
      provenance: 'Patient monitoring timezone update',
    },
  });
}

export async function reschedulePeriod(
  prisma: PrismaClient,
  clock: Clock,
  input: {
    periodId: string;
    expectedVersion: number;
    newEffectiveDueAt: Date;
    actorUserId: string;
    reason: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "period_id" FROM "scheduled_periods" WHERE "period_id" = ${input.periodId}::uuid FOR UPDATE`;
    const period = await tx.scheduledPeriod.findUnique({
      where: { id: input.periodId },
    });
    if (!period || period.version !== input.expectedVersion)
      throw new DomainError(
        409,
        'VERSION_CONFLICT',
        'The period changed before this action.',
      );
    if (clock.now() >= period.effectiveDueAt)
      throw new DomainError(
        409,
        'VERSION_CONFLICT',
        'The due cutoff has passed.',
      );
    if (input.newEffectiveDueAt <= period.openAt)
      throw new DomainError(
        400,
        'VALIDATION_ERROR',
        'The due time must follow the open time.',
      );
    const updated = await tx.scheduledPeriod.update({
      where: { id: period.id },
      data: {
        effectiveDueAt: input.newEffectiveDueAt,
        version: { increment: 1 },
      },
    });
    await tx.periodRescheduleAudit.create({
      data: {
        periodId: period.id,
        previousEffectiveDue: period.effectiveDueAt,
        newEffectiveDue: input.newEffectiveDueAt,
        actorUserId: input.actorUserId,
        reason: input.reason,
        occurredAt: clock.now(),
      },
    });
    return updated;
  });
}

export async function readPatientSchedule(
  store: ScheduleStore,
  patientId: string,
  clock: Clock,
) {
  const active = await store.monitoringScheduleVersion.findFirst({
    where: { patientId, lifecycle: 'ACTIVE' },
  });
  if (!active)
    return ScheduleReadResponseSchema.parse({ state: 'NOT_ACTIVATED' });
  const pending = await store.monitoringScheduleVersion.findFirst({
    where: { patientId, lifecycle: 'PENDING' },
  });
  const now = clock.now();
  const schedule =
    pending && now >= pending.effectiveBoundary ? pending : active;
  const periods = await store.scheduledPeriod.findMany({
    where: { patientId },
    orderBy: { periodStartAt: 'asc' },
  });
  return ScheduleReadResponseSchema.parse({
    state: 'ACTIVATED',
    schedule: {
      scheduleVersionId: schedule.id,
      version: schedule.version,
      monitoringTimezone: schedule.monitoringTimezone,
      effectiveBoundary: schedule.effectiveBoundary.toISOString(),
    },
    periods: periods.map((period) => ({
      periodId: period.id,
      scheduleVersionId: period.scheduleVersionId,
      monitoringTimezone: period.monitoringTimezone,
      periodStartAt: period.periodStartAt.toISOString(),
      periodEndAt: period.periodEndAt.toISOString(),
      openAt: period.openAt.toISOString(),
      originalDueAt: period.originalDueAt.toISOString(),
      effectiveDueAt: period.effectiveDueAt.toISOString(),
      version: period.version,
    })),
  });
}
