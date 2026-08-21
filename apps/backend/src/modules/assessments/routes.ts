import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import type { Clock } from '../../shared/clock/clock.js';
import {
  saveWeeklyAssessmentDraft,
  startOrResumeWeeklyCheckIn,
} from './service.js';

const AssessmentParamsSchema = z.object({ assessmentId: z.uuid() });

function requireOwnPatient(actor: Awaited<ReturnType<typeof requirePermission>>) {
  if (!actor.access.scopeKinds.includes('OWN_PATIENT')) {
    throw new DomainError(403, 'PERMISSION_DENIED', 'The action is not permitted.');
  }
}

export function registerAssessmentRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.post('/api/v1/patient/check-in/start', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ASSESSMENT_READ',
    );
    requireOwnPatient(actor);
    return prisma.$transaction((tx) =>
      startOrResumeWeeklyCheckIn(tx, clock, actor.userId),
    );
  });

  app.put('/api/v1/patient/assessments/:assessmentId/draft', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ASSESSMENT_UPDATE',
    );
    requireOwnPatient(actor);
    const { assessmentId } = AssessmentParamsSchema.parse(request.params);
    return prisma.$transaction((tx) =>
      saveWeeklyAssessmentDraft(
        tx,
        clock,
        actor.userId,
        assessmentId,
        request.body,
      ),
    );
  });
}
