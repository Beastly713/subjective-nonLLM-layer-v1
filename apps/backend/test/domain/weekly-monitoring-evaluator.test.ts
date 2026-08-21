import { describe, expect, it } from 'vitest';

import { evaluateWeeklyAssessment } from '../../src/modules/monitoring/domain/evaluate-weekly-assessment.js';
import type {
  EvaluateWeeklyAssessmentInput,
  HistoricalWeeklyObservation,
  ReasonLifecycleSnapshot,
  WeeklyAnswers,
} from '../../src/modules/monitoring/types.js';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const BASE = new Date('2026-07-06T00:00:00.000Z');

const safe = {
  safetyState: 'MONITORING_AVAILABLE',
  requiresSafetyShell: false,
  monitoringPromptPolicy: 'CONTINUE',
  allowedSubjectiveInterventions: [
    'CRAVING_COPING_SUPPORT',
    'SELF_EFFICACY_SUPPORT',
    'MOOD_COPING_SUPPORT',
    'TRIGGER_MANAGEMENT_SUPPORT',
    'RELATIONSHIP_COPING_SUPPORT',
    'SOCIAL_SUPPORT_ACTIVATION',
    'USE_EVENT_RECOVERY_SUPPORT',
    'RECURRENT_USE_RECOVERY_SUPPORT',
    'RECOVERY_PLAN_REVIEW',
    'POSITIVE_REINFORCEMENT',
  ],
  reassessmentDueAt: null,
} as const;

const neutralPreferences = {
  mutualHelpPreference: 'AA_12_STEP',
  spiritualContentPreference: 'ALLOW',
} as const;

function atWeek(index: number) {
  return new Date(BASE.getTime() + index * WEEK);
}

function historical(
  index: number,
  answers: WeeklyAnswers | null,
  options: Partial<HistoricalWeeklyObservation> = {},
): HistoricalWeeklyObservation {
  const useStatus =
    answers?.U1 === true
      ? 'POSITIVE'
      : answers?.U1 === false
        ? 'NEGATIVE'
        : 'UNKNOWN';

  return {
    periodId: `period-${index}`,
    periodStartAt: atWeek(index),
    periodEndAt: atWeek(index + 1),
    authoritative: answers !== null,
    completionStatus: answers === null ? null : 'COMPLETE',
    goal: 'ABSTINENCE',
    goalVersionId: 'goal-1',
    preferenceVersionId: 'pref-1',
    preferences: neutralPreferences,
    answers,
    useStatus,
    riskScore: null,
    rawProtectionScore: null,
    recoveryProgress: null,
    consumption: null,
    ...options,
  };
}

function current(
  answers: WeeklyAnswers,
  overrides: Partial<EvaluateWeeklyAssessmentInput> = {},
): EvaluateWeeklyAssessmentInput {
  const periodIndex = overrides.history?.length ?? 0;

  return {
    patientId: 'patient-1',
    assessmentId: 'assessment-1',
    revisionId: 'revision-1',
    periodId: `period-${periodIndex}`,
    periodStartAt: atWeek(periodIndex),
    periodEndAt: atWeek(periodIndex + 1),
    evaluatedAt: atWeek(periodIndex + 1),
    trigger: 'CURRENT_PATIENT_SUBMISSION',
    completionStatus: 'COMPLETE',
    goalVersionId: 'goal-1',
    preferenceVersionId: 'pref-1',
    effectScope: 'CURRENT',
    goal: 'ABSTINENCE',
    targetWeeklyStandardDrinks: null,
    baselineAverageWeeklyDrinks: null,
    preferences: neutralPreferences,
    answers,
    history: [],
    consumption: null,
    safety: safe,
    ...overrides,
  };
}

function completeAnswers(overrides: WeeklyAnswers = {}): WeeklyAnswers {
  return {
    U1: false,
    R1: 1,
    R2: 1,
    R3: 1,
    R4: 1,
    R5: 1,
    P1: 6,
    P2: 6,
    P3: 6,
    P4: 6,
    P5: 6,
    ...overrides,
  };
}

function flag(
  result: ReturnType<typeof evaluateWeeklyAssessment>,
  key: string,
) {
  return result.flags.find((item) => item.flagKey === key);
}

function reasonState(
  result: ReturnType<typeof evaluateWeeklyAssessment>,
  key: string,
) {
  return result.longitudinal.clearanceReasonStateSnapshot[key];
}

