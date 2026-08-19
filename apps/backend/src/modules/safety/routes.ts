import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Prisma, PrismaClient, SafetyCaseLifecycle } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import { executeIdempotently, requireIdempotencyKey } from '../../shared/authz/idempotency.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { assertSafetyTransition } from './lifecycle.js';
import { projectPatientSafety, projectSafetyCase, safetyCaseInclude } from './projections.js';

const CaseParams = z.object({ caseId: z.uuid() });
const MutationBody = z.object({ expectedVersion: z.number().int().positive(), reason: z.string().trim().min(1).max(1000) });
const DispositionBody = MutationBody.extend({
  disposition: z.enum([
    'SAFE_TO_CONTINUE_STANDARD_MONITORING',
    'SAFE_TO_CONTINUE_WITH_RESTRICTIONS',
    'CONTINUE_CLINICAL_HANDOFF',
    'EMERGENCY_EXTERNAL_MANAGEMENT',
    'MONITORING_TEMPORARILY_PAUSED',
  ]),
});

function nextLifecycle(endpoint: string): SafetyCaseLifecycle {
  if (endpoint === 'acknowledge') return 'ACKNOWLEDGED';
  if (endpoint === 'begin-review') return 'CLINICAL_REVIEW_IN_PROGRESS';
  if (endpoint === 'establish-plan') return 'PLAN_ESTABLISHED';
  if (endpoint === 'escalate') return 'ESCALATED_TO_EMERGENCY';
  return 'RESOLVED_EXTERNAL_HANDOFF';
}

async function assignedCase(prisma: PrismaClient, clinicianUserId: string, caseId: string) {
  const safetyCase = await prisma.safetyCase.findFirst({
    where: {
      id: caseId,
      profile: {
        patient: {
          applicationAccount: { is: { state: 'ACTIVE' } },
          patientAssignments: { some: { clinicianUserId, endedAt: null } },
        },
      },
    },
    include: safetyCaseInclude,
  });
  if (!safetyCase) throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
  return safetyCase;
}

