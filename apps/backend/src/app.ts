import { randomUUID } from 'node:crypto';

import fastifyStatic from '@fastify/static';
import helmet from '@fastify/helmet';
import { RequestIdSchema } from '@aud-subjective/contracts';
import Fastify, { LogController } from 'fastify';

import type { PrismaClient } from './generated/prisma/client.js';
import type { AppConfig } from './infrastructure/config/config.js';
import { createAuth, type AppAuth } from './infrastructure/auth/auth.js';
import { registerAuthHandler } from './infrastructure/auth/auth-handler.js';
import { createAuthEmailSender } from './infrastructure/email/create-auth-email-sender.js';
import type { AuthEmailSender } from './infrastructure/email/auth-email-sender.js';
import { createLoggerOptions } from './infrastructure/logging/logger-options.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerApplicationAuthRoutes } from './routes/auth.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';

interface BuildAppOptions {
  config: AppConfig;
  prisma: PrismaClient;
  webRoot?: string;
  emailSender?: AuthEmailSender;
  auth?: AppAuth;
}

function generateRequestId(request: { headers: Record<string, unknown> }) {
  const incomingRequestId = RequestIdSchema.safeParse(
    request.headers['x-request-id'],
  );

  return incomingRequestId.success ? incomingRequestId.data : randomUUID();
}

export function buildApp({
  config,
  prisma,
  webRoot,
  emailSender: providedEmailSender,
  auth: providedAuth,
}: BuildAppOptions) {
  const app = Fastify({
    logger: createLoggerOptions(config.logLevel),
    genReqId: generateRequestId,
    logController: new LogController({
      requestIdLogLabel: 'request_id',
    }),
  });

  app.addHook('onRequest', (request, reply, done) => {
    void reply.header('x-request-id', request.id);
    done();
  });

  void app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    hsts:
      config.nodeEnv === 'production'
        ? { maxAge: 31_536_000, includeSubDomains: false }
        : false,
  });

  const emailSender = providedEmailSender ?? createAuthEmailSender(config);
  const auth =
    providedAuth ??
    createAuth(prisma, config, emailSender, {
      onEmailDeliveryFailure: (emailType) => {
        app.log.warn(
          { errorCode: 'AUTH_EMAIL_DELIVERY_FAILED', emailType },
          'Authentication email delivery failed',
        );
      },
    });

  registerAuthHandler(app, auth, config, emailSender);

  registerHealthRoutes(app, prisma, config);
  registerApplicationAuthRoutes(app, prisma, auth, config, emailSender);

  if (webRoot) {
    void app.register(fastifyStatic, {
      root: webRoot,
      wildcard: false,
    });
  }

  registerErrorHandlers(app, Boolean(webRoot));

  return app;
}
