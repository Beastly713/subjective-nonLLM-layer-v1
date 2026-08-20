import type {
  AlcoholDayStatus,
  AlcoholThresholdProfile,
  ReductionBaselineMetrics,
} from '@aud-subjective/contracts';

export const REDUCTION_UNIT_POLICY_VERSION = '1.0';
export const STANDARD_DRINK_GRAMS_ETHANOL = 14;
export const PATIENT_INPUT_DECIMAL_PLACES = 1;
export const DEFAULT_THRESHOLD_PROFILE = 'LOWER_THRESHOLD' as const;
export const DEFAULT_THRESHOLD_PROFILE_SOURCE =
  'PROFILE_UNAVAILABLE_DEFAULT_LOWER';

const DAYS_IN_BASELINE = 28;

export interface CompleteReductionBaselineDay {
  status: AlcoholDayStatus;
  standardDrinks: number;
}

function toTenths(value: number) {
  const tenths = Math.round(value * 10);
  if (!Number.isFinite(value) || Math.abs(value * 10 - tenths) > 1e-9) {
    throw new Error('Standard drinks must use one decimal place.');
  }
  return tenths;
}

function round(value: number, decimalPlaces = 4) {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function heavyDayThresholdTenths(
  thresholdProfile: AlcoholThresholdProfile,
) {
  return thresholdProfile === 'HIGHER_THRESHOLD' ? 50 : 40;
}

export function heavyWeekThreshold(thresholdProfile: AlcoholThresholdProfile) {
  return thresholdProfile === 'HIGHER_THRESHOLD' ? 15 : 8;
}

export function canonicalProlongedHeavyRegularUse(
  baselineAverageWeeklyDrinks: number,
  thresholdProfile: AlcoholThresholdProfile,
  similarHeavyRegularUseAtLeast3Months: 'YES' | 'NO' | 'UNSURE',
) {
  return (
    baselineAverageWeeklyDrinks >= heavyWeekThreshold(thresholdProfile) &&
    similarHeavyRegularUseAtLeast3Months === 'YES'
  );
}

export function calculateReductionBaselineMetrics(
  days: readonly CompleteReductionBaselineDay[],
  thresholdProfile: AlcoholThresholdProfile,
): ReductionBaselineMetrics {
  if (days.length !== DAYS_IN_BASELINE) {
    throw new Error('A reduction baseline must contain exactly 28 days.');
  }

  const quantities = days.map((day) => {
    if (day.status === 'UNKNOWN') {
      throw new Error('Unknown baseline days cannot be confirmed.');
    }
    const tenths = toTenths(day.standardDrinks);
    if (day.status === 'KNOWN_ZERO' && tenths !== 0) {
      throw new Error('Known-zero baseline days must contain zero.');
    }
    if (day.status === 'KNOWN_QUANTITY' && tenths <= 0) {
      throw new Error('Known-quantity baseline days must be positive.');
    }
    return tenths;
  });

  const totalTenths = quantities.reduce((sum, value) => sum + value, 0);
  const drinkingDays = quantities.filter((value) => value > 0).length;
  const heavyDrinkingDays = quantities.filter(
    (value) => value >= heavyDayThresholdTenths(thresholdProfile),
  ).length;
  const maxTenths = Math.max(...quantities);

  return {
    baselineTotalStandardDrinks28d: totalTenths / 10,
    baselineTotalEthanolGrams28d:
      (totalTenths * STANDARD_DRINK_GRAMS_ETHANOL) / 10,
    baselineDrinkingDays28d: drinkingDays,
    baselineHeavyDrinkingDays28d: heavyDrinkingDays,
    baselineMaxStandardDrinksDay: maxTenths / 10,
    baselineAverageDrinksPerDrinkingDay:
      drinkingDays === 0 ? 0 : round(totalTenths / (drinkingDays * 10)),
    baselineAverageWeeklyDrinks: round(totalTenths / 40),
  };
}

export function standardDrinksToEthanolGrams(standardDrinks: number) {
  const tenths = toTenths(standardDrinks);
  return (tenths * STANDARD_DRINK_GRAMS_ETHANOL) / 10;
}
