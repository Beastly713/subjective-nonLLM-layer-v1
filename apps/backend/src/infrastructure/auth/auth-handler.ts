import type { FastifyInstance } from 'fastify';

import type { AppAuth } from './auth.js';
import type { AppConfig } from '../config/config.js';
import type { AuthEmailSender } from '../email/auth-email-sender.js';

export function registerAuthHandler(
  app: FastifyInstance,
  auth: AppAuth,
  config: AppConfig,
  emailSender: AuthEmailSender,
) {
  app.all('/api/auth/*', async (request, reply) => {
    const requestOrigin = request.headers.origin;
    if (
      !['GET', 'HEAD'].includes(request.method) &&
      requestOrigin &&
      !config.trustedOrigins.includes(requestOrigin)
    ) {
      return reply.status(403).send({
        code: 'UNTRUSTED_ORIGIN',
        message: 'The request origin is not trusted.',
      });
    }

    const path = request.url.split('?', 1)[0];
    if (
      request.method === 'POST' &&
      !emailSender.available &&
      (path === '/api/auth/request-password-reset' ||
        path === '/api/auth/send-verification-email')
    ) {
      return reply.status(503).send({
        code: 'AUTH_EMAIL_UNAVAILABLE',
        message: 'Authentication email delivery is unavailable.',
      });
    }

    const origin = `${request.protocol}://${request.headers.host ?? 'localhost'}`;
    const url = new URL(request.url, origin);
    const headers = new Headers();

    for (const [name, value] of Object.entries(request.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        value.forEach((entry) => headers.append(name, entry));
      } else {
        headers.set(name, String(value));
      }
    }

    const hasBody = !['GET', 'HEAD'].includes(request.method);
    const response = await auth.handler(
      new Request(url, {
        method: request.method,
        headers,
        ...(hasBody && request.body !== undefined
          ? { body: JSON.stringify(request.body) }
          : {}),
      }),
    );

    response.headers.forEach((value, name) => {
      if (name !== 'set-cookie') void reply.header(name, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) void reply.header('set-cookie', cookies);

    const body = response.body ? await response.text() : undefined;
    return reply.status(response.status).send(body);
  });
}
