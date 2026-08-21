import {
  AcknowledgeClinicalCaseRequestSchema,
  ClinicianPatientMonitoringResponseSchema,
  ClinicianReviewQueueResponseSchema,
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
  acknowledgeClinicalCase,
  readClinicianPatientMonitoring,
  readClinicalReviewQueue,
} from './service.js';

const PatientParamsSchema = z.object({ patientId: z.uuid() });
const CaseParamsSchema = z.object({ caseId: z.uuid() });

function requireAssignedScope(
  actor: Awaited<ReturnType<typeof requirePermission>>,
) {
  if (!actor.access.scopeKinds.includes('ASSIGNED_PATIENTS')) {
    throw new DomainError(
      403,
      'PERMISSION_DENIED',
      'The action is not permitted.',
    );
  }
}

export function registerClinicalRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.get('/api/v1/clinician/review-queue', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'CLINICAL_REVIEW_READ',
    );
    requireAssignedScope(actor);
    const response = await prisma.$transaction((tx) =>
      readClinicalReviewQueue(tx, clock, actor.userId),
    );
    return ClinicianReviewQueueResponseSchema.parse(response);
  });

  app.get('/api/v1/clinician/patients/:patientId/monitoring', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_MONITORING_READ',
    );
    requireAssignedScope(actor);
    const { patientId } = PatientParamsSchema.parse(request.params);
    const response = await prisma.$transaction((tx) =>
      readClinicianPatientMonitoring({
        tx,
        clock,
        clinicianId: actor.userId,
        patientId,
      }),
    );
    return ClinicianPatientMonitoringResponseSchema.parse(response);
  });

  app.post('/api/v1/clinician/review-cases/:caseId/acknowledge', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'CLINICAL_REVIEW_ACKNOWLEDGE',
    );
    requireAssignedScope(actor);
    const { caseId } = CaseParamsSchema.parse(request.params);
    const body = AcknowledgeClinicalCaseRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'CLINICAL_REVIEW_CASE_ACKNOWLEDGE',
      key,
      { caseId, ...body },
      (tx) =>
        acknowledgeClinicalCase({
          tx,
          clock,
          clinicianId: actor.userId,
          caseId,
          expectedCaseVersion: body.expectedCaseVersion,
          requestId: request.id,
        }),
    );
    return ClinicianPatientMonitoringResponseSchema.parse(result.value);
  });
}
