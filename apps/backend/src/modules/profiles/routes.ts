import {
  ClinicianPatientListResponseSchema,
  ClinicianPatientSummarySchema,
  PatientProfileResponseSchema,
  UpdatePatientPreferencesRequestSchema,
  UpdatePatientProfileRequestSchema,
} from '@aud-subjective/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import { normalizeMonitoringTimezone } from '../../shared/authz/timezone.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { patientProfileInclude, projectPatientProfile } from './projections.js';

const PatientParamsSchema = z.object({ patientId: z.uuid() });
const ClinicianListQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export function registerProfileRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
) {
  app.get('/api/v1/patient/profile', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_PROFILE_READ',
    );
    if (!actor.access.scopeKinds.includes('OWN_PATIENT'))
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    const profile = await prisma.patientProfile.findUnique({
      where: { patientId: actor.userId },
      include: patientProfileInclude,
    });
    const projected = profile ? projectPatientProfile(profile) : null;
    if (!projected)
      throw new DomainError(
        404,
        'NOT_FOUND',
        'The requested resource was not found.',
      );
    return projected;
  });

  app.patch('/api/v1/patient/profile', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_PROFILE_UPDATE',
    );
    if (!actor.access.scopeKinds.includes('OWN_PATIENT'))
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    const body = UpdatePatientProfileRequestSchema.parse(request.body);
    const monitoringTimezone = normalizeMonitoringTimezone(
      body.monitoringTimezone,
    );
    await prisma.$transaction(async (tx) => {
      const updated = await tx.patientProfile.updateMany({
        where: { patientId: actor.userId, version: body.expectedVersion },
        data: {
          monitoringTimezone,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new DomainError(
          409,
          'VERSION_CONFLICT',
          'The profile changed before this update.',
        );
      await tx.auditEvent.create({
        data: {
          actorId: actor.userId,
          action: 'PATIENT_PROFILE_UPDATE',
          entityType: 'PATIENT_PROFILE',
          entityId: actor.userId,
          patientId: actor.userId,
          requestId: request.id,
        },
      });
    });
    const profile = await prisma.patientProfile.findUniqueOrThrow({
      where: { patientId: actor.userId },
      include: patientProfileInclude,
    });
    return PatientProfileResponseSchema.parse(projectPatientProfile(profile));
  });

  app.post('/api/v1/patient/profile/preferences', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_PROFILE_UPDATE',
    );
    if (!actor.access.scopeKinds.includes('OWN_PATIENT'))
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    const body = UpdatePatientPreferencesRequestSchema.parse(request.body);
    await prisma.$transaction(async (tx) => {
      const locks = await tx.$queryRaw<Array<{ patient_id: string }>>`
        SELECT "patient_id"
        FROM "patient_processing_locks"
        WHERE "patient_id" = ${actor.userId}::uuid
        FOR UPDATE
      `;
      if (locks.length !== 1)
        throw new DomainError(
          404,
          'NOT_FOUND',
          'The requested resource was not found.',
        );
      const profile = await tx.patientProfile.findUnique({
        where: { patientId: actor.userId },
        select: { patientId: true },
      });
      const current = await tx.profilePreferenceVersion.findFirst({
        where: { patientId: actor.userId },
        orderBy: { version: 'desc' },
      });
      if (!profile || !current)
        throw new DomainError(
          404,
          'NOT_FOUND',
          'The requested resource was not found.',
        );
      if (current.version !== body.expectedVersion)
        throw new DomainError(
          409,
          'VERSION_CONFLICT',
          'The preferences changed before this update.',
        );
      const preference = await tx.profilePreferenceVersion.create({
        data: {
          patientId: actor.userId,
          version: current.version + 1,
          mutualHelpPreference: body.mutualHelpPreference,
          spiritualContentPreference: body.spiritualContentPreference,
          createdByUserId: actor.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.userId,
          action: 'PATIENT_PREFERENCES_UPDATE',
          entityType: 'PROFILE_PREFERENCE_VERSION',
          entityId: preference.id,
          patientId: actor.userId,
          requestId: request.id,
        },
      });
    });
    const profile = await prisma.patientProfile.findUniqueOrThrow({
      where: { patientId: actor.userId },
      include: patientProfileInclude,
    });
    return PatientProfileResponseSchema.parse(projectPatientProfile(profile));
  });

  app.get('/api/v1/clinician/patients', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_PROFILE_READ',
    );
    if (!actor.access.scopeKinds.includes('ASSIGNED_PATIENTS'))
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    const query = ClinicianListQuerySchema.parse(request.query);
    const patientSearch: Prisma.UserWhereInput[] = query.search
      ? [
          {
            name: { contains: query.search, mode: 'insensitive' },
          },
          ...(query.search.match(/^[0-9a-f-]{36}$/i)
            ? [{ id: query.search }]
            : []),
        ]
      : [];
    const where: Prisma.ClinicianPatientAssignmentWhereInput = {
      clinicianUserId: actor.userId,
      endedAt: null,
      patient: {
        patientProfile: { isNot: null },
        applicationAccount: { is: { state: 'ACTIVE' as const } },
        ...(patientSearch.length > 0 ? { OR: patientSearch } : {}),
      },
    };
    const [assignments, total] = await prisma.$transaction([
      prisma.clinicianPatientAssignment.findMany({
        where,
        include: {
          patient: {
            include: { patientProfile: { include: patientProfileInclude } },
          },
        },
        orderBy: [{ patient: { name: 'asc' } }, { patientId: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.clinicianPatientAssignment.count({ where }),
    ]);
    const items = assignments.flatMap(({ patient }) => {
      const profile = patient.patientProfile
        ? projectPatientProfile(patient.patientProfile)
        : null;
      return profile ? [ClinicianPatientSummarySchema.parse(profile)] : [];
    });
    return ClinicianPatientListResponseSchema.parse({
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  });

  app.get('/api/v1/clinician/patients/:patientId', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_PROFILE_READ',
    );
    if (!actor.access.scopeKinds.includes('ASSIGNED_PATIENTS'))
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    const { patientId } = PatientParamsSchema.parse(request.params);
    const assignment = await prisma.clinicianPatientAssignment.findFirst({
      where: {
        clinicianUserId: actor.userId,
        patientId,
        endedAt: null,
        patient: { patientProfile: { isNot: null } },
      },
      include: {
        patient: {
          include: { patientProfile: { include: patientProfileInclude } },
        },
      },
    });
    const projected = assignment?.patient.patientProfile
      ? projectPatientProfile(assignment.patient.patientProfile)
      : null;
    if (!projected)
      throw new DomainError(
        404,
        'NOT_FOUND',
        'The requested resource was not found.',
      );
    return PatientProfileResponseSchema.parse(projected);
  });
}
