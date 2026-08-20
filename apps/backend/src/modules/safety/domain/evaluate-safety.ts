import type {
  SafetyGateStatus,
  SafetyInput,
  SafetyOwnerRole,
  SafetySeverity,
} from '@aud-subjective/contracts';

import {
  SAFETY_CONFIGURATION_VERSION,
  SAFETY_EVALUATOR_VERSION,
} from './policy.js';
import { plannedMajorReduction, recentReduction } from './predicates.js';
import {
  REASON_POLICY,
  SAFETY_REASON_CODES,
  type SafetyDomain,
  type SafetyReasonCode,
} from './reasons.js';

export type SafetyContext = {
  now: Date;
  timezone: string;
  plannedDirection: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE';
  targetWeeklyDrinks?: number;
  baselineAverageWeeklyDrinks?: number;
  canonicalProlongedHeavyRegularUse?: boolean;
  ageOver65?: boolean;
};

export type SafetyDomainResult = {
  domain: SafetyDomain;
  severity: Exclude<SafetySeverity, 'S_NONE'>;
  gateStatus: Exclude<SafetyGateStatus, 'NOT_ASSESSED'>;
  ownerRole: SafetyOwnerRole;
  reasonCodes: SafetyReasonCode[];
};

export type SafetyResult = {
  severity: SafetySeverity;
  gateStatus: SafetyGateStatus;
  reasonCodes: SafetyReasonCode[];
  domainResults: SafetyDomainResult[];
  clinicianContext: boolean;
  goalChangeAllowed: boolean;
  monitoringPromptPolicy: 'CONTINUE' | 'PAUSE';
  allowedSubjectiveInterventions: string[];
  evaluatorVersion: string;
  configurationVersion: string;
};

function gateForSeverity(
  severity: Exclude<SafetySeverity, 'S_NONE'>,
): Exclude<SafetyGateStatus, 'NOT_ASSESSED'> {
  if (severity === 'S0_EMERGENCY' || severity === 'S1_URGENT') {
    return 'BLOCK_AND_HANDOFF';
  }
  if (severity === 'S2_PRIORITY') return 'ALLOW_WITH_HANDOFF';
  return 'ALLOW_MONITORING';
}

