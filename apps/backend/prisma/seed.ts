import { pathToFileURL } from 'node:url';

import { createAuth } from '../src/infrastructure/auth/auth.js';
import {
  loadRootEnvironment,
  parseConfig,
} from '../src/infrastructure/config/config.js';
import { createPrismaClient } from '../src/infrastructure/db/prisma.js';
import { UnavailableAuthEmailSender } from '../src/infrastructure/email/auth-email-sender.js';
import {
  AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
  AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
  AUD_WEEKLY_CHECKIN_SCALE_VERSION,
  AUD_WEEKLY_CHECKIN_WORDING_VERSION,
} from '../src/policy/instruments/aud-weekly-checkin-v1.js';

export const PROTOTYPE_IDENTITIES = {
  patient: {
    name: 'Prototype Patient',
    email: 'patient.demo@example.test',
    password: 'DemoPatient!2026',
  },
  clinician: {
    name: 'Prototype Clinician',
    email: 'clinician.demo@example.test',
    password: 'DemoClinician!2026',
  },
  admin: {
    name: 'Prototype Administrator',
    email: 'admin.demo@example.test',
    password: 'DemoAdmin!2026',
  },
} as const;

type PrototypeIdentity = {
  name: string;
  email: string;
  password: string;
};

const PROTOTYPE_ENGAGEMENT_SCENARIOS = [
  {
    key: 'upcoming',
    idSuffix: '000000000001',
    label: 'Upcoming check-in',
    identity: {
      name: 'Demo Patient · Upcoming',
      email: 'engagement.upcoming@example.test',
      password: 'DemoEngagement!2026',
    },
    dueOffsetDays: 2,
    technicalFailure: false,
  },
  {
    key: 'overdue',
    idSuffix: '000000000002',
    label: 'Overdue before reminder',
    identity: {
      name: 'Demo Patient · Overdue',
      email: 'engagement.overdue@example.test',
      password: 'DemoEngagement!2026',
    },
    dueOffsetDays: -2,
    technicalFailure: false,
  },
  {
    key: 'first-reminder',
    idSuffix: '000000000003',
    label: 'First reminder eligible',
    identity: {
      name: 'Demo Patient · First Reminder',
      email: 'engagement.first-reminder@example.test',
      password: 'DemoEngagement!2026',
    },
    dueOffsetDays: -8,
    technicalFailure: false,
  },
  {
    key: 'at-risk',
    idSuffix: '000000000004',
    label: 'Final reminder eligible',
    identity: {
      name: 'Demo Patient · At Risk',
      email: 'engagement.at-risk@example.test',
      password: 'DemoEngagement!2026',
    },
    dueOffsetDays: -16,
    technicalFailure: false,
  },
  {
    key: 'disengaged',
    idSuffix: '000000000005',
    label: 'Disengaged outreach case',
    identity: {
      name: 'Demo Patient · Outreach',
      email: 'engagement.outreach@example.test',
      password: 'DemoEngagement!2026',
    },
    dueOffsetDays: -32,
    technicalFailure: false,
  },
  {
    key: 'technical',
    idSuffix: '000000000006',
    label: 'Confirmed technical pause',
    identity: {
      name: 'Demo Patient · Technical Pause',
      email: 'engagement.technical@example.test',
      password: 'DemoEngagement!2026',
    },
    dueOffsetDays: -10,
    technicalFailure: true,
  },
] as const;

const DAY_MS = 24 * 60 * 60 * 1_000;

