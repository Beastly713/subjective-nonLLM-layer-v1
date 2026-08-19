import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  loadRootEnvironment,
  parseTestDatabaseUrl,
} from '../../src/infrastructure/config/config.js';
import { createPrismaClient } from '../../src/infrastructure/db/prisma.js';
import {
  createInitialSchedule,
  provisionNextPeriod,
  readPatientSchedule,
  requestScheduleTimezoneChange,
  reschedulePeriod,
} from '../../src/modules/scheduling/service.js';
import { FixedClock } from '../../src/shared/clock/clock.js';

loadRootEnvironment();
const prisma = createPrismaClient(parseTestDatabaseUrl(process.env));
const actorId = randomUUID();
const patientId = actorId;
const clock = new FixedClock(new Date('2026-08-19T12:00:00.000Z'));

beforeAll(async () => {
  await prisma.user.create({
    data: {
      id: patientId,
      name: 'Synthetic Schedule Patient',
      email: `schedule-${patientId}@example.test`,
      emailVerified: true,
      applicationAccount: {
        create: { state: 'ACTIVE', createdByUserId: actorId },
      },
      patientProfile: {
        create: {
          monitoringTimezone: 'UTC',
          createdByUserId: actorId,
          updatedByUserId: actorId,
          processingLock: { create: {} },
          preferences: { create: { version: 1, createdByUserId: actorId } },
        },
      },
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('persisted authoritative schedules', () => {
  async function createSchedulePatient(timezone: string) {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        name: 'Timezone transition patient',
        email: `timezone-${id}@example.test`,
        emailVerified: true,
        applicationAccount: {
          create: { state: 'ACTIVE', createdByUserId: id },
        },
        patientProfile: {
          create: {
            monitoringTimezone: timezone,
            createdByUserId: id,
            updatedByUserId: id,
            processingLock: { create: {} },
            preferences: { create: { version: 1, createdByUserId: id } },
          },
        },
      },
    });
    return id;
  }
  it('creates the first complete period and returns it on repeated activation', async () => {
    const first = await createInitialSchedule(prisma, clock, {
      patientId,
      actorUserId: actorId,
      provenance: 'Scheduling integration activation',
    });
    const replay = await createInitialSchedule(prisma, clock, {
      patientId,
      actorUserId: actorId,
      provenance: 'Scheduling integration activation',
    });
    expect(first.id).toBe(replay.id);
    expect(first.periods).toHaveLength(1);
    expect(first.periods[0]?.periodStartAt.toISOString()).toBe(
      '2026-08-24T00:00:00.000Z',
    );
    expect(first.periods[0]?.periodEndAt.toISOString()).toBe(
      '2026-08-31T00:00:00.000Z',
    );
  });

  it('provisions the next logical period once under concurrency', async () => {
    await prisma.scheduledPeriod.findFirstOrThrow({
      where: { patientId },
      orderBy: { periodStartAt: 'asc' },
    });
    clock.set(new Date('2026-08-25T12:00:00.000Z'));
    const [first, second] = await Promise.all([
      provisionNextPeriod(prisma, clock, patientId),
      provisionNextPeriod(prisma, clock, patientId),
    ]);
    expect(first.id).toBe(second.id);
    expect(await prisma.scheduledPeriod.count({ where: { patientId } })).toBe(
      2,
    );
    const periods = await prisma.scheduledPeriod.findMany({
      where: { patientId },
      orderBy: { periodStartAt: 'asc' },
    });
    expect(periods[0]!.periodEndAt.getTime()).toBeLessThanOrEqual(
      periods[1]!.periodStartAt.getTime(),
    );
  });

  it('keeps an existing period immutable and makes timezone change effective at a future boundary', async () => {
    const original = await prisma.scheduledPeriod.findFirstOrThrow({
      where: { patientId },
      orderBy: { periodStartAt: 'asc' },
    });
    clock.set(new Date('2026-08-25T12:00:00.000Z'));
    const changed = await prisma.$transaction((tx) =>
      requestScheduleTimezoneChange(tx, clock, {
        patientId,
        timezone: 'Asia/Kolkata',
        actorUserId: actorId,
      }),
    );
    expect(changed?.version).toBe(2);
    expect(changed?.lifecycle).toBe('PENDING');
    const unchanged = await prisma.scheduledPeriod.findUniqueOrThrow({
      where: { id: original.id },
    });
    expect(unchanged.monitoringTimezone).toBe('UTC');
    expect(unchanged.scheduleVersionId).toBe(original.scheduleVersionId);
    await expect(
      prisma.scheduledPeriod.update({
        where: { id: original.id },
        data: { monitoringTimezone: 'Asia/Kolkata' },
      }),
    ).rejects.toThrow();
  });

  it('transitions UTC to Kolkata without overlap and provisions the new-zone Monday', async () => {
    const id = await createSchedulePatient('UTC');
    clock.set(new Date('2026-08-19T12:00:00.000Z'));
    const initial = await createInitialSchedule(prisma, clock, {
      patientId: id,
      actorUserId: id,
      provenance: 'Timezone transition fixture',
    });
    const oldPeriod = initial.periods[0]!;
    const pending = await prisma.$transaction((tx) =>
      requestScheduleTimezoneChange(tx, clock, {
        patientId: id,
        timezone: 'Asia/Kolkata',
        actorUserId: id,
      }),
    );
    expect(pending?.effectiveBoundary.toISOString()).toBe(
      '2026-09-06T18:30:00.000Z',
    );
    const displayBefore = await prisma.$transaction((tx) =>
      readPatientSchedule(tx, id, clock),
    );
    expect(displayBefore.state).toBe('ACTIVATED');
    if (displayBefore.state !== 'ACTIVATED')
      throw new Error('Expected active schedule');
    expect(displayBefore.schedule.monitoringTimezone).toBe('UTC');

    clock.set(pending!.effectiveBoundary);
    const next = await provisionNextPeriod(prisma, clock, id);
    expect(next.monitoringTimezone).toMatch(/^Asia\/(Kolkata|Calcutta)$/);
    expect(next.periodStartAt.toISOString()).toBe('2026-09-06T18:30:00.000Z');
    expect(next.periodStartAt.getTime()).toBeGreaterThanOrEqual(
      oldPeriod.periodEndAt.getTime(),
    );
    const active = await prisma.monitoringScheduleVersion.findUniqueOrThrow({
      where: { id: pending!.id },
    });
    expect(active.lifecycle).toBe('ACTIVE');
  });

  it('does not provision an old-zone period before a pending timezone boundary', async () => {
    const id = await createSchedulePatient('UTC');
    clock.set(new Date('2026-08-19T12:00:00.000Z'));
    const initial = await createInitialSchedule(prisma, clock, {
      patientId: id,
      actorUserId: id,
      provenance: 'Pre-boundary transition fixture',
    });
    const pending = await prisma.$transaction((tx) =>
      requestScheduleTimezoneChange(tx, clock, {
        patientId: id,
        timezone: 'Asia/Kolkata',
        actorUserId: id,
      }),
    );
    clock.set(new Date('2026-08-25T12:00:00.000Z'));
    const latest = await provisionNextPeriod(prisma, clock, id);
    expect(latest.id).toBe(initial.periods[0]!.id);
    expect(
      await prisma.scheduledPeriod.count({ where: { patientId: id } }),
    ).toBe(1);
    expect(
      (
        await prisma.monitoringScheduleVersion.findFirstOrThrow({
          where: { patientId: id, lifecycle: 'ACTIVE' },
        })
      ).monitoringTimezone,
    ).toBe('UTC');
    expect(
      (
        await prisma.monitoringScheduleVersion.findFirstOrThrow({
          where: { patientId: id, lifecycle: 'PENDING' },
        })
      ).id,
    ).toBe(pending!.id);
  });

  it('advances one consecutive period per delayed worker invocation', async () => {
    const id = await createSchedulePatient('UTC');
    clock.set(new Date('2026-08-19T12:00:00.000Z'));
    await createInitialSchedule(prisma, clock, {
      patientId: id,
      actorUserId: id,
      provenance: 'Delayed worker fixture',
    });
    clock.set(new Date('2026-09-25T12:00:00.000Z'));
    for (let index = 0; index < 4; index += 1)
      await provisionNextPeriod(prisma, clock, id);
    const periods = await prisma.scheduledPeriod.findMany({
      where: { patientId: id },
      orderBy: { periodStartAt: 'asc' },
    });
    expect(periods.map((period) => period.periodStartAt.toISOString())).toEqual(
      [
        '2026-08-24T00:00:00.000Z',
        '2026-08-31T00:00:00.000Z',
        '2026-09-07T00:00:00.000Z',
        '2026-09-14T00:00:00.000Z',
        '2026-09-21T00:00:00.000Z',
      ],
    );
    expect(
      periods.every(
        (period, index) =>
          index === 0 ||
          periods[index - 1]!.periodEndAt.getTime() <=
            period.periodStartAt.getTime(),
      ),
    ).toBe(true);
  });

  it('reuses an identical pending timezone request', async () => {
    const id = await createSchedulePatient('UTC');
    clock.set(new Date('2026-08-19T12:00:00.000Z'));
    await createInitialSchedule(prisma, clock, {
      patientId: id,
      actorUserId: id,
      provenance: 'Idempotent pending fixture',
    });
    const first = await prisma.$transaction((tx) =>
      requestScheduleTimezoneChange(tx, clock, {
        patientId: id,
        timezone: 'Asia/Kolkata',
        actorUserId: id,
      }),
    );
    const second = await prisma.$transaction((tx) =>
      requestScheduleTimezoneChange(tx, clock, {
        patientId: id,
        timezone: 'Asia/Kolkata',
        actorUserId: id,
      }),
    );
    expect(second?.id).toBe(first?.id);
    expect(
      await prisma.monitoringScheduleVersion.count({
        where: { patientId: id },
      }),
    ).toBe(2);
  });

  it('protects a timezone change when period materialization is delayed', async () => {
    const id = await createSchedulePatient('UTC');
    clock.set(new Date('2026-08-19T12:00:00.000Z'));
    await createInitialSchedule(prisma, clock, {
      patientId: id,
      actorUserId: id,
      provenance: 'Delayed timezone change fixture',
    });
    clock.set(new Date('2026-09-20T12:00:00.000Z'));
    const changed = await prisma.$transaction((tx) =>
      requestScheduleTimezoneChange(tx, clock, {
        patientId: id,
        timezone: 'Asia/Kolkata',
        actorUserId: id,
      }),
    );
    expect(changed!.effectiveBoundary.getTime()).toBeGreaterThanOrEqual(
      clock.now().getTime(),
    );
  });

  it('reconciles a passed pending boundary before a second timezone change', async () => {
    const id = await createSchedulePatient('UTC');
    clock.set(new Date('2026-08-19T12:00:00.000Z'));
    await createInitialSchedule(prisma, clock, {
      patientId: id,
      actorUserId: id,
      provenance: 'Unprovisioned transition fixture',
    });
    const first = await prisma.$transaction((tx) =>
      requestScheduleTimezoneChange(tx, clock, {
        patientId: id,
        timezone: 'Asia/Kolkata',
        actorUserId: id,
      }),
    );
    clock.set(first!.effectiveBoundary);
    const second = await prisma.$transaction((tx) =>
      requestScheduleTimezoneChange(tx, clock, {
        patientId: id,
        timezone: 'America/New_York',
        actorUserId: id,
      }),
    );
    expect(second!.effectiveBoundary.getTime()).toBeGreaterThanOrEqual(
      clock.now().getTime(),
    );
    const versions = await prisma.monitoringScheduleVersion.findMany({
      where: { patientId: id },
      orderBy: { effectiveBoundary: 'asc' },
    });
    expect(versions[0]!.effectiveBoundary.getTime()).toBeLessThanOrEqual(
      versions[1]!.effectiveBoundary.getTime(),
    );
    expect(
      versions.find((version) => version.id === first!.id)!.lifecycle,
    ).toBe('ACTIVE');
  });

  it('replaces repeated pending timezone intent and serializes timezone changes with provisioning', async () => {
    const id = await createSchedulePatient('Asia/Kolkata');
    clock.set(new Date('2026-08-19T12:00:00.000Z'));
    await createInitialSchedule(prisma, clock, {
      patientId: id,
      actorUserId: id,
      provenance: 'Repeated transition fixture',
    });
    const ny = await prisma.$transaction((tx) =>
      requestScheduleTimezoneChange(tx, clock, {
        patientId: id,
        timezone: 'America/New_York',
        actorUserId: id,
      }),
    );
    const utc = await prisma.$transaction((tx) =>
      requestScheduleTimezoneChange(tx, clock, {
        patientId: id,
        timezone: 'UTC',
        actorUserId: id,
      }),
    );
    expect(utc?.lifecycle).toBe('PENDING');
    expect(
      (
        await prisma.monitoringScheduleVersion.findUniqueOrThrow({
          where: { id: ny!.id },
        })
      ).lifecycle,
    ).toBe('SUPERSEDED');
    const [provisioned] = await Promise.all([
      provisionNextPeriod(prisma, clock, id),
      prisma.$transaction((tx) =>
        requestScheduleTimezoneChange(tx, clock, {
          patientId: id,
          timezone: 'America/New_York',
          actorUserId: id,
        }),
      ),
    ]);
    expect(provisioned.periodEndAt.getTime()).toBeGreaterThan(
      provisioned.periodStartAt.getTime(),
    );
  });

  it('reschedules only before cutoff with versioning and a formal audit', async () => {
    const period = await prisma.scheduledPeriod.findFirstOrThrow({
      where: { patientId },
      orderBy: { periodStartAt: 'desc' },
    });
    clock.set(new Date(period.openAt.getTime() - 60_000));
    const newDue = new Date(period.effectiveDueAt.getTime() + 3_600_000);
    const updated = await reschedulePeriod(prisma, clock, {
      periodId: period.id,
      expectedVersion: period.version,
      newEffectiveDueAt: newDue,
      actorUserId: actorId,
      reason: 'Documented scheduling exception',
    });
    expect(updated.version).toBe(period.version + 1);
    expect(updated.originalDueAt).toEqual(period.originalDueAt);
    expect(
      await prisma.periodRescheduleAudit.count({
        where: { periodId: period.id },
      }),
    ).toBe(1);
    const audit = await prisma.periodRescheduleAudit.findFirstOrThrow({
      where: { periodId: period.id },
    });
    await expect(
      prisma.periodRescheduleAudit.update({
        where: { id: audit.id },
        data: { reason: 'mutated' },
      }),
    ).rejects.toThrow();
    await expect(
      reschedulePeriod(prisma, clock, {
        periodId: period.id,
        expectedVersion: period.version,
        newEffectiveDueAt: newDue,
        actorUserId: actorId,
        reason: 'Stale retry',
      }),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});
