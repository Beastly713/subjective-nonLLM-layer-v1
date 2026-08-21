import type {
  AssessmentEvaluationTrigger,
  ClinicianReasonEffect,
  ClinicalReasonFamily,
  CurrentStateFlagState,
  PatientInterventionIntentEffect,
  StateFlagObservationState,
  UseObservationStatus,
} from '@aud-subjective/contracts';

export type WeeklyAnswers = Partial<{
  U1: boolean;
  R1: number;
  R2: number;
  R3: number;
  R4: number;
  R5: number;
  P1: number;
  P2: number;
  P3: number;
  P4: number;
  P5: number;
}>;

export type MonitoringPreferenceContext = {
  mutualHelpPreference:
    | 'NONE'
    | 'AA_12_STEP'
    | 'ALTERNATIVE'
    | 'UNSURE'
    | 'PREFER_NOT_TO_SAY'
    | null;

  spiritualContentPreference: 'ALLOW' | 'DO_NOT_ALLOW' | 'UNSURE' | null;
};

export type ReductionWeeklySummaryInput = {
  observedDayCount: number;
  unknownDayCount: number;
  coverageRatio: number;
  knownStandardDrinksTotal: number;
  completeWeekTotalStandardDrinks: number | null;
  completeWeekEthanolGrams: number | null;
  drinkingDays: number;
  alcoholFreeDays: number | null;
  averageDrinksPerDrinkingDay: number | null;
  maximumDailyStandardDrinks: number | null;
  heavyDrinkingDays: number;
  targetWeeklyStandardDrinks: number | null;
  targetStatus: 'MET' | 'NOT_MET' | 'UNRESOLVED';
  baselineAverageWeeklyDrinks: number | null;
  reductionFromBaselinePercent: number | null;
  whoWindowComplete: boolean;
  whoRiskRank: number | null;
  whoRiskRankChange: number | null;
  whoTwoLevelReduction: boolean | null;

  days?:
    | Array<{
        localDate: string;
        status: 'KNOWN_ZERO' | 'KNOWN_QUANTITY' | 'UNKNOWN';
        standardDrinks: number | null;
        ethanolGrams: number | null;
      }>
    | undefined;
};

export type HistoricalWeeklyObservation = {
  periodId: string;
  periodStartAt: Date;
  periodEndAt: Date;
  authoritative: boolean;

  completionStatus: 'PARTIAL' | 'COMPLETE' | null;

  goal: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE' | null;

  goalVersionId: string | null;
  preferenceVersionId: string | null;

  preferences: MonitoringPreferenceContext | null;

  answers: WeeklyAnswers | null;

  useStatus: UseObservationStatus;

  riskScore: number | null;
  rawProtectionScore: number | null;
  recoveryProgress: number | null;

  consumption: ReductionWeeklySummaryInput | null;

  reasonLifecycle?: Record<string, ReasonLifecycleSnapshot>;

  persistenceStreakSnapshot?: Record<string, number>;
};

export type EvaluationSafetyContext = {
  safetyState:
    | 'NOT_ASSESSED'
    | 'MONITORING_AVAILABLE'
    | 'ROUTINE_CONTEXT'
    | 'REVIEW_REQUIRED'
    | 'HANDOFF_REQUIRED';

  requiresSafetyShell: boolean;

  monitoringPromptPolicy: 'CONTINUE' | 'PAUSE';

  allowedSubjectiveInterventions: readonly string[];

  reassessmentDueAt: Date | null;
};

export type EvaluateWeeklyAssessmentInput = {
  patientId: string;
  assessmentId: string;
  revisionId: string;
  periodId: string;

  periodStartAt: Date;
  periodEndAt: Date;
  evaluatedAt: Date;

  trigger: AssessmentEvaluationTrigger;

  completionStatus: 'PARTIAL' | 'COMPLETE';

  goalVersionId: string | null;
  preferenceVersionId: string | null;

  effectScope: 'CURRENT' | 'HISTORICAL';

  goal: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE';

  targetWeeklyStandardDrinks: number | null;

  baselineAverageWeeklyDrinks: number | null;

  preferences: MonitoringPreferenceContext;

  answers: WeeklyAnswers;

  history: readonly HistoricalWeeklyObservation[];

  consumption: ReductionWeeklySummaryInput | null;

  safety: EvaluationSafetyContext;
};

