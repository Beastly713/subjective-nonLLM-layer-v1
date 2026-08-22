import {
  AdminContentListResponseSchema,
  type AdminContentVersion,
  type CreateAdminContentRequest,
  type TransitionAdminContentRequest,
  type UpdateAdminContentRequest,
} from '@aud-subjective/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';

type Tx = Prisma.TransactionClient;
type ContentVersionRow = Prisma.ContentResourceVersionGetPayload<{}>;

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function stringArray(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function projectVersion(row: ContentVersionRow): AdminContentVersion {
  return {
    resourceId: row.resourceId,
    versionId: row.id,
    version: row.version,
    interventionClass: row.interventionClass,
    locale: row.locale,
    language: row.language,
    recoveryGoalsAllowed: stringArray(row.recoveryGoalsAllowed),
    deliveryChannels: stringArray(row.deliveryChannels),
    mutualHelpRequirement: row.mutualHelpRequirement,
    spiritualRequirement: row.spiritualRequirement,
    contraindications: stringArray(row.contraindications),
    safetyGateCompatibility: stringArray(row.safetyGateCompatibility),
    estimatedDurationSeconds: row.estimatedDurationSeconds,
    title: row.title,
    markdownBody: row.markdownBody,
    reviewStatus: row.reviewStatus,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    effectiveFrom: row.effectiveFrom.toISOString(),
    retiredAt: row.retiredAt?.toISOString() ?? null,
    enabled: row.enabled,
    rowVersion: row.rowVersion,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function auditMetadata(input: {
  resourceId: string;
  versionId: string;
  reviewStatus: string;
  rowVersion: number;
}) {
  return json({
    resourceId: input.resourceId,
    versionId: input.versionId,
    reviewStatus: input.reviewStatus,
    rowVersion: input.rowVersion,
  });
}

async function loadVersion(tx: Tx, versionId: string) {
  const version = await tx.contentResourceVersion.findUnique({
    where: { id: versionId },
  });
  if (!version) {
    throw new DomainError(
      404,
      'CONTENT_VERSION_NOT_FOUND',
      'The content version was not found.',
    );
  }
  return version;
}

function assertRowVersion(actual: number, expected: number) {
  if (actual !== expected) {
    throw new DomainError(
      409,
      'VERSION_CONFLICT',
      'The content changed since it was loaded. Refresh before saving.',
    );
  }
}

export async function readAdminContent(
  tx: Tx,
  input: {
    status?: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'RETIRED' | 'REJECTED' | undefined;
    interventionClass?: string | undefined;
    search?: string | undefined;
    limit?: number | undefined;
  } = {},
) {
  const search = input.search?.trim();
  const rows = await tx.contentResourceVersion.findMany({
    where: {
      ...(input.status ? { reviewStatus: input.status } : {}),
      ...(input.interventionClass
        ? { interventionClass: input.interventionClass as never }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              {
                interventionClass: {
                  equals: search as never,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.max(input.limit ?? 100, 1), 100),
  });
  return AdminContentListResponseSchema.parse({
    items: rows.map(projectVersion),
  });
}

export async function readAdminContentDetail(tx: Tx, resourceId: string) {
  const rows = await tx.contentResourceVersion.findMany({
    where: { resourceId },
    orderBy: [{ version: 'desc' }, { id: 'desc' }],
  });
  if (rows.length === 0) {
    throw new DomainError(
      404,
      'CONTENT_RESOURCE_NOT_FOUND',
      'The content resource was not found.',
    );
  }
  return AdminContentListResponseSchema.parse({
    items: rows.map(projectVersion),
  });
}

function versionCreateData(
  body: CreateAdminContentRequest,
  actorId: string,
  version: number,
  resourceId: string,
): Prisma.ContentResourceVersionUncheckedCreateInput {
  return {
    resourceId,
    version,
    interventionClass: body.interventionClass,
    locale: body.locale,
    language: body.language,
    recoveryGoalsAllowed: json(body.recoveryGoalsAllowed),
    deliveryChannels: json(body.deliveryChannels),
    mutualHelpRequirement: body.mutualHelpRequirement,
    spiritualRequirement: body.spiritualRequirement,
    contraindications: json(body.contraindications),
    safetyGateCompatibility: json(body.safetyGateCompatibility),
    estimatedDurationSeconds: body.estimatedDurationSeconds,
    title: body.title,
    markdownBody: body.markdownBody,
    reviewStatus: 'DRAFT',
    reviewedByUserId: null,
    reviewedAt: null,
    effectiveFrom: new Date(body.effectiveFrom),
    retiredAt: null,
    enabled: body.enabled,
    provenance: json({ mode: 'admin_governance', createdByUserId: actorId }),
  };
}

export async function createAdminContent(input: {
  tx: Tx;
  body: CreateAdminContentRequest;
  actorId: string;
  requestId: string;
  clock: Clock;
}) {
  const resource = input.body.resourceId
    ? await input.tx.contentResource.findUnique({
        where: { id: input.body.resourceId },
      })
    : await input.tx.contentResource.create({
        data: {
          interventionClass: input.body.interventionClass,
          createdByUserId: input.actorId,
        },
      });
  if (!resource) {
    throw new DomainError(
      404,
      'CONTENT_RESOURCE_NOT_FOUND',
      'The content resource was not found.',
    );
  }
  if (resource.interventionClass !== input.body.interventionClass) {
    throw new DomainError(
      409,
      'CONTENT_INTERVENTION_CLASS_MISMATCH',
      'A new version must keep the resource intervention class.',
    );
  }
  const maxVersion = await input.tx.contentResourceVersion.aggregate({
    where: { resourceId: resource.id },
    _max: { version: true },
  });
  const row = await input.tx.contentResourceVersion.create({
    data: versionCreateData(
      input.body,
      input.actorId,
      (maxVersion._max.version ?? 0) + 1,
      resource.id,
    ),
  });
  const value = projectVersion(row);
  await input.tx.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: 'CONTENT_VERSION_CREATED',
      entityType: 'CONTENT_RESOURCE_VERSION',
      entityId: row.id,
      requestId: input.requestId,
      occurredAt: input.clock.now(),
      metadata: auditMetadata({
        resourceId: row.resourceId,
        versionId: row.id,
        reviewStatus: row.reviewStatus,
        rowVersion: row.rowVersion,
      }),
    },
  });
  return value;
}

export async function updateAdminContentDraft(input: {
  tx: Tx;
  versionId: string;
  body: UpdateAdminContentRequest;
  actorId: string;
  requestId: string;
  clock: Clock;
}) {
  const current = await loadVersion(input.tx, input.versionId);
  assertRowVersion(current.rowVersion, input.body.expectedRowVersion);
  if (current.reviewStatus !== 'DRAFT') {
    throw new DomainError(
      409,
      'CONTENT_VERSION_IMMUTABLE',
      'Only draft content can be edited.',
    );
  }
  const body = input.body;
  const row = await input.tx.contentResourceVersion.update({
    where: { id: current.id },
    data: {
      ...(body.interventionClass === undefined
        ? {}
        : { interventionClass: body.interventionClass }),
      ...(body.locale === undefined ? {} : { locale: body.locale }),
      ...(body.language === undefined ? {} : { language: body.language }),
      ...(body.recoveryGoalsAllowed === undefined
        ? {}
        : { recoveryGoalsAllowed: json(body.recoveryGoalsAllowed) }),
      ...(body.deliveryChannels === undefined
        ? {}
        : { deliveryChannels: json(body.deliveryChannels) }),
      ...(body.mutualHelpRequirement === undefined
        ? {}
        : { mutualHelpRequirement: body.mutualHelpRequirement }),
      ...(body.spiritualRequirement === undefined
        ? {}
        : { spiritualRequirement: body.spiritualRequirement }),
      ...(body.contraindications === undefined
        ? {}
        : { contraindications: json(body.contraindications) }),
      ...(body.safetyGateCompatibility === undefined
        ? {}
        : { safetyGateCompatibility: json(body.safetyGateCompatibility) }),
      ...(body.estimatedDurationSeconds === undefined
        ? {}
        : { estimatedDurationSeconds: body.estimatedDurationSeconds }),
      ...(body.title === undefined ? {} : { title: body.title }),
      ...(body.markdownBody === undefined
        ? {}
        : { markdownBody: body.markdownBody }),
      ...(body.effectiveFrom === undefined
        ? {}
        : { effectiveFrom: new Date(body.effectiveFrom) }),
      ...(body.enabled === undefined ? {} : { enabled: body.enabled }),
      rowVersion: { increment: 1 },
    },
  });
  const value = projectVersion(row);
  await input.tx.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: 'CONTENT_VERSION_DRAFT_UPDATED',
      entityType: 'CONTENT_RESOURCE_VERSION',
      entityId: row.id,
      requestId: input.requestId,
      occurredAt: input.clock.now(),
      metadata: auditMetadata({
        resourceId: row.resourceId,
        versionId: row.id,
        reviewStatus: row.reviewStatus,
        rowVersion: row.rowVersion,
      }),
    },
  });
  return value;
}

