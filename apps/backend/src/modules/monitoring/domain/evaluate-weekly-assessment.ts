import { SUBJECTIVE_MONITORING_V1 } from '../../../policy/subjective-monitoring-v1.js';
import type {
  AggregateContext,
  CandidatePatientIntervention,
  EffectPlan,
  EvaluateWeeklyAssessmentInput,
  FlagKey,
  FlagObservation,
  HistoricalWeeklyObservation,
  LongitudinalFeatures,
  ReasonLifecycleSnapshot,
  WeeklyAnswers,
  WeeklyEvaluationResult,
} from '../types.js';

const FLAG_KEYS: readonly FlagKey[] = [
  'HIGH_CRAVING',
  'HIGH_NEGATIVE_MOOD',
  'HIGH_RISKY_SITUATIONS',
  'HIGH_RELATIONSHIP_PROBLEMS',
  'LOW_CONFIDENCE',
  'LOW_SOCIAL_SUPPORT',
  'USE_POSITIVE_CURRENT',
];

function numberAnswer(answers: WeeklyAnswers | null, key: keyof WeeklyAnswers) {
  const value = answers?.[key];
  return typeof value === 'number' ? value : null;
}

function booleanAnswer(answers: WeeklyAnswers | null, key: 'U1') {
  const value = answers?.[key];
  return typeof value === 'boolean' ? value : null;
}

function hasAllNumbers(
  answers: WeeklyAnswers,
  keys: readonly (keyof WeeklyAnswers)[],
) {
  return keys.every((key) => numberAnswer(answers, key) !== null);
}

function periodIsAdjacent(previous: HistoricalWeeklyObservation, start: Date) {
  return previous.periodEndAt.getTime() === start.getTime();
}

function currentFlagValue(key: FlagKey, answers: WeeklyAnswers) {
  switch (key) {
    case 'HIGH_CRAVING': {
      const value = numberAnswer(answers, 'R3');
      return value === null ? null : value >= 6;
    }

    case 'HIGH_NEGATIVE_MOOD': {
      const value = numberAnswer(answers, 'R2');
      return value === null ? null : value >= 6;
    }

    case 'HIGH_RISKY_SITUATIONS': {
      const value = numberAnswer(answers, 'R4');
      return value === null ? null : value >= 6;
    }

    case 'HIGH_RELATIONSHIP_PROBLEMS': {
      const value = numberAnswer(answers, 'R5');
      return value === null ? null : value >= 6;
    }

    case 'LOW_CONFIDENCE': {
      const value = numberAnswer(answers, 'P1');
      return value === null ? null : value <= 2;
    }

    case 'LOW_SOCIAL_SUPPORT': {
      const value = numberAnswer(answers, 'P5');
      return value === null ? null : value <= 2;
    }

    case 'USE_POSITIVE_CURRENT':
      return booleanAnswer(answers, 'U1');
  }
}

function flagObservations(answers: WeeklyAnswers): FlagObservation[] {
  return FLAG_KEYS.map((flagKey) => {
    const value = currentFlagValue(flagKey, answers);

    return {
      flagKey,
      value,
      state: value === null ? 'UNKNOWN' : value ? 'ACTIVE' : 'CLEAR',
    };
  });
}

