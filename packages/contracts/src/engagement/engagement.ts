import { z } from 'zod';

export const EngagementStateSchema = z.enum([
  'ENGAGED',
  'OVERDUE',
  'AT_RISK_OF_DISENGAGEMENT',
  'DISENGAGED',
  'RETURNED_AFTER_GAP',
  'OPTED_OUT',
  'TECHNICAL_FAILURE',
]);

export const EngagementReminderNumberSchema = z.union([
  z.literal(1),
  z.literal(2),
]);

export const EngagementReminderPresentationStatusSchema = z.enum([
  'UPCOMING',
  'ELIGIBLE',
  'PRESENTED',
  'CANCELLED',
]);

export const EngagementReminderViewSchema = z.object({
  id: z.uuid(),
  reminderNumber: EngagementReminderNumberSchema,
  eligibleAt: z.iso.datetime(),
  presentedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  cancellationReason: z.string().nullable(),
  presentationStatus: EngagementReminderPresentationStatusSchema,
});

export type EngagementState = z.infer<typeof EngagementStateSchema>;
export type EngagementReminderView = z.infer<
  typeof EngagementReminderViewSchema
>;