export async function transitionAdminContent(input: {
  tx: Tx;
  versionId: string;
  action: 'SUBMIT_REVIEW' | 'APPROVE' | 'REJECT' | 'RETIRE';
  body: TransitionAdminContentRequest;
  actorId: string;
  requestId: string;
  clock: Clock;
}) {
  const current = await loadVersion(input.tx, input.versionId);
  assertRowVersion(current.rowVersion, input.body.expectedRowVersion);
  const nextStatus =
    input.action === 'SUBMIT_REVIEW'
      ? 'UNDER_REVIEW'
      : input.action === 'APPROVE'
        ? 'APPROVED'
        : input.action === 'REJECT'
          ? 'REJECTED'
          : 'RETIRED';
  const valid =
    (input.action === 'SUBMIT_REVIEW' && current.reviewStatus === 'DRAFT') ||
    (input.action === 'APPROVE' && current.reviewStatus === 'UNDER_REVIEW') ||
    (input.action === 'REJECT' && current.reviewStatus === 'UNDER_REVIEW') ||
    (input.action === 'RETIRE' && current.reviewStatus === 'APPROVED');
  if (!valid) {
    throw new DomainError(
      409,
      'CONTENT_INVALID_TRANSITION',
      `Content cannot transition from ${current.reviewStatus} using ${input.action}.`,
    );
  }
  if (
    (input.action === 'REJECT' || input.action === 'RETIRE') &&
    !input.body.reason?.trim()
  ) {
    throw new DomainError(
      400,
      'CONTENT_REASON_REQUIRED',
      'A reason is required for rejection and retirement.',
    );
  }

  const now = input.clock.now();
  if (input.action === 'APPROVE') {
    await input.tx.contentResourceVersion.updateMany({
      where: {
        resourceId: current.resourceId,
        reviewStatus: 'APPROVED',
        id: { not: current.id },
      },
      data: {
        reviewStatus: 'RETIRED',
        retiredAt: now,
        enabled: false,
        rowVersion: { increment: 1 },
      },
    });
  }

  const row = await input.tx.contentResourceVersion.update({
    where: { id: current.id },
    data: {
      reviewStatus: nextStatus,
      ...(input.action === 'APPROVE' || input.action === 'REJECT'
        ? { reviewedByUserId: input.actorId, reviewedAt: now }
        : {}),
      ...(input.action === 'REJECT'
        ? { enabled: false }
        : input.action === 'RETIRE'
          ? { enabled: false, retiredAt: now }
          : {}),
      rowVersion: { increment: 1 },
    },
  });
  const value = projectVersion(row);
  await input.tx.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: `CONTENT_VERSION_${input.action}`,
      entityType: 'CONTENT_RESOURCE_VERSION',
      entityId: row.id,
      requestId: input.requestId,
      ...(input.body.reason ? { reason: input.body.reason } : {}),
      occurredAt: now,
      metadata: auditMetadata({
        resourceId: row.resourceId,
        versionId: row.id,
        reviewStatus: row.reviewStatus,
        rowVersion: row.rowVersion,
      }),
    },
  });
  return value;
}