function calculateAggregate(
  answers: WeeklyAnswers,
  preferences: EvaluateWeeklyAssessmentInput['preferences'],
): AggregateContext {
  const riskKeys = ['R1', 'R2', 'R3', 'R4', 'R5'] as const;

  const protectionKeys = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;

  const riskComplete = hasAllNumbers(answers, riskKeys);
  const protectionComplete = hasAllNumbers(answers, protectionKeys);

  const riskScore = riskComplete
    ? riskKeys.reduce(
        (total, key) => total + (numberAnswer(answers, key) ?? 0),
        0,
      )
    : null;

  const rawProtectionScore = protectionComplete
    ? protectionKeys.reduce(
        (total, key) => total + (numberAnswer(answers, key) ?? 0),
        0,
      )
    : null;

  const riskTag =
    riskScore === null ? null : riskScore >= 25 ? 'HIGH_RISK' : 'NOT_HIGH';

  const applicability: Array<'APPLICABLE' | 'NOT_APPLICABLE' | 'UNKNOWN'> = [
    'APPLICABLE',
    preferences.mutualHelpPreference === 'NONE'
      ? 'NOT_APPLICABLE'
      : preferences.mutualHelpPreference === 'AA_12_STEP' ||
          preferences.mutualHelpPreference === 'ALTERNATIVE'
        ? 'APPLICABLE'
        : 'UNKNOWN',
    preferences.spiritualContentPreference === 'DO_NOT_ALLOW'
      ? 'NOT_APPLICABLE'
      : preferences.spiritualContentPreference === 'ALLOW'
        ? 'APPLICABLE'
        : 'UNKNOWN',
    'APPLICABLE',
    'APPLICABLE',
  ];

  const protectionValues = protectionKeys.map((key) =>
    numberAnswer(answers, key),
  );

  const operationalProtectionDomainsObserved = applicability.filter(
    (value, index) =>
      value === 'APPLICABLE' && protectionValues[index] !== null,
  ).length;

  const minimumPossibleProtection = protectionValues.reduce<number>(
    (total, value, index) =>
      total +
      (applicability[index] === 'APPLICABLE' && value !== null ? value : 0),
    0,
  );

  const maximumPossibleProtection = protectionValues.reduce<number>(
    (total, value, index) =>
      total +
      (applicability[index] === 'APPLICABLE' && value !== null ? value : 7),
    0,
  );

  const protectionCoverageRatio = operationalProtectionDomainsObserved / 5;

  let protectionTag: AggregateContext['protectionTag'] = null;

  if (maximumPossibleProtection <= 5) {
    protectionTag = 'WEAK_PROTECTION';
  } else if (minimumPossibleProtection >= 25) {
    protectionTag = 'STRONG_PROTECTION';
  } else if (
    protectionComplete &&
    applicability.every((value) => value === 'APPLICABLE') &&
    rawProtectionScore !== null &&
    rawProtectionScore >= 6 &&
    rawProtectionScore <= 24
  ) {
    protectionTag = 'INTERMEDIATE_PROTECTION';
  }

  const interactionTags: string[] = [];

  if (riskTag === 'HIGH_RISK' && protectionTag === 'WEAK_PROTECTION') {
    interactionTags.push('HIGH_RISK_WEAK_PROTECTION_CONTEXT');
  }

  if (riskTag === 'HIGH_RISK' && protectionTag === 'STRONG_PROTECTION') {
    interactionTags.push('HIGH_RISK_STRONG_PROTECTION_CONTEXT');
  }

  return {
    riskScore,
    rawProtectionScore,
    recoveryProgress:
      riskScore !== null && rawProtectionScore !== null
        ? rawProtectionScore - riskScore
        : null,
    riskTag,
    protectionTag,
    operationalProtectionDomainsObserved,
    operationalProtectionDomainsTotal: 5,
    protectionCoverageRatio,
    minimumPossibleProtection,
    maximumPossibleProtection,
    interactionTags,
  };
}

function previousAdjacent(
  history: readonly HistoricalWeeklyObservation[],
  periodStartAt: Date,
) {
  const previous = history[history.length - 1];

  return previous && periodIsAdjacent(previous, periodStartAt)
    ? previous
    : null;
}

function conditionForFlag(flagKey: FlagKey, answers: WeeklyAnswers | null) {
  return answers ? currentFlagValue(flagKey, answers) : null;
}

function combinedCondition(left: boolean | null, right: boolean | null) {
  if (left === null || right === null) return null;
  return left && right;
}

function previousReasonState(
  history: readonly HistoricalWeeklyObservation[],
  reasonFamily: string,
): ReasonLifecycleSnapshot {
  return (
    history[history.length - 1]?.reasonLifecycle?.[reasonFamily] ?? {
      status: 'INACTIVE',
      clearanceCount: 0,
    }
  );
}

