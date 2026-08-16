import { AuthCapabilitiesResponseSchema } from '@aud-subjective/contracts';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyInstance } from 'fastify';

import type { PrismaClient } from '../generated/prisma/client.js';
import type { AppAuth } from '../infrastructure/auth/auth.js';
import { applySessionPolicy } from '../infrastructure/auth/session-policy.js';
import type { AppConfig } from '../infrastructure/config/config.js';
import type { AuthEmailSender } from '../infrastructure/email/auth-email-sender.js';

export function registerApplicationAuthRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  emailSender: AuthEmailSender,
) {
  app.get('/api/v1/auth/capabilities', () =>
    AuthCapabilitiesResponseSchema.parse({
      appMode: config.appMode,
      passwordRecoveryAvailable: emailSender.available,
      emailVerificationDeliveryAvailable: emailSender.available,
      twoFactorSupported: true,
    }),
  );

  app.get('/api/v1/auth/session', async (request) => {
    const resolved = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    return applySessionPolicy(
      prisma,
      resolved,
      new Date(),
      request.headers.cookie?.includes('session_token=') ?? false,
    );
  });
}
