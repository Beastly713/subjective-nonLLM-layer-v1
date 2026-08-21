import {
  ContentExploreRequestSchema,
  ContentFeedbackRequestSchema,
  ContentInterventionClassSchema,
  PatientSupportResponseSchema,
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
import { DomainError } from '../../shared/errors/domain-error.js';
import type { Clock } from '../../shared/clock/clock.js';
import {
  explorePatientSupport,
  readPatientSupport,
  recordContentFeedback,
  restoreContentClass,
} from './service.js';

const ResourceParamsSchema = z.object({ resourceId: z.uuid() });
const InterventionClassParamsSchema = z.object({
  interventionClass: ContentInterventionClassSchema,
});

function requireOwnPatient(
  actor: Awaited<ReturnType<typeof requirePermission>>,
) {
  if (!actor.access.scopeKinds.includes('OWN_PATIENT')) {
    throw new DomainError(
      403,
      'PERMISSION_DENIED',
      'The action is not permitted.',
    );
  }
}

export function registerContentRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.get('/api/v1/patient/support', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_SUPPORT_READ',
    );
    requireOwnPatient(actor);
    const response = await prisma.$transaction((tx) =>
      readPatientSupport(tx, clock, actor.userId),
    );
    return PatientSupportResponseSchema.parse(response);
  });

  app.post('/api/v1/patient/support/explore', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_SUPPORT_READ',
    );
    requireOwnPatient(actor);
    const body = ContentExploreRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'PATIENT_SUPPORT_EXPLORE',
      key,
      body,
      (tx) =>
        explorePatientSupport({
          tx,
          clock,
          patientId: actor.userId,
          interventionClass: body.interventionClass,
        }),
    );
    return PatientSupportResponseSchema.parse(result.value);
  });

  app.post(
    '/api/v1/patient/support/resources/:resourceId/feedback',
    async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'PATIENT_SUPPORT_FEEDBACK',
      );
      requireOwnPatient(actor);
      const { resourceId } = ResourceParamsSchema.parse(request.params);
      const body = ContentFeedbackRequestSchema.parse(request.body);
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const result = await executeIdempotently(
        prisma,
        actor.userId,
        'PATIENT_SUPPORT_FEEDBACK',
        key,
        { resourceId, ...body },
        async (tx) => {
          const feedback = await recordContentFeedback({
            tx,
            clock,
            patientId: actor.userId,
            resourceId,
            resourceVersionId: body.resourceVersionId,
            resolutionId: body.resolutionId,
            outcome: body.outcome,
            requestId: request.id,
          });
          if (!feedback) {
            throw new DomainError(
              404,
              'CONTENT_RESOURCE_NOT_FOUND',
              'The support resource is no longer available.',
            );
          }
          return { recorded: true };
        },
      );
      return result.value;
    },
  );

  app.post(
    '/api/v1/patient/support/intervention-classes/:interventionClass/restore',
    async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'PATIENT_SUPPORT_FEEDBACK',
      );
      requireOwnPatient(actor);
      const { interventionClass } = InterventionClassParamsSchema.parse(
        request.params,
      );
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const result = await executeIdempotently(
        prisma,
        actor.userId,
        'PATIENT_SUPPORT_CLASS_RESTORE',
        key,
        { interventionClass },
        async (tx) => {
          await restoreContentClass({
            tx,
            clock,
            patientId: actor.userId,
            interventionClass,
            requestId: request.id,
          });
          return { restored: true };
        },
      );
      return result.value;
    },
  );
}
