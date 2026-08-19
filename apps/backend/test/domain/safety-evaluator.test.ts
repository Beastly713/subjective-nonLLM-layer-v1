import { describe, expect, it } from 'vitest';
import { SafetyInputSchema } from '@aud-subjective/contracts';
import { evaluateSafety } from '../../src/modules/safety/domain/evaluate-safety.js';

const input = (overrides: Record<string, unknown> = {}) => SafetyInputSchema.parse({
  currentSeizure: false, severeConfusionOrDisorientation: false, hallucinations: false, hallucinationDisorientation: false, difficultyRemainingConscious: false, breathingDifficulty: false, repeatedVomitingWithSevereIllness: false, currentSuicideAttempt: false, currentSelfHarmMedicalEmergency: false, immediateSuicidePlanAndIntent: false,
  previousWithdrawalSeizure: 'NO', previousWithdrawalDelirium: 'NO', priorWithdrawals: '0', prolongedHeavyRegularUse: 'NO', reductionStartedAt: null, reductionPercent: null, cessation: false, currentWithdrawalSymptoms: [], sedativeDependence: 'NO',
  cssrs: { item1: 'NO', item2: 'NO', item3: 'NO', item4: 'NO', item5: 'NO', suicidalBehaviorPrevious3Months: 'NO' }, pregnancy: 'NO', currentAlcoholUse: false, currentOpioidOrSedativeUse: false, seriousMedicalCondition: false, otherSubstanceUse: false, stableMedicalCondition: false, clinicianDirectedReview: false, ...overrides,
});
const context = { now: new Date('2026-08-19T12:00:00Z'), timezone: 'UTC', plannedDirection: 'UNSURE' as const };

describe('deterministic safety evaluator', () => {
  it('uses exact precedence and concrete reasons', () => {
    const result = evaluateSafety(input({ currentSeizure: true, cssrs: { item1: 'YES', item2: 'NO', item3: 'NO', item4: 'YES', item5: 'NO', suicidalBehaviorPrevious3Months: 'NO' } }), context);
    expect(result.severity).toBe('S0_EMERGENCY');
    expect(result.gateStatus).toBe('BLOCK_AND_HANDOFF');
    expect(result.reasonCodes).toContain('CURRENT_SEIZURE');
  });
  it('requires at least half reduction inside the seven local-calendar days', () => {
    const recent = { ...context, now: new Date('2026-08-19T12:00:00Z') };
    const noHalf = evaluateSafety(input({ reductionStartedAt: '2026-08-18T12:00:00Z', reductionPercent: 40, currentWithdrawalSymptoms: ['TREMOR'] }), recent);
    expect(noHalf.severity).toBe('S_NONE');
    const half = evaluateSafety(input({ reductionStartedAt: '2026-08-18T12:00:00Z', reductionPercent: 50, currentWithdrawalSymptoms: ['TREMOR'] }), recent);
    expect(half.severity).toBe('S2_PRIORITY');
  });
  it('uses CONTINUE for ordinary monitoring', () => {
    const result = evaluateSafety(input(), context);
    expect(result.severity).toBe('S_NONE');
    expect(result.monitoringPromptPolicy).toBe('CONTINUE');
  });
});
