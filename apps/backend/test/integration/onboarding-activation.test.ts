import { randomUUID } from 'node:crypto';

import {
  CompleteOnboardingResponseSchema,
  SafetyEvaluationResponseSchema,
  type SafetyInput,
} from '@aud-subjective/contracts';
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
import { FixedClock } from '../../src/shared/clock/clock.js';
import { completePatientOnboarding } from '../../src/modules/onboarding/activation-service.js';

loadRootEnvironment();

const databaseUrl = parseTestDatabaseUrl(process.env);
const marker = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
const config = parseConfig({
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: 'silent',
  APP_MODE: 'prototype',
  BETTER_AUTH_SECRET: 'activation-integration-secret-at-least-32-characters',
  APP_BASE_URL: 'http://127.0.0.1:3000',
  SAFETY_ROUTING_COUNTRY_CODE: 'XZ',
  SAFETY_ROUTING_REGION_CODE: `ACT_${marker}`,
});
const prisma = createPrismaClient(databaseUrl);
const emailSender = new FakeAuthEmailSender();
const auth = createAuth(prisma, config, emailSender);
const fixtureAuth = createAuth(prisma, config, emailSender, {
  allowSignUpForFixtureCreation: true,
});
const clock = new FixedClock(new Date('2026-08-20T00:00:00.000Z'));
const app = buildApp({ config, prisma, auth, emailSender, clock });

const password = 'ActivationFixture!2026';
const emails = {
  clinician: `activation-clinician-${marker.toLowerCase()}@example.test`,
  unsure: `activation-unsure-${marker.toLowerCase()}@example.test`,
  reduction: `activation-reduction-${marker.toLowerCase()}@example.test`,
  handoff: `activation-handoff-${marker.toLowerCase()}@example.test`,
};
type FixtureKey = keyof typeof emails;
type PatientKey = Exclude<FixtureKey, 'clinician'>;
const ids = {} as Record<FixtureKey, string>;
const cookies = {} as Record<FixtureKey, string>;

const baseDraft = {
  auditC: {
    frequency: { state: 'ANSWERED', value: 1 },
    quantity: { state: 'ANSWERED', value: 1 },
    heavy: { state: 'ANSWERED', value: 0 },
  },
  drinkingDaysPerWeek: { state: 'ANSWERED', value: 2 },
  drinksPerDrinkingDay: { state: 'ANSWERED', value: 2 },
  heavyDrinkingDaysRecent: { state: 'ANSWERED', value: 0 },
  lastDrink: { state: 'UNKNOWN' },
  mutualHelpPreference: { state: 'ANSWERED', value: 'UNSURE' },
  spiritualContentPreference: { state: 'ANSWERED', value: 'UNSURE' },
} as const;

function onboardingDraft(direction: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE') {
  return {
    ...baseDraft,
    recoveryDirection: { state: 'ANSWERED' as const, value: direction },
  };
}

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