function reasonLifecycleTransition(
  currentCondition: boolean | null,
  previous: ReasonLifecycleSnapshot,
): ReasonLifecycleSnapshot {
  if (currentCondition === null) {
    return { ...previous };
  }

  if (currentCondition) {
    return {
      status: 'ACTIVE',
      clearanceCount: 0,
    };
  }

  if (previous.status === 'ACTIVE' || previous.status === 'CLEARANCE_PENDING') {
    const clearanceCount = previous.clearanceCount + 1;

    return clearanceCount >= SUBJECTIVE_MONITORING_V1.persistence.N_CLEAR
      ? {
          status: 'RESOLVED',
          clearanceCount,
        }
      : {
          status: 'CLEARANCE_PENDING',
          clearanceCount,
        };
  }

  return { ...previous };
}

function recurrenceLifecycleCondition(
  currentUseStatus: ReturnType<typeof deriveUseStatus>,
  newlyQualified: boolean | null,
  previous: ReasonLifecycleSnapshot,
) {
  if (currentUseStatus === 'UNKNOWN') return null;

  if (currentUseStatus === 'NEGATIVE') return false;

  if (previous.status === 'ACTIVE' || previous.status === 'CLEARANCE_PENDING') {
    return true;
  }

  return newlyQualified;
}

function currentPersistenceCondition(
  flagKey: FlagKey,
  answers: WeeklyAnswers,
  history: readonly HistoricalWeeklyObservation[],
  periodStartAt: Date,
) {
  const current = conditionForFlag(flagKey, answers);

  if (current === null) return null;
  if (!current) return false;

  const previous = previousAdjacent(history, periodStartAt);

  if (!previous || !previous.authoritative) {
    return null;
  }

  const previousValue = conditionForFlag(flagKey, previous.answers);

  return previousValue === null ? null : previousValue;
}

function currentConsecutiveUseCondition(
  currentUseStatus: ReturnType<typeof deriveUseStatus>,
  currentGoal: EvaluateWeeklyAssessmentInput['goal'],
  history: readonly HistoricalWeeklyObservation[],
  periodStartAt: Date,
) {
  if (currentGoal !== 'ABSTINENCE' || currentUseStatus === 'UNKNOWN') {
    return null;
  }

  if (currentUseStatus !== 'POSITIVE') return false;

  const previous = previousAdjacent(history, periodStartAt);

  if (
    !previous ||
    !previous.authoritative ||
    previous.goal !== 'ABSTINENCE' ||
    previous.useStatus === 'UNKNOWN'
  ) {
    return null;
  }

  return previous.useStatus === 'POSITIVE';
}

function windowIsAdjacent(
  observations: readonly HistoricalWeeklyObservation[],
  nextStart: Date,
) {
  for (let index = observations.length - 1; index >= 0; index -= 1) {
    const observation = observations[index];

    if (!observation || !periodIsAdjacent(observation, nextStart)) {
      return false;
    }

    nextStart = observation.periodStartAt;
  }

  return true;
}

function recurrenceWindowStats(
  currentUseStatus: ReturnType<typeof deriveUseStatus>,
  currentGoal: EvaluateWeeklyAssessmentInput['goal'],
  history: readonly HistoricalWeeklyObservation[],
  periodStartAt: Date,
) {
  const windowSize = SUBJECTIVE_MONITORING_V1.recurrenceWindowPeriods - 1;

  const previous = history.slice(-windowSize);

  if (
    previous.length !== windowSize ||
    !windowIsAdjacent(previous, periodStartAt)
  ) {
    return {
      valid: false,
      positiveCount: 0,
      observedUsePeriods: 0,
    };
  }

  const historicalObserved = previous.filter(
    (item) =>
      item.authoritative &&
      item.goal === 'ABSTINENCE' &&
      item.useStatus !== 'UNKNOWN',
  );

  const currentObserved =
    currentGoal === 'ABSTINENCE' && currentUseStatus !== 'UNKNOWN';

  const positiveCount =
    historicalObserved.filter((item) => item.useStatus === 'POSITIVE').length +
    (currentGoal === 'ABSTINENCE' && currentUseStatus === 'POSITIVE' ? 1 : 0);

  return {
    valid: true,
    positiveCount,
    observedUsePeriods: historicalObserved.length + (currentObserved ? 1 : 0),
  };
}

