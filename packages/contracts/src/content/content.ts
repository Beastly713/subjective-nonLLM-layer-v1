import { z } from 'zod';

export const ContentInterventionClassSchema = z.enum([
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
]);

export const ContentFeedbackOutcomeSchema = z.enum([
  'DISMISS',
  'NOT_HELPFUL',
  'DONT_SHOW_THIS_TYPE',
]);

export const ContentResourceViewSchema = z.object({
  resourceId: z.uuid(),
  resourceVersionId: z.uuid(),
  resolutionId: z.uuid(),
  title: z.string().min(1),
  bodyMarkdown: z.string().min(1),
  estimatedDurationSeconds: z.number().int().positive(),
  isFollowup: z.boolean(),
  feedbackActions: z.array(ContentFeedbackOutcomeSchema),
});

export const PatientSupportStatusSchema = z.enum([
  'AVAILABLE',
  'CONTENT_UNAVAILABLE',
  'SAFETY_CONTROLLED',
  'NO_CURRENT_SUPPORT',
]);

export const PatientSupportSourceSchema = z.object({
  periodId: z.uuid(),
  revisionId: z.uuid(),
  completionStatus: z.enum(['PARTIAL', 'COMPLETE']),
  submittedAt: z.iso.datetime(),
});

export const PatientSupportTypeOptionSchema = z.object({
  key: ContentInterventionClassSchema,
  label: z.string().min(1),
});

export const PatientSupportResponseSchema = z.object({
  status: PatientSupportStatusSchema,
  primary: ContentResourceViewSchema.nullable(),
  secondary: ContentResourceViewSchema.nullable(),
  availableFollowup: z.array(ContentResourceViewSchema),
  exploreOptions: z.array(PatientSupportTypeOptionSchema),
  hiddenInterventionClasses: z.array(PatientSupportTypeOptionSchema),
  source: PatientSupportSourceSchema.nullable(),
});

export const ContentFeedbackRequestSchema = z
  .object({
    resourceVersionId: z.uuid(),
    resolutionId: z.uuid(),
    outcome: ContentFeedbackOutcomeSchema,
  })
  .strict();

export const ContentExploreRequestSchema = z
  .object({
    interventionClass: ContentInterventionClassSchema,
  })
  .strict();

export type ContentInterventionClass = z.infer<
  typeof ContentInterventionClassSchema
>;
export type ContentFeedbackOutcome = z.infer<
  typeof ContentFeedbackOutcomeSchema
>;
export type ContentResourceView = z.infer<typeof ContentResourceViewSchema>;
export type PatientSupportTypeOption = z.infer<
  typeof PatientSupportTypeOptionSchema
>;
export type PatientSupportResponse = z.infer<
  typeof PatientSupportResponseSchema
>;
export type ContentFeedbackRequest = z.infer<
  typeof ContentFeedbackRequestSchema
>;
export type ContentExploreRequest = z.infer<
  typeof ContentExploreRequestSchema
>;