describe('subjective_monitoring_v1 current flags and missingness', () => {
  it('uses the exact locked flag boundaries', () => {
    const result = evaluateWeeklyAssessment(
      current(
        completeAnswers({
          U1: true,
          R2: 6,
          R3: 6,
          R4: 6,
          R5: 6,
          P1: 2,
          P5: 2,
        }),
      ),
    );

    expect(flag(result, 'HIGH_CRAVING')?.state).toBe('ACTIVE');
    expect(flag(result, 'HIGH_NEGATIVE_MOOD')?.state).toBe('ACTIVE');
    expect(flag(result, 'HIGH_RISKY_SITUATIONS')?.state).toBe('ACTIVE');
    expect(flag(result, 'HIGH_RELATIONSHIP_PROBLEMS')?.state).toBe('ACTIVE');
    expect(flag(result, 'LOW_CONFIDENCE')?.state).toBe('ACTIVE');
    expect(flag(result, 'LOW_SOCIAL_SUPPORT')?.state).toBe('ACTIVE');
    expect(flag(result, 'USE_POSITIVE_CURRENT')?.state).toBe('ACTIVE');
  });

  it('does not cross thresholds one point outside the locked boundaries', () => {
    const result = evaluateWeeklyAssessment(
      current(
        completeAnswers({
          U1: false,
          R2: 5,
          R3: 5,
          R4: 5,
          R5: 5,
          P1: 3,
          P5: 3,
        }),
      ),
    );

    expect(flag(result, 'HIGH_CRAVING')?.state).toBe('CLEAR');
    expect(flag(result, 'HIGH_NEGATIVE_MOOD')?.state).toBe('CLEAR');
    expect(flag(result, 'HIGH_RISKY_SITUATIONS')?.state).toBe('CLEAR');
    expect(flag(result, 'HIGH_RELATIONSHIP_PROBLEMS')?.state).toBe('CLEAR');
    expect(flag(result, 'LOW_CONFIDENCE')?.state).toBe('CLEAR');
    expect(flag(result, 'LOW_SOCIAL_SUPPORT')?.state).toBe('CLEAR');
    expect(flag(result, 'USE_POSITIVE_CURRENT')?.state).toBe('CLEAR');
  });

  it('keeps omitted inputs UNKNOWN rather than converting them to zero/clear', () => {
    const result = evaluateWeeklyAssessment(
      current({
        U1: false,
        R1: 1,
        R2: 1,
        R4: 1,
        R5: 1,
        P1: 6,
        P2: 6,
        P3: 6,
        P4: 6,
        P5: 6,
      }),
    );

    expect(flag(result, 'HIGH_CRAVING')).toMatchObject({
      state: 'UNKNOWN',
      value: null,
    });
    expect(result.aggregate.riskScore).toBeNull();
    expect(result.aggregate.recoveryProgress).toBeNull();
  });
});

describe('aggregate and preference-compatible protection semantics', () => {
  it('computes complete risk/protection without proration', () => {
    const result = evaluateWeeklyAssessment(
      current(
        completeAnswers({
          R1: 5,
          R2: 5,
          R3: 5,
          R4: 5,
          R5: 5,
          P1: 5,
          P2: 5,
          P3: 5,
          P4: 5,
          P5: 5,
        }),
      ),
    );

    expect(result.aggregate.riskScore).toBe(25);
    expect(result.aggregate.riskTag).toBe('HIGH_RISK');
    expect(result.aggregate.rawProtectionScore).toBe(25);
    expect(result.aggregate.recoveryProgress).toBe(0);
  });

  it('leaves an incomplete protection aggregate absent', () => {
    const answers = completeAnswers();
    delete answers.P3;

    const result = evaluateWeeklyAssessment(current(answers));

    expect(result.aggregate.rawProtectionScore).toBeNull();
    expect(result.aggregate.recoveryProgress).toBeNull();
  });

  it('treats preference-inapplicable P2/P3 through bounds without renormalization', () => {
    const result = evaluateWeeklyAssessment(
      current(
        completeAnswers({
          P1: 1,
          P2: 7,
          P3: 7,
          P4: 1,
          P5: 1,
        }),
        {
          preferences: {
            mutualHelpPreference: 'NONE',
            spiritualContentPreference: 'DO_NOT_ALLOW',
          },
        },
      ),
    );

    expect(result.aggregate.rawProtectionScore).toBe(17);
    expect(result.aggregate.operationalProtectionDomainsObserved).toBe(3);
    expect(result.aggregate.operationalProtectionDomainsTotal).toBe(5);
    expect(result.aggregate.minimumPossibleProtection).toBe(3);
    expect(result.aggregate.maximumPossibleProtection).toBeGreaterThanOrEqual(
      17,
    );
  });

  it('emits only the locked aggregate interaction tags', () => {
    const result = evaluateWeeklyAssessment(
      current(
        completeAnswers({
          R1: 7,
          R2: 7,
          R3: 7,
          R4: 7,
          R5: 7,
          P1: 0,
          P2: 0,
          P3: 0,
          P4: 0,
          P5: 0,
        }),
      ),
    );

    expect(result.aggregate.interactionTags).toEqual([
      'HIGH_RISK_WEAK_PROTECTION_CONTEXT',
    ]);
  });
});

