import { z } from 'zod';

import {
  EngagementReminderViewSchema,
  EngagementStateSchema,
} from '../engagement/engagement.js';

export const PatientMonitoringResponseSchema = z.object({
  patientId: z.uuid(),
  state: EngagementStateSchema,
  version: z.number().int().positive(),
  optedOutAt: z.iso.datetime().nullable(),
  cycleTrackingFromAt: z.iso.datetime().nullable(),
  missedCycle: z
    .object({
      periodId: z.uuid(),
      periodStartAt: z.iso.datetime(),
      periodEndAt: z.iso.datetime(),
      effectiveDueAt: z.iso.datetime(),
    })
    .nullable(),
  reminders: z.array(EngagementReminderViewSchema),
});

export const PatientMonitoringActionRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export type PatientMonitoringResponse = z.infer<
  typeof PatientMonitoringResponseSchema
>;
export type PatientMonitoringActionRequest = z.infer<
  typeof PatientMonitoringActionRequestSchema
>;