const PROTOTYPE_CONTENT_CLASSES = [
  {
    key: 'CRAVING_COPING_SUPPORT',
    volume: 3,
    label: 'Working through cravings',
  },
  { key: 'SELF_EFFICACY_SUPPORT', volume: 3, label: 'Building confidence' },
  {
    key: 'MOOD_COPING_SUPPORT',
    volume: 3,
    label: 'Managing difficult emotions',
  },
  {
    key: 'TRIGGER_MANAGEMENT_SUPPORT',
    volume: 3,
    label: 'Handling difficult situations',
  },
  {
    key: 'RELATIONSHIP_COPING_SUPPORT',
    volume: 2,
    label: 'Navigating relationships',
  },
  {
    key: 'SOCIAL_SUPPORT_ACTIVATION',
    volume: 2,
    label: 'Connecting with support',
  },
  {
    key: 'USE_EVENT_RECOVERY_SUPPORT',
    volume: 2,
    label: 'Next steps after alcohol use',
  },
  {
    key: 'RECURRENT_USE_RECOVERY_SUPPORT',
    volume: 2,
    label: 'Reviewing your recovery plan',
  },
  {
    key: 'RECOVERY_PLAN_REVIEW',
    volume: 2,
    label: 'Reviewing your support plan',
  },
  {
    key: 'POSITIVE_REINFORCEMENT',
    volume: 2,
    label: 'Recognizing what is working',
  },
] as const;

const PROTOTYPE_CONTENT_EFFECTIVE_FROM = new Date('2026-01-01T00:00:00.000Z');

async function seedPrototypeContent(
  prisma: ReturnType<typeof createPrismaClient>,
  adminUserId: string,
) {
  let resourceNumber = 0;
  for (const contentClass of PROTOTYPE_CONTENT_CLASSES) {
    for (let version = 1; version <= contentClass.volume; version += 1) {
      resourceNumber += 1;
      const resourceId = `00000000-0000-4500-8000-${String(resourceNumber).padStart(12, '0')}`;
      const resource = await prisma.contentResource.upsert({
        where: { id: resourceId },
        create: {
          id: resourceId,
          interventionClass: contentClass.key,
          createdByUserId: adminUserId,
        },
        update: { interventionClass: contentClass.key },
      });
      const existingVersion = await prisma.contentResourceVersion.findUnique({
        where: {
          resourceId_version: { resourceId: resource.id, version },
        },
      });
      if (!existingVersion) {
        await prisma.contentResourceVersion.create({
          data: {
            resourceId: resource.id,
            version,
            interventionClass: contentClass.key,
            locale: 'en-US',
            language: 'en',
            recoveryGoalsAllowed: ['ABSTINENCE', 'REDUCTION', 'UNSURE'],
            deliveryChannels: ['IN_APP'],
            mutualHelpRequirement: 'ANY',
            spiritualRequirement: 'ANY',
            contraindications: [],
            safetyGateCompatibility: ['ALLOW_MONITORING', 'ALLOW_WITH_HANDOFF'],
            estimatedDurationSeconds: 120,
            title: `${contentClass.label} ${version}`,
            markdownBody: `A short, practical reflection for ${contentClass.label.toLowerCase()}.\n\nChoose one small step that feels realistic today.`,
            reviewStatus: 'APPROVED',
            reviewedByUserId: adminUserId,
            reviewedAt: PROTOTYPE_CONTENT_EFFECTIVE_FROM,
            effectiveFrom: PROTOTYPE_CONTENT_EFFECTIVE_FROM,
            enabled: true,
            provenance: {
              mode: 'prototype',
              source: 'deterministic_phase5_seed',
              resourceNumber,
            },
          },
        });
      }
    }
  }
}

