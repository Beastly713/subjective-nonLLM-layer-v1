import { randomUUID } from 'node:crypto';

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import {
  PatientSafetyProjectionSchema,
  SafetyCaseProjectionSchema,
  SafetyEvaluationResponseSchema,
  type SafetyInput,
} from '@aud-subjective/contracts';

import { buildApp } from '../../src/app.js';
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
const marker = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
const routeRegion = `SAFE_${marker}`;
const noRouteRegion = `NO_ROUTE_${marker}`;
const baseEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: 'silent',
  APP_MODE: 'prototype',
  BETTER_AUTH_SECRET: 'safety-integration-secret-at-least-32-characters',
  APP_BASE_URL: 'http://127.0.0.1:3000',
  SAFETY_ROUTING_COUNTRY_CODE: 'XZ',
};
const config = parseConfig({
  ...baseEnvironment,
  SAFETY_ROUTING_REGION_CODE: routeRegion,
});
const noRouteConfig = parseConfig({
  ...baseEnvironment,
  SAFETY_ROUTING_REGION_CODE: noRouteRegion,
});
const prisma = createPrismaClient(databaseUrl);
const emailSender = new FakeAuthEmailSender();
const auth = createAuth(prisma, config, emailSender);
const noRouteAuth = createAuth(prisma, noRouteConfig, emailSender);
const fixtureAuth = createAuth(prisma, config, emailSender, {
  allowSignUpForFixtureCreation: true,
});
const clock = new FixedClock(new Date('2026-08-20T00:00:00.000Z'));
const app = buildApp({ config, prisma, auth, emailSender, clock });
const noRouteApp = buildApp({
  config: noRouteConfig,
  prisma,
  auth: noRouteAuth,
  emailSender,
  clock,
});

const password = 'SafetyFixture!2026';
const emails = {
  admin: `safety-admin-${marker.toLowerCase()}@example.test`,
  clinician: `safety-clinician-${marker.toLowerCase()}@example.test`,
  emergency: `safety-emergency-${marker.toLowerCase()}@example.test`,
  priority: `safety-priority-${marker.toLowerCase()}@example.test`,
  safe: `safety-safe-${marker.toLowerCase()}@example.test`,
  unassigned: `safety-unassigned-${marker.toLowerCase()}@example.test`,
};
type FixtureKey = keyof typeof emails;
const ids = {} as Record<FixtureKey, string>;
const cookies = {} as Record<FixtureKey, string>;

const completeDraft = {
  auditC: {
    frequency: { state: 'ANSWERED', value: 1 },
    quantity: { state: 'ANSWERED', value: 1 },
    heavy: { state: 'ANSWERED', value: 0 },
  },
  drinkingDaysPerWeek: { state: 'ANSWERED', value: 2 },
  drinksPerDrinkingDay: { state: 'ANSWERED', value: 2 },
  heavyDrinkingDaysRecent: { state: 'ANSWERED', value: 0 },
  lastDrink: { state: 'UNKNOWN' },
  recoveryDirection: { state: 'ANSWERED', value: 'UNSURE' },
  mutualHelpPreference: { state: 'ANSWERED', value: 'UNSURE' },
  spiritualContentPreference: { state: 'ANSWERED', value: 'UNSURE' },
} as const;

const baseCssrs = {
  item1: 'NO',
  item2: 'NO',
  item3: 'NO',
  item4: 'NO',
  item5: 'NO',
  suicidalBehaviorPrevious3Months: 'NO',
} as const;

