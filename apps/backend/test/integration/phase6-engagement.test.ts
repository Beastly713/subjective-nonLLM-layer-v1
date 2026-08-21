import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { createAuth } from '../../src/infrastructure/auth/auth.js';
import {
  loadRootEnvironment,
  parseConfig,
  parseTestDatabaseUrl,
} from '../../src/infrastructure/config/config.js';
import { createPrismaClient } from '../../src/infrastructure/db/prisma.js';
import { FakeAuthEmailSender } from '../../src/infrastructure/email/auth-email-sender.js';
import {
  readPatientHome,
  readPatientMonitoring,
  reconcileEngagementForPatient,
  transitionEngagementCase,
} from '../../src/modules/engagement/service.js';
import {
  confirmTechnicalFailure,
  correctTechnicalFailure as correctTechnicalFailureOperation,
  recordTechnicalFailure,
  resolveTechnicalFailure,
} from '../../src/modules/operations/service.js';
import { ensureRelevantPeriodsInTransaction } from '../../src/modules/scheduling/service.js';
import { FixedClock } from '../../src/shared/clock/clock.js';

loadRootEnvironment();

const databaseUrl = parseTestDatabaseUrl(process.env);
const marker = randomUUID().replaceAll('-', '').slice(0, 12).toLowerCase();
const baseEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: 'silent',
  APP_MODE: 'prototype',
  BETTER_AUTH_SECRET: 'phase6-integration-secret-at-least-32-characters',
  APP_BASE_URL: 'http://127.0.0.1:3000',
};
const config = parseConfig(baseEnvironment);
const prisma = createPrismaClient(databaseUrl);
const emailSender = new FakeAuthEmailSender();
const auth = createAuth(prisma, config, emailSender);
const fixtureAuth = createAuth(prisma, config, emailSender, {
  allowSignUpForFixtureCreation: true,
});
const clock = new FixedClock(new Date('2026-08-24T12:00:00.000Z'));
const app = buildApp({ config, prisma, auth, emailSender, clock });

const DAY_MS = 24 * 60 * 60 * 1_000;
const HOUR_MS = 60 * 60 * 1_000;
const password = 'Phase6Fixture!2026';

type PatientFixture = {
  id: string;
  periodId: string;
};

async function createIdentity(name: string) {
  const email = `phase6-${marker}-${randomUUID()}@example.test`;
  const response = await fixtureAuth.api.signUpEmail({
    body: { email, password, name },
  });
  if (!response.user?.id) throw new Error('Phase 6 identity fixture failed');
  await prisma.user.update({
    where: { id: response.user.id },
    data: { emailVerified: true },
  });
  return { id: response.user.id, email };
}

async function provisionPatient(id: string) {
  await prisma.applicationAccount.create({
    data: {
      userId: id,
      state: 'ACTIVE',
      createdByUserId: id,
    },
  });
  await prisma.userRoleAssignment.create({
    data: {
      userId: id,
      workspace: 'PATIENT',
      role: 'PATIENT',
      grantedByUserId: id,
      grantReason: 'Phase 6 integration fixture',
    },
  });
}

async function createPatientFixture(
  dueAt: Date,
  name = 'Phase 6 Patient',
): Promise<PatientFixture> {
  const patient = await createIdentity(name);
  await provisionPatient(patient.id);
  await prisma.patientProfile.create({
    data: {
      patientId: patient.id,
      monitoringTimezone: 'UTC',
      createdByUserId: patient.id,
      updatedByUserId: patient.id,
      preferences: {
        create: {
          version: 1,
          mutualHelpPreference: 'UNSURE',
          spiritualContentPreference: 'UNSURE',
          createdByUserId: patient.id,
        },
      },
      processingLock: { create: {} },
    },
  });

  const periodStartAt = new Date(dueAt.getTime() - 8 * DAY_MS);
  const openAt = new Date(dueAt.getTime() - DAY_MS);
  const schedule = await prisma.monitoringScheduleVersion.create({
    data: {
      patientId: patient.id,
      version: 1,
      monitoringTimezone: 'UTC',
      effectiveBoundary: periodStartAt,
      lifecycle: 'ACTIVE',
      createdAt: new Date(periodStartAt.getTime() - HOUR_MS),
      createdByUserId: patient.id,
      provenance: 'PHASE6_INTEGRATION_FIXTURE',
    },
  });
  const period = await prisma.scheduledPeriod.create({
    data: {
      patientId: patient.id,
      scheduleVersionId: schedule.id,
      monitoringTimezone: 'UTC',
      periodStartAt,
      periodEndAt: openAt,
      openAt,
      originalDueAt: dueAt,
      effectiveDueAt: dueAt,
      createdAt: new Date(periodStartAt.getTime() - HOUR_MS),
    },
  });
  return { id: patient.id, periodId: period.id };
}

