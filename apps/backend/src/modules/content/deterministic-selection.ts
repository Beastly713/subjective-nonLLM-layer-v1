export type ResourceVersionIdentity = {
  resourceId: string;
  version: number;
};

export type RotationCandidate = {
  resourceId: string;
};

export type ResourceExposure = {
  resourceId: string;
  deliveredAt: Date;
};

export const RESOURCE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1_000;

export function latestVersionPerResource<T extends ResourceVersionIdentity>(
  versions: readonly T[],
) {
  const latest = new Map<string, T>();
  for (const version of versions) {
    const previous = latest.get(version.resourceId);
    if (!previous || version.version > previous.version) {
      latest.set(version.resourceId, version);
    }
  }
  return [...latest.values()].sort((left, right) =>
    left.resourceId.localeCompare(right.resourceId),
  );
}

export function selectDeterministicResource<
  T extends RotationCandidate,
>(input: {
  candidates: readonly T[];
  exposures: readonly ResourceExposure[];
  helpfulResourceIds: ReadonlySet<string>;
  now: Date;
  userRequest: boolean;
}) {
  const lastShown = new Map<string, Date>();
  const exposureCount = new Map<string, number>();
  for (const exposure of input.exposures) {
    const previous = lastShown.get(exposure.resourceId);
    if (!previous || exposure.deliveredAt > previous) {
      lastShown.set(exposure.resourceId, exposure.deliveredAt);
    }
    exposureCount.set(
      exposure.resourceId,
      (exposureCount.get(exposure.resourceId) ?? 0) + 1,
    );
  }

  const cooldownBoundary = input.now.getTime() - RESOURCE_COOLDOWN_MS;
  const outsideCooldown = input.candidates.filter((candidate) => {
    const shown = lastShown.get(candidate.resourceId);
    return !shown || shown.getTime() <= cooldownBoundary;
  });
  const pool =
    outsideCooldown.length > 0
      ? [...outsideCooldown]
      : input.userRequest
        ? [...input.candidates]
        : [];

  pool.sort((left, right) => {
    const helpfulDifference =
      Number(input.helpfulResourceIds.has(right.resourceId)) -
      Number(input.helpfulResourceIds.has(left.resourceId));
    if (helpfulDifference !== 0) return helpfulDifference;

    const leftNeverShown = lastShown.has(left.resourceId) ? 0 : 1;
    const rightNeverShown = lastShown.has(right.resourceId) ? 0 : 1;
    if (leftNeverShown !== rightNeverShown) {
      return rightNeverShown - leftNeverShown;
    }

    const leftShown = lastShown.get(left.resourceId)?.getTime() ?? 0;
    const rightShown = lastShown.get(right.resourceId)?.getTime() ?? 0;
    if (leftShown !== rightShown) return leftShown - rightShown;

    const exposureDifference =
      (exposureCount.get(left.resourceId) ?? 0) -
      (exposureCount.get(right.resourceId) ?? 0);
    if (exposureDifference !== 0) return exposureDifference;
    return left.resourceId.localeCompare(right.resourceId);
  });

  const selected = pool[0] ?? null;
  return {
    selected,
    outsideCooldown,
    lastShownAt: selected
      ? (lastShown.get(selected.resourceId)?.toISOString() ?? null)
      : null,
    cooldownOverride:
      outsideCooldown.length === 0 && input.userRequest ? 'USER_REQUEST' : null,
  } as const;
}