async function seedPrototypeGovernanceExamples(
  prisma: ReturnType<typeof createPrismaClient>,
  adminUserId: string,
) {
  const examples = [
    {
      resourceId: '00000000-0000-4900-8000-000000000001',
      versionId: '00000000-0000-4910-8000-000000000001',
      interventionClass: 'CRAVING_COPING_SUPPORT' as const,
      title: 'Draft · A small step through a craving',
      status: 'DRAFT' as const,
    },
    {
      resourceId: '00000000-0000-4900-8000-000000000002',
      versionId: '00000000-0000-4910-8000-000000000002',
      interventionClass: 'MOOD_COPING_SUPPORT' as const,
      title: 'In review · Naming the difficult moment',
      status: 'UNDER_REVIEW' as const,
    },
    {
      resourceId: '00000000-0000-4900-8000-000000000003',
      versionId: '00000000-0000-4910-8000-000000000003',
      interventionClass: 'POSITIVE_REINFORCEMENT' as const,
      title: 'Retired · Notice what helped',
      status: 'RETIRED' as const,
    },
  ];
  for (const example of examples) {
    await prisma.contentResource.upsert({
      where: { id: example.resourceId },
      create: {
        id: example.resourceId,
        interventionClass: example.interventionClass,
        createdByUserId: adminUserId,
      },
      update: {},
    });
    const existingVersion = await prisma.contentResourceVersion.findUnique({
      where: {
        resourceId_version: { resourceId: example.resourceId, version: 1 },
      },
    });
    if (!existingVersion) {
      await prisma.contentResourceVersion.create({
        data: {
          id: example.versionId,
          resourceId: example.resourceId,
          version: 1,
          interventionClass: example.interventionClass,
          locale: 'en-US',
          language: 'en',
          recoveryGoalsAllowed: ['ABSTINENCE', 'REDUCTION', 'UNSURE'],
          deliveryChannels: ['IN_APP'],
          mutualHelpRequirement: 'ANY',
          spiritualRequirement: 'ANY',
          contraindications: [],
          safetyGateCompatibility: ['ALLOW_MONITORING', 'ALLOW_WITH_HANDOFF'],
          estimatedDurationSeconds: 120,
          title: example.title,
          markdownBody: `# ${example.title}\n\nA governed local-demo resource with an explicit lifecycle and a safe preview.`,
          reviewStatus: example.status,
          reviewedByUserId: example.status === 'RETIRED' ? adminUserId : null,
          reviewedAt:
            example.status === 'RETIRED'
              ? PROTOTYPE_CONTENT_EFFECTIVE_FROM
              : null,
          effectiveFrom: PROTOTYPE_CONTENT_EFFECTIVE_FROM,
          retiredAt: example.status === 'RETIRED' ? new Date() : null,
          enabled: example.status !== 'RETIRED',
          provenance: {
            mode: 'prototype',
            source: 'phase7_governance_showcase',
          },
        },
      });
    }
  }
}

