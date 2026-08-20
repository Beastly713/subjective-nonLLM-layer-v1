import {
  AdminSafetyCaseListResponseSchema,
  AdminSafetyCaseProjectionSchema,
  SafetyCaseListResponseSchema,
  SafetyCaseMutationRequestSchema,
  SafetyCaseProjectionSchema,
  SafetyDispositionRequestSchema,
  SafetyGateStatusSchema,
  SafetyRestrictionSnapshotSchema,
  type SafetyCaseLifecycle,
  type SafetyDisposition,
  type SafetyGateStatus,
  type SubjectiveInterventionClass,
} from '@aud-subjective/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import {
  executeIdempotently,
  requireIdempotencyKey,
} from '../../shared/authz/idempotency.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { assertSafetyTransition } from './lifecycle.js';
import {
  canonicalStoredInterventions,
  loadPatientSafetyProjection,
  projectAdminSafetyCase,
  projectSafetyCase,
  safetyCaseInclude,
  type SafetyCaseWithProjection,
} from './projections.js';
import { SAFETY_ROUTE_POLICY_VERSION } from './route-policy.js';
import {
  reconcileSafetyRoutingIncident,
  resolveSafetyRoute,
  type ResolvedSafetyRoute,
} from './service.js';

const CaseParamsSchema = z.object({ caseId: z.uuid() });

type SafetyReadDb = Pick<
  Prisma.TransactionClient,
  'safetyCase' | 'operationalIncident'
>;
type Tx = Prisma.TransactionClient;
type EffectiveGate = Exclude<SafetyGateStatus, 'NOT_ASSESSED'>;

type EffectiveRestriction = {
  gateStatus: EffectiveGate;
  allowedSubjectiveInterventions: SubjectiveInterventionClass[];
  monitoringPromptPolicy: 'CONTINUE' | 'PAUSE';
  goalChangeAllowed: boolean;
  reassessmentDueAt: Date | null;
};

function requireScope(
  actor: Awaited<ReturnType<typeof requirePermission>>,
  scope: 'OWN_PATIENT' | 'ASSIGNED_PATIENTS' | 'ADMIN_OPERATIONAL',
) {
  if (!actor.access.scopeKinds.includes(scope)) {
    throw new DomainError(
      403,
      'PERMISSION_DENIED',
      'The action is not permitted.',
    );
  }
}

async function assignedCase(
  db: SafetyReadDb,
  clinicianUserId: string,
  caseId: string,
) {
  const safetyCase = await db.safetyCase.findFirst({
    where: {
      id: caseId,
      profile: {
        patient: {
          applicationAccount: { is: { state: 'ACTIVE' } },
          patientAssignments: {
            some: { clinicianUserId, endedAt: null },
          },
        },
      },
    },
    include: safetyCaseInclude,
  });

  if (!safetyCase) {
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  }

  return safetyCase;
}

async function lockAndLoadAssignedCase(
  tx: Tx,
  clinicianUserId: string,
  caseId: string,
) {
  const scoped = await tx.safetyCase.findFirst({
    where: {
      id: caseId,
      profile: {
        patient: {
          applicationAccount: { is: { state: 'ACTIVE' } },
          patientAssignments: {
            some: { clinicianUserId, endedAt: null },
          },
        },
      },
    },
    select: { patientId: true },
  });

  if (!scoped) {
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  }

  await lockPatientForProcessing(tx, scoped.patientId);

  return assignedCase(tx, clinicianUserId, caseId);
}

function currentRestriction(
  current: SafetyCaseWithProjection,
): EffectiveRestriction {
  const latest = current.restrictions[0];

  if (!latest) {
    throw new DomainError(
      409,
      'SAFETY_CASE_STATE_INVALID',
      'The safety case does not have an effective restriction state.',
    );
  }

  const gate = SafetyGateStatusSchema.safeParse(latest.gateStatus);

  if (!gate.success || gate.data === 'NOT_ASSESSED') {
    throw new DomainError(
      409,
      'SAFETY_CASE_STATE_INVALID',
      'The safety case restriction state is invalid.',
    );
  }

  return {
    gateStatus: gate.data,
    allowedSubjectiveInterventions: canonicalStoredInterventions(
      latest.allowedSubjectiveInterventions,
    ),
    monitoringPromptPolicy:
      latest.monitoringPromptPolicy === 'CONTINUE' ? 'CONTINUE' : 'PAUSE',
    goalChangeAllowed: latest.goalChangeAllowed,
    reassessmentDueAt: latest.reassessmentDueAt,
  };
}

