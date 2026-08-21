import {
  ClinicianEngagementItemSchema,
  ClinicianEngagementResponseSchema,
  EngagementCaseActionRequestSchema,
  PatientHomeResponseSchema,
  PatientMonitoringActionRequestSchema,
  PatientMonitoringResponseSchema,
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
  optOutMonitoring,
  readClinicianEngagementDetail,
  readClinicianEngagementQueue,
  readPatientHome,
  readPatientMonitoring,
  reEnableMonitoring,
  transitionEngagementCase,
} from './service.js';

const PatientParamsSchema = z.object({ patientId: z.uuid() });
const CaseParamsSchema = z.object({ caseId: z.uuid() });

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

  app.get('/api/v1/clinician/engagement', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'ENGAGEMENT_READ',
    );
    if (!actor.access.scopeKinds.includes('ASSIGNED_PATIENTS')) {
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    }
    return ClinicianEngagementResponseSchema.parse(
      await readClinicianEngagementQueue(prisma, clock, actor.userId),
    );
  });

  app.get(
    '/api/v1/clinician/patients/:patientId/engagement',
    async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'ENGAGEMENT_READ',
      );
      if (!actor.access.scopeKinds.includes('ASSIGNED_PATIENTS')) {
        throw new DomainError(
          403,
          'PERMISSION_DENIED',
          'The action is not permitted.',
        );
      }
      const { patientId } = PatientParamsSchema.parse(request.params);
      const response = await prisma.$transaction((tx) =>
        readClinicianEngagementDetail({
          tx,
          clock,
          clinicianId: actor.userId,
          patientId,
        }),
      );
      return ClinicianEngagementItemSchema.parse(response);
    },
  );

  for (const action of ['acknowledge', 'outreach'] as const) {
    app.post(
      `/api/v1/clinician/engagement-cases/:caseId/${
        action === 'outreach' ? 'start-outreach' : action
      }`,
      async (request) => {
        const actor = await requirePermission(
          request,
          auth,
          prisma,
          config,
          action === 'acknowledge'
            ? 'ENGAGEMENT_CASE_ACKNOWLEDGE'
            : 'ENGAGEMENT_CASE_OUTREACH',
        );
        if (!actor.access.scopeKinds.includes('ASSIGNED_PATIENTS')) {
          throw new DomainError(
            403,
            'PERMISSION_DENIED',
            'The action is not permitted.',
          );
        }
        const { caseId } = CaseParamsSchema.parse(request.params);
        const body = EngagementCaseActionRequestSchema.parse(request.body);
        const key = requireIdempotencyKey(request.headers['idempotency-key']);
        const result = await executeIdempotently(
          prisma,
          actor.userId,
          `ENGAGEMENT_CASE_${action.toUpperCase()}`,
          key,
          { caseId, ...body },
          (tx) =>
            transitionEngagementCase({
              tx,
              clock,
              clinicianId: actor.userId,
              caseId,
              expectedCaseVersion: body.expectedCaseVersion,
              target:
                action === 'acknowledge'
                  ? 'ACKNOWLEDGED'
                  : 'OUTREACH_IN_PROGRESS',
              requestId: request.id,
            }),
        );
        return ClinicianEngagementItemSchema.parse(result.value);
      },
    );
  }
}