function currentRecurrentUseCondition(
  currentUseStatus: ReturnType<typeof deriveUseStatus>,
  currentGoal: EvaluateWeeklyAssessmentInput['goal'],
  history: readonly HistoricalWeeklyObservation[],
  periodStartAt: Date,
) {
  if (currentGoal !== 'ABSTINENCE' || currentUseStatus === 'UNKNOWN') {
    return null;
  }

  if (currentUseStatus !== 'POSITIVE') return false;

  const window = recurrenceWindowStats(
    currentUseStatus,
    currentGoal,
    history,
    periodStartAt,
  );

  return window.valid ? window.positiveCount >= 2 : null;
}

function addCandidate(
  candidates: Map<
    CandidatePatientIntervention['interventionClass'],
    CandidatePatientIntervention
  >,
  interventionClass: CandidatePatientIntervention['interventionClass'],
  reason: string,
) {
  const existing = candidates.get(interventionClass);

  if (existing) {
    if (!existing.sourceReasons.includes(reason)) {
      existing.sourceReasons.push(reason);
    }

    return;
  }

  candidates.set(interventionClass, {
    interventionClass,
    sourceReasons: [reason],
    resolverPriority:
      SUBJECTIVE_MONITORING_V1.interventionPriority.indexOf(interventionClass),
    effect: 'ELIGIBLE',
    suppressionReason: null,
  });
}

