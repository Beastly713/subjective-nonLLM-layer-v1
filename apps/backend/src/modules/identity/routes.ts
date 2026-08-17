import {
  AccountStateMutationRequestSchema,
  ActionResultSchema,
  AdminUserListResponseSchema,
  AdminUserResponseSchema,
  CreatePatientAssignmentRequestSchema,
  EndPatientAssignmentRequestSchema,
  GrantRoleRequestSchema,
  ProvisionUserRequestSchema,
  RevokeRoleRequestSchema,
  VerifyIdentityRequestSchema,
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
import {
  isValidRoleWorkspace,
  PRIVILEGED_ROLES,
} from '../../shared/authz/permissions.js';
import { normalizeMonitoringTimezone } from '../../shared/authz/timezone.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import {
  adminUserDetailInclude,
  adminUserInclude,
  projectAdminUser,
  projectAdminUserDetail,
} from './projections.js';

const UserIdParamsSchema = z.object({ userId: z.uuid() });
const RoleParamsSchema = z.object({ userId: z.uuid(), assignmentId: z.uuid() });
const AssignmentParamsSchema = z.object({ assignmentId: z.uuid() });
const ListQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
  state: z.enum(['PENDING', 'ACTIVE', 'DISABLED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

function auditData(
  request: FastifyRequest,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  reason?: string,
): Prisma.AuditEventUncheckedCreateInput {
  return {
    actorId,
    action,
    entityType,
    entityId,
    requestId: request.id,
    ...(reason ? { reason } : {}),
  };
}

async function loadAdminUser(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: adminUserDetailInclude,
  });
  const projected = user ? projectAdminUserDetail(user) : null;
  if (!projected)
    throw new DomainError(
      404,
      'NOT_FOUND',
      'The requested resource was not found.',
    );
  return projected;
}

