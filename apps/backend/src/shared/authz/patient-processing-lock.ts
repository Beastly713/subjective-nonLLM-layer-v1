import type { Prisma } from '../../generated/prisma/client.js';
import { DomainError } from '../errors/domain-error.js';

export async function lockPatientForProcessing(
  tx: Prisma.TransactionClient,
  patientId: string,
) {
  const locks = await tx.$queryRaw<Array<{ patient_id: string }>>`
    SELECT "patient_id" FROM "patient_processing_locks" WHERE "patient_id" = ${patientId}::uuid FOR UPDATE
  `;
  if (locks.length !== 1)
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
}
