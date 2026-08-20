import {
  AdminSafetyCaseProjectionSchema,
  PatientSafetyProjectionSchema,
  SafetyCaseProjectionSchema,
  SafetyGateStatusSchema,
  SafetyReasonCodeSchema,
  SafetyRestrictionSnapshotSchema,
  SubjectiveInterventionClassSchema,
  type PatientSafetyProjection,
  type SafetyGateStatus,
  type SubjectiveInterventionClass,
} from '@aud-subjective/contracts';

import type { Prisma } from '../../generated/prisma/client.js';
import { REASON_POLICY } from './domain/reasons.js';

export const safetyCaseInclude = {
  restrictions: { orderBy: { version: 'desc' as const }, take: 1 },
  dispositions: { orderBy: { version: 'desc' as const } },
  lifecycleEvents: { orderBy: { occurredAt: 'asc' as const } },
  evaluation: {
    select: {
      reasonCodes: true,
      evaluatedAt: true,
      evaluatorVersion: true,
      configurationVersion: true,
    },
  },
};

export type SafetyCaseWithProjection = Prisma.SafetyCaseGetPayload<{
  include: typeof safetyCaseInclude;
}>;

export type SafetyProjectionDb = Pick<
  Prisma.TransactionClient,
  'safetyCase' | 'safetyEvaluationResult'
>;

const GATE_RANK: Record<Exclude<SafetyGateStatus, 'NOT_ASSESSED'>, number> = {
  BLOCK_AND_HANDOFF: 0,
  ALLOW_WITH_HANDOFF: 1,
  ALLOW_MONITORING: 2,
};

function effectiveCaseGate(
  value: string,
): Exclude<SafetyGateStatus, 'NOT_ASSESSED'> {
  const parsed = SafetyGateStatusSchema.safeParse(value);
  if (!parsed.success || parsed.data === 'NOT_ASSESSED') {
    return 'BLOCK_AND_HANDOFF';
  }
  return parsed.data;
}

export function canonicalStoredInterventions(
  value: Prisma.JsonValue,
): SubjectiveInterventionClass[] {
  if (!Array.isArray(value)) return [];
  const result: SubjectiveInterventionClass[] = [];
  for (const entry of value) {
    const parsed = SubjectiveInterventionClassSchema.safeParse(entry);
    if (parsed.success && !result.includes(parsed.data))
      result.push(parsed.data);
  }
  return result;
}

function projectedRestriction(
  item: SafetyCaseWithProjection['restrictions'][number],
) {
  const gateStatus = effectiveCaseGate(item.gateStatus);
  return {
    id: item.id,
    version: item.version,
    gateStatus,
    allowedSubjectiveInterventions: canonicalStoredInterventions(
      item.allowedSubjectiveInterventions,
    ),
    monitoringPromptPolicy:
      item.monitoringPromptPolicy === 'CONTINUE' ? 'CONTINUE' : 'PAUSE',
    goalChangeAllowed: item.goalChangeAllowed,
    reassessmentDueAt: item.reassessmentDueAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    sourceDispositionId: item.sourceDispositionId,
  } as const;
}

function effectiveRestriction(item: SafetyCaseWithProjection) {
  const latest = item.restrictions[0];
  if (latest) return projectedRestriction(latest);

  const gateStatus = effectiveCaseGate(item.gateStatus);
  return {
    id: null,
    version: 0,
    gateStatus,
    allowedSubjectiveInterventions: [] as SubjectiveInterventionClass[],
    monitoringPromptPolicy:
      gateStatus === 'BLOCK_AND_HANDOFF'
        ? ('PAUSE' as const)
        : ('CONTINUE' as const),
    goalChangeAllowed: gateStatus === 'ALLOW_MONITORING',
    reassessmentDueAt: null,
    createdAt: null,
    sourceDispositionId: null,
  };
}

function reasonCodesForCase(item: SafetyCaseWithProjection) {
  if (!Array.isArray(item.evaluation.reasonCodes)) return [];
  return item.evaluation.reasonCodes.flatMap((entry) => {
    const parsed = SafetyReasonCodeSchema.safeParse(entry);
    if (!parsed.success) return [];
    return REASON_POLICY[parsed.data].domain === item.domain
      ? [parsed.data]
      : [];
  });
}

function responseTarget(severity: string) {
  return {
    maximumSystemResponseSeconds: severity === 'S0_EMERGENCY' ? 60 : null,
    acknowledgementMinutes: severity === 'S1_URGENT' ? 15 : null,
    dispositionMinutes: severity === 'S1_URGENT' ? 60 : null,
    acknowledgementHours: severity === 'S2_PRIORITY' ? 4 : null,
    dispositionBusinessDays: severity === 'S2_PRIORITY' ? 1 : null,
    reviewBusinessDays: severity === 'S3_ROUTINE' ? 2 : null,
  };
}

