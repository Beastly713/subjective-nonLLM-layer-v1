import type { Prisma } from '../../generated/prisma/client.js';

type PeriodBoundary = { periodStartAt: Date };

type PeriodContextDb = Pick<
  Prisma.TransactionClient,
  'profilePreferenceVersion' | 'recoveryGoalVersion'
>;

export async function resolvePreferencesForPeriod(
  db: PeriodContextDb,
  patientId: string,
  period: PeriodBoundary,
) {
  return db.profilePreferenceVersion.findFirst({
    where: {
      patientId,
      createdAt: { lte: period.periodStartAt },
    },
    orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
  });
}

export async function resolveRecoveryGoalForPeriod(
  db: PeriodContextDb,
  patientId: string,
  period: PeriodBoundary,
) {
  const candidates = await db.recoveryGoalVersion.findMany({
    where: {
      patientId,
      effectiveFromPeriodId: { not: null },
      effectiveFromPeriod: {
        is: { periodStartAt: { lte: period.periodStartAt } },
      },
    },
    include: { effectiveFromPeriod: true },
    orderBy: [{ goalVersion: 'desc' }, { id: 'desc' }],
  });

  return (
    candidates.sort((left, right) => {
      const leftStart = left.effectiveFromPeriod?.periodStartAt.getTime() ?? 0;
      const rightStart =
        right.effectiveFromPeriod?.periodStartAt.getTime() ?? 0;
      return (
        rightStart - leftStart ||
        right.goalVersion - left.goalVersion ||
        right.id.localeCompare(left.id)
      );
    })[0] ?? null
  );
}
