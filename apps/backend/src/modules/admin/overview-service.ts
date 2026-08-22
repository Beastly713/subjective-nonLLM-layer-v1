import {
  AdminOverviewResponseSchema,
  type AdminOverviewResponse,
} from '@aud-subjective/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import type { Clock } from '../../shared/clock/clock.js';
import {
  CONTENT_INTERVENTION_CLASSES,
  CONTENT_LOCALE,
  HIGH_FREQUENCY_CLASSES,
} from '../content/types.js';

type Tx = Prisma.TransactionClient;

export async function readAdminOverview(
  tx: Tx,
  config: AppConfig,
  clock: Clock,
): Promise<AdminOverviewResponse> {
  const now = clock.now();
  const recentAuditFrom = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const [total, pending, active, disabled, draft, underReview, approved, retired, rejected, approvedResources, openTechnicalFailures, openIncidents, recentAuditEvents] =
    await Promise.all([
      tx.user.count({ where: { applicationAccount: { isNot: null } } }),
      tx.user.count({ where: { applicationAccount: { is: { state: 'PENDING' } } } }),
      tx.user.count({ where: { applicationAccount: { is: { state: 'ACTIVE' } } } }),
      tx.user.count({ where: { applicationAccount: { is: { state: 'DISABLED' } } } }),
      tx.contentResourceVersion.count({ where: { reviewStatus: 'DRAFT' } }),
      tx.contentResourceVersion.count({ where: { reviewStatus: 'UNDER_REVIEW' } }),
      tx.contentResourceVersion.count({ where: { reviewStatus: 'APPROVED' } }),
      tx.contentResourceVersion.count({ where: { reviewStatus: 'RETIRED' } }),
      tx.contentResourceVersion.count({ where: { reviewStatus: 'REJECTED' } }),
      tx.contentResourceVersion.findMany({
        where: { reviewStatus: 'APPROVED', enabled: true },
        select: { resourceId: true, interventionClass: true, locale: true },
      }),
      tx.technicalFailure.count({
        where: { status: { in: ['SUSPECTED', 'CONFIRMED'] } },
      }),
      tx.operationalIncident.count({ where: { resolvedAt: null } }),
      tx.auditEvent.count({ where: { occurredAt: { gte: recentAuditFrom } } }),
    ]);

  return AdminOverviewResponseSchema.parse({
    users: { total, pending, active, disabled },
    content: {
      draft,
      underReview,
      approved,
      retired,
      rejected,
      coverage: CONTENT_INTERVENTION_CLASSES.map((interventionClass) => {
        const resources = new Set(
          approvedResources
            .filter(
              (row) =>
                row.interventionClass === interventionClass &&
                row.locale === CONTENT_LOCALE,
            )
            .map((row) => row.resourceId),
        );
        const minimumRequired = HIGH_FREQUENCY_CLASSES.has(interventionClass)
          ? 3
          : 2;
        return {
          interventionClass,
          locale: CONTENT_LOCALE,
          approvedLogicalResources: resources.size,
          minimumRequired,
          met: resources.size >= minimumRequired,
        };
      }),
    },
    operations: { openTechnicalFailures, openIncidents, recentAuditEvents },
    localMode: config.appMode,
    productionDeferred: [
      'External email and SMS delivery remain production-deferred beyond the local capstone.',
      'Durable worker and scheduler infrastructure remains production-deferred beyond the local capstone.',
      'Production secret management, observability, and deployment automation remain production-deferred beyond the local capstone.',
    ],
  });
}