export function evaluateSafety(i: SafetyInput, c: SafetyContext): SafetyResult {
  const rr = recentReduction(i, c);
  const planned = plannedMajorReduction(c);

  const seriousMedicalFromStructuredContext = i.seriousMedicalContexts.some(
    (context) => context !== 'CLINICIAN_DIRECTED_SAFETY_REVIEW',
  );
  const seriousMedicalCondition =
    i.seriousMedicalCondition === true || seriousMedicalFromStructuredContext;

  const structuredOpioidOrSedativeUse =
    i.dailyOrNearDailySedativeOrOpioidUse === 'YES' ||
    i.otherSubstanceCategories.some((category) =>
      [
        'OPIOIDS',
        'BENZODIAZEPINES',
        'BARBITURATES',
        'OTHER_SEDATIVES_OR_SLEEP_MEDICINES',
      ].includes(category),
    );
  const currentOpioidOrSedativeUse =
    i.currentOpioidOrSedativeUse === true || structuredOpioidOrSedativeUse;

  const structuredOtherSubstanceUse = i.otherSubstanceCategories.some(
    (category) => !['NONE', 'PREFER_NOT_TO_SAY'].includes(category),
  );
  const otherSubstanceUse =
    i.otherSubstanceUse === true || structuredOtherSubstanceUse;

  const symptoms = new Set(i.currentWithdrawalSymptoms);
  const nonEmergencySymptoms = [...symptoms].filter(
    (symptom) => symptom !== 'HALLUCINATIONS',
  );
  const nonEmergencyCount = nonEmergencySymptoms.length;

  const majorRiskFactorCount = [
    c.ageOver65 === true,
    i.priorWithdrawals === 'THREE_OR_MORE',
    c.canonicalProlongedHeavyRegularUse === true,
    i.sedativeDependence === 'YES',
    seriousMedicalCondition,
    currentOpioidOrSedativeUse,
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
    (rr && nonEmergencyCount >= 2) ||
    (rr && majorRiskFactorCount >= 2) ||
    (symptoms.size > 0 &&
      (currentOpioidOrSedativeUse || i.sedativeDependence === 'YES'));

  const s2 =
    [i.cssrs.item1, i.cssrs.item2, i.cssrs.item3].some(
      (value) => value === 'YES',
    ) ||
    (rr && nonEmergencyCount === 1) ||
    (rr && majorRiskFactorCount === 1) ||
    (c.canonicalProlongedHeavyRegularUse === true && planned) ||
    i.previousWithdrawalSeizure === 'UNSURE' ||
    i.previousWithdrawalDelirium === 'UNSURE' ||
    (i.sedativeDependence === 'UNSURE' && planned) ||
    (['PREGNANT', 'POSSIBLY_PREGNANT'].includes(i.pregnancy) &&
      i.currentAlcoholUse) ||
    (seriousMedicalCondition && planned) ||
    (!rr &&
      !planned &&
      (i.previousWithdrawalSeizure === 'YES' ||
        i.previousWithdrawalDelirium === 'YES'));

  const clinicianDirectedReview =
    i.clinicianDirectedReview ||
    i.seriousMedicalContexts.includes('CLINICIAN_DIRECTED_SAFETY_REVIEW');
  const s3 =
    otherSubstanceUse || i.stableMedicalCondition || clinicianDirectedReview;

  const severity: SafetySeverity = s0
    ? 'S0_EMERGENCY'
    : s1
      ? 'S1_URGENT'
      : s2
        ? 'S2_PRIORITY'
        : s3
          ? 'S3_ROUTINE'
          : 'S_NONE';

  const gateStatus: SafetyGateStatus =
    s0 || s1
      ? 'BLOCK_AND_HANDOFF'
      : s2
        ? 'ALLOW_WITH_HANDOFF'
        : 'ALLOW_MONITORING';

  const triggered = new Set<SafetyReasonCode>();
  const add = (condition: boolean, reason: SafetyReasonCode) => {
    if (condition) triggered.add(reason);
  };

  add(i.currentSeizure, 'CURRENT_SEIZURE');
  add(i.severeConfusionOrDisorientation, 'SEVERE_CONFUSION_OR_DISORIENTATION');
  add(
    i.hallucinations && i.hallucinationDisorientation,
    'HALLUCINATIONS_WITH_DISORIENTATION',
  );
  add(i.difficultyRemainingConscious, 'DIFFICULTY_REMAINING_CONSCIOUS');
  add(i.breathingDifficulty, 'BREATHING_DIFFICULTY');
  add(
    i.repeatedVomitingWithSevereIllness,
    'REPEATED_VOMITING_WITH_SEVERE_ILLNESS',
  );
  add(i.currentSuicideAttempt, 'CURRENT_SUICIDE_ATTEMPT');
  add(i.currentSelfHarmMedicalEmergency, 'CURRENT_SELF_HARM_MEDICAL_EMERGENCY');
  add(
    i.immediateSuicidePlanAndIntent,
    'EXPLICIT_IMMEDIATE_SUICIDE_PLAN_AND_INTENT_TO_ACT_NOW',
  );

  add(i.cssrs.item4 === 'YES', 'CSSRS_ITEM_4_POSITIVE');
  add(i.cssrs.item5 === 'YES', 'CSSRS_ITEM_5_POSITIVE');
  add(
    i.cssrs.suicidalBehaviorPrevious3Months === 'YES',
    'SUICIDAL_BEHAVIOR_PREVIOUS_3_MONTHS',
  );
  add(
    i.hallucinations && rr && !i.hallucinationDisorientation,
    'HALLUCINATIONS_AFTER_RECENT_REDUCTION',
  );
  add(
    (i.previousWithdrawalSeizure === 'YES' ||
      i.previousWithdrawalDelirium === 'YES') &&
      (rr || planned),
    'PRIOR_WITHDRAWAL_SEIZURE_OR_DELIRIUM_WITH_RECENT_OR_PLANNED_MAJOR_REDUCTION',
  );
  add(
    rr && nonEmergencyCount >= 2,
    'RECENT_REDUCTION_TWO_OR_MORE_WITHDRAWAL_SYMPTOMS',
  );
  add(
    rr && majorRiskFactorCount >= 2,
    'RECENT_REDUCTION_TWO_OR_MORE_MAJOR_WITHDRAWAL_RISK_FACTORS',
  );
  add(
    symptoms.size > 0 &&
      (currentOpioidOrSedativeUse || i.sedativeDependence === 'YES'),
    'WITHDRAWAL_SYMPTOMS_WITH_OPIOID_OR_SEDATIVE_CONTEXT',
  );

  add(
    [i.cssrs.item1, i.cssrs.item2, i.cssrs.item3].some(
      (value) => value === 'YES',
    ) &&
      i.cssrs.item4 !== 'YES' &&
      i.cssrs.item5 !== 'YES',
    'CSSRS_ITEMS_1_TO_3_POSITIVE_WITHOUT_4_5',
  );
  add(rr && nonEmergencyCount === 1, 'RECENT_REDUCTION_ONE_WITHDRAWAL_SYMPTOM');
  add(
    rr && majorRiskFactorCount === 1,
    'RECENT_REDUCTION_ONE_MAJOR_RISK_FACTOR',
  );
  add(
    c.canonicalProlongedHeavyRegularUse === true && planned,
    'PROLONGED_HEAVY_REGULAR_USE_WITH_PLANNED_MAJOR_REDUCTION',
  );
  add(
    i.previousWithdrawalSeizure === 'UNSURE' ||
      i.previousWithdrawalDelirium === 'UNSURE',
    'PRIOR_WITHDRAWAL_HISTORY_UNSURE',
  );
  add(
    i.sedativeDependence === 'UNSURE' && planned,
    'SEDATIVE_DEPENDENCE_UNSURE_DURING_PLANNED_REDUCTION',
  );
  add(
    ['PREGNANT', 'POSSIBLY_PREGNANT'].includes(i.pregnancy) &&
      i.currentAlcoholUse,
    'PREGNANT_OR_POSSIBLY_PREGNANT_WITH_CURRENT_ALCOHOL_USE',
  );
  add(
    seriousMedicalCondition && planned,
    'SERIOUS_MEDICAL_CONDITION_WITH_PLANNED_MAJOR_REDUCTION',
  );
  add(
    !rr &&
      !planned &&
      (i.previousWithdrawalSeizure === 'YES' ||
        i.previousWithdrawalDelirium === 'YES'),
    'PRIOR_WITHDRAWAL_SEIZURE_OR_DELIRIUM_WITHOUT_CURRENT_REDUCTION',
  );

  add(otherSubstanceUse, 'OTHER_SUBSTANCE_USE_WITHOUT_ACUTE_INTERACTION');
  add(i.stableMedicalCondition, 'STABLE_MEDICAL_CONDITION');
  add(clinicianDirectedReview, 'CLINICIAN_DIRECTED_SAFETY_REVIEW');

  const reasonCodes = SAFETY_REASON_CODES.filter((reason) =>
    triggered.has(reason),
  );

  const severityRank: Record<Exclude<SafetySeverity, 'S_NONE'>, number> = {
    S0_EMERGENCY: 0,
    S1_URGENT: 1,
    S2_PRIORITY: 2,
    S3_ROUTINE: 3,
  };
  const grouped = new Map<SafetyDomain, SafetyDomainResult>();

  for (const reason of reasonCodes) {
    const policy = REASON_POLICY[reason];
    const current = grouped.get(policy.domain);
    if (!current) {
      grouped.set(policy.domain, {
        domain: policy.domain,
        severity: policy.severity,
        gateStatus: gateForSeverity(policy.severity),
        ownerRole: policy.ownerRole,
        reasonCodes: [reason],
      });
      continue;
    }

    current.reasonCodes.push(reason);
    if (severityRank[policy.severity] < severityRank[current.severity]) {
      current.severity = policy.severity;
      current.gateStatus = gateForSeverity(policy.severity);
      current.ownerRole = policy.ownerRole;
    }
  }

  return {
    severity,
    gateStatus,
    reasonCodes,
    domainResults: [...grouped.values()],
    clinicianContext: s0 || s1 || s2 || s3,
    goalChangeAllowed: gateStatus === 'ALLOW_MONITORING',
    monitoringPromptPolicy:
      gateStatus === 'BLOCK_AND_HANDOFF' ? 'PAUSE' : 'CONTINUE',
    allowedSubjectiveInterventions: [],
    evaluatorVersion: SAFETY_EVALUATOR_VERSION,
    configurationVersion: SAFETY_CONFIGURATION_VERSION,
  };
}
