import { randomUUID } from 'node:crypto';

import {
  CheckInHistoryResponseSchema,
  CheckInStateResponseSchema,
  ClinicianPatientMonitoringResponseSchema,
  ClinicianReviewQueueResponseSchema,
  PatientSupportResponseSchema,
} from '@aud-subjective/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { seedPrototype } from '../../prisma/seed.js';
import { createAuth } from '../../src/infrastructure/auth/auth.js';
import {
  loadRootEnvironment,
  parseConfig,
  parseTestDatabaseUrl,
} from '../../src/infrastructure/config/config.js';
import { createPrismaClient } from '../../src/infrastructure/db/prisma.js';
import { FakeAuthEmailSender } from '../../src/infrastructure/email/auth-email-sender.js';
import { FixedClock } from '../../src/shared/clock/clock.js';

loadRootEnvironment();

const databaseUrl = parseTestDatabaseUrl(process.env);
const marker = randomUUID().replaceAll('-', '').slice(0, 10).toLowerCase();

const config = parseConfig({
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: 'silent',
  APP_MODE: 'prototype',
  BETTER_AUTH_SECRET: 'phase4-integration-secret-at-least-32-characters',
  APP_BASE_URL: 'http://127.0.0.1:3000',
  SAFETY_ROUTING_COUNTRY_CODE: 'XZ',
  SAFETY_ROUTING_REGION_CODE: `P4_${marker.toUpperCase()}`,
});

const prisma = createPrismaClient(databaseUrl);
const emailSender = new FakeAuthEmailSender();
const auth = createAuth(prisma, config, emailSender);
const fixtureAuth = createAuth(prisma, config, emailSender, {
  allowSignUpForFixtureCreation: true,
});
const clock = new FixedClock(new Date('2026-08-24T12:00:00.000Z'));
const app = buildApp({ config, prisma, auth, emailSender, clock });

const password = 'Phase4Fixture!2026';
const patientEmail = `phase4-patient-${marker}@example.test`;
const clinicianEmail = `phase4-clinician-${marker}@example.test`;
const adminEmail = `phase5-admin-${marker}@example.test`;

let patientId = '';
let clinicianId = '';
let adminId = '';
let patientCookie = '';
let clinicianCookie = '';
let adminCookie = '';

const period1 = {
  start: new Date('2026-08-10T00:00:00.000Z'),
  end: new Date('2026-08-17T00:00:00.000Z'),
  due: new Date('2026-08-18T00:00:00.000Z'),
};
const period2 = {
  start: new Date('2026-08-17T00:00:00.000Z'),
  end: new Date('2026-08-24T00:00:00.000Z'),
  due: new Date('2026-08-25T00:00:00.000Z'),
};

let period1Id = '';
let period2Id = '';

const completeAnswers = {
  U1: false,
  R1: 1,
  R2: 1,
  R3: 1,
  R4: 1,
  R5: 1,
  P1: 6,
  P2: 6,
  P3: 6,
  P4: 6,
  P5: 6,
} as const;

async function createIdentity(email: string, name: string) {
  const created = await fixtureAuth.api.signUpEmail({
    body: { email, password, name },
  });
  await prisma.user.update({
    where: { id: created.user.id },
    data: { emailVerified: true },
  });
  return created.user.id;
}

async function signIn(email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: config.appBaseUrl },
    payload: { email, password },
  });
  expect(response.statusCode).toBe(200);
  const cookie = response.cookies.find(({ name }) =>
    name.includes('session_token'),
  );
  expect(cookie).toBeDefined();
  return `${cookie!.name}=${cookie!.value}`;
}

async function startCurrent() {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/patient/check-in/start',
    headers: { cookie: patientCookie },
    payload: {},
  });
  expect(response.statusCode).toBe(200);
  return CheckInStateResponseSchema.parse(response.json());
}

