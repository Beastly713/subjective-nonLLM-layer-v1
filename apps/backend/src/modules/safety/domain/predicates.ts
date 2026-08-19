import type { SafetyInput } from '@aud-subjective/contracts';
import type { SafetyContext } from './evaluate-safety.js';

export function recentReduction(
  input: SafetyInput,
  context: SafetyContext,
): boolean {
  if (!input.reductionStartedAt) return false;
  const date = new Date(input.reductionStartedAt);
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: context.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  const days =
    (Date.parse(fmt(context.now)) - Date.parse(fmt(date))) / 86_400_000;
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
