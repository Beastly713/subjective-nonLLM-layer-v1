import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import {
  PRIVILEGED_ROLES,
  ROLE_ACCESS,
  type ApplicationRoleName,
  type Permission,
  type ScopeKind,
  type WorkspaceName,
} from './permissions.js';

const DESTINATIONS = {
  PATIENT: { workspace: 'PATIENT', path: '/patient/home', label: 'Home' },
  CLINICIAN: {
    workspace: 'CLINICIAN',
    path: '/clinician/overview',
    label: 'Overview',
  },
  ADMIN: { workspace: 'ADMIN', path: '/admin/overview', label: 'Overview' },
} as const;

export interface IdentityForAccess {
  id: string;
  emailVerified: boolean;
  twoFactorEnabled?: boolean | null | undefined;
}

export interface ApplicationAccess {
  accountState: 'UNPROVISIONED' | 'PENDING' | 'ACTIVE' | 'DISABLED';
  accountVersion: number | null;
  roles: Array<{
    assignmentId: string;
    workspace: WorkspaceName;
    role: ApplicationRoleName;
  }>;
  permissions: Permission[];
  scopeKinds: ScopeKind[];
  privilegedIdentity: {
    required: boolean;
    status: 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED';
  };
  mfaEnabled: boolean;
  allowedDestinations: Array<(typeof DESTINATIONS)[WorkspaceName]>;
  restrictionReason?:
    | 'ACCOUNT_UNPROVISIONED'
    | 'ACCOUNT_PENDING'
    | 'ACCOUNT_DISABLED'
    | 'NO_ACTIVE_ROLE'
    | 'IDENTITY_VERIFICATION_REQUIRED'
    | 'MFA_REQUIRED';
}

export async function resolveApplicationAccess(
  prisma: PrismaClient,
  user: IdentityForAccess,
  config: AppConfig,
): Promise<ApplicationAccess> {
  const account = await prisma.applicationAccount.findUnique({
    where: { userId: user.id },
  });
  if (!account) {
    return {
      accountState: 'UNPROVISIONED' as const,
      accountVersion: null,
      roles: [],
      permissions: [],
      scopeKinds: [],
      privilegedIdentity: { required: false, status: 'NOT_REQUIRED' as const },
      mfaEnabled: Boolean(user.twoFactorEnabled),
      allowedDestinations: [],
      restrictionReason: 'ACCOUNT_UNPROVISIONED' as const,
    };
  }

  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { grantedAt: 'asc' },
  });
  const validAssignments = assignments.filter(
    ({ role, workspace }) =>
      ROLE_ACCESS[role as ApplicationRoleName]?.workspace === workspace,
  );
  const privilegedRequired = validAssignments.some(({ role }) =>
    PRIVILEGED_ROLES.has(role as ApplicationRoleName),
  );
  const privilegedStatus = !privilegedRequired
    ? ('NOT_REQUIRED' as const)
    : account.privilegedIdentityVerifiedAt
      ? ('VERIFIED' as const)
      : ('PENDING' as const);

  let restrictionReason:
    | 'ACCOUNT_PENDING'
    | 'ACCOUNT_DISABLED'
    | 'NO_ACTIVE_ROLE'
    | 'IDENTITY_VERIFICATION_REQUIRED'
    | 'MFA_REQUIRED'
    | undefined;
  if (account.state === 'PENDING') restrictionReason = 'ACCOUNT_PENDING';
  if (account.state === 'DISABLED') restrictionReason = 'ACCOUNT_DISABLED';
  if (account.state === 'ACTIVE' && validAssignments.length === 0)
    restrictionReason = 'NO_ACTIVE_ROLE';

  let eligibleAssignments = account.state === 'ACTIVE' ? validAssignments : [];
  if (config.appMode === 'real_patient') {
    eligibleAssignments = eligibleAssignments.filter(({ role }) => {
      if (!PRIVILEGED_ROLES.has(role as ApplicationRoleName)) return true;
      if (!user.emailVerified || privilegedStatus !== 'VERIFIED') {
        restrictionReason ??= 'IDENTITY_VERIFICATION_REQUIRED';
        return false;
      }
      if (!user.twoFactorEnabled) {
        restrictionReason ??= 'MFA_REQUIRED';
        return false;
      }
      return true;
    });
  }

  const permissions = new Set<Permission>();
  const scopeKinds = new Set<ScopeKind>();
  const workspaces = new Set<WorkspaceName>();
  for (const assignment of eligibleAssignments) {
    const rule = ROLE_ACCESS[assignment.role as ApplicationRoleName];
    rule.permissions.forEach((permission) => permissions.add(permission));
    scopeKinds.add(rule.scope);
    workspaces.add(rule.workspace);
  }

  return {
    accountState: account.state,
    accountVersion: account.version,
    roles: validAssignments.map(({ id, workspace, role }) => ({
      assignmentId: id,
      workspace,
      role,
    })),
    permissions: [...permissions],
    scopeKinds: [...scopeKinds],
    privilegedIdentity: {
      required: privilegedRequired,
      status: privilegedStatus,
    },
    mfaEnabled: Boolean(user.twoFactorEnabled),
    allowedDestinations: [...workspaces].map(
      (workspace) => DESTINATIONS[workspace],
    ),
    ...(restrictionReason && eligibleAssignments.length === 0
      ? { restrictionReason }
      : {}),
  };
}
