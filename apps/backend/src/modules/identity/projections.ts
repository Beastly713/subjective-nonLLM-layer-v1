import {
  AdminUserDetailResponseSchema,
  AdminUserResponseSchema,
} from '@aud-subjective/contracts';

import { PRIVILEGED_ROLES } from '../../shared/authz/permissions.js';

export function projectAdminUser(user: {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled?: boolean | null;
  applicationAccount: {
    state: 'PENDING' | 'ACTIVE' | 'DISABLED';
    version: number;
    privilegedIdentityVerifiedAt: Date | null;
  } | null;
  roleAssignments: Array<{
    id: string;
    workspace: 'PATIENT' | 'CLINICIAN' | 'ADMIN';
    role: 'PATIENT' | 'CLINICIAN' | 'ADMIN' | 'OPERATIONS';
    version: number;
    grantedAt: Date;
    revokedAt: Date | null;
  }>;
  clinicianAssignments: Array<{ id: string }>;
}) {
  if (!user.applicationAccount) return null;
  const roles = user.roleAssignments.filter(({ revokedAt }) => !revokedAt);
  const privilegedRequired = roles.some(({ role }) =>
    PRIVILEGED_ROLES.has(role),
  );
  return AdminUserResponseSchema.parse({
    userId: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    mfaEnabled: Boolean(user.twoFactorEnabled),
    accountState: user.applicationAccount.state,
    accountVersion: user.applicationAccount.version,
    privilegedIdentityStatus: !privilegedRequired
      ? 'NOT_REQUIRED'
      : user.applicationAccount.privilegedIdentityVerifiedAt
        ? 'VERIFIED'
        : 'PENDING',
    roles: roles.map(({ id, workspace, role, version, grantedAt }) => ({
      id,
      workspace,
      role,
      version,
      grantedAt: grantedAt.toISOString(),
    })),
    activePatientAssignments: user.clinicianAssignments.length,
  });
}

export const adminUserInclude = {
  applicationAccount: true,
  roleAssignments: true,
  clinicianAssignments: { where: { endedAt: null }, select: { id: true } },
} as const;

const assignmentIdentitySelect = { id: true, name: true, email: true } as const;

export const adminUserDetailInclude = {
  applicationAccount: true,
  roleAssignments: true,
  clinicianAssignments: {
    where: { endedAt: null },
    include: {
      clinician: { select: assignmentIdentitySelect },
      patient: { select: assignmentIdentitySelect },
    },
  },
  patientAssignments: {
    where: { endedAt: null },
    include: {
      clinician: { select: assignmentIdentitySelect },
      patient: { select: assignmentIdentitySelect },
    },
  },
} as const;

export function projectAdminUserDetail(
  user: Parameters<typeof projectAdminUser>[0] & {
    clinicianAssignments: Array<{
      id: string;
      version: number;
      assignedAt: Date;
      clinician: { id: string; name: string; email: string };
      patient: { id: string; name: string; email: string };
    }>;
    patientAssignments: Array<{
      id: string;
      version: number;
      assignedAt: Date;
      clinician: { id: string; name: string; email: string };
      patient: { id: string; name: string; email: string };
    }>;
  },
) {
  const base = projectAdminUser(user);
  if (!base) return null;
  const assignments = [
    ...user.clinicianAssignments,
    ...user.patientAssignments,
  ];
  return AdminUserDetailResponseSchema.parse({
    ...base,
    directAssignments: assignments.map((assignment) => ({
      id: assignment.id,
      version: assignment.version,
      assignedAt: assignment.assignedAt.toISOString(),
      clinician: {
        userId: assignment.clinician.id,
        name: assignment.clinician.name,
        email: assignment.clinician.email,
      },
      patient: {
        userId: assignment.patient.id,
        name: assignment.patient.name,
        email: assignment.patient.email,
      },
    })),
  });
}
