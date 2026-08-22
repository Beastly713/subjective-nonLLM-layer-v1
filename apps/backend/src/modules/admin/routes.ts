import {
  AdminContentListResponseSchema,
  AdminContentVersionSchema,
  AdminOverviewResponseSchema,
  ContentInterventionClassSchema,
  CreateAdminContentRequestSchema,
  TransitionAdminContentRequestSchema,
  UpdateAdminContentRequestSchema,
} from '@aud-subjective/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import {
  executeIdempotently,
  requireIdempotencyKey,
} from '../../shared/authz/idempotency.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { readAdminAudit } from './audit-service.js';
import {
  createAdminContent,
  readAdminContent,
  readAdminContentDetail,
  transitionAdminContent,
  updateAdminContentDraft,
} from './content-governance-service.js';
import { readAdminOverview } from './overview-service.js';

const ResourceParamsSchema = z.object({ resourceId: z.uuid() });
const ContentListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'RETIRED', 'REJECTED']).optional(),
  interventionClass: ContentInterventionClassSchema.optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});
const AuditQuerySchema = z.object({
  patientId: z.uuid().optional(),
  entityType: z.string().trim().max(128).optional(),
  entityId: z.string().trim().max(255).optional(),
  action: z.string().trim().max(128).optional(),
  actorId: z.uuid().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

function requireAdminScope(actor: Awaited<ReturnType<typeof requirePermission>>) {
  if (!actor.access.scopeKinds.includes('ADMIN_OPERATIONAL')) {
    throw new DomainError(403, 'PERMISSION_DENIED', 'The action is not permitted.');
  }
}

export function registerAdminRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.get('/api/v1/admin/overview', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'ADMIN_OVERVIEW_READ');
    requireAdminScope(actor);
    return AdminOverviewResponseSchema.parse(
      await prisma.$transaction((tx) => readAdminOverview(tx, config, clock)),
    );
  });

  app.get('/api/v1/admin/content', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'CONTENT_RESOURCE_READ');
    requireAdminScope(actor);
    const query = ContentListQuerySchema.parse(request.query);
    return AdminContentListResponseSchema.parse(
      await prisma.$transaction((tx) => readAdminContent(tx, query)),
    );
  });

  app.get('/api/v1/admin/content/:resourceId', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'CONTENT_RESOURCE_READ');
    requireAdminScope(actor);
    const { resourceId } = ResourceParamsSchema.parse(request.params);
    return AdminContentListResponseSchema.parse(
      await prisma.$transaction((tx) => readAdminContentDetail(tx, resourceId)),
    );
  });

  app.post('/api/v1/admin/content', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'CONTENT_RESOURCE_EDIT', { fresh: true });
    requireAdminScope(actor);
    const body = CreateAdminContentRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'ADMIN_CONTENT_CREATE',
      key,
      body,
      (tx) => createAdminContent({ tx, body, actorId: actor.userId, requestId: request.id, clock }),
    );
    return AdminContentVersionSchema.parse(result.value);
  });

  app.post('/api/v1/admin/content/:resourceId/versions', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'CONTENT_RESOURCE_EDIT', { fresh: true });
    requireAdminScope(actor);
    const { resourceId } = ResourceParamsSchema.parse(request.params);
    const body = CreateAdminContentRequestSchema.parse({
      ...(request.body as Record<string, unknown>),
      resourceId,
    });
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'ADMIN_CONTENT_VERSION_CREATE',
      key,
      body,
      (tx) => createAdminContent({ tx, body, actorId: actor.userId, requestId: request.id, clock }),
    );
    return AdminContentVersionSchema.parse(result.value);
  });

  app.put('/api/v1/admin/content/:resourceId/versions/:versionId', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'CONTENT_RESOURCE_EDIT', { fresh: true });
    requireAdminScope(actor);
    const { resourceId, versionId } = z.object({ resourceId: z.uuid(), versionId: z.uuid() }).parse(request.params);
    const body = UpdateAdminContentRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'ADMIN_CONTENT_DRAFT_UPDATE',
      key,
      { resourceId, versionId, ...body },
      async (tx) => {
        const value = await updateAdminContentDraft({ tx, versionId, body, actorId: actor.userId, requestId: request.id, clock });
        if (value.resourceId !== resourceId) {
          throw new DomainError(404, 'CONTENT_VERSION_NOT_FOUND', 'The content version was not found.');
        }
        return value;
      },
    );
    return AdminContentVersionSchema.parse(result.value);
  });

  for (const action of ['SUBMIT_REVIEW', 'APPROVE', 'REJECT', 'RETIRE'] as const) {
    const pathAction = action === 'SUBMIT_REVIEW' ? 'submit-review' : action.toLowerCase();
    app.post(`/api/v1/admin/content/:resourceId/versions/:versionId/${pathAction}`, async (request) => {
      const permission = action === 'SUBMIT_REVIEW' ? 'CONTENT_RESOURCE_EDIT' : 'CONTENT_RESOURCE_APPROVE';
      const actor = await requirePermission(request, auth, prisma, config, permission, { fresh: true });
      requireAdminScope(actor);
      const { resourceId, versionId } = z.object({ resourceId: z.uuid(), versionId: z.uuid() }).parse(request.params);
      const body = TransitionAdminContentRequestSchema.parse(request.body);
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const result = await executeIdempotently(
        prisma,
        actor.userId,
        `ADMIN_CONTENT_${action}`,
        key,
        { resourceId, versionId, ...body },
        async (tx) => {
          const value = await transitionAdminContent({ tx, versionId, action, body, actorId: actor.userId, requestId: request.id, clock });
          if (value.resourceId !== resourceId) {
            throw new DomainError(404, 'CONTENT_VERSION_NOT_FOUND', 'The content version was not found.');
          }
          return value;
        },
      );
      return AdminContentVersionSchema.parse(result.value);
    });
  }

  app.get('/api/v1/admin/audit', async (request) => {
    const actor = await requirePermission(request, auth, prisma, config, 'AUDIT_READ');
    requireAdminScope(actor);
    const query = AuditQuerySchema.parse(request.query);
    return prisma.$transaction((tx) => readAdminAudit(tx, query));
  });
}
