import type { SafetyInput } from '@aud-subjective/contracts';
import { OnboardingDraftSchema } from '@aud-subjective/contracts';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import type { Clock } from '../../shared/clock/clock.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { normalizeRegion, resolveRegionalRoute } from '../routing/service.js';
import { CSSRS_RECENT_PROVENANCE } from './instrument-provenance.js';
import { evaluateSafety, type SafetyDomainResult } from './domain/evaluate-safety.js';
import { selectSafetyRouteTargets, SAFETY_ROUTE_POLICY_VERSION } from './route-policy.js';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const SEVERITY_RANK: Record<string, number> = {
  S0_EMERGENCY: 0,
  S1_URGENT: 1,
  S2_PRIORITY: 2,
  S3_ROUTINE: 3,
  S_NONE: 4,
};

function completeSubmittedDraft(draft: unknown) {
  const parsed = OnboardingDraftSchema.parse(draft);
  const required = [
    parsed.auditC.frequency,
    parsed.auditC.quantity,
    parsed.auditC.heavy,
    parsed.drinkingDaysPerWeek,
    parsed.drinksPerDrinkingDay,
    parsed.heavyDrinkingDaysRecent,
    parsed.recoveryDirection,
    parsed.mutualHelpPreference,
    parsed.spiritualContentPreference,
  ];
  if (required.some((value) => value.state === 'NOT_YET_ANSWERED')) {
    throw new DomainError(409, 'ONBOARDING_INCOMPLETE', 'Complete the required onboarding responses before submitting.');
  }
  if (parsed.lastDrink.state === 'KNOWN' && !parsed.lastDrink.date) {
    throw new DomainError(409, 'ONBOARDING_INCOMPLETE', 'Complete the required onboarding responses before submitting.');
  }
  return parsed;
}

function restrictionFor(domain: SafetyDomainResult) {
  const blocked = domain.gateStatus === 'BLOCK_AND_HANDOFF';
  return {
    gateStatus: domain.gateStatus,
    allowedSubjectiveInterventions: [] as string[],
    monitoringPromptPolicy: blocked ? 'PAUSE' : 'CONTINUE',
    goalChangeAllowed: domain.gateStatus === 'ALLOW_MONITORING',
    reassessmentDueAt: null as Date | null,
  };
}

function sameRestriction(a: typeof restrictionFor extends (d: never) => infer R ? R : never, b: { gateStatus: string; allowedSubjectiveInterventions: Prisma.JsonValue; monitoringPromptPolicy: string; goalChangeAllowed: boolean; reassessmentDueAt: Date | null }) {
  return a.gateStatus === b.gateStatus &&
    a.monitoringPromptPolicy === b.monitoringPromptPolicy &&
    a.goalChangeAllowed === b.goalChangeAllowed &&
    JSON.stringify(a.allowedSubjectiveInterventions) === JSON.stringify(b.allowedSubjectiveInterventions) &&
    String(a.reassessmentDueAt) === String(b.reassessmentDueAt);
}

async function resolveRoute(tx: Tx, config: AppConfig, clock: Clock, domain: SafetyDomainResult) {
  const selected = selectSafetyRouteTargets(domain.severity, domain.domain);
  if (!selected.primary) return { status: 'NOT_REQUIRED' as const, snapshot: { status: 'NOT_REQUIRED', policyVersion: SAFETY_ROUTE_POLICY_VERSION, selected }, profileId: null, logicalVersion: null };
  if (!config.safetyRoutingCountryCode) return { status: 'UNAVAILABLE' as const, snapshot: { status: 'UNAVAILABLE', reason: 'ROUTING_CONTEXT_UNCONFIGURED', policyVersion: SAFETY_ROUTE_POLICY_VERSION, selected }, profileId: null, logicalVersion: null };
  const normalized = normalizeRegion(config.safetyRoutingCountryCode, config.safetyRoutingRegionCode);
  const resolved = await resolveRegionalRoute(tx as PrismaClient, normalized.countryCode, normalized.regionCode, clock.now());
  if (resolved.status === 'UNAVAILABLE') return { status: 'UNAVAILABLE' as const, snapshot: { ...resolved, ...normalized, policyVersion: SAFETY_ROUTE_POLICY_VERSION, selected }, profileId: null, logicalVersion: null };
  const targets = new Map(resolved.targets.map((target) => [target.kind, target]));
  const primary = targets.get(selected.primary);
  if (!primary) return { status: 'UNAVAILABLE' as const, snapshot: { status: 'UNAVAILABLE', reason: 'REQUIRED_TARGET_UNAVAILABLE', ...normalized, profileId: resolved.profileId, logicalVersion: resolved.logicalVersion, policyVersion: SAFETY_ROUTE_POLICY_VERSION, selected }, profileId: resolved.profileId, logicalVersion: resolved.logicalVersion };
  const fallback = selected.fallback ? targets.get(selected.fallback) ?? null : null;
  return { status: 'AVAILABLE' as const, snapshot: { status: 'AVAILABLE', resolvedAt: clock.now().toISOString(), ...normalized, policyVersion: SAFETY_ROUTE_POLICY_VERSION, profileId: resolved.profileId, logicalVersion: resolved.logicalVersion, profileEffectiveAt: resolved.effectiveAt, selected, primary, fallback }, profileId: resolved.profileId, logicalVersion: resolved.logicalVersion };
}

