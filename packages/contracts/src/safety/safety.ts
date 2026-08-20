import { z } from 'zod';

export const SAFETY_REASON_CODES = [
  'CURRENT_SEIZURE',
  'SEVERE_CONFUSION_OR_DISORIENTATION',
  'HALLUCINATIONS_WITH_DISORIENTATION',
  'DIFFICULTY_REMAINING_CONSCIOUS',
  'BREATHING_DIFFICULTY',
  'REPEATED_VOMITING_WITH_SEVERE_ILLNESS',
  'CURRENT_SUICIDE_ATTEMPT',
  'CURRENT_SELF_HARM_MEDICAL_EMERGENCY',
  'EXPLICIT_IMMEDIATE_SUICIDE_PLAN_AND_INTENT_TO_ACT_NOW',
  'CSSRS_ITEM_4_POSITIVE',
  'CSSRS_ITEM_5_POSITIVE',
  'SUICIDAL_BEHAVIOR_PREVIOUS_3_MONTHS',
  'HALLUCINATIONS_AFTER_RECENT_REDUCTION',
  'PRIOR_WITHDRAWAL_SEIZURE_OR_DELIRIUM_WITH_RECENT_OR_PLANNED_MAJOR_REDUCTION',
  'RECENT_REDUCTION_TWO_OR_MORE_WITHDRAWAL_SYMPTOMS',
  'RECENT_REDUCTION_TWO_OR_MORE_MAJOR_WITHDRAWAL_RISK_FACTORS',
  'WITHDRAWAL_SYMPTOMS_WITH_OPIOID_OR_SEDATIVE_CONTEXT',
  'CSSRS_ITEMS_1_TO_3_POSITIVE_WITHOUT_4_5',
  'RECENT_REDUCTION_ONE_WITHDRAWAL_SYMPTOM',
  'RECENT_REDUCTION_ONE_MAJOR_RISK_FACTOR',
  'PROLONGED_HEAVY_REGULAR_USE_WITH_PLANNED_MAJOR_REDUCTION',
  'PRIOR_WITHDRAWAL_HISTORY_UNSURE',
  'SEDATIVE_DEPENDENCE_UNSURE_DURING_PLANNED_REDUCTION',
  'PREGNANT_OR_POSSIBLY_PREGNANT_WITH_CURRENT_ALCOHOL_USE',
  'SERIOUS_MEDICAL_CONDITION_WITH_PLANNED_MAJOR_REDUCTION',
  'PRIOR_WITHDRAWAL_SEIZURE_OR_DELIRIUM_WITHOUT_CURRENT_REDUCTION',
  'OTHER_SUBSTANCE_USE_WITHOUT_ACUTE_INTERACTION',
  'STABLE_MEDICAL_CONDITION',
  'CLINICIAN_DIRECTED_SAFETY_REVIEW',
] as const;

export const SUBJECTIVE_INTERVENTION_CLASSES = [
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
] as const;

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

export const SafetyReasonCodeSchema = z.enum(SAFETY_REASON_CODES);
export const SubjectiveInterventionClassSchema = z.enum(
  SUBJECTIVE_INTERVENTION_CLASSES,
);
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

export const WithdrawalSymptomSchema = z.enum([
  'TREMOR',
  'UNUSUAL_SWEATING',
  'RACING_HEARTBEAT',
  'NAUSEA_OR_VOMITING',
  'SEVERE_RESTLESSNESS_OR_AGITATION',
  'SEVERE_ANXIETY',
  'INABILITY_TO_SLEEP',
  'HALLUCINATIONS',
]);

export const CssrsResponsesSchema = z.object({
  item1: TriStateSchema,
  item2: TriStateSchema,
  item3: TriStateSchema,
  item4: TriStateSchema,
  item5: TriStateSchema,
  suicidalBehaviorPrevious3Months: TriStateSchema,
});

