import { z } from 'zod';

export const AppModeSchema = z.enum(['prototype', 'real_patient']);

export const AuthCapabilitiesResponseSchema = z.object({
  appMode: AppModeSchema,
  passwordRecoveryAvailable: z.boolean(),
  emailVerificationDeliveryAvailable: z.boolean(),
  twoFactorSupported: z.literal(true),
});

export const AuthenticatedSessionSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.email(),
    emailVerified: z.boolean(),
    name: z.string(),
    twoFactorEnabled: z.boolean(),
  }),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  absoluteExpiresAt: z.iso.datetime(),
  fresh: z.boolean(),
  access: z.object({
    accountState: z.enum(['UNPROVISIONED', 'PENDING', 'ACTIVE', 'DISABLED']),
    accountVersion: z.number().int().positive().nullable(),
    roles: z.array(
      z.object({
        assignmentId: z.uuid(),
        workspace: z.enum(['PATIENT', 'CLINICIAN', 'ADMIN']),
        role: z.enum(['PATIENT', 'CLINICIAN', 'ADMIN', 'OPERATIONS']),
      }),
    ),
    permissions: z.array(
      z.enum([
        'USER_ACCESS_READ',
        'USER_PROVISION',
        'USER_STATE_MANAGE',
        'ROLE_MANAGE',
        'PATIENT_ASSIGNMENT_MANAGE',
        'PRIVILEGED_IDENTITY_VERIFY',
        'PATIENT_PROFILE_READ',
        'PATIENT_PROFILE_UPDATE',
        'PATIENT_HOME_READ',
        'PATIENT_MONITORING_MANAGE',
        'PATIENT_SCHEDULE_READ',
        'PATIENT_ONBOARDING_READ',
        'PATIENT_ONBOARDING_UPDATE',
        'PATIENT_SAFETY_READ',
        'PATIENT_ASSESSMENT_READ',
        'PATIENT_ASSESSMENT_UPDATE',
        'PATIENT_ASSESSMENT_STAFF_CORRECT',
        'PATIENT_SUPPORT_READ',
        'PATIENT_SUPPORT_FEEDBACK',
        'PATIENT_PROGRESS_READ',
        'PATIENT_MONITORING_READ',
        'CLINICIAN_OVERVIEW_READ',
        'ENGAGEMENT_READ',
        'ENGAGEMENT_CASE_ACKNOWLEDGE',
        'ENGAGEMENT_CASE_OUTREACH',
        'TECHNICAL_FAILURE_READ',
        'ENGAGEMENT_TECHNICAL_OVERRIDE',
        'SAFETY_CASE_READ',
        'SAFETY_CASE_ACKNOWLEDGE',
        'SAFETY_CASE_DISPOSITION',
        'ROUTING_CONFIG_READ',
        'ROUTING_CONFIG_EDIT',
        'ROUTING_TEST_RECORD',
        'ROUTING_CONFIG_ACTIVATE',
        'ADMIN_OVERVIEW_READ',
        'CONTENT_RESOURCE_READ',
        'CONTENT_RESOURCE_EDIT',
        'CONTENT_RESOURCE_APPROVE',
        'AUDIT_READ',
        'OPERATIONAL_INCIDENT_READ',
        'CLINICAL_REVIEW_READ',
        'CLINICAL_REVIEW_ACKNOWLEDGE',
      ]),
    ),
    scopeKinds: z.array(
      z.enum(['OWN_PATIENT', 'ASSIGNED_PATIENTS', 'ADMIN_OPERATIONAL']),
    ),
    privilegedIdentity: z.object({
      required: z.boolean(),
      status: z.enum(['NOT_REQUIRED', 'PENDING', 'VERIFIED']),
    }),
    mfaEnabled: z.boolean(),
    allowedDestinations: z.array(
      z.object({
        workspace: z.enum(['PATIENT', 'CLINICIAN', 'ADMIN']),
        path: z.enum([
          '/patient/home',
          '/clinician/overview',
          '/admin/overview',
        ]),
        label: z.string(),
      }),
    ),
    restrictionReason: z
      .enum([
        'ACCOUNT_UNPROVISIONED',
        'ACCOUNT_PENDING',
        'ACCOUNT_DISABLED',
        'NO_ACTIVE_ROLE',
        'IDENTITY_VERIFICATION_REQUIRED',
        'MFA_REQUIRED',
      ])
      .optional(),
  }),
});

export const CurrentSessionResponseSchema = z.discriminatedUnion(
  'authenticated',
  [
    z.object({
      authenticated: z.literal(false),
      reason: z.enum(['missing', 'expired_or_revoked']).optional(),
    }),
    z.object({
      authenticated: z.literal(true),
      session: AuthenticatedSessionSchema,
    }),
  ],
);

export type AppMode = z.infer<typeof AppModeSchema>;
export type AuthCapabilitiesResponse = z.infer<
  typeof AuthCapabilitiesResponseSchema
>;
export type CurrentSessionResponse = z.infer<
  typeof CurrentSessionResponseSchema
>;
