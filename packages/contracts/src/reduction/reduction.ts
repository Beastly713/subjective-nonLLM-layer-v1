import { z } from 'zod';

export const AlcoholDayStatusSchema = z.enum([
  'KNOWN_ZERO',
  'KNOWN_QUANTITY',
  'UNKNOWN',
]);

export const AlcoholThresholdProfileSchema = z.enum([
  'LOWER_THRESHOLD',
  'HIGHER_THRESHOLD',
]);

export const ReductionProposalKindSchema = z.enum([
  'REDUCTION',
  'ABSTINENCE',
]);

export const ReductionSetupStateSchema = z.enum([
  'NOT_REQUIRED',
  'NOT_STARTED',
  'BASELINE_DRAFT',
  'BASELINE_CONFIRMED',
  'PROPOSED',
]);

function hasAtMostOneDecimalPlace(value: number) {
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}

export const ReductionBaselineDayInputSchema = z
  .object({
    localDate: z.iso.date(),
    status: AlcoholDayStatusSchema,
    standardDrinks: z.number().finite().nonnegative().nullable().optional(),
  })
  .superRefine((day, ctx) => {
    if (
      day.standardDrinks !== null &&
      day.standardDrinks !== undefined &&
      !hasAtMostOneDecimalPlace(day.standardDrinks)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['standardDrinks'],
        message: 'Standard drinks must use at most one decimal place.',
      });
    }

    if (day.status === 'UNKNOWN') {
      if (day.standardDrinks !== null && day.standardDrinks !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['standardDrinks'],
          message: 'Unknown days cannot include a quantity.',
        });
      }
      return;
    }

    if (day.status === 'KNOWN_ZERO') {
      if (
        day.standardDrinks !== undefined &&
        day.standardDrinks !== null &&
        day.standardDrinks !== 0
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['standardDrinks'],
          message: 'Known-zero days may only contain zero.',
        });
      }
      return;
    }

    if (
      day.standardDrinks === undefined ||
      day.standardDrinks === null ||
      day.standardDrinks <= 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['standardDrinks'],
        message: 'Known-quantity days require a positive quantity.',
      });
    }
  });

export const ReductionBaselineDayProjectionSchema = z.object({
  id: z.uuid(),
  localDate: z.iso.date(),
  status: AlcoholDayStatusSchema,
  standardDrinks: z.number().nullable(),
  ethanolGrams: z.number().nullable(),
  source: z.string(),
  unitPolicyVersion: z.string(),
});

export const ReductionBaselineMetricsSchema = z.object({
  baselineTotalStandardDrinks28d: z.number(),
  baselineTotalEthanolGrams28d: z.number(),
  baselineDrinkingDays28d: z.number().int().nonnegative(),
  baselineHeavyDrinkingDays28d: z.number().int().nonnegative(),
  baselineMaxStandardDrinksDay: z.number().nonnegative(),
  baselineAverageDrinksPerDrinkingDay: z.number().nonnegative(),
  baselineAverageWeeklyDrinks: z.number().nonnegative(),
});

const ReductionBaselineDraftProjectionSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
  baselineStart: z.iso.date(),
  baselineEnd: z.iso.date(),
  monitoringTimezone: z.string().min(1),
  knownDays: z.number().int().nonnegative(),
  unknownDays: z.number().int().nonnegative(),
  days: z.array(ReductionBaselineDayProjectionSchema).length(28),
});

const ReductionBaselineAuthoritativeProjectionSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
  baselineStart: z.iso.date(),
  baselineEnd: z.iso.date(),
  monitoringTimezone: z.string().min(1),
  metrics: ReductionBaselineMetricsSchema,
  confirmedAt: z.iso.datetime(),
});

const ReductionProposalProjectionSchema = z.object({
  kind: ReductionProposalKindSchema,
  targetWeeklyStandardDrinks: z.number().nonnegative(),
  baselineRevisionId: z.uuid(),
  updatedAt: z.iso.datetime(),
});

export const ReductionSetupResponseSchema = z.object({
  required: z.boolean(),
  state: ReductionSetupStateSchema,
  version: z.number().int().nonnegative(),
  unitPolicy: z.object({
    version: z.string(),
    standardDrinkGramsEthanol: z.number().positive(),
    patientInputDecimalPlaces: z.number().int().nonnegative(),
  }),
  thresholdProfile: AlcoholThresholdProfileSchema,
  draftBaseline: ReductionBaselineDraftProjectionSchema.nullable(),
  authoritativeBaseline:
    ReductionBaselineAuthoritativeProjectionSchema.nullable(),
  proposal: ReductionProposalProjectionSchema.nullable(),
});

const ExpectedVersionSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

export const StartReductionBaselineRequestSchema = ExpectedVersionSchema;

export const SaveReductionBaselineDraftRequestSchema = ExpectedVersionSchema.extend(
  {
    days: z.array(ReductionBaselineDayInputSchema).length(28),
  },
).superRefine((request, ctx) => {
  const dates = new Set(request.days.map((day) => day.localDate));
  if (dates.size !== request.days.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['days'],
      message: 'Baseline days must contain 28 unique local dates.',
    });
  }
});

export const ConfirmReductionBaselineRequestSchema = ExpectedVersionSchema;

export const StartReductionBaselineCorrectionRequestSchema =
  ExpectedVersionSchema.extend({
    reason: z.string().trim().min(1).max(2000),
  });

export const ProposeReductionTargetRequestSchema = ExpectedVersionSchema.extend(
  {
    targetWeeklyStandardDrinks: z
      .number()
      .finite()
      .nonnegative()
      .refine(hasAtMostOneDecimalPlace, {
        message: 'Target standard drinks must use at most one decimal place.',
      }),
  },
);

export type AlcoholDayStatus = z.infer<typeof AlcoholDayStatusSchema>;
export type AlcoholThresholdProfile = z.infer<
  typeof AlcoholThresholdProfileSchema
>;
export type ReductionProposalKind = z.infer<
  typeof ReductionProposalKindSchema
>;
export type ReductionBaselineDayInput = z.infer<
  typeof ReductionBaselineDayInputSchema
>;
export type ReductionSetupResponse = z.infer<
  typeof ReductionSetupResponseSchema
>;
export type ReductionBaselineMetrics = z.infer<
  typeof ReductionBaselineMetricsSchema
>;
export type StartReductionBaselineRequest = z.infer<
  typeof StartReductionBaselineRequestSchema
>;
export type SaveReductionBaselineDraftRequest = z.infer<
  typeof SaveReductionBaselineDraftRequestSchema
>;
export type ConfirmReductionBaselineRequest = z.infer<
  typeof ConfirmReductionBaselineRequestSchema
>;
export type StartReductionBaselineCorrectionRequest = z.infer<
  typeof StartReductionBaselineCorrectionRequestSchema
>;
export type ProposeReductionTargetRequest = z.infer<
  typeof ProposeReductionTargetRequestSchema
>;
