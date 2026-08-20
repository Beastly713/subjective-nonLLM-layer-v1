import { describe, expect, it } from 'vitest';

import { SafetyInputSchema, type SafetyInput } from '@aud-subjective/contracts';
import {
  evaluateSafety,
  type SafetyContext,
} from '../../src/modules/safety/domain/evaluate-safety.js';

const baseCssrs = {
  item1: 'NO',
  item2: 'NO',
  item3: 'NO',
  item4: 'NO',
  item5: 'NO',
  suicidalBehaviorPrevious3Months: 'NO',
} as const;

function input(overrides: Partial<SafetyInput> = {}) {
  return SafetyInputSchema.parse({
    currentSeizure: false,
    severeConfusionOrDisorientation: false,
    hallucinations: false,
    hallucinationDisorientation: false,
    difficultyRemainingConscious: false,
    breathingDifficulty: false,
    repeatedVomitingWithSevereIllness: false,
    currentSuicideAttempt: false,
    currentSelfHarmMedicalEmergency: false,
    immediateSuicidePlanAndIntent: false,
    previousWithdrawalSeizure: 'NO',
    previousWithdrawalDelirium: 'NO',
    priorWithdrawals: '0',
    similarHeavyRegularUseAtLeast3Months: 'NO',
    ageOver65: 'NO',
    reductionStartedAt: null,
    reductionPercent: null,
    cessation: false,
    currentWithdrawalSymptoms: [],
    sedativeDependence: 'NO',
    cssrs: baseCssrs,
    pregnancy: 'NO',
    currentAlcoholUse: false,
    otherSubstanceCategories: ['NONE'],
    dailyOrNearDailySedativeOrOpioidUse: 'NO',
    priorSedativeOrOpioidWithdrawalSymptoms: 'NO',
    seriousMedicalContexts: [],
    stableMedicalCondition: false,
    clinicianDirectedReview: false,
    ...overrides,
  });
}

const context: SafetyContext = {
  now: new Date('2026-08-20T12:00:00.000Z'),
  timezone: 'UTC',
  plannedDirection: 'UNSURE',
};

function recent(overrides: Partial<SafetyInput> = {}) {
  return input({
    reductionStartedAt: '2026-08-19T12:00:00.000Z',
    reductionPercent: 50,
    ...overrides,
  });
}

