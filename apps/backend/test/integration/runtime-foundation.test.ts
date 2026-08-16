import { randomUUID } from 'node:crypto';

import {
  ApiErrorResponseSchema,
  LivenessResponseSchema,
  ReadinessResponseSchema,
} from '@aud-subjective/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import {
  loadRootEnvironment,
  parseConfig,
  parseTestDatabaseUrl,
} from '../../src/infrastructure/config/config.js';
import { createPrismaClient } from '../../src/infrastructure/db/prisma.js';

loadRootEnvironment();

const testDatabaseUrl = parseTestDatabaseUrl(process.env);
const config = parseConfig({
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: testDatabaseUrl,
  LOG_LEVEL: 'silent',
});
const prisma = createPrismaClient(testDatabaseUrl);
const app = buildApp({ config, prisma });

beforeAll(async () => {
  app.get('/api/v1/test/internal-error', () => {
    throw new Error('sensitive integration-test marker');
  });

  await app.ready();
}, 15_000);

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('runtime foundation', () => {
  it('connects through Prisma to a database with committed migrations', async () => {
    const migrations = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM "_prisma_migrations"
    `;

    expect(migrations[0]?.count).toBeGreaterThanOrEqual(1);
  });

  it('returns contract-valid liveness and readiness responses', async () => {
    const liveResponse = await app.inject({
      method: 'GET',
      url: '/health/live',
    });
    const readyResponse = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    expect(liveResponse.statusCode).toBe(200);
    expect(LivenessResponseSchema.parse(liveResponse.json())).toEqual({
      status: 'live',
    });
    expect(readyResponse.statusCode).toBe(200);
    expect(ReadinessResponseSchema.parse(readyResponse.json()).status).toBe(
      'ready',
    );
  });

  it('propagates an acceptable request ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': 'integration-request-1' },
    });

    expect(response.headers['x-request-id']).toBe('integration-request-1');
  });

  it('serializes unknown errors without exposing internal details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/test/internal-error',
    });
    const body = ApiErrorResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(500);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.requestId).toBe(response.headers['x-request-id']);
    expect(response.body).not.toContain('sensitive integration-test marker');
  });

  it('enforces append-only audit events in PostgreSQL', async () => {
    const eventId = randomUUID();

    await prisma.auditEvent.create({
      data: {
        eventId,
        action: 'FOUNDATION_APPEND_ONLY_TEST',
        entityType: 'FOUNDATION_TEST',
      },
    });

    await expect(
      prisma.$executeRaw`
        UPDATE "audit_events"
        SET "action" = 'MUTATED'
        WHERE "event_id" = ${eventId}::uuid
      `,
    ).rejects.toThrow();

    await expect(
      prisma.$executeRaw`
        DELETE FROM "audit_events"
        WHERE "event_id" = ${eventId}::uuid
      `,
    ).rejects.toThrow();
  });
});