function dispositionProjection(
  item: SafetyCaseWithProjection['dispositions'][number],
) {
  const parsedRestrictions = SafetyRestrictionSnapshotSchema.safeParse(
    item.restrictions,
  );
  return {
    id: item.id,
    version: item.version,
    disposition: item.disposition,
    restrictions: parsedRestrictions.success ? parsedRestrictions.data : null,
    actorRole: item.actorRole,
    reason: item.reason,
    sourceCaseVersion: item.sourceCaseVersion,
    createdAt: item.createdAt.toISOString(),
  };
}

function lifecycleProjection(
  item: SafetyCaseWithProjection['lifecycleEvents'][number],
) {
  return {
    id: item.id,
    fromState: item.fromState,
    toState: item.toState,
    reason: item.reason,
    occurredAt: item.occurredAt.toISOString(),
  };
}

function targetToPatientAction(
  target: unknown,
  priority: 'PRIMARY' | 'FALLBACK',
) {
  if (!target || typeof target !== 'object') return null;
  const record = target as Record<string, unknown>;
  if (typeof record.label !== 'string' || record.label.length === 0)
    return null;
  if (typeof record.representation !== 'string') return null;

  if (
    record.representation === 'TELEPHONE' &&
    typeof record.targetValue === 'string'
  ) {
    return {
      label: record.label,
      actionType: 'CALL' as const,
      href: `tel:${record.targetValue}`,
      priority,
    };
  }
  if (
    record.representation === 'DEEP_LINK' &&
    typeof record.targetValue === 'string'
  ) {
    return {
      label: record.label,
      actionType: 'OPEN_LINK' as const,
      href: record.targetValue,
      priority,
    };
  }
  if (
    record.representation === 'INTERNAL_QUEUE' ||
    record.representation === 'EXTERNAL_SERVICE'
  ) {
    return {
      label: record.label,
      actionType: 'STATUS' as const,
      href: null,
      priority,
    };
  }
  return null;
}

function actionsFromSnapshot(snapshot: Prisma.JsonValue | null) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return [];
  }
  const record = snapshot as Record<string, unknown>;
  if (record.status !== 'AVAILABLE') return [];
  return [
    targetToPatientAction(record.primary, 'PRIMARY'),
    targetToPatientAction(record.fallback, 'FALLBACK'),
  ].filter((value): value is NonNullable<typeof value> => value !== null);
}

function patientHandoffStatus(cases: SafetyCaseWithProjection[]) {
  if (cases.some((item) => item.lifecycle === 'ESCALATED_TO_EMERGENCY')) {
    return 'EMERGENCY_HANDOFF' as const;
  }
  if (cases.some((item) => item.lifecycle === 'PLAN_ESTABLISHED')) {
    return 'PLAN_ESTABLISHED' as const;
  }
  if (cases.some((item) => item.lifecycle === 'CLINICAL_REVIEW_IN_PROGRESS')) {
    return 'REVIEW_IN_PROGRESS' as const;
  }
  if (cases.some((item) => item.lifecycle === 'ACKNOWLEDGED')) {
    return 'ACKNOWLEDGED' as const;
  }
  if (cases.length > 0) return 'PENDING' as const;
  return 'NONE' as const;
}

