import {
  RecordTechnicalFailureRequestSchema,
  TechnicalFailureListResponseSchema,
  TechnicalFailureTransitionRequestSchema,
  TechnicalFailureViewSchema,
} from '@aud-subjective/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import {
  executeIdempotently,
  requireIdempotencyKey,
} from '../../shared/authz/idempotency.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import {
  confirmTechnicalFailure,
  correctTechnicalFailure,
  readTechnicalFailures,
  recordTechnicalFailure,
  resolveTechnicalFailure,
} from './service.js';

const FailureParamsSchema = z.object({ failureId: z.uuid() });

function requireOperationsScope(
  actor: Awaited<ReturnType<typeof requirePermission>>,
) {
  if (!actor.access.scopeKinds.includes('ADMIN_OPERATIONAL')) {
    throw new DomainError(
      403,
      'PERMISSION_DENIED',
      'The action is not permitted.',
    );
  }
}

export function registerOperationsRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.get('/api/v1/admin/operations/technical-failures', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'TECHNICAL_FAILURE_READ',
    );
    requireOperationsScope(actor);
    return TechnicalFailureListResponseSchema.parse(
      await readTechnicalFailures(prisma),
    );
  });

  app.post('/api/v1/admin/operations/technical-failures', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'ENGAGEMENT_TECHNICAL_OVERRIDE',
      { fresh: true },
    );
    requireOperationsScope(actor);
    const body = RecordTechnicalFailureRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'TECHNICAL_FAILURE_RECORD',
      key,
      body,
      (tx) =>
        recordTechnicalFailure({
          tx,
          clock,
          actorId: actor.userId,
          requestId: request.id,
          body,
        }),
    );
    return TechnicalFailureViewSchema.parse(result.value);
  });

  for (const action of ['confirm', 'resolve', 'correct'] as const) {
    app.post(
      `/api/v1/admin/operations/technical-failures/:failureId/${action}`,
      async (request) => {
        const actor = await requirePermission(
          request,
          auth,
          prisma,
          config,
          'ENGAGEMENT_TECHNICAL_OVERRIDE',
          { fresh: true },
        );
        requireOperationsScope(actor);
        const { failureId } = FailureParamsSchema.parse(request.params);
        const body = TechnicalFailureTransitionRequestSchema.parse(
          request.body,
        );
        const key = requireIdempotencyKey(request.headers['idempotency-key']);
        const result = await executeIdempotently(
          prisma,
          actor.userId,
          `TECHNICAL_FAILURE_${action.toUpperCase()}`,
          key,
          { failureId, ...body },
          (tx) =>
            action === 'confirm'
              ? confirmTechnicalFailure({
                  tx,
                  clock,
                  failureId,
                  expectedVersion: body.expectedVersion,
                  reason: body.reason,
                  actorId: actor.userId,
                  requestId: request.id,
                })
              : action === 'resolve'
                ? resolveTechnicalFailure({
                    tx,
                    clock,
                    failureId,
                    expectedVersion: body.expectedVersion,
                    reason: body.reason,
                    actorId: actor.userId,
                    requestId: request.id,
                  })
                : correctTechnicalFailure({
                    tx,
                    clock,
                    failureId,
                    expectedVersion: body.expectedVersion,
                    reason: body.reason,
                    actorId: actor.userId,
                    requestId: request.id,
                  }),
        );
        return TechnicalFailureViewSchema.parse(result.value);
      },
    );
  }
}
