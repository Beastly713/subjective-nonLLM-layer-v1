import type { Prisma } from '../../generated/prisma/client.js';

export const safetyCaseInclude = {
  restrictions: { orderBy: { version: 'desc' as const }, take: 1 },
  dispositions: { orderBy: { version: 'desc' as const } },
  lifecycleEvents: { orderBy: { occurredAt: 'asc' as const } },
};

export type SafetyCaseWithProjection = Prisma.SafetyCaseGetPayload<{
  include: typeof safetyCaseInclude;
}>;

export function projectPatientSafety(cases: SafetyCaseWithProjection[]) {
  const blocked = cases.some((item) => item.gateStatus === 'BLOCK_AND_HANDOFF');
  const restricted = cases.some((item) => item.gateStatus === 'ALLOW_WITH_HANDOFF');
  const restrictions = cases.flatMap((item) => item.restrictions);
  const firstRestriction = restrictions[0];
  return {
    safetyState: blocked
      ? 'HANDOFF_REQUIRED'
      : restricted
        ? 'REVIEW_REQUIRED'
        : cases.length
          ? 'ROUTINE_CONTEXT'
          : 'NOT_ASSESSED',
    requiresSafetyShell: blocked,
    handoffStatus: blocked || restricted ? 'PENDING' : 'NONE',
    allowedSubjectiveInterventions: firstRestriction
      ? restrictions
          .slice(1)
          .reduce<string[]>(
            (allowed, item) =>
              allowed.filter((entry) =>
                (item.allowedSubjectiveInterventions as string[]).includes(entry),
              ),
            firstRestriction.allowedSubjectiveInterventions as string[],
          )
      : [],
    monitoringPromptPolicy: restrictions.some(
      (item) => item.monitoringPromptPolicy === 'PAUSE',
    )
      ? 'PAUSE'
      : 'CONTINUE',
    goalChangeAllowed:
      restrictions.length > 0
        ? restrictions.every((item) => item.goalChangeAllowed)
        : true,
    reassessmentDueAt:
      restrictions
        .map((item) => item.reassessmentDueAt)
        .filter((item): item is Date => item !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
    patientRouteActions: cases
      .map((item) => item.currentRouteSnapshot)
      .filter(Boolean),
  };
}

export function projectSafetyCase(item: SafetyCaseWithProjection) {
  return {
    id: item.id,
    patientId: item.patientId,
    severity: item.severity,
    domain: item.domain,
    ownerRole: item.ownerRole,
    lifecycle: item.lifecycle,
    version: item.version,
    gateStatus: item.gateStatus,
    routeStatus: item.routeStatus,
    routeProfileId: item.routeProfileId,
    routeProfileLogicalVersion: item.routeProfileLogicalVersion,
    currentRouteSnapshot: item.currentRouteSnapshot,
    currentRestriction: item.restrictions[0] ?? null,
    dispositions: item.dispositions,
    lifecycleEvents: item.lifecycleEvents,
    detectedAt: item.detectedAt,
    updatedAt: item.updatedAt,
    resolvedAt: item.resolvedAt,
  };
}