describe('delta, persistence, and clearance semantics', () => {
  it('computes sharp-change deltas only across the adjacent authoritative period', () => {
    const previous = historical(0, completeAnswers({ R2: 2, R3: 2, P1: 6 }), {
      riskScore: 10,
      rawProtectionScore: 25,
      recoveryProgress: 15,
    });

    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ R2: 4, R3: 4, P1: 4 }), {
        history: [previous],
        periodStartAt: atWeek(1),
        periodEndAt: atWeek(2),
      }),
    );

    expect(result.longitudinal.cravingDelta).toBe(2);
    expect(result.longitudinal.confidenceDelta).toBe(-2);
    expect(result.longitudinal.negativeMoodDelta).toBe(2);
  });

  it('does not bridge a missing scheduled period for deltas or persistence', () => {
    const history = [
      historical(0, completeAnswers({ R3: 7 })),
      historical(1, null),
    ];

    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ R3: 7 }), {
        history,
        periodStartAt: atWeek(2),
        periodEndAt: atWeek(3),
      }),
    );

    expect(result.longitudinal.cravingDelta).toBeNull();
    expect(result.longitudinal.trendDataValid).toBe(false);
    expect(result.longitudinal.persistenceStreakSnapshot.HIGH_CRAVING).toBe(1);
    expect(result.candidateClinicianReasonFamilies).not.toContain(
      'PERSISTENT_HIGH_CRAVING',
    );
  });

  it('activates persistence on two adjacent explicit qualifying observations', () => {
    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ R3: 7 }), {
        history: [historical(0, completeAnswers({ R3: 7 }))],
        periodStartAt: atWeek(1),
        periodEndAt: atWeek(2),
      }),
    );

    expect(result.longitudinal.persistenceStreakSnapshot.HIGH_CRAVING).toBe(2);
    expect(result.candidateClinicianReasonFamilies).toContain(
      'PERSISTENT_HIGH_CRAVING',
    );
  });

  it('pauses clearance through missing observations', () => {
    const active: ReasonLifecycleSnapshot = {
      status: 'ACTIVE',
      clearanceCount: 0,
    };

    const history = [
      historical(0, completeAnswers({ R3: 7, P1: 1 }), {
        reasonLifecycle: {
          CRAVING_LOW_CONFIDENCE: active,
        },
      }),
    ];

    const result = evaluateWeeklyAssessment(
      current(
        { U1: false },
        {
          completionStatus: 'PARTIAL',
          history,
          periodStartAt: atWeek(1),
          periodEndAt: atWeek(2),
        },
      ),
    );

    expect(reasonState(result, 'CRAVING_LOW_CONFIDENCE')).toEqual(active);
  });

  it('clears ACTIVE -> CLEARANCE_PENDING(1) -> RESOLVED(2)', () => {
    const pendingHistory = [
      historical(0, completeAnswers({ R3: 7, P1: 1 }), {
        reasonLifecycle: {
          CRAVING_LOW_CONFIDENCE: {
            status: 'ACTIVE',
            clearanceCount: 0,
          },
        },
      }),
    ];

    const firstClear = evaluateWeeklyAssessment(
      current(completeAnswers({ R3: 1, P1: 6 }), {
        history: pendingHistory,
        periodStartAt: atWeek(1),
        periodEndAt: atWeek(2),
      }),
    );

    expect(reasonState(firstClear, 'CRAVING_LOW_CONFIDENCE')).toEqual({
      status: 'CLEARANCE_PENDING',
      clearanceCount: 1,
    });

    const resolvedHistory = [
      ...pendingHistory,
      historical(1, completeAnswers({ R3: 1, P1: 6 }), {
        reasonLifecycle: firstClear.longitudinal.clearanceReasonStateSnapshot,
      }),
    ];

    const secondClear = evaluateWeeklyAssessment(
      current(completeAnswers({ R3: 1, P1: 6 }), {
        history: resolvedHistory,
        periodStartAt: atWeek(2),
        periodEndAt: atWeek(3),
      }),
    );

    expect(reasonState(secondClear, 'CRAVING_LOW_CONFIDENCE')).toEqual({
      status: 'RESOLVED',
      clearanceCount: 2,
    });
  });

  it('reappearance during clearance restores ACTIVE and resets its count', () => {
    const history = [
      historical(0, completeAnswers({ R3: 1, P1: 6 }), {
        reasonLifecycle: {
          CRAVING_LOW_CONFIDENCE: {
            status: 'CLEARANCE_PENDING',
            clearanceCount: 1,
          },
        },
      }),
    ];

    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ R3: 7, P1: 1 }), {
        history,
        periodStartAt: atWeek(1),
        periodEndAt: atWeek(2),
      }),
    );

    expect(reasonState(result, 'CRAVING_LOW_CONFIDENCE')).toEqual({
      status: 'ACTIVE',
      clearanceCount: 0,
    });
  });
});