describe('deterministic safety evaluator', () => {
  it.each([
    ['CURRENT_SEIZURE', { currentSeizure: true }],
    [
      'SEVERE_CONFUSION_OR_DISORIENTATION',
      { severeConfusionOrDisorientation: true },
    ],
    [
      'HALLUCINATIONS_WITH_DISORIENTATION',
      { hallucinations: true, hallucinationDisorientation: true },
    ],
    ['DIFFICULTY_REMAINING_CONSCIOUS', { difficultyRemainingConscious: true }],
    ['BREATHING_DIFFICULTY', { breathingDifficulty: true }],
    [
      'REPEATED_VOMITING_WITH_SEVERE_ILLNESS',
      { repeatedVomitingWithSevereIllness: true },
    ],
    ['CURRENT_SUICIDE_ATTEMPT', { currentSuicideAttempt: true }],
    [
      'CURRENT_SELF_HARM_MEDICAL_EMERGENCY',
      { currentSelfHarmMedicalEmergency: true },
    ],
    [
      'EXPLICIT_IMMEDIATE_SUICIDE_PLAN_AND_INTENT_TO_ACT_NOW',
      { immediateSuicidePlanAndIntent: true },
    ],
  ] as const)('routes %s as S0/BLOCK', (reason, override) => {
    const result = evaluateSafety(input(override), context);
    expect(result.severity).toBe('S0_EMERGENCY');
    expect(result.gateStatus).toBe('BLOCK_AND_HANDOFF');
    expect(result.reasonCodes).toContain(reason);
  });

  it('distinguishes hallucinations with disorientation from hallucinations after recent reduction', () => {
    const emergency = evaluateSafety(
      input({ hallucinations: true, hallucinationDisorientation: true }),
      context,
    );
    expect(emergency.reasonCodes).toContain(
      'HALLUCINATIONS_WITH_DISORIENTATION',
    );

    const urgent = evaluateSafety(
      recent({
        hallucinations: true,
        currentWithdrawalSymptoms: ['HALLUCINATIONS'],
      }),
      context,
    );
    expect(urgent.severity).toBe('S1_URGENT');
    expect(urgent.reasonCodes).toContain(
      'HALLUCINATIONS_AFTER_RECENT_REDUCTION',
    );
  });

  it.each([
    [
      'CSSRS_ITEM_4_POSITIVE',
      input({ cssrs: { ...baseCssrs, item4: 'YES' } }),
      context,
    ],
    [
      'CSSRS_ITEM_5_POSITIVE',
      input({ cssrs: { ...baseCssrs, item5: 'YES' } }),
      context,
    ],
    [
      'SUICIDAL_BEHAVIOR_PREVIOUS_3_MONTHS',
      input({
        cssrs: { ...baseCssrs, suicidalBehaviorPrevious3Months: 'YES' },
      }),
      context,
    ],
    [
      'PRIOR_WITHDRAWAL_SEIZURE_OR_DELIRIUM_WITH_RECENT_OR_PLANNED_MAJOR_REDUCTION',
      input({ previousWithdrawalSeizure: 'YES' }),
      { ...context, plannedDirection: 'ABSTINENCE' as const },
    ],
    [
      'RECENT_REDUCTION_TWO_OR_MORE_WITHDRAWAL_SYMPTOMS',
      recent({ currentWithdrawalSymptoms: ['TREMOR', 'UNUSUAL_SWEATING'] }),
      context,
    ],
    [
      'RECENT_REDUCTION_TWO_OR_MORE_MAJOR_WITHDRAWAL_RISK_FACTORS',
      recent({ priorWithdrawals: 'THREE_OR_MORE' }),
      { ...context, ageOver65: true },
    ],
    [
      'WITHDRAWAL_SYMPTOMS_WITH_OPIOID_OR_SEDATIVE_CONTEXT',
      input({
        currentWithdrawalSymptoms: ['TREMOR'],
        otherSubstanceCategories: ['OPIOIDS'],
      }),
      context,
    ],
  ] as const)('routes %s as S1/BLOCK', (reason, safetyInput, safetyContext) => {
    const result = evaluateSafety(safetyInput, safetyContext);
    expect(result.severity).toBe('S1_URGENT');
    expect(result.gateStatus).toBe('BLOCK_AND_HANDOFF');
    expect(result.reasonCodes).toContain(reason);
  });

  it.each([
    [
      'CSSRS_ITEMS_1_TO_3_POSITIVE_WITHOUT_4_5',
      input({ cssrs: { ...baseCssrs, item1: 'YES' } }),
      context,
    ],
    [
      'RECENT_REDUCTION_ONE_WITHDRAWAL_SYMPTOM',
      recent({ currentWithdrawalSymptoms: ['TREMOR'] }),
      context,
    ],
    [
      'RECENT_REDUCTION_ONE_MAJOR_RISK_FACTOR',
      recent(),
      { ...context, ageOver65: true },
    ],
    [
      'PROLONGED_HEAVY_REGULAR_USE_WITH_PLANNED_MAJOR_REDUCTION',
      input(),
      {
        ...context,
        plannedDirection: 'ABSTINENCE' as const,
        canonicalProlongedHeavyRegularUse: true,
      },
    ],
    [
      'PRIOR_WITHDRAWAL_HISTORY_UNSURE',
      input({ previousWithdrawalSeizure: 'UNSURE' }),
      context,
    ],
    [
      'SEDATIVE_DEPENDENCE_UNSURE_DURING_PLANNED_REDUCTION',
      input({ sedativeDependence: 'UNSURE' }),
      { ...context, plannedDirection: 'ABSTINENCE' as const },
    ],
    [
      'PREGNANT_OR_POSSIBLY_PREGNANT_WITH_CURRENT_ALCOHOL_USE',
      input({ pregnancy: 'PREGNANT', currentAlcoholUse: true }),
      context,
    ],
    [
      'SERIOUS_MEDICAL_CONDITION_WITH_PLANNED_MAJOR_REDUCTION',
      input({ seriousMedicalContexts: ['SERIOUS_LIVER_DISEASE'] }),
      { ...context, plannedDirection: 'ABSTINENCE' as const },
    ],
    [
      'PRIOR_WITHDRAWAL_SEIZURE_OR_DELIRIUM_WITHOUT_CURRENT_REDUCTION',
      input({ previousWithdrawalSeizure: 'YES' }),
      context,
    ],
  ] as const)(
    'routes %s as S2/ALLOW_WITH_HANDOFF',
    (reason, safetyInput, safetyContext) => {
      const result = evaluateSafety(safetyInput, safetyContext);
      expect(result.severity).toBe('S2_PRIORITY');
      expect(result.gateStatus).toBe('ALLOW_WITH_HANDOFF');
      expect(result.reasonCodes).toContain(reason);
    },
  );

  it.each([
    [
      'OTHER_SUBSTANCE_USE_WITHOUT_ACUTE_INTERACTION',
      input({ otherSubstanceCategories: ['STIMULANTS'] }),
    ],
    ['STABLE_MEDICAL_CONDITION', input({ stableMedicalCondition: true })],
    [
      'CLINICIAN_DIRECTED_SAFETY_REVIEW',
      input({
        seriousMedicalContexts: ['CLINICIAN_DIRECTED_SAFETY_REVIEW'],
      }),
    ],
  ] as const)(
    'routes %s as routine clinician context',
    (reason, safetyInput) => {
      const result = evaluateSafety(safetyInput, context);
      expect(result.severity).toBe('S3_ROUTINE');
      expect(result.gateStatus).toBe('ALLOW_MONITORING');
      expect(result.clinicianContext).toBe(true);
      expect(result.reasonCodes).toContain(reason);
    },
  );

  it('returns S_NONE with ordinary monitoring when nothing triggers', () => {
    const result = evaluateSafety(input(), context);
    expect(result.severity).toBe('S_NONE');
    expect(result.gateStatus).toBe('ALLOW_MONITORING');
    expect(result.clinicianContext).toBe(false);
    expect(result.allowedSubjectiveInterventions).toEqual([]);
  });

  it('preserves global precedence while retaining reasons from separate domains', () => {
    const result = evaluateSafety(
      input({
        currentSeizure: true,
        cssrs: { ...baseCssrs, item4: 'YES' },
        pregnancy: 'POSSIBLY_PREGNANT',
        currentAlcoholUse: true,
      }),
      context,
    );
    expect(result.severity).toBe('S0_EMERGENCY');
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        'CURRENT_SEIZURE',
        'CSSRS_ITEM_4_POSITIVE',
        'PREGNANT_OR_POSSIBLY_PREGNANT_WITH_CURRENT_ALCOHOL_USE',
      ]),
    );
    expect(result.domainResults.map(({ domain }) => domain)).toEqual(
      expect.arrayContaining([
        'WITHDRAWAL_OR_MEDICAL',
        'SUICIDE_OR_SELF_HARM',
        'PREGNANCY',
      ]),
    );
  });

  it('does not treat the three-month self-report as the canonical prolonged-heavy predicate', () => {
    const result = evaluateSafety(
      input({ similarHeavyRegularUseAtLeast3Months: 'YES' }),
      { ...context, plannedDirection: 'ABSTINENCE' },
    );
    expect(result.reasonCodes).not.toContain(
      'PROLONGED_HEAVY_REGULAR_USE_WITH_PLANNED_MAJOR_REDUCTION',
    );
    expect(result.severity).toBe('S_NONE');
  });

  it('does not turn unknown age into a risk factor', () => {
    const result = evaluateSafety(recent({ ageOver65: 'UNSURE' }), context);
    expect(result.reasonCodes).not.toContain(
      'RECENT_REDUCTION_ONE_MAJOR_RISK_FACTOR',
    );
  });

  it('does not let legacy false values suppress structured true safety facts', () => {
    const medical = evaluateSafety(
      input({
        seriousMedicalCondition: false,
        seriousMedicalContexts: ['SERIOUS_LIVER_DISEASE'],
      }),
      { ...context, plannedDirection: 'ABSTINENCE' },
    );
    expect(medical.reasonCodes).toContain(
      'SERIOUS_MEDICAL_CONDITION_WITH_PLANNED_MAJOR_REDUCTION',
    );

    const opioid = evaluateSafety(
      input({
        currentOpioidOrSedativeUse: false,
        otherSubstanceCategories: ['OPIOIDS'],
        currentWithdrawalSymptoms: ['TREMOR'],
      }),
      context,
    );
    expect(opioid.reasonCodes).toContain(
      'WITHDRAWAL_SYMPTOMS_WITH_OPIOID_OR_SEDATIVE_CONTEXT',
    );

    const substance = evaluateSafety(
      input({
        otherSubstanceUse: false,
        otherSubstanceCategories: ['STIMULANTS'],
      }),
      context,
    );
    expect(substance.reasonCodes).toContain(
      'OTHER_SUBSTANCE_USE_WITHOUT_ACUTE_INTERACTION',
    );
  });

  it('uses local-calendar day boundaries and exact 50-percent threshold', () => {
    const localContext: SafetyContext = {
      now: new Date('2026-08-20T00:30:00.000Z'),
      timezone: 'America/Los_Angeles',
      plannedDirection: 'UNSURE',
    };
    const insideSevenLocalDays = evaluateSafety(
      input({
        reductionStartedAt: '2026-08-12T23:00:00.000Z',
        reductionPercent: 50,
        currentWithdrawalSymptoms: ['TREMOR'],
      }),
      localContext,
    );
    expect(insideSevenLocalDays.severity).toBe('S2_PRIORITY');

    const belowThreshold = evaluateSafety(
      input({
        reductionStartedAt: '2026-08-19T12:00:00.000Z',
        reductionPercent: 49,
        currentWithdrawalSymptoms: ['TREMOR'],
      }),
      context,
    );
    expect(belowThreshold.severity).toBe('S_NONE');

    const eightDays = evaluateSafety(
      input({
        reductionStartedAt: '2026-08-12T12:00:00.000Z',
        reductionPercent: 50,
        currentWithdrawalSymptoms: ['TREMOR'],
      }),
      context,
    );
    expect(eightDays.severity).toBe('S_NONE');
  });

  it('rejects duplicate withdrawal symptoms before they can inflate the count', () => {
    expect(() =>
      input({ currentWithdrawalSymptoms: ['TREMOR', 'TREMOR'] }),
    ).toThrow();
  });

  it('rejects hallucination-disorientation without hallucinations', () => {
    expect(() => input({ hallucinationDisorientation: true })).toThrow();
  });

  it('emits reasons in canonical deterministic order', () => {
    const result = evaluateSafety(
      input({
        currentSeizure: true,
        breathingDifficulty: true,
        cssrs: { ...baseCssrs, item4: 'YES' },
      }),
      context,
    );
    expect(result.reasonCodes.slice(0, 3)).toEqual([
      'CURRENT_SEIZURE',
      'BREATHING_DIFFICULTY',
      'CSSRS_ITEM_4_POSITIVE',
    ]);
    expect(evaluateSafety(input(), context)).toEqual(
      evaluateSafety(input(), context),
    );
  });
});
