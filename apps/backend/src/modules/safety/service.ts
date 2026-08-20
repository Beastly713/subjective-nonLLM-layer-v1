import {
  OnboardingDraftSchema,
  SafetyEvaluationResponseSchema,
  type SafetyCaseLifecycle,
  type SafetyGateStatus,
  type SafetyInput,
  type SafetySeverity,
} from '@aud-subjective/contracts';

import type { Prisma } from '../../generated/prisma/client.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import {
  normalizeRegion,
  resolveRegionalRoute,
} from '../routing/service.js';
import {
  evaluateSafety,
  type SafetyDomainResult,
} from './domain/evaluate-safety.js';
import {
  CSSRS_RECENT_PROVENANCE,
  SAFETY_SCREEN_PROVENANCE,
} from './instrument-provenance.js';
import { assertSafetyTransition } from './lifecycle.js';
import {
  canonicalStoredInterventions,
  compareGateRestriction,
  loadPatientSafetyProjection,
} from './projections.js';
import {
  SAFETY_ROUTE_POLICY_VERSION,
  selectSafetyRouteTargets,
} from './route-policy.js';

type Tx = Prisma.TransactionClient;

const SEVERITY_RANK: Record<SafetySeverity, number> = {
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

  if (
    required.some(
      (value) =>
        value.state === 'NOT_YET_ANSWERED',
    )
  ) {
    throw new DomainError(
      409,
      'ONBOARDING_INCOMPLETE',
      'Complete the required onboarding responses before submitting.',
    );
  }

  if (
    parsed.lastDrink.state === 'KNOWN' &&
    !parsed.lastDrink.date
  ) {
    throw new DomainError(
      409,
      'ONBOARDING_INCOMPLETE',
      'Complete the required onboarding responses before submitting.',
    );
  }

  return parsed;
}

function restrictionForGate(
  gateStatus: Exclude<
    SafetyGateStatus,
    'NOT_ASSESSED'
  >,
) {
  return {
    gateStatus,
    allowedSubjectiveInterventions:
      [] as string[],
    monitoringPromptPolicy:
      gateStatus === 'BLOCK_AND_HANDOFF'
        ? ('PAUSE' as const)
        : ('CONTINUE' as const),
    goalChangeAllowed:
      gateStatus === 'ALLOW_MONITORING',
    reassessmentDueAt: null as Date | null,
  };
}

function sameRestriction(
  desired: ReturnType<typeof restrictionForGate>,
  stored:
    | {
        gateStatus: string;
        allowedSubjectiveInterventions:
          Prisma.JsonValue;
        monitoringPromptPolicy: string;
        goalChangeAllowed: boolean;
        reassessmentDueAt: Date | null;
      }
    | undefined,
) {
  if (!stored) return false;

  return (
    desired.gateStatus === stored.gateStatus &&
    desired.monitoringPromptPolicy ===
      stored.monitoringPromptPolicy &&
    desired.goalChangeAllowed ===
      stored.goalChangeAllowed &&
    JSON.stringify(
      desired.allowedSubjectiveInterventions,
    ) ===
      JSON.stringify(
        canonicalStoredInterventions(
          stored.allowedSubjectiveInterventions,
        ),
      ) &&
    desired.reassessmentDueAt?.getTime() ===
      stored.reassessmentDueAt?.getTime()
  );
}

export type ResolvedSafetyRoute = Awaited<
  ReturnType<typeof resolveSafetyRoute>
>;

