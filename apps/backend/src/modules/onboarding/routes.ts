import { OnboardingDraftSchema, SafetyInputSchema, auditCScore } from '@aud-subjective/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import { executeIdempotently, requireIdempotencyKey } from '../../shared/authz/idempotency.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { evaluateSafety } from '../safety/domain/evaluate-safety.js';

const versionBody = z.object({ expectedVersion: z.number().int().positive(), currentStep: z.string().min(1).max(64), draftResponses: OnboardingDraftSchema });
const submitBody = z.object({ expectedVersion: z.number().int().positive() });
export function registerOnboardingRoutes(app: FastifyInstance, prisma: PrismaClient, auth: AppAuth, config: AppConfig) {
  app.get('/api/v1/patient/onboarding', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'PATIENT_ONBOARDING_READ');
    const state = await prisma.patientOnboardingState.findUnique({ where: { patientId: actor.userId }, include: { authoritativeRevision: { select: { id: true, revision: true, submittedAt: true } } } });
    const latest = await prisma.safetyEvaluationResult.findFirst({ where: { patientId: actor.userId }, orderBy: { evaluatedAt: 'desc' }, select: { evaluatedAt: true, gateStatus: true } });
    return { draft: state?.draftResponses ?? null, currentStep: state?.currentStep ?? 'ACCOUNT', version: state?.version ?? 0, authoritativeRevision: state?.authoritativeRevision ?? null, safety: latest ? { evaluatedAt: latest.evaluatedAt, requiresReview: latest.gateStatus !== 'ALLOW_MONITORING' } : null, dependencyState: 'SETUP_INCOMPLETE' };
  });
  app.put('/api/v1/patient/onboarding/draft', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'PATIENT_ONBOARDING_UPDATE');
    const body = versionBody.parse(request.body);
    const score = auditCScore(body.draftResponses.auditC);
    return prisma.$transaction(async (tx) => {
      await lockPatientForProcessing(tx, actor.userId);
      const existing = await tx.patientOnboardingState.findUnique({ where: { patientId: actor.userId } });
      if (existing && existing.version !== body.expectedVersion) throw new DomainError(409, 'VERSION_CONFLICT', 'The onboarding draft changed before this update.');
      const data = { currentStep: body.currentStep, draftResponses: { ...body.draftResponses, auditCScore: score } as unknown as Prisma.InputJsonValue, updatedByUserId: actor.userId, version: { increment: 1 } };
      const state = existing ? await tx.patientOnboardingState.update({ where: { patientId: actor.userId }, data }) : await tx.patientOnboardingState.create({ data: { patientId: actor.userId, version: 1, currentStep: body.currentStep, draftResponses: { ...body.draftResponses, auditCScore: score }, createdByUserId: actor.userId, updatedByUserId: actor.userId } });
      return { version: state.version, currentStep: state.currentStep, draft: state.draftResponses };
    });
  });
  app.post('/api/v1/patient/onboarding/submit', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'PATIENT_ONBOARDING_UPDATE');
    const body = submitBody.parse(request.body); const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(prisma, actor.userId, 'PATIENT_ONBOARDING_SUBMIT', key, body, async (tx) => {
      await lockPatientForProcessing(tx, actor.userId); const state = await tx.patientOnboardingState.findUnique({ where: { patientId: actor.userId } });
      if (!state || state.version !== body.expectedVersion) throw new DomainError(409, 'VERSION_CONFLICT', 'The onboarding draft changed before submission.');
      const revision = await tx.onboardingRevision.create({ data: { patientId: actor.userId, revision: (await tx.onboardingRevision.count({ where: { patientId: actor.userId } })) + 1, sourceDraftVersion: state.version, responseSnapshot: state.draftResponses as Prisma.InputJsonValue, auditCInstrument: 'AUDIT-C', auditCVersion: 'V1', auditCSource: 'AUDIT-C canonical instrument provenance', schemaVersion: 'onboarding_v1', submittingActorId: actor.userId } });
      await tx.patientOnboardingState.update({ where: { patientId: actor.userId }, data: { authoritativeRevisionId: revision.id, updatedByUserId: actor.userId } });
      await tx.auditEvent.create({ data: { actorId: actor.userId, action: 'ONBOARDING_SUBMITTED', entityType: 'ONBOARDING_REVISION', entityId: revision.id, patientId: actor.userId, requestId: request.id } });
      return { revisionId: revision.id, revision: revision.revision, setupState: 'INCOMPLETE' };
    }); return result.value;
  });
  app.post('/api/v1/patient/onboarding/safety-evaluations', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'PATIENT_ONBOARDING_UPDATE');
    const input = SafetyInputSchema.parse(request.body); const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(prisma, actor.userId, 'PATIENT_SAFETY_EVALUATE', key, input, async (tx) => {
      await lockPatientForProcessing(tx, actor.userId); const onboarding = await tx.patientOnboardingState.findUnique({ where: { patientId: actor.userId } });
      if (!onboarding?.authoritativeRevisionId) throw new DomainError(409, 'VERSION_CONFLICT', 'Submit onboarding before safety evaluation.');
      const profile = await tx.patientProfile.findUniqueOrThrow({ where: { patientId: actor.userId } });
      const evaluation = evaluateSafety(input, { now: new Date(), timezone: profile.monitoringTimezone, plannedDirection: 'UNSURE' });
      const revision = await tx.safetyInputRevision.create({ data: { patientId: actor.userId, revision: (await tx.safetyInputRevision.count({ where: { patientId: actor.userId } })) + 1, sourceOnboardingRevisionId: onboarding.authoritativeRevisionId, inputSnapshot: input, instrument: 'C-SSRS Screener Basic Recent', instrumentVersion: 'approved-provenance-required', instrumentSource: 'Columbia Lighthouse Project official source', schemaVersion: 'safety_v1', trigger: 'ONBOARDING', actorId: actor.userId } });
      await tx.safetyEvaluationResult.create({ data: { patientId: actor.userId, safetyInputRevisionId: revision.id, severity: evaluation.severity, gateStatus: evaluation.gateStatus, reasonCodes: evaluation.reasonCodes, clinicianContext: evaluation.clinicianContext, allowedSubjectiveInterventions: evaluation.allowedSubjectiveInterventions, monitoringPromptPolicy: evaluation.monitoringPromptPolicy, goalChangeAllowed: evaluation.goalChangeAllowed, evaluatorVersion: 'safety_v1_commit1', configurationVersion: 'safety_v1_config_1', resultSnapshot: evaluation } });
      await tx.auditEvent.create({ data: { actorId: actor.userId, action: 'SAFETY_EVALUATED', entityType: 'SAFETY_INPUT_REVISION', entityId: revision.id, patientId: actor.userId, requestId: request.id, ruleSetVersion: 'safety_v1_commit1', configurationVersion: 'safety_v1_config_1', sourceRevisionReference: revision.id } });
      return { setupState: evaluation.gateStatus === 'ALLOW_MONITORING' ? 'SETUP_INCOMPLETE' : 'SAFETY_REVIEW_REQUIRED', requiresReview: evaluation.gateStatus !== 'ALLOW_MONITORING' };
    }); return result.value;
  });
}
