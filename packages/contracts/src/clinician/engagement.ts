import { z } from 'zod';

import {
  EngagementReminderViewSchema,
  EngagementStateSchema,
} from '../engagement/engagement.js';
import { ClinicianTaskViewSchema } from './review.js';

export const EngagementCaseLifecycleSchema = z.enum([
  'NEW',
  'ACKNOWLEDGED',
  'OUTREACH_IN_PROGRESS',
  'RESOLVED_RETURNED',
  'RESOLVED_OPT_OUT',
  'RESOLVED_PROGRAM_CLOSED',
  'RESOLVED_TECHNICAL_CORRECTION',
]);

const EngagementPeriodSchema = z.object({
  periodId: z.uuid(),
  periodStartAt: z.iso.datetime(),
  periodEndAt: z.iso.datetime(),
  effectiveDueAt: z.iso.datetime(),
});

export const ClinicianEngagementItemSchema = z.object({
  patientId: z.uuid(),
  patientName: z.string().min(1),
  engagementState: EngagementStateSchema,
  missedCycle: EngagementPeriodSchema.nullable(),
  effectiveDueAt: z.iso.datetime().nullable(),
  daysOverdue: z.number().int().nonnegative(),
  reminders: z.array(EngagementReminderViewSchema),
  pause: z.object({
    timingPaused: z.boolean(),
    reason: z.enum(['SAFETY', 'TECHNICAL']).nullable(),
  }),
  engagementCase: z
    .object({
      id: z.uuid(),
      lifecycle: EngagementCaseLifecycleSchema,
      caseVersion: z.number().int().positive(),
      openedAt: z.iso.datetime(),
      acknowledgedAt: z.iso.datetime().nullable(),
      outreachStartedAt: z.iso.datetime().nullable(),
      resolvedAt: z.iso.datetime().nullable(),
      resolutionReason: z.string().nullable(),
    })
    .nullable(),
  task: ClinicianTaskViewSchema.nullable(),
  lastCompletedCheckIn: z
    .object({
      periodId: z.uuid(),
      submittedAt: z.iso.datetime(),
      completionStatus: z.enum(['PARTIAL', 'COMPLETE']),
    })
    .nullable(),
});

export const ClinicianEngagementResponseSchema = z.object({
  items: z.array(ClinicianEngagementItemSchema),
});

export const EngagementCaseActionRequestSchema = z
  .object({
    expectedCaseVersion: z.number().int().positive(),
  })
  .strict();

export type ClinicianEngagementItem = z.infer<
  typeof ClinicianEngagementItemSchema
>;
export type ClinicianEngagementResponse = z.infer<
  typeof ClinicianEngagementResponseSchema
>;
export type EngagementCaseActionRequest = z.infer<
  typeof EngagementCaseActionRequestSchema
>;
