import { z } from 'zod';

export const WorkspaceSchema = z.enum(['PATIENT', 'CLINICIAN', 'ADMIN']);
export const ApplicationRoleSchema = z.enum([
  'PATIENT',
  'CLINICIAN',
  'ADMIN',
  'OPERATIONS',
]);
export const AccountStateSchema = z.enum(['PENDING', 'ACTIVE', 'DISABLED']);

export const AdminRoleAssignmentSchema = z.object({
  id: z.uuid(),
  workspace: WorkspaceSchema,
  role: ApplicationRoleSchema,
  version: z.number().int().positive(),
  grantedAt: z.iso.datetime(),
});

export const AdminUserResponseSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  mfaEnabled: z.boolean(),
  accountState: AccountStateSchema,
  accountVersion: z.number().int().positive(),
  privilegedIdentityStatus: z.enum(['NOT_REQUIRED', 'PENDING', 'VERIFIED']),
  roles: z.array(AdminRoleAssignmentSchema),
  activePatientAssignments: z.number().int().nonnegative(),
});

export const AdminPatientAssignmentSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  assignedAt: z.iso.datetime(),
  clinician: z.object({
    userId: z.uuid(),
    name: z.string(),
    email: z.email(),
  }),
  patient: z.object({
    userId: z.uuid(),
    name: z.string(),
    email: z.email(),
  }),
});

export const AdminUserDetailResponseSchema = AdminUserResponseSchema.extend({
  directAssignments: z.array(AdminPatientAssignmentSchema),
});

export const AdminUserListResponseSchema = z.object({
  items: z.array(AdminUserResponseSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export const ProvisionUserRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email(),
  initialPassword: z.string().min(8).max(128),
  workspace: WorkspaceSchema,
  role: ApplicationRoleSchema,
  monitoringTimezone: z.string().min(1).max(255).optional(),
  reason: z.string().trim().min(1).max(1000),
});

export const AccountStateMutationRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000),
});

export const VerifyIdentityRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  verificationReference: z.string().trim().min(1).max(255),
});

export const GrantRoleRequestSchema = z.object({
  workspace: WorkspaceSchema,
  role: ApplicationRoleSchema,
  reason: z.string().trim().min(1).max(1000),
});

export const RevokeRoleRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000),
});

export const CreatePatientAssignmentRequestSchema = z.object({
  clinicianUserId: z.uuid(),
  patientId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
});

export const EndPatientAssignmentRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000),
});

export const ActionResultSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  status: z.string(),
});

export type AdminUserResponse = z.infer<typeof AdminUserResponseSchema>;
export type AdminUserDetailResponse = z.infer<
  typeof AdminUserDetailResponseSchema
>;
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;
