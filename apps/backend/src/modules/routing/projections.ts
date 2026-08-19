import {
  RoutingProfileDetailSchema,
  RoutingProfileSummarySchema,
} from '@aud-subjective/contracts';

export function projectRoutingSummary(profile: {
  id: string;
  countryCode: string;
  regionCode: string | null;
  logicalVersion: number;
  rowVersion: number;
  configurationRevision: number;
  lifecycle: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
  effectiveAt: Date | null;
  supersededAt: Date | null;
  createdAt: Date;
}) {
  return RoutingProfileSummarySchema.parse({
    ...profile,
    effectiveAt: profile.effectiveAt?.toISOString() ?? null,
    supersededAt: profile.supersededAt?.toISOString() ?? null,
    createdAt: profile.createdAt.toISOString(),
  });
}

export function projectRoutingDetail(
  profile: Parameters<typeof projectRoutingSummary>[0] & {
    targets: Array<{
      id: string;
      kind:
        | 'EMERGENCY_SERVICE'
        | 'CRISIS_SERVICE'
        | 'URGENT_MEDICAL_SERVICE'
        | 'ON_CALL_CLINICIAN_QUEUE';
      representation:
        'TELEPHONE' | 'DEEP_LINK' | 'INTERNAL_QUEUE' | 'EXTERNAL_SERVICE';
      targetValue: string;
      label: string;
    }>;
    testEvidence: Array<{
      id: string;
      targetKind:
        | 'EMERGENCY_SERVICE'
        | 'CRISIS_SERVICE'
        | 'URGENT_MEDICAL_SERVICE'
        | 'ON_CALL_CLINICIAN_QUEUE';
      configurationRevision: number;
      result: 'PASS' | 'FAIL';
      provenance: string;
      testedAt: Date;
      testedByUserId: string;
    }>;
  },
) {
  return RoutingProfileDetailSchema.parse({
    ...projectRoutingSummary(profile),
    targets: profile.targets,
    testEvidence: profile.testEvidence.map((evidence) => ({
      ...evidence,
      testedAt: evidence.testedAt.toISOString(),
    })),
  });
}

export const routingDetailInclude = {
  targets: { orderBy: { kind: 'asc' as const } },
  testEvidence: { orderBy: { testedAt: 'desc' as const } },
} as const;
