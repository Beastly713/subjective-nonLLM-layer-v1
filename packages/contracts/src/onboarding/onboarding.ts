import { z } from 'zod';

import {
  PatientSafetyProjectionSchema,
  SafetyDraftInputSchema,
} from '../safety/safety.js';

export const RecoveryDirectionSchema = z.enum([
  'ABSTINENCE',
  'REDUCTION',
  'UNSURE',
]);

export const OnboardingStepSchema = z.enum([
  'ACCOUNT',
  'AUDIT_C',
  'DRINKING_CONTEXT',
  'RECOVERY_DIRECTION',
  'PREFERENCES',
  'SAFETY',
  'RESULT',
]);

export const LastDrinkStateSchema = z.enum([
  'KNOWN',
  'APPROXIMATE',
  'UNKNOWN',
  'PREFER_NOT_TO_SAY',
]);

const response = <T extends z.ZodType>(value: T) =>
  z.discriminatedUnion('state', [
    z.object({ state: z.literal('ANSWERED'), value }),
    z.object({
      state: z.enum([
        'UNKNOWN',
        'UNSURE',
        'PREFER_NOT_TO_SAY',
        'NOT_YET_ANSWERED',
      ]),
    }),
  ]);

export const OnboardingDraftSchema = z.object({
  auditC: z.object({
    frequency: response(z.number().int().min(0).max(4)),
    quantity: response(z.number().int().min(0).max(4)),
    heavy: response(z.number().int().min(0).max(4)),
  }),
  drinkingDaysPerWeek: response(z.number().int().min(0).max(7)),
  drinksPerDrinkingDay: response(z.number().nonnegative()),
  heavyDrinkingDaysRecent: response(z.number().int().nonnegative()),
  lastDrink: z.object({
    state: LastDrinkStateSchema,
    date: z.string().date().optional(),
  }),
  recoveryDirection: response(RecoveryDirectionSchema),
  mutualHelpPreference: response(
    z.enum([
      'NONE',
      'AA_12_STEP',
      'ALTERNATIVE',
      'UNSURE',
      'PREFER_NOT_TO_SAY',
    ]),
  ),
  spiritualContentPreference: response(
    z.enum(['ALLOW', 'DO_NOT_ALLOW', 'UNSURE']),
  ),
  safetyDraft: z
    .object({
      schemaVersion: z.literal('safety_draft_v1'),
      /** Server-owned when persisted. Clients must not rely on their own clock. */
      updatedAt: z.iso.datetime().optional(),
      responses: SafetyDraftInputSchema,
    })
    .optional(),
});

export const SaveOnboardingDraftRequestSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  currentStep: OnboardingStepSchema,
  draftResponses: OnboardingDraftSchema,
});

export const SaveOnboardingDraftResponseSchema = z.object({
  version: z.number().int().positive(),
  currentStep: OnboardingStepSchema,
  draft: OnboardingDraftSchema,
});

export const SubmitOnboardingRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const SubmitOnboardingResponseSchema = z.object({
  revisionId: z.uuid(),
  revision: z.number().int().positive(),
  setupState: z.literal('INCOMPLETE'),
});

export const OnboardingStateResponseSchema = z.object({
  draft: OnboardingDraftSchema.nullable(),
  currentStep: OnboardingStepSchema,
  version: z.number().int().nonnegative(),
  authoritativeRevision: z
    .object({
      id: z.uuid(),
      revision: z.number().int().positive(),
      submittedAt: z.iso.datetime(),
    })
    .nullable(),
  safety: PatientSafetyProjectionSchema,
  dependencyState: z.enum([
    'SETUP_INCOMPLETE',
    'REDUCTION_SETUP_REQUIRED',
    'SAFETY_REVIEW_REQUIRED',
  ]),
});

export type OnboardingDraft = z.infer<typeof OnboardingDraftSchema>;
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;

export const auditCScore = (auditC: OnboardingDraft['auditC']) => {
  if (
    auditC.frequency.state !== 'ANSWERED' ||
    auditC.quantity.state !== 'ANSWERED' ||
    auditC.heavy.state !== 'ANSWERED'
  ) {
    return null;
  }
  return auditC.frequency.value + auditC.quantity.value + auditC.heavy.value;
};
