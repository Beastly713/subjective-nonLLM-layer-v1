import type {
  SafetyGateStatus,
  SafetyInput,
  SafetySeverity,
} from '@aud-subjective/contracts';
import { plannedMajorReduction, recentReduction } from './predicates.js';
import type { SafetyReasonCode } from './reasons.js';

export type SafetyContext = {
  now: Date;
  timezone: string;
  plannedDirection: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE';
  targetWeeklyDrinks?: number;
  baselineAverageWeeklyDrinks?: number;
  prolongedHeavyRegularUse?: boolean | undefined;
  ageOver65?: boolean | undefined;
};
export type SafetyResult = {
  severity: SafetySeverity;
  gateStatus: SafetyGateStatus;
  reasonCodes: SafetyReasonCode[];
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
  const reasonCodes: SafetyReasonCode[] = [];
  const add = (condition: boolean, reason: SafetyReasonCode) => { if (condition) reasonCodes.push(reason); };
  add(i.currentSeizure, 'CURRENT_SEIZURE'); add(i.severeConfusionOrDisorientation, 'SEVERE_CONFUSION_OR_DISORIENTATION'); add(i.hallucinations && i.hallucinationDisorientation, 'HALLUCINATIONS_WITH_DISORIENTATION'); add(i.difficultyRemainingConscious, 'DIFFICULTY_REMAINING_CONSCIOUS'); add(i.breathingDifficulty, 'BREATHING_DIFFICULTY'); add(i.repeatedVomitingWithSevereIllness, 'REPEATED_VOMITING_WITH_SEVERE_ILLNESS'); add(i.currentSuicideAttempt, 'CURRENT_SUICIDE_ATTEMPT'); add(i.currentSelfHarmMedicalEmergency, 'CURRENT_SELF_HARM_MEDICAL_EMERGENCY'); add(i.immediateSuicidePlanAndIntent, 'EXPLICIT_IMMEDIATE_SUICIDE_PLAN_AND_INTENT_TO_ACT_NOW');
  add(i.cssrs.item4 === 'YES', 'CSSRS_ITEM_4_POSITIVE'); add(i.cssrs.item5 === 'YES', 'CSSRS_ITEM_5_POSITIVE'); add(i.cssrs.suicidalBehaviorPrevious3Months === 'YES', 'SUICIDAL_BEHAVIOR_PREVIOUS_3_MONTHS'); add(i.hallucinations && rr && !i.hallucinationDisorientation, 'HALLUCINATIONS_AFTER_RECENT_REDUCTION'); add((i.previousWithdrawalSeizure === 'YES' || i.previousWithdrawalDelirium === 'YES') && (rr || planned), 'PRIOR_WITHDRAWAL_SEIZURE_OR_DELIRIUM_WITH_RECENT_OR_PLANNED_MAJOR_REDUCTION'); add(rr && nonEmergency >= 2, 'RECENT_REDUCTION_TWO_OR_MORE_WITHDRAWAL_SYMPTOMS'); add(rr && major >= 2, 'RECENT_REDUCTION_TWO_OR_MORE_MAJOR_WITHDRAWAL_RISK_FACTORS'); add(i.currentWithdrawalSymptoms.length > 0 && (i.currentOpioidOrSedativeUse || i.sedativeDependence === 'YES'), 'WITHDRAWAL_SYMPTOMS_WITH_OPIOID_OR_SEDATIVE_CONTEXT');
  add([i.cssrs.item1, i.cssrs.item2, i.cssrs.item3].some((x) => x === 'YES') && i.cssrs.item4 !== 'YES' && i.cssrs.item5 !== 'YES', 'CSSRS_ITEMS_1_TO_3_POSITIVE_WITHOUT_4_5'); add(rr && nonEmergency === 1, 'RECENT_REDUCTION_ONE_WITHDRAWAL_SYMPTOM'); add(rr && major === 1, 'RECENT_REDUCTION_ONE_MAJOR_RISK_FACTOR'); add(!!c.prolongedHeavyRegularUse && planned, 'PROLONGED_HEAVY_REGULAR_USE_WITH_PLANNED_MAJOR_REDUCTION'); add(i.previousWithdrawalSeizure === 'UNSURE' || i.previousWithdrawalDelirium === 'UNSURE', 'PRIOR_WITHDRAWAL_HISTORY_UNSURE'); add(i.sedativeDependence === 'UNSURE' && planned, 'SEDATIVE_DEPENDENCE_UNSURE_DURING_PLANNED_REDUCTION'); add(['PREGNANT', 'POSSIBLY_PREGNANT'].includes(i.pregnancy) && i.currentAlcoholUse, 'PREGNANT_OR_POSSIBLY_PREGNANT_WITH_CURRENT_ALCOHOL_USE'); add(i.seriousMedicalCondition && planned, 'SERIOUS_MEDICAL_CONDITION_WITH_PLANNED_MAJOR_REDUCTION'); add(!rr && !planned && (i.previousWithdrawalSeizure === 'YES' || i.previousWithdrawalDelirium === 'YES'), 'PRIOR_WITHDRAWAL_SEIZURE_OR_DELIRIUM_WITHOUT_CURRENT_REDUCTION');
  add(i.otherSubstanceUse, 'OTHER_SUBSTANCE_USE_WITHOUT_ACUTE_INTERACTION'); add(i.stableMedicalCondition, 'STABLE_MEDICAL_CONDITION'); add(i.clinicianDirectedReview, 'CLINICIAN_DIRECTED_SAFETY_REVIEW');
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
