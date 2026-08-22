import { z } from 'zod';

export const AdminAuditEventSchema = z.object({
  eventId: z.uuid(),
  actorId: z.uuid().nullable(),
  actorName: z.string().nullable(),
  actorRole: z.string().nullable(),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().nullable(),
  patientId: z.uuid().nullable(),
  occurredAt: z.iso.datetime(),
  reason: z.string().nullable(),
  metadataSummary: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).nullable(),
});

export const AdminAuditListResponseSchema = z.object({
  items: z.array(AdminAuditEventSchema),
  nextCursor: z.string().nullable(),
});

export type AdminAuditEvent = z.infer<typeof AdminAuditEventSchema>;
export type AdminAuditListResponse = z.infer<typeof AdminAuditListResponseSchema>;
