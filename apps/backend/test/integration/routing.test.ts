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
import { resolveRegionalRoute } from '../../src/modules/routing/service.js';
import { FixedClock } from '../../src/shared/clock/clock.js';

loadRootEnvironment();
const databaseUrl = parseTestDatabaseUrl(process.env);
const config = parseConfig({
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: 'silent',
  APP_MODE: 'prototype',
  BETTER_AUTH_SECRET: 'routing-integration-secret-at-least-32-characters',
  APP_BASE_URL: 'http://127.0.0.1:3000',
});
const prisma = createPrismaClient(databaseUrl);
const emailSender = new FakeAuthEmailSender();
const auth = createAuth(prisma, config, emailSender);
const fixtureAuth = createAuth(prisma, config, emailSender, {
  allowSignUpForFixtureCreation: true,
});
const clock = new FixedClock(new Date('2026-08-17T10:00:00.000Z'));
const app = buildApp({ config, prisma, auth, emailSender, clock });
const marker = randomUUID().slice(0, 8).toUpperCase();
const email = `routing-admin-${marker}@example.test`;
const password = 'RoutingAdmin!2026';
let adminId = '';
let cookie = '';

type RoutingFixture = {
  id: string;
  rowVersion: number;
  configurationRevision: number;
  lifecycle: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
  testEvidence: Array<{ configurationRevision: number }>;
};

const targets = [
  {
    kind: 'EMERGENCY_SERVICE',
    representation: 'TELEPHONE',
    targetValue: '+9990001',
    label: 'Test emergency desk',
  },
  {
    kind: 'CRISIS_SERVICE',
    representation: 'DEEP_LINK',
    targetValue: 'https://routing.invalid/crisis',
    label: 'Test crisis route',
  },
  {
    kind: 'URGENT_MEDICAL_SERVICE',
    representation: 'EXTERNAL_SERVICE',
    targetValue: 'urn:test:urgent',
    label: 'Test urgent service',
  },
  {
    kind: 'ON_CALL_CLINICIAN_QUEUE',
    representation: 'INTERNAL_QUEUE',
    targetValue: 'queue:test-on-call',
    label: 'Test on-call queue',
  },
] as const;

async function post(path: string, payload: unknown, key = randomUUID()) {
  return app.inject({
    method: 'POST',
    url: path,
    headers: { cookie, 'idempotency-key': key },
    payload: payload as Record<string, unknown>,
  });
}

async function createDraft() {
  const response = await post(
    '/api/v1/admin/configuration/regional-routing/drafts',
    {
      countryCode: 'XZ',
      regionCode: marker,
      reason: 'Routing integration draft',
    },
  );
  expect(response.statusCode).toBe(201);
  return response.json<RoutingFixture>();
}

async function editDraft(profile: { id: string; rowVersion: number }) {
  const response = await post(
    `/api/v1/admin/configuration/regional-routing/${profile.id}/edit`,
    {
      expectedVersion: profile.rowVersion,
      targets,
      reason: 'Exact integration targets',
    },
  );
  expect(response.statusCode).toBe(200);
  return response.json<RoutingFixture>();
}

async function recordAllPasses(profile: RoutingFixture) {
  let current = profile;
  for (const target of targets) {
    const response = await post(
      `/api/v1/admin/configuration/regional-routing/${profile.id}/test-evidence`,
      {
        expectedVersion: current.rowVersion,
        targetKind: target.kind,
        result: 'PASS',
        provenance: `Verified ${target.kind} in deployment fixture`,
      },
    );
    expect(response.statusCode).toBe(200);
    current = response.json<RoutingFixture>();
  }
  return current;
}

beforeAll(async () => {
  const created = await fixtureAuth.api.signUpEmail({
    body: { email, password, name: 'Routing Administrator' },
  });
  adminId = created.user.id;
  await prisma.user.update({
    where: { id: adminId },
    data: { emailVerified: true },
  });
  await prisma.applicationAccount.create({
    data: { userId: adminId, state: 'ACTIVE', createdByUserId: adminId },
  });
  await prisma.userRoleAssignment.create({
    data: {
      userId: adminId,
      workspace: 'ADMIN',
      role: 'ADMIN',
      grantedByUserId: adminId,
      grantReason: 'Routing integration fixture',
    },
  });
  await app.ready();
  const signIn = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: config.appBaseUrl },
    payload: { email, password },
  });
  cookie = `${signIn.cookies.find(({ name }) => name.includes('session_token'))!.name}=${signIn.cookies.find(({ name }) => name.includes('session_token'))!.value}`;
});

