import { describe, expect, it } from 'vitest';

import {
  canonicalProlongedHeavyRegularUse,
  heavyWeekThreshold,
} from '../../src/modules/consumption/reduction-domain.js';

describe('reduction heavy-use predicates', () => {
  it('uses the locked weekly heavy thresholds', () => {
    expect(heavyWeekThreshold('LOWER_THRESHOLD')).toBe(8);
    expect(heavyWeekThreshold('HIGHER_THRESHOLD')).toBe(15);
  });

  it.each([
    ['LOWER_THRESHOLD', 8],
    ['HIGHER_THRESHOLD', 15],
  ] as const)(
    'marks %s as canonical prolonged-heavy use at its exact threshold when the three-month history is YES',
    (thresholdProfile, baselineAverageWeeklyDrinks) => {
      expect(
        canonicalProlongedHeavyRegularUse(
          baselineAverageWeeklyDrinks,
          thresholdProfile,
          'YES',
        ),
      ).toBe(true);
    },
  );

  it.each([
    ['LOWER_THRESHOLD', 7.9999],
    ['HIGHER_THRESHOLD', 14.9999],
  ] as const)(
    'does not mark %s as canonical prolonged-heavy use below its weekly threshold',
    (thresholdProfile, baselineAverageWeeklyDrinks) => {
      expect(
        canonicalProlongedHeavyRegularUse(
          baselineAverageWeeklyDrinks,
          thresholdProfile,
          'YES',
        ),
      ).toBe(false);
    },
  );

  it.each(['NO', 'UNSURE'] as const)(
    'requires an explicit YES for the similar three-month heavy-use history, not %s',
    (history) => {
      expect(
        canonicalProlongedHeavyRegularUse(20, 'LOWER_THRESHOLD', history),
      ).toBe(false);
    },
  );
});
