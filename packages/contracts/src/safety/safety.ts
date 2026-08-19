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
export const OtherSubstanceCategorySchema = z.enum([
  'OPIOIDS',
  'BENZODIAZEPINES',
  'BARBITURATES',
  'OTHER_SEDATIVES_OR_SLEEP_MEDICINES',
  'STIMULANTS',
  'OTHER_NONMEDICAL_OR_RECREATIONAL_DRUGS',
  'NONE',
  'PREFER_NOT_TO_SAY',
]);
export const SeriousMedicalContextSchema = z.enum([
  'SERIOUS_CARDIOVASCULAR_DISEASE',
  'SERIOUS_LIVER_DISEASE',
  'SEIZURE_DISORDER',
  'SIGNIFICANT_BRAIN_OR_HEAD_INJURY',
  'SERIOUS_CURRENT_MEDICAL_ILLNESS',
  'CLINICIAN_DIRECTED_SAFETY_REVIEW',
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
  similarHeavyRegularUseAtLeast3Months: TriStateSchema,
  prolongedHeavyRegularUse: TriStateSchema.optional(),
  ageOver65: TriStateSchema,
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
  otherSubstanceCategories: z.array(OtherSubstanceCategorySchema).min(1),
  dailyOrNearDailySedativeOrOpioidUse: TriStateSchema,
  priorSedativeOrOpioidWithdrawalSymptoms: TriStateSchema,
  seriousMedicalContexts: z.array(SeriousMedicalContextSchema),
  currentOpioidOrSedativeUse: z.boolean().optional(),
  seriousMedicalCondition: z.boolean().optional(),
  otherSubstanceUse: z.boolean().optional(),
  stableMedicalCondition: z.boolean(),
  clinicianDirectedReview: z.boolean(),
}).superRefine((input, ctx) => {
  const categories = new Set(input.otherSubstanceCategories);
  const exclusive = ['NONE', 'PREFER_NOT_TO_SAY'];
  for (const value of exclusive) {
    if (categories.has(value as z.infer<typeof OtherSubstanceCategorySchema>) && categories.size > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['otherSubstanceCategories'],
        message: `${value} cannot be combined with concrete substance categories.`,
      });
    }
  }
});
export type SafetyInput = z.infer<typeof SafetyInputSchema>;
export type SafetySeverity = z.infer<typeof SafetySeveritySchema>;
export type SafetyGateStatus = z.infer<typeof SafetyGateStatusSchema>;
export type TriState = z.infer<typeof TriStateSchema>;
export type OtherSubstanceCategory = z.infer<typeof OtherSubstanceCategorySchema>;
export type SeriousMedicalContext = z.infer<typeof SeriousMedicalContextSchema>;
