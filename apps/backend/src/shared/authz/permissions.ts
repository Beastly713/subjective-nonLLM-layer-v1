export const PERMISSIONS = [
  'USER_ACCESS_READ',
  'USER_PROVISION',
  'USER_STATE_MANAGE',
  'ROLE_MANAGE',
  'PATIENT_ASSIGNMENT_MANAGE',
  'PRIVILEGED_IDENTITY_VERIFY',
  'PATIENT_PROFILE_READ',
  'PATIENT_PROFILE_UPDATE',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type ApplicationRoleName =
  'PATIENT' | 'CLINICIAN' | 'ADMIN' | 'OPERATIONS';
export type WorkspaceName = 'PATIENT' | 'CLINICIAN' | 'ADMIN';
export type ScopeKind =
  'OWN_PATIENT' | 'ASSIGNED_PATIENTS' | 'ADMIN_OPERATIONAL';

export const ROLE_ACCESS: Record<
  ApplicationRoleName,
  {
    workspace: WorkspaceName;
    permissions: readonly Permission[];
    scope: ScopeKind;
  }
> = {
  PATIENT: {
    workspace: 'PATIENT',
    permissions: ['PATIENT_PROFILE_READ', 'PATIENT_PROFILE_UPDATE'],
    scope: 'OWN_PATIENT',
  },
  CLINICIAN: {
    workspace: 'CLINICIAN',
    permissions: ['PATIENT_PROFILE_READ'],
    scope: 'ASSIGNED_PATIENTS',
  },
  ADMIN: {
    workspace: 'ADMIN',
    permissions: [
      'USER_ACCESS_READ',
      'USER_PROVISION',
      'USER_STATE_MANAGE',
      'ROLE_MANAGE',
      'PATIENT_ASSIGNMENT_MANAGE',
      'PRIVILEGED_IDENTITY_VERIFY',
    ],
    scope: 'ADMIN_OPERATIONAL',
  },
  OPERATIONS: {
    workspace: 'ADMIN',
    permissions: ['USER_ACCESS_READ'],
    scope: 'ADMIN_OPERATIONAL',
  },
};

export const PRIVILEGED_ROLES = new Set<ApplicationRoleName>([
  'CLINICIAN',
  'ADMIN',
  'OPERATIONS',
]);

export function isValidRoleWorkspace(
  role: ApplicationRoleName,
  workspace: WorkspaceName,
) {
  return ROLE_ACCESS[role].workspace === workspace;
}
