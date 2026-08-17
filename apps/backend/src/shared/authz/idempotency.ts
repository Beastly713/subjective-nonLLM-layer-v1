import { createHash } from 'node:crypto';

import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { DomainError } from '../errors/domain-error.js';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function requireIdempotencyKey(value: string | string[] | undefined) {
  const key = Array.isArray(value) ? value[0] : value;
  if (!key || key.length > 255) {
    throw new DomainError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'A valid Idempotency-Key header is required.',
    );
  }
  return key;
}

export function idempotencyPayloadHash(payload: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(payload)))
    .digest('hex');
}

export async function executeIdempotently<T extends Prisma.InputJsonValue>(
  prisma: PrismaClient,
  actorId: string,
  action: string,
  key: string,
  payload: unknown,
  execute: (tx: Prisma.TransactionClient) => Promise<T>,
  responseStatus = 200,
) {
  const requestPayloadHash = idempotencyPayloadHash(payload);
  const lockIdentity = `${actorId}:${action}:${key}`;
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockIdentity}, 0))::text
      `;
      const record = await tx.idempotencyRecord.findUnique({
        where: {
          actorId_action_idempotencyKey: {
            actorId,
            action,
            idempotencyKey: key,
          },
        },
      });
      if (record) {
        if (record.requestPayloadHash !== requestPayloadHash) {
          throw new DomainError(
            409,
            'IDEMPOTENCY_KEY_REUSE',
            'The idempotency key was already used for a different request.',
          );
        }
        return { value: record.responseSnapshot as T, replayed: true };
      }

      const value = await execute(tx);
      await tx.idempotencyRecord.create({
        data: {
          actorId,
          action,
          idempotencyKey: key,
          requestPayloadHash,
          responseStatus,
          responseSnapshot: value,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        },
      });
      return { value, replayed: false };
    },
    { timeout: 15_000 },
  );
}
