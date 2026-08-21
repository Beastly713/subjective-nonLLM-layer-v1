import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CheckInAssessmentDetailSchema,
  CheckInHistoryResponseSchema,
  CheckInMutationReceiptSchema,
  StaffWeeklyAssessmentCorrectionRequestSchema,
  SubmitWeeklyAssessmentRequestSchema,
  SubmitWeeklyAssessmentResponseSchema,
  WeeklyAssessmentCorrectionRequestSchema,
} from '@aud-subjective/contracts';

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
  saveWeeklyAssessmentDraft,
  startOrResumeWeeklyCheckIn,
} from './service.js';
import { submitWeeklyAssessment } from './submission-service.js';
import { correctWeeklyAssessment } from './correction-service.js';
import {
  readCheckInAssessmentDetail,
  readCheckInHistory,
  startWeeklyAssessmentBackfill,
} from './history-service.js';

const AssessmentParamsSchema = z.object({ assessmentId: z.uuid() });
const PeriodParamsSchema = z.object({ periodId: z.uuid() });
const StaffAssessmentParamsSchema = z.object({
  patientId: z.uuid(),
  assessmentId: z.uuid(),
});

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

  app.get('/api/v1/patient/check-in/history', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ASSESSMENT_READ',
    );
    requireOwnPatient(actor);
    return readCheckInHistoryInTransaction(prisma, clock, actor.userId);
  });

  app.get('/api/v1/patient/assessments/:assessmentId', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ASSESSMENT_READ',
    );
    requireOwnPatient(actor);
    const { assessmentId } = AssessmentParamsSchema.parse(request.params);
    const detail = await prisma.$transaction((tx) =>
      readCheckInAssessmentDetail(tx, clock, actor.userId, assessmentId),
    );
    return CheckInAssessmentDetailSchema.parse(detail);
  });

  app.post('/api/v1/patient/check-in/backfill/:periodId/start', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ASSESSMENT_UPDATE',
    );
    requireOwnPatient(actor);
    const { periodId } = PeriodParamsSchema.parse(request.params);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'PATIENT_WEEKLY_ASSESSMENT_BACKFILL_START',
      key,
      { periodId },
      (tx) => startWeeklyAssessmentBackfill(tx, clock, actor.userId, periodId),
    );
    return result.value;
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

  app.post('/api/v1/patient/assessments/:assessmentId/submit', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ASSESSMENT_UPDATE',
    );
    requireOwnPatient(actor);
    const { assessmentId } = AssessmentParamsSchema.parse(request.params);
    const body = SubmitWeeklyAssessmentRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const idempotencyPayload = { assessmentId, ...body };
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'PATIENT_WEEKLY_ASSESSMENT_SUBMIT',
      key,
      idempotencyPayload,
      (tx) =>
        submitWeeklyAssessment({
          tx,
          clock,
          patientId: actor.userId,
          assessmentId,
          request: body,
          requestId: request.id,
        }),
    );
    return SubmitWeeklyAssessmentResponseSchema.parse(result.value);
  });

  app.post('/api/v1/patient/assessments/:assessmentId/backfill-submit', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ASSESSMENT_UPDATE',
    );
    requireOwnPatient(actor);
    const { assessmentId } = AssessmentParamsSchema.parse(request.params);
    const body = SubmitWeeklyAssessmentRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'PATIENT_WEEKLY_ASSESSMENT_BACKFILL_SUBMIT',
      key,
      { assessmentId, ...body },
      (tx) =>
        submitWeeklyAssessment({
          tx,
          clock,
          patientId: actor.userId,
          assessmentId,
          request: body,
          requestId: request.id,
          allowHistoricalBackfill: true,
        }),
    );
    return SubmitWeeklyAssessmentResponseSchema.parse(result.value);
  });

  app.post('/api/v1/patient/assessments/:assessmentId/corrections', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ASSESSMENT_UPDATE',
    );
    requireOwnPatient(actor);
    const { assessmentId } = AssessmentParamsSchema.parse(request.params);
    const body = WeeklyAssessmentCorrectionRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'PATIENT_WEEKLY_ASSESSMENT_CORRECTION',
      key,
      { assessmentId, ...body },
      (tx) =>
        correctWeeklyAssessment({
          tx,
          clock,
          patientId: actor.userId,
          assessmentId,
          request: body,
          requestId: request.id,
          actorId: actor.userId,
          actorType: 'PATIENT',
        }),
    );
    return SubmitWeeklyAssessmentResponseSchema.parse(result.value);
  });

  app.post('/api/v1/clinician/patients/:patientId/assessments/:assessmentId/corrections', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ASSESSMENT_STAFF_CORRECT',
      { fresh: true },
    );
    if (!actor.access.scopeKinds.includes('ASSIGNED_PATIENTS')) {
      throw new DomainError(403, 'PERMISSION_DENIED', 'The action is not permitted.');
    }
    const { patientId, assessmentId } = StaffAssessmentParamsSchema.parse(request.params);
    const assignment = await prisma.clinicianPatientAssignment.findFirst({
      where: {
        clinicianUserId: actor.userId,
        patientId,
        endedAt: null,
        patient: { applicationAccount: { is: { state: 'ACTIVE' } } },
      },
      select: { id: true },
    });
    if (!assignment) throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
    const body = StaffWeeklyAssessmentCorrectionRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'STAFF_WEEKLY_ASSESSMENT_CORRECTION',
      key,
      { patientId, assessmentId, ...body },
      (tx) =>
        correctWeeklyAssessment({
          tx,
          clock,
          patientId,
          assessmentId,
          request: body,
          requestId: request.id,
          actorId: actor.userId,
          actorType: 'CLINICIAN',
        }),
    );
    return CheckInMutationReceiptSchema.parse(result.value);
  });
}

async function readCheckInHistoryInTransaction(
  prisma: PrismaClient,
  clock: Clock,
  patientId: string,
) {
  const result = await prisma.$transaction((tx) =>
    readCheckInHistory(tx, clock, patientId),
  );
  return CheckInHistoryResponseSchema.parse(result);
}