export function projectPatientSafety(
  cases: SafetyCaseWithProjection[],
  options: { hasCompletedEvaluation: boolean },
): PatientSafetyProjection {
  const caseGates = cases.map((item) => effectiveCaseGate(item.gateStatus));
  const blocked = caseGates.includes('BLOCK_AND_HANDOFF');
  const restricted = caseGates.includes('ALLOW_WITH_HANDOFF');
  const controllingGate = blocked
    ? ('BLOCK_AND_HANDOFF' as const)
    : restricted
      ? ('ALLOW_WITH_HANDOFF' as const)
      : null;

  const restrictions = cases.map(effectiveRestriction);
  const allowedSubjectiveInterventions = restrictions.length
    ? restrictions
        .slice(1)
        .reduce<SubjectiveInterventionClass[]>(
          (allowed, item) =>
            allowed.filter((entry) =>
              item.allowedSubjectiveInterventions.includes(entry),
            ),
          [...restrictions[0]!.allowedSubjectiveInterventions],
        )
    : [];

  const reassessmentDueAt =
    restrictions
      .map((item) => item.reassessmentDueAt)
      .filter((value): value is string => value !== null)
      .sort()[0] ?? null;

  const controllingCases = controllingGate
    ? cases.filter(
        (item) => effectiveCaseGate(item.gateStatus) === controllingGate,
      )
    : [];

  const patientRouteActions = controllingCases
    .flatMap((item) => actionsFromSnapshot(item.currentRouteSnapshot))
    .filter(
      (action, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.label === action.label &&
            candidate.actionType === action.actionType &&
            candidate.href === action.href,
        ) === index,
    );

  const routeStatuses = controllingCases.map((item) => item.routeStatus);
  const routeAvailability =
    routeStatuses.length === 0
      ? ('NOT_REQUIRED' as const)
      : routeStatuses.includes('AVAILABLE') &&
          routeStatuses.includes('UNAVAILABLE')
        ? ('PARTIAL' as const)
        : routeStatuses.includes('AVAILABLE')
          ? ('AVAILABLE' as const)
          : routeStatuses.includes('UNAVAILABLE')
            ? ('UNAVAILABLE' as const)
            : ('NOT_REQUIRED' as const);

  const safetyState = blocked
    ? ('HANDOFF_REQUIRED' as const)
    : restricted
      ? ('REVIEW_REQUIRED' as const)
      : cases.length > 0
        ? ('ROUTINE_CONTEXT' as const)
        : options.hasCompletedEvaluation
          ? ('MONITORING_AVAILABLE' as const)
          : ('NOT_ASSESSED' as const);

  return PatientSafetyProjectionSchema.parse({
    safetyState,
    requiresSafetyShell: blocked,
    handoffStatus:
      blocked || restricted ? patientHandoffStatus(controllingCases) : 'NONE',
    allowedSubjectiveInterventions,
    monitoringPromptPolicy: restrictions.some(
      (item) => item.monitoringPromptPolicy === 'PAUSE',
    )
      ? 'PAUSE'
      : 'CONTINUE',
    goalChangeAllowed:
      restrictions.length === 0
        ? true
        : restrictions.every((item) => item.goalChangeAllowed),
    reassessmentDueAt,
    routeAvailability,
    patientRouteActions,
  });
}

export async function loadPatientSafetyProjection(
  db: SafetyProjectionDb,
  patientId: string,
) {
  const cases = await db.safetyCase.findMany({
    where: { patientId, resolvedAt: null },
    include: safetyCaseInclude,
    orderBy: [{ detectedAt: 'asc' }, { id: 'asc' }],
  });
  const latestEvaluation = await db.safetyEvaluationResult.findFirst({
    where: { patientId },
    select: { id: true },
    orderBy: [{ evaluatedAt: 'desc' }, { id: 'desc' }],
  });
  return projectPatientSafety(cases, {
    hasCompletedEvaluation: Boolean(latestEvaluation),
  });
}

export function projectSafetyCase(item: SafetyCaseWithProjection) {
  const currentRestriction = item.restrictions[0]
    ? projectedRestriction(item.restrictions[0])
    : null;

  return SafetyCaseProjectionSchema.parse({
    id: item.id,
    patientId: item.patientId,
    severity: item.severity,
    domain: item.domain,
    ownerRole: item.ownerRole,
    reasonCodes: reasonCodesForCase(item),
    lifecycle: item.lifecycle,
    version: item.version,
    gateStatus: effectiveCaseGate(item.gateStatus),
    routeStatus: item.routeStatus,
    routeProfileId: item.routeProfileId,
    routeProfileLogicalVersion: item.routeProfileLogicalVersion,
    currentRouteSnapshot: item.currentRouteSnapshot,
    currentRestriction,
    responseTarget: responseTarget(item.severity),
    dispositions: item.dispositions.map(dispositionProjection),
    lifecycleEvents: item.lifecycleEvents.map(lifecycleProjection),
    detectedAt: item.detectedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
  });
}

export function projectAdminSafetyCase(
  item: SafetyCaseWithProjection,
  incidents: Array<{
    id: string;
    incidentType: string;
    code: string;
    status: string;
    summary: string;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
  }>,
) {
  return AdminSafetyCaseProjectionSchema.parse({
    ...projectSafetyCase(item),
    operationalIncidents: incidents.map((incident) => ({
      id: incident.id,
      incidentType: incident.incidentType,
      code: incident.code,
      status: incident.status,
      summary: incident.summary,
      metadata: incident.metadata,
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString(),
      resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    })),
  });
}

export function compareGateRestriction(
  left: Exclude<SafetyGateStatus, 'NOT_ASSESSED'>,
  right: Exclude<SafetyGateStatus, 'NOT_ASSESSED'>,
) {
  return GATE_RANK[left] - GATE_RANK[right];
}