async function signIn(key: FixtureKey) {
  const response = await app.inject({
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

async function submitOnboarding(
  key: PatientKey,
  direction: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE',
) {
  const save = await app.inject({
    method: 'PUT',
    url: '/api/v1/patient/onboarding/draft',
    headers: { cookie: cookies[key] },
    payload: {
      expectedVersion: 0,
      currentStep: 'SAFETY',
      draftResponses: onboardingDraft(direction),
    },
  });
  expect(save.statusCode).toBe(200);

  const submit = await app.inject({
    method: 'POST',
    url: '/api/v1/patient/onboarding/submit',
    headers: {
      cookie: cookies[key],
      'idempotency-key': randomUUID(),
    },
    payload: { expectedVersion: save.json().version },
  });
  expect(submit.statusCode).toBe(200);

  const revisionId = submit.json<{ revisionId: string }>().revisionId;
  expect(revisionId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  return revisionId;
}

async function evaluateInitialSafety(key: PatientKey, input: SafetyInput) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/patient/onboarding/safety-evaluations',
    headers: {
      cookie: cookies[key],
      'idempotency-key': randomUUID(),
    },
    payload: input,
  });
  expect(response.statusCode).toBe(200);
  return SafetyEvaluationResponseSchema.parse(response.json());
}

function diagnosticError(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const prismaLike = error as Error & { code?: unknown; meta?: unknown };
  return JSON.stringify(
    {
      name: error.name,
      message: error.message,
      code: prismaLike.code ?? null,
      meta: prismaLike.meta ?? null,
      stack: error.stack ?? null,
    },
    null,
    2,
  );
}

async function diagnoseCompletionFailure(
  key: PatientKey,
  revisionId: string,
  expectedReductionSetupVersion?: number,
) {
  const rollbackMarker = `DIAGNOSTIC_ROLLBACK_${randomUUID()}`;
  try {
    await prisma.$transaction(async (tx) => {
      await completePatientOnboarding({
        tx,
        config,
        clock,
        patientId: ids[key],
        actorId: ids[key],
        requestId: randomUUID(),
        authoritativeOnboardingRevisionId: revisionId,
        ...(expectedReductionSetupVersion !== undefined
          ? { expectedReductionSetupVersion }
          : {}),
      });
      throw new Error(rollbackMarker);
    });
  } catch (error) {
    if (error instanceof Error && error.message === rollbackMarker) {
      throw new Error(
        'The onboarding service completed successfully in rollback-only diagnostic mode, but the HTTP/idempotency path returned 500. Inspect executeIdempotently/idempotency persistence.',
      );
    }
    throw new Error(
      `The onboarding completion HTTP request returned 500. Direct service diagnostic:
${diagnosticError(error)}`,
    );
  }
}

async function completeOnboarding(
  key: PatientKey,
  revisionId: string,
  options: {
    expectedReductionSetupVersion?: number;
    idempotencyKey?: string;
  } = {},
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/patient/onboarding/complete',
    headers: {
      cookie: cookies[key],
      'idempotency-key': options.idempotencyKey ?? randomUUID(),
    },
    payload: {
      authoritativeOnboardingRevisionId: revisionId,
      ...(options.expectedReductionSetupVersion === undefined
        ? {}
        : {
            expectedReductionSetupVersion:
              options.expectedReductionSetupVersion,
          }),
    },
  });
  if (response.statusCode !== 200) {
    await diagnoseCompletionFailure(
      key,
      revisionId,
      options.expectedReductionSetupVersion,
    );
    throw new Error(
      `Unexpected onboarding completion response ${response.statusCode}: ${response.body}`,
    );
  }
  return CompleteOnboardingResponseSchema.parse(response.json());
}

