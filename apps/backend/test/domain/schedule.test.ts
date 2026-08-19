import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  firstCompletePeriodStart,
  weeklyPeriodWindow,
} from '../../src/modules/scheduling/schedule-math.js';

describe('authoritative weekly schedule math', () => {
  it.each([
    ['UTC', '2026-08-17T00:00:00.000Z', '2026-08-17T00:00:00.000Z'],
    ['UTC', '2026-08-19T12:00:00.000Z', '2026-08-24T00:00:00.000Z'],
    ['Asia/Kolkata', '2026-08-19T12:00:00.000Z', '2026-08-23T18:30:00.000Z'],
    ['Asia/Kathmandu', '2026-08-19T12:00:00.000Z', '2026-08-23T18:15:00.000Z'],
    ['UTC', '2026-12-31T12:00:00.000Z', '2027-01-04T00:00:00.000Z'],
  ])(
    'finds the first complete Monday boundary in %s',
    (zone, activation, expected) => {
      expect(
        firstCompletePeriodStart(new Date(activation), zone).toISOString(),
      ).toBe(expected);
    },
  );

  it('uses local calendar arithmetic through the spring DST transition', () => {
    const start = DateTime.fromISO('2025-03-03T00:00:00', {
      zone: 'America/New_York',
    })
      .toUTC()
      .toJSDate();
    const period = weeklyPeriodWindow(start, 'America/New_York');
    expect(period.periodEndAt.toISOString()).toBe('2025-03-10T04:00:00.000Z');
    expect(
      (period.periodEndAt.getTime() - period.periodStartAt.getTime()) /
        3_600_000,
    ).toBe(167);
  });

  it('uses local calendar arithmetic through the fall DST transition', () => {
    const start = DateTime.fromISO('2025-10-27T00:00:00', {
      zone: 'America/New_York',
    })
      .toUTC()
      .toJSDate();
    const period = weeklyPeriodWindow(start, 'America/New_York');
    expect(period.periodEndAt.toISOString()).toBe('2025-11-03T05:00:00.000Z');
    expect(
      (period.periodEndAt.getTime() - period.periodStartAt.getTime()) /
        3_600_000,
    ).toBe(169);
  });

  it('opens at the exclusive period end and uses an absolute 24-hour due window', () => {
    const period = weeklyPeriodWindow(
      new Date('2026-08-17T00:00:00.000Z'),
      'UTC',
    );
    expect(period.openAt).toEqual(period.periodEndAt);
    expect(period.originalDueAt.toISOString()).toBe('2026-08-25T00:00:00.000Z');
  });
});