export function registerSafetyRoutes(app: FastifyInstance, prisma: PrismaClient, auth: AppAuth, config: AppConfig) {
  app.get('/api/v1/patient/safety', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'PATIENT_SAFETY_READ');
    const cases = await prisma.safetyCase.findMany({ where: { patientId: actor.userId, resolvedAt: null }, include: safetyCaseInclude });
    return projectPatientSafety(cases);
  });

  app.get('/api/v1/clinician/safety-cases', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'SAFETY_CASE_READ');
    if (!actor.access.scopeKinds.includes('ASSIGNED_PATIENTS')) throw new DomainError(403, 'PERMISSION_DENIED', 'The action is not permitted.');
    const cases = await prisma.safetyCase.findMany({
      where: { profile: { patient: { applicationAccount: { is: { state: 'ACTIVE' } }, patientAssignments: { some: { clinicianUserId: actor.userId, endedAt: null } } } } },
      include: safetyCaseInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });
    return { items: cases.map(projectSafetyCase) };
  });

  app.get('/api/v1/clinician/safety-cases/:caseId', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'SAFETY_CASE_READ');
    const { caseId } = CaseParams.parse(request.params);
    return projectSafetyCase(await assignedCase(prisma, actor.userId, caseId));
  });

  for (const endpoint of ['acknowledge', 'begin-review', 'establish-plan', 'escalate', 'resolve-external-handoff'] as const) {
    app.post(`/api/v1/clinician/safety-cases/:caseId/${endpoint}`, async (request) => {
      const actor = await requirePermission(request, auth, prisma, config, 'SAFETY_CASE_ACKNOWLEDGE', { fresh: true });
      const { caseId } = CaseParams.parse(request.params);
      const body = MutationBody.parse(request.body);
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const result = await executeIdempotently(prisma, actor.userId, `SAFETY_CASE_${endpoint.toUpperCase()}`, key, { caseId, ...body }, async (tx) => {
        const current = await assignedCase(tx as PrismaClient, actor.userId, caseId);
        await lockPatientForProcessing(tx, current.patientId);
        if (current.version !== body.expectedVersion) throw new DomainError(409, 'VERSION_CONFLICT', 'The safety case changed before this update.');
        const toState = nextLifecycle(endpoint);
        assertSafetyTransition(current.lifecycle, toState);
        const resolvedAt = ['RESOLVED_EXTERNAL_HANDOFF'].includes(toState) ? new Date() : null;
        const updated = await tx.safetyCase.update({ where: { id: caseId }, data: { lifecycle: toState, version: { increment: 1 }, ...(resolvedAt ? { resolvedAt } : {}) }, include: safetyCaseInclude });
        await tx.safetyCaseLifecycleEvent.create({ data: { caseId, fromState: current.lifecycle, toState, actorId: actor.userId, reason: body.reason, requestId: request.id } });
        await tx.auditEvent.create({ data: { actorId: actor.userId, actorRole: 'CLINICIAN', action: `SAFETY_CASE_${endpoint.toUpperCase()}`, entityType: 'SAFETY_CASE', entityId: caseId, patientId: current.patientId, requestId: request.id, metadata: { fromState: current.lifecycle, toState } } });
        return projectSafetyCase(updated);
      });
      return result.value;
    });
  }

  app.post('/api/v1/clinician/safety-cases/:caseId/disposition', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'SAFETY_CASE_DISPOSITION', { fresh: true });
    const { caseId } = CaseParams.parse(request.params);
    const body = DispositionBody.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(prisma, actor.userId, 'SAFETY_CASE_DISPOSITION', key, { caseId, ...body }, async (tx) => {
      const current = await assignedCase(tx as PrismaClient, actor.userId, caseId);
      await lockPatientForProcessing(tx, current.patientId);
      if (current.version !== body.expectedVersion) throw new DomainError(409, 'VERSION_CONFLICT', 'The safety case changed before this update.');
      const latestDisposition = await tx.safetyCaseDisposition.findFirst({ where: { caseId }, orderBy: { version: 'desc' } });
      const disposition = await tx.safetyCaseDisposition.create({ data: { caseId, version: latestDisposition ? latestDisposition.version + 1 : 1, disposition: body.disposition, actorId: actor.userId, actorRole: 'CLINICIAN', reason: body.reason, sourceCaseVersion: current.version } });
      const relaxes = body.disposition === 'SAFE_TO_CONTINUE_STANDARD_MONITORING';
      const updated = await tx.safetyCase.update({ where: { id: caseId }, data: { version: { increment: 1 }, ...(relaxes ? { gateStatus: 'ALLOW_MONITORING', resolvedAt: new Date(), lifecycle: 'RESOLVED' as const } : {}) }, include: safetyCaseInclude });
      if (relaxes) {
        await tx.safetyCaseRestrictionVersion.create({ data: { caseId, version: (current.restrictions[0]?.version ?? 0) + 1, gateStatus: 'ALLOW_MONITORING', allowedSubjectiveInterventions: [] as Prisma.InputJsonValue, monitoringPromptPolicy: 'CONTINUE', goalChangeAllowed: true, sourceDispositionId: disposition.id, createdByUserId: actor.userId } });
      }
      await tx.auditEvent.create({ data: { actorId: actor.userId, actorRole: 'CLINICIAN', action: 'SAFETY_CASE_DISPOSITION', entityType: 'SAFETY_CASE', entityId: caseId, patientId: current.patientId, requestId: request.id, metadata: { disposition: body.disposition } } });
      return projectSafetyCase(updated);
    });
    return result.value;
  });

  app.get('/api/v1/admin/safety-cases', async (request) => {
    await requirePermission(request, auth, prisma, config, 'SAFETY_CASE_READ');
    const cases = await prisma.safetyCase.findMany({ include: safetyCaseInclude, orderBy: [{ updatedAt: 'desc' }], take: 100 });
    return { items: cases.map(projectSafetyCase) };
  });

  app.get('/api/v1/admin/safety-cases/:caseId', async (request) => {
    await requirePermission(request, auth, prisma, config, 'SAFETY_CASE_READ');
    const { caseId } = CaseParams.parse(request.params);
    const safetyCase = await prisma.safetyCase.findUnique({ where: { id: caseId }, include: safetyCaseInclude });
    if (!safetyCase) throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
    return projectSafetyCase(safetyCase);
  });
}