const safeInput: SafetyInput = {
  currentSeizure: false,
  severeConfusionOrDisorientation: false,
  hallucinations: false,
  hallucinationDisorientation: false,
  difficultyRemainingConscious: false,
  breathingDifficulty: false,
  repeatedVomitingWithSevereIllness: false,
  currentSuicideAttempt: false,
  currentSelfHarmMedicalEmergency: false,
  immediateSuicidePlanAndIntent: false,
  previousWithdrawalSeizure: 'NO',
  previousWithdrawalDelirium: 'NO',
  priorWithdrawals: '0',
  similarHeavyRegularUseAtLeast3Months: 'NO',
  ageOver65: 'UNSURE',
  reductionStartedAt: null,
  reductionPercent: null,
  cessation: false,
  currentWithdrawalSymptoms: [],
  sedativeDependence: 'NO',
  cssrs: baseCssrs,
  pregnancy: 'NO',
  currentAlcoholUse: false,
  otherSubstanceCategories: ['NONE'],
  dailyOrNearDailySedativeOrOpioidUse: 'NO',
  priorSedativeOrOpioidWithdrawalSymptoms: 'NO',
  seriousMedicalContexts: [],
  stableMedicalCondition: false,
  clinicianDirectedReview: false,
};

async function createIdentity(key: FixtureKey, name: string) {
  const created = await fixtureAuth.api.signUpEmail({
    body: { email: emails[key], password, name },
  });
  ids[key] = created.user.id;
  await prisma.user.update({
    where: { id: created.user.id },
    data: { emailVerified: true },
  });
}

async function signIn(
  targetApp: typeof app,
  key: FixtureKey,
) {
  const response = await targetApp.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: config.appBaseUrl },
    payload: { email: emails[key], password },
  });
  expect(response.statusCode).toBe(200);
  const cookie = response.cookies.find(({ name }) =>
    name.includes('session_token'),
  );
  expect(cookie).toBeDefined();
  return `${cookie!.name}=${cookie!.value}`;
}

async function saveAndSubmitOnboarding(
  targetApp: typeof app,
  key: 'priority' | 'safe' | 'unassigned',
) {
  const save = await targetApp.inject({
    method: 'PUT',
    url: '/api/v1/patient/onboarding/draft',
    headers: { cookie: cookies[key] },
    payload: {
      expectedVersion: 0,
      currentStep: 'SAFETY',
      draftResponses: completeDraft,
    },
  });
  expect(save.statusCode).toBe(200);
  const submit = await targetApp.inject({
    method: 'POST',
    url: '/api/v1/patient/onboarding/submit',
    headers: {
      cookie: cookies[key],
      'idempotency-key': randomUUID(),
    },
    payload: { expectedVersion: save.json().version },
  });
  expect(submit.statusCode).toBe(200);
}

async function safetyEvaluation(
  targetApp: typeof app,
  key: 'emergency' | 'priority' | 'safe' | 'unassigned',
  input: SafetyInput,
  idempotencyKey = randomUUID(),
) {
  return targetApp.inject({
    method: 'POST',
    url: '/api/v1/patient/onboarding/safety-evaluations',
    headers: {
      cookie: cookies[key],
      'idempotency-key': idempotencyKey,
    },
    payload: input,
  });
}

