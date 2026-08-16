import {
  LivenessResponseSchema,
  ReadinessResponseSchema,
} from '@aud-subjective/contracts';
import type { FastifyInstance } from 'fastify';

import type { PrismaClient } from '../generated/prisma/client.js';
import type { AppConfig } from '../infrastructure/config/config.js';

export function registerHealthRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  config: AppConfig,
) {
  app.get('/health/live', () =>
    LivenessResponseSchema.parse({ status: 'live' }),
  );

  app.get('/health/ready', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      request.log.warn(
        { errorCode: 'DATABASE_UNAVAILABLE' },
        'Readiness check failed',
      );

      return reply.status(503).send(
        ReadinessResponseSchema.parse({
          status: 'not_ready',
          checks: {
            configuration: 'ready',
            prisma: 'ready',
            postgres: 'not_ready',
            authentication: 'not_ready',
            authEmailDelivery: config.authEmailDeliveryAvailable
              ? 'available'
              : 'unavailable',
          },
        }),
      );
    }

    let authSchemaReady = true;
    try {
      await prisma.user.findFirst({ select: { id: true } });
    } catch {
      authSchemaReady = false;
      request.log.warn(
        { errorCode: 'AUTH_SCHEMA_UNAVAILABLE' },
        'Authentication readiness check failed',
      );
    }

    const emailRequiredButUnavailable =
      config.appMode === 'real_patient' && !config.authEmailDeliveryAvailable;
    const authentication =
      authSchemaReady && !emailRequiredButUnavailable ? 'ready' : 'not_ready';
    const response = ReadinessResponseSchema.parse({
      status: authentication,
      checks: {
        configuration: 'ready',
        prisma: 'ready',
        postgres: 'ready',
        authentication,
        authEmailDelivery: config.authEmailDeliveryAvailable
          ? 'available'
          : 'unavailable',
      },
    });

    return response.status === 'not_ready'
      ? reply.status(503).send(response)
      : response;
  });
}
