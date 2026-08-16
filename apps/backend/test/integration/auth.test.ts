import {
  AuthCapabilitiesResponseSchema,
  CurrentSessionResponseSchema,
} from '@aud-subjective/contracts';
import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../src/app.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createAuth } from '../../src/infrastructure/auth/auth.js';
import { applySessionPolicy } from '../../src/infrastructure/auth/session-policy.js';
import {
  loadRootEnvironment,
  parseConfig,
  parseTestDatabaseUrl,
} from '../../src/infrastructure/config/config.js';
import { createPrismaClient } from '../../src/infrastructure/db/prisma.js';
import {
  FakeAuthEmailSender,
  UnavailableAuthEmailSender,
} from '../../src/infrastructure/email/auth-email-sender.js';

loadRootEnvironment();

const databaseUrl = parseTestDatabaseUrl(process.env);
const config = parseConfig({
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: 'silent',
  APP_MODE: 'prototype',
  BETTER_AUTH_SECRET: 'auth-integration-secret-at-least-32-characters-long',
  APP_BASE_URL: 'http://127.0.0.1:3000',
});
const prisma = createPrismaClient(databaseUrl);
const fakeEmailSender = new FakeAuthEmailSender();
const auth = createAuth(prisma, config, fakeEmailSender);
const fixtureAuth = createAuth(prisma, config, fakeEmailSender, {
  allowSignUpForFixtureCreation: true,
});
const app = buildApp({ config, prisma, auth, emailSender: fakeEmailSender });
const email = 'auth-fixture@example.test';
const password = 'auth-fixture-password-29';

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of value.replaceAll('=', '').toUpperCase()) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  }
  const bytes =
    bits.match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) ?? [];
  return Buffer.from(bytes);
}

function currentTotp(secret: string) {
  const counter = Math.floor(Date.now() / 30_000);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret))
    .update(counterBytes)
    .digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return binary.toString().padStart(6, '0');
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await fixtureAuth.api.signUpEmail({
    body: { email, password, name: 'Auth Fixture' },
  });
  await prisma.user.update({ where: { email }, data: { emailVerified: true } });
  await app.ready();
}, 15_000);

