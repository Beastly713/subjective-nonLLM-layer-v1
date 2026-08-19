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
import { resolveApplicationAccess } from '../../src/shared/authz/access.js';

loadRootEnvironment();

const databaseUrl = parseTestDatabaseUrl(process.env);
const config = parseConfig({
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: 'silent',
  APP_MODE: 'prototype',
  BETTER_AUTH_SECRET: 'access-integration-secret-at-least-32-characters',
  APP_BASE_URL: 'http://127.0.0.1:3000',
});
const prisma = createPrismaClient(databaseUrl);
const emailSender = new FakeAuthEmailSender();
const auth = createAuth(prisma, config, emailSender);
const fixtureAuth = createAuth(prisma, config, emailSender, {
  allowSignUpForFixtureCreation: true,
});
const app = buildApp({ config, prisma, auth, emailSender });
const marker = randomUUID().slice(0, 8);
const password = 'AccessFixture!2026';
const emails = {
  admin: `access-admin-${marker}@example.test`,
  patient: `access-patient-${marker}@example.test`,
  otherPatient: `access-other-${marker}@example.test`,
  clinician: `access-clinician-${marker}@example.test`,
  pending: `access-pending-${marker}@example.test`,
  disabled: `access-disabled-${marker}@example.test`,
  unprovisioned: `access-unprovisioned-${marker}@example.test`,
  provisioned: `access-created-${marker}@example.test`,
  concurrentPatient: `access-concurrent-patient-${marker}@example.test`,
  concurrentProvisioned: `access-concurrent-created-${marker}@example.test`,
  concurrentConflictA: `access-concurrent-a-${marker}@example.test`,
  concurrentConflictB: `access-concurrent-b-${marker}@example.test`,
  differentKeyProvisioned: `access-different-key-${marker}@example.test`,
};
const ids: Record<keyof typeof emails, string> = {} as Record<
  keyof typeof emails,
  string
>;
let adminCookie = '';
let clinicianScopeCookie = '';

async function createIdentity(key: keyof typeof emails, name: string) {
  const result = await fixtureAuth.api.signUpEmail({
    body: { email: emails[key], password, name },
  });
  ids[key] = result.user.id;
  await prisma.user.update({
    where: { id: result.user.id },
    data: { emailVerified: true },
  });
}

