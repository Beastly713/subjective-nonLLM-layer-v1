import { describe, expect, it } from 'vitest';

import { finalizeReductionWeek } from '../../src/modules/monitoring/service.js';
import type {
  HistoricalWeeklyObservation,
  ReductionWeeklySummaryInput,
} from '../../src/modules/monitoring/types.js';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const BASE = new Date('2026-07-06T00:00:00.000Z');

const dates = [
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
] as const;

function day(
  localDate: string,
  status: 'KNOWN_ZERO' | 'KNOWN_QUANTITY' | 'UNKNOWN',
  standardDrinks?: number,
) {
  return {
    localDate,
    status,
    ...(standardDrinks === undefined ? {} : { standardDrinks }),
  };
}

function completeDays(quantity = 1) {
  return dates.map((localDate) => day(localDate, 'KNOWN_QUANTITY', quantity));
}

function run(
  overrides: Partial<Parameters<typeof finalizeReductionWeek>[0]> = {},
) {
  return finalizeReductionWeek({
    dates,
    periodStartAt: new Date('2026-07-27T00:00:00.000Z'),
    draftDays: completeDays(1),
    targetWeeklyStandardDrinks: 7,
    baselineAverageWeeklyDrinks: 14,
    thresholdProfile: 'LOWER_THRESHOLD',
    history: [],
    ...overrides,
  });
}

function summaryDays(
  startDate: Date,
  quantities: number[],
): ReductionWeeklySummaryInput['days'] {
  return quantities.map((quantity, index) => {
    const date = new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000);
    return {
      localDate: date.toISOString().slice(0, 10),
      status: quantity === 0 ? 'KNOWN_ZERO' : 'KNOWN_QUANTITY',
      standardDrinks: quantity,
      ethanolGrams: quantity * 14,
    };
  });
}

function historyWeek(
  index: number,
  quantities: number[],
): HistoricalWeeklyObservation {
  const periodStartAt = new Date(BASE.getTime() + index * WEEK);
  const periodEndAt = new Date(periodStartAt.getTime() + WEEK);
  const total = quantities.reduce((sum, value) => sum + value, 0);

  return {
    periodId: `p-${index}`,
    periodStartAt,
    periodEndAt,
    authoritative: true,
    completionStatus: 'COMPLETE',
    goal: 'REDUCTION',
    goalVersionId: 'goal',
    preferenceVersionId: 'pref',
    preferences: {
      mutualHelpPreference: 'UNSURE',
      spiritualContentPreference: 'UNSURE',
    },
    answers: { U1: total > 0 },
    useStatus: total > 0 ? 'POSITIVE' : 'NEGATIVE',
    riskScore: null,
    rawProtectionScore: null,
    recoveryProgress: null,
    consumption: {
      observedDayCount: 7,
      unknownDayCount: 0,
      coverageRatio: 1,
      knownStandardDrinksTotal: total,
      completeWeekTotalStandardDrinks: total,
      completeWeekEthanolGrams: total * 14,
      drinkingDays: quantities.filter((value) => value > 0).length,
      alcoholFreeDays: quantities.filter((value) => value === 0).length,
      averageDrinksPerDrinkingDay: null,
      maximumDailyStandardDrinks: Math.max(...quantities),
      heavyDrinkingDays: 0,
      targetWeeklyStandardDrinks: 7,
      targetStatus: total <= 7 ? 'MET' : 'NOT_MET',
      baselineAverageWeeklyDrinks: 14,
      reductionFromBaselinePercent: null,
      whoWindowComplete: false,
      whoRiskRank: null,
      whoRiskRankChange: null,
      whoTwoLevelReduction: null,
      days: summaryDays(periodStartAt, quantities),
    },
  };
}

