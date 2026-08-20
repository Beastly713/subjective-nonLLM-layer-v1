import { RoutingResolverResultSchema } from '@aud-subjective/contracts';

import type { PrismaClient } from '../../generated/prisma/client.js';

type RoutingPrisma = Pick<PrismaClient, 'regionalRoutingProfileVersion'>;

export const REQUIRED_ROUTING_TARGETS = [
  'EMERGENCY_SERVICE',
  'CRISIS_SERVICE',
  'URGENT_MEDICAL_SERVICE',
  'ON_CALL_CLINICIAN_QUEUE',
] as const;

export function normalizeRegion(country: string, region?: string | null) {
  const countryCode = country.trim().toUpperCase();
  const regionCode = region?.trim().toUpperCase() || null;
  return {
    countryCode,
    regionCode,
    regionKey: `${countryCode}:${regionCode ?? '*'}`,
  };
}

export async function resolveRegionalRoute(
  prisma: RoutingPrisma,
  country: string,
  region: string | null | undefined,
  effectiveAt: Date,
) {
  const { regionKey } = normalizeRegion(country, region);
  const profile = await prisma.regionalRoutingProfileVersion.findFirst({
    where: {
      regionKey,
      effectiveAt: { lte: effectiveAt },
      OR: [{ supersededAt: null }, { supersededAt: { gt: effectiveAt } }],
      lifecycle: { in: ['ACTIVE', 'SUPERSEDED'] },
    },
    orderBy: { logicalVersion: 'desc' },
    include: { targets: { orderBy: { kind: 'asc' } } },
  });
  if (!profile) {
    const future = await prisma.regionalRoutingProfileVersion.findFirst({
      where: { regionKey, lifecycle: 'ACTIVE' },
      select: { id: true },
    });
    return RoutingResolverResultSchema.parse({
      status: 'UNAVAILABLE',
      reason: future ? 'PROFILE_NOT_EFFECTIVE' : 'NO_ACTIVE_PROFILE',
    });
  }
  return RoutingResolverResultSchema.parse({
    status: 'AVAILABLE',
    profileId: profile.id,
    logicalVersion: profile.logicalVersion,
    effectiveAt: profile.effectiveAt!.toISOString(),
    targets: profile.targets.map((target) => ({
      kind: target.kind,
      representation: target.representation,
      targetValue: target.targetValue,
      label: target.label,
    })),
  });
}
