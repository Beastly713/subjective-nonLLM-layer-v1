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