function serializeRestriction(restriction: EffectiveRestriction) {
  return SafetyRestrictionSnapshotSchema.parse({
    gateStatus: restriction.gateStatus,
    allowedSubjectiveInterventions: restriction.allowedSubjectiveInterventions,
    monitoringPromptPolicy: restriction.monitoringPromptPolicy,
    goalChangeAllowed: restriction.goalChangeAllowed,
    reassessmentDueAt: restriction.reassessmentDueAt?.toISOString() ?? null,
  });
}

function restrictionsEqual(
  left: EffectiveRestriction,
  right: EffectiveRestriction,
) {
  return (
    left.gateStatus === right.gateStatus &&
    left.monitoringPromptPolicy === right.monitoringPromptPolicy &&
    left.goalChangeAllowed === right.goalChangeAllowed &&
    left.reassessmentDueAt?.getTime() === right.reassessmentDueAt?.getTime() &&
    JSON.stringify(left.allowedSubjectiveInterventions) ===
      JSON.stringify(right.allowedSubjectiveInterventions)
  );
}

function assertDoesNotBroaden(
  current: EffectiveRestriction,
  requested: EffectiveRestriction,
) {
  const allowedSet = new Set(current.allowedSubjectiveInterventions);

  if (
    requested.allowedSubjectiveInterventions.some(
      (intervention) => !allowedSet.has(intervention),
    )
  ) {
    throw new DomainError(
      409,
      'SAFETY_RESTRICTION_BROADENING_NOT_ALLOWED',
      'Continuing a handoff cannot broaden patient interventions.',
    );
  }

  if (
    current.monitoringPromptPolicy === 'PAUSE' &&
    requested.monitoringPromptPolicy === 'CONTINUE'
  ) {
    throw new DomainError(
      409,
      'SAFETY_RESTRICTION_BROADENING_NOT_ALLOWED',
      'Continuing a handoff cannot resume paused monitoring prompts.',
    );
  }

  if (!current.goalChangeAllowed && requested.goalChangeAllowed) {
    throw new DomainError(
      409,
      'SAFETY_RESTRICTION_BROADENING_NOT_ALLOWED',
      'Continuing a handoff cannot re-enable goal changes.',
    );
  }

  if (current.reassessmentDueAt) {
    if (
      !requested.reassessmentDueAt ||
      requested.reassessmentDueAt > current.reassessmentDueAt
    ) {
      throw new DomainError(
        409,
        'SAFETY_RESTRICTION_BROADENING_NOT_ALLOWED',
        'Continuing a handoff cannot defer an existing reassessment requirement.',
      );
    }
  }
}

async function appendRestriction(
  tx: Tx,
  current: SafetyCaseWithProjection,
  restriction: EffectiveRestriction,
  actorId: string,
  sourceDispositionId: string,
  now: Date,
) {
  const existing = currentRestriction(current);

  if (restrictionsEqual(existing, restriction)) return null;

  return tx.safetyCaseRestrictionVersion.create({
    data: {
      caseId: current.id,
      version: (current.restrictions[0]?.version ?? 0) + 1,
      gateStatus: restriction.gateStatus,
      allowedSubjectiveInterventions:
        restriction.allowedSubjectiveInterventions as Prisma.InputJsonValue,
      monitoringPromptPolicy: restriction.monitoringPromptPolicy,
      goalChangeAllowed: restriction.goalChangeAllowed,
      reassessmentDueAt: restriction.reassessmentDueAt,
      sourceDispositionId,
      createdByUserId: actorId,
      createdAt: now,
    },
  });
}