afterAll(async () => {
  await app.close();
  await prisma.idempotencyRecord.deleteMany({ where: { actorId: adminId } });
  await prisma.userRoleAssignment.deleteMany({ where: { userId: adminId } });
  await prisma.applicationAccount.deleteMany({ where: { userId: adminId } });
  await prisma.user.deleteMany({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('regional routing lifecycle', () => {
  it('enforces canonical region identities at the API and database boundaries', async () => {
    for (const regionCode of ['*', 'A:B', '  ']) {
      const response = await post(
        '/api/v1/admin/configuration/regional-routing/drafts',
        { countryCode: 'XZ', regionCode, reason: 'Invalid region regression' },
      );
      expect(response.statusCode).toBe(400);
    }

    const insert = async (
      countryCode: string,
      regionCode: string | null,
      regionKey: string,
    ) =>
      prisma.$executeRaw`
        INSERT INTO "regional_routing_profile_versions"
          ("id", "country_code", "region_code", "region_key", "logical_version", "created_by_user_id")
        VALUES
          (${randomUUID()}::uuid, ${countryCode}, ${regionCode}, ${regionKey}, 1, ${adminId}::uuid)
      `;
    await expect(insert('XZ', '*', 'XZ:*')).rejects.toThrow();
    await expect(insert('x', 'TEST', 'x:TEST')).rejects.toThrow();
    await expect(insert('XZ', 'A:B', 'XZ:A:B')).rejects.toThrow();

    const countryWideResponse = await post(
      '/api/v1/admin/configuration/regional-routing/drafts',
      {
        countryCode: 'xz',
        regionCode: null,
        reason: 'Country-wide regression',
      },
    );
    expect(countryWideResponse.statusCode).toBe(201);
    expect(countryWideResponse.json<RoutingFixture>().lifecycle).toBe('DRAFT');
    const countryWide =
      await prisma.regionalRoutingProfileVersion.findFirstOrThrow({
        where: { regionKey: 'XZ:*' },
      });
    expect(countryWide.regionCode).toBeNull();
    const normalized = await post(
      '/api/v1/admin/configuration/regional-routing/drafts',
      {
        countryCode: 'xz',
        regionCode: 'test_region',
        reason: 'Normalized region regression',
      },
    );
    expect(normalized.statusCode).toBe(201);
    expect(normalized.json<RoutingFixture>().lifecycle).toBe('DRAFT');
    const stored = await prisma.regionalRoutingProfileVersion.findFirstOrThrow({
      where: { regionKey: 'XZ:TEST_REGION' },
    });
    expect(stored.countryCode).toBe('XZ');
    expect(stored.regionCode).toBe('TEST_REGION');
    expect(stored.regionKey).toBe('XZ:TEST_REGION');
  });

  it('rejects unsafe target formats before they can receive evidence', async () => {
    const draft = await createDraft();
    const invalidTargets = [
      { ...targets[0], targetValue: 'javascript:alert(1)' },
      { ...targets[1], targetValue: 'data:text/plain,unsafe' },
      { ...targets[2], targetValue: 'bad queue value' },
      { ...targets[3], targetValue: 'queue with spaces' },
    ];
    for (const replacement of invalidTargets) {
      const response = await post(
        `/api/v1/admin/configuration/regional-routing/${draft.id}/edit`,
        {
          expectedVersion: draft.rowVersion,
          targets: [
            replacement,
            ...targets.filter((target) => target.kind !== replacement.kind),
          ],
          reason: 'Invalid target regression',
        },
      );
      expect(response.statusCode).toBe(400);
    }
  });

  it('revalidates persisted target data and keeps test evidence append-only', async () => {
    let draft = await editDraft(await createDraft());
    await prisma.$executeRaw`
      UPDATE "regional_routing_targets"
      SET "target_value" = 'javascript:unsafe'
      WHERE "profile_id" = ${draft.id}::uuid AND "kind" = 'CRISIS_SERVICE'
    `;
    const activation = await post(
      `/api/v1/admin/configuration/regional-routing/${draft.id}/activate`,
      {
        expectedVersion: draft.rowVersion,
        reason: 'Invalid stored target regression',
      },
    );
    expect(activation.statusCode).toBe(400);
    draft = await recordAllPasses(await editDraft(await createDraft()));
    const evidence = await prisma.regionalRoutingTestEvidence.findFirstOrThrow({
      where: { profileId: draft.id },
    });
    await expect(
      prisma.regionalRoutingTestEvidence.update({
        where: { id: evidence.id },
        data: { provenance: 'mutated' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.regionalRoutingTestEvidence.delete({ where: { id: evidence.id } }),
    ).rejects.toThrow();
  });

  it('requires current successful evidence, preserves history, and serializes activation', async () => {
    let first = await editDraft(await createDraft());
    const failed = await post(
      `/api/v1/admin/configuration/regional-routing/${first.id}/test-evidence`,
      {
        expectedVersion: first.rowVersion,
        targetKind: 'EMERGENCY_SERVICE',
        result: 'FAIL',
        provenance: 'Deliberate failed deployment test',
      },
    );
    expect(failed.statusCode).toBe(200);
    first = failed.json<RoutingFixture>();
    const rejected = await post(
      `/api/v1/admin/configuration/regional-routing/${first.id}/activate`,
      {
        expectedVersion: first.rowVersion,
        reason: 'Must not activate failed evidence',
      },
    );
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json().error.code).toBe('ROUTING_TEST_EVIDENCE_REQUIRED');

    first = await editDraft(first);
    expect(first.configurationRevision).toBe(3);
    expect(
      first.testEvidence.every(
        (evidence: { configurationRevision: number }) =>
          evidence.configurationRevision !== first.configurationRevision,
      ),
    ).toBe(true);
    first = await recordAllPasses(first);
    const activationKey = randomUUID();
    const activationPayload = {
      expectedVersion: first.rowVersion,
      reason: 'Activate exact tested v1',
    };
    const [activatedA, activatedB] = await Promise.all([
      post(
        `/api/v1/admin/configuration/regional-routing/${first.id}/activate`,
        activationPayload,
        activationKey,
      ),
      post(
        `/api/v1/admin/configuration/regional-routing/${first.id}/activate`,
        activationPayload,
        activationKey,
      ),
    ]);
    expect(activatedA.statusCode).toBe(200);
    expect(activatedB.body).toBe(activatedA.body);
    const changedPayload = await post(
      `/api/v1/admin/configuration/regional-routing/${first.id}/activate`,
      { ...activationPayload, reason: 'Changed activation reason' },
      activationKey,
    );
    expect(changedPayload.statusCode).toBe(409);
    expect(changedPayload.json().error.code).toBe('IDEMPOTENCY_KEY_REUSE');

    let second = await recordAllPasses(await editDraft(await createDraft()));
    let third = await recordAllPasses(await editDraft(await createDraft()));
    const concurrent = await Promise.all([
      post(
        `/api/v1/admin/configuration/regional-routing/${second.id}/activate`,
        {
          expectedVersion: second.rowVersion,
          reason: 'Concurrent older activation',
        },
      ),
      post(
        `/api/v1/admin/configuration/regional-routing/${third.id}/activate`,
        {
          expectedVersion: third.rowVersion,
          reason: 'Concurrent latest activation',
        },
      ),
    ]);
    expect(concurrent.map(({ statusCode }) => statusCode).sort()).toEqual([
      200, 409,
    ]);
    third = concurrent
      .find(({ statusCode }) => statusCode === 200)!
      .json<RoutingFixture>();
    second = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/admin/configuration/regional-routing/${second.id}`,
        headers: { cookie },
      })
    ).json<RoutingFixture>();
    expect(third.lifecycle).toBe('ACTIVE');
    expect(second.lifecycle).toBe('DRAFT');
    const historical =
      await prisma.regionalRoutingProfileVersion.findUniqueOrThrow({
        where: { id: first.id },
      });
    expect(historical.lifecycle).toBe('SUPERSEDED');
    expect(
      await prisma.regionalRoutingProfileVersion.count({
        where: { regionKey: `XZ:${marker}`, lifecycle: 'ACTIVE' },
      }),
    ).toBe(1);

    const resolved = await resolveRegionalRoute(
      prisma,
      'xz',
      marker.toLowerCase(),
      clock.now(),
    );
    expect(resolved.status).toBe('AVAILABLE');
    const unavailable = await resolveRegionalRoute(
      prisma,
      'ZZ',
      'NO-SUCH-REGION',
      clock.now(),
    );
    expect(unavailable).toEqual({
      status: 'UNAVAILABLE',
      reason: 'NO_ACTIVE_PROFILE',
    });
    expect(JSON.stringify(unavailable)).not.toMatch(/911|112|http|queue/i);
    expect(
      await prisma.auditEvent.count({
        where: { actorId: adminId, action: 'ROUTING_ACTIVATE' },
      }),
    ).toBe(2);
  }, 30_000);
});