export function registerIdentityRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  provisioningAuth: AppAuth,
  config: AppConfig,
) {
  app.get('/api/v1/admin/users', async (request) => {
    await requirePermission(request, auth, prisma, config, 'USER_ACCESS_READ');
    const query = ListQuerySchema.parse(request.query);
    const where = {
      applicationAccount: {
        is: query.state ? { state: query.state } : {},
      },
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                email: { contains: query.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include: adminUserInclude,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return AdminUserListResponseSchema.parse({
      items: users.map(projectAdminUser).filter(Boolean),
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  });

  app.get('/api/v1/admin/users/:userId', async (request) => {
    await requirePermission(request, auth, prisma, config, 'USER_ACCESS_READ');
    const { userId } = UserIdParamsSchema.parse(request.params);
    return loadAdminUser(prisma, userId);
  });

  app.post('/api/v1/admin/users', async (request, reply) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'USER_PROVISION',
      { fresh: true },
    );
    const body = ProvisionUserRequestSchema.parse(request.body);
    if (!isValidRoleWorkspace(body.role, body.workspace))
      throw new DomainError(
        400,
        'INVALID_ROLE_WORKSPACE',
        'The role and workspace do not match.',
      );
    const monitoringTimezone =
      body.role === 'PATIENT'
        ? normalizeMonitoringTimezone(body.monitoringTimezone ?? '')
        : undefined;
    if (body.role !== 'PATIENT' && body.monitoringTimezone)
      throw new DomainError(
        400,
        'INVALID_ROLE_WORKSPACE',
        'Only patient accounts have a monitoring timezone.',
      );

    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const action = 'USER_PROVISION';
    const canonicalRequest = {
      name: body.name,
      email: body.email.toLowerCase(),
      workspace: body.workspace,
      role: body.role,
      monitoringTimezone: monitoringTimezone ?? null,
      reason: body.reason,
    };
    let createdUserId: string | undefined;
    try {
      const execution = await executeIdempotently(
        prisma,
        actor.userId,
        action,
        key,
        canonicalRequest,
        async (tx) => {
          if (await tx.user.findUnique({ where: { email: body.email } }))
            throw new DomainError(
              409,
              'ACCOUNT_ALREADY_PROVISIONED',
              'The account is already provisioned.',
            );
          const credential = await provisioningAuth.api.signUpEmail({
            body: {
              name: body.name,
              email: body.email,
              password: body.initialPassword,
            },
          });
          const userId = credential.user.id;
          createdUserId = userId;
          await tx.applicationAccount.create({
            data: {
              userId,
              state: 'PENDING',
              createdByUserId: actor.userId,
            },
          });
          await tx.userRoleAssignment.create({
            data: {
              userId,
              workspace: body.workspace,
              role: body.role,
              grantedByUserId: actor.userId,
              grantReason: body.reason,
            },
          });
          if (body.role === 'PATIENT' && monitoringTimezone) {
            await tx.patientProfile.create({
              data: {
                patientId: userId,
                monitoringTimezone,
                createdByUserId: actor.userId,
                updatedByUserId: actor.userId,
                preferences: {
                  create: {
                    version: 1,
                    mutualHelpPreference: null,
                    spiritualContentPreference: null,
                    createdByUserId: actor.userId,
                  },
                },
                processingLock: { create: {} },
              },
            });
          }
          await tx.auditEvent.create({
            data: auditData(
              request,
              actor.userId,
              action,
              'USER',
              userId,
              body.reason,
            ),
          });
          const created = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            include: adminUserInclude,
          });
          const projected = projectAdminUser(created);
          if (!projected)
            throw new Error('Provisioned account projection failed.');
          return projected;
        },
        201,
      );
      return reply
        .status(201)
        .send(AdminUserResponseSchema.parse(execution.value));
    } catch (error) {
      if (createdUserId)
        await prisma.user.deleteMany({ where: { id: createdUserId } });
      throw error;
    }
  });

  for (const transition of ['enable', 'disable'] as const) {
    app.post(`/api/v1/admin/users/:userId/${transition}`, async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'USER_STATE_MANAGE',
        { fresh: true },
      );
      const { userId } = UserIdParamsSchema.parse(request.params);
      const body = AccountStateMutationRequestSchema.parse(request.body);
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const action = transition === 'enable' ? 'USER_ENABLE' : 'USER_DISABLE';
      const canonical = { userId, ...body };
      const execution = await executeIdempotently(
        prisma,
        actor.userId,
        action,
        key,
        canonical,
        async (tx) => {
          const updated = await tx.applicationAccount.updateMany({
            where: { userId, version: body.expectedVersion },
            data: {
              state: transition === 'enable' ? 'ACTIVE' : 'DISABLED',
              version: { increment: 1 },
              disabledAt: transition === 'disable' ? new Date() : null,
              disabledByUserId: transition === 'disable' ? actor.userId : null,
              disableReason: transition === 'disable' ? body.reason : null,
            },
          });
          if (updated.count !== 1)
            throw new DomainError(
              409,
              'VERSION_CONFLICT',
              'The account changed before this action.',
            );
          const account = await tx.applicationAccount.findUniqueOrThrow({
            where: { userId },
          });
          const result = ActionResultSchema.parse({
            id: userId,
            version: account.version,
            status: account.state,
          });
          await tx.auditEvent.create({
            data: auditData(
              request,
              actor.userId,
              action,
              'APPLICATION_ACCOUNT',
              userId,
              body.reason,
            ),
          });
          await tx.session.deleteMany({ where: { userId } });
          return result;
        },
      );
      return ActionResultSchema.parse(execution.value);
    });
  }

  app.post('/api/v1/admin/users/:userId/verify-identity', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PRIVILEGED_IDENTITY_VERIFY',
      { fresh: true },
    );
    const { userId } = UserIdParamsSchema.parse(request.params);
    const body = VerifyIdentityRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const action = 'PRIVILEGED_IDENTITY_VERIFY';
    const canonical = { userId, ...body };
    const execution = await executeIdempotently(
      prisma,
      actor.userId,
      action,
      key,
      canonical,
      async (tx) => {
        const privilegedRole = await tx.userRoleAssignment.findFirst({
          where: {
            userId,
            role: { in: [...PRIVILEGED_ROLES] },
            revokedAt: null,
          },
        });
        if (!privilegedRole)
          throw new DomainError(
            400,
            'INVALID_ROLE_WORKSPACE',
            'Privileged identity verification requires a privileged role.',
          );
        const updated = await tx.applicationAccount.updateMany({
          where: { userId, version: body.expectedVersion },
          data: {
            privilegedIdentityVerifiedAt: new Date(),
            privilegedIdentityVerifiedByUserId: actor.userId,
            privilegedIdentityVerificationReference: body.verificationReference,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new DomainError(
            409,
            'VERSION_CONFLICT',
            'The account changed before this action.',
          );
        const account = await tx.applicationAccount.findUniqueOrThrow({
          where: { userId },
        });
        const result = ActionResultSchema.parse({
          id: userId,
          version: account.version,
          status: 'VERIFIED',
        });
        await tx.auditEvent.create({
          data: auditData(
            request,
            actor.userId,
            action,
            'APPLICATION_ACCOUNT',
            userId,
            body.verificationReference,
          ),
        });
        await tx.session.deleteMany({ where: { userId } });
        return result;
      },
    );
    return ActionResultSchema.parse(execution.value);
  });

  app.post('/api/v1/admin/users/:userId/roles', async (request, reply) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'ROLE_MANAGE',
      { fresh: true },
    );
    const { userId } = UserIdParamsSchema.parse(request.params);
    const body = GrantRoleRequestSchema.parse(request.body);
    if (!isValidRoleWorkspace(body.role, body.workspace))
      throw new DomainError(
        400,
        'INVALID_ROLE_WORKSPACE',
        'The role and workspace do not match.',
      );
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const action = 'ROLE_GRANT';
    const canonical = { userId, ...body };
    const execution = await executeIdempotently(
      prisma,
      actor.userId,
      action,
      key,
      canonical,
      async (tx) => {
        if (!(await tx.applicationAccount.findUnique({ where: { userId } })))
          throw new DomainError(
            404,
            'NOT_FOUND',
            'The requested resource was not found.',
          );
        if (body.role === 'PATIENT') {
          const profile = await tx.patientProfile.findUnique({
            where: { patientId: userId },
            select: { processingLock: { select: { patientId: true } } },
          });
          if (!profile?.processingLock)
            throw new DomainError(
              400,
              'INVALID_ROLE_WORKSPACE',
              'A patient role requires an existing patient profile and processing lock.',
            );
        }
        if (
          await tx.userRoleAssignment.findFirst({
            where: {
              userId,
              workspace: body.workspace,
              role: body.role,
              revokedAt: null,
            },
          })
        )
          throw new DomainError(
            409,
            'VERSION_CONFLICT',
            'That role is already active.',
          );
        const assignment = await tx.userRoleAssignment.create({
          data: {
            userId,
            workspace: body.workspace,
            role: body.role,
            grantedByUserId: actor.userId,
            grantReason: body.reason,
          },
        });
        const value = ActionResultSchema.parse({
          id: assignment.id,
          version: assignment.version,
          status: 'ACTIVE',
        });
        await tx.auditEvent.create({
          data: auditData(
            request,
            actor.userId,
            action,
            'USER_ROLE_ASSIGNMENT',
            assignment.id,
            body.reason,
          ),
        });
        await tx.session.deleteMany({ where: { userId } });
        return value;
      },
      201,
    );
    return reply.status(201).send(ActionResultSchema.parse(execution.value));
  });

  app.post(
    '/api/v1/admin/users/:userId/roles/:assignmentId/revoke',
    async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'ROLE_MANAGE',
        { fresh: true },
      );
      const { userId, assignmentId } = RoleParamsSchema.parse(request.params);
      const body = RevokeRoleRequestSchema.parse(request.body);
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const action = 'ROLE_REVOKE';
      const canonical = { userId, assignmentId, ...body };
      const execution = await executeIdempotently(
        prisma,
        actor.userId,
        action,
        key,
        canonical,
        async (tx) => {
          const updated = await tx.userRoleAssignment.updateMany({
            where: {
              id: assignmentId,
              userId,
              version: body.expectedVersion,
              revokedAt: null,
            },
            data: {
              revokedAt: new Date(),
              revokedByUserId: actor.userId,
              revokeReason: body.reason,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1)
            throw new DomainError(
              409,
              'VERSION_CONFLICT',
              'The role assignment changed before this action.',
            );
          const assignment = await tx.userRoleAssignment.findUniqueOrThrow({
            where: { id: assignmentId },
          });
          const result = ActionResultSchema.parse({
            id: assignment.id,
            version: assignment.version,
            status: 'REVOKED',
          });
          await tx.auditEvent.create({
            data: auditData(
              request,
              actor.userId,
              action,
              'USER_ROLE_ASSIGNMENT',
              assignmentId,
              body.reason,
            ),
          });
          await tx.session.deleteMany({ where: { userId } });
          return result;
        },
      );
      return ActionResultSchema.parse(execution.value);
    },
  );

  app.post('/api/v1/admin/patient-assignments', async (request, reply) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ASSIGNMENT_MANAGE',
      { fresh: true },
    );
    const body = CreatePatientAssignmentRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const action = 'PATIENT_ASSIGNMENT_CREATE';
    const execution = await executeIdempotently(
      prisma,
      actor.userId,
      action,
      key,
      body,
      async (tx) => {
        const [clinicianRole, patientProfile, duplicate] = await Promise.all([
          tx.userRoleAssignment.findFirst({
            where: {
              userId: body.clinicianUserId,
              role: 'CLINICIAN',
              workspace: 'CLINICIAN',
              revokedAt: null,
            },
          }),
          tx.patientProfile.findUnique({
            where: { patientId: body.patientId },
          }),
          tx.clinicianPatientAssignment.findFirst({
            where: {
              clinicianUserId: body.clinicianUserId,
              patientId: body.patientId,
              endedAt: null,
            },
          }),
        ]);
        if (!clinicianRole || !patientProfile)
          throw new DomainError(
            404,
            'NOT_FOUND',
            'The requested resource was not found.',
          );
        if (duplicate)
          throw new DomainError(
            409,
            'VERSION_CONFLICT',
            'That assignment is already active.',
          );
        const assignment = await tx.clinicianPatientAssignment.create({
          data: {
            clinicianUserId: body.clinicianUserId,
            patientId: body.patientId,
            assignedByUserId: actor.userId,
            assignmentReason: body.reason,
          },
        });
        const value = ActionResultSchema.parse({
          id: assignment.id,
          version: assignment.version,
          status: 'ACTIVE',
        });
        await tx.auditEvent.create({
          data: {
            ...auditData(
              request,
              actor.userId,
              action,
              'CLINICIAN_PATIENT_ASSIGNMENT',
              assignment.id,
              body.reason,
            ),
            patientId: body.patientId,
          },
        });
        await tx.session.deleteMany({
          where: { userId: body.clinicianUserId },
        });
        return value;
      },
      201,
    );
    return reply.status(201).send(ActionResultSchema.parse(execution.value));
  });

  app.post(
    '/api/v1/admin/patient-assignments/:assignmentId/end',
    async (request) => {
      const actor = await requirePermission(
        request,
        auth,
        prisma,
        config,
        'PATIENT_ASSIGNMENT_MANAGE',
        { fresh: true },
      );
      const { assignmentId } = AssignmentParamsSchema.parse(request.params);
      const body = EndPatientAssignmentRequestSchema.parse(request.body);
      const key = requireIdempotencyKey(request.headers['idempotency-key']);
      const action = 'PATIENT_ASSIGNMENT_END';
      const canonical = { assignmentId, ...body };
      const execution = await executeIdempotently(
        prisma,
        actor.userId,
        action,
        key,
        canonical,
        async (tx) => {
          const existing = await tx.clinicianPatientAssignment.findUnique({
            where: { id: assignmentId },
          });
          if (
            !existing ||
            existing.endedAt ||
            existing.version !== body.expectedVersion
          )
            throw new DomainError(
              409,
              'VERSION_CONFLICT',
              'The assignment changed before this action.',
            );
          const assignment = await tx.clinicianPatientAssignment.update({
            where: { id: assignmentId },
            data: {
              endedAt: new Date(),
              endedByUserId: actor.userId,
              endReason: body.reason,
              version: { increment: 1 },
            },
          });
          const result = ActionResultSchema.parse({
            id: assignment.id,
            version: assignment.version,
            status: 'ENDED',
          });
          await tx.auditEvent.create({
            data: {
              ...auditData(
                request,
                actor.userId,
                action,
                'CLINICIAN_PATIENT_ASSIGNMENT',
                assignment.id,
                body.reason,
              ),
              patientId: assignment.patientId,
            },
          });
          await tx.session.deleteMany({
            where: { userId: assignment.clinicianUserId },
          });
          return result;
        },
      );
      return ActionResultSchema.parse(execution.value);
    },
  );
}