const SafetyInputBaseSchema = z.object({
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
  /** Legacy compatibility only. Never treat this as the canonical 28-day-baseline predicate. */
  prolongedHeavyRegularUse: TriStateSchema.optional(),
  ageOver65: TriStateSchema,
  reductionStartedAt: z.iso.datetime().nullable(),
  reductionPercent: z.number().min(0).max(100).nullable(),
  cessation: z.boolean(),
  currentWithdrawalSymptoms: z.array(WithdrawalSymptomSchema),
  sedativeDependence: TriStateSchema,
  cssrs: CssrsResponsesSchema,
  pregnancy: PregnancyStatusSchema,
  currentAlcoholUse: z.boolean(),
  otherSubstanceCategories: z.array(OtherSubstanceCategorySchema).min(1),
  dailyOrNearDailySedativeOrOpioidUse: TriStateSchema,
  priorSedativeOrOpioidWithdrawalSymptoms: TriStateSchema,
  seriousMedicalContexts: z.array(SeriousMedicalContextSchema),
  /** Legacy compatibility only. Structured fields remain authoritative when true. */
  currentOpioidOrSedativeUse: z.boolean().optional(),
  /** Legacy compatibility only. Structured fields remain authoritative when true. */
  seriousMedicalCondition: z.boolean().optional(),
  /** Legacy compatibility only. Structured fields remain authoritative when true. */
  otherSubstanceUse: z.boolean().optional(),
  stableMedicalCondition: z.boolean(),
  clinicianDirectedReview: z.boolean(),
});

function addSafetyInputCrossFieldIssues(
  input: {
    hallucinations?: boolean;
    hallucinationDisorientation?: boolean;
    currentWithdrawalSymptoms?: readonly string[];
    otherSubstanceCategories?: readonly string[];
  },
  ctx: {
    addIssue: (issue: {
      code: 'custom';
      path: Array<string | number>;
      message: string;
    }) => void;
  },
) {
  if (input.hallucinationDisorientation === true && input.hallucinations === false) {
    ctx.addIssue({
      code: 'custom',
      path: ['hallucinationDisorientation'],
      message: 'Hallucination disorientation requires hallucinations to be reported.',
    });
  }

  if (
    input.currentWithdrawalSymptoms &&
    new Set(input.currentWithdrawalSymptoms).size !==
      input.currentWithdrawalSymptoms.length
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['currentWithdrawalSymptoms'],
      message: 'Withdrawal symptoms must not contain duplicates.',
    });
  }

  if (input.otherSubstanceCategories) {
    const categories = new Set(input.otherSubstanceCategories);
    for (const exclusive of ['NONE', 'PREFER_NOT_TO_SAY'] as const) {
      if (categories.has(exclusive) && categories.size > 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['otherSubstanceCategories'],
          message: `${exclusive} cannot be combined with concrete substance categories.`,
        });
      }
    }
  }
}

export const SafetyInputSchema = SafetyInputBaseSchema.superRefine(
  addSafetyInputCrossFieldIssues,
);

export const SafetyDraftInputSchema = SafetyInputBaseSchema.partial()
  .extend({
    cssrs: CssrsResponsesSchema.partial().optional(),
  })
  .superRefine(addSafetyInputCrossFieldIssues);

export const SafetyCaseLifecycleSchema = z.enum([
  'DETECTED',
  'HANDOFF_INITIATED',
  'ACKNOWLEDGED',
  'CLINICAL_REVIEW_IN_PROGRESS',
  'PLAN_ESTABLISHED',
  'RESOLVED',
  'ESCALATED_TO_EMERGENCY',
  'RESOLVED_EXTERNAL_HANDOFF',
]);

export const SafetyCaseDomainSchema = z.enum([
  'WITHDRAWAL_OR_MEDICAL',
  'SUICIDE_OR_SELF_HARM',
  'PREGNANCY',
  'OTHER_SUBSTANCE',
  'ROUTINE_MEDICAL_CONTEXT',
]);

export const SafetyOwnerRoleSchema = z.enum([
  'MEDICAL_SAFETY_OWNER',
  'BEHAVIORAL_HEALTH_SAFETY_OWNER',
  'OBSTETRIC_MEDICAL_OWNER',
  'AUD_MEDICAL_OWNER',
]);

