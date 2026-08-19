import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { readPatientSchedule } from './service.js';
import type { Clock } from '../../shared/clock/clock.js';

const PatientParamsSchema = z.object({ patientId: z.uuid() });

export function registerScheduleRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.get('/api/v1/patient/schedule', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_SCHEDULE_READ',
    );
    if (!actor.access.scopeKinds.includes('OWN_PATIENT'))
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    return readPatientSchedule(prisma, actor.userId, clock);
  });

  app.get('/api/v1/clinician/patients/:patientId/schedule', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_SCHEDULE_READ',
    );
    if (!actor.access.scopeKinds.includes('ASSIGNED_PATIENTS'))
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    const { patientId } = PatientParamsSchema.parse(request.params);
    const assignment = await prisma.clinicianPatientAssignment.findFirst({
      where: {
        clinicianUserId: actor.userId,
        patientId,
        endedAt: null,
        patient: {
          patientProfile: { isNot: null },
          applicationAccount: { is: { state: 'ACTIVE' } },
        },
      },
      select: { id: true },
    });
    if (!assignment)
      throw new DomainError(
        404,
        'NOT_FOUND',
        'The requested resource was not found.',
      );
    return readPatientSchedule(prisma, patientId, clock);
  });
}
