import { z } from 'zod';

export const ScheduledPeriodSchema = z.object({
  periodId: z.uuid(),
  scheduleVersionId: z.uuid(),
  monitoringTimezone: z.string(),
  periodStartAt: z.iso.datetime(),
  periodEndAt: z.iso.datetime(),
  openAt: z.iso.datetime(),
  originalDueAt: z.iso.datetime(),
  effectiveDueAt: z.iso.datetime(),
  version: z.number().int().positive(),
});

export const ScheduleReadResponseSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('NOT_ACTIVATED') }),
  z.object({
    state: z.literal('ACTIVATED'),
    schedule: z.object({
      scheduleVersionId: z.uuid(),
      version: z.number().int().positive(),
      monitoringTimezone: z.string(),
      effectiveBoundary: z.iso.datetime(),
    }),
    periods: z.array(ScheduledPeriodSchema),
  }),
]);

export type ScheduleReadResponse = z.infer<typeof ScheduleReadResponseSchema>;
