import { describe, expect, it } from 'vitest';

import {
  isValidRoleWorkspace,
  ROLE_ACCESS,
} from '../../src/shared/authz/permissions.js';

describe('code-owned permission table', () => {
  it('keeps workspace, role, permission, and scope distinct', () => {
    expect(ROLE_ACCESS.PATIENT).toEqual({
      workspace: 'PATIENT',
      permissions: ['PATIENT_PROFILE_READ', 'PATIENT_PROFILE_UPDATE'],
      scope: 'OWN_PATIENT',
    });
    expect(ROLE_ACCESS.CLINICIAN).toEqual({
      workspace: 'CLINICIAN',
      permissions: ['PATIENT_PROFILE_READ'],
      scope: 'ASSIGNED_PATIENTS',
    });
    expect(ROLE_ACCESS.ADMIN.permissions).not.toContain('PATIENT_PROFILE_READ');
    expect(ROLE_ACCESS.OPERATIONS.workspace).toBe('ADMIN');
    expect(ROLE_ACCESS.OPERATIONS.permissions).toEqual(['USER_ACCESS_READ']);
  });

  it('accepts only locked role/workspace pairs', () => {
    expect(isValidRoleWorkspace('PATIENT', 'PATIENT')).toBe(true);
    expect(isValidRoleWorkspace('CLINICIAN', 'PATIENT')).toBe(false);
    expect(isValidRoleWorkspace('ADMIN', 'ADMIN')).toBe(true);
    expect(isValidRoleWorkspace('OPERATIONS', 'ADMIN')).toBe(true);
  });
});