function resolveCandidates(
  input: EvaluateWeeklyAssessmentInput,
  flags: readonly FlagObservation[],
  reasons: readonly string[],
  aggregate: AggregateContext,
  longitudinal: LongitudinalFeatures,
  previous: HistoricalWeeklyObservation | null,
): CandidatePatientIntervention[] {
  const candidates = new Map<
    CandidatePatientIntervention['interventionClass'],
    CandidatePatientIntervention
  >();

  const active = new Set(
    flags.filter((flag) => flag.state === 'ACTIVE').map((flag) => flag.flagKey),
  );

  if (longitudinal.recurrentUse || longitudinal.consecutiveUse) {
    if (longitudinal.recurrentUse) {
      addCandidate(
        candidates,
        'RECURRENT_USE_RECOVERY_SUPPORT',
        'RECURRENT_USE',
      );
    }

    if (longitudinal.consecutiveUse) {
      addCandidate(
        candidates,
        'RECURRENT_USE_RECOVERY_SUPPORT',
        'CONSECUTIVE_USE',
      );
    }

    addCandidate(candidates, 'RECOVERY_PLAN_REVIEW', 'ABSTINENCE_USE_PATTERN');
  }

  if (active.has('USE_POSITIVE_CURRENT')) {
    addCandidate(
      candidates,
      'USE_EVENT_RECOVERY_SUPPORT',
      'USE_POSITIVE_CURRENT',
    );
  }

  if (active.has('HIGH_CRAVING')) {
    addCandidate(candidates, 'CRAVING_COPING_SUPPORT', 'HIGH_CRAVING');
  }

  if (active.has('HIGH_RISKY_SITUATIONS')) {
    addCandidate(
      candidates,
      'TRIGGER_MANAGEMENT_SUPPORT',
      'HIGH_RISKY_SITUATIONS',
    );
  }

  if (active.has('HIGH_NEGATIVE_MOOD')) {
    addCandidate(candidates, 'MOOD_COPING_SUPPORT', 'HIGH_NEGATIVE_MOOD');
  }

  if (active.has('LOW_CONFIDENCE')) {
    addCandidate(candidates, 'SELF_EFFICACY_SUPPORT', 'LOW_CONFIDENCE');
  }

  if (active.has('HIGH_RELATIONSHIP_PROBLEMS')) {
    addCandidate(
      candidates,
      'RELATIONSHIP_COPING_SUPPORT',
      'HIGH_RELATIONSHIP_PROBLEMS',
    );
  }

  if (active.has('LOW_SOCIAL_SUPPORT')) {
    addCandidate(candidates, 'SOCIAL_SUPPORT_ACTIVATION', 'LOW_SOCIAL_SUPPORT');
  }

  if (
    longitudinal.cravingDelta !== null &&
    longitudinal.cravingDelta >=
      SUBJECTIVE_MONITORING_V1.sharpChanges.cravingIncrease
  ) {
    addCandidate(
      candidates,
      'CRAVING_COPING_SUPPORT',
      'SHARP_CRAVING_INCREASE',
    );
  }

  if (
    longitudinal.confidenceDelta !== null &&
    longitudinal.confidenceDelta <=
      SUBJECTIVE_MONITORING_V1.sharpChanges.confidenceDrop
  ) {
    addCandidate(candidates, 'SELF_EFFICACY_SUPPORT', 'SHARP_CONFIDENCE_DROP');
  }

  if (
    longitudinal.negativeMoodDelta !== null &&
    longitudinal.negativeMoodDelta >=
      SUBJECTIVE_MONITORING_V1.sharpChanges.negativeMoodIncrease
  ) {
    addCandidate(
      candidates,
      'MOOD_COPING_SUPPORT',
      'SHARP_NEGATIVE_MOOD_INCREASE',
    );
  }

  if (aggregate.interactionTags.includes('HIGH_RISK_WEAK_PROTECTION_CONTEXT')) {
    addCandidate(
      candidates,
      'RECOVERY_PLAN_REVIEW',
      'HIGH_RISK_WEAK_PROTECTION_CONTEXT',
    );
  }

  if (input.consumption?.targetStatus === 'NOT_MET') {
    addCandidate(
      candidates,
      'RECOVERY_PLAN_REVIEW',
      'REDUCTION_TARGET_NOT_MET',
    );
  }

  const previousActive =
    previous &&
    previous.authoritative &&
    periodIsAdjacent(previous, input.periodStartAt)
      ? flags.some((flag) => {
          if (flag.flagKey === 'USE_POSITIVE_CURRENT') {
            return false;
          }

          if (flag.state !== 'CLEAR') {
            return false;
          }

          const previousValue = conditionForFlag(
            flag.flagKey,
            previous.answers,
          );

          return previousValue === true;
        })
      : false;

  if (
    candidates.size === 0 &&
    (previousActive || input.consumption?.targetStatus === 'MET')
  ) {
    addCandidate(
      candidates,
      'POSITIVE_REINFORCEMENT',
      'RESOLVED_OR_TARGET_MET',
    );
  }

  const allowed = new Set(input.safety.allowedSubjectiveInterventions);

  const restricted =
    input.safety.safetyState === 'REVIEW_REQUIRED' ||
    input.safety.safetyState === 'HANDOFF_REQUIRED';

  return [...candidates.values()]
    .filter(
      (candidate) => reasons.length > 0 || candidate.sourceReasons.length > 0,
    )
    .sort((left, right) => left.resolverPriority - right.resolverPriority)
    .slice(0, SUBJECTIVE_MONITORING_V1.maxInterventionClassesPerEvaluation)
    .map((candidate) => {
      if (
        input.trigger === 'STAFF_CORRECTION' ||
        input.trigger === 'ADMINISTRATIVE_RECOMPUTE' ||
        input.trigger === 'POLICY_MIGRATION'
      ) {
        return {
          ...candidate,
          effect: 'SUPPRESSED_TRIGGER' as const,
          suppressionReason: input.trigger,
        };
      }

      if (input.effectScope === 'HISTORICAL') {
        return {
          ...candidate,
          effect: 'HISTORICAL_ONLY' as const,
          suppressionReason: 'HISTORICAL_EFFECT_SCOPE',
        };
      }

      if (!restricted || allowed.has(candidate.interventionClass)) {
        return candidate;
      }

      return {
        ...candidate,
        effect: 'SUPPRESSED_SAFETY',
        suppressionReason: 'ALLOW_WITH_HANDOFF_RESTRICTION',
      };
    });
}