async function seedEngagementScenario(
  prisma: ReturnType<typeof createPrismaClient>,
  auth: ReturnType<typeof createAuth>,
  adminUserId: string,
  clinicianUserId: string,
  scenario: (typeof PROTOTYPE_ENGAGEMENT_SCENARIOS)[number],
) {
  const existing = await prisma.user.findUnique({
    where: { email: scenario.identity.email },
  });
  const patient = existing
    ? existing
    : (
        await auth.api.signUpEmail({
          body: {
            name: scenario.identity.name,
            email: scenario.identity.email,
            password: scenario.identity.password,
          },
        })
      ).user;
  await prisma.user.update({
    where: { id: patient.id },
    data: { emailVerified: true, name: scenario.identity.name },
  });
  await prisma.applicationAccount.upsert({
    where: { userId: patient.id },
    create: {
      userId: patient.id,
      state: 'ACTIVE',
      createdByUserId: adminUserId,
    },
    update: { state: 'ACTIVE' },
  });
  const role = await prisma.userRoleAssignment.findFirst({
    where: {
      userId: patient.id,
      workspace: 'PATIENT',
      role: 'PATIENT',
      revokedAt: null,
    },
  });
  if (!role) {
    await prisma.userRoleAssignment.create({
      data: {
        userId: patient.id,
        workspace: 'PATIENT',
        role: 'PATIENT',
        grantedByUserId: adminUserId,
        grantReason: 'Deterministic Phase 6 engagement demo scenario',
      },
    });
  }
  await prisma.patientProfile.upsert({
    where: { patientId: patient.id },
    create: {
      patientId: patient.id,
      monitoringTimezone: 'UTC',
      createdByUserId: adminUserId,
      updatedByUserId: adminUserId,
    },
    update: { monitoringTimezone: 'UTC', updatedByUserId: adminUserId },
  });
  await prisma.profilePreferenceVersion.upsert({
    where: { patientId_version: { patientId: patient.id, version: 1 } },
    create: {
      patientId: patient.id,
      version: 1,
      mutualHelpPreference: null,
      spiritualContentPreference: null,
      createdByUserId: adminUserId,
    },
    update: {},
  });
  await prisma.patientProcessingLock.upsert({
    where: { patientId: patient.id },
    create: { patientId: patient.id },
    update: {},
  });
  const assignment = await prisma.clinicianPatientAssignment.findFirst({
    where: { clinicianUserId, patientId: patient.id, endedAt: null },
  });
  if (!assignment) {
    await prisma.clinicianPatientAssignment.create({
      data: {
        clinicianUserId,
        patientId: patient.id,
        assignedByUserId: adminUserId,
        assignmentReason: 'Deterministic Phase 6 engagement demo scenario',
      },
    });
  }

  const now = new Date();
  const effectiveDueAt = new Date(
    now.getTime() + scenario.dueOffsetDays * DAY_MS,
  );
  // Scheduled-period facts are historical and the database enforces the
  // one-day gap between open_at and original_due_at. Keep the demo period
  // geometrically valid before the effective due-time offset is applied.
  const openAt = new Date(effectiveDueAt.getTime() - DAY_MS);
  const periodEndAt = openAt;
  const periodStartAt = new Date(periodEndAt.getTime() - 7 * DAY_MS);
  const scheduleId = `00000000-0000-4600-8000-${scenario.idSuffix}`;
  const periodId = `00000000-0000-4610-8000-${scenario.idSuffix}`;
  const schedule = await prisma.monitoringScheduleVersion.findUnique({
    where: { id: scheduleId },
  });
  if (!schedule) {
    await prisma.monitoringScheduleVersion.create({
      data: {
        id: scheduleId,
        patientId: patient.id,
        version: 1,
        monitoringTimezone: 'UTC',
        effectiveBoundary: periodStartAt,
        lifecycle: 'ACTIVE',
        createdByUserId: adminUserId,
        provenance: 'phase6_deterministic_engagement_demo',
      },
    });
  }
  let period = await prisma.scheduledPeriod.findUnique({
    where: { id: periodId },
  });
  if (!period) {
    period = await prisma.scheduledPeriod.create({
      data: {
        id: periodId,
        patientId: patient.id,
        scheduleVersionId: scheduleId,
        monitoringTimezone: 'UTC',
        periodStartAt,
        periodEndAt,
        openAt,
        originalDueAt: effectiveDueAt,
        effectiveDueAt,
        version: 1,
      },
    });
  }
  if (scenario.technicalFailure) {
    const failureId = `00000000-0000-4700-8000-${scenario.idSuffix}`;
    await prisma.technicalFailure.upsert({
      where: { id: failureId },
      create: {
        id: failureId,
        patientId: patient.id,
        failureType: 'ASSESSMENT_ACCESS_UNAVAILABLE',
        affectedScope: { kind: 'PATIENT', patientId: patient.id },
        startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1_000),
        evidence: {
          summary: `${scenario.label}: deterministic local demo evidence`,
        },
        status: 'CONFIRMED',
        confirmedBy: adminUserId,
        confirmedAt: now,
        reason: 'Deterministic Phase 6 local demonstration scenario',
        sourcePeriodId: period.id,
        previousEffectiveDueAt: period.effectiveDueAt,
      },
      update: {
        patientId: patient.id,
        startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1_000),
        evidence: {
          summary: `${scenario.label}: deterministic local demo evidence`,
        },
        status: 'CONFIRMED',
        confirmedBy: adminUserId,
        confirmedAt: now,
        reason: 'Deterministic Phase 6 local demonstration scenario',
        sourcePeriodId: period.id,
        previousEffectiveDueAt: period.effectiveDueAt,
      },
    });
  }
}

