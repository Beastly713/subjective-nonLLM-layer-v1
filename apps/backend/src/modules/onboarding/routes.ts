import { OnboardingDraftSchema, OnboardingStepSchema, SafetyInputSchema, auditCScore } from '@aud-subjective/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import type { Clock } from '../../shared/clock/clock.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import { executeIdempotently, requireIdempotencyKey } from '../../shared/authz/idempotency.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { AUDIT_C_PROVENANCE } from './instrument-provenance.js';
import { evaluatePatientSafety } from '../safety/service.js';

const versionBody = z.object({ expectedVersion: z.number().int().nonnegative(), currentStep: OnboardingStepSchema, draftResponses: OnboardingDraftSchema });
const submitBody = z.object({ expectedVersion: z.number().int().positive() });
function completeDraft(draft: z.infer<typeof OnboardingDraftSchema>) {
  const values: unknown[] = [draft.auditC.frequency, draft.auditC.quantity, draft.auditC.heavy, draft.drinkingDaysPerWeek, draft.drinksPerDrinkingDay, draft.heavyDrinkingDaysRecent, draft.recoveryDirection, draft.mutualHelpPreference, draft.spiritualContentPreference];
  if (values.some((value) => typeof value === 'object' && value !== null && 'state' in value && (value as { state: string }).state === 'NOT_YET_ANSWERED')) throw new DomainError(409, 'ONBOARDING_INCOMPLETE', 'Complete the required onboarding responses before submitting.');
  if (draft.lastDrink.state === 'KNOWN' && !draft.lastDrink.date) throw new DomainError(409, 'ONBOARDING_INCOMPLETE', 'Complete the required onboarding responses before submitting.');
}
export function registerOnboardingRoutes(app: FastifyInstance, prisma: PrismaClient, auth: AppAuth, config: AppConfig, clock: Clock) {
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
      if ((!existing && body.expectedVersion !== 0) || (existing && existing.version !== body.expectedVersion)) throw new DomainError(409, 'VERSION_CONFLICT', 'The onboarding draft changed before this update.');
      const data = { currentStep: body.currentStep, draftResponses: { ...body.draftResponses, auditCScore: score } as unknown as Prisma.InputJsonValue, updatedByUserId: actor.userId, version: { increment: 1 } };
      const state = existing ? await tx.patientOnboardingState.update({ where: { patientId: actor.userId }, data }) : await tx.patientOnboardingState.create({ data: { patientId: actor.userId, version: 1, currentStep: body.currentStep, draftResponses: { ...body.draftResponses, auditCScore: score } as unknown as Prisma.InputJsonValue, createdByUserId: actor.userId, updatedByUserId: actor.userId } });
      return { version: state.version, currentStep: state.currentStep, draft: state.draftResponses };
    });
  });
  app.post('/api/v1/patient/onboarding/submit', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'PATIENT_ONBOARDING_UPDATE');
    const body = submitBody.parse(request.body); const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(prisma, actor.userId, 'PATIENT_ONBOARDING_SUBMIT', key, body, async (tx) => {
      await lockPatientForProcessing(tx, actor.userId); const state = await tx.patientOnboardingState.findUnique({ where: { patientId: actor.userId } });
      if (!state || state.version !== body.expectedVersion) throw new DomainError(409, 'VERSION_CONFLICT', 'The onboarding draft changed before submission.');
      const draft = OnboardingDraftSchema.parse(state.draftResponses); completeDraft(draft);
      const revision = await tx.onboardingRevision.create({ data: { patientId: actor.userId, revision: (await tx.onboardingRevision.count({ where: { patientId: actor.userId } })) + 1, sourceDraftVersion: state.version, responseSnapshot: state.draftResponses as Prisma.InputJsonValue, auditCInstrument: AUDIT_C_PROVENANCE.instrument, auditCVersion: AUDIT_C_PROVENANCE.version, auditCSource: AUDIT_C_PROVENANCE.source, schemaVersion: 'onboarding_v1', submittingActorId: actor.userId } });
      const previousAuthoritativeRevisionId = state.authoritativeRevisionId;
      await tx.patientOnboardingState.update({ where: { patientId: actor.userId }, data: { authoritativeRevisionId: revision.id, updatedByUserId: actor.userId } });
      await tx.auditEvent.create({ data: { actorId: actor.userId, action: 'ONBOARDING_SUBMITTED', entityType: 'ONBOARDING_REVISION', entityId: revision.id, patientId: actor.userId, requestId: request.id } });
      if (previousAuthoritativeRevisionId && previousAuthoritativeRevisionId !== revision.id) await tx.auditEvent.create({ data: { actorId: actor.userId, action: 'ONBOARDING_AUTHORITATIVE_REVISION_CHANGED', entityType: 'PATIENT_ONBOARDING_STATE', entityId: actor.userId, patientId: actor.userId, requestId: request.id, metadata: { previousAuthoritativeRevisionId, authoritativeRevisionId: revision.id } } });
      return { revisionId: revision.id, revision: revision.revision, setupState: 'INCOMPLETE' };
    }); return result.value;
  });
  app.post('/api/v1/patient/onboarding/safety-evaluations', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'PATIENT_ONBOARDING_UPDATE');
    const input = SafetyInputSchema.parse(request.body); const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(prisma, actor.userId, 'PATIENT_SAFETY_EVALUATE', key, input, async () => evaluatePatientSafety({ prisma, config, clock, patientId: actor.userId, actorId: actor.userId, requestId: request.id, input }));
    return result.value;
  });
}
