import type { SafetyInput } from '@aud-subjective/contracts';
import { DateTime } from 'luxon';
import type { SafetyContext } from './evaluate-safety.js';

export function recentReduction(
  input: SafetyInput,
  context: SafetyContext,
): boolean {
  if (!input.reductionStartedAt) return false;
  const now = DateTime.fromJSDate(context.now, { zone: context.timezone }).startOf('day');
  const started = DateTime.fromISO(input.reductionStartedAt, { setZone: true })
    .setZone(context.timezone)
    .startOf('day');
  if (!started.isValid || started > now) return false;
  const days = Math.floor(now.diff(started, 'days').days);
  return days >= 0 && days <= 7 && (input.cessation || (input.reductionPercent ?? 0) >= 50);
}

export function plannedMajorReduction(context: SafetyContext) {
  return (
    context.plannedDirection === 'ABSTINENCE' ||
    (context.targetWeeklyDrinks !== undefined &&
      context.baselineAverageWeeklyDrinks !== undefined &&
      context.targetWeeklyDrinks <= context.baselineAverageWeeklyDrinks * 0.5)
  );
}