async function seedPrototypeLongitudinalShowcase(
  prisma: ReturnType<typeof createPrismaClient>,
  patientId: string,
  adminUserId: string,
) {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const scheduleId = '00000000-0000-4800-8000-000000000001';
  const schedule = await prisma.monitoringScheduleVersion.upsert({
    where: { id: scheduleId },
    create: {
      id: scheduleId,
      patientId,
      version: 1,
      monitoringTimezone: 'UTC',
      effectiveBoundary: new Date(now.getTime() - 8 * 7 * DAY_MS),
      lifecycle: 'ACTIVE',
      createdByUserId: adminUserId,
      provenance: 'phase7_deterministic_longitudinal_showcase',
    },
    update: {},
  });

  const periods: Array<{ id: string; periodStartAt: Date; periodEndAt: Date }> =
    [];
  for (let index = 0; index < 8; index += 1) {
    const periodStartAt = new Date(now.getTime() - (8 - index) * 7 * DAY_MS);
    const periodEndAt = new Date(periodStartAt.getTime() + 7 * DAY_MS);
    const periodId = `00000000-0000-4810-8000-${String(index + 1).padStart(12, '0')}`;
    const period = await prisma.scheduledPeriod.upsert({
      where: { id: periodId },
      create: {
        id: periodId,
        patientId,
        scheduleVersionId: schedule.id,
        monitoringTimezone: 'UTC',
        periodStartAt,
        periodEndAt,
        openAt: periodEndAt,
        originalDueAt: new Date(periodEndAt.getTime() + DAY_MS),
        effectiveDueAt: new Date(periodEndAt.getTime() + DAY_MS),
        version: 1,
      },
      update: {},
    });
    periods.push({
      id: period.id,
      periodStartAt: period.periodStartAt,
      periodEndAt: period.periodEndAt,
    });
  }

  const existingSafetyInput = await prisma.safetyInputRevision.findFirst({
    where: { patientId, trigger: 'PHASE7_SHOWCASE' },
  });
  const safetyInput =
    existingSafetyInput ??
    (await prisma.safetyInputRevision.create({
      data: {
        patientId,
        revision: 1,
        inputSnapshot: { source: 'phase7_showcase' },
        instrument: 'AUD_SAFETY',
        instrumentVersion: '1.0',
        instrumentSource: 'PHASE7_SHOWCASE',
        schemaVersion: 'safety_v1',
        trigger: 'PHASE7_SHOWCASE',
        actorId: patientId,
        submittedAt: now,
      },
    }));
  const existingSafetyEvaluation =
    await prisma.safetyEvaluationResult.findFirst({
      where: { safetyInputRevisionId: safetyInput.id },
    });
  const safetyEvaluation =
    existingSafetyEvaluation ??
    (await prisma.safetyEvaluationResult.create({
      data: {
        patientId,
        safetyInputRevisionId: safetyInput.id,
        severity: 'S_NONE',
        gateStatus: 'ALLOW_MONITORING',
        reasonCodes: [],
        clinicianContext: false,
        allowedSubjectiveInterventions: [
          'CRAVING_COPING_SUPPORT',
          'SELF_EFFICACY_SUPPORT',
          'MOOD_COPING_SUPPORT',
          'TRIGGER_MANAGEMENT_SUPPORT',
          'RELATIONSHIP_COPING_SUPPORT',
          'SOCIAL_SUPPORT_ACTIVATION',
          'USE_EVENT_RECOVERY_SUPPORT',
          'RECURRENT_USE_RECOVERY_SUPPORT',
          'RECOVERY_PLAN_REVIEW',
          'POSITIVE_REINFORCEMENT',
        ],
        monitoringPromptPolicy: 'CONTINUE',
        goalChangeAllowed: true,
        evaluatorVersion: 'phase7-showcase',
        configurationVersion: 'phase7-showcase',
        evaluatedAt: now,
        resultSnapshot: { source: 'phase7_showcase' },
      },
    }));
  const onboardingRevision = await prisma.onboardingRevision.upsert({
    where: { patientId_revision: { patientId, revision: 1 } },
    create: {
      patientId,
      revision: 1,
      sourceDraftVersion: 1,
      responseSnapshot: { source: 'phase7_showcase', completed: true },
      auditCInstrument: 'AUDIT_C',
      auditCVersion: '1.0',
      auditCSource: 'PHASE7_SHOWCASE',
      schemaVersion: 'onboarding_v1',
      submittingActorId: patientId,
      submittedAt: now,
    },
    update: {},
  });
  await prisma.patientOnboardingState.upsert({
    where: { patientId },
    create: {
      patientId,
      version: 1,
      currentStep: 'COMPLETE',
      draftResponses: { source: 'phase7_showcase' },
      authoritativeRevisionId: onboardingRevision.id,
      completionStatus: 'COMPLETE',
      completionSafetyEvaluationResultId: safetyEvaluation.id,
      completedAt: now,
      completedByUserId: patientId,
      createdByUserId: adminUserId,
      updatedByUserId: adminUserId,
    },
    update: {
      authoritativeRevisionId: onboardingRevision.id,
      completionStatus: 'COMPLETE',
      completionSafetyEvaluationResultId: safetyEvaluation.id,
      completedAt: now,
      completedByUserId: patientId,
      updatedByUserId: adminUserId,
    },
  });
  const goal = await prisma.recoveryGoalVersion.upsert({
    where: { patientId_goalVersion: { patientId, goalVersion: 1 } },
    create: {
      patientId,
      goalVersion: 1,
      goal: 'REDUCTION',
      status: 'ACTIVE',
      targetWeeklyStandardDrinks: 14,
      effectiveFromPeriodId: periods[0]!.id,
      setBy: 'PATIENT',
      sourceOnboardingRevisionId: onboardingRevision.id,
      sourceSafetyEvaluationResultId: safetyEvaluation.id,
      createdByUserId: adminUserId,
      updatedByUserId: adminUserId,
      provenance: { source: 'phase7_showcase' },
    },
    update: { status: 'ACTIVE', targetWeeklyStandardDrinks: 14 },
  });

  const answersFor = (index: number, corrected = false) => ({
    U1: true,
    R1: Math.min(7, 2 + Math.floor(index / 3)),
    R2: Math.max(1, 5 - Math.floor(index / 2)),
    R3: corrected ? 2 : Math.max(1, 6 - index),
    R4: Math.max(1, 4 - Math.floor(index / 2)),
    R5: Math.max(1, 3 - Math.floor(index / 3)),
    P1: Math.min(7, 2 + index),
    P2: Math.min(7, 1 + Math.floor(index / 2)),
    P3: Math.min(7, 1 + Math.floor(index / 3)),
    P4: Math.min(7, 2 + Math.floor(index / 2)),
    P5: Math.min(7, 2 + Math.floor(index / 2)),
  });
  const responseRows = (
    answers: Record<string, boolean | number>,
    partial: boolean,
  ) => {
    const items = [
      ['U1', 'alcohol_use_reported'],
      ['R1', 'sleep_difficulty'],
      ['R2', 'negative_mood'],
      ['R3', 'craving'],
      ['R4', 'risky_situations'],
      ['R5', 'relationship_problems'],
      ['P1', 'recovery_confidence'],
      ['P2', 'mutual_help_participation'],
      ['P3', 'spiritual_activity'],
      ['P4', 'productive_recreational_activity'],
      ['P5', 'family_friend_support'],
    ] as const;
    return items.flatMap(([itemId, itemKey], itemIndex) => {
      if (partial && itemIndex > 6) return [];
      const value = answers[itemId];
      return [
        {
          itemId,
          itemKey,
          ...(itemId === 'U1'
            ? { booleanValue: value as boolean }
            : { integerValue: value as number }),
          instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
          wordingVersion: AUD_WEEKLY_CHECKIN_WORDING_VERSION,
          scaleVersion: AUD_WEEKLY_CHECKIN_SCALE_VERSION,
        },
      ];
    });
  };

  for (let index = 0; index < periods.length; index += 1) {
    if (index === 1) continue;
    const partial = index === 3;
    const corrected = index === 6;
    const backfill = index === 2;
    const assessmentId = `00000000-0000-4820-8000-${String(index + 1).padStart(12, '0')}`;
    const assessment = await prisma.weeklyAssessment.upsert({
      where: {
        patientId_scheduledPeriodId_instrumentId_instrumentVersion: {
          patientId,
          scheduledPeriodId: periods[index]!.id,
          instrumentId: AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
          instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
        },
      },
      create: {
        id: assessmentId,
        patientId,
        scheduledPeriodId: periods[index]!.id,
        instrumentId: AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
        instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
        draftVersion: 1,
        draftCurrentStep: 'COMPLETE',
        draftAnswerSnapshot: answersFor(index),
        completionStatus: partial ? 'PARTIAL' : 'COMPLETE',
        createdByUserId: patientId,
        updatedByUserId: patientId,
      },
      update: {},
    });
    const classification = backfill
      ? 'HISTORICAL_BACKFILL'
      : corrected
        ? 'PATIENT_CORRECTION'
        : 'CURRENT';
    const firstRevisionId = `00000000-0000-4830-8000-${String(index + 1).padStart(12, '0')}`;
    const firstRevision = await prisma.assessmentRevision.upsert({
      where: { id: firstRevisionId },
      create: {
        id: firstRevisionId,
        assessmentId: assessment.id,
        revisionNumber: 1,
        completionStatus: partial ? 'PARTIAL' : 'COMPLETE',
        sourceDraftVersion: 1,
        submittedAt: new Date(
          periods[index]!.periodEndAt.getTime() + 2 * 60 * 60 * 1_000,
        ),
        submittedBy: 'PATIENT',
        submittedByUserId: patientId,
        submissionClassification: corrected ? 'CURRENT' : classification,
        instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
        wordingVersion: AUD_WEEKLY_CHECKIN_WORDING_VERSION,
        ruleSetVersion: 'phase7-showcase',
        configurationVersion: 'phase7-showcase',
        provenance: { source: 'phase7_showcase' },
        itemResponses: {
          create: responseRows(answersFor(index, false), partial),
        },
      },
      update: {},
    });
    let authoritativeRevision = firstRevision;
    if (corrected) {
      const correctionRevisionId = `00000000-0000-4840-8000-${String(index + 1).padStart(12, '0')}`;
      authoritativeRevision = await prisma.assessmentRevision.upsert({
        where: { id: correctionRevisionId },
        create: {
          id: correctionRevisionId,
          assessmentId: assessment.id,
          revisionNumber: 2,
          completionStatus: 'COMPLETE',
          sourceDraftVersion: 2,
          submittedAt: new Date(
            periods[index]!.periodEndAt.getTime() + 4 * 60 * 60 * 1_000,
          ),
          submittedBy: 'PATIENT',
          submittedByUserId: patientId,
          supersedesRevisionId: firstRevision.id,
          submissionClassification: 'PATIENT_CORRECTION',
          instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
          wordingVersion: AUD_WEEKLY_CHECKIN_WORDING_VERSION,
          ruleSetVersion: 'phase7-showcase',
          configurationVersion: 'phase7-showcase',
          provenance: { source: 'phase7_showcase', correction: true },
          itemResponses: {
            create: responseRows(answersFor(index, true), false),
          },
        },
        update: {},
      });
    }
    await prisma.weeklyAssessment.update({
      where: { id: assessment.id },
      data: { authoritativeRevisionId: authoritativeRevision.id },
    });
    if (!partial) {
      await prisma.weeklyConsumptionSummary.upsert({
        where: { assessmentRevisionId: authoritativeRevision.id },
        create: {
          patientId,
          scheduledPeriodId: periods[index]!.id,
          assessmentRevisionId: authoritativeRevision.id,
          recoveryGoalVersionId: goal.id,
          observedDayCount: 7,
          unknownDayCount: 0,
          coverageRatio: 1,
          knownStandardDrinksTotal: Math.max(4, 14 - index),
          completeWeekTotalStandardDrinks: Math.max(4, 14 - index),
          completeWeekEthanolGrams: Math.max(4, 14 - index) * 14,
          drinkingDays: Math.max(2, 5 - Math.floor(index / 2)),
          alcoholFreeDays: Math.min(7, 2 + Math.floor(index / 2)),
          averageDrinksPerDrinkingDay: 2,
          maximumDailyStandardDrinks: 4,
          heavyDrinkingDays: index < 3 ? 1 : 0,
          targetWeeklyStandardDrinks: 14,
          targetStatus: index >= 4 ? 'MET' : 'NOT_MET',
          baselineAverageWeeklyDrinks: 18,
          reductionFromBaselinePercent: Math.min(75, index * 7),
          whoWindowComplete: false,
        },
        update: {},
      });
    }
  }
}