async function createClinician(name = 'Phase 6 Clinician') {
  const clinician = await createIdentity(name);
  await prisma.applicationAccount.create({
    data: {
      userId: clinician.id,
      state: 'ACTIVE',
      createdByUserId: clinician.id,
      privilegedIdentityVerifiedAt: clock.now(),
      privilegedIdentityVerifiedByUserId: clinician.id,
      privilegedIdentityVerificationReference: 'PHASE6_FIXTURE',
    },
  });
  await prisma.userRoleAssignment.create({
    data: {
      userId: clinician.id,
      workspace: 'CLINICIAN',
      role: 'CLINICIAN',
      grantedByUserId: clinician.id,
      grantReason: 'Phase 6 integration fixture',
    },
  });
  return clinician;
}

async function assignPatient(clinicianId: string, patientId: string) {
  await prisma.clinicianPatientAssignment.create({
    data: {
      clinicianUserId: clinicianId,
      patientId,
      assignedByUserId: clinicianId,
      assignmentReason: 'Phase 6 integration fixture',
    },
  });
}

async function reconcile(patientId: string) {
  return prisma.$transaction((tx) =>
    reconcileEngagementForPatient({
      tx,
      clock,
      patientId,
      actorId: patientId,
      requestId: randomUUID(),
    }),
  );
}

async function readHome(patientId: string) {
  return prisma.$transaction((tx) =>
    readPatientHome(tx, clock, patientId, patientId, randomUUID()),
  );
}

async function readMonitoring(patientId: string) {
  return prisma.$transaction((tx) =>
    readPatientMonitoring(tx, clock, patientId, patientId, randomUUID()),
  );
}

async function createAuthoritativeAssessment(input: {
  patientId: string;
  periodId: string;
  classification: 'CURRENT' | 'LATE_CURRENT' | 'HISTORICAL_BACKFILL';
  completionStatus: 'PARTIAL' | 'COMPLETE';
}) {
  const submittedAt = clock.now();
  const assessment = await prisma.weeklyAssessment.create({
    data: {
      patientId: input.patientId,
      scheduledPeriodId: input.periodId,
      instrumentId: 'AUD_WEEKLY_CHECKIN',
      instrumentVersion: '1.0',
      draftVersion: 1,
      draftCurrentStep: 'REVIEW',
      draftAnswerSnapshot: {},
      completionStatus: input.completionStatus,
      createdAt: submittedAt,
      createdByUserId: input.patientId,
      updatedAt: submittedAt,
      updatedByUserId: input.patientId,
    },
  });
  const revision = await prisma.assessmentRevision.create({
    data: {
      assessmentId: assessment.id,
      revisionNumber: 1,
      completionStatus: input.completionStatus,
      sourceDraftVersion: 1,
      submittedAt,
      submittedBy: 'PATIENT',
      submittedByUserId: input.patientId,
      submissionClassification: input.classification,
      instrumentVersion: '1.0',
      wordingVersion: '1.0',
      ruleSetVersion: 'phase6-test',
      configurationVersion: 'phase6-test',
    },
  });
  await prisma.weeklyAssessment.update({
    where: { id: assessment.id },
    data: { authoritativeRevisionId: revision.id },
  });
  return { assessment, revision };
}

