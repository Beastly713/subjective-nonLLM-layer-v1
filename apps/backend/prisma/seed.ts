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
    const ensureIdentity = async (
      identity: (typeof PROTOTYPE_IDENTITIES)[keyof typeof PROTOTYPE_IDENTITIES],
    ) => {
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
