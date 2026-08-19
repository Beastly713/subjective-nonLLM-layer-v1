import { z } from 'zod';

export const SafetySeveritySchema = z.enum([
  'S0_EMERGENCY',
  'S1_URGENT',
  'S2_PRIORITY',
  'S3_ROUTINE',
  'S_NONE',
]);
export const SafetyGateStatusSchema = z.enum([
  'NOT_ASSESSED',
  'ALLOW_MONITORING',
  'ALLOW_WITH_HANDOFF',
  'BLOCK_AND_HANDOFF',
]);
export const TriStateSchema = z.enum(['YES', 'NO', 'UNSURE']);
export const PregnancyStatusSchema = z.enum([
  'NO',
  'PREGNANT',
  'POSSIBLY_PREGNANT',
  'TRYING_TO_CONCEIVE',
  'PREFER_NOT_TO_SAY',
]);
export const CssrsResponsesSchema = z.object({
  item1: TriStateSchema,
  item2: TriStateSchema,
  item3: TriStateSchema,
  item4: TriStateSchema,
  item5: TriStateSchema,
  suicidalBehaviorPrevious3Months: TriStateSchema,
});
export const SafetyInputSchema = z.object({
  currentSeizure: z.boolean(),
  severeConfusionOrDisorientation: z.boolean(),
  hallucinations: z.boolean(),
  hallucinationDisorientation: z.boolean(),
  difficultyRemainingConscious: z.boolean(),
  breathingDifficulty: z.boolean(),
  repeatedVomitingWithSevereIllness: z.boolean(),
  currentSuicideAttempt: z.boolean(),
  currentSelfHarmMedicalEmergency: z.boolean(),
  immediateSuicidePlanAndIntent: z.boolean(),
  previousWithdrawalSeizure: TriStateSchema,
  previousWithdrawalDelirium: TriStateSchema,
  priorWithdrawals: z.enum(['0', '1_2', 'THREE_OR_MORE', 'UNSURE']),
  prolongedHeavyRegularUse: TriStateSchema,
  reductionStartedAt: z.string().datetime().nullable(),
  reductionPercent: z.number().min(0).max(100).nullable(),
  cessation: z.boolean(),
  currentWithdrawalSymptoms: z.array(
    z.enum([
      'TREMOR',
      'UNUSUAL_SWEATING',
      'RACING_HEARTBEAT',
      'NAUSEA_OR_VOMITING',
      'SEVERE_RESTLESSNESS_OR_AGITATION',
      'SEVERE_ANXIETY',
      'INABILITY_TO_SLEEP',
      'HALLUCINATIONS',
    ]),
  ),
  sedativeDependence: TriStateSchema,
  cssrs: CssrsResponsesSchema,
  pregnancy: PregnancyStatusSchema,
  currentAlcoholUse: z.boolean(),
  currentOpioidOrSedativeUse: z.boolean(),
  seriousMedicalCondition: z.boolean(),
  otherSubstanceUse: z.boolean(),
  stableMedicalCondition: z.boolean(),
  clinicianDirectedReview: z.boolean(),
});
export type SafetyInput = z.infer<typeof SafetyInputSchema>;
export type SafetySeverity = z.infer<typeof SafetySeveritySchema>;
export type SafetyGateStatus = z.infer<typeof SafetyGateStatusSchema>;
export type TriState = z.infer<typeof TriStateSchema>;
