import type { PrismaClient } from '../../generated/prisma/client.js';

export const ABSOLUTE_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;
const FRESH_SESSION_WINDOW_MS = 15 * 60 * 1_000;

type ResolvedSession = {
  session: {
    id: string;
    createdAt: Date;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    twoFactorEnabled?: boolean | null | undefined;
  };
};

export async function applySessionPolicy(
  prisma: PrismaClient,
  resolved: ResolvedSession | null,
  now = new Date(),
  hadSessionCookie = false,
) {
  if (!resolved) {
    return {
      authenticated: false as const,
      reason: hadSessionCookie ? 'expired_or_revoked' : 'missing',
    };
  }

  const absoluteExpiresAt = new Date(
    resolved.session.createdAt.getTime() + ABSOLUTE_SESSION_LIFETIME_MS,
  );

  if (now >= absoluteExpiresAt || now >= new Date(resolved.session.expiresAt)) {
    await prisma.session.deleteMany({ where: { id: resolved.session.id } });
    return {
      authenticated: false as const,
      reason: 'expired_or_revoked' as const,
    };
  }

  return {
    authenticated: true as const,
    session: {
      user: {
        id: resolved.user.id,
        email: resolved.user.email,
        emailVerified: resolved.user.emailVerified,
        name: resolved.user.name,
        twoFactorEnabled: resolved.user.twoFactorEnabled ?? false,
      },
      createdAt: resolved.session.createdAt.toISOString(),
      expiresAt: resolved.session.expiresAt.toISOString(),
      absoluteExpiresAt: absoluteExpiresAt.toISOString(),
      fresh:
        now.getTime() - resolved.session.createdAt.getTime() <=
        FRESH_SESSION_WINDOW_MS,
    },
  };
}
