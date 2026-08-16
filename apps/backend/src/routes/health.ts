import {
  LivenessResponseSchema,
  ReadinessResponseSchema,
} from '@aud-subjective/contracts';
import type { FastifyInstance } from 'fastify';

import type { PrismaClient } from '../generated/prisma/client.js';

export function registerHealthRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
) {
  app.get('/health/live', () =>
    LivenessResponseSchema.parse({ status: 'live' }),
  );

  app.get('/health/ready', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      return ReadinessResponseSchema.parse({
        status: 'ready',
        checks: {
          configuration: 'ready',
          prisma: 'ready',
          postgres: 'ready',
        },
      });
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
          },
        }),
      );
    }
  });
}
