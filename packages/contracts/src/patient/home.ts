import { z } from 'zod';

import {
  EngagementReminderViewSchema,
  EngagementStateSchema,
} from '../engagement/engagement.js';
import { PatientSafetyProjectionSchema } from '../safety/safety.js';

const HomePeriodSchema = z.object({
  periodId: z.uuid(),
  periodStartAt: z.iso.datetime(),
  periodEndAt: z.iso.datetime(),
  openAt: z.iso.datetime(),
  originalDueAt: z.iso.datetime(),
  effectiveDueAt: z.iso.datetime(),
});

export const PatientHomeResponseSchema = z.object({
  patientId: z.uuid(),
  patientName: z.string().min(1),
  presentationMode: z.enum(['ORDINARY', 'SAFETY_CONTROLLED']),
  safety: PatientSafetyProjectionSchema,
  primaryAction: z.object({
    kind: z.enum([
      'SETUP',
      'UPCOMING_CHECK_IN',
      'START_CHECK_IN',
      'CONTINUE_CHECK_IN',
      'VIEW_SUBMISSION',
      'SAFETY',
      'RE_ENABLE_MONITORING',
    ]),
    label: z.string().min(1),
    href: z.string().nullable(),
    supportingText: z.string().min(1),
  }),
  checkIn: z.object({
    availability: z.enum([
      'NOT_ACTIVATED',
      'UPCOMING',
      'READY',
      'IN_PROGRESS',
      'SUBMITTED',
      'LATE',
    ]),
    period: HomePeriodSchema.nullable(),
    assessmentId: z.uuid().nullable(),
    completionStatus: z.enum(['DRAFT', 'PARTIAL', 'COMPLETE']).nullable(),
    submittedAt: z.iso.datetime().nullable(),
  }),
  engagement: z.object({
    state: EngagementStateSchema,
    timingPaused: z.boolean(),
    pauseReason: z.enum(['SAFETY', 'TECHNICAL']).nullable(),
    missedCycle: HomePeriodSchema.pick({
      periodId: true,
      periodStartAt: true,
      periodEndAt: true,
      effectiveDueAt: true,
    }).nullable(),
    overdueDays: z.number().int().nonnegative(),
    reminders: z.array(EngagementReminderViewSchema),
    notice: z
      .object({
        kind: z.enum([
          'OVERDUE',
          'FIRST_REMINDER',
          'FINAL_REMINDER',
          'DISENGAGED',
          'TECHNICAL_FAILURE',
          'OPTED_OUT',
        ]),
        title: z.string().min(1),
        message: z.string().min(1),
      })
      .nullable(),
  }),
  monitoring: z.object({
    state: EngagementStateSchema,
    version: z.number().int().positive(),
    optedOutAt: z.iso.datetime().nullable(),
  }),
  goalSummary: z.object({
    goal: z.enum(['ABSTINENCE', 'REDUCTION', 'UNSURE']).nullable(),
    label: z.string().min(1),
  }),
  supportSummary: z.object({
    available: z.boolean(),
    label: z.string().min(1),
    href: z.string().nullable(),
  }),
});

export type PatientHomeResponse = z.infer<typeof PatientHomeResponseSchema>;
