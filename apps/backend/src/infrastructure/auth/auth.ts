import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';

import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AppConfig } from '../config/config.js';
import type { AuthEmailSender } from '../email/auth-email-sender.js';

export const SESSION_EXPIRES_IN_SECONDS = 12 * 60 * 60;
export const SESSION_UPDATE_AGE_SECONDS = 15 * 60;
export const SESSION_FRESH_AGE_SECONDS = 15 * 60;

type AuthEmailDeliveryKind = 'password_reset' | 'verification';

interface CreateAuthOptions {
  allowSignUpForFixtureCreation?: boolean;
  onEmailDeliveryFailure?: (kind: AuthEmailDeliveryKind) => void;
}

function dispatchAuthEmail(
  operation: () => Promise<void>,
  kind: AuthEmailDeliveryKind,
  onFailure?: (kind: AuthEmailDeliveryKind) => void,
) {
  void Promise.resolve()
    .then(operation)
    .catch(() => onFailure?.(kind));
}

export function createAuth(
  prisma: PrismaClient,
  config: AppConfig,
  emailSender: AuthEmailSender,
  options: CreateAuthOptions = {},
) {
  return betterAuth({
    appName: 'AUD Subjective Monitoring',
    baseURL: config.appBaseUrl,
    basePath: '/api/auth',
    secret: config.betterAuthSecret,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    trustedOrigins: config.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      disableSignUp: !options.allowSignUpForFixtureCreation,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) => {
        dispatchAuthEmail(
          () => emailSender.sendPasswordResetEmail({ email: user.email, url }),
          'password_reset',
          options.onEmailDeliveryFailure,
        );
        return Promise.resolve();
      },
    },
    emailVerification: {
      sendOnSignIn: emailSender.available,
      sendVerificationEmail: ({ user, url }) => {
        dispatchAuthEmail(
          () => emailSender.sendVerificationEmail({ email: user.email, url }),
          'verification',
          options.onEmailDeliveryFailure,
        );
        return Promise.resolve();
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      freshAge: SESSION_FRESH_AGE_SECONDS,
    },
    rateLimit: {
      enabled: true,
      storage: 'memory',
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
        '/two-factor/*': { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: config.nodeEnv === 'production',
      database: { generateId: 'uuid' },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        path: '/',
      },
    },
    plugins: [twoFactor({ issuer: 'AUD Subjective Monitoring' })],
  });
}

export type AppAuth = ReturnType<typeof createAuth>;