async function appendLifecycle(tx: Tx, requestId: string, actorId: string, caseId: string, fromState: never | null, toState: never, reason: string) {
  await tx.safetyCaseLifecycleEvent.create({ data: { caseId, fromState, toState, actorId, requestId, reason } });
}

export async function evaluatePatientSafety(args: {
  prisma: PrismaClient;
  config: AppConfig;
  clock: Clock;
  patientId: string;
  actorId: string;
  requestId: string;
  input: SafetyInput;
}) {
  return args.prisma.$transaction(async (tx) => {
    await lockPatientForProcessing(tx, args.patientId);
    const onboarding = await tx.patientOnboardingState.findUnique({ where: { patientId: args.patientId } });
    if (!onboarding?.authoritativeRevisionId) throw new DomainError(409, 'VERSION_CONFLICT', 'Submit onboarding before safety evaluation.');
    const [profile, authoritative] = await Promise.all([
      tx.patientProfile.findUniqueOrThrow({ where: { patientId: args.patientId } }),
      tx.onboardingRevision.findUniqueOrThrow({ where: { id: onboarding.authoritativeRevisionId } }),
    ]);
    const submitted = completeSubmittedDraft(authoritative.responseSnapshot);
    const direction = submitted.recoveryDirection.state === 'ANSWERED' ? submitted.recoveryDirection.value : 'UNSURE';
    const evaluationNow = args.clock.now();
    const ageOver65 = args.input.ageOver65 === 'YES' ? true : args.input.ageOver65 === 'NO' ? false : undefined;
    const evaluationContext = {
      evaluatedAt: evaluationNow.toISOString(),
      timezone: profile.monitoringTimezone,
      sourceOnboardingRevisionId: onboarding.authoritativeRevisionId,
      plannedDirection: direction,
      baselineAverageWeeklyDrinks: { availability: 'UNAVAILABLE_UNTIL_REDUCTION_BASELINE' },
      targetWeeklyDrinks: { availability: 'UNAVAILABLE_UNTIL_REDUCTION_BASELINE' },
      patientReportedSimilarHeavyRegularUseAtLeast3Months: args.input.similarHeavyRegularUseAtLeast3Months,
      canonicalProlongedHeavyRegularUse: { state: 'UNKNOWN', missingDependency: 'COMMIT_3_28_DAY_BASELINE' },
      ageOver65: args.input.ageOver65,
      evaluatorVersion: 'safety_v1_commit1',
      configurationVersion: 'safety_v1_config_1',
    };
    const evaluation = evaluateSafety(args.input, {
      now: evaluationNow,
      timezone: profile.monitoringTimezone,
      plannedDirection: direction,
      ageOver65,
    });
    const revision = await tx.safetyInputRevision.create({ data: { patientId: args.patientId, revision: (await tx.safetyInputRevision.count({ where: { patientId: args.patientId } })) + 1, sourceOnboardingRevisionId: onboarding.authoritativeRevisionId, inputSnapshot: args.input as unknown as Prisma.InputJsonValue, instrument: CSSRS_RECENT_PROVENANCE.instrument, instrumentVersion: CSSRS_RECENT_PROVENANCE.version, instrumentSource: CSSRS_RECENT_PROVENANCE.source, schemaVersion: 'safety_v1', trigger: 'ONBOARDING', actorId: args.actorId } });
    const legacyDomain = evaluation.domainResults.length === 1 ? evaluation.domainResults[0]! : null;
    const persistedEvaluation = await tx.safetyEvaluationResult.create({ data: { patientId: args.patientId, safetyInputRevisionId: revision.id, severity: evaluation.severity, gateStatus: evaluation.gateStatus, reasonCodes: evaluation.reasonCodes, safetyDomain: legacyDomain?.domain ?? null, ownerRole: legacyDomain?.ownerRole ?? null, clinicianContext: evaluation.clinicianContext, allowedSubjectiveInterventions: evaluation.allowedSubjectiveInterventions, monitoringPromptPolicy: evaluation.monitoringPromptPolicy, goalChangeAllowed: evaluation.goalChangeAllowed, evaluatorVersion: evaluation.evaluatorVersion, configurationVersion: evaluation.configurationVersion, evaluatedAt: evaluationNow, contextSnapshot: evaluationContext as Prisma.InputJsonValue, resultSnapshot: evaluation as unknown as Prisma.InputJsonValue } });
    for (const domain of evaluation.domainResults) {
      const active = await tx.safetyCase.findFirst({ where: { patientId: args.patientId, domain: domain.domain, resolvedAt: null }, include: { restrictions: { orderBy: { version: 'desc' }, take: 1 } } });
      const canTighten =
        !active ||
        (SEVERITY_RANK[domain.severity] ?? 4) <
          (SEVERITY_RANK[active.severity] ?? 4);
      const route = canTighten ? await resolveRoute(tx, args.config, args.clock, domain) : null;
      const data = canTighten ? { sourceSafetyEvaluationResultId: persistedEvaluation.id, severity: domain.severity, gateStatus: domain.gateStatus, ownerRole: domain.ownerRole, version: { increment: active ? 1 : 0 }, routeStatus: route!.status, currentRouteSnapshot: route!.snapshot as Prisma.InputJsonValue, routeProfileId: route!.profileId, routeProfileLogicalVersion: route!.logicalVersion } : { sourceSafetyEvaluationResultId: persistedEvaluation.id };
      const safetyCase = active
        ? await tx.safetyCase.update({ where: { id: active.id }, data })
        : await tx.safetyCase.create({ data: { patientId: args.patientId, domain: domain.domain, sourceSafetyEvaluationResultId: persistedEvaluation.id, severity: domain.severity, gateStatus: domain.gateStatus, ownerRole: domain.ownerRole, routeStatus: route!.status, currentRouteSnapshot: route!.snapshot as Prisma.InputJsonValue, routeProfileId: route!.profileId, routeProfileLogicalVersion: route!.logicalVersion } });
      if (route?.status === 'UNAVAILABLE') {
        await tx.operationalIncident.create({ data: { incidentType: 'SAFETY_ROUTING', code: 'SAFETY_ROUTE_UNAVAILABLE', status: 'OPEN', summary: 'Safety route could not be resolved.', metadata: route.snapshot as Prisma.InputJsonValue, requestId: args.requestId, provenanceReference: safetyCase.id } });
      }
      if (!active || canTighten) {
        const nextRestriction = restrictionFor(domain);
        const latest = active?.restrictions[0] ?? null;
        if (!latest || !sameRestriction(nextRestriction, latest)) {
          const restriction = await tx.safetyCaseRestrictionVersion.create({ data: { caseId: safetyCase.id, version: latest ? latest.version + 1 : 1, ...nextRestriction, allowedSubjectiveInterventions: nextRestriction.allowedSubjectiveInterventions as Prisma.InputJsonValue, createdByUserId: args.actorId } });
          await tx.safetyCase.update({ where: { id: safetyCase.id }, data: { currentRestrictionVersionId: restriction.id } });
        }
      }
      if (!active) {
        await appendLifecycle(tx, args.requestId, args.actorId, safetyCase.id, null, 'DETECTED' as never, 'Deterministic safety evaluation detected a controlled safety domain.');
        if (domain.severity === 'S0_EMERGENCY') await appendLifecycle(tx, args.requestId, args.actorId, safetyCase.id, 'DETECTED' as never, 'ESCALATED_TO_EMERGENCY' as never, 'Emergency safety route initiated.');
        else if (domain.severity !== 'S3_ROUTINE') await appendLifecycle(tx, args.requestId, args.actorId, safetyCase.id, 'DETECTED' as never, 'HANDOFF_INITIATED' as never, 'Safety handoff initiated.');
      }
      await tx.auditEvent.create({ data: { actorId: args.actorId, action: !active ? 'SAFETY_CASE_DETECTED' : canTighten ? 'SAFETY_CASE_TIGHTENED' : 'SAFETY_CASE_REEVALUATED_NO_RELAXATION', entityType: 'SAFETY_CASE', entityId: safetyCase.id, patientId: args.patientId, requestId: args.requestId, ruleSetVersion: evaluation.evaluatorVersion, configurationVersion: evaluation.configurationVersion, sourceRevisionReference: persistedEvaluation.id, metadata: { domain: domain.domain, routeStatus: route?.status ?? safetyCase.routeStatus } } });
    }
    await tx.auditEvent.create({ data: { actorId: args.actorId, action: 'SAFETY_EVALUATED', entityType: 'SAFETY_INPUT_REVISION', entityId: revision.id, patientId: args.patientId, requestId: args.requestId, ruleSetVersion: evaluation.evaluatorVersion, configurationVersion: evaluation.configurationVersion, sourceRevisionReference: revision.id, metadata: { safetyEvaluationResultId: persistedEvaluation.id } } });
    return { setupState: evaluation.gateStatus === 'ALLOW_MONITORING' ? 'SETUP_INCOMPLETE' : 'SAFETY_REVIEW_REQUIRED', requiresReview: evaluation.gateStatus !== 'ALLOW_MONITORING', evaluationId: persistedEvaluation.id };
  });
}