export const SafetyDispositionSchema = z.enum([
  'SAFE_TO_CONTINUE_STANDARD_MONITORING',
  'SAFE_TO_CONTINUE_WITH_RESTRICTIONS',
  'CONTINUE_CLINICAL_HANDOFF',
  'EMERGENCY_EXTERNAL_MANAGEMENT',
  'MONITORING_TEMPORARILY_PAUSED',
]);

export const MonitoringPromptPolicySchema = z.enum(['CONTINUE', 'PAUSE']);
export const SafetyRouteStatusSchema = z.enum([
  'AVAILABLE',
  'UNAVAILABLE',
  'NOT_REQUIRED',
]);

export const SafetyRestrictionInputSchema = z.object({
  allowedSubjectiveInterventions: z.array(SubjectiveInterventionClassSchema),
  monitoringPromptPolicy: MonitoringPromptPolicySchema,
  goalChangeAllowed: z.boolean(),
  reassessmentDueAt: z.iso.datetime().nullable(),
});

export const SafetyRestrictionSnapshotSchema = SafetyRestrictionInputSchema.extend({
  gateStatus: SafetyGateStatusSchema.exclude(['NOT_ASSESSED']),
});

export const SafetyRouteActionSchema = z.object({
  label: z.string().min(1),
  actionType: z.enum(['CALL', 'OPEN_LINK', 'STATUS']),
  href: z.string().nullable(),
  priority: z.enum(['PRIMARY', 'FALLBACK']),
});

export const PatientSafetyStateSchema = z.enum([
  'NOT_ASSESSED',
  'MONITORING_AVAILABLE',
  'ROUTINE_CONTEXT',
  'REVIEW_REQUIRED',
  'HANDOFF_REQUIRED',
]);

export const PatientHandoffStatusSchema = z.enum([
  'NONE',
  'PENDING',
  'ACKNOWLEDGED',
  'REVIEW_IN_PROGRESS',
  'PLAN_ESTABLISHED',
  'EMERGENCY_HANDOFF',
]);

export const PatientSafetyProjectionSchema = z.object({
  safetyState: PatientSafetyStateSchema,
  requiresSafetyShell: z.boolean(),
  handoffStatus: PatientHandoffStatusSchema,
  allowedSubjectiveInterventions: z.array(SubjectiveInterventionClassSchema),
  monitoringPromptPolicy: MonitoringPromptPolicySchema,
  goalChangeAllowed: z.boolean(),
  reassessmentDueAt: z.iso.datetime().nullable(),
  routeAvailability: z.enum([
    'AVAILABLE',
    'PARTIAL',
    'UNAVAILABLE',
    'NOT_REQUIRED',
  ]),
  patientRouteActions: z.array(SafetyRouteActionSchema),
});

export const SafetyResponseTargetSchema = z.object({
  maximumSystemResponseSeconds: z.number().int().positive().nullable(),
  acknowledgementMinutes: z.number().int().positive().nullable(),
  dispositionMinutes: z.number().int().positive().nullable(),
  acknowledgementHours: z.number().int().positive().nullable(),
  dispositionBusinessDays: z.number().int().positive().nullable(),
  reviewBusinessDays: z.number().int().positive().nullable(),
});

export const SafetyCaseRestrictionProjectionSchema =
  SafetyRestrictionSnapshotSchema.extend({
    id: z.uuid(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    sourceDispositionId: z.uuid().nullable(),
  });

export const SafetyCaseDispositionProjectionSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  disposition: SafetyDispositionSchema,
  restrictions: SafetyRestrictionSnapshotSchema.nullable(),
  actorRole: z.string(),
  reason: z.string(),
  sourceCaseVersion: z.number().int().positive(),
  createdAt: z.iso.datetime(),
});

export const SafetyCaseLifecycleEventProjectionSchema = z.object({
  id: z.uuid(),
  fromState: SafetyCaseLifecycleSchema.nullable(),
  toState: SafetyCaseLifecycleSchema,
  reason: z.string().nullable(),
  occurredAt: z.iso.datetime(),
});

