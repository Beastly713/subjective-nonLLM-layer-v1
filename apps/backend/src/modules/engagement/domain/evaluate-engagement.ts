import type { EngagementState } from '@aud-subjective/contracts';

import { SUBJECTIVE_MONITORING_V1 } from '../../../policy/subjective-monitoring-v1.js';

const DAY_MS = 24 * 60 * 60 * 1_000;

export type EngagementEvaluation = {
  state: EngagementState;
  timingPaused: boolean;
  pauseReason: 'SAFETY' | 'TECHNICAL' | null;
  overdueDays: number;
  eligibleReminderNumbers: Array<1 | 2>;
};

export function evaluateEngagement(input: {
  now: Date;
  effectiveDueAt: Date | null;
  hasMissedCycle: boolean;
  safetyPaused: boolean;
  technicalFailureActive: boolean;
  optedOut: boolean;
}): EngagementEvaluation {
  if (input.optedOut) {
    return {
      state: 'OPTED_OUT',
      timingPaused: false,
      pauseReason: null,
      overdueDays: 0,
      eligibleReminderNumbers: [],
    };
  }

  if (input.technicalFailureActive) {
    return {
      state: 'TECHNICAL_FAILURE',
      timingPaused: true,
      pauseReason: 'TECHNICAL',
      overdueDays: 0,
      eligibleReminderNumbers: [],
    };
  }

  if (input.safetyPaused) {
    return {
      state: input.hasMissedCycle ? 'OVERDUE' : 'ENGAGED',
      timingPaused: true,
      pauseReason: 'SAFETY',
      overdueDays: 0,
      eligibleReminderNumbers: [],
    };
  }

  if (!input.hasMissedCycle || !input.effectiveDueAt) {
    return {
      state: 'ENGAGED',
      timingPaused: false,
      pauseReason: null,
      overdueDays: 0,
      eligibleReminderNumbers: [],
    };
  }

  const elapsedMs = input.now.getTime() - input.effectiveDueAt.getTime();
  if (elapsedMs < 0) {
    return {
      state: 'ENGAGED',
      timingPaused: false,
      pauseReason: null,
      overdueDays: 0,
      eligibleReminderNumbers: [],
    };
  }

  const elapsedDays = elapsedMs / DAY_MS;
  const policy = SUBJECTIVE_MONITORING_V1.engagement;
  const eligibleReminderNumbers: Array<1 | 2> = [];
  if (elapsedDays >= policy.firstReminderDaysAfterEffectiveDue) {
    eligibleReminderNumbers.push(1);
  }
  if (
    elapsedDays >= policy.secondFinalReminderDaysAfterEffectiveDue &&
    policy.maxAutomatedRemindersPerCycle >= 2
  ) {
    eligibleReminderNumbers.push(2);
  }

  const state: EngagementState =
    elapsedDays >= policy.disengagementCaseDaysAfterEffectiveDue
      ? 'DISENGAGED'
      : elapsedDays >= policy.level2DaysAfterEffectiveDue
        ? 'AT_RISK_OF_DISENGAGEMENT'
        : 'OVERDUE';

  return {
    state,
    timingPaused: false,
    pauseReason: null,
    overdueDays: Math.max(0, Math.floor(elapsedDays)),
    eligibleReminderNumbers,
  };
}