async function createDisposition(
  tx: Tx,
  current: SafetyCaseWithProjection,
  actorId: string,
  disposition: SafetyDisposition,
  reason: string,
  restriction: EffectiveRestriction,
  now: Date,
) {
  const latest = await tx.safetyCaseDisposition.findFirst({
    where: { caseId: current.id },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  return tx.safetyCaseDisposition.create({
    data: {
      caseId: current.id,
      version: (latest?.version ?? 0) + 1,
      disposition,
      restrictions: serializeRestriction(restriction) as Prisma.InputJsonValue,
      actorId,
      actorRole: 'CLINICIAN',
      reason,
      sourceCaseVersion: current.version,
      createdAt: now,
    },
  });
}

async function auditRoute(
  tx: Tx,
  request: FastifyRequest,
  actorId: string,
  current: SafetyCaseWithProjection,
  route: ResolvedSafetyRoute,
) {
  await tx.auditEvent.create({
    data: {
      actorId,
      actorRole: 'CLINICIAN',
      action:
        route.status === 'UNAVAILABLE'
          ? 'SAFETY_ROUTE_UNAVAILABLE'
          : 'SAFETY_ROUTE_RESOLVED',
      entityType: 'SAFETY_CASE',
      entityId: current.id,
      patientId: current.patientId,
      requestId: request.id,
      metadata: {
        routeStatus: route.status,
        routeSnapshot: route.snapshot,
      } as Prisma.InputJsonValue,
    },
  });
}

async function loadProjectedCase(
  tx: Tx,
  caseId: string,
): Promise<Prisma.InputJsonValue> {
  const updated = await tx.safetyCase.findUniqueOrThrow({
    where: { id: caseId },
    include: safetyCaseInclude,
  });

  const projected = SafetyCaseProjectionSchema.parse(
    projectSafetyCase(updated),
  );

  return projected as unknown as Prisma.InputJsonValue;
}

function restrictionFromRequest(
  gateStatus: EffectiveGate,
  input: {
    allowedSubjectiveInterventions: SubjectiveInterventionClass[];
    monitoringPromptPolicy: 'CONTINUE' | 'PAUSE';
    goalChangeAllowed: boolean;
    reassessmentDueAt: string | null;
  },
): EffectiveRestriction {
  return {
    gateStatus,
    allowedSubjectiveInterventions: [...input.allowedSubjectiveInterventions],
    monitoringPromptPolicy: input.monitoringPromptPolicy,
    goalChangeAllowed: input.goalChangeAllowed,
    reassessmentDueAt: input.reassessmentDueAt
      ? new Date(input.reassessmentDueAt)
      : null,
  };
}

async function applyDisposition(
  tx: Tx,
  args: {
    request: FastifyRequest;
    actorId: string;
    caseId: string;
    expectedVersion: number;
    reason: string;
    disposition: SafetyDisposition;
    restrictions?: {
      allowedSubjectiveInterventions: SubjectiveInterventionClass[];
      monitoringPromptPolicy: 'CONTINUE' | 'PAUSE';
      goalChangeAllowed: boolean;
      reassessmentDueAt: string | null;
    };
    config: AppConfig;
    clock: Clock;
  },
) {
  const current = await lockAndLoadAssignedCase(tx, args.actorId, args.caseId);

  if (current.version !== args.expectedVersion) {
    throw new DomainError(
      409,
      'VERSION_CONFLICT',
      'The safety case changed before this update.',
    );
  }

  if (current.resolvedAt) {
    throw new DomainError(
      409,
      'SAFETY_CASE_TRANSITION_INVALID',
      'A resolved safety case cannot be changed.',
    );
  }

  const now = args.clock.now();
  const existingRestriction = currentRestriction(current);

  let targetRestriction = existingRestriction;
  let nextLifecycle: SafetyCaseLifecycle = current.lifecycle;
  let resolvedAt: Date | null | undefined;
  let route: ResolvedSafetyRoute | null = null;
  let lifecycleReason: string | null = null;

  switch (args.disposition) {
    case 'SAFE_TO_CONTINUE_STANDARD_MONITORING': {
      if (current.lifecycle === 'ESCALATED_TO_EMERGENCY') {
        throw new DomainError(
          409,
          'SAFETY_CASE_TRANSITION_INVALID',
          'Resolve an emergency external handoff through the external-handoff resolution action.',
        );
      }

      assertSafetyTransition(current.lifecycle, 'RESOLVED');

      targetRestriction = {
        gateStatus: 'ALLOW_MONITORING',
        allowedSubjectiveInterventions: [],
        monitoringPromptPolicy: 'CONTINUE',
        goalChangeAllowed: true,
        reassessmentDueAt: null,
      };

      nextLifecycle = 'RESOLVED';
      resolvedAt = now;
      lifecycleReason =
        'Authorized safety owner cleared the case for standard monitoring.';

      route = {
        status: 'NOT_REQUIRED',
        snapshot: {
          status: 'NOT_REQUIRED',
          resolvedAt: now.toISOString(),
          policyVersion: SAFETY_ROUTE_POLICY_VERSION,
          selected: {
            primary: null,
            fallback: null,
          },
        },
        profileId: null,
        logicalVersion: null,
      };

      break;
    }

    case 'SAFE_TO_CONTINUE_WITH_RESTRICTIONS': {
      if (current.lifecycle !== 'PLAN_ESTABLISHED' || !args.restrictions) {
        throw new DomainError(
          409,
          'SAFETY_CASE_TRANSITION_INVALID',
          'A structured plan must be established before restrictions can be relaxed.',
        );
      }

      targetRestriction = restrictionFromRequest(
        'ALLOW_WITH_HANDOFF',
        args.restrictions,
      );

      break;
    }

    case 'CONTINUE_CLINICAL_HANDOFF': {
      if (
        ![
          'HANDOFF_INITIATED',
          'ACKNOWLEDGED',
          'CLINICAL_REVIEW_IN_PROGRESS',
          'PLAN_ESTABLISHED',
        ].includes(current.lifecycle)
      ) {
        throw new DomainError(
          409,
          'SAFETY_CASE_TRANSITION_INVALID',
          'The case is not in the ordinary clinical handoff path.',
        );
      }

      if (args.restrictions) {
        const requested = restrictionFromRequest(
          existingRestriction.gateStatus,
          args.restrictions,
        );

        assertDoesNotBroaden(existingRestriction, requested);
        targetRestriction = requested;
      }

      break;
    }

    case 'MONITORING_TEMPORARILY_PAUSED': {
      targetRestriction = {
        ...existingRestriction,
        allowedSubjectiveInterventions: [
          ...existingRestriction.allowedSubjectiveInterventions,
        ],
        monitoringPromptPolicy: 'PAUSE',
      };

      break;
    }

    case 'EMERGENCY_EXTERNAL_MANAGEMENT': {
      if (current.lifecycle !== 'ESCALATED_TO_EMERGENCY') {
        assertSafetyTransition(current.lifecycle, 'ESCALATED_TO_EMERGENCY');

        nextLifecycle = 'ESCALATED_TO_EMERGENCY';
        lifecycleReason =
          'Authorized safety owner escalated the case to emergency external management.';
      }

      targetRestriction = {
        gateStatus: 'BLOCK_AND_HANDOFF',
        allowedSubjectiveInterventions: [],
        monitoringPromptPolicy: 'PAUSE',
        goalChangeAllowed: false,
        reassessmentDueAt: existingRestriction.reassessmentDueAt,
      };

      route = await resolveSafetyRoute(tx, args.config, now, {
        severity: 'S0_EMERGENCY',
        domain: current.domain,
      });

      break;
    }
  }

  const disposition = await createDisposition(
    tx,
    current,
    args.actorId,
    args.disposition,
    args.reason,
    targetRestriction,
    now,
  );

  const restriction = await appendRestriction(
    tx,
    current,
    targetRestriction,
    args.actorId,
    disposition.id,
    now,
  );

  const updateData: Prisma.SafetyCaseUncheckedUpdateInput = {
    gateStatus: targetRestriction.gateStatus,
    lifecycle: nextLifecycle,
    version: { increment: 1 },
    ...(restriction ? { currentRestrictionVersionId: restriction.id } : {}),
    ...(resolvedAt !== undefined ? { resolvedAt } : {}),
  };

  if (route) {
    updateData.routeStatus = route.status;
    updateData.currentRouteSnapshot = route.snapshot as Prisma.InputJsonValue;
    updateData.routeProfileId = route.profileId;
    updateData.routeProfileLogicalVersion = route.logicalVersion;
  }

  await tx.safetyCase.update({
    where: { id: current.id },
    data: updateData,
  });

  if (nextLifecycle !== current.lifecycle && lifecycleReason) {
    await tx.safetyCaseLifecycleEvent.create({
      data: {
        caseId: current.id,
        fromState: current.lifecycle,
        toState: nextLifecycle,
        actorId: args.actorId,
        reason: lifecycleReason,
        requestId: args.request.id,
        occurredAt: now,
      },
    });
  }

  if (route) {
    await reconcileSafetyRoutingIncident(tx, {
      caseId: current.id,
      requestId: args.request.id,
      route,
      now,
    });

    await auditRoute(tx, args.request, args.actorId, current, route);
  }

  await tx.auditEvent.create({
    data: {
      actorId: args.actorId,
      actorRole: 'CLINICIAN',
      action: 'SAFETY_DISPOSITION_RECORDED',
      entityType: 'SAFETY_CASE',
      entityId: current.id,
      patientId: current.patientId,
      requestId: args.request.id,
      metadata: {
        disposition: args.disposition,
        fromLifecycle: current.lifecycle,
        toLifecycle: nextLifecycle,
        effectiveRestriction: serializeRestriction(targetRestriction),
      } as Prisma.InputJsonValue,
    },
  });

  return loadProjectedCase(tx, current.id);
}

async function resolveExternalHandoff(
  tx: Tx,
  args: {
    request: FastifyRequest;
    actorId: string;
    caseId: string;
    expectedVersion: number;
    reason: string;
    clock: Clock;
  },
) {
  const current = await lockAndLoadAssignedCase(tx, args.actorId, args.caseId);

  if (current.version !== args.expectedVersion) {
    throw new DomainError(
      409,
      'VERSION_CONFLICT',
      'The safety case changed before this update.',
    );
  }

  assertSafetyTransition(current.lifecycle, 'RESOLVED_EXTERNAL_HANDOFF');

  const now = args.clock.now();

  const targetRestriction: EffectiveRestriction = {
    gateStatus: 'ALLOW_MONITORING',
    allowedSubjectiveInterventions: [],
    monitoringPromptPolicy: 'CONTINUE',
    goalChangeAllowed: true,
    reassessmentDueAt: null,
  };

  const route: ResolvedSafetyRoute = {
    status: 'NOT_REQUIRED',
    snapshot: {
      status: 'NOT_REQUIRED',
      resolvedAt: now.toISOString(),
      policyVersion: SAFETY_ROUTE_POLICY_VERSION,
      selected: {
        primary: null,
        fallback: null,
      },
    },
    profileId: null,
    logicalVersion: null,
  };

  const disposition = await createDisposition(
    tx,
    current,
    args.actorId,
    'SAFE_TO_CONTINUE_STANDARD_MONITORING',
    args.reason,
    targetRestriction,
    now,
  );

  const restriction = await appendRestriction(
    tx,
    current,
    targetRestriction,
    args.actorId,
    disposition.id,
    now,
  );

  await tx.safetyCase.update({
    where: { id: current.id },
    data: {
      gateStatus: 'ALLOW_MONITORING',
      lifecycle: 'RESOLVED_EXTERNAL_HANDOFF',
      resolvedAt: now,
      version: { increment: 1 },
      ...(restriction ? { currentRestrictionVersionId: restriction.id } : {}),
      routeStatus: route.status,
      currentRouteSnapshot: route.snapshot as Prisma.InputJsonValue,
      routeProfileId: null,
      routeProfileLogicalVersion: null,
    },
  });

  await reconcileSafetyRoutingIncident(tx, {
    caseId: current.id,
    requestId: args.request.id,
    route,
    now,
  });

  await auditRoute(tx, args.request, args.actorId, current, route);

  await tx.safetyCaseLifecycleEvent.create({
    data: {
      caseId: current.id,
      fromState: current.lifecycle,
      toState: 'RESOLVED_EXTERNAL_HANDOFF',
      actorId: args.actorId,
      reason: args.reason,
      requestId: args.request.id,
      occurredAt: now,
    },
  });

  await tx.auditEvent.create({
    data: {
      actorId: args.actorId,
      actorRole: 'CLINICIAN',
      action: 'SAFETY_EXTERNAL_HANDOFF_RESOLVED',
      entityType: 'SAFETY_CASE',
      entityId: current.id,
      patientId: current.patientId,
      requestId: args.request.id,
      metadata: {
        disposition: 'SAFE_TO_CONTINUE_STANDARD_MONITORING',
      },
    },
  });

  return loadProjectedCase(tx, current.id);
}

export function registerSafetyRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.get('/api/v1/patient/safety', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_SAFETY_READ',
    );

    requireScope(actor, 'OWN_PATIENT');

    return loadPatientSafetyProjection(prisma, actor.userId);
  });

  app.get('/api/v1/clinician/safety-cases', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'SAFETY_CASE_READ',
    );

    requireScope(actor, 'ASSIGNED_PATIENTS');

    const cases = await prisma.safetyCase.findMany({
      where: {
        resolvedAt: null,
        profile: {
          patient: {
            applicationAccount: {
              is: { state: 'ACTIVE' },
            },
            patientAssignments: {
              some: {
                clinicianUserId: actor.userId,
                endedAt: null,
              },
            },
          },
        },
      },
      include: safetyCaseInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });

    return SafetyCaseListResponseSchema.parse({
      items: cases.map(projectSafetyCase),
    });
  });

  app.get('/api/v1/clinician/safety-cases/:caseId', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'SAFETY_CASE_READ',
    );

    requireScope(actor, 'ASSIGNED_PATIENTS');

    const { caseId } = CaseParamsSchema.parse(request.params);

    return SafetyCaseProjectionSchema.parse(
      projectSafetyCase(await assignedCase(prisma, actor.userId, caseId)),
    );
  });

  const lifecycleActions = {
    acknowledge: {
      toState: 'ACKNOWLEDGED',
      action: 'SAFETY_CASE_ACKNOWLEDGED',
    },
    'begin-review': {
      toState: 'CLINICAL_REVIEW_IN_PROGRESS',
      action: 'SAFETY_REVIEW_STARTED',
    },
    'establish-plan': {
      toState: 'PLAN_ESTABLISHED',
      action: 'SAFETY_PLAN_ESTABLISHED',
    },
  } as const;

  for (const [endpoint, policy] of Object.entries(lifecycleActions) as Array<
    [
      keyof typeof lifecycleActions,
      (typeof lifecycleActions)[keyof typeof lifecycleActions],
    ]
  >) {
    const { toState, action } = policy;

    app.post(
      `/api/v1/clinician/safety-cases/:caseId/${endpoint}`,
      async (request) => {
        const actor = await requirePermission(
          request,
          auth,
          prisma,
          config,
          'SAFETY_CASE_ACKNOWLEDGE',
          { fresh: true },
        );

        requireScope(actor, 'ASSIGNED_PATIENTS');

        const { caseId } = CaseParamsSchema.parse(request.params);

        const body = SafetyCaseMutationRequestSchema.parse(request.body);

        const key = requireIdempotencyKey(request.headers['idempotency-key']);

        const result = await executeIdempotently(
          prisma,
          actor.userId,
          action,
          key,
          { caseId, ...body },
          async (tx) => {
            const current = await lockAndLoadAssignedCase(
              tx,
              actor.userId,
              caseId,
            );

            if (current.version !== body.expectedVersion) {
              throw new DomainError(
                409,
                'VERSION_CONFLICT',
                'The safety case changed before this update.',
              );
            }

            const now = clock.now();
            let transitionFrom = current.lifecycle;

            if (endpoint === 'acknowledge' && transitionFrom === 'DETECTED') {
              assertSafetyTransition('DETECTED', 'HANDOFF_INITIATED');

              await tx.safetyCaseLifecycleEvent.create({
                data: {
                  caseId,
                  fromState: 'DETECTED',
                  toState: 'HANDOFF_INITIATED',
                  actorId: actor.userId,
                  reason:
                    'Recovered legacy detected case into the canonical handoff path.',
                  requestId: request.id,
                  occurredAt: now,
                },
              });

              transitionFrom = 'HANDOFF_INITIATED';
            }

            assertSafetyTransition(transitionFrom, toState);

            await tx.safetyCase.update({
              where: { id: caseId },
              data: {
                lifecycle: toState,
                version: { increment: 1 },
              },
            });

            await tx.safetyCaseLifecycleEvent.create({
              data: {
                caseId,
                fromState: transitionFrom,
                toState,
                actorId: actor.userId,
                reason: body.reason,
                requestId: request.id,
                occurredAt: now,
              },
            });

            await tx.auditEvent.create({
              data: {
                actorId: actor.userId,
                actorRole: 'CLINICIAN',
                action,
                entityType: 'SAFETY_CASE',
                entityId: caseId,
                patientId: current.patientId,
                requestId: request.id,
                metadata: {
                  fromState: current.lifecycle,
                  transitionFrom,
                  toState,
                },
              },
            });

            return loadProjectedCase(tx, caseId);
          },
        );

        return result.value;
      },
    );
  }

  app.post(
    '/api/v1/clinician/safety-cases/:caseId/disposition',
    async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'SAFETY_CASE_DISPOSITION',
        { fresh: true },
      );

      requireScope(actor, 'ASSIGNED_PATIENTS');

      const { caseId } = CaseParamsSchema.parse(request.params);

      const body = SafetyDispositionRequestSchema.parse(request.body);

      const key = requireIdempotencyKey(request.headers['idempotency-key']);

      const result = await executeIdempotently(
        prisma,
        actor.userId,
        'SAFETY_CASE_DISPOSITION',
        key,
        { caseId, ...body },
        (tx) =>
          applyDisposition(tx, {
            request,
            actorId: actor.userId,
            caseId,
            expectedVersion: body.expectedVersion,
            reason: body.reason,
            disposition: body.disposition,
            ...(body.restrictions ? { restrictions: body.restrictions } : {}),
            config,
            clock,
          }),
      );

      return result.value;
    },
  );

  app.post(
    '/api/v1/clinician/safety-cases/:caseId/escalate',
    async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'SAFETY_CASE_DISPOSITION',
        { fresh: true },
      );

      requireScope(actor, 'ASSIGNED_PATIENTS');

      const { caseId } = CaseParamsSchema.parse(request.params);

      const body = SafetyCaseMutationRequestSchema.parse(request.body);

      const key = requireIdempotencyKey(request.headers['idempotency-key']);

      const result = await executeIdempotently(
        prisma,
        actor.userId,
        'SAFETY_CASE_ESCALATE',
        key,
        { caseId, ...body },
        (tx) =>
          applyDisposition(tx, {
            request,
            actorId: actor.userId,
            caseId,
            expectedVersion: body.expectedVersion,
            reason: body.reason,
            disposition: 'EMERGENCY_EXTERNAL_MANAGEMENT',
            config,
            clock,
          }),
      );

      return result.value;
    },
  );

  app.post(
    '/api/v1/clinician/safety-cases/:caseId/resolve-external-handoff',
    async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'SAFETY_CASE_DISPOSITION',
        { fresh: true },
      );

      requireScope(actor, 'ASSIGNED_PATIENTS');

      const { caseId } = CaseParamsSchema.parse(request.params);

      const body = SafetyCaseMutationRequestSchema.parse(request.body);

      const key = requireIdempotencyKey(request.headers['idempotency-key']);

      const result = await executeIdempotently(
        prisma,
        actor.userId,
        'SAFETY_CASE_RESOLVE_EXTERNAL_HANDOFF',
        key,
        { caseId, ...body },
        (tx) =>
          resolveExternalHandoff(tx, {
            request,
            actorId: actor.userId,
            caseId,
            expectedVersion: body.expectedVersion,
            reason: body.reason,
            clock,
          }),
      );

      return result.value;
    },
  );

  app.get('/api/v1/admin/safety-cases', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'SAFETY_CASE_READ',
    );

    requireScope(actor, 'ADMIN_OPERATIONAL');

    const cases = await prisma.safetyCase.findMany({
      include: safetyCaseInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });

    const caseIds = cases.map((item) => item.id);

    const incidents = caseIds.length
      ? await prisma.operationalIncident.findMany({
          where: {
            incidentType: 'SAFETY_ROUTING',
            provenanceReference: {
              in: caseIds,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      : [];

    const byCase = new Map<string, typeof incidents>();

    for (const incident of incidents) {
      if (!incident.provenanceReference) continue;

      const current = byCase.get(incident.provenanceReference) ?? [];

      current.push(incident);

      byCase.set(incident.provenanceReference, current);
    }

    return AdminSafetyCaseListResponseSchema.parse({
      items: cases.map((item) =>
        projectAdminSafetyCase(item, byCase.get(item.id) ?? []),
      ),
    });
  });

  app.get('/api/v1/admin/safety-cases/:caseId', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'SAFETY_CASE_READ',
    );

    requireScope(actor, 'ADMIN_OPERATIONAL');

    const { caseId } = CaseParamsSchema.parse(request.params);

    const safetyCase = await prisma.safetyCase.findUnique({
      where: { id: caseId },
      include: safetyCaseInclude,
    });

    if (!safetyCase) {
      throw new DomainError(
        404,
        'NOT_FOUND',
        'The requested resource was not found.',
      );
    }

    const incidents = await prisma.operationalIncident.findMany({
      where: {
        incidentType: 'SAFETY_ROUTING',
        provenanceReference: caseId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return AdminSafetyCaseProjectionSchema.parse(
      projectAdminSafetyCase(safetyCase, incidents),
    );
  });
}