export async function resolveSafetyRoute(
  tx: Tx,
  config: AppConfig,
  effectiveAt: Date,
  domain: Pick<
    SafetyDomainResult,
    'severity' | 'domain'
  >,
) {
  const selected = selectSafetyRouteTargets(
    domain.severity,
    domain.domain,
  );

  if (!selected.primary) {
    return {
      status: 'NOT_REQUIRED' as const,
      snapshot: {
        status: 'NOT_REQUIRED',
        resolvedAt: effectiveAt.toISOString(),
        policyVersion:
          SAFETY_ROUTE_POLICY_VERSION,
        selected,
      },
      profileId: null,
      logicalVersion: null,
    };
  }

  if (!config.safetyRoutingCountryCode) {
    return {
      status: 'UNAVAILABLE' as const,
      snapshot: {
        status: 'UNAVAILABLE',
        reason:
          'ROUTING_CONTEXT_UNCONFIGURED',
        resolvedAt: effectiveAt.toISOString(),
        policyVersion:
          SAFETY_ROUTE_POLICY_VERSION,
        selected,
      },
      profileId: null,
      logicalVersion: null,
    };
  }

  const normalized = normalizeRegion(
    config.safetyRoutingCountryCode,
    config.safetyRoutingRegionCode,
  );

  const resolved = await resolveRegionalRoute(
    tx,
    normalized.countryCode,
    normalized.regionCode,
    effectiveAt,
  );

  if (resolved.status === 'UNAVAILABLE') {
    return {
      status: 'UNAVAILABLE' as const,
      snapshot: {
        ...resolved,
        ...normalized,
        resolvedAt: effectiveAt.toISOString(),
        policyVersion:
          SAFETY_ROUTE_POLICY_VERSION,
        selected,
      },
      profileId: null,
      logicalVersion: null,
    };
  }

  const targets = new Map(
    resolved.targets.map((target) => [
      target.kind,
      target,
    ]),
  );

  const primary = targets.get(
    selected.primary,
  );

  if (!primary) {
    return {
      status: 'UNAVAILABLE' as const,
      snapshot: {
        status: 'UNAVAILABLE',
        reason: 'REQUIRED_TARGET_UNAVAILABLE',
        ...normalized,
        resolvedAt: effectiveAt.toISOString(),
        profileId: resolved.profileId,
        logicalVersion:
          resolved.logicalVersion,
        profileEffectiveAt:
          resolved.effectiveAt,
        policyVersion:
          SAFETY_ROUTE_POLICY_VERSION,
        selected,
      },
      profileId: resolved.profileId,
      logicalVersion: resolved.logicalVersion,
    };
  }

  const fallback = selected.fallback
    ? (targets.get(selected.fallback) ?? null)
    : null;

  return {
    status: 'AVAILABLE' as const,
    snapshot: {
      status: 'AVAILABLE',
      resolvedAt: effectiveAt.toISOString(),
      ...normalized,
      policyVersion:
        SAFETY_ROUTE_POLICY_VERSION,
      profileId: resolved.profileId,
      logicalVersion: resolved.logicalVersion,
      profileEffectiveAt:
        resolved.effectiveAt,
      selected,
      primary,
      fallback,
    },
    profileId: resolved.profileId,
    logicalVersion: resolved.logicalVersion,
  };
}