async function clinicianMutation(
  caseId: string,
  endpoint: string,
  payload: Record<string, unknown>,
  idempotencyKey = randomUUID(),
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/clinician/safety-cases/${caseId}/${endpoint}`,
    headers: {
      cookie: cookies.clinician,
      'idempotency-key': idempotencyKey,
    },
    payload,
  });
}

beforeAll(async () => {
  await Promise.all([
    createIdentity('admin', 'Safety Administrator'),
    createIdentity('clinician', 'Safety Clinician'),
    createIdentity('emergency', 'Emergency Patient'),
    createIdentity('priority', 'Priority Patient'),
    createIdentity('safe', 'Safe Patient'),
    createIdentity('unassigned', 'Unassigned Patient'),
  ]);

  await prisma.applicationAccount.createMany({
    data: (Object.keys(ids) as FixtureKey[]).map((key) => ({
      userId: ids[key],
      state: 'ACTIVE' as const,
      createdByUserId: ids.admin,
      ...(key === 'clinician' || key === 'admin'
        ? { privilegedIdentityVerifiedAt: new Date('2026-08-19T00:00:00.000Z') }
        : {}),
    })),
  });
  await prisma.userRoleAssignment.createMany({
    data: [
      {
        userId: ids.admin,
        workspace: 'ADMIN',
        role: 'ADMIN',
        grantedByUserId: ids.admin,
        grantReason: 'Safety integration fixture',
      },
      {
        userId: ids.clinician,
        workspace: 'CLINICIAN',
        role: 'CLINICIAN',
        grantedByUserId: ids.admin,
        grantReason: 'Safety integration fixture',
      },
      ...(['emergency', 'priority', 'safe', 'unassigned'] as const).map(
        (key) => ({
          userId: ids[key],
          workspace: 'PATIENT' as const,
          role: 'PATIENT' as const,
          grantedByUserId: ids.admin,
          grantReason: 'Safety integration fixture',
        }),
      ),
    ],
  });

  for (const key of ['emergency', 'priority', 'safe', 'unassigned'] as const) {
    await prisma.patientProfile.create({
      data: {
        patientId: ids[key],
        monitoringTimezone: 'UTC',
        createdByUserId: ids.admin,
        updatedByUserId: ids.admin,
        preferences: {
          create: { version: 1, createdByUserId: ids.admin },
        },
        processingLock: { create: {} },
      },
    });
  }

  await prisma.clinicianPatientAssignment.createMany({
    data: ['emergency', 'priority'].map((key) => ({
      clinicianUserId: ids.clinician,
      patientId: ids[key as 'emergency' | 'priority'],
      assignedByUserId: ids.admin,
      assignmentReason: 'Safety integration fixture',
    })),
  });

  await prisma.regionalRoutingProfileVersion.create({
    data: {
      countryCode: 'XZ',
      regionCode: routeRegion,
      regionKey: `XZ:${routeRegion}`,
      logicalVersion: 1,
      lifecycle: 'ACTIVE',
      effectiveAt: new Date('2026-08-19T00:00:00.000Z'),
      createdByUserId: ids.admin,
      provenance: 'Safety integration fixture',
      targets: {
        create: [
          {
            kind: 'EMERGENCY_SERVICE',
            representation: 'TELEPHONE',
            targetValue: '+15550000001',
            label: 'Fixture emergency service',
          },
          {
            kind: 'CRISIS_SERVICE',
            representation: 'DEEP_LINK',
            targetValue: 'https://example.invalid/crisis',
            label: 'Fixture crisis service',
          },
          {
            kind: 'URGENT_MEDICAL_SERVICE',
            representation: 'EXTERNAL_SERVICE',
            targetValue: `urn:test:urgent:${marker}`,
            label: 'Fixture urgent medical service',
          },
          {
            kind: 'ON_CALL_CLINICIAN_QUEUE',
            representation: 'INTERNAL_QUEUE',
            targetValue: `queue:safety-${marker.toLowerCase()}`,
            label: 'Fixture on-call clinician queue',
          },
        ],
      },
    },
  });

  await app.ready();
  await noRouteApp.ready();
  cookies.admin = await signIn(app, 'admin');
  cookies.clinician = await signIn(app, 'clinician');
  cookies.emergency = await signIn(app, 'emergency');
  cookies.priority = await signIn(app, 'priority');
  cookies.safe = await signIn(app, 'safe');
  cookies.unassigned = await signIn(noRouteApp, 'unassigned');

  await saveAndSubmitOnboarding(app, 'priority');
  await saveAndSubmitOnboarding(app, 'safe');
  await saveAndSubmitOnboarding(noRouteApp, 'unassigned');
}, 30_000);

afterAll(async () => {
  // Safety history is intentionally append-only. Unique fixture identities are used
  // so integration runs never need to weaken the database immutability triggers.
  await noRouteApp.close();
  await app.close();
  await prisma.$disconnect();
});

describe.sequential('onboarding safety and controlled handoff', () => {
  it('supports version-zero drafts, rejects incomplete submission, resumes the server step, and submits idempotently', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/onboarding',
      headers: { cookie: cookies.emergency },
    });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toMatchObject({ version: 0, currentStep: 'ACCOUNT' });

    const incompleteDraft = {
      ...completeDraft,
      auditC: {
        ...completeDraft.auditC,
        heavy: { state: 'NOT_YET_ANSWERED' as const },
      },
    };
    const firstSave = await app.inject({
      method: 'PUT',
      url: '/api/v1/patient/onboarding/draft',
      headers: { cookie: cookies.emergency },
      payload: {
        expectedVersion: 0,
        currentStep: 'AUDIT_C',
        draftResponses: incompleteDraft,
      },
    });
    expect(firstSave.statusCode).toBe(200);
    expect(firstSave.json().version).toBe(1);

    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v1/patient/onboarding/submit',
      headers: {
        cookie: cookies.emergency,
        'idempotency-key': randomUUID(),
      },
      payload: { expectedVersion: 1 },
    });
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json().error.code).toBe('ONBOARDING_INCOMPLETE');

    const completeSave = await app.inject({
      method: 'PUT',
      url: '/api/v1/patient/onboarding/draft',
      headers: { cookie: cookies.emergency },
      payload: {
        expectedVersion: 1,
        currentStep: 'SAFETY',
        draftResponses: completeDraft,
      },
    });
    expect(completeSave.statusCode).toBe(200);
    expect(completeSave.json().version).toBe(2);

    const resumed = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/onboarding',
      headers: { cookie: cookies.emergency },
    });
    expect(resumed.json().currentStep).toBe('SAFETY');

    const submitKey = randomUUID();
    const submitA = await app.inject({
      method: 'POST',
      url: '/api/v1/patient/onboarding/submit',
      headers: {
        cookie: cookies.emergency,
        'idempotency-key': submitKey,
      },
      payload: { expectedVersion: 2 },
    });
    const submitB = await app.inject({
      method: 'POST',
      url: '/api/v1/patient/onboarding/submit',
      headers: {
        cookie: cookies.emergency,
        'idempotency-key': submitKey,
      },
      payload: { expectedVersion: 2 },
    });
    expect(submitA.statusCode).toBe(200);
    expect(submitB.body).toBe(submitA.body);
    expect(
      await prisma.onboardingRevision.count({
        where: { patientId: ids.emergency },
      }),
    ).toBe(1);
    expect(
      await prisma.monitoringScheduleVersion.count({
        where: { patientId: ids.emergency },
      }),
    ).toBe(0);
  });

  it('commits emergency safety and idempotency atomically, cannot self-relax, and creates a new case after authorized external resolution', async () => {
    const emergencyInput = { ...safeInput, currentSeizure: true };
    const key = randomUUID();
    const first = await safetyEvaluation(app, 'emergency', emergencyInput, key);
    expect(first.statusCode).toBe(200);
    const firstBody = SafetyEvaluationResponseSchema.parse(first.json());
    expect(firstBody.safety).toMatchObject({
      safetyState: 'HANDOFF_REQUIRED',
      requiresSafetyShell: true,
      routeAvailability: 'AVAILABLE',
    });
    expect(firstBody.safety.patientRouteActions[0]).toMatchObject({
      actionType: 'CALL',
      href: 'tel:+15550000001',
      priority: 'PRIMARY',
    });
    const patientJson = JSON.stringify(firstBody.safety);
    expect(patientJson).not.toContain('S0_EMERGENCY');
    expect(patientJson).not.toContain('CURRENT_SEIZURE');
    expect(patientJson).not.toContain('profileId');

    const replay = await safetyEvaluation(app, 'emergency', emergencyInput, key);
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toBe(first.body);
    expect(
      await prisma.safetyInputRevision.count({
        where: { patientId: ids.emergency },
      }),
    ).toBe(1);
    expect(
      await prisma.idempotencyRecord.count({
        where: {
          actorId: ids.emergency,
          action: 'PATIENT_SAFETY_EVALUATE',
          idempotencyKey: key,
        },
      }),
    ).toBe(1);

    let active = await prisma.safetyCase.findFirstOrThrow({
      where: { patientId: ids.emergency, resolvedAt: null },
    });
    expect(active.lifecycle).toBe('ESCALATED_TO_EMERGENCY');
    expect(active.gateStatus).toBe('BLOCK_AND_HANDOFF');
    expect(active.currentRestrictionVersionId).not.toBeNull();

    const selfReportedSafe = await safetyEvaluation(app, 'emergency', safeInput);
    expect(selfReportedSafe.statusCode).toBe(200);
    expect(
      SafetyEvaluationResponseSchema.parse(selfReportedSafe.json()).safety
        .safetyState,
    ).toBe('HANDOFF_REQUIRED');
    active = await prisma.safetyCase.findFirstOrThrow({
      where: { patientId: ids.emergency, resolvedAt: null },
    });
    expect(active.severity).toBe('S0_EMERGENCY');
    expect(active.gateStatus).toBe('BLOCK_AND_HANDOFF');
    expect(
      await prisma.safetyCase.count({
        where: { patientId: ids.emergency },
      }),
    ).toBe(1);

    const resolveKey = randomUUID();
    const resolved = await clinicianMutation(
      active.id,
      'resolve-external-handoff',
      {
        expectedVersion: active.version,
        reason: 'External emergency handoff completed and owner cleared monitoring.',
      },
      resolveKey,
    );
    expect(resolved.statusCode).toBe(200);
    const resolvedBody = SafetyCaseProjectionSchema.parse(resolved.json());
    expect(resolvedBody.lifecycle).toBe('RESOLVED_EXTERNAL_HANDOFF');
    expect(resolvedBody.gateStatus).toBe('ALLOW_MONITORING');
    expect(resolvedBody.resolvedAt).not.toBeNull();

    const afterResolution = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/safety',
      headers: { cookie: cookies.emergency },
    });
    expect(PatientSafetyProjectionSchema.parse(afterResolution.json()).safetyState).toBe(
      'MONITORING_AVAILABLE',
    );

    const recurrence = await safetyEvaluation(app, 'emergency', emergencyInput);
    expect(recurrence.statusCode).toBe(200);
    const recurrentActive = await prisma.safetyCase.findFirstOrThrow({
      where: { patientId: ids.emergency, resolvedAt: null },
    });
    expect(recurrentActive.id).not.toBe(active.id);
    expect(
      await prisma.safetyCase.count({
        where: { patientId: ids.emergency },
      }),
    ).toBe(2);
  });

  it('distinguishes a completed safe evaluation from NOT_ASSESSED and preserves unknown dependencies', async () => {
    const response = await safetyEvaluation(app, 'safe', safeInput);
    expect(response.statusCode).toBe(200);
    const body = SafetyEvaluationResponseSchema.parse(response.json());
    expect(body.safety.safetyState).toBe('MONITORING_AVAILABLE');
    expect(body.requiresReview).toBe(false);
    expect(
      await prisma.safetyCase.count({ where: { patientId: ids.safe } }),
    ).toBe(0);

    const evaluation = await prisma.safetyEvaluationResult.findFirstOrThrow({
      where: { patientId: ids.safe },
      orderBy: { evaluatedAt: 'desc' },
    });
    const safetyInput = await prisma.safetyInputRevision.findFirstOrThrow({
      where: { patientId: ids.safe },
      orderBy: { revision: 'desc' },
    });
    const contextSnapshot = evaluation.contextSnapshot as Record<string, unknown>;
    expect(contextSnapshot.evaluatedAt).toBe(evaluation.evaluatedAt.toISOString());
    expect(contextSnapshot.ageOver65).toBe('UNSURE');
    expect(contextSnapshot.canonicalProlongedHeavyRegularUse).toEqual({
      state: 'UNKNOWN',
      missingDependency: 'COMMIT_3_28_DAY_BASELINE',
    });
    expect(safetyInput.instrument).toBe('AUD_SAFETY_GATE_ONBOARDING');
    expect(safetyInput.instrument).not.toBe('C-SSRS Screener Recent');
  });

  it('enforces the ordinary owner lifecycle, structured disposition semantics, pointer updates, and append-only history', async () => {
    const priorityInput = {
      ...safeInput,
      previousWithdrawalSeizure: 'UNSURE' as const,
    };
    const evaluated = await safetyEvaluation(app, 'priority', priorityInput);
    expect(evaluated.statusCode).toBe(200);
    expect(
      SafetyEvaluationResponseSchema.parse(evaluated.json()).safety.safetyState,
    ).toBe('REVIEW_REQUIRED');

    let current = await prisma.safetyCase.findFirstOrThrow({
      where: { patientId: ids.priority, resolvedAt: null },
    });
    expect(current.lifecycle).toBe('HANDOFF_INITIATED');

    const premature = await clinicianMutation(current.id, 'disposition', {
      expectedVersion: current.version,
      disposition: 'SAFE_TO_CONTINUE_STANDARD_MONITORING',
      reason: 'Premature clear must fail.',
    });
    expect(premature.statusCode).toBe(409);
    expect(premature.json().error.code).toBe('SAFETY_CASE_TRANSITION_INVALID');

    for (const endpoint of ['acknowledge', 'begin-review', 'establish-plan']) {
      const mutation = await clinicianMutation(current.id, endpoint, {
        expectedVersion: current.version,
        reason: `Fixture ${endpoint}`,
      });
      expect(mutation.statusCode).toBe(200);
      current = await prisma.safetyCase.findUniqueOrThrow({
        where: { id: current.id },
      });
    }
    expect(current.lifecycle).toBe('PLAN_ESTABLISHED');

    const restricted = await clinicianMutation(current.id, 'disposition', {
      expectedVersion: current.version,
      disposition: 'SAFE_TO_CONTINUE_WITH_RESTRICTIONS',
      reason: 'Continue with owner-defined restrictions.',
      restrictions: {
        allowedSubjectiveInterventions: [],
        monitoringPromptPolicy: 'PAUSE',
        goalChangeAllowed: false,
        reassessmentDueAt: null,
      },
    });
    expect(restricted.statusCode).toBe(200);
    const restrictedBody = SafetyCaseProjectionSchema.parse(restricted.json());
    expect(restrictedBody.lifecycle).toBe('PLAN_ESTABLISHED');
    expect(restrictedBody.gateStatus).toBe('ALLOW_WITH_HANDOFF');
    expect(restrictedBody.currentRestriction?.monitoringPromptPolicy).toBe('PAUSE');

    current = await prisma.safetyCase.findUniqueOrThrow({
      where: { id: current.id },
    });
    const finalKey = randomUUID();
    const cleared = await clinicianMutation(
      current.id,
      'disposition',
      {
        expectedVersion: current.version,
        disposition: 'SAFE_TO_CONTINUE_STANDARD_MONITORING',
        reason: 'Plan completed; standard monitoring is now authorized.',
      },
      finalKey,
    );
    expect(cleared.statusCode).toBe(200);
    const clearedBody = SafetyCaseProjectionSchema.parse(cleared.json());
    expect(clearedBody.lifecycle).toBe('RESOLVED');
    expect(clearedBody.gateStatus).toBe('ALLOW_MONITORING');
    expect(clearedBody.currentRestriction?.gateStatus).toBe('ALLOW_MONITORING');
    expect(clearedBody.resolvedAt).not.toBeNull();

    const replay = await clinicianMutation(
      current.id,
      'disposition',
      {
        expectedVersion: current.version,
        disposition: 'SAFE_TO_CONTINUE_STANDARD_MONITORING',
        reason: 'Plan completed; standard monitoring is now authorized.',
      },
      finalKey,
    );
    expect(replay.body).toBe(cleared.body);

    const stored = await prisma.safetyCase.findUniqueOrThrow({
      where: { id: current.id },
    });
    const latestRestriction =
      await prisma.safetyCaseRestrictionVersion.findFirstOrThrow({
        where: { caseId: current.id },
        orderBy: { version: 'desc' },
      });
    expect(stored.currentRestrictionVersionId).toBe(latestRestriction.id);
    await expect(
      prisma.safetyCaseRestrictionVersion.update({
        where: { id: latestRestriction.id },
        data: { goalChangeAllowed: false },
      }),
    ).rejects.toThrow();
  });

  it('keeps route failure safety-controlled, records a non-sensitive incident, and hides an unassigned patient from clinicians', async () => {
    const priorityInput = {
      ...safeInput,
      previousWithdrawalSeizure: 'UNSURE' as const,
    };
    const response = await safetyEvaluation(
      noRouteApp,
      'unassigned',
      priorityInput,
    );
    expect(response.statusCode).toBe(200);
    const body = SafetyEvaluationResponseSchema.parse(response.json());
    expect(body.safety).toMatchObject({
      safetyState: 'REVIEW_REQUIRED',
      routeAvailability: 'UNAVAILABLE',
      patientRouteActions: [],
    });

    const safetyCase = await prisma.safetyCase.findFirstOrThrow({
      where: { patientId: ids.unassigned, resolvedAt: null },
    });
    expect(safetyCase.severity).toBe('S2_PRIORITY');
    expect(safetyCase.gateStatus).toBe('ALLOW_WITH_HANDOFF');
    expect(safetyCase.routeStatus).toBe('UNAVAILABLE');
    const incident = await prisma.operationalIncident.findFirstOrThrow({
      where: {
        incidentType: 'SAFETY_ROUTING',
        code: 'SAFETY_ROUTE_UNAVAILABLE',
        provenanceReference: safetyCase.id,
      },
    });
    const metadata = JSON.stringify(incident.metadata);
    expect(metadata).not.toContain('currentSeizure');
    expect(metadata).not.toContain('cssrs');
    expect(metadata).not.toContain('previousWithdrawalSeizure');

    const clinicianList = await app.inject({
      method: 'GET',
      url: '/api/v1/clinician/safety-cases',
      headers: { cookie: cookies.clinician },
    });
    expect(clinicianList.statusCode).toBe(200);
    expect(
      clinicianList.json().items.some(
        (item: { patientId: string }) => item.patientId === ids.unassigned,
      ),
    ).toBe(false);
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/clinician/safety-cases/${safetyCase.id}`,
      headers: { cookie: cookies.clinician },
    });
    expect(detail.statusCode).toBe(404);

    const adminList = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/safety-cases',
      headers: { cookie: cookies.admin },
    });
    expect(adminList.statusCode).toBe(200);
    const adminCase = adminList
      .json()
      .items.find((item: { id: string }) => item.id === safetyCase.id);
    expect(adminCase.operationalIncidents).toHaveLength(1);

    const adminCannotDispose = await app.inject({
      method: 'POST',
      url: `/api/v1/clinician/safety-cases/${safetyCase.id}/disposition`,
      headers: {
        cookie: cookies.admin,
        'idempotency-key': randomUUID(),
      },
      payload: {
        expectedVersion: safetyCase.version,
        disposition: 'SAFE_TO_CONTINUE_STANDARD_MONITORING',
        reason: 'Admin must not perform a clinical disposition.',
      },
    });
    expect(adminCannotDispose.statusCode).toBe(403);
  });
});
