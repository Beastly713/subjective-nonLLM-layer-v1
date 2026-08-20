import {
  ConfirmReductionBaselineRequestSchema,
  ProposeReductionTargetRequestSchema,
  SaveReductionBaselineDraftRequestSchema,
  StartReductionBaselineCorrectionRequestSchema,
  StartReductionBaselineRequestSchema,
} from '@aud-subjective/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import type { Clock } from '../../shared/clock/clock.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import {
  executeIdempotently,
  requireIdempotencyKey,
} from '../../shared/authz/idempotency.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import {
  confirmReductionBaseline,
  loadReductionSetupProjection,
  proposeReductionTarget,
  saveReductionBaselineDraft,
  startReductionBaseline,
  startReductionBaselineCorrection,
} from './reduction-service.js';

async function requirePatientRead(
  request: FastifyRequest,
  auth: AppAuth,
  prisma: PrismaClient,
  config: AppConfig,
) {
  const actor = await requirePermission(
    request,
    auth,
    prisma,
    config,
    'PATIENT_ONBOARDING_READ',
  );
  if (!actor.access.scopeKinds.includes('OWN_PATIENT')) {
    throw new DomainError(
      403,
      'PERMISSION_DENIED',
      'The action is not permitted.',
    );
  }
  return actor;
}

async function requirePatientWrite(
  request: FastifyRequest,
  auth: AppAuth,
  prisma: PrismaClient,
  config: AppConfig,
) {
  const actor = await requirePermission(
    request,
    auth,
    prisma,
    config,
    'PATIENT_ONBOARDING_UPDATE',
  );
  if (!actor.access.scopeKinds.includes('OWN_PATIENT')) {
    throw new DomainError(
      403,
      'PERMISSION_DENIED',
      'The action is not permitted.',
    );
  }
  return actor;
}

export function registerReductionSetupRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.get('/api/v1/patient/reduction-setup', async (request) => {
    const actor = await requirePatientRead(request, auth, prisma, config);
    return loadReductionSetupProjection(prisma, actor.userId);
  });

  app.post('/api/v1/patient/reduction-setup/baseline-draft', async (request) => {
    const actor = await requirePatientWrite(request, auth, prisma, config);
    const body = StartReductionBaselineRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'REDUCTION_BASELINE_START',
      key,
      body,
      (tx) =>
        startReductionBaseline(
          {
            tx,
            patientId: actor.userId,
            actorId: actor.userId,
            requestId: request.id,
            clock,
          },
          body.expectedVersion,
        ),
    );
    return result.value;
  });

  app.put('/api/v1/patient/reduction-setup/baseline-draft', async (request) => {
    const actor = await requirePatientWrite(request, auth, prisma, config);
    const body = SaveReductionBaselineDraftRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'REDUCTION_BASELINE_SAVE',
      key,
      body,
      (tx) =>
        saveReductionBaselineDraft(
          {
            tx,
            patientId: actor.userId,
            actorId: actor.userId,
            requestId: request.id,
            clock,
          },
          body.expectedVersion,
          body.days,
        ),
    );
    return result.value;
  });

  app.post('/api/v1/patient/reduction-setup/baseline-confirm', async (request) => {
    const actor = await requirePatientWrite(request, auth, prisma, config);
    const body = ConfirmReductionBaselineRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'REDUCTION_BASELINE_CONFIRM',
      key,
      body,
      (tx) =>
        confirmReductionBaseline(
          {
            tx,
            patientId: actor.userId,
            actorId: actor.userId,
            requestId: request.id,
            clock,
          },
          body.expectedVersion,
        ),
    );
    return result.value;
  });

  app.post('/api/v1/patient/reduction-setup/baseline-correction', async (request) => {
    const actor = await requirePatientWrite(request, auth, prisma, config);
    const body = StartReductionBaselineCorrectionRequestSchema.parse(
      request.body,
    );
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'REDUCTION_BASELINE_CORRECTION_START',
      key,
      body,
      (tx) =>
        startReductionBaselineCorrection(
          {
            tx,
            patientId: actor.userId,
            actorId: actor.userId,
            requestId: request.id,
            clock,
          },
          body.expectedVersion,
          body.reason,
        ),
    );
    return result.value;
  });

  app.post('/api/v1/patient/reduction-setup/target-proposal', async (request) => {
    const actor = await requirePatientWrite(request, auth, prisma, config);
    const body = ProposeReductionTargetRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'REDUCTION_TARGET_PROPOSE',
      key,
      body,
      (tx) =>
        proposeReductionTarget(
          {
            tx,
            patientId: actor.userId,
            actorId: actor.userId,
            requestId: request.id,
            clock,
          },
          body.expectedVersion,
          body.targetWeeklyStandardDrinks,
        ),
    );
    return result.value;
  });
}