function evaluateLongitudinal(
  input: EvaluateWeeklyAssessmentInput,
  currentAggregate: AggregateContext,
  currentUseStatus: ReturnType<typeof deriveUseStatus>,
  flags: readonly FlagObservation[],
): LongitudinalFeatures {
  const previous = previousAdjacent(input.history, input.periodStartAt);

  const previousAnswers = previous?.authoritative ? previous.answers : null;

  const deltasValid = Boolean(
    previous && previous.authoritative && previousAnswers,
  );

  const cravingDelta =
    deltasValid &&
    numberAnswer(input.answers, 'R3') !== null &&
    numberAnswer(previousAnswers, 'R3') !== null
      ? numberAnswer(input.answers, 'R3')! -
        numberAnswer(previousAnswers, 'R3')!
      : null;

  const confidenceDelta =
    deltasValid &&
    numberAnswer(input.answers, 'P1') !== null &&
    numberAnswer(previousAnswers, 'P1') !== null
      ? numberAnswer(input.answers, 'P1')! -
        numberAnswer(previousAnswers, 'P1')!
      : null;

  const negativeMoodDelta =
    deltasValid &&
    numberAnswer(input.answers, 'R2') !== null &&
    numberAnswer(previousAnswers, 'R2') !== null
      ? numberAnswer(input.answers, 'R2')! -
        numberAnswer(previousAnswers, 'R2')!
      : null;

  const riskScoreDelta =
    deltasValid &&
    currentAggregate.riskScore !== null &&
    previous?.riskScore !== null
      ? currentAggregate.riskScore - previous!.riskScore!
      : null;

  const rawProtectionScoreDelta =
    deltasValid &&
    currentAggregate.rawProtectionScore !== null &&
    previous?.rawProtectionScore !== null
      ? currentAggregate.rawProtectionScore - previous!.rawProtectionScore!
      : null;

  const recoveryProgressDelta =
    deltasValid &&
    currentAggregate.recoveryProgress !== null &&
    previous?.recoveryProgress !== null
      ? currentAggregate.recoveryProgress - previous!.recoveryProgress!
      : null;

  const persistenceStreakSnapshot: Record<string, number> = {};

  for (const flagKey of ['HIGH_CRAVING', 'HIGH_NEGATIVE_MOOD'] as const) {
    const current = flags.find((flag) => flag.flagKey === flagKey);

    const previousValue = previous
      ? conditionForFlag(flagKey, previous.answers)
      : null;

    persistenceStreakSnapshot[flagKey] =
      current?.state === 'ACTIVE'
        ? previous &&
          previous.authoritative &&
          periodIsAdjacent(previous, input.periodStartAt) &&
          previousValue === true
          ? SUBJECTIVE_MONITORING_V1.persistence.N_PERSIST
          : 1
        : 0;
  }

  const clearanceReasonStateSnapshot: Record<string, ReasonLifecycleSnapshot> =
    {};

  const consecutiveUse =
    input.goal === 'ABSTINENCE' &&
    currentUseStatus === 'POSITIVE' &&
    Boolean(
      previous &&
      previous.authoritative &&
      previous.goal === 'ABSTINENCE' &&
      periodIsAdjacent(previous, input.periodStartAt) &&
      previous.useStatus === 'POSITIVE',
    );

  const recurrenceWindow = recurrenceWindowStats(
    currentUseStatus,
    input.goal,
    input.history,
    input.periodStartAt,
  );

  const recurrentUse =
    input.goal === 'ABSTINENCE' &&
    currentUseStatus === 'POSITIVE' &&
    recurrenceWindow.valid &&
    recurrenceWindow.positiveCount >= 2;

  const stabilityWindow = input.history.slice(-12);

  const useAfterStability =
    input.goal === 'ABSTINENCE' &&
    currentUseStatus === 'POSITIVE' &&
    stabilityWindow.length ===
      SUBJECTIVE_MONITORING_V1.useAfterStabilityNegativePeriods &&
    windowIsAdjacent(stabilityWindow, input.periodStartAt) &&
    stabilityWindow.every((item) => item.goal === 'ABSTINENCE') &&
    stabilityWindow.every(
      (item) => item.authoritative && item.useStatus === 'NEGATIVE',
    );

  return {
    cravingDelta,
    confidenceDelta,
    negativeMoodDelta,
    riskScoreDelta,
    rawProtectionScoreDelta,
    recoveryProgressDelta,
    persistenceStreakSnapshot,
    clearanceReasonStateSnapshot,
    consecutiveUse,
    recurrentUse,
    recurrentUseObservedPeriods: recurrenceWindow.observedUsePeriods,
    useAfterStability,
    trendDataValid: deltasValid,
  };
}

