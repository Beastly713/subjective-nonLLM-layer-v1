import type {
  SafetyGateStatus,
  SafetyInput,
  SafetySeverity,
} from '@aud-subjective/contracts';
import { plannedMajorReduction, recentReduction } from './predicates.js';

export type SafetyContext = {
  now: Date;
  timezone: string;
  plannedDirection: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE';
  targetWeeklyDrinks?: number;
  baselineAverageWeeklyDrinks?: number;
  prolongedHeavyRegularUse?: boolean;
  ageOver65?: boolean;
};
export type SafetyResult = {
  severity: SafetySeverity;
  gateStatus: SafetyGateStatus;
  reasonCodes: string[];
  clinicianContext: boolean;
  goalChangeAllowed: boolean;
  monitoringPromptPolicy: 'CONTINUE' | 'PAUSE';
  allowedSubjectiveInterventions: string[];
};

export function evaluateSafety(i: SafetyInput, c: SafetyContext): SafetyResult {
  const rr = recentReduction(i, c), planned = plannedMajorReduction(c);
  const nonEmergency = i.currentWithdrawalSymptoms.filter(
    (x) => !['HALLUCINATIONS'].includes(x),
  ).length;
  const major = [
    c.ageOver65,
    i.priorWithdrawals === 'THREE_OR_MORE',
    c.prolongedHeavyRegularUse,
    i.sedativeDependence === 'YES',
    i.seriousMedicalCondition,
    i.currentOpioidOrSedativeUse,
  ].filter(Boolean).length;
  const s0 =
    i.currentSeizure ||
    i.severeConfusionOrDisorientation ||
    (i.hallucinations && i.hallucinationDisorientation) ||
    i.difficultyRemainingConscious ||
    i.breathingDifficulty ||
    i.repeatedVomitingWithSevereIllness ||
    i.currentSuicideAttempt ||
    i.currentSelfHarmMedicalEmergency ||
    i.immediateSuicidePlanAndIntent;
  const s1 =
    i.cssrs.item4 === 'YES' ||
    i.cssrs.item5 === 'YES' ||
    i.cssrs.suicidalBehaviorPrevious3Months === 'YES' ||
    (i.hallucinations && rr && !i.hallucinationDisorientation) ||
    ((i.previousWithdrawalSeizure === 'YES' ||
      i.previousWithdrawalDelirium === 'YES') &&
      (rr || planned)) ||
    (rr && nonEmergency >= 2) ||
    (rr && major >= 2) ||
    (i.currentWithdrawalSymptoms.length > 0 &&
      (i.currentOpioidOrSedativeUse || i.sedativeDependence === 'YES'));
  const s2 =
    [i.cssrs.item1, i.cssrs.item2, i.cssrs.item3].some((x) => x === 'YES') ||
    (rr && nonEmergency === 1) ||
    (rr && major === 1) ||
    (!!c.prolongedHeavyRegularUse && planned) ||
    i.previousWithdrawalSeizure === 'UNSURE' ||
    i.previousWithdrawalDelirium === 'UNSURE' ||
    (i.sedativeDependence === 'UNSURE' && planned) ||
    (['PREGNANT', 'POSSIBLY_PREGNANT'].includes(i.pregnancy) &&
      i.currentAlcoholUse) ||
    (i.seriousMedicalCondition && planned) ||
    (!rr &&
      !planned &&
      (i.previousWithdrawalSeizure === 'YES' ||
        i.previousWithdrawalDelirium === 'YES'));
  const s3 =
    i.otherSubstanceUse ||
    i.stableMedicalCondition ||
    i.clinicianDirectedReview;
  const severity = s0
    ? 'S0_EMERGENCY'
    : s1
      ? 'S1_URGENT'
      : s2
        ? 'S2_PRIORITY'
        : s3
          ? 'S3_ROUTINE'
          : 'S_NONE';
  const gateStatus =
    s0 || s1
      ? 'BLOCK_AND_HANDOFF'
      : s2
        ? 'ALLOW_WITH_HANDOFF'
        : 'ALLOW_MONITORING';
  const reasonCodes = [
    s0 && (i.currentSeizure ? 'CURRENT_SEIZURE' : i.severeConfusionOrDisorientation ? 'SEVERE_CONFUSION_OR_DISORIENTATION' : i.hallucinations && i.hallucinationDisorientation ? 'HALLUCINATIONS_WITH_DISORIENTATION' : i.immediateSuicidePlanAndIntent ? 'EXPLICIT_IMMEDIATE_SUICIDE_PLAN_AND_INTENT' : 'S0_EMERGENCY_CONDITION'),
    s1 && (i.cssrs.item4 === 'YES' ? 'CSSRS_ITEM_4_POSITIVE' : i.cssrs.item5 === 'YES' ? 'CSSRS_ITEM_5_POSITIVE' : rr && nonEmergency >= 2 ? 'RECENT_REDUCTION_TWO_WITHDRAWAL_SYMPTOMS' : rr && major >= 2 ? 'RECENT_REDUCTION_TWO_MAJOR_RISK_FACTORS' : 'S1_URGENT_CONDITION'),
    s2 && ([i.cssrs.item1, i.cssrs.item2, i.cssrs.item3].some((x) => x === 'YES') ? 'CSSRS_ITEMS_1_3_POSITIVE' : rr && nonEmergency === 1 ? 'RECENT_REDUCTION_ONE_WITHDRAWAL_SYMPTOM' : 'S2_PRIORITY_CONDITION'),
    s3 && 'ROUTINE_CONTEXT',
  ].filter(Boolean) as string[];
  return {
    severity,
    gateStatus,
    reasonCodes,
    clinicianContext: s3 || s2 || s1 || s0,
    goalChangeAllowed: gateStatus === 'ALLOW_MONITORING',
    monitoringPromptPolicy:
      gateStatus === 'BLOCK_AND_HANDOFF' ? 'PAUSE' : 'CONTINUE',
    allowedSubjectiveInterventions:
      gateStatus === 'ALLOW_MONITORING' ? ['MEASUREMENT'] : [],
  };
}