export const SafetyCaseProjectionSchema = z.object({
  id: z.uuid(),
  patientId: z.uuid(),
  severity: SafetySeveritySchema.exclude(['S_NONE']),
  domain: SafetyCaseDomainSchema,
  ownerRole: SafetyOwnerRoleSchema,
  reasonCodes: z.array(SafetyReasonCodeSchema),
  lifecycle: SafetyCaseLifecycleSchema,
  version: z.number().int().positive(),
  gateStatus: SafetyGateStatusSchema.exclude(['NOT_ASSESSED']),
  routeStatus: SafetyRouteStatusSchema,
  routeProfileId: z.uuid().nullable(),
  routeProfileLogicalVersion: z.number().int().positive().nullable(),
  currentRouteSnapshot: z.unknown().nullable(),
  currentRestriction: SafetyCaseRestrictionProjectionSchema.nullable(),
  responseTarget: SafetyResponseTargetSchema,
  dispositions: z.array(SafetyCaseDispositionProjectionSchema),
  lifecycleEvents: z.array(SafetyCaseLifecycleEventProjectionSchema),
  detectedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});

export const SafetyCaseListResponseSchema = z.object({
  items: z.array(SafetyCaseProjectionSchema),
});

export const SafetyOperationalIncidentProjectionSchema = z.object({
  id: z.uuid(),
  incidentType: z.string(),
  code: z.string(),
  status: z.string(),
  summary: z.string(),
  metadata: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});

export const AdminSafetyCaseProjectionSchema = SafetyCaseProjectionSchema.extend({
  operationalIncidents: z.array(SafetyOperationalIncidentProjectionSchema),
});

export const AdminSafetyCaseListResponseSchema = z.object({
  items: z.array(AdminSafetyCaseProjectionSchema),
});

export const SafetyCaseMutationRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000),
});

export const SafetyDispositionRequestSchema =
  SafetyCaseMutationRequestSchema.extend({
    disposition: SafetyDispositionSchema,
    restrictions: SafetyRestrictionInputSchema.optional(),
  })
  .superRefine((input, ctx) => {
    if (
      input.disposition === 'SAFE_TO_CONTINUE_WITH_RESTRICTIONS' &&
      !input.restrictions
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['restrictions'],
        message: 'Restrictions are required for a restricted continuation plan.',
      });
    }
  });

export const SafetyEvaluationResponseSchema = z.object({
  setupState: z.enum([
    'SETUP_INCOMPLETE',
    'REDUCTION_SETUP_REQUIRED',
    'SAFETY_REVIEW_REQUIRED',
  ]),
  requiresReview: z.boolean(),
  evaluationId: z.uuid(),
  safety: PatientSafetyProjectionSchema,
});

export type SafetyInput = z.infer<typeof SafetyInputSchema>;
export type SafetyDraftInput = z.infer<typeof SafetyDraftInputSchema>;
export type SafetySeverity = z.infer<typeof SafetySeveritySchema>;
export type SafetyGateStatus = z.infer<typeof SafetyGateStatusSchema>;
export type SafetyReasonCode = z.infer<typeof SafetyReasonCodeSchema>;
export type SubjectiveInterventionClass = z.infer<
  typeof SubjectiveInterventionClassSchema
>;
export type TriState = z.infer<typeof TriStateSchema>;
export type OtherSubstanceCategory = z.infer<typeof OtherSubstanceCategorySchema>;
export type SeriousMedicalContext = z.infer<typeof SeriousMedicalContextSchema>;
export type SafetyCaseLifecycle = z.infer<typeof SafetyCaseLifecycleSchema>;
export type SafetyCaseDomain = z.infer<typeof SafetyCaseDomainSchema>;
export type SafetyOwnerRole = z.infer<typeof SafetyOwnerRoleSchema>;
export type SafetyDisposition = z.infer<typeof SafetyDispositionSchema>;
export type SafetyRestrictionInput = z.infer<typeof SafetyRestrictionInputSchema>;
export type SafetyRestrictionSnapshot = z.infer<
  typeof SafetyRestrictionSnapshotSchema
>;
export type PatientSafetyProjection = z.infer<
  typeof PatientSafetyProjectionSchema
>;
export type SafetyCaseProjection = z.infer<typeof SafetyCaseProjectionSchema>;
export type AdminSafetyCaseProjection = z.infer<
  typeof AdminSafetyCaseProjectionSchema
>;
