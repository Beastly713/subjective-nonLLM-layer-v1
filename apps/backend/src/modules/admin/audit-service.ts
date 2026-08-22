import {
  AdminAuditListResponseSchema,
  type AdminAuditListResponse,
} from '@aud-subjective/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { DomainError } from '../../shared/errors/domain-error.js';

type Tx = Prisma.TransactionClient;

const SAFE_METADATA_KEYS = new Set([
  'resourceId',
  'versionId',
  'reviewStatus',
  'rowVersion',
  'interventionClass',
  'reasonCode',
  'status',
  'sourceRevisionReference',
]);

function encodeCursor(value: { occurredAt: Date; eventId: string }) {
  return Buffer.from(
    JSON.stringify({ occurredAt: value.occurredAt.toISOString(), eventId: value.eventId }),
  ).toString('base64url');
}

function decodeCursor(value: string) {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      occurredAt?: unknown;
      eventId?: unknown;
    };
    if (typeof parsed.occurredAt !== 'string' || typeof parsed.eventId !== 'string') {
      throw new Error('invalid cursor');
    }
    const occurredAt = new Date(parsed.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw new Error('invalid cursor');
    return { occurredAt, eventId: parsed.eventId };
  } catch {
    throw new DomainError(400, 'INVALID_CURSOR', 'The audit cursor is invalid.');
  }
}

function metadataSummary(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: Record<string, string | number | boolean> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean'
    ) {
      result[key] = entry;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

export async function readAdminAudit(
  tx: Tx,
  input: {
    patientId?: string | undefined;
    entityType?: string | undefined;
    entityId?: string | undefined;
    action?: string | undefined;
    actorId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
  },
): Promise<AdminAuditListResponse> {
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;
  const occurredAt =
    input.from || input.to
      ? {
          ...(input.from ? { gte: new Date(input.from) } : {}),
          ...(input.to ? { lte: new Date(input.to) } : {}),
        }
      : undefined;
  const rows = await tx.auditEvent.findMany({
    where: {
      ...(input.patientId ? { patientId: input.patientId } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.action ? { action: input.action } : {}),
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(occurredAt ? { occurredAt } : {}),
      ...(cursor
        ? {
            OR: [
              { occurredAt: { lt: cursor.occurredAt } },
              { occurredAt: cursor.occurredAt, eventId: { lt: cursor.eventId } },
            ],
          }
        : {}),
    },
    orderBy: [{ occurredAt: 'desc' }, { eventId: 'desc' }],
    take: Math.min(Math.max(input.limit ?? 25, 1), 100) + 1,
  });
  const hasNext = rows.length > Math.min(Math.max(input.limit ?? 25, 1), 100);
  const page = hasNext ? rows.slice(0, -1) : rows;
  const actorIds = [...new Set(page.flatMap((row) => (row.actorId ? [row.actorId] : [])))];
  const actors = actorIds.length
    ? await tx.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorNames = new Map(actors.map((actor) => [actor.id, actor.name]));
  const last = page.at(-1);
  return AdminAuditListResponseSchema.parse({
    items: page.map((row) => ({
      eventId: row.eventId,
      actorId: row.actorId,
      actorName: row.actorId ? actorNames.get(row.actorId) ?? null : null,
      actorRole: row.actorRole,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      patientId: row.patientId,
      occurredAt: row.occurredAt.toISOString(),
      reason: row.reason,
      metadataSummary: metadataSummary(row.metadata),
    })),
    nextCursor: hasNext && last ? encodeCursor(last) : null,
  });
}