async function signIn(key: keyof typeof emails) {
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

async function cleanFixtureUsers() {
  const users = await prisma.user.findMany({
    where: { email: { in: Object.values(emails) } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  if (userIds.length === 0) return;
  await prisma.idempotencyRecord.deleteMany({
    where: { actorId: { in: userIds } },
  });
  await prisma.clinicianPatientAssignment.deleteMany({
    where: {
      OR: [
        { clinicianUserId: { in: userIds } },
        { patientId: { in: userIds } },
      ],
    },
  });
  await prisma.patientProcessingLock.deleteMany({
    where: { patientId: { in: userIds } },
  });
  await prisma.profilePreferenceVersion.deleteMany({
    where: { patientId: { in: userIds } },
  });
  await prisma.patientProfile.deleteMany({
    where: { patientId: { in: userIds } },
  });
  await prisma.userRoleAssignment.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.applicationAccount.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

beforeAll(async () => {
  await cleanFixtureUsers();
  await Promise.all([
    createIdentity('admin', 'Access Administrator'),
    createIdentity('patient', 'Assigned Patient'),
    createIdentity('otherPatient', 'Unassigned Patient'),
    createIdentity('clinician', 'Assigned Clinician'),
    createIdentity('pending', 'Pending Patient'),
    createIdentity('disabled', 'Disabled Patient'),
    createIdentity('unprovisioned', 'Unprovisioned Identity'),
    createIdentity('concurrentPatient', 'Concurrent Preference Patient'),
  ]);

  await prisma.applicationAccount.createMany({
    data: [
      { userId: ids.admin, state: 'ACTIVE', createdByUserId: ids.admin },
      { userId: ids.patient, state: 'ACTIVE', createdByUserId: ids.admin },
      { userId: ids.otherPatient, state: 'ACTIVE', createdByUserId: ids.admin },
      { userId: ids.clinician, state: 'ACTIVE', createdByUserId: ids.admin },
      { userId: ids.pending, state: 'PENDING', createdByUserId: ids.admin },
      { userId: ids.disabled, state: 'DISABLED', createdByUserId: ids.admin },
      {
        userId: ids.concurrentPatient,
        state: 'ACTIVE',
        createdByUserId: ids.admin,
      },
    ],
  });
  await prisma.userRoleAssignment.createMany({
    data: [
      {
        userId: ids.admin,
        workspace: 'ADMIN',
        role: 'ADMIN',
        grantedByUserId: ids.admin,
        grantReason: 'Access integration fixture',
      },
      {
        userId: ids.patient,
        workspace: 'PATIENT',
        role: 'PATIENT',
        grantedByUserId: ids.admin,
        grantReason: 'Access integration fixture',
      },
      {
        userId: ids.otherPatient,
        workspace: 'PATIENT',
        role: 'PATIENT',
        grantedByUserId: ids.admin,
        grantReason: 'Access integration fixture',
      },
      {
        userId: ids.clinician,
        workspace: 'CLINICIAN',
        role: 'CLINICIAN',
        grantedByUserId: ids.admin,
        grantReason: 'Access integration fixture',
      },
      {
        userId: ids.pending,
        workspace: 'PATIENT',
        role: 'PATIENT',
        grantedByUserId: ids.admin,
        grantReason: 'Access integration fixture',
      },
      {
        userId: ids.disabled,
        workspace: 'PATIENT',
        role: 'PATIENT',
        grantedByUserId: ids.admin,
        grantReason: 'Access integration fixture',
      },
      {
        userId: ids.concurrentPatient,
        workspace: 'PATIENT',
        role: 'PATIENT',
        grantedByUserId: ids.admin,
        grantReason: 'Access integration fixture',
      },
    ],
  });
  for (const patientId of [
    ids.patient,
    ids.otherPatient,
    ids.pending,
    ids.disabled,
    ids.concurrentPatient,
  ]) {
    await prisma.patientProfile.create({
      data: {
        patientId,
        monitoringTimezone: 'UTC',
        createdByUserId: ids.admin,
        updatedByUserId: ids.admin,
        preferences: { create: { version: 1, createdByUserId: ids.admin } },
        processingLock: { create: {} },
      },
    });
  }
  await prisma.clinicianPatientAssignment.create({
    data: {
      clinicianUserId: ids.clinician,
      patientId: ids.patient,
      assignedByUserId: ids.admin,
      assignmentReason: 'Access integration fixture',
    },
  });
  await app.ready();
  adminCookie = await signIn('admin');
}, 20_000);

afterAll(async () => {
  await app.close();
  await cleanFixtureUsers();
  await prisma.$disconnect();
});

describe('application authorization and patient scope', () => {
  it('hides disabled assigned patients behind the same clinician detail 404', async () => {
    const assignment = await prisma.clinicianPatientAssignment.create({
      data: {
        clinicianUserId: ids.clinician,
        patientId: ids.disabled,
        assignedByUserId: ids.admin,
        assignmentReason: 'Disabled detail scope regression',
      },
    });
    clinicianScopeCookie = await signIn('clinician');
    const disabled = await app.inject({
      method: 'GET',
      url: `/api/v1/clinician/patients/${ids.disabled}`,
      headers: { cookie: clinicianScopeCookie },
    });
    const nonexistent = await app.inject({
      method: 'GET',
      url: `/api/v1/clinician/patients/${randomUUID()}`,
      headers: { cookie: clinicianScopeCookie },
    });
    expect(disabled.statusCode).toBe(404);
    expect(disabled.json().error).toMatchObject({
      code: nonexistent.json().error.code,
      message: nonexistent.json().error.message,
    });
    await prisma.clinicianPatientAssignment.delete({
      where: { id: assignment.id },
    });
  });

  it('gives an authenticated but unprovisioned identity zero application access', async () => {
    const cookie = await signIn('unprovisioned');
    const session = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { cookie },
    });
    expect(session.statusCode).toBe(200);
    expect(session.json().session.access).toMatchObject({
      accountState: 'UNPROVISIONED',
      permissions: [],
      allowedDestinations: [],
      restrictionReason: 'ACCOUNT_UNPROVISIONED',
    });
    const profile = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/profile',
      headers: { cookie },
    });
    expect(profile.statusCode).toBe(403);
    expect(profile.json().error.code).toBe('PERMISSION_DENIED');
  });

  it.each([
    ['pending', 'ACCOUNT_PENDING'],
    ['disabled', 'ACCOUNT_DISABLED'],
  ] as const)('denies a %s account', async (key, code) => {
    const cookie = await signIn(key);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/profile',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe(code);
  });

  it('allows own profile updates, validates IANA timezones, and appends preferences', async () => {
    const cookie = await signIn('patient');
    const initial = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/profile',
      headers: { cookie },
    });
    expect(initial.statusCode).toBe(200);
    expect(initial.json().preferences).toMatchObject({
      version: 1,
      mutualHelpPreference: null,
      spiritualContentPreference: null,
    });
    const invalid = await app.inject({
      method: 'PATCH',
      url: '/api/v1/patient/profile',
      headers: { cookie },
      payload: { monitoringTimezone: '+05:30', expectedVersion: 1 },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe('INVALID_MONITORING_TIMEZONE');
    const updated = await app.inject({
      method: 'PATCH',
      url: '/api/v1/patient/profile',
      headers: { cookie },
      payload: { monitoringTimezone: 'Asia/Kolkata', expectedVersion: 1 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      monitoringTimezone: 'Asia/Calcutta',
      version: 2,
    });
    const stale = await app.inject({
      method: 'PATCH',
      url: '/api/v1/patient/profile',
      headers: { cookie },
      payload: { monitoringTimezone: 'UTC', expectedVersion: 1 },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('VERSION_CONFLICT');
    const preference = await app.inject({
      method: 'POST',
      url: '/api/v1/patient/profile/preferences',
      headers: { cookie },
      payload: {
        mutualHelpPreference: null,
        spiritualContentPreference: 'ALLOW',
        expectedVersion: 1,
      },
    });
    expect(preference.statusCode).toBe(200);
    expect(preference.json().preferences).toMatchObject({
      version: 2,
      mutualHelpPreference: null,
      spiritualContentPreference: 'ALLOW',
    });
    const versions = await prisma.profilePreferenceVersion.findMany({
      where: { patientId: ids.patient },
      orderBy: { version: 'asc' },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]?.mutualHelpPreference).toBeNull();
    expect(
      await prisma.patientProcessingLock.count({
        where: { patientId: ids.patient },
      }),
    ).toBe(1);
  });

  it('scopes clinician lookup, search, count, and pagination before serving patient data', async () => {
    const cookie = await signIn('clinician');
    const assigned = await app.inject({
      method: 'GET',
      url: `/api/v1/clinician/patients/${ids.patient}`,
      headers: { cookie },
    });
    expect(assigned.statusCode).toBe(200);
    const unassigned = await app.inject({
      method: 'GET',
      url: `/api/v1/clinician/patients/${ids.otherPatient}`,
      headers: { cookie },
    });
    const nonexistent = await app.inject({
      method: 'GET',
      url: `/api/v1/clinician/patients/${randomUUID()}`,
      headers: { cookie },
    });
    expect(unassigned.statusCode).toBe(404);
    expect(unassigned.json().error).toMatchObject({
      code: nonexistent.json().error.code,
      message: nonexistent.json().error.message,
    });
    const excluded = await app.inject({
      method: 'GET',
      url: `/api/v1/clinician/patients?search=${encodeURIComponent('Unassigned Patient')}&page=1&pageSize=1`,
      headers: { cookie },
    });
    expect(excluded.json()).toMatchObject({ items: [], total: 0 });
    const included = await app.inject({
      method: 'GET',
      url: '/api/v1/clinician/patients?search=Assigned%20Patient&page=1&pageSize=1',
      headers: { cookie },
    });
    expect(included.json().total).toBe(1);
    expect(included.json().items[0].patientId).toBe(ids.patient);
  });

  it('serializes concurrent preference versions into one success and one domain conflict', async () => {
    const cookie = await signIn('concurrentPatient');
    const request = () =>
      app.inject({
        method: 'POST',
        url: '/api/v1/patient/profile/preferences',
        headers: { cookie },
        payload: {
          mutualHelpPreference: 'UNSURE',
          spiritualContentPreference: null,
          expectedVersion: 1,
        },
      });
    const responses = await Promise.all([request(), request()]);
    expect(responses.map(({ statusCode }) => statusCode).sort()).toEqual([
      200, 409,
    ]);
    expect(
      responses.find(({ statusCode }) => statusCode === 409)?.json().error.code,
    ).toBe('VERSION_CONFLICT');
    expect(
      await prisma.profilePreferenceVersion.count({
        where: { patientId: ids.concurrentPatient },
      }),
    ).toBe(2);
  });

  it('does not give an administrator blanket patient profile access', async () => {
    const cookie = adminCookie;
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/patient/profile',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('PERMISSION_DENIED');
  });

  it('rejects granting PATIENT access to an account without the patient profile foundation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${ids.clinician}/roles`,
      headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
      payload: {
        workspace: 'PATIENT',
        role: 'PATIENT',
        reason: 'Invariant regression fixture',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_ROLE_WORKSPACE');
    expect(
      await prisma.userRoleAssignment.count({
        where: { userId: ids.clinician, role: 'PATIENT', revokedAt: null },
      }),
    ).toBe(0);
  });

  it('projects direct assignment identifiers, versions, and identity labels in admin detail', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users/${ids.clinician}`,
      headers: { cookie: adminCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().directAssignments).toEqual([
      expect.objectContaining({
        version: 1,
        clinician: expect.objectContaining({
          userId: ids.clinician,
          name: 'Assigned Clinician',
        }),
        patient: expect.objectContaining({
          userId: ids.patient,
          name: 'Assigned Patient',
        }),
      }),
    ]);
  });

  it('requires privileged identity verification and MFA in real-patient mode', async () => {
    const realPatientConfig = parseConfig({
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      LOG_LEVEL: 'silent',
      APP_MODE: 'real_patient',
      BETTER_AUTH_SECRET: config.betterAuthSecret,
      APP_BASE_URL: config.appBaseUrl,
    });
    const clinician = await prisma.user.findUniqueOrThrow({
      where: { id: ids.clinician },
    });
    const unverified = await resolveApplicationAccess(
      prisma,
      clinician,
      realPatientConfig,
    );
    expect(unverified.allowedDestinations).toEqual([]);
    expect(unverified.restrictionReason).toBe('IDENTITY_VERIFICATION_REQUIRED');

    await prisma.applicationAccount.update({
      where: { userId: ids.clinician },
      data: {
        privilegedIdentityVerifiedAt: new Date(),
        privilegedIdentityVerifiedByUserId: ids.admin,
        privilegedIdentityVerificationReference: 'fixture-verification',
      },
    });
    const verifiedWithoutMfa = await resolveApplicationAccess(
      prisma,
      clinician,
      realPatientConfig,
    );
    expect(verifiedWithoutMfa.restrictionReason).toBe('MFA_REQUIRED');

    await prisma.user.update({
      where: { id: ids.clinician },
      data: { twoFactorEnabled: true },
    });
    const readyClinician = await prisma.user.findUniqueOrThrow({
      where: { id: ids.clinician },
    });
    const ready = await resolveApplicationAccess(
      prisma,
      readyClinician,
      realPatientConfig,
    );
    expect(ready.allowedDestinations).toEqual([
      {
        workspace: 'CLINICIAN',
        path: '/clinician/patients',
        label: 'Patients',
      },
    ]);
  });

  it('enforces active role and clinician assignment uniqueness in PostgreSQL', async () => {
    await expect(
      prisma.userRoleAssignment.create({
        data: {
          userId: ids.patient,
          workspace: 'PATIENT',
          role: 'PATIENT',
          grantedByUserId: ids.admin,
          grantReason: 'Duplicate test',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.clinicianPatientAssignment.create({
        data: {
          clinicianUserId: ids.clinician,
          patientId: ids.patient,
          assignedByUserId: ids.admin,
          assignmentReason: 'Duplicate test',
        },
      }),
    ).rejects.toThrow();
  });

  it('provisions idempotently without enabling public signup or retaining the password', async () => {
    const cookie = adminCookie;
    const key = randomUUID();
    const payload = {
      name: 'Provisioned Patient',
      email: emails.provisioned,
      initialPassword: 'Provisioned!2026',
      workspace: 'PATIENT',
      role: 'PATIENT',
      monitoringTimezone: 'UTC',
      reason: 'Access integration fixture',
    };
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: { cookie, 'idempotency-key': key },
      payload,
    });
    expect(first.statusCode).toBe(201);
    ids.provisioned = first.json().userId;
    expect(first.json().accountState).toBe('PENDING');
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: { cookie, 'idempotency-key': key },
      payload,
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.body).toBe(first.body);
    const changedPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: { cookie, 'idempotency-key': key },
      payload: { ...payload, initialPassword: 'ChangedPassword!2026' },
    });
    expect(changedPassword.statusCode).toBe(409);
    expect(changedPassword.json().error.code).toBe('IDEMPOTENCY_KEY_REUSE');
    const conflict = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: { cookie, 'idempotency-key': key },
      payload: { ...payload, reason: 'Changed canonical request' },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('IDEMPOTENCY_KEY_REUSE');
    const stored = await prisma.idempotencyRecord.findFirst({
      where: {
        actorId: ids.admin,
        action: 'USER_PROVISION',
        idempotencyKey: key,
      },
    });
    expect(JSON.stringify(stored)).not.toContain(payload.initialPassword);
    const publicSignup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: config.appBaseUrl },
      payload: {
        name: 'Public',
        email: `public-${marker}@example.test`,
        password,
      },
    });
    expect(publicSignup.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('serializes concurrent idempotent provisioning and replays the committed result', async () => {
    const key = randomUUID();
    const payload = {
      name: 'Concurrent Provisioned Clinician',
      email: emails.concurrentProvisioned,
      initialPassword: 'ConcurrentProvision!2026',
      workspace: 'CLINICIAN',
      role: 'CLINICIAN',
      reason: 'Concurrent idempotency regression fixture',
    };
    const request = () =>
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/users',
        headers: { cookie: adminCookie, 'idempotency-key': key },
        payload,
      });
    const [first, second] = await Promise.all([request(), request()]);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.body).toBe(first.body);
    ids.concurrentProvisioned = first.json().userId;
    expect(
      await prisma.user.count({
        where: { email: emails.concurrentProvisioned },
      }),
    ).toBe(1);
    expect(
      await prisma.idempotencyRecord.count({
        where: {
          actorId: ids.admin,
          action: 'USER_PROVISION',
          idempotencyKey: key,
        },
      }),
    ).toBe(1);
  });

  it('rejects a concurrent changed payload using the same idempotency key', async () => {
    const key = randomUUID();
    const request = (email: string) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/users',
        headers: { cookie: adminCookie, 'idempotency-key': key },
        payload: {
          name: 'Concurrent Conflict Fixture',
          email,
          initialPassword: 'ConcurrentConflict!2026',
          workspace: 'CLINICIAN',
          role: 'CLINICIAN',
          reason: 'Concurrent changed-payload fixture',
        },
      });
    const responses = await Promise.all([
      request(emails.concurrentConflictA),
      request(emails.concurrentConflictB),
    ]);
    expect(responses.map(({ statusCode }) => statusCode).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responses.find(({ statusCode }) => statusCode === 409)?.json().error.code,
    ).toBe('IDEMPOTENCY_KEY_REUSE');
    expect(
      await prisma.user.count({
        where: {
          email: {
            in: [emails.concurrentConflictA, emails.concurrentConflictB],
          },
        },
      }),
    ).toBe(1);
  });

  it('normalizes different-key uniqueness races and atomically ends assignments', async () => {
    const provisionPayload = {
      name: 'Different Key Provisioning Fixture',
      email: emails.differentKeyProvisioned,
      initialPassword: 'DifferentKey!2026',
      workspace: 'CLINICIAN',
      role: 'CLINICIAN',
      reason: 'Different-key race fixture',
    };
    const provisionResponses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/users',
        headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
        payload: provisionPayload,
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/users',
        headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
        payload: provisionPayload,
      }),
    ]);
    expect(
      provisionResponses.map(({ statusCode }) => statusCode).sort(),
    ).toEqual([201, 409]);
    expect(
      provisionResponses.find(({ statusCode }) => statusCode === 409)?.json()
        .error.code,
    ).toBe('ACCOUNT_ALREADY_PROVISIONED');

    const targetId = ids.concurrentProvisioned;
    const rolePayload = {
      workspace: 'ADMIN',
      role: 'OPERATIONS',
      reason: 'Different-key role race',
    };
    const roleResponses = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${targetId}/roles`,
        headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
        payload: rolePayload,
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${targetId}/roles`,
        headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
        payload: rolePayload,
      }),
    ]);
    expect(roleResponses.map(({ statusCode }) => statusCode).sort()).toEqual([
      201, 409,
    ]);
    expect(
      roleResponses.find(({ statusCode }) => statusCode === 409)?.json().error
        .code,
    ).toBe('VERSION_CONFLICT');

    const assignmentPayload = {
      clinicianUserId: targetId,
      patientId: ids.patient,
      reason: 'Different-key assignment race',
    };
    const assignmentResponses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/patient-assignments',
        headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
        payload: assignmentPayload,
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/patient-assignments',
        headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
        payload: assignmentPayload,
      }),
    ]);
    expect(
      assignmentResponses.map(({ statusCode }) => statusCode).sort(),
    ).toEqual([201, 409]);
    expect(
      assignmentResponses.find(({ statusCode }) => statusCode === 409)?.json()
        .error.code,
    ).toBe('VERSION_CONFLICT');
    const assignment = assignmentResponses
      .find(({ statusCode }) => statusCode === 201)!
      .json();
    const endPayload = {
      expectedVersion: assignment.version,
      reason: 'Atomic end race',
    };
    const endResponses = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/admin/patient-assignments/${assignment.id}/end`,
        headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
        payload: endPayload,
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/admin/patient-assignments/${assignment.id}/end`,
        headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
        payload: endPayload,
      }),
    ]);
    expect(endResponses.map(({ statusCode }) => statusCode).sort()).toEqual([
      200, 409,
    ]);
    expect(
      endResponses.find(({ statusCode }) => statusCode === 409)?.json().error
        .code,
    ).toBe('VERSION_CONFLICT');
  });

  it('audits role and assignment changes and revokes affected sessions', async () => {
    const patientCookie = await signIn('patient');
    const clinicianCookie = clinicianScopeCookie;
    const role = await prisma.userRoleAssignment.findFirstOrThrow({
      where: { userId: ids.patient, role: 'PATIENT', revokedAt: null },
    });
    const revokeRole = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${ids.patient}/roles/${role.id}/revoke`,
      headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
      payload: {
        expectedVersion: role.version,
        reason: 'Role revocation fixture',
      },
    });
    expect(revokeRole.statusCode).toBe(200);
    expect(await prisma.session.count({ where: { userId: ids.patient } })).toBe(
      0,
    );
    expect(
      await prisma.auditEvent.count({
        where: { actorId: ids.admin, action: 'ROLE_REVOKE', entityId: role.id },
      }),
    ).toBeGreaterThan(0);
    const grantRole = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${ids.patient}/roles`,
      headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
      payload: {
        workspace: 'PATIENT',
        role: 'PATIENT',
        reason: 'Role restore fixture',
      },
    });
    expect(grantRole.statusCode).toBe(201);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: patientCookie },
        })
      ).json().authenticated,
    ).toBe(false);

    const assignment = await prisma.clinicianPatientAssignment.findFirstOrThrow(
      {
        where: {
          clinicianUserId: ids.clinician,
          patientId: ids.patient,
          endedAt: null,
        },
      },
    );
    const end = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/patient-assignments/${assignment.id}/end`,
      headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
      payload: {
        expectedVersion: assignment.version,
        reason: 'Assignment end fixture',
      },
    });
    expect(end.statusCode).toBe(200);
    expect(
      await prisma.session.count({ where: { userId: ids.clinician } }),
    ).toBe(0);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: { cookie: clinicianCookie },
        })
      ).json().authenticated,
    ).toBe(false);
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/patient-assignments',
      headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
      payload: {
        clinicianUserId: ids.clinician,
        patientId: ids.patient,
        reason: 'Assignment restore fixture',
      },
    });
    expect(create.statusCode).toBe(201);
    expect(
      await prisma.auditEvent.count({
        where: {
          actorId: ids.admin,
          action: {
            in: ['PATIENT_ASSIGNMENT_END', 'PATIENT_ASSIGNMENT_CREATE'],
          },
        },
      }),
    ).toBeGreaterThanOrEqual(2);
  });

  it('audits account disable and revokes the target sessions transactionally', async () => {
    const targetCookie = await signIn('otherPatient');
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${ids.otherPatient}/disable`,
      headers: { cookie: adminCookie, 'idempotency-key': randomUUID() },
      payload: { expectedVersion: 1, reason: 'Access integration disable' },
    });
    expect(response.statusCode).toBe(200);
    expect(
      await prisma.session.count({ where: { userId: ids.otherPatient } }),
    ).toBe(0);
    expect(
      await prisma.auditEvent.count({
        where: {
          actorId: ids.admin,
          action: 'USER_DISABLE',
          entityId: ids.otherPatient,
        },
      }),
    ).toBeGreaterThan(0);
    const revoked = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { cookie: targetCookie },
    });
    expect(revoked.json().authenticated).toBe(false);
  });
});