describe('weekly reduction finalization', () => {
  it('materializes exactly the backend-provided seven dates and fills omitted dates as UNKNOWN', () => {
    const result = run({
      draftDays: [
        day('2026-07-27', 'KNOWN_ZERO', 0),
        day('2026-07-29', 'KNOWN_QUANTITY', 1.5),
      ],
    });

    expect(result.days).toHaveLength(7);
    expect(result.days.map((item) => item.localDate)).toEqual([...dates]);
    expect(result.days[0]).toMatchObject({
      status: 'KNOWN_ZERO',
      standardDrinks: 0,
      ethanolGrams: 0,
    });
    expect(result.days[1]).toMatchObject({
      status: 'UNKNOWN',
      standardDrinks: null,
      ethanolGrams: null,
    });
    expect(result.days[2]).toMatchObject({
      status: 'KNOWN_QUANTITY',
      standardDrinks: 1.5,
      ethanolGrams: 21,
    });
  });

  it('claims a complete weekly total only when all seven days are observed', () => {
    const complete = run();
    expect(complete.summary.observedDayCount).toBe(7);
    expect(complete.summary.unknownDayCount).toBe(0);
    expect(complete.summary.coverageRatio).toBe(1);
    expect(complete.summary.completeWeekTotalStandardDrinks).toBe(7);
    expect(complete.summary.completeWeekEthanolGrams).toBe(98);

    const partial = run({
      draftDays: dates
        .slice(0, 6)
        .map((localDate) => day(localDate, 'KNOWN_QUANTITY', 1)),
    });
    expect(partial.summary.observedDayCount).toBe(6);
    expect(partial.summary.unknownDayCount).toBe(1);
    expect(partial.summary.completeWeekTotalStandardDrinks).toBeNull();
    expect(partial.summary.completeWeekEthanolGrams).toBeNull();
    expect(partial.summary.alcoholFreeDays).toBeNull();
  });

  it('uses complete and partial target semantics exactly', () => {
    expect(run().summary.targetStatus).toBe('MET');

    expect(
      run({
        draftDays: completeDays(2),
        targetWeeklyStandardDrinks: 7,
      }).summary.targetStatus,
    ).toBe('NOT_MET');

    expect(
      run({
        draftDays: dates
          .slice(0, 4)
          .map((localDate) => day(localDate, 'KNOWN_QUANTITY', 2)),
        targetWeeklyStandardDrinks: 7,
      }).summary.targetStatus,
    ).toBe('NOT_MET');

    expect(
      run({
        draftDays: dates
          .slice(0, 4)
          .map((localDate) => day(localDate, 'KNOWN_QUANTITY', 1)),
        targetWeeklyStandardDrinks: 7,
      }).summary.targetStatus,
    ).toBe('UNRESOLVED');
  });

  it('computes reduction-from-baseline only for a complete week and preserves negative change', () => {
    expect(
      run({
        draftDays: completeDays(1),
        baselineAverageWeeklyDrinks: 14,
      }).summary.reductionFromBaselinePercent,
    ).toBe(50);

    expect(
      run({
        draftDays: completeDays(3),
        baselineAverageWeeklyDrinks: 14,
      }).summary.reductionFromBaselinePercent,
    ).toBe(-50);

    expect(
      run({
        draftDays: dates
          .slice(0, 6)
          .map((localDate) => day(localDate, 'KNOWN_QUANTITY', 1)),
        baselineAverageWeeklyDrinks: 14,
      }).summary.reductionFromBaselinePercent,
    ).toBeNull();
  });

  it('distinguishes zero, quantity, and unknown days in summary statistics', () => {
    const result = run({
      draftDays: [
        day(dates[0], 'KNOWN_ZERO', 0),
        day(dates[1], 'KNOWN_QUANTITY', 2),
        day(dates[2], 'UNKNOWN'),
        day(dates[3], 'KNOWN_ZERO', 0),
        day(dates[4], 'KNOWN_QUANTITY', 1),
        day(dates[5], 'UNKNOWN'),
        day(dates[6], 'KNOWN_ZERO', 0),
      ],
    });

    expect(result.summary.observedDayCount).toBe(5);
    expect(result.summary.unknownDayCount).toBe(2);
    expect(result.summary.knownStandardDrinksTotal).toBe(3);
    expect(result.summary.drinkingDays).toBe(2);
    expect(result.summary.alcoholFreeDays).toBeNull();
  });

  it('rejects quantities that violate the locked one-decimal input policy', () => {
    expect(() =>
      run({
        draftDays: [
          day(dates[0], 'KNOWN_QUANTITY', 1.25),
          ...dates.slice(1).map((localDate) => day(localDate, 'KNOWN_ZERO', 0)),
        ],
      }),
    ).toThrow(/one decimal place/i);
  });

  it('uses the locked heavy-day threshold profile', () => {
    const lower = run({
      draftDays: [
        day(dates[0], 'KNOWN_QUANTITY', 4),
        ...dates.slice(1).map((localDate) => day(localDate, 'KNOWN_ZERO', 0)),
      ],
      thresholdProfile: 'LOWER_THRESHOLD',
    });

    const higher = run({
      draftDays: [
        day(dates[0], 'KNOWN_QUANTITY', 4),
        ...dates.slice(1).map((localDate) => day(localDate, 'KNOWN_ZERO', 0)),
      ],
      thresholdProfile: 'HIGHER_THRESHOLD',
    });

    expect(lower.summary.heavyDrinkingDays).toBe(1);
    expect(higher.summary.heavyDrinkingDays).toBe(0);
  });

  it('keeps WHO context unavailable without three adjacent complete prior weeks', () => {
    expect(run().summary.whoWindowComplete).toBe(false);

    const history = [
      historyWeek(0, Array(7).fill(1)),
      historyWeek(1, Array(7).fill(1)),
      historyWeek(2, Array(7).fill(1)),
    ];

    const complete = finalizeReductionWeek({
      dates,
      periodStartAt: new Date(BASE.getTime() + 3 * WEEK),
      draftDays: completeDays(1),
      targetWeeklyStandardDrinks: 7,
      baselineAverageWeeklyDrinks: 14,
      thresholdProfile: 'LOWER_THRESHOLD',
      baselineDays: Array.from({ length: 28 }, (_, index) => ({
        localDate: new Date(BASE.getTime() + index * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        status: 'KNOWN_QUANTITY' as const,
        standardDrinks: 2,
        ethanolGrams: 28,
      })),
      history,
    });

    expect(complete.summary.whoWindowComplete).toBe(true);
    expect(complete.summary.whoRiskRank).not.toBeNull();

    const withUnknown = structuredClone(history);
    withUnknown[1]!.consumption!.days![2] = {
      ...withUnknown[1]!.consumption!.days![2]!,
      status: 'UNKNOWN',
      standardDrinks: null,
      ethanolGrams: null,
    };

    const incomplete = finalizeReductionWeek({
      dates,
      periodStartAt: new Date(BASE.getTime() + 3 * WEEK),
      draftDays: completeDays(1),
      targetWeeklyStandardDrinks: 7,
      baselineAverageWeeklyDrinks: 14,
      thresholdProfile: 'LOWER_THRESHOLD',
      history: withUnknown,
    });

    expect(incomplete.summary.whoWindowComplete).toBe(false);
    expect(incomplete.summary.whoRiskRank).toBeNull();
  });
});