export async function reconcileSafetyRoutingIncident(
  tx: Tx,
  args: {
    caseId: string;
    requestId: string;
    route: ResolvedSafetyRoute;
    now: Date;
  },
) {
  const open =
    await tx.operationalIncident.findFirst({
      where: {
        incidentType: 'SAFETY_ROUTING',
        code: 'SAFETY_ROUTE_UNAVAILABLE',
        status: 'OPEN',
        provenanceReference: args.caseId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

  if (args.route.status === 'UNAVAILABLE') {
    if (!open) {
      await tx.operationalIncident.create({
        data: {
          incidentType: 'SAFETY_ROUTING',
          code: 'SAFETY_ROUTE_UNAVAILABLE',
          status: 'OPEN',
          summary:
            'Safety route could not be resolved.',
          metadata:
            args.route
              .snapshot as Prisma.InputJsonValue,
          requestId: args.requestId,
          provenanceReference: args.caseId,
        },
      });
    }

    return;
  }

  if (open) {
    await tx.operationalIncident.update({
      where: {
        id: open.id,
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: args.now,
        metadata:
          args.route
            .snapshot as Prisma.InputJsonValue,
      },
    });
  }
}

async function appendLifecycle(
  tx: Tx,
  args: {
    requestId: string;
    actorId: string;
    caseId: string;
    fromState: SafetyCaseLifecycle | null;
    toState: SafetyCaseLifecycle;
    reason: string;
    occurredAt: Date;
  },
) {
  await tx.safetyCaseLifecycleEvent.create({
    data: {
      caseId: args.caseId,
      fromState: args.fromState,
      toState: args.toState,
      actorId: args.actorId,
      requestId: args.requestId,
      reason: args.reason,
      occurredAt: args.occurredAt,
    },
  });
}

async function auditRoute(
  tx: Tx,
  args: {
    actorId: string;
    patientId: string;
    caseId: string;
    requestId: string;
    route: ResolvedSafetyRoute;
  },
) {
  await tx.auditEvent.create({
    data: {
      actorId: args.actorId,
      action:
        args.route.status === 'UNAVAILABLE'
          ? 'SAFETY_ROUTE_UNAVAILABLE'
          : 'SAFETY_ROUTE_RESOLVED',
      entityType: 'SAFETY_CASE',
      entityId: args.caseId,
      patientId: args.patientId,
      requestId: args.requestId,
      metadata: {
        routeStatus: args.route.status,
        routeSnapshot: args.route.snapshot,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function evaluatePatientSafety(
  args: {
    tx: Tx;
    config: AppConfig;
    clock: Clock;
    patientId: string;
    actorId: string;
    requestId: string;
    input: SafetyInput;
  },
) {
  const { tx } = args;

  await lockPatientForProcessing(
    tx,
    args.patientId,
  );

  const onboarding =
    await tx.patientOnboardingState.findUnique({
      where: {
        patientId: args.patientId,
      },
    });

  if (!onboarding?.authoritativeRevisionId) {
    throw new DomainError(
      409,
      'VERSION_CONFLICT',
      'Submit onboarding before safety evaluation.',
    );
  }

  const profile =
    await tx.patientProfile.findUniqueOrThrow({
      where: {
        patientId: args.patientId,
      },
    });

  const authoritative =
    await tx.onboardingRevision.findUniqueOrThrow({
      where: {
        id: onboarding.authoritativeRevisionId,
      },
    });

  const submitted = completeSubmittedDraft(
    authoritative.responseSnapshot,
  );

  const direction =
    submitted.recoveryDirection.state ===
    'ANSWERED'
      ? submitted.recoveryDirection.value
      : 'UNSURE';

  const evaluationNow = args.clock.now();

  const ageOver65 =
    args.input.ageOver65 === 'YES'
      ? true
      : args.input.ageOver65 === 'NO'
        ? false
        : undefined;

  const evaluationContext = {
    evaluatedAt: evaluationNow.toISOString(),
    timezone: profile.monitoringTimezone,
    sourceOnboardingRevisionId:
      onboarding.authoritativeRevisionId,
    plannedDirection: direction,
    baselineAverageWeeklyDrinks: {
      availability:
        'UNAVAILABLE_UNTIL_REDUCTION_BASELINE',
    },
    targetWeeklyDrinks: {
      availability:
        'UNAVAILABLE_UNTIL_REDUCTION_BASELINE',
    },
    patientReportedSimilarHeavyRegularUseAtLeast3Months:
      args.input
        .similarHeavyRegularUseAtLeast3Months,
    canonicalProlongedHeavyRegularUse: {
      state: 'UNKNOWN',
      missingDependency:
        'COMMIT_3_28_DAY_BASELINE',
    },
    ageOver65: args.input.ageOver65,
    cssrs: CSSRS_RECENT_PROVENANCE,
  };

  const evaluation = evaluateSafety(
    args.input,
    {
      now: evaluationNow,
      timezone: profile.monitoringTimezone,
      plannedDirection: direction,
      ...(ageOver65 !== undefined
        ? { ageOver65 }
        : {}),
    },
  );

  const latestInputRevision =
    await tx.safetyInputRevision.findFirst({
      where: {
        patientId: args.patientId,
      },
      orderBy: {
        revision: 'desc',
      },
      select: {
        revision: true,
      },
    });

  const revision =
    await tx.safetyInputRevision.create({
      data: {
        patientId: args.patientId,
        revision:
          (latestInputRevision?.revision ?? 0) +
          1,
        sourceOnboardingRevisionId:
          onboarding.authoritativeRevisionId,
        inputSnapshot:
          args.input as unknown as Prisma.InputJsonValue,
        instrument:
          SAFETY_SCREEN_PROVENANCE.instrument,
        instrumentVersion:
          SAFETY_SCREEN_PROVENANCE.version,
        instrumentSource:
          SAFETY_SCREEN_PROVENANCE.source,
        schemaVersion: 'safety_v1',
        trigger: 'ONBOARDING',
        actorId: args.actorId,
        submittedAt: evaluationNow,
      },
    });

  const legacyDomain =
    evaluation.domainResults.length === 1
      ? evaluation.domainResults[0]!
      : null;

  const persistedEvaluation =
    await tx.safetyEvaluationResult.create({
      data: {
        patientId: args.patientId,
        safetyInputRevisionId: revision.id,
        severity: evaluation.severity,
        gateStatus: evaluation.gateStatus,
        reasonCodes: evaluation.reasonCodes,
        safetyDomain:
          legacyDomain?.domain ?? null,
        ownerRole:
          legacyDomain?.ownerRole ?? null,
        clinicianContext:
          evaluation.clinicianContext,
        allowedSubjectiveInterventions:
          evaluation
            .allowedSubjectiveInterventions,
        monitoringPromptPolicy:
          evaluation.monitoringPromptPolicy,
        goalChangeAllowed:
          evaluation.goalChangeAllowed,
        evaluatorVersion:
          evaluation.evaluatorVersion,
        configurationVersion:
          evaluation.configurationVersion,
        evaluatedAt: evaluationNow,
        contextSnapshot:
          evaluationContext as Prisma.InputJsonValue,
        resultSnapshot:
          evaluation as unknown as Prisma.InputJsonValue,
      },
    });

  for (const domain of evaluation.domainResults) {
    const active =
      await tx.safetyCase.findFirst({
        where: {
          patientId: args.patientId,
          domain: domain.domain,
          resolvedAt: null,
        },
        include: {
          restrictions: {
            orderBy: {
              version: 'desc',
            },
            take: 1,
          },
        },
      });

    if (!active) {
      const route = await resolveSafetyRoute(
        tx,
        args.config,
        evaluationNow,
        domain,
      );

      const initialLifecycle =
        domain.severity === 'S0_EMERGENCY'
          ? ('ESCALATED_TO_EMERGENCY' as const)
          : ('HANDOFF_INITIATED' as const);

      const safetyCase =
        await tx.safetyCase.create({
          data: {
            patientId: args.patientId,
            domain: domain.domain,
            sourceSafetyEvaluationResultId:
              persistedEvaluation.id,
            severity: domain.severity,
            gateStatus: domain.gateStatus,
            ownerRole: domain.ownerRole,
            lifecycle: initialLifecycle,
            routeStatus: route.status,
            currentRouteSnapshot:
              route.snapshot as Prisma.InputJsonValue,
            routeProfileId: route.profileId,
            routeProfileLogicalVersion:
              route.logicalVersion,
            detectedAt: evaluationNow,
          },
        });

      const restriction = restrictionForGate(
        domain.gateStatus,
      );

      const storedRestriction =
        await tx.safetyCaseRestrictionVersion.create({
          data: {
            caseId: safetyCase.id,
            version: 1,
            ...restriction,
            allowedSubjectiveInterventions:
              restriction.allowedSubjectiveInterventions as Prisma.InputJsonValue,
            createdByUserId: args.actorId,
            createdAt: evaluationNow,
          },
        });

      await tx.safetyCase.update({
        where: {
          id: safetyCase.id,
        },
        data: {
          currentRestrictionVersionId:
            storedRestriction.id,
        },
      });

      await appendLifecycle(tx, {
        requestId: args.requestId,
        actorId: args.actorId,
        caseId: safetyCase.id,
        fromState: null,
        toState: 'DETECTED',
        reason:
          'Deterministic safety evaluation detected a controlled safety domain.',
        occurredAt: evaluationNow,
      });

      await appendLifecycle(tx, {
        requestId: args.requestId,
        actorId: args.actorId,
        caseId: safetyCase.id,
        fromState: 'DETECTED',
        toState: initialLifecycle,
        reason:
          initialLifecycle ===
          'ESCALATED_TO_EMERGENCY'
            ? 'Emergency safety route initiated.'
            : 'Safety handoff initiated.',
        occurredAt: evaluationNow,
      });

      await reconcileSafetyRoutingIncident(
        tx,
        {
          caseId: safetyCase.id,
          requestId: args.requestId,
          route,
          now: evaluationNow,
        },
      );

      await auditRoute(tx, {
        actorId: args.actorId,
        patientId: args.patientId,
        caseId: safetyCase.id,
        requestId: args.requestId,
        route,
      });

      await tx.auditEvent.create({
        data: {
          actorId: args.actorId,
          action: 'SAFETY_CASE_DETECTED',
          entityType: 'SAFETY_CASE',
          entityId: safetyCase.id,
          patientId: args.patientId,
          requestId: args.requestId,
          ruleSetVersion:
            evaluation.evaluatorVersion,
          configurationVersion:
            evaluation.configurationVersion,
          sourceRevisionReference:
            persistedEvaluation.id,
          metadata: {
            domain: domain.domain,
            effectiveSeverity:
              domain.severity,
            effectiveGateStatus:
              domain.gateStatus,
          },
        },
      });

      continue;
    }

    const incomingRank =
      SEVERITY_RANK[domain.severity];

    const activeRank =
      SEVERITY_RANK[
        active.severity as SafetySeverity
      ] ?? 4;

    const severityTightens =
      incomingRank < activeRank;

    const gateTightens =
      compareGateRestriction(
        domain.gateStatus,
        active.gateStatus as Exclude<
          SafetyGateStatus,
          'NOT_ASSESSED'
        >,
      ) < 0;

    const effectiveSeverity =
      severityTightens
        ? domain.severity
        : (active.severity as Exclude<
            SafetySeverity,
            'S_NONE'
          >);

    const effectiveGateStatus =
      severityTightens || gateTightens
        ? domain.gateStatus
        : (active.gateStatus as Exclude<
            SafetyGateStatus,
            'NOT_ASSESSED'
          >);

    const effectiveOwnerRole =
      severityTightens
        ? domain.ownerRole
        : active.ownerRole;

    let nextLifecycle = active.lifecycle;
    let lifecycleReason: string | null =
      null;

    if (
      effectiveSeverity === 'S0_EMERGENCY' &&
      active.lifecycle !==
        'ESCALATED_TO_EMERGENCY'
    ) {
      assertSafetyTransition(
        active.lifecycle,
        'ESCALATED_TO_EMERGENCY',
      );

      nextLifecycle =
        'ESCALATED_TO_EMERGENCY';

      lifecycleReason =
        'A new deterministic safety evaluation required emergency escalation.';
    } else if (
      active.lifecycle === 'DETECTED'
    ) {
      assertSafetyTransition(
        active.lifecycle,
        'HANDOFF_INITIATED',
      );

      nextLifecycle = 'HANDOFF_INITIATED';

      lifecycleReason =
        'Safety handoff lifecycle normalized after re-evaluation.';
    }

    const effectiveDomain: SafetyDomainResult =
      {
        domain: domain.domain,
        severity: effectiveSeverity,
        gateStatus: effectiveGateStatus,
        ownerRole:
          effectiveOwnerRole as SafetyDomainResult['ownerRole'],
        reasonCodes: domain.reasonCodes,
      };

    const route = await resolveSafetyRoute(
      tx,
      args.config,
      evaluationNow,
      effectiveDomain,
    );

    const replaceSource =
      incomingRank <= activeRank;

    const updated =
      await tx.safetyCase.update({
        where: {
          id: active.id,
        },
        data: {
          ...(replaceSource
            ? {
                sourceSafetyEvaluationResultId:
                  persistedEvaluation.id,
              }
            : {}),
          severity: effectiveSeverity,
          gateStatus: effectiveGateStatus,
          ownerRole: effectiveOwnerRole,
          lifecycle: nextLifecycle,
          version: {
            increment: 1,
          },
          routeStatus: route.status,
          currentRouteSnapshot:
            route.snapshot as Prisma.InputJsonValue,
          routeProfileId: route.profileId,
          routeProfileLogicalVersion:
            route.logicalVersion,
        },
      });

    if (
      severityTightens ||
      gateTightens
    ) {
      const desiredRestriction =
        restrictionForGate(
          effectiveGateStatus,
        );

      const latestRestriction =
        active.restrictions[0];

      if (
        !sameRestriction(
          desiredRestriction,
          latestRestriction,
        )
      ) {
        const restriction =
          await tx.safetyCaseRestrictionVersion.create(
            {
              data: {
                caseId: active.id,
                version:
                  (latestRestriction?.version ??
                    0) + 1,
                ...desiredRestriction,
                allowedSubjectiveInterventions:
                  desiredRestriction.allowedSubjectiveInterventions as Prisma.InputJsonValue,
                createdByUserId:
                  args.actorId,
                createdAt:
                  evaluationNow,
              },
            },
          );

        await tx.safetyCase.update({
          where: {
            id: active.id,
          },
          data: {
            currentRestrictionVersionId:
              restriction.id,
          },
        });
      }
    }

    if (
      nextLifecycle !== active.lifecycle &&
      lifecycleReason
    ) {
      await appendLifecycle(tx, {
        requestId: args.requestId,
        actorId: args.actorId,
        caseId: active.id,
        fromState: active.lifecycle,
        toState: nextLifecycle,
        reason: lifecycleReason,
        occurredAt: evaluationNow,
      });
    }

    await reconcileSafetyRoutingIncident(
      tx,
      {
        caseId: active.id,
        requestId: args.requestId,
        route,
        now: evaluationNow,
      },
    );

    await auditRoute(tx, {
      actorId: args.actorId,
      patientId: args.patientId,
      caseId: active.id,
      requestId: args.requestId,
      route,
    });

    await tx.auditEvent.create({
      data: {
        actorId: args.actorId,
        action:
          severityTightens ||
          gateTightens
            ? 'SAFETY_CASE_TIGHTENED'
            : 'SAFETY_CASE_REEVALUATED_NO_RELAXATION',
        entityType: 'SAFETY_CASE',
        entityId: active.id,
        patientId: args.patientId,
        requestId: args.requestId,
        ruleSetVersion:
          evaluation.evaluatorVersion,
        configurationVersion:
          evaluation.configurationVersion,
        sourceRevisionReference:
          persistedEvaluation.id,
        metadata: {
          domain: domain.domain,
          incomingSeverity:
            domain.severity,
          effectiveSeverity,
          effectiveGateStatus,
          sourceEvaluationReplaced:
            replaceSource,
          caseVersion: updated.version,
          routeStatus: route.status,
        },
      },
    });
  }

  await tx.auditEvent.create({
    data: {
      actorId: args.actorId,
      action: 'SAFETY_EVALUATED',
      entityType:
        'SAFETY_INPUT_REVISION',
      entityId: revision.id,
      patientId: args.patientId,
      requestId: args.requestId,
      ruleSetVersion:
        evaluation.evaluatorVersion,
      configurationVersion:
        evaluation.configurationVersion,
      instrumentVersion:
        SAFETY_SCREEN_PROVENANCE.version,
      sourceRevisionReference:
        revision.id,
      metadata: {
        safetyEvaluationResultId:
          persistedEvaluation.id,
      },
    },
  });

  const safety =
    await loadPatientSafetyProjection(
      tx,
      args.patientId,
    );

  const requiresReview =
    safety.safetyState ===
      'HANDOFF_REQUIRED' ||
    safety.safetyState ===
      'REVIEW_REQUIRED';

  const setupState = requiresReview
    ? 'SAFETY_REVIEW_REQUIRED'
    : direction === 'REDUCTION'
      ? 'REDUCTION_SETUP_REQUIRED'
      : 'SETUP_INCOMPLETE';

  return SafetyEvaluationResponseSchema.parse({
    setupState,
    requiresReview,
    evaluationId:
      persistedEvaluation.id,
    safety,
  });
}