function deriveUseStatus(answers: WeeklyAnswers) {
  const value = booleanAnswer(answers, 'U1');

  return value === null
    ? ('UNKNOWN' as const)
    : value
      ? ('POSITIVE' as const)
      : ('NEGATIVE' as const);
}

export function evaluateWeeklyAssessment(
  input: EvaluateWeeklyAssessmentInput,
): WeeklyEvaluationResult {
  const weeklyUseStatus = deriveUseStatus(input.answers);

  const flags = flagObservations(input.answers);

  const aggregate = calculateAggregate(input.answers, input.preferences);

  const longitudinal = evaluateLongitudinal(
    input,
    aggregate,
    weeklyUseStatus,
    flags,
  );

  const allClinicianReasons = new Set<
    | 'CRAVING_LOW_CONFIDENCE'
    | 'MOOD_CRAVING'
    | 'PERSISTENT_HIGH_CRAVING'
    | 'PERSISTENT_HIGH_NEGATIVE_MOOD'
    | 'CONSECUTIVE_USE'
    | 'RECURRENT_USE'
  >();

  const highCraving =
    flags.find((flag) => flag.flagKey === 'HIGH_CRAVING')?.state === 'ACTIVE';

  const highMood =
    flags.find((flag) => flag.flagKey === 'HIGH_NEGATIVE_MOOD')?.state ===
    'ACTIVE';

  const lowConfidence =
    flags.find((flag) => flag.flagKey === 'LOW_CONFIDENCE')?.state === 'ACTIVE';

  const currentCravingLowConfidence = combinedCondition(
    currentFlagValue('HIGH_CRAVING', input.answers),
    currentFlagValue('LOW_CONFIDENCE', input.answers),
  );

  const currentMoodCraving = combinedCondition(
    currentFlagValue('HIGH_NEGATIVE_MOOD', input.answers),
    currentFlagValue('HIGH_CRAVING', input.answers),
  );

  longitudinal.clearanceReasonStateSnapshot.CRAVING_LOW_CONFIDENCE =
    reasonLifecycleTransition(
      currentCravingLowConfidence,
      previousReasonState(input.history, 'CRAVING_LOW_CONFIDENCE'),
    );

  longitudinal.clearanceReasonStateSnapshot.MOOD_CRAVING =
    reasonLifecycleTransition(
      currentMoodCraving,
      previousReasonState(input.history, 'MOOD_CRAVING'),
    );

  longitudinal.clearanceReasonStateSnapshot.PERSISTENT_HIGH_CRAVING =
    reasonLifecycleTransition(
      currentPersistenceCondition(
        'HIGH_CRAVING',
        input.answers,
        input.history,
        input.periodStartAt,
      ),
      previousReasonState(input.history, 'PERSISTENT_HIGH_CRAVING'),
    );

  longitudinal.clearanceReasonStateSnapshot.PERSISTENT_HIGH_NEGATIVE_MOOD =
    reasonLifecycleTransition(
      currentPersistenceCondition(
        'HIGH_NEGATIVE_MOOD',
        input.answers,
        input.history,
        input.periodStartAt,
      ),
      previousReasonState(input.history, 'PERSISTENT_HIGH_NEGATIVE_MOOD'),
    );

  const previousConsecutiveReason = previousReasonState(
    input.history,
    'CONSECUTIVE_USE',
  );

  longitudinal.clearanceReasonStateSnapshot.CONSECUTIVE_USE =
    input.goal !== 'ABSTINENCE'
      ? {
          status: 'INACTIVE',
          clearanceCount: 0,
        }
      : reasonLifecycleTransition(
          recurrenceLifecycleCondition(
            weeklyUseStatus,
            currentConsecutiveUseCondition(
              weeklyUseStatus,
              input.goal,
              input.history,
              input.periodStartAt,
            ),
            previousConsecutiveReason,
          ),
          previousConsecutiveReason,
        );

  const previousRecurrentReason = previousReasonState(
    input.history,
    'RECURRENT_USE',
  );

  longitudinal.clearanceReasonStateSnapshot.RECURRENT_USE =
    input.goal !== 'ABSTINENCE'
      ? {
          status: 'INACTIVE',
          clearanceCount: 0,
        }
      : reasonLifecycleTransition(
          recurrenceLifecycleCondition(
            weeklyUseStatus,
            currentRecurrentUseCondition(
              weeklyUseStatus,
              input.goal,
              input.history,
              input.periodStartAt,
            ),
            previousRecurrentReason,
          ),
          previousRecurrentReason,
        );

  if (highCraving && lowConfidence) {
    allClinicianReasons.add('CRAVING_LOW_CONFIDENCE');
  }

  if (highMood && highCraving) {
    allClinicianReasons.add('MOOD_CRAVING');
  }

  if (
    longitudinal.persistenceStreakSnapshot.HIGH_CRAVING ===
    SUBJECTIVE_MONITORING_V1.persistence.N_PERSIST
  ) {
    allClinicianReasons.add('PERSISTENT_HIGH_CRAVING');
  }

  if (
    longitudinal.persistenceStreakSnapshot.HIGH_NEGATIVE_MOOD ===
    SUBJECTIVE_MONITORING_V1.persistence.N_PERSIST
  ) {
    allClinicianReasons.add('PERSISTENT_HIGH_NEGATIVE_MOOD');
  }

  if (
    longitudinal.clearanceReasonStateSnapshot.CONSECUTIVE_USE?.status ===
    'ACTIVE'
  ) {
    allClinicianReasons.add('CONSECUTIVE_USE');
  }

  if (
    longitudinal.clearanceReasonStateSnapshot.RECURRENT_USE?.status === 'ACTIVE'
  ) {
    allClinicianReasons.add('RECURRENT_USE');
  }

  const clinicianReasons = new Set(
    input.completionStatus === 'PARTIAL'
      ? [...allClinicianReasons].filter(
          (reason) =>
            reason === 'CONSECUTIVE_USE' || reason === 'RECURRENT_USE',
        )
      : [...allClinicianReasons],
  );

  const previous = previousAdjacent(input.history, input.periodStartAt);

  const candidatePatientInterventions = resolveCandidates(
    input,
    flags,
    [...clinicianReasons],
    aggregate,
    longitudinal,
    previous,
  );

  const effectPlan: EffectPlan = {
    trigger: input.trigger,
    candidatePatientInterventions,
    candidateClinicianReasonFamilies: [...clinicianReasons],
    candidateClinicianReasons: [...clinicianReasons].map((reasonFamily) => {
      const triggerSuppressed =
        input.trigger === 'ADMINISTRATIVE_RECOMPUTE' ||
        input.trigger === 'POLICY_MIGRATION';

      return {
        reasonFamily,
        effect:
          input.effectScope === 'HISTORICAL'
            ? 'HISTORICAL_ONLY'
            : triggerSuppressed
              ? 'SUPPRESSED_TRIGGER'
              : 'ELIGIBLE',
        suppressionReason:
          input.effectScope === 'HISTORICAL'
            ? 'HISTORICAL_EFFECT_SCOPE'
            : triggerSuppressed
              ? input.trigger
              : null,
      };
    }),
    suppressedEffects: candidatePatientInterventions
      .filter((candidate) => candidate.effect !== 'ELIGIBLE')
      .map((candidate) => ({
        interventionClass: candidate.interventionClass,
        reason: candidate.suppressionReason ?? 'SUPPRESSED',
      })),
  };

  return {
    weeklyUseStatus,
    flags,
    aggregate,
    longitudinal,
    candidateClinicianReasonFamilies: [...clinicianReasons],
    candidatePatientInterventions,
    effectPlan,
    consumption: input.consumption,
    derivedStateChanges: {
      flags,
      aggregate,
      longitudinal,
      candidateClinicianReasonFamilies: [...clinicianReasons],
      candidatePatientInterventions,
    },
  };
}
