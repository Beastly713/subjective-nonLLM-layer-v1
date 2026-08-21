export type OpenClinicalCaseLifecycle =
  'NEW' | 'ACKNOWLEDGED' | 'ACTIVE' | 'CLEARANCE_PENDING';

export function deriveOpenCaseLifecycle(input: {
  activeReasonCount: number;
  clearancePendingReasonCount: number;
  previousLifecycle: OpenClinicalCaseLifecycle;
}) {
  if (input.activeReasonCount > 0) {
    return input.previousLifecycle === 'CLEARANCE_PENDING'
      ? ('ACTIVE' as const)
      : input.previousLifecycle;
  }
  return input.clearancePendingReasonCount > 0
    ? ('CLEARANCE_PENDING' as const)
    : ('RESOLVED' as const);
}

export function materiallyNewReasonFamilies<T extends string>(input: {
  current: readonly T[];
  previouslyKnown: ReadonlySet<T>;
}) {
  return input.current.filter((family) => !input.previouslyKnown.has(family));
}
