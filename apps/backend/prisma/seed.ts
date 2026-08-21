import { pathToFileURL } from 'node:url';

import { createAuth } from '../src/infrastructure/auth/auth.js';
import {
  loadRootEnvironment,
  parseConfig,
} from '../src/infrastructure/config/config.js';
import { createPrismaClient } from '../src/infrastructure/db/prisma.js';
import { UnavailableAuthEmailSender } from '../src/infrastructure/email/auth-email-sender.js';

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
      await prisma.contentResourceVersion.upsert({
        where: {
          resourceId_version: { resourceId: resource.id, version },
        },
        create: {
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
        update: {},
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
  const periodStartAt = new Date(effectiveDueAt.getTime() - 7 * DAY_MS);
  const scheduleId = `00000000-0000-4600-8000-${scenario.idSuffix}`;
  const periodId = `00000000-0000-4610-8000-${scenario.idSuffix}`;
  await prisma.monitoringScheduleVersion.upsert({
    where: { id: scheduleId },
    create: {
      id: scheduleId,
      patientId: patient.id,
      version: 1,
      monitoringTimezone: 'UTC',
      effectiveBoundary: periodStartAt,
      lifecycle: 'ACTIVE',
      createdByUserId: adminUserId,
      provenance: 'phase6_deterministic_engagement_demo',
    },
    update: {
      monitoringTimezone: 'UTC',
      effectiveBoundary: periodStartAt,
      lifecycle: 'ACTIVE',
      provenance: 'phase6_deterministic_engagement_demo',
    },
  });
  await prisma.scheduledPeriod.upsert({
    where: { id: periodId },
    create: {
      id: periodId,
      patientId: patient.id,
      scheduleVersionId: scheduleId,
      monitoringTimezone: 'UTC',
      periodStartAt,
      periodEndAt: effectiveDueAt,
      openAt: effectiveDueAt,
      originalDueAt: effectiveDueAt,
      effectiveDueAt,
      version: 1,
    },
    update: {
      scheduleVersionId: scheduleId,
      monitoringTimezone: 'UTC',
      periodStartAt,
      periodEndAt: effectiveDueAt,
      openAt: effectiveDueAt,
      originalDueAt: effectiveDueAt,
      effectiveDueAt,
    },
  });
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
        sourcePeriodId: periodId,
        previousEffectiveDueAt: effectiveDueAt,
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
        sourcePeriodId: periodId,
        previousEffectiveDueAt: effectiveDueAt,
      },
    });
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