async function createSafetyPause(patientId: string) {
  const input = await prisma.safetyInputRevision.create({
    data: {
      patientId,
      revision: 1,
      inputSnapshot: {},
      instrument: 'AUD_SAFETY',
      instrumentVersion: '1.0',
      instrumentSource: 'PHASE6_FIXTURE',
      schemaVersion: '1.0',
      trigger: 'PHASE6_FIXTURE',
      actorId: patientId,
      submittedAt: clock.now(),
    },
  });
  const evaluation = await prisma.safetyEvaluationResult.create({
    data: {
      patientId,
      safetyInputRevisionId: input.id,
      severity: 'S1_URGENT',
      gateStatus: 'BLOCK_AND_HANDOFF',
      reasonCodes: [],
      clinicianContext: true,
      allowedSubjectiveInterventions: [],
      monitoringPromptPolicy: 'PAUSE',
      goalChangeAllowed: false,
      evaluatorVersion: 'phase6-test',
      configurationVersion: 'phase6-test',
      evaluatedAt: clock.now(),
      resultSnapshot: {},
    },
  });
  return prisma.safetyCase.create({
    data: {
      patientId,
      domain: 'OTHER_SUBSTANCE',
      sourceSafetyEvaluationResultId: evaluation.id,
      severity: 'S1_URGENT',
      gateStatus: 'BLOCK_AND_HANDOFF',
      ownerRole: 'AUD_MEDICAL_OWNER',
      lifecycle: 'DETECTED',
      detectedAt: clock.now(),
      routeStatus: 'UNAVAILABLE',
    },
  });
}

