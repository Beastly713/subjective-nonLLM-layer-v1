import { afterAll, describe, expect, it } from 'vitest';

import { PROTOTYPE_IDENTITIES, seedPrototype } from '../../prisma/seed.js';
import {
  loadRootEnvironment,
  parseTestDatabaseUrl,
} from '../../src/infrastructure/config/config.js';
import { createPrismaClient } from '../../src/infrastructure/db/prisma.js';

loadRootEnvironment();

const databaseUrl = parseTestDatabaseUrl(process.env);
const prisma = createPrismaClient(databaseUrl);
const seedEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  APP_MODE: 'prototype',
  LOG_LEVEL: 'silent',
  BETTER_AUTH_SECRET: 'prototype-seed-test-secret-at-least-32-characters',
  APP_BASE_URL: 'http://127.0.0.1:3000',
};

afterAll(async () => {
  await prisma.$disconnect();
});

describe('prototype identity seed', () => {
  it('is repeatable and creates only the locked synthetic access foundation', async () => {
    await seedPrototype(seedEnvironment);
    await seedPrototype(seedEnvironment);

    const patient = await prisma.user.findUniqueOrThrow({
      where: { email: PROTOTYPE_IDENTITIES.patient.email },
    });
    const clinician = await prisma.user.findUniqueOrThrow({
      where: { email: PROTOTYPE_IDENTITIES.clinician.email },
    });
    expect(
      await prisma.user.count({
        where: {
          email: {
            in: Object.values(PROTOTYPE_IDENTITIES).map(({ email }) => email),
          },
        },
      }),
    ).toBe(3);
    expect(
      await prisma.patientProfile.count({ where: { patientId: patient.id } }),
    ).toBe(1);
    expect(
      await prisma.profilePreferenceVersion.count({
        where: { patientId: patient.id },
      }),
    ).toBe(1);
    expect(
      await prisma.patientProcessingLock.count({
        where: { patientId: patient.id },
      }),
    ).toBe(1);
    expect(
      await prisma.clinicianPatientAssignment.count({
        where: {
          clinicianUserId: clinician.id,
          patientId: patient.id,
          endedAt: null,
        },
      }),
    ).toBe(1);
  }, 20_000);

  it('refuses before doing any work in real-patient mode', async () => {
    await expect(
      seedPrototype({ ...seedEnvironment, APP_MODE: 'real_patient' }),
    ).rejects.toThrow('forbidden');
  });

  it('does not coerce a malformed application mode into prototype', async () => {
    await expect(
      seedPrototype({ ...seedEnvironment, APP_MODE: 'production-ish' }),
    ).rejects.toThrow('Invalid runtime configuration');
  });
});
