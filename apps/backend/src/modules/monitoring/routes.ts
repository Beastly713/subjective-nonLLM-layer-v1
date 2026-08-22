import {
  ClinicianOverviewResponseSchema,
  ClinicianPatientDetailResponseSchema,
  PatientProgressResponseSchema,
} from '@aud-subjective/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import type { Clock } from '../../shared/clock/clock.js';
import {
  readClinicianOverview,
  readClinicianPatientDetail,
} from './clinician-overview-service.js';
import { readPatientProgress } from './progress-service.js';

const PatientParamsSchema = z.object({ patientId: z.uuid() });

function requireScope(
  actor: Awaited<ReturnType<typeof requirePermission>>,
  scope: 'OWN_PATIENT' | 'ASSIGNED_PATIENTS',
) {
  if (!actor.access.scopeKinds.includes(scope)) {
    throw new DomainError(403, 'PERMISSION_DENIED', 'The action is not permitted.');
  }
}

export function registerMonitoringRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.get('/api/v1/patient/progress', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_PROGRESS_READ',
    );
    requireScope(actor, 'OWN_PATIENT');
    const response = await prisma.$transaction((tx) =>
      readPatientProgress(tx, clock, actor.userId),
    );
    return PatientProgressResponseSchema.parse(response);
  });

  app.get('/api/v1/clinician/overview', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'CLINICIAN_OVERVIEW_READ',
    );
    requireScope(actor, 'ASSIGNED_PATIENTS');
    const response = await prisma.$transaction((tx) =>
      readClinicianOverview(tx, clock, actor.userId),
    );
    return ClinicianOverviewResponseSchema.parse(response);
  });

  app.get('/api/v1/clinician/patients/:patientId/detail', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_MONITORING_READ',
    );
    requireScope(actor, 'ASSIGNED_PATIENTS');
    const { patientId } = PatientParamsSchema.parse(request.params);
    const response = await prisma.$transaction((tx) =>
      readClinicianPatientDetail({
        tx,
        clock,
        clinicianId: actor.userId,
        patientId,
      }),
    );
    return ClinicianPatientDetailResponseSchema.parse(response);
  });
}