async function createConfirmedFailure(input: {
  patientId: string;
  periodId: string;
  previousEffectiveDueAt: Date;
  startedAt?: Date;
  confirmedAt?: Date;
}) {
  return prisma.technicalFailure.create({
    data: {
      patientId: input.patientId,
      failureType: 'ASSESSMENT_ACCESS_UNAVAILABLE',
      affectedScope: { kind: 'PATIENT', patientId: input.patientId },
      startedAt:
        input.startedAt ?? new Date(clock.now().getTime() - 3 * HOUR_MS),
      evidence: { summary: 'Phase 6 fixture evidence' },
      status: 'CONFIRMED',
      confirmedBy: input.patientId,
      confirmedAt:
        input.confirmedAt ?? new Date(clock.now().getTime() - 2 * HOUR_MS),
      sourcePeriodId: input.periodId,
      previousEffectiveDueAt: input.previousEffectiveDueAt,
    },
  });
}

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe.sequential('Phase 6 engagement integration', () => {
  it('materializes one current Patient Home reminder and records presentation exactly once', async () => {
    const now = clock.now();
    const patient = await createPatientFixture(
      new Date(now.getTime() - 14 * DAY_MS),
      'Reminder Presentation Patient',
    );

    const firstHome = await readHome(patient.id);
    const firstReminder = firstHome.engagement.reminders.find(
      (reminder) => reminder.reminderNumber === 1,
    );
    const finalReminder = firstHome.engagement.reminders.find(
      (reminder) => reminder.reminderNumber === 2,
    );
    expect(firstHome.engagement.state).toBe('AT_RISK_OF_DISENGAGEMENT');
    expect(firstReminder?.presentationStatus).toBe('ELIGIBLE');
    expect(finalReminder?.presentationStatus).toBe('PRESENTED');
    expect(finalReminder?.presentedAt).toBe(now.toISOString());

    const presentedAuditCount = await prisma.auditEvent.count({
      where: {
        patientId: patient.id,
        action: 'ENGAGEMENT_REMINDER_PRESENTED',
      },
    });
    expect(presentedAuditCount).toBe(1);

    const monitoring = await readMonitoring(patient.id);
    expect(
      monitoring.reminders.find((reminder) => reminder.reminderNumber === 2)
        ?.presentedAt,
    ).toBe(now.toISOString());
    expect(
      await prisma.auditEvent.count({
        where: {
          patientId: patient.id,
          action: 'ENGAGEMENT_REMINDER_PRESENTED',
        },
      }),
    ).toBe(1);

    const secondHome = await readHome(patient.id);
    expect(
      secondHome.engagement.reminders.filter(
        (reminder) => reminder.presentationStatus === 'PRESENTED',
      ),
    ).toHaveLength(1);
  });

  it('suppresses reminder materialization and presentation during an active safety pause', async () => {
    const now = clock.now();
    const patient = await createPatientFixture(
      new Date(now.getTime() - 14 * DAY_MS),
      'Safety Pause Patient',
    );
    const safetyCase = await createSafetyPause(patient.id);

    const home = await readHome(patient.id);
    expect(home.presentationMode).toBe('SAFETY_CONTROLLED');
    expect(home.engagement.timingPaused).toBe(true);
    expect(home.engagement.pauseReason).toBe('SAFETY');
    expect(home.engagement.reminders).toEqual([]);
    expect(
      await prisma.missedCheckinReminder.count({
        where: { patientId: patient.id },
      }),
    ).toBe(0);
    expect(
      await prisma.engagementCase.count({
        where: { patientId: patient.id },
      }),
    ).toBe(0);
    expect(
      await prisma.safetyCase.findUniqueOrThrow({
        where: { id: safetyCase.id },
      }),
    ).toMatchObject({ lifecycle: 'DETECTED', version: 1 });
  });

  it('keeps historical backfill from resolving a current gap, while a late partial return resolves it', async () => {
    const now = clock.now();
    const historicalPatient = await createPatientFixture(
      new Date(now.getTime() - 31 * DAY_MS),
      'Historical Backfill Patient',
    );
    await prisma.$transaction((tx) =>
      ensureRelevantPeriodsInTransaction(tx, clock, historicalPatient.id),
    );
    const periods = await prisma.scheduledPeriod.findMany({
      where: { patientId: historicalPatient.id },
      orderBy: { periodStartAt: 'asc' },
    });
    const firstPeriod = periods[0];
    const secondPeriod = periods[1];
    if (!firstPeriod || !secondPeriod) throw new Error('Expected two periods');
    await createAuthoritativeAssessment({
      patientId: historicalPatient.id,
      periodId: firstPeriod.id,
      classification: 'HISTORICAL_BACKFILL',
      completionStatus: 'COMPLETE',
    });
    const historicalState = await reconcile(historicalPatient.id);
    expect(historicalState.state).toBeDefined();
    expect(historicalState.state.missedCyclePeriodId).toBe(secondPeriod.id);
    expect(historicalState.state.state).not.toBe('ENGAGED');

    const returningPatient = await createPatientFixture(
      new Date(now.getTime() - 31 * DAY_MS),
      'Late Return Patient',
    );
    await reconcile(returningPatient.id);
    const returningPeriods = await prisma.scheduledPeriod.findMany({
      where: { patientId: returningPatient.id },
      orderBy: { periodStartAt: 'asc' },
    });
    const returningPeriod = returningPeriods[1];
    if (!returningPeriod) throw new Error('Expected a return period');
    await createAuthoritativeAssessment({
      patientId: returningPatient.id,
      periodId: returningPeriod.id,
      classification: 'LATE_CURRENT',
      completionStatus: 'PARTIAL',
    });
    const returnedState = await reconcile(returningPatient.id);
    expect(returnedState.state.state).toBe('ENGAGED');
    expect(returnedState.state.missedCyclePeriodId).toBeNull();
    expect(
      await prisma.engagementCase.findFirst({
        where: { patientId: returningPatient.id },
      }),
    ).toMatchObject({
      lifecycle: 'RESOLVED_RETURNED',
      resolvedAt: expect.any(Date),
    });
  });

  it('pauses on confirmed technical failure, applies the exact due formula, and preserves provenance', async () => {
    const now = clock.now();
    const patient = await createPatientFixture(
      new Date(now.getTime() - 3 * DAY_MS),
      'Technical Failure Patient',
    );
    const period = await prisma.scheduledPeriod.findUniqueOrThrow({
      where: { id: patient.periodId },
    });
    const startedAt = new Date(now.getTime() - 3 * HOUR_MS);
    const suspected = await prisma.technicalFailure.create({
      data: {
        patientId: patient.id,
        failureType: 'ASSESSMENT_ACCESS_UNAVAILABLE',
        affectedScope: { kind: 'PATIENT', patientId: patient.id },
        startedAt,
        evidence: { summary: 'Confirmed fixture outage' },
        status: 'SUSPECTED',
        sourcePeriodId: period.id,
      },
    });
    const confirmed = await prisma.$transaction((tx) =>
      confirmTechnicalFailure({
        tx,
        clock,
        failureId: suspected.id,
        expectedVersion: 1,
        reason: 'Verified assessment access failure',
        actorId: patient.id,
        requestId: randomUUID(),
      }),
    );
    expect(confirmed.status).toBe('CONFIRMED');
    expect((await reconcile(patient.id)).state.state).toBe('TECHNICAL_FAILURE');
    expect(
      await prisma.missedCheckinReminder.count({
        where: { patientId: patient.id, cancelledAt: null },
      }),
    ).toBe(0);

    const resolvedAt = now;
    const pauseDurationMs = resolvedAt.getTime() - startedAt.getTime();
    const expectedEffectiveDue = new Date(
      Math.max(
        period.originalDueAt.getTime() + pauseDurationMs,
        resolvedAt.getTime() + 24 * HOUR_MS,
      ),
    );
    const resolved = await prisma.$transaction((tx) =>
      resolveTechnicalFailure({
        tx,
        clock,
        failureId: suspected.id,
        expectedVersion: 2,
        reason: 'Access restored and timing recalculated',
        actorId: patient.id,
        requestId: randomUUID(),
      }),
    );
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.previousEffectiveDueAt).toBe(
      period.originalDueAt.toISOString(),
    );
    expect(resolved.recalculatedEffectiveDueAt).toBe(
      expectedEffectiveDue.toISOString(),
    );
    const updatedPeriod = await prisma.scheduledPeriod.findUniqueOrThrow({
      where: { id: period.id },
    });
    expect(updatedPeriod.originalDueAt).toEqual(period.originalDueAt);
    expect(updatedPeriod.effectiveDueAt).toEqual(expectedEffectiveDue);
    expect(
      await prisma.periodRescheduleAudit.findFirst({
        where: { periodId: period.id },
        orderBy: { occurredAt: 'desc' },
      }),
    ).toMatchObject({
      previousEffectiveDue: period.effectiveDueAt,
      newEffectiveDue: expectedEffectiveDue,
    });
  });

  it('enforces engagement case lifecycle order, assignment scope, and separate clinical task identity', async () => {
    const clinician = await createClinician();
    const now = clock.now();
    const patient = await createPatientFixture(
      new Date(now.getTime() - 31 * DAY_MS),
      'Engagement Case Patient',
    );
    await assignPatient(clinician.id, patient.id);
    await reconcile(patient.id);
    const engagementCase = await prisma.engagementCase.findFirstOrThrow({
      where: { patientId: patient.id },
    });
    const engagementTask = await prisma.clinicianTask.findUniqueOrThrow({
      where: {
        caseType_caseId_taskIdentity: {
          caseType: 'ENGAGEMENT',
          caseId: engagementCase.id,
          taskIdentity: 'DISENGAGEMENT_REVIEW',
        },
      },
    });

    await expect(
      prisma.$transaction((tx) =>
        transitionEngagementCase({
          tx,
          clock,
          clinicianId: clinician.id,
          caseId: engagementCase.id,
          expectedCaseVersion: 1,
          target: 'OUTREACH_IN_PROGRESS',
          requestId: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_CASE_TRANSITION',
    });

    await prisma.$transaction((tx) =>
      transitionEngagementCase({
        tx,
        clock,
        clinicianId: clinician.id,
        caseId: engagementCase.id,
        expectedCaseVersion: 1,
        target: 'ACKNOWLEDGED',
        requestId: randomUUID(),
      }),
    );
    await prisma.$transaction((tx) =>
      transitionEngagementCase({
        tx,
        clock,
        clinicianId: clinician.id,
        caseId: engagementCase.id,
        expectedCaseVersion: 2,
        target: 'OUTREACH_IN_PROGRESS',
        requestId: randomUUID(),
      }),
    );

    const clinicalCase = await prisma.clinicalReviewCase.create({
      data: {
        patientId: patient.id,
        tier: 'LEVEL_3',
        lifecycle: 'NEW',
        activeReasonFamilies: ['CRAVING_LOW_CONFIDENCE'],
        clearancePendingReasonFamilies: [],
        highestHistoricalTier: 'LEVEL_3',
      },
    });
    const clinicalTask = await prisma.clinicianTask.create({
      data: {
        patientId: patient.id,
        caseId: clinicalCase.id,
        caseType: 'CLINICAL',
        recipientType: 'PRIMARY_CLINICIAN',
        recipientId: clinician.id,
        deliveryStatus: 'DELIVERED',
        createdReason: 'CRAVING_LOW_CONFIDENCE',
        taskIdentity: 'CLINICAL_REVIEW',
        title: 'Clinical review required',
        createdAt: now,
      },
    });
    expect(engagementTask.caseType).toBe('ENGAGEMENT');
    expect(engagementTask.createdReason).toBeNull();
    expect(clinicalTask.caseType).toBe('CLINICAL');
    expect(clinicalTask.createdReason).toBe('CRAVING_LOW_CONFIDENCE');
    expect(
      await prisma.engagementCase.findFirstOrThrow({
        where: { id: engagementCase.id },
      }),
    ).toMatchObject({ lifecycle: 'OUTREACH_IN_PROGRESS', caseVersion: 3 });

    const unassignedPatient = await createPatientFixture(
      new Date(now.getTime() - 31 * DAY_MS),
      'Unassigned Engagement Patient',
    );
    await reconcile(unassignedPatient.id);
    const unassignedCase = await prisma.engagementCase.findFirstOrThrow({
      where: { patientId: unassignedPatient.id },
    });
    await expect(
      prisma.$transaction((tx) =>
        transitionEngagementCase({
          tx,
          clock,
          clinicianId: clinician.id,
          caseId: unassignedCase.id,
          expectedCaseVersion: 1,
          target: 'ACKNOWLEDGED',
          requestId: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('rejects cross-surface authorization and future technical-failure starts', async () => {
    const clinician = await createClinician('Authorization Clinician');
    const patient = await createPatientFixture(
      new Date(clock.now().getTime() - 14 * DAY_MS),
      'Authorization Patient',
    );
    await assignPatient(clinician.id, patient.id);
    const patientUser = await prisma.user.findUniqueOrThrow({
      where: { id: patient.id },
    });
    const patientCookieResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.appBaseUrl },
      payload: {
        email: patientUser.email,
        password,
      },
    });
    expect(patientCookieResponse.statusCode).toBe(200);
    const patientCookie = patientCookieResponse.cookies.find(({ name }) =>
      name.includes('session_token'),
    );
    expect(patientCookie).toBeDefined();

    const patientHome = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/home',
      headers: { cookie: `${patientCookie!.name}=${patientCookie!.value}` },
    });
    expect(patientHome.statusCode).toBe(200);

    const clinicianCookieResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.appBaseUrl },
      payload: { email: clinician.email, password },
    });
    expect(clinicianCookieResponse.statusCode).toBe(200);
    const clinicianCookie = clinicianCookieResponse.cookies.find(({ name }) =>
      name.includes('session_token'),
    );
    expect(clinicianCookie).toBeDefined();
    const clinicianCannotReadPatientHome = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/home',
      headers: {
        cookie: `${clinicianCookie!.name}=${clinicianCookie!.value}`,
      },
    });
    expect(clinicianCannotReadPatientHome.statusCode).toBe(403);
    expect(clinicianCannotReadPatientHome.json().error.code).toBe(
      'PERMISSION_DENIED',
    );
    const patientCannotReadOperations = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/operations/technical-failures',
      headers: { cookie: `${patientCookie!.name}=${patientCookie!.value}` },
    });
    expect(patientCannotReadOperations.statusCode).toBe(403);
    expect(patientCannotReadOperations.json().error.code).toBe(
      'PERMISSION_DENIED',
    );

    await expect(
      prisma.$transaction((tx) =>
        recordTechnicalFailure({
          tx,
          clock,
          actorId: patient.id,
          requestId: randomUUID(),
          body: {
            patientId: patient.id,
            periodId: patient.periodId,
            failureType: 'ASSESSMENT_ACCESS_UNAVAILABLE',
            startedAt: new Date(clock.now().getTime() + HOUR_MS).toISOString(),
            evidence: 'Future start must be rejected',
          },
        }),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_TECHNICAL_FAILURE_START',
    });
  });

  it('resolves only a technically invalidated engagement case during false-positive correction', async () => {
    const now = clock.now();
    const scenarios = [
      {
        name: 'Invalidated case',
        restoredDays: 10,
        shiftedDays: 5,
        caseOpenedAfterConfirmation: true,
        shouldResolve: true,
      },
      {
        name: 'Pre-failure legitimate case',
        restoredDays: 10,
        shiftedDays: 5,
        caseOpenedAfterConfirmation: false,
        shouldResolve: false,
      },
      {
        name: 'Still-valid case after correction',
        restoredDays: 31,
        shiftedDays: 5,
        caseOpenedAfterConfirmation: true,
        shouldResolve: false,
      },
    ] as const;

    for (const scenario of scenarios) {
      const restoredDueAt = new Date(
        now.getTime() - scenario.restoredDays * DAY_MS,
      );
      const shiftedDueAt = new Date(
        now.getTime() - scenario.shiftedDays * DAY_MS,
      );
      const patient = await createPatientFixture(restoredDueAt, scenario.name);
      await prisma.scheduledPeriod.update({
        where: { id: patient.periodId },
        data: {
          effectiveDueAt: shiftedDueAt,
          version: 2,
        },
      });
      const confirmedAt = new Date(now.getTime() - 3 * DAY_MS);
      const failure = await createConfirmedFailure({
        patientId: patient.id,
        periodId: patient.periodId,
        previousEffectiveDueAt: restoredDueAt,
        startedAt: new Date(now.getTime() - 4 * DAY_MS),
        confirmedAt,
      });
      const caseOpenedAt = scenario.caseOpenedAfterConfirmation
        ? new Date(now.getTime() - 2 * DAY_MS)
        : new Date(now.getTime() - 4 * DAY_MS);
      const engagementCase = await prisma.engagementCase.create({
        data: {
          patientId: patient.id,
          lifecycle: 'OUTREACH_IN_PROGRESS',
          sourceMissedPeriodId: patient.periodId,
          sourceEffectiveDueAt: shiftedDueAt,
          openedAt: caseOpenedAt,
          outreachStartedAt: caseOpenedAt,
          updatedAt: caseOpenedAt,
        },
      });
      const corrected = await prisma.$transaction((tx) =>
        correctTechnicalFailureOperation({
          tx,
          clock,
          failureId: failure.id,
          expectedVersion: 1,
          reason: 'False-positive provenance test',
          actorId: patient.id,
          requestId: randomUUID(),
        }),
      );
      expect(corrected.status).toBe('CORRECTED_FALSE_POSITIVE');
      const currentCase = await prisma.engagementCase.findUniqueOrThrow({
        where: { id: engagementCase.id },
      });
      expect(currentCase.lifecycle).toBe(
        scenario.shouldResolve
          ? 'RESOLVED_TECHNICAL_CORRECTION'
          : 'OUTREACH_IN_PROGRESS',
      );
      if (scenario.shouldResolve) {
        expect(currentCase.sourceTechnicalFailureId).toBe(failure.id);
      } else {
        expect(currentCase.sourceTechnicalFailureId).toBeNull();
      }
      if (scenario.name === 'Invalidated case') {
        const correctedHome = await readHome(patient.id);
        expect(
          correctedHome.engagement.reminders.some(
            (reminder) => reminder.presentationStatus === 'PRESENTED',
          ),
        ).toBe(false);
      }
    }
  });

  it('does not mutate the safety, clinical, or engagement boundary when a technical case is corrected', async () => {
    const now = clock.now();
    const patient = await createPatientFixture(
      new Date(now.getTime() - 10 * DAY_MS),
      'Technical Boundary Patient',
    );
    const safetyCase = await createSafetyPause(patient.id);
    const clinicalCase = await prisma.clinicalReviewCase.create({
      data: {
        patientId: patient.id,
        tier: 'LEVEL_3',
        lifecycle: 'NEW',
        activeReasonFamilies: ['CRAVING_LOW_CONFIDENCE'],
        clearancePendingReasonFamilies: [],
        highestHistoricalTier: 'LEVEL_3',
      },
    });
    const period = await prisma.scheduledPeriod.findUniqueOrThrow({
      where: { id: patient.periodId },
    });
    const failure = await createConfirmedFailure({
      patientId: patient.id,
      periodId: period.id,
      previousEffectiveDueAt: period.effectiveDueAt,
    });
    const beforeSafety = await prisma.safetyCase.findUniqueOrThrow({
      where: { id: safetyCase.id },
    });
    const beforeClinical = await prisma.clinicalReviewCase.findUniqueOrThrow({
      where: { id: clinicalCase.id },
    });
    await prisma.$transaction((tx) =>
      correctTechnicalFailureOperation({
        tx,
        clock,
        failureId: failure.id,
        expectedVersion: 1,
        reason: 'No due shift; boundary preservation test',
        actorId: patient.id,
        requestId: randomUUID(),
      }),
    );
    expect(
      await prisma.safetyCase.findUniqueOrThrow({
        where: { id: safetyCase.id },
      }),
    ).toMatchObject({
      lifecycle: beforeSafety.lifecycle,
      version: beforeSafety.version,
    });
    expect(
      await prisma.clinicalReviewCase.findUniqueOrThrow({
        where: { id: clinicalCase.id },
      }),
    ).toMatchObject({
      lifecycle: beforeClinical.lifecycle,
      caseVersion: beforeClinical.caseVersion,
    });
  });
});
