import {
  PatientHomeResponseSchema,
  PatientMonitoringActionRequestSchema,
  PatientMonitoringResponseSchema,
} from '@aud-subjective/contracts';
import type { FastifyInstance } from 'fastify';

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
  optOutMonitoring,
  readPatientHome,
  readPatientMonitoring,
  reEnableMonitoring,
} from './service.js';

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

export function registerEngagementRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.get('/api/v1/patient/home', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_HOME_READ',
    );
    requireOwnPatient(actor);
    const response = await prisma.$transaction((tx) =>
      readPatientHome(tx, clock, actor.userId, actor.userId, request.id),
    );
    return PatientHomeResponseSchema.parse(response);
  });

  app.get('/api/v1/patient/monitoring', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_MONITORING_READ',
    );
    requireOwnPatient(actor);
    const response = await prisma.$transaction((tx) =>
      readPatientMonitoring(tx, clock, actor.userId, actor.userId, request.id),
    );
    return PatientMonitoringResponseSchema.parse(response);
  });

  for (const action of ['opt-out', 're-enable'] as const) {
    app.post(`/api/v1/patient/monitoring/${action}`, async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'PATIENT_MONITORING_MANAGE',
      );
      requireOwnPatient(actor);
      const body = PatientMonitoringActionRequestSchema.parse(request.body);
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const result = await executeIdempotently(
        prisma,
        actor.userId,
        `PATIENT_MONITORING_${action === 'opt-out' ? 'OPT_OUT' : 'RE_ENABLE'}`,
        key,
        body,
        (tx) =>
          action === 'opt-out'
            ? optOutMonitoring({
                tx,
                clock,
                patientId: actor.userId,
                expectedVersion: body.expectedVersion,
                actorId: actor.userId,
                requestId: request.id,
              })
            : reEnableMonitoring({
                tx,
                clock,
                patientId: actor.userId,
                expectedVersion: body.expectedVersion,
                actorId: actor.userId,
                requestId: request.id,
              }),
      );
      return PatientMonitoringResponseSchema.parse(result.value);
    });
  }
}
