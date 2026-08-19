import { z } from 'zod';
export const RecoveryDirectionSchema = z.enum([
  'ABSTINENCE',
  'REDUCTION',
  'UNSURE',
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
      state: z.enum(['UNKNOWN', 'UNSURE', 'PREFER_NOT_TO_SAY', 'NOT_YET_ANSWERED']),
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
  lastDrink: z.object({ state: LastDrinkStateSchema, date: z.string().date().optional() }),
  recoveryDirection: response(RecoveryDirectionSchema),
  mutualHelpPreference: response(z.enum(['NONE', 'AA_12_STEP', 'ALTERNATIVE', 'UNSURE', 'PREFER_NOT_TO_SAY'])),
  spiritualContentPreference: response(z.enum(['ALLOW', 'DO_NOT_ALLOW', 'UNSURE'])),
});
export type OnboardingDraft = z.infer<typeof OnboardingDraftSchema>;
export const auditCScore = (a: OnboardingDraft['auditC']) => {
  if (a.frequency.state !== 'ANSWERED' || a.quantity.state !== 'ANSWERED' || a.heavy.state !== 'ANSWERED') return null;
  return a.frequency.value + a.quantity.value + a.heavy.value;
};