afterAll(async () => {
  await app.close();
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('authentication and session foundation', () => {
  it('has the committed Better Auth tables', async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('user', 'session', 'account', 'verification', 'twoFactor')
    `;
    expect(rows.map(({ table_name }) => table_name).sort()).toEqual(
      ['account', 'session', 'twoFactor', 'user', 'verification'].sort(),
    );
  });

  it('keeps public email signup disabled', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: config.appBaseUrl },
      payload: { email: 'public-signup@example.test', password, name: 'No' },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(
      await prisma.user.findUnique({
        where: { email: 'public-signup@example.test' },
      }),
    ).toBeNull();
  });

  it('creates, projects, and revokes a cookie session without leaking its token', async () => {
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.appBaseUrl },
      payload: { email, password },
    });
    expect(signIn.statusCode).toBe(200);
    const cookie = signIn.cookies.find(({ name }) =>
      name.includes('session_token'),
    );
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    expect(cookie?.domain).toBeUndefined();

    const projected = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { cookie: `${cookie?.name}=${cookie?.value}` },
    });
    const body = CurrentSessionResponseSchema.parse(projected.json());
    expect(body.authenticated).toBe(true);
    expect(projected.body).not.toContain(cookie?.value ?? 'never');
    expect(projected.body).not.toContain('token');

    const signOut = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: {
        origin: config.appBaseUrl,
        cookie: `${cookie?.name}=${cookie?.value}`,
      },
    });
    expect(signOut.statusCode).toBe(200);

    const revoked = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { cookie: `${cookie?.name}=${cookie?.value}` },
    });
    expect(CurrentSessionResponseSchema.parse(revoked.json())).toEqual({
      authenticated: false,
      reason: 'expired_or_revoked',
    });
  });

  it('returns generic invalid-credential failures and rejects untrusted origins', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.appBaseUrl },
      payload: { email: 'unknown@example.test', password: 'not-the-password' },
    });
    expect(invalid.statusCode).toBe(401);
    expect(invalid.body).not.toContain('unknown@example.test');

    const untrusted = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: 'https://attacker.example' },
      payload: { email, password },
    });
    expect(untrusted.statusCode).toBe(403);
  });

  it('reports prototype email capability honestly', async () => {
    const unavailableConfig = parseConfig({
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      APP_MODE: 'prototype',
      BETTER_AUTH_SECRET: config.betterAuthSecret,
      APP_BASE_URL: config.appBaseUrl,
    });
    expect(unavailableConfig.authEmailDeliveryAvailable).toBe(false);
    expect(
      AuthCapabilitiesResponseSchema.parse({
        appMode: unavailableConfig.appMode,
        passwordRecoveryAvailable: false,
        emailVerificationDeliveryAvailable: false,
        twoFactorSupported: true,
      }).passwordRecoveryAvailable,
    ).toBe(false);
  });

  it('reports auth not ready while PostgreSQL remains ready when the auth schema is unavailable', async () => {
    const readinessPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]),
      user: {
        findFirst: vi
          .fn()
          .mockRejectedValue(new Error('auth schema test failure')),
      },
    } as unknown as PrismaClient;
    const readinessApp = buildApp({
      config,
      prisma: readinessPrisma,
      auth,
      emailSender: fakeEmailSender,
    });
    await readinessApp.ready();

    const ready = await readinessApp.inject({
      method: 'GET',
      url: '/health/ready',
    });
    expect(ready.statusCode).toBe(503);
    expect(ready.json().checks.postgres).toBe('ready');
    expect(ready.json().checks.authentication).toBe('not_ready');
    expect(readinessPrisma.user.findFirst).toHaveBeenCalledOnce();
    await readinessApp.close();
  });

  it('revokes sessions beyond the seven-day absolute ceiling', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const oldSession = await prisma.session.create({
      data: {
        userId: user.id,
        token: `old-${crypto.randomUUID()}`,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000),
        expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
      },
    });
    const result = await applySessionPolicy(prisma, {
      session: oldSession,
      user,
    });
    expect(result).toEqual({
      authenticated: false,
      reason: 'expired_or_revoked',
    });
    expect(
      await prisma.session.findUnique({ where: { id: oldSession.id } }),
    ).toBeNull();
  });

  it('keeps a TOTP-required login unauthenticated until the challenge succeeds', async () => {
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.appBaseUrl },
      payload: { email, password },
    });
    const sessionCookie = signIn.cookies.find(({ name }) =>
      name.includes('session_token'),
    );
    const enabled = await app.inject({
      method: 'POST',
      url: '/api/auth/two-factor/enable',
      headers: {
        origin: config.appBaseUrl,
        cookie: `${sessionCookie?.name}=${sessionCookie?.value}`,
      },
      payload: { password },
    });
    expect(enabled.statusCode).toBe(200);
    const totpUri = new URL(enabled.json<{ totpURI: string }>().totpURI);
    const totpSecret = totpUri.searchParams.get('secret');
    expect(totpSecret).toBeTruthy();
    const code = currentTotp(totpSecret ?? '');

    const confirmEnrollment = await app.inject({
      method: 'POST',
      url: '/api/auth/two-factor/verify-totp',
      headers: {
        origin: config.appBaseUrl,
        cookie: `${sessionCookie?.name}=${sessionCookie?.value}`,
      },
      payload: { code },
    });
    expect(confirmEnrollment.statusCode).toBe(200);
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: {
        origin: config.appBaseUrl,
        cookie: `${sessionCookie?.name}=${sessionCookie?.value}`,
      },
    });

    const challenged = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.appBaseUrl },
      payload: { email, password },
    });
    expect(
      challenged.json<{ twoFactorRedirect: boolean }>().twoFactorRedirect,
    ).toBe(true);
    const challengeCookie = challenged.cookies.find(({ name }) =>
      name.includes('two_factor'),
    );

    const incomplete = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: {
        cookie: challenged.cookies
          .map(({ name, value }) => `${name}=${value}`)
          .join('; '),
      },
    });
    expect(
      CurrentSessionResponseSchema.parse(incomplete.json()).authenticated,
    ).toBe(false);

    const failedChallenge = await app.inject({
      method: 'POST',
      url: '/api/auth/two-factor/verify-totp',
      headers: {
        origin: config.appBaseUrl,
        cookie: `${challengeCookie?.name}=${challengeCookie?.value}`,
      },
      payload: { code: '000000', trustDevice: false },
    });
    expect(failedChallenge.statusCode).toBeGreaterThanOrEqual(400);

    const verified = await app.inject({
      method: 'POST',
      url: '/api/auth/two-factor/verify-totp',
      headers: {
        origin: config.appBaseUrl,
        cookie: `${challengeCookie?.name}=${challengeCookie?.value}`,
      },
      payload: { code: currentTotp(totpSecret ?? ''), trustDevice: false },
    });
    expect(verified.statusCode).toBe(200);
    expect(
      verified.cookies.some(({ name }) => name.includes('session_token')),
    ).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.twoFactor.deleteMany({ where: { userId: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false },
    });
  });

  it('uses hardened host-only production cookies and blocks real-patient readiness without email', async () => {
    const productionConfig = parseConfig({
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
      APP_MODE: 'real_patient',
      BETTER_AUTH_SECRET: config.betterAuthSecret,
      APP_BASE_URL: 'https://accounts.example.test',
      LOG_LEVEL: 'silent',
    });
    const productionAuth = createAuth(
      prisma,
      productionConfig,
      new UnavailableAuthEmailSender(),
    );
    const productionApp = buildApp({
      config: productionConfig,
      prisma,
      auth: productionAuth,
      emailSender: new UnavailableAuthEmailSender(),
    });
    await productionApp.ready();

    const signIn = await productionApp.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: productionConfig.appBaseUrl },
      payload: { email, password },
    });
    const cookie = signIn.cookies.find(({ name }) =>
      name.includes('session_token'),
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    expect(cookie?.domain).toBeUndefined();

    const ready = await productionApp.inject({
      method: 'GET',
      url: '/health/ready',
    });
    expect(ready.statusCode).toBe(503);
    expect(ready.json().checks.authentication).toBe('not_ready');
    expect(ready.json().checks.authEmailDelivery).toBe('unavailable');

    const existingRecovery = await productionApp.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      headers: { origin: productionConfig.appBaseUrl },
      payload: {
        email,
        redirectTo: `${productionConfig.appBaseUrl}/reset-password`,
      },
    });
    const unknownRecovery = await productionApp.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      headers: { origin: productionConfig.appBaseUrl },
      payload: {
        email: 'unknown-recovery@example.test',
        redirectTo: `${productionConfig.appBaseUrl}/reset-password`,
      },
    });
    expect(existingRecovery.statusCode).toBe(503);
    expect(unknownRecovery.statusCode).toBe(existingRecovery.statusCode);
    expect(unknownRecovery.body).toBe(existingRecovery.body);
    await productionApp.close();
  });

  it('sends recovery through the fake adapter and revokes existing sessions on reset', async () => {
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.appBaseUrl },
      payload: { email, password },
    });
    const sessionCookie = signIn.cookies.find(({ name }) =>
      name.includes('session_token'),
    );
    expect(sessionCookie).toBeDefined();
    const recovery = await app.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      headers: { origin: config.appBaseUrl },
      payload: { email, redirectTo: `${config.appBaseUrl}/reset-password` },
    });
    expect(recovery.statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(fakeEmailSender.passwordResetMessages.at(-1)).toBeDefined();
    });
    const resetMessage = fakeEmailSender.passwordResetMessages.at(-1);
    expect(resetMessage?.email).toBe(email);
    const resetUrl = new URL(resetMessage?.url ?? '');
    const token =
      resetUrl.searchParams.get('token') ??
      decodeURIComponent(resetUrl.pathname.split('/').at(-1) ?? '');
    expect(token).toBeTruthy();

    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      headers: { origin: config.appBaseUrl },
      payload: { token, newPassword: 'replacement-auth-password-31' },
    });
    expect(reset.statusCode).toBe(200);
    const oldSession = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { cookie: `${sessionCookie?.name}=${sessionCookie?.value}` },
    });
    expect(CurrentSessionResponseSchema.parse(oldSession.json())).toEqual({
      authenticated: false,
      reason: 'expired_or_revoked',
    });
  });

  it('applies the focused credential rate limit', async () => {
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/auth/sign-in/email',
          headers: {
            origin: config.appBaseUrl,
            'x-forwarded-for': '198.51.100.23',
          },
          payload: {
            email: 'rate-limit@example.test',
            password: 'invalid-password',
          },
        }),
      ),
    );
    expect(responses.some(({ statusCode }) => statusCode === 429)).toBe(true);
  });
});