async function saveDraft(
  assessmentId: string,
  expectedDraftVersion: number,
  answers: Record<string, unknown>,
) {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/patient/assessments/${assessmentId}/draft`,
    headers: { cookie: patientCookie },
    payload: {
      expectedDraftVersion,
      currentStep: 'REVIEW',
      answers,
      weeklyConsumptionDays: [],
    },
  });
  return response;
}

async function submit(
  assessmentId: string,
  expectedDraftVersion: number,
  completionIntent: 'PARTIAL' | 'COMPLETE',
  idempotencyKey = randomUUID(),
  historical = false,
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/patient/assessments/${assessmentId}${
      historical ? '/backfill-submit' : '/submit'
    }`,
    headers: {
      cookie: patientCookie,
      'idempotency-key': idempotencyKey,
    },
    payload: {
      expectedDraftVersion,
      completionIntent,
    },
  });
}

beforeAll(async () => {
  patientId = await createIdentity(patientEmail, 'Phase 4 Patient');
  clinicianId = await createIdentity(clinicianEmail, 'Phase 4 Clinician');
  adminId = await createIdentity(adminEmail, 'Phase 5 Admin');

  await prisma.applicationAccount.createMany({
    data: [
      {
        userId: patientId,
        state: 'ACTIVE',
        createdByUserId: clinicianId,
      },
      {
        userId: clinicianId,
        state: 'ACTIVE',
        createdByUserId: clinicianId,
        privilegedIdentityVerifiedAt: new Date('2026-08-20T00:00:00.000Z'),
      },
      {
        userId: adminId,
        state: 'ACTIVE',
        createdByUserId: clinicianId,
      },
    ],
  });

  await prisma.userRoleAssignment.createMany({
    data: [
      {
        userId: patientId,
        workspace: 'PATIENT',
        role: 'PATIENT',
        grantedByUserId: clinicianId,
        grantReason: 'Phase 4 integration fixture',
      },
      {
        userId: clinicianId,
        workspace: 'CLINICIAN',
        role: 'CLINICIAN',
        grantedByUserId: clinicianId,
        grantReason: 'Phase 4 integration fixture',
      },
      {
        userId: adminId,
        workspace: 'ADMIN',
        role: 'ADMIN',
        grantedByUserId: clinicianId,
        grantReason: 'Phase 5 authorization fixture',
      },
    ],
  });

  await prisma.patientProfile.create({
    data: {
      patientId,
      monitoringTimezone: 'UTC',
      createdByUserId: clinicianId,
      updatedByUserId: clinicianId,
      preferences: {
        create: {
          version: 1,
          mutualHelpPreference: 'UNSURE',
          spiritualContentPreference: 'UNSURE',
          createdByUserId: patientId,
        },
      },
      processingLock: { create: {} },
    },
  });

  const schedule = await prisma.monitoringScheduleVersion.create({
    data: {
      patientId,
      version: 1,
      monitoringTimezone: 'UTC',
      effectiveBoundary: period1.start,
      lifecycle: 'ACTIVE',
      createdAt: new Date('2026-08-09T12:00:00.000Z'),
      createdByUserId: patientId,
      provenance: 'PHASE4_INTEGRATION_FIXTURE',
    },
  });

  const createdPeriods = await prisma.$transaction([
    prisma.scheduledPeriod.create({
      data: {
        patientId,
        scheduleVersionId: schedule.id,
        monitoringTimezone: 'UTC',
        periodStartAt: period1.start,
        periodEndAt: period1.end,
        openAt: period1.end,
        originalDueAt: period1.due,
        effectiveDueAt: period1.due,
        createdAt: new Date('2026-08-09T12:00:00.000Z'),
      },
    }),
    prisma.scheduledPeriod.create({
      data: {
        patientId,
        scheduleVersionId: schedule.id,
        monitoringTimezone: 'UTC',
        periodStartAt: period2.start,
        periodEndAt: period2.end,
        openAt: period2.end,
        originalDueAt: period2.due,
        effectiveDueAt: period2.due,
        createdAt: new Date('2026-08-16T12:00:00.000Z'),
      },
    }),
  ]);
  period1Id = createdPeriods[0].id;
  period2Id = createdPeriods[1].id;

  await prisma.clinicianPatientAssignment.create({
    data: {
      clinicianUserId: clinicianId,
      patientId,
      assignedByUserId: clinicianId,
      assignmentReason: 'Phase 4 integration fixture',
    },
  });

  await app.ready();
  await seedPrototype({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    APP_MODE: 'prototype',
    LOG_LEVEL: 'silent',
    BETTER_AUTH_SECRET: config.betterAuthSecret,
    APP_BASE_URL: config.appBaseUrl,
  });
  patientCookie = await signIn(patientEmail);
  clinicianCookie = await signIn(clinicianEmail);
  adminCookie = await signIn(adminEmail);
}, 30_000);

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe.sequential('Phase 4 weekly monitoring integration', () => {
  let currentAssessmentId = '';
  let currentRevisionId = '';

  it('creates one server-backed current draft and resumes it without duplication', async () => {
    const first = await startCurrent();
    const second = await startCurrent();

    expect(first.period?.periodId).toBe(period2Id);
    expect(first.assessment?.completionStatus).toBe('DRAFT');
    expect(second.assessment?.completionStatus).toBe('DRAFT');

    if (
      !first.assessment ||
      first.assessment.completionStatus !== 'DRAFT' ||
      !second.assessment ||
      second.assessment.completionStatus !== 'DRAFT'
    ) {
      throw new Error('Expected resumable weekly draft');
    }

    currentAssessmentId = first.assessment.assessmentId;
    expect(second.assessment.assessmentId).toBe(currentAssessmentId);

    expect(
      await prisma.weeklyAssessment.count({
        where: {
          patientId,
          scheduledPeriodId: period2Id,
          instrumentId: 'AUD_WEEKLY_CHECKIN',
          instrumentVersion: '1.0',
        },
      }),
    ).toBe(1);
  });

  it('enforces optimistic draft versioning', async () => {
    const state = await startCurrent();
    if (!state.assessment || state.assessment.completionStatus !== 'DRAFT') {
      throw new Error('Expected current draft');
    }

    const saved = await saveDraft(
      state.assessment.assessmentId,
      state.assessment.draftVersion,
      completeAnswers,
    );
    expect(saved.statusCode).toBe(200);

    const stale = await saveDraft(
      state.assessment.assessmentId,
      state.assessment.draftVersion,
      completeAnswers,
    );
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('VERSION_CONFLICT');
  });

  it('submits atomically and replays the identical idempotent request without duplicates', async () => {
    const state = await startCurrent();
    if (!state.assessment || state.assessment.completionStatus !== 'DRAFT') {
      throw new Error('Expected current draft');
    }

    const key = randomUUID();
    const request = {
      assessmentId: state.assessment.assessmentId,
      expectedDraftVersion: state.assessment.draftVersion,
    };

    const first = await submit(
      request.assessmentId,
      request.expectedDraftVersion,
      'COMPLETE',
      key,
    );
    expect(first.statusCode).toBe(200);

    const replay = await submit(
      request.assessmentId,
      request.expectedDraftVersion,
      'COMPLETE',
      key,
    );
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const projection = CheckInStateResponseSchema.parse(first.json());
    if (
      !projection.assessment ||
      projection.assessment.completionStatus === 'DRAFT'
    ) {
      throw new Error('Expected submitted projection');
    }
    currentRevisionId = projection.assessment.revisionId;

    expect(
      await prisma.assessmentRevision.count({
        where: { assessmentId: request.assessmentId },
      }),
    ).toBe(1);
    expect(
      await prisma.assessmentEvaluation.count({
        where: { assessmentId: request.assessmentId },
      }),
    ).toBe(1);
    expect(
      await prisma.useObservationLedger.count({
        where: { assessmentId: request.assessmentId },
      }),
    ).toBe(1);
  });

  it('rejects reuse of an idempotency key with a changed canonical payload', async () => {
    const assessment = await prisma.weeklyAssessment.findUniqueOrThrow({
      where: { id: currentAssessmentId },
    });

    const key = randomUUID();

    // Create the record through a harmless backfill-start idempotent action instead
    // of attempting a second submission on an already submitted assessment.
    const history = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/check-in/history',
      headers: { cookie: patientCookie },
    });
    expect(history.statusCode).toBe(200);

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/patient/check-in/backfill/${period1Id}/start`,
      headers: {
        cookie: patientCookie,
        'idempotency-key': key,
      },
      payload: {},
    });
    expect(first.statusCode).toBe(200);

    const changed = await app.inject({
      method: 'POST',
      url: `/api/v1/patient/check-in/backfill/${period2Id}/start`,
      headers: {
        cookie: patientCookie,
        'idempotency-key': key,
      },
      payload: {},
    });
    expect(changed.statusCode).toBe(409);
    expect(changed.json().error.code).toMatch(/IDEMPOTENCY/i);

    expect(assessment.authoritativeRevisionId).toBe(currentRevisionId);
  });

  it('creates an immutable historical backfill and forward-recomputes the newer authoritative period', async () => {
    const before = await prisma.assessmentEvaluation.findFirstOrThrow({
      where: {
        assessmentRevisionId: currentRevisionId,
        lifecycle: 'ACTIVE',
      },
    });

    const start = await app.inject({
      method: 'POST',
      url: `/api/v1/patient/check-in/backfill/${period1Id}/start`,
      headers: {
        cookie: patientCookie,
        'idempotency-key': randomUUID(),
      },
      payload: {},
    });
    expect(start.statusCode).toBe(200);
    const backfill = CheckInStateResponseSchema.parse(start.json());

    expect(backfill.availability).toBe('HISTORICAL');
    if (
      !backfill.assessment ||
      backfill.assessment.completionStatus !== 'DRAFT'
    ) {
      throw new Error('Expected historical draft');
    }

    const savedResponse = await saveDraft(
      backfill.assessment.assessmentId,
      backfill.assessment.draftVersion,
      {
        ...completeAnswers,
        U1: true,
      },
    );
    expect(savedResponse.statusCode).toBe(200);
    const saved = CheckInStateResponseSchema.parse(savedResponse.json());
    if (!saved.assessment || saved.assessment.completionStatus !== 'DRAFT') {
      throw new Error('Expected saved historical draft');
    }

    const submitted = await submit(
      saved.assessment.assessmentId,
      saved.assessment.draftVersion,
      'COMPLETE',
      randomUUID(),
      true,
    );
    expect(submitted.statusCode).toBe(200);
    const projection = CheckInStateResponseSchema.parse(submitted.json());
    expect(projection.availability).toBe('HISTORICAL');
    if (
      !projection.assessment ||
      projection.assessment.completionStatus === 'DRAFT'
    ) {
      throw new Error('Expected submitted backfill projection');
    }
    expect(projection.assessment.submissionClassification).toBe(
      'HISTORICAL_BACKFILL',
    );

    const oldNewerEvaluation =
      await prisma.assessmentEvaluation.findUniqueOrThrow({
        where: { id: before.id },
      });
    expect(oldNewerEvaluation.lifecycle).toBe('SUPERSEDED_BY_REVISION');

    const activeNewer = await prisma.assessmentEvaluation.findMany({
      where: {
        assessmentRevisionId: currentRevisionId,
        lifecycle: 'ACTIVE',
      },
    });
    expect(activeNewer).toHaveLength(1);
    expect(activeNewer[0]!.id).not.toBe(before.id);
  });

  it('creates a patient correction revision N+1, preserves the old revision, and revokes its old evaluation', async () => {
    const assessment = await prisma.weeklyAssessment.findUniqueOrThrow({
      where: { id: currentAssessmentId },
      include: { authoritativeRevision: true },
    });
    if (!assessment.authoritativeRevision) {
      throw new Error('Expected authoritative revision');
    }

    const oldRevisionId = assessment.authoritativeRevision.id;
    const oldEvaluation = await prisma.assessmentEvaluation.findFirstOrThrow({
      where: {
        assessmentRevisionId: oldRevisionId,
        lifecycle: 'ACTIVE',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/patient/assessments/${assessment.id}/corrections`,
      headers: {
        cookie: patientCookie,
        'idempotency-key': randomUUID(),
      },
      payload: {
        expectedAuthoritativeRevisionId: oldRevisionId,
        expectedRevisionNumber: assessment.authoritativeRevision.revisionNumber,
        completionIntent: 'COMPLETE',
        answers: {
          ...completeAnswers,
          R3: 7,
          P1: 1,
        },
      },
    });
    expect(response.statusCode).toBe(200);

    const corrected = CheckInStateResponseSchema.parse(response.json());
    if (
      !corrected.assessment ||
      corrected.assessment.completionStatus === 'DRAFT'
    ) {
      throw new Error('Expected correction projection');
    }
    expect(corrected.assessment.revisionNumber).toBe(
      assessment.authoritativeRevision.revisionNumber + 1,
    );
    expect(corrected.assessment.submissionClassification).toBe(
      'PATIENT_CORRECTION',
    );

    const newRevision = await prisma.assessmentRevision.findUniqueOrThrow({
      where: { id: corrected.assessment.revisionId },
    });
    expect(newRevision.supersedesRevisionId).toBe(oldRevisionId);

    expect(
      await prisma.assessmentRevision.count({
        where: { assessmentId: assessment.id },
      }),
    ).toBeGreaterThanOrEqual(2);

    expect(
      (
        await prisma.assessmentEvaluation.findUniqueOrThrow({
          where: { id: oldEvaluation.id },
        })
      ).lifecycle,
    ).toBe('REVOKED_BY_REVISION');
  });

  it('allows only the assigned clinician staff correction and suppresses automatic patient support while retaining clinician reason eligibility', async () => {
    const assessment = await prisma.weeklyAssessment.findUniqueOrThrow({
      where: { id: currentAssessmentId },
      include: { authoritativeRevision: true },
    });
    if (!assessment.authoritativeRevision) {
      throw new Error('Expected authoritative revision');
    }

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/clinician/patients/${patientId}/assessments/${assessment.id}/corrections`,
      headers: {
        cookie: clinicianCookie,
        'idempotency-key': randomUUID(),
      },
      payload: {
        expectedAuthoritativeRevisionId: assessment.authoritativeRevision.id,
        expectedRevisionNumber: assessment.authoritativeRevision.revisionNumber,
        completionIntent: 'COMPLETE',
        answers: {
          ...completeAnswers,
          R3: 7,
          P1: 1,
        },
        reason:
          'Corrected from source record during Phase 4 integration validation.',
      },
    });
    expect(response.statusCode).toBe(200);
    const receipt = response.json<{
      revisionId: string;
      evaluationIds: string[];
    }>();
    expect(receipt.evaluationIds.length).toBeGreaterThan(0);

    const activeEvaluation = await prisma.assessmentEvaluation.findFirstOrThrow(
      {
        where: {
          assessmentRevisionId: receipt.revisionId,
          lifecycle: 'ACTIVE',
        },
      },
    );

    const intents = await prisma.patientInterventionIntent.findMany({
      where: { evaluationId: activeEvaluation.id },
    });
    expect(intents.length).toBeGreaterThan(0);
    expect(
      intents.every((intent) => intent.effect === 'SUPPRESSED_TRIGGER'),
    ).toBe(true);

    const effectPlan = activeEvaluation.effectPlanSnapshot as {
      candidateClinicianReasons?: Array<{
        reasonFamily: string;
        effect: string;
        suppressionReason: string | null;
      }>;
    };

    expect(effectPlan.candidateClinicianReasons).toContainEqual({
      reasonFamily: 'CRAVING_LOW_CONFIDENCE',
      effect: 'ELIGIBLE',
      suppressionReason: null,
    });
  });

  it('keeps patient support separate from the clinician case and protects the Phase 5 routes', async () => {
    const supportResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/support',
      headers: { cookie: patientCookie },
    });
    expect(supportResponse.statusCode).toBe(200);
    const support = PatientSupportResponseSchema.parse(supportResponse.json());
    expect(['CONTENT_UNAVAILABLE', 'NO_CURRENT_SUPPORT']).toContain(
      support.status,
    );
    const serialized = JSON.stringify(support);
    expect(serialized).not.toContain('CRAVING_LOW_CONFIDENCE');
    expect(serialized).not.toContain('HIGH_CRAVING');

    const patientReadingClinical = await app.inject({
      method: 'GET',
      url: `/api/v1/clinician/patients/${patientId}/monitoring`,
      headers: { cookie: patientCookie },
    });
    expect(patientReadingClinical.statusCode).toBe(403);

    const adminReadingClinical = await app.inject({
      method: 'GET',
      url: '/api/v1/clinician/review-queue',
      headers: { cookie: adminCookie },
    });
    expect(adminReadingClinical.statusCode).toBe(403);
  });

  it('creates a Level-3 queue item, acknowledges it into ACTIVE, and preserves idempotency', async () => {
    const queueResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/clinician/review-queue',
      headers: { cookie: clinicianCookie },
    });
    expect(queueResponse.statusCode).toBe(200);
    const queue = ClinicianReviewQueueResponseSchema.parse(
      queueResponse.json(),
    );
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]?.case.lifecycle).toBe('NEW');
    expect(queue.items[0]?.activeReasons.length).toBeGreaterThan(0);
    expect(queue.items[0]?.tasks.length).toBeGreaterThan(0);
    expect(queue.items[0]?.source.goal).toBe('UNSURE');

    const caseRow = queue.items[0]!.case;
    const key = randomUUID();
    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/clinician/review-cases/${caseRow.id}/acknowledge`,
      headers: { cookie: clinicianCookie, 'idempotency-key': key },
      payload: { expectedCaseVersion: caseRow.caseVersion },
    });
    expect(first.statusCode).toBe(200);
    const firstProjection = ClinicianPatientMonitoringResponseSchema.parse(
      first.json(),
    );
    expect(firstProjection.currentCase?.lifecycle).toBe('ACTIVE');

    const replay = await app.inject({
      method: 'POST',
      url: `/api/v1/clinician/review-cases/${caseRow.id}/acknowledge`,
      headers: { cookie: clinicianCookie, 'idempotency-key': key },
      payload: { expectedCaseVersion: caseRow.caseVersion },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
    expect(
      await prisma.clinicalCaseEvent.count({
        where: { caseId: caseRow.id, eventType: 'CASE_ACKNOWLEDGED' },
      }),
    ).toBe(1);
  });

  it('marks an invalidated task update-required and closes the case with correction provenance', async () => {
    const assessment = await prisma.weeklyAssessment.findUniqueOrThrow({
      where: { id: currentAssessmentId },
      include: { authoritativeRevision: true },
    });
    if (!assessment.authoritativeRevision) {
      throw new Error('Expected authoritative revision');
    }

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/patient/assessments/${assessment.id}/corrections`,
      headers: {
        cookie: patientCookie,
        'idempotency-key': randomUUID(),
      },
      payload: {
        expectedAuthoritativeRevisionId: assessment.authoritativeRevision.id,
        expectedRevisionNumber: assessment.authoritativeRevision.revisionNumber,
        completionIntent: 'COMPLETE',
        answers: completeAnswers,
      },
    });
    expect(response.statusCode).toBe(200);

    const currentCase = await prisma.clinicalReviewCase.findFirstOrThrow({
      where: { patientId },
      orderBy: { openedAt: 'desc' },
    });
    expect(currentCase.lifecycle).toBe('RESOLVED_CORRECTION');
    const tasks = await prisma.clinicianTask.findMany({
      where: { caseId: currentCase.id },
    });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.alertUpdateRequired)).toBe(true);
    expect(
      tasks.every(
        (task) =>
          task.sourceRevisionId !== assessment.authoritativeRevision?.id,
      ),
    ).toBe(true);
    expect(
      await prisma.clinicalCaseEvent.count({
        where: { caseId: currentCase.id, eventType: 'REASON_REVOKED' },
      }),
    ).toBeGreaterThan(0);
  });

  it('projects the history without exposing internal monitoring scores or flags', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/check-in/history',
      headers: { cookie: patientCookie },
    });
    expect(response.statusCode).toBe(200);
    const history = CheckInHistoryResponseSchema.parse(response.json());

    expect(
      history.items.some((item) => item.period.periodId === period1Id),
    ).toBe(true);
    expect(
      history.items.some((item) => item.period.periodId === period2Id),
    ).toBe(true);

    const serialized = JSON.stringify(history);
    expect(serialized).not.toContain('riskScore');
    expect(serialized).not.toContain('rawProtectionScore');
    expect(serialized).not.toContain('HIGH_CRAVING');
    expect(serialized).not.toContain('CRAVING_LOW_CONFIDENCE');
  });
});