async function clinicianMutation(
  caseId: string,
  endpoint: string,
  payload: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/clinician/safety-cases/${caseId}/${endpoint}`,
    headers: {
      cookie: cookies.clinician,
      'idempotency-key': randomUUID(),
    },
    payload,
  });
}

async function seedConfirmedReductionPlan(patientId: string) {
  const baselineRevisionId = randomUUID();
  const baselineStart = new Date('2026-07-23T00:00:00.000Z');
  const baselineEnd = new Date('2026-08-19T00:00:00.000Z');
  const now = clock.now();

  await prisma.reductionBaselineRevision.create({
    data: {
      id: baselineRevisionId,
      patientId,
      revision: 1,
      lifecycle: 'DRAFT',
      baselineStart,
      baselineEnd,
      monitoringTimezone: 'UTC',
      thresholdProfile: 'LOWER_THRESHOLD',
      thresholdProfileSource: 'PROFILE_UNAVAILABLE_DEFAULT_LOWER',
      unitPolicyVersion: '1.0',
      createdAt: now,
      createdByUserId: patientId,
      provenance: {
        source: 'INTEGRATION_FIXTURE',
        purpose: 'PHASE_3_ACTIVATION_CLOSEOUT',
      },
    },
  });

  await prisma.reductionBaselineDay.createMany({
    data: Array.from({ length: 28 }, (_, index) => ({
      id: randomUUID(),
      baselineRevisionId,
      localDate: new Date(
        baselineStart.getTime() + index * 24 * 60 * 60 * 1000,
      ),
      status: 'KNOWN_QUANTITY' as const,
      standardDrinks: '2.0000',
      ethanolGrams: '28.0000',
      source: 'PATIENT_RECALL',
      unitPolicyVersion: '1.0',
      createdAt: now,
      updatedByUserId: patientId,
    })),
  });

  await prisma.reductionBaselineRevision.update({
    where: { id: baselineRevisionId },
    data: {
      lifecycle: 'CONFIRMED',
      baselineTotalStandardDrinks28d: '56.0000',
      baselineTotalEthanolGrams28d: '784.0000',
      baselineDrinkingDays28d: 28,
      baselineHeavyDrinkingDays28d: 0,
      baselineMaxStandardDrinksDay: '2.0000',
      baselineAverageDrinksPerDrinkingDay: '2.0000',
      baselineAverageWeeklyDrinks: '14.0000',
      confirmedAt: now,
      confirmedByUserId: patientId,
    },
  });

  const setup = await prisma.reductionSetupState.create({
    data: {
      patientId,
      version: 1,
      authoritativeBaselineRevisionId: baselineRevisionId,
      proposalKind: 'REDUCTION',
      targetWeeklyStandardDrinks: '7.0000',
      proposalBaselineRevisionId: baselineRevisionId,
      proposalUpdatedAt: now,
      proposalUpdatedByUserId: patientId,
      createdAt: now,
      createdByUserId: patientId,
      updatedByUserId: patientId,
    },
  });

  return {
    baselineRevisionId,
    setupVersion: setup.version,
  };
}

beforeAll(async () => {
  await Promise.all([
    createIdentity('clinician', 'Activation Clinician'),
    createIdentity('unsure', 'Activation Unsure Patient'),
    createIdentity('reduction', 'Activation Reduction Patient'),
    createIdentity('handoff', 'Activation Handoff Patient'),
  ]);

  await prisma.applicationAccount.createMany({
    data: [
      {
        userId: ids.clinician,
        state: 'ACTIVE',
        createdByUserId: ids.clinician,
        privilegedIdentityVerifiedAt: new Date('2026-08-19T00:00:00.000Z'),
      },
      ...(['unsure', 'reduction', 'handoff'] as const).map((key) => ({
        userId: ids[key],
        state: 'ACTIVE' as const,
        createdByUserId: ids.clinician,
      })),
    ],
  });

  await prisma.userRoleAssignment.createMany({
    data: [
      {
        userId: ids.clinician,
        workspace: 'CLINICIAN',
        role: 'CLINICIAN',
        grantedByUserId: ids.clinician,
        grantReason: 'Activation integration fixture',
      },
      ...(['unsure', 'reduction', 'handoff'] as const).map((key) => ({
        userId: ids[key],
        workspace: 'PATIENT' as const,
        role: 'PATIENT' as const,
        grantedByUserId: ids.clinician,
        grantReason: 'Activation integration fixture',
      })),
    ],
  });

  for (const key of ['unsure', 'reduction', 'handoff'] as const) {
    await prisma.patientProfile.create({
      data: {
        patientId: ids[key],
        monitoringTimezone: 'UTC',
        createdByUserId: ids.clinician,
        updatedByUserId: ids.clinician,
        preferences: {
          create: { version: 1, createdByUserId: ids.clinician },
        },
        processingLock: { create: {} },
      },
    });
  }

  await prisma.clinicianPatientAssignment.create({
    data: {
      clinicianUserId: ids.clinician,
      patientId: ids.reduction,
      assignedByUserId: ids.clinician,
      assignmentReason: 'Activation safety-review fixture',
    },
  });

  await app.ready();

  cookies.clinician = await signIn('clinician');
  cookies.unsure = await signIn('unsure');
  cookies.reduction = await signIn('reduction');
  cookies.handoff = await signIn('handoff');
}, 30_000);

afterAll(async () => {
  // Safety history is append-only. Unique fixture identities let the suite avoid
  // weakening immutability triggers or requiring destructive cleanup.
  await app.close();
  await prisma.$disconnect();
});

describe('safety-gated onboarding activation', () => {
  it('activates UNSURE at the next complete Monday boundary and replays idempotently', async () => {
    const revisionId = await submitOnboarding('unsure', 'UNSURE');
    const initialSafety = await evaluateInitialSafety('unsure', safeInput);
    expect(initialSafety.safety.safetyState).toBe('MONITORING_AVAILABLE');

    const idempotencyKey = randomUUID();
    const completed = await completeOnboarding('unsure', revisionId, {
      idempotencyKey,
    });
    const replay = await completeOnboarding('unsure', revisionId, {
      idempotencyKey,
    });

    expect(replay).toEqual(completed);
    expect(completed).toMatchObject({
      completionStatus: 'COMPLETE',
      scheduleState: 'ACTIVATED',
      recoveryGoal: {
        goal: 'UNSURE',
        status: 'ACTIVE',
        baselineRevisionId: null,
        targetWeeklyStandardDrinks: null,
      },
      safety: {
        safetyState: 'MONITORING_AVAILABLE',
      },
    });

    const goal = await prisma.recoveryGoalVersion.findFirstOrThrow({
      where: { patientId: ids.unsure, status: 'ACTIVE' },
    });
    expect(goal.effectiveFromPeriodId).not.toBeNull();

    const effectivePeriod = await prisma.scheduledPeriod.findUniqueOrThrow({
      where: { id: goal.effectiveFromPeriodId! },
    });
    expect(effectivePeriod.periodStartAt.toISOString()).toBe(
      '2026-08-24T00:00:00.000Z',
    );
    expect(
      await prisma.recoveryGoalVersion.count({
        where: { patientId: ids.unsure },
      }),
    ).toBe(1);
    expect(
      await prisma.monitoringScheduleVersion.count({
        where: { patientId: ids.unsure, lifecycle: 'ACTIVE' },
      }),
    ).toBe(1);
  });

  it('holds a prolonged-heavy major reduction for S2 review, then activates the same goal without reevaluating after clinician clearance', async () => {
    const revisionId = await submitOnboarding('reduction', 'REDUCTION');
    const initialSafety = await evaluateInitialSafety('reduction', {
      ...safeInput,
      similarHeavyRegularUseAtLeast3Months: 'YES',
    });
    expect(initialSafety.safety.safetyState).toBe('MONITORING_AVAILABLE');

    const { baselineRevisionId, setupVersion } =
      await seedConfirmedReductionPlan(ids.reduction);

    const evaluationsBeforeActivation =
      await prisma.safetyEvaluationResult.count({
        where: { patientId: ids.reduction },
      });
    expect(evaluationsBeforeActivation).toBe(1);

    const pending = await completeOnboarding('reduction', revisionId, {
      expectedReductionSetupVersion: setupVersion,
    });

    expect(pending).toMatchObject({
      completionStatus: 'PENDING_SAFETY_REVIEW',
      scheduleState: 'ACTIVATED',
      recoveryGoal: {
        goal: 'REDUCTION',
        status: 'PENDING_CLINICAL_SAFETY_REVIEW',
        baselineRevisionId,
        targetWeeklyStandardDrinks: 7,
      },
      safety: {
        safetyState: 'REVIEW_REQUIRED',
        monitoringPromptPolicy: 'CONTINUE',
        goalChangeAllowed: false,
      },
    });

    expect(
      await prisma.safetyEvaluationResult.count({
        where: { patientId: ids.reduction },
      }),
    ).toBe(2);

    const activationInput = await prisma.safetyInputRevision.findFirstOrThrow({
      where: { patientId: ids.reduction },
      orderBy: { revision: 'desc' },
    });
    expect(activationInput.trigger).toBe('ACTIVATION');

    const activationEvaluation =
      await prisma.safetyEvaluationResult.findFirstOrThrow({
        where: {
          patientId: ids.reduction,
          safetyInputRevisionId: activationInput.id,
        },
      });
    expect(activationEvaluation.severity).toBe('S2_PRIORITY');
    expect(activationEvaluation.gateStatus).toBe('ALLOW_WITH_HANDOFF');
    expect(activationEvaluation.reasonCodes).toEqual(
      expect.arrayContaining([
        'PROLONGED_HEAVY_REGULAR_USE_WITH_PLANNED_MAJOR_REDUCTION',
      ]),
    );
    expect(activationEvaluation.contextSnapshot).toMatchObject({
      plannedDirection: 'REDUCTION',
      baselineAverageWeeklyDrinks: 14,
      targetWeeklyDrinks: 7,
      canonicalProlongedHeavyRegularUse: true,
    });

    const pendingGoal = await prisma.recoveryGoalVersion.findFirstOrThrow({
      where: {
        patientId: ids.reduction,
        status: 'PENDING_CLINICAL_SAFETY_REVIEW',
      },
    });
    expect(pendingGoal.effectiveFromPeriodId).toBeNull();

    const safetyCase = await prisma.safetyCase.findFirstOrThrow({
      where: { patientId: ids.reduction, resolvedAt: null },
    });
    expect(safetyCase.severity).toBe('S2_PRIORITY');
    expect(safetyCase.gateStatus).toBe('ALLOW_WITH_HANDOFF');

    for (const endpoint of ['acknowledge', 'begin-review', 'establish-plan']) {
      const current = await prisma.safetyCase.findUniqueOrThrow({
        where: { id: safetyCase.id },
      });
      const mutation = await clinicianMutation(safetyCase.id, endpoint, {
        expectedVersion: current.version,
        reason: `Activation fixture ${endpoint}`,
      });
      expect(mutation.statusCode).toBe(200);
    }

    const planned = await prisma.safetyCase.findUniqueOrThrow({
      where: { id: safetyCase.id },
    });
    expect(planned.lifecycle).toBe('PLAN_ESTABLISHED');

    const cleared = await clinicianMutation(safetyCase.id, 'disposition', {
      expectedVersion: planned.version,
      disposition: 'SAFE_TO_CONTINUE_STANDARD_MONITORING',
      reason:
        'Activation fixture authorizes standard monitoring and goal change.',
    });
    expect(cleared.statusCode).toBe(200);

    const completed = await completeOnboarding('reduction', revisionId, {
      expectedReductionSetupVersion: setupVersion,
    });

    expect(completed).toMatchObject({
      completionStatus: 'COMPLETE',
      scheduleState: 'ACTIVATED',
      recoveryGoal: {
        id: pendingGoal.id,
        goal: 'REDUCTION',
        status: 'ACTIVE',
        baselineRevisionId,
        targetWeeklyStandardDrinks: 7,
      },
      safety: {
        safetyState: 'MONITORING_AVAILABLE',
        monitoringPromptPolicy: 'CONTINUE',
        goalChangeAllowed: true,
      },
    });

    expect(
      await prisma.safetyEvaluationResult.count({
        where: { patientId: ids.reduction },
      }),
    ).toBe(2);
    expect(
      await prisma.recoveryGoalVersion.count({
        where: { patientId: ids.reduction },
      }),
    ).toBe(1);

    const activeGoal = await prisma.recoveryGoalVersion.findUniqueOrThrow({
      where: { id: pendingGoal.id },
    });
    expect(activeGoal.status).toBe('ACTIVE');
    expect(activeGoal.effectiveFromPeriodId).not.toBeNull();

    const effectivePeriod = await prisma.scheduledPeriod.findUniqueOrThrow({
      where: { id: activeGoal.effectiveFromPeriodId! },
    });
    expect(effectivePeriod.periodStartAt.toISOString()).toBe(
      '2026-08-24T00:00:00.000Z',
    );
  });

  it('suspends a handoff plan without creating a new monitoring schedule', async () => {
    const revisionId = await submitOnboarding('handoff', 'UNSURE');
    const initialSafety = await evaluateInitialSafety('handoff', {
      ...safeInput,
      currentSeizure: true,
    });
    expect(initialSafety.safety.safetyState).toBe('HANDOFF_REQUIRED');

    const completed = await completeOnboarding('handoff', revisionId);

    expect(completed).toMatchObject({
      completionStatus: 'SAFETY_HANDOFF',
      scheduleState: 'NOT_ACTIVATED',
      recoveryGoal: {
        goal: 'UNSURE',
        status: 'SUSPENDED_SAFETY_HANDOFF',
        effectiveFromPeriodId: null,
      },
      safety: {
        safetyState: 'HANDOFF_REQUIRED',
        monitoringPromptPolicy: 'PAUSE',
        goalChangeAllowed: false,
      },
    });

    expect(
      await prisma.monitoringScheduleVersion.count({
        where: { patientId: ids.handoff },
      }),
    ).toBe(0);
    expect(
      await prisma.recoveryGoalVersion.count({
        where: {
          patientId: ids.handoff,
          status: 'SUSPENDED_SAFETY_HANDOFF',
        },
      }),
    ).toBe(1);
  });
});
