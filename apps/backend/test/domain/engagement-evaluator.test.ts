import { describe, expect, it } from 'vitest';

import { evaluateEngagement } from '../../src/modules/engagement/domain/evaluate-engagement.js';

const DAY = 24 * 60 * 60 * 1_000;
const due = new Date('2026-08-01T12:00:00.000Z');

function evaluateAt(offsetDays: number) {
  return evaluateEngagement({
    now: new Date(due.getTime() + offsetDays * DAY),
    effectiveDueAt: due,
    hasMissedCycle: true,
    safetyPaused: false,
    technicalFailureActive: false,
    optedOut: false,
  });
}

describe('Phase 6 engagement timing', () => {
  it.each([
    [-1, 'ENGAGED', []],
    [0, 'OVERDUE', []],
    [7, 'OVERDUE', [1]],
    [14, 'AT_RISK_OF_DISENGAGEMENT', [1, 2]],
    [30, 'DISENGAGED', [1, 2]],
  ] as const)(
    'uses exact effective-due boundary at +%s days',
    (offset, state, reminders) => {
      const result = evaluateAt(offset);

      expect(result.state).toBe(state);
      expect(result.eligibleReminderNumbers).toEqual(reminders);
    },
  );

  it('never produces a third reminder and does not use last activity as the anchor', () => {
    const result = evaluateEngagement({
      now: new Date('2026-10-01T12:00:00.000Z'),
      effectiveDueAt: new Date('2026-08-01T12:00:00.000Z'),
      hasMissedCycle: true,
      safetyPaused: false,
      technicalFailureActive: false,
      optedOut: false,
    });

    expect(result.state).toBe('DISENGAGED');
    expect(result.eligibleReminderNumbers).toEqual([1, 2]);
  });

  it('suppresses ordinary escalation while safety is paused', () => {
    const result = evaluateEngagement({
      now: new Date(due.getTime() + 45 * DAY),
      effectiveDueAt: due,
      hasMissedCycle: true,
      safetyPaused: true,
      technicalFailureActive: false,
      optedOut: false,
    });

    expect(result).toMatchObject({
      state: 'OVERDUE',
      timingPaused: true,
      pauseReason: 'SAFETY',
      eligibleReminderNumbers: [],
    });
  });

  it('gives opt-out and confirmed technical failure precedence over timing', () => {
    expect(
      evaluateEngagement({
        now: new Date(due.getTime() + 45 * DAY),
        effectiveDueAt: due,
        hasMissedCycle: true,
        safetyPaused: true,
        technicalFailureActive: true,
        optedOut: false,
      }).state,
    ).toBe('TECHNICAL_FAILURE');

    expect(
      evaluateEngagement({
        now: new Date(due.getTime() + 45 * DAY),
        effectiveDueAt: due,
        hasMissedCycle: true,
        safetyPaused: false,
        technicalFailureActive: true,
        optedOut: true,
      }).state,
    ).toBe('OPTED_OUT');
  });
});