export type FlagKey =
  | 'HIGH_CRAVING'
  | 'HIGH_NEGATIVE_MOOD'
  | 'HIGH_RISKY_SITUATIONS'
  | 'HIGH_RELATIONSHIP_PROBLEMS'
  | 'LOW_CONFIDENCE'
  | 'LOW_SOCIAL_SUPPORT'
  | 'USE_POSITIVE_CURRENT';

export type FlagObservation = {
  flagKey: FlagKey;
  state: StateFlagObservationState;
  value: boolean | null;
};

export type AggregateContext = {
  riskScore: number | null;
  rawProtectionScore: number | null;
  recoveryProgress: number | null;

  riskTag: 'HIGH_RISK' | 'NOT_HIGH' | null;

  protectionTag:
    'WEAK_PROTECTION' | 'INTERMEDIATE_PROTECTION' | 'STRONG_PROTECTION' | null;

  operationalProtectionDomainsObserved: number;

  operationalProtectionDomainsTotal: 5;

  protectionCoverageRatio: number | null;

  minimumPossibleProtection: number | null;

  maximumPossibleProtection: number | null;

  interactionTags: string[];
};

export type ReasonLifecycleSnapshot = {
  status: 'INACTIVE' | 'ACTIVE' | 'CLEARANCE_PENDING' | 'RESOLVED';

  clearanceCount: number;
};

export type LongitudinalFeatures = {
  cravingDelta: number | null;
  confidenceDelta: number | null;
  negativeMoodDelta: number | null;
  riskScoreDelta: number | null;
  rawProtectionScoreDelta: number | null;
  recoveryProgressDelta: number | null;

  persistenceStreakSnapshot: Record<string, number>;

  clearanceReasonStateSnapshot: Record<string, ReasonLifecycleSnapshot>;

  consecutiveUse: boolean;
  recurrentUse: boolean;

  recurrentUseObservedPeriods: number;

  useAfterStability: boolean;

  trendDataValid: boolean;
};

export type CandidatePatientIntervention = {
  interventionClass:
    | 'CRAVING_COPING_SUPPORT'
    | 'SELF_EFFICACY_SUPPORT'
    | 'MOOD_COPING_SUPPORT'
    | 'TRIGGER_MANAGEMENT_SUPPORT'
    | 'RELATIONSHIP_COPING_SUPPORT'
    | 'SOCIAL_SUPPORT_ACTIVATION'
    | 'USE_EVENT_RECOVERY_SUPPORT'
    | 'RECURRENT_USE_RECOVERY_SUPPORT'
    | 'RECOVERY_PLAN_REVIEW'
    | 'POSITIVE_REINFORCEMENT';

  sourceReasons: string[];

  resolverPriority: number;

  effect: PatientInterventionIntentEffect;

  suppressionReason: string | null;
};

export type EffectPlan = {
  trigger: AssessmentEvaluationTrigger;

  candidatePatientInterventions: CandidatePatientIntervention[];

  candidateClinicianReasonFamilies: ClinicalReasonFamily[];

  candidateClinicianReasons: Array<{
    reasonFamily: ClinicalReasonFamily;
    effect: ClinicianReasonEffect;
    suppressionReason: string | null;
  }>;

  suppressedEffects: Array<{
    interventionClass: CandidatePatientIntervention['interventionClass'];
    reason: string;
  }>;
};

export type WeeklyEvaluationResult = {
  weeklyUseStatus: UseObservationStatus;

  flags: FlagObservation[];

  aggregate: AggregateContext;

  longitudinal: LongitudinalFeatures;

  candidateClinicianReasonFamilies: ClinicalReasonFamily[];

  candidatePatientInterventions: CandidatePatientIntervention[];

  effectPlan: EffectPlan;

  consumption: ReductionWeeklySummaryInput | null;

  derivedStateChanges: {
    flags: FlagObservation[];
    aggregate: AggregateContext;
    longitudinal: LongitudinalFeatures;

    candidateClinicianReasonFamilies: ClinicalReasonFamily[];

    candidatePatientInterventions: CandidatePatientIntervention[];
  };
};

export type PersistedCurrentFlag = {
  flagKey: FlagKey;
  state: CurrentStateFlagState;
};
