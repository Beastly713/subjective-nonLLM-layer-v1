import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest } from 'fastify';

import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import { applySessionPolicy } from '../../infrastructure/auth/session-policy.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import { DomainError } from '../errors/domain-error.js';
import { resolveApplicationAccess } from './access.js';
import type { Permission } from './permissions.js';

export async function resolveAuthenticatedActor(
  request: FastifyRequest,
  auth: AppAuth,
  prisma: PrismaClient,
  config: AppConfig,
) {
  const resolved = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  const safeSession = await applySessionPolicy(
    prisma,
    resolved,
    new Date(),
    request.headers.cookie?.includes('session_token=') ?? false,
  );
  if (!resolved || !safeSession.authenticated) {
    throw new DomainError(
      401,
      'AUTHENTICATION_REQUIRED',
      'Authentication is required.',
    );
  }
  const access = await resolveApplicationAccess(prisma, resolved.user, config);
  return {
    userId: resolved.user.id,
    user: resolved.user,
    session: safeSession.session,
    access,
  };
}

export async function requirePermission(
  request: FastifyRequest,
  auth: AppAuth,
  prisma: PrismaClient,
  config: AppConfig,
  permission: Permission,
  options: { fresh?: boolean } = {},
) {
  const actor = await resolveAuthenticatedActor(request, auth, prisma, config);
  if (actor.access.accountState === 'PENDING')
    throw new DomainError(
      403,
      'ACCOUNT_PENDING',
      'The account is pending activation.',
    );
  if (actor.access.accountState === 'DISABLED')
    throw new DomainError(403, 'ACCOUNT_DISABLED', 'The account is disabled.');
  if (!actor.access.permissions.includes(permission))
    throw new DomainError(
      403,
      'PERMISSION_DENIED',
      'The action is not permitted.',
    );
  if (options.fresh && !actor.session.fresh)
    throw new DomainError(
      401,
      'FRESH_SESSION_REQUIRED',
      'Sign in again to continue.',
    );
  return actor;
}
