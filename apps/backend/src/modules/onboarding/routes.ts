import { OnboardingDraftSchema, SafetyInputSchema, auditCScore } from '@aud-subjective/contracts';
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
import { evaluateSafety } from '../safety/domain/evaluate-safety.js';
import { AUDIT_C_PROVENANCE } from './instrument-provenance.js';
import { CSSRS_RECENT_PROVENANCE } from '../safety/instrument-provenance.js';
import { REASON_POLICY } from '../safety/domain/reasons.js';

const versionBody = z.object({ expectedVersion: z.number().int().nonnegative(), currentStep: z.string().min(1).max(64), draftResponses: OnboardingDraftSchema });
const submitBody = z.object({ expectedVersion: z.number().int().positive() });
function completeDraft(draft: z.infer<typeof OnboardingDraftSchema>) {
  const values: unknown[] = [draft.auditC.frequency, draft.auditC.quantity, draft.auditC.heavy, draft.drinkingDaysPerWeek, draft.drinksPerDrinkingDay, draft.heavyDrinkingDaysRecent, draft.recoveryDirection, draft.mutualHelpPreference, draft.spiritualContentPreference];
  if (values.some((value) => typeof value === 'object' && value !== null && 'state' in value && (value as { state: string }).state === 'NOT_YET_ANSWERED')) throw new DomainError(409, 'ONBOARDING_INCOMPLETE', 'Complete the required onboarding responses before submitting.');
  if (draft.lastDrink.state === 'KNOWN' && !draft.lastDrink.date) throw new DomainError(409, 'ONBOARDING_INCOMPLETE', 'Complete the required onboarding responses before submitting.');
}
export function registerOnboardingRoutes(app: FastifyInstance, prisma: PrismaClient, auth: AppAuth, config: AppConfig, clock: Clock) {
  app.get('/api/v1/patient/safety', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'PATIENT_SAFETY_READ');
    const cases = await prisma.safetyCase.findMany({ where: { patientId: actor.userId, resolvedAt: null }, include: { restrictions: { orderBy: { version: 'desc' }, take: 1 } } });
    const blocked = cases.some((item) => item.gateStatus === 'BLOCK_AND_HANDOFF');
    const restricted = cases.some((item) => item.gateStatus === 'ALLOW_WITH_HANDOFF');
    const restrictions = cases.flatMap((item) => item.restrictions);
    const promptPolicy = restrictions.some((item) => item.monitoringPromptPolicy === 'PAUSE') ? 'PAUSE' : 'CONTINUE';
    const goalChangeAllowed = restrictions.length > 0 ? restrictions.every((item) => item.goalChangeAllowed) : true;
    const firstRestriction = restrictions[0];
    const allowedSubjectiveInterventions = firstRestriction ? restrictions.slice(1).reduce((allowed, item) => allowed.filter((entry) => (item.allowedSubjectiveInterventions as string[]).includes(entry)), firstRestriction.allowedSubjectiveInterventions as string[]) : [];
    const reassessmentDueAt = restrictions.map((item) => item.reassessmentDueAt).filter((item): item is Date => item !== null).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    return { safetyState: blocked ? 'HANDOFF_REQUIRED' : restricted ? 'REVIEW_REQUIRED' : cases.length ? 'ROUTINE_CONTEXT' : 'NOT_ASSESSED', requiresSafetyShell: blocked, handoffStatus: blocked || restricted ? 'PENDING' : 'NONE', allowedSubjectiveInterventions, monitoringPromptPolicy: promptPolicy, goalChangeAllowed, reassessmentDueAt, patientRouteActions: [] };
  });
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
      const draft = OnboardingDraftSchema.parse(state.draftResponses); completeDraft(draft);
      const revision = await tx.onboardingRevision.create({ data: { patientId: actor.userId, revision: (await tx.onboardingRevision.count({ where: { patientId: actor.userId } })) + 1, sourceDraftVersion: state.version, responseSnapshot: state.draftResponses as Prisma.InputJsonValue, auditCInstrument: AUDIT_C_PROVENANCE.instrument, auditCVersion: AUDIT_C_PROVENANCE.version, auditCSource: AUDIT_C_PROVENANCE.source, schemaVersion: 'onboarding_v1', submittingActorId: actor.userId } });
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
      const authoritative = await tx.onboardingRevision.findUniqueOrThrow({ where: { id: onboarding.authoritativeRevisionId } });
      const submitted = OnboardingDraftSchema.parse(authoritative.responseSnapshot); completeDraft(submitted);
      const direction = submitted.recoveryDirection.state === 'ANSWERED' ? submitted.recoveryDirection.value : 'UNSURE';
      const evaluationNow = clock.now();
      const heavyContext = input.prolongedHeavyRegularUse === 'YES' ? true : input.prolongedHeavyRegularUse === 'NO' ? false : undefined;
      const evaluationContext = { now: evaluationNow.toISOString(), timezone: profile.monitoringTimezone, plannedDirection: direction, baselineAverageWeeklyDrinks: null, targetWeeklyDrinks: null, prolongedHeavyRegularUse: heavyContext ?? null, ageOver65: null, ruleSetVersion: 'safety_v1_commit1', configurationVersion: 'safety_v1_config_1' };
      const evaluation = evaluateSafety(input, { now: evaluationNow, timezone: profile.monitoringTimezone, plannedDirection: direction, prolongedHeavyRegularUse: heavyContext });
      const revision = await tx.safetyInputRevision.create({ data: { patientId: actor.userId, revision: (await tx.safetyInputRevision.count({ where: { patientId: actor.userId } })) + 1, sourceOnboardingRevisionId: onboarding.authoritativeRevisionId, inputSnapshot: input, instrument: CSSRS_RECENT_PROVENANCE.instrument, instrumentVersion: CSSRS_RECENT_PROVENANCE.version, instrumentSource: CSSRS_RECENT_PROVENANCE.source, schemaVersion: 'safety_v1', trigger: 'ONBOARDING', actorId: actor.userId } });
      const persistedEvaluation = await tx.safetyEvaluationResult.create({ data: { patientId: actor.userId, safetyInputRevisionId: revision.id, severity: evaluation.severity, gateStatus: evaluation.gateStatus, reasonCodes: evaluation.reasonCodes, clinicianContext: evaluation.clinicianContext, allowedSubjectiveInterventions: evaluation.allowedSubjectiveInterventions, monitoringPromptPolicy: evaluation.monitoringPromptPolicy, goalChangeAllowed: evaluation.goalChangeAllowed, evaluatorVersion: 'safety_v1_commit1', configurationVersion: 'safety_v1_config_1', contextSnapshot: evaluationContext, resultSnapshot: evaluation } });
      const grouped = new Map<string, { severity: string; ownerRole: string; reasons: string[] }>();
      const rank: Record<string, number> = { S0_EMERGENCY: 0, S1_URGENT: 1, S2_PRIORITY: 2, S3_ROUTINE: 3 };
      for (const reason of evaluation.reasonCodes) { const policy = REASON_POLICY[reason]; if (!policy) continue; const current = grouped.get(policy.domain); if (!current || rank[policy.severity]! < rank[current.severity]!) grouped.set(policy.domain, { severity: policy.severity, ownerRole: policy.ownerRole, reasons: [reason] }); else { current.reasons.push(reason); } }
      for (const [domain, policy] of grouped) {
        const domainGate = policy.severity === 'S0_EMERGENCY' || policy.severity === 'S1_URGENT' ? 'BLOCK_AND_HANDOFF' : policy.severity === 'S2_PRIORITY' ? 'ALLOW_WITH_HANDOFF' : 'ALLOW_MONITORING';
        const domainPrompt = domainGate === 'BLOCK_AND_HANDOFF' ? 'PAUSE' : 'CONTINUE';
        const domainGoal = domainGate === 'ALLOW_MONITORING';
        const active = await tx.safetyCase.findFirst({ where: { patientId: actor.userId, domain: domain as never, resolvedAt: null }, orderBy: { updatedAt: 'desc' } });
        const safetyCase = active ? await tx.safetyCase.update({ where: { id: active.id }, data: { sourceSafetyEvaluationResultId: persistedEvaluation.id, severity: policy.severity, gateStatus: domainGate, ownerRole: policy.ownerRole, version: { increment: 1 }, routeStatus: 'UNAVAILABLE' } }) : await tx.safetyCase.create({ data: { patientId: actor.userId, domain: domain as never, sourceSafetyEvaluationResultId: persistedEvaluation.id, severity: policy.severity, gateStatus: domainGate, ownerRole: policy.ownerRole, routeStatus: 'UNAVAILABLE' } });
        const restriction = await tx.safetyCaseRestrictionVersion.create({ data: { caseId: safetyCase.id, version: active ? active.version + 1 : 1, gateStatus: domainGate, allowedSubjectiveInterventions: domainGoal ? evaluation.allowedSubjectiveInterventions : [], monitoringPromptPolicy: domainPrompt, goalChangeAllowed: domainGoal, createdByUserId: actor.userId } });
        await tx.safetyCase.update({ where: { id: safetyCase.id }, data: { currentRestrictionVersionId: restriction.id } });
        if (!active) { await tx.safetyCaseLifecycleEvent.create({ data: { caseId: safetyCase.id, toState: 'DETECTED', actorId: actor.userId, requestId: request.id, reason: 'Deterministic safety evaluation detected a controlled safety domain.' } }); await tx.auditEvent.create({ data: { actorId: actor.userId, action: 'SAFETY_CASE_DETECTED', entityType: 'SAFETY_CASE', entityId: safetyCase.id, patientId: actor.userId, requestId: request.id, ruleSetVersion: 'safety_v1_commit1', sourceRevisionReference: persistedEvaluation.id } }); } else { await tx.auditEvent.create({ data: { actorId: actor.userId, action: 'SAFETY_CASE_REEVALUATED', entityType: 'SAFETY_CASE', entityId: safetyCase.id, patientId: actor.userId, requestId: request.id, ruleSetVersion: 'safety_v1_commit1', sourceRevisionReference: persistedEvaluation.id } }); }
      }
      await tx.auditEvent.create({ data: { actorId: actor.userId, action: 'SAFETY_EVALUATED', entityType: 'SAFETY_INPUT_REVISION', entityId: revision.id, patientId: actor.userId, requestId: request.id, ruleSetVersion: 'safety_v1_commit1', configurationVersion: 'safety_v1_config_1', sourceRevisionReference: revision.id } });
      return { setupState: evaluation.gateStatus === 'ALLOW_MONITORING' ? 'SETUP_INCOMPLETE' : 'SAFETY_REVIEW_REQUIRED', requiresReview: evaluation.gateStatus !== 'ALLOW_MONITORING' };
    }); return result.value;
  });
}