describe('abstinence recurrence semantics', () => {
  it('requires the current period itself to be positive', () => {
    const history = [
      historical(0, completeAnswers({ U1: true })),
      historical(1, completeAnswers({ U1: true })),
      historical(2, completeAnswers({ U1: false })),
    ];

    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ U1: false }), {
        history,
        periodStartAt: atWeek(3),
        periodEndAt: atWeek(4),
      }),
    );

    expect(result.longitudinal.recurrentUse).toBe(false);
    expect(result.candidateClinicianReasonFamilies).not.toContain(
      'RECURRENT_USE',
    );
  });

  it('does not evaluate recurrent use before a full four-period window exists', () => {
    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ U1: true }), {
        history: [historical(0, completeAnswers({ U1: true }))],
        periodStartAt: atWeek(1),
        periodEndAt: atWeek(2),
      }),
    );

    expect(result.longitudinal.consecutiveUse).toBe(true);
    expect(result.longitudinal.recurrentUse).toBe(false);
    expect(result.longitudinal.recurrentUseObservedPeriods).toBe(0);

    expect(result.candidateClinicianReasonFamilies).toContain(
      'CONSECUTIVE_USE',
    );

    expect(result.candidateClinicianReasonFamilies).not.toContain(
      'RECURRENT_USE',
    );
  });

  it('counts UNKNOWN/missing prior periods as neither positive nor negative', () => {
    const history = [
      historical(0, completeAnswers({ U1: true })),
      historical(1, { R3: 2 }),
      historical(2, null),
    ];

    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ U1: true }), {
        history,
        periodStartAt: atWeek(3),
        periodEndAt: atWeek(4),
      }),
    );

    expect(result.longitudinal.recurrentUse).toBe(true);
    expect(result.longitudinal.recurrentUseObservedPeriods).toBe(2);
    expect(result.candidateClinicianReasonFamilies).toContain('RECURRENT_USE');
  });

  it('does not reinterpret a REDUCTION positive week as abstinence recurrence', () => {
    const history = [
      historical(0, completeAnswers({ U1: true }), {
        goal: 'REDUCTION',
      }),
      historical(1, { R3: 2 }),
      historical(2, completeAnswers({ U1: false })),
    ];

    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ U1: true }), {
        history,
        periodStartAt: atWeek(3),
        periodEndAt: atWeek(4),
      }),
    );

    expect(result.longitudinal.recurrentUse).toBe(false);
    expect(result.longitudinal.recurrentUseObservedPeriods).toBe(2);
  });

  it('requires the immediately previous period to be ABSTINENCE-positive for consecutive use', () => {
    const previousReduction = historical(0, completeAnswers({ U1: true }), {
      goal: 'REDUCTION',
    });

    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ U1: true }), {
        history: [previousReduction],
        periodStartAt: atWeek(1),
        periodEndAt: atWeek(2),
      }),
    );

    expect(result.longitudinal.consecutiveUse).toBe(false);
  });

  it('reactivates a recurrence reason on a new positive during clearance', () => {
    const history = [
      historical(0, completeAnswers({ U1: false })),
      historical(1, completeAnswers({ U1: true })),
      historical(2, completeAnswers({ U1: false }), {
        reasonLifecycle: {
          RECURRENT_USE: {
            status: 'CLEARANCE_PENDING',
            clearanceCount: 1,
          },
        },
      }),
    ];

    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ U1: true }), {
        history,
        periodStartAt: atWeek(3),
        periodEndAt: atWeek(4),
      }),
    );

    expect(reasonState(result, 'RECURRENT_USE')).toEqual({
      status: 'ACTIVE',
      clearanceCount: 0,
    });
  });

  it('requires twelve adjacent explicit ABSTINENCE-negative periods for use-after-stability', () => {
    const history = Array.from({ length: 12 }, (_, index) =>
      historical(index, completeAnswers({ U1: false })),
    );

    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ U1: true }), {
        history,
        periodStartAt: atWeek(12),
        periodEndAt: atWeek(13),
      }),
    );

    expect(result.longitudinal.useAfterStability).toBe(true);

    const withUnknown = [...history];

    withUnknown[5] = historical(5, { R3: 2 });

    const unknownResult = evaluateWeeklyAssessment(
      current(completeAnswers({ U1: true }), {
        history: withUnknown,
        periodStartAt: atWeek(12),
        periodEndAt: atWeek(13),
      }),
    );

    expect(unknownResult.longitudinal.useAfterStability).toBe(false);
  });

  it('never runs abstinence recurrence for REDUCTION or UNSURE current goals', () => {
    for (const goal of ['REDUCTION', 'UNSURE'] as const) {
      const result = evaluateWeeklyAssessment(
        current(completeAnswers({ U1: true }), {
          goal,
          history: [historical(0, completeAnswers({ U1: true }))],
          periodStartAt: atWeek(1),
          periodEndAt: atWeek(2),
        }),
      );

      expect(result.longitudinal.consecutiveUse).toBe(false);
      expect(result.longitudinal.recurrentUse).toBe(false);

      expect(result.candidateClinicianReasonFamilies).not.toContain(
        'RECURRENT_USE',
      );
    }
  });
});