export async function seedPrototype(environment: NodeJS.ProcessEnv) {
  const config = parseConfig(environment);
  if (config.appMode !== 'prototype') {
    throw new Error('Prototype seed is forbidden in real_patient mode.');
  }
  const prisma = createPrismaClient(config.databaseUrl);
  const auth = createAuth(prisma, config, new UnavailableAuthEmailSender(), {
    allowSignUpForFixtureCreation: true,
  });

  try {
    const ensureIdentity = async (identity: PrototypeIdentity) => {
      const existing = await prisma.user.findUnique({
        where: { email: identity.email },
      });
      if (existing) return existing;
      const created = await auth.api.signUpEmail({
        body: {
          name: identity.name,
          email: identity.email,
          password: identity.password,
        },
      });
      return prisma.user.update({
        where: { id: created.user.id },
        data: { emailVerified: true },
      });
    };

    const [patient, clinician, admin] = await Promise.all([
      ensureIdentity(PROTOTYPE_IDENTITIES.patient),
      ensureIdentity(PROTOTYPE_IDENTITIES.clinician),
      ensureIdentity(PROTOTYPE_IDENTITIES.admin),
    ]);

    for (const userId of [patient.id, clinician.id, admin.id]) {
      await prisma.applicationAccount.upsert({
        where: { userId },
        create: { userId, state: 'ACTIVE', createdByUserId: admin.id },
        update: { state: 'ACTIVE' },
      });
    }

    const roles = [
      { userId: patient.id, workspace: 'PATIENT', role: 'PATIENT' },
      { userId: clinician.id, workspace: 'CLINICIAN', role: 'CLINICIAN' },
      { userId: admin.id, workspace: 'ADMIN', role: 'ADMIN' },
    ] as const;
    for (const role of roles) {
      const existing = await prisma.userRoleAssignment.findFirst({
        where: { ...role, revokedAt: null },
      });
      if (!existing) {
        await prisma.userRoleAssignment.create({
          data: {
            ...role,
            grantedByUserId: admin.id,
            grantReason: 'Deterministic prototype seed',
          },
        });
      }
    }

    await prisma.patientProfile.upsert({
      where: { patientId: patient.id },
      create: {
        patientId: patient.id,
        monitoringTimezone: 'UTC',
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
      update: {},
    });
    await prisma.profilePreferenceVersion.upsert({
      where: {
        patientId_version: { patientId: patient.id, version: 1 },
      },
      create: {
        patientId: patient.id,
        version: 1,
        mutualHelpPreference: null,
        spiritualContentPreference: null,
        createdByUserId: admin.id,
      },
      update: {},
    });
    await prisma.patientProcessingLock.upsert({
      where: { patientId: patient.id },
      create: { patientId: patient.id },
      update: {},
    });

    const assignment = await prisma.clinicianPatientAssignment.findFirst({
      where: {
        clinicianUserId: clinician.id,
        patientId: patient.id,
        endedAt: null,
      },
    });
    if (!assignment) {
      await prisma.clinicianPatientAssignment.create({
        data: {
          clinicianUserId: clinician.id,
          patientId: patient.id,
          assignedByUserId: admin.id,
          assignmentReason: 'Deterministic prototype seed',
        },
      });
    }

    await seedPrototypeLongitudinalShowcase(prisma, patient.id, admin.id);

    for (const scenario of PROTOTYPE_ENGAGEMENT_SCENARIOS) {
      await seedEngagementScenario(
        prisma,
        auth,
        admin.id,
        clinician.id,
        scenario,
      );
    }

    await seedPrototypeContent(prisma, admin.id);
    await seedPrototypeGovernanceExamples(prisma, admin.id);
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  loadRootEnvironment();
  await seedPrototype(process.env);
}
