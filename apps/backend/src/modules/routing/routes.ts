import {
  ActivateRoutingRequestSchema,
  CreateRoutingDraftRequestSchema,
  EditRoutingDraftRequestSchema,
  RecordRoutingEvidenceRequestSchema,
  RoutingProfileDetailSchema,
  RoutingProfileListSchema,
  RoutingTargetInputSchema,
} from '@aud-subjective/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import {
  executeIdempotently,
  requireIdempotencyKey,
} from '../../shared/authz/idempotency.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import {
  projectRoutingDetail,
  projectRoutingSummary,
  routingDetailInclude,
} from './projections.js';
import { normalizeRegion, REQUIRED_ROUTING_TARGETS } from './service.js';

const ProfileParamsSchema = z.object({ profileId: z.uuid() });

function auditData(
  request: FastifyRequest,
  actorId: string,
  action: string,
  profileId: string,
  reason: string,
): Prisma.AuditEventUncheckedCreateInput {
  return {
    actorId,
    action,
    entityType: 'REGIONAL_ROUTING_PROFILE',
    entityId: profileId,
    reason,
    requestId: request.id,
  };
}

async function lockRegion(tx: Prisma.TransactionClient, regionKey: string) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`routing:${regionKey}`}, 0))::text
  `;
}

async function loadDetail(prisma: PrismaClient, profileId: string) {
  const profile = await prisma.regionalRoutingProfileVersion.findUnique({
    where: { id: profileId },
    include: routingDetailInclude,
  });
  if (!profile)
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  return projectRoutingDetail(profile);
}

export function registerRoutingRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.get('/api/v1/admin/configuration/regional-routing', async (request) => {
    await requirePermission(
      request,
      auth,
      prisma,
      config,
      'ROUTING_CONFIG_READ',
    );
    const profiles = await prisma.regionalRoutingProfileVersion.findMany({
      orderBy: [{ regionKey: 'asc' }, { logicalVersion: 'desc' }],
    });
    return RoutingProfileListSchema.parse({
      items: profiles.map(projectRoutingSummary),
    });
  });

  app.get(
    '/api/v1/admin/configuration/regional-routing/:profileId',
    async (request) => {
      await requirePermission(
        request,
        auth,
        prisma,
        config,
        'ROUTING_CONFIG_READ',
      );
      return loadDetail(
        prisma,
        ProfileParamsSchema.parse(request.params).profileId,
      );
    },
  );

  app.post(
    '/api/v1/admin/configuration/regional-routing/drafts',
    async (request, reply) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'ROUTING_CONFIG_EDIT',
        { fresh: true },
      );
      const body = CreateRoutingDraftRequestSchema.parse(request.body);
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const region = normalizeRegion(body.countryCode, body.regionCode);
      const canonical = { ...region, reason: body.reason };
      const execution = await executeIdempotently(
        prisma,
        actor.userId,
        'ROUTING_DRAFT_CREATE',
        key,
        canonical,
        async (tx) => {
          await lockRegion(tx, region.regionKey);
          const latest = await tx.regionalRoutingProfileVersion.findFirst({
            where: { regionKey: region.regionKey },
            orderBy: { logicalVersion: 'desc' },
          });
          const profile = await tx.regionalRoutingProfileVersion.create({
            data: {
              ...region,
              logicalVersion: (latest?.logicalVersion ?? 0) + 1,
              createdAt: clock.now(),
              createdByUserId: actor.userId,
              provenance: body.reason,
            },
            include: routingDetailInclude,
          });
          await tx.auditEvent.create({
            data: auditData(
              request,
              actor.userId,
              'ROUTING_DRAFT_CREATE',
              profile.id,
              body.reason,
            ),
          });
          return projectRoutingDetail(profile);
        },
        201,
      );
      return reply
        .status(201)
        .send(RoutingProfileDetailSchema.parse(execution.value));
    },
  );

  app.post(
    '/api/v1/admin/configuration/regional-routing/:profileId/edit',
    async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'ROUTING_CONFIG_EDIT',
        { fresh: true },
      );
      const { profileId } = ProfileParamsSchema.parse(request.params);
      const parsedBody = EditRoutingDraftRequestSchema.safeParse(request.body);
      if (!parsedBody.success)
        throw new DomainError(
          400,
          'VALIDATION_ERROR',
          'The routing target configuration is invalid.',
        );
      const body = parsedBody.data;
      if (
        new Set(body.targets.map(({ kind }) => kind)).size !==
        REQUIRED_ROUTING_TARGETS.length
      )
        throw new DomainError(
          400,
          'VALIDATION_ERROR',
          'All required routing targets must be supplied exactly once.',
        );
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const canonical = { profileId, ...body };
      const execution = await executeIdempotently(
        prisma,
        actor.userId,
        'ROUTING_DRAFT_EDIT',
        key,
        canonical,
        async (tx) => {
          const updated = await tx.regionalRoutingProfileVersion.updateMany({
            where: {
              id: profileId,
              lifecycle: 'DRAFT',
              rowVersion: body.expectedVersion,
            },
            data: {
              rowVersion: { increment: 1 },
              configurationRevision: { increment: 1 },
            },
          });
          if (updated.count !== 1)
            throw new DomainError(
              409,
              'VERSION_CONFLICT',
              'The routing draft changed before this action.',
            );
          for (const target of body.targets) {
            await tx.regionalRoutingTarget.upsert({
              where: { profileId_kind: { profileId, kind: target.kind } },
              create: { profileId, ...target },
              update: {
                representation: target.representation,
                targetValue: target.targetValue,
                label: target.label,
              },
            });
          }
          await tx.auditEvent.create({
            data: auditData(
              request,
              actor.userId,
              'ROUTING_DRAFT_EDIT',
              profileId,
              body.reason,
            ),
          });
          const profile =
            await tx.regionalRoutingProfileVersion.findUniqueOrThrow({
              where: { id: profileId },
              include: routingDetailInclude,
            });
          return projectRoutingDetail(profile);
        },
      );
      return RoutingProfileDetailSchema.parse(execution.value);
    },
  );

  app.post(
    '/api/v1/admin/configuration/regional-routing/:profileId/test-evidence',
    async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'ROUTING_TEST_RECORD',
        { fresh: true },
      );
      const { profileId } = ProfileParamsSchema.parse(request.params);
      const body = RecordRoutingEvidenceRequestSchema.parse(request.body);
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const canonical = { profileId, ...body };
      const execution = await executeIdempotently(
        prisma,
        actor.userId,
        'ROUTING_TEST_RECORD',
        key,
        canonical,
        async (tx) => {
          const profile = await tx.regionalRoutingProfileVersion.findUnique({
            where: { id: profileId },
          });
          if (
            !profile ||
            profile.lifecycle !== 'DRAFT' ||
            profile.rowVersion !== body.expectedVersion
          )
            throw new DomainError(
              409,
              'VERSION_CONFLICT',
              'The routing draft changed before this action.',
            );
          const target = await tx.regionalRoutingTarget.findUnique({
            where: { profileId_kind: { profileId, kind: body.targetKind } },
          });
          if (!target)
            throw new DomainError(
              404,
              'NOT_FOUND',
              'The requested resource was not found.',
            );
          const updated = await tx.regionalRoutingProfileVersion.updateMany({
            where: {
              id: profileId,
              lifecycle: 'DRAFT',
              rowVersion: body.expectedVersion,
            },
            data: { rowVersion: { increment: 1 } },
          });
          if (updated.count !== 1)
            throw new DomainError(
              409,
              'VERSION_CONFLICT',
              'The routing draft changed before this action.',
            );
          await tx.regionalRoutingTestEvidence.create({
            data: {
              profileId,
              targetId: target.id,
              targetKind: target.kind,
              configurationRevision: profile.configurationRevision,
              result: body.result,
              provenance: body.provenance,
              testedAt: clock.now(),
              testedByUserId: actor.userId,
            },
          });
          await tx.auditEvent.create({
            data: auditData(
              request,
              actor.userId,
              'ROUTING_TEST_RECORD',
              profileId,
              body.provenance,
            ),
          });
          const result =
            await tx.regionalRoutingProfileVersion.findUniqueOrThrow({
              where: { id: profileId },
              include: routingDetailInclude,
            });
          return projectRoutingDetail(result);
        },
      );
      return RoutingProfileDetailSchema.parse(execution.value);
    },
  );

  app.post(
    '/api/v1/admin/configuration/regional-routing/:profileId/activate',
    async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'ROUTING_CONFIG_ACTIVATE',
        { fresh: true },
      );
      const { profileId } = ProfileParamsSchema.parse(request.params);
      const body = ActivateRoutingRequestSchema.parse(request.body);
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const canonical = { profileId, ...body };
      const execution = await executeIdempotently(
        prisma,
        actor.userId,
        'ROUTING_ACTIVATE',
        key,
        canonical,
        async (tx) => {
          const candidate = await tx.regionalRoutingProfileVersion.findUnique({
            where: { id: profileId },
            select: { id: true, regionKey: true },
          });
          if (!candidate)
            throw new DomainError(
              409,
              'VERSION_CONFLICT',
              'The routing draft changed before this action.',
            );
          await lockRegion(tx, candidate.regionKey);
          const profile = await tx.regionalRoutingProfileVersion.findUnique({
            where: { id: profileId },
            include: routingDetailInclude,
          });
          if (
            !profile ||
            profile.lifecycle !== 'DRAFT' ||
            profile.rowVersion !== body.expectedVersion
          )
            throw new DomainError(
              409,
              'VERSION_CONFLICT',
              'The routing draft changed before this action.',
            );
          const latestProfile =
            await tx.regionalRoutingProfileVersion.findFirst({
            where: { regionKey: profile.regionKey },
            orderBy: { logicalVersion: 'desc' },
            select: { id: true },
          });
          if (latestProfile?.id !== profile.id)
            throw new DomainError(
              409,
              'VERSION_CONFLICT',
              'A newer routing draft exists for this region.',
            );
          if (profile.targets.length !== REQUIRED_ROUTING_TARGETS.length)
            throw new DomainError(
              409,
              'ROUTING_TEST_EVIDENCE_REQUIRED',
              'All required routing targets must be configured and tested.',
            );
          for (const target of profile.targets) {
            const validation = RoutingTargetInputSchema.safeParse({
              kind: target.kind,
              representation: target.representation,
              targetValue: target.targetValue,
              label: target.label,
            });
            if (!validation.success)
              throw new DomainError(
                400,
                'VALIDATION_ERROR',
                'The stored routing target configuration is invalid.',
              );
          }
          for (const kind of REQUIRED_ROUTING_TARGETS) {
            const evidence = profile.testEvidence.find(
              (item) =>
                item.targetKind === kind &&
                item.configurationRevision === profile.configurationRevision,
            );
            if (!evidence || evidence.result !== 'PASS')
              throw new DomainError(
                409,
                'ROUTING_TEST_EVIDENCE_REQUIRED',
                'Current successful evidence is required for every routing target.',
              );
          }
          const now = clock.now();
          await tx.regionalRoutingProfileVersion.updateMany({
            where: { regionKey: profile.regionKey, lifecycle: 'ACTIVE' },
            data: {
              lifecycle: 'SUPERSEDED',
              supersededAt: now,
              rowVersion: { increment: 1 },
            },
          });
          const activated = await tx.regionalRoutingProfileVersion.updateMany({
            where: {
              id: profileId,
              lifecycle: 'DRAFT',
              rowVersion: body.expectedVersion,
            },
            data: {
              lifecycle: 'ACTIVE',
              effectiveAt: now,
              rowVersion: { increment: 1 },
            },
          });
          if (activated.count !== 1)
            throw new DomainError(
              409,
              'VERSION_CONFLICT',
              'The routing draft changed before this action.',
            );
          await tx.auditEvent.create({
            data: auditData(
              request,
              actor.userId,
              'ROUTING_ACTIVATE',
              profileId,
              body.reason,
            ),
          });
          const result =
            await tx.regionalRoutingProfileVersion.findUniqueOrThrow({
              where: { id: profileId },
              include: routingDetailInclude,
            });
          return projectRoutingDetail(result);
        },
      );
      return RoutingProfileDetailSchema.parse(execution.value);
    },
  );
}