describe('completion and effect-plan policy', () => {
  it('does not create non-use clinician reasons from a PARTIAL assessment', () => {
    const result = evaluateWeeklyAssessment(
      current(
        {
          U1: false,
          R2: 7,
          R3: 7,
          P1: 1,
        },
        {
          completionStatus: 'PARTIAL',
        },
      ),
    );

    expect(result.candidateClinicianReasonFamilies).toEqual([]);
  });

  it('allows U1 recurrence reasons to survive PARTIAL when the explicit U1 history supports them', () => {
    const result = evaluateWeeklyAssessment(
      current(
        {
          U1: true,
        },
        {
          completionStatus: 'PARTIAL',
          history: [
            historical(
              0,
              {
                U1: true,
              },
              {
                completionStatus: 'PARTIAL',
              },
            ),
          ],
          periodStartAt: atWeek(1),
          periodEndAt: atWeek(2),
        },
      ),
    );

    expect(result.candidateClinicianReasonFamilies).toContain(
      'CONSECUTIVE_USE',
    );

    expect(result.candidateClinicianReasonFamilies).not.toContain(
      'RECURRENT_USE',
    );
  });

  it('suppresses patient support for STAFF_CORRECTION but keeps current clinician eligibility', () => {
    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ R3: 7, P1: 1 }), {
        trigger: 'STAFF_CORRECTION',
      }),
    );

    expect(result.candidatePatientInterventions.length).toBeGreaterThan(0);

    expect(
      result.candidatePatientInterventions.every(
        (candidate) => candidate.effect === 'SUPPRESSED_TRIGGER',
      ),
    ).toBe(true);

    expect(result.effectPlan.candidateClinicianReasons).toContainEqual({
      reasonFamily: 'CRAVING_LOW_CONFIDENCE',
      effect: 'ELIGIBLE',
      suppressionReason: null,
    });
  });

  it('marks historical patient and clinician effects historical-only', () => {
    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ R3: 7, P1: 1 }), {
        effectScope: 'HISTORICAL',
        trigger: 'HISTORICAL_BACKFILL',
      }),
    );

    expect(
      result.candidatePatientInterventions.every(
        (candidate) => candidate.effect === 'HISTORICAL_ONLY',
      ),
    ).toBe(true);

    expect(
      result.effectPlan.candidateClinicianReasons.every(
        (reason) => reason.effect === 'HISTORICAL_ONLY',
      ),
    ).toBe(true);
  });

  it('applies safety to effects without erasing the underlying observation', () => {
    const result = evaluateWeeklyAssessment(
      current(completeAnswers({ R3: 7 }), {
        safety: {
          ...safe,
          safetyState: 'REVIEW_REQUIRED',
          allowedSubjectiveInterventions: [],
        },
      }),
    );

    expect(flag(result, 'HIGH_CRAVING')?.state).toBe('ACTIVE');

    expect(result.candidatePatientInterventions[0]?.effect).toBe(
      'SUPPRESSED_SAFETY',
    );
  });
});
