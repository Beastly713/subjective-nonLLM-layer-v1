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
import { registerIdentityRoutes } from './modules/identity/routes.js';
import { registerProfileRoutes } from './modules/profiles/routes.js';
import { registerScheduleRoutes } from './modules/scheduling/routes.js';
import { registerRoutingRoutes } from './modules/routing/routes.js';
import { registerOnboardingRoutes } from './modules/onboarding/routes.js';
import { registerSafetyRoutes } from './modules/safety/routes.js';
import { registerReductionSetupRoutes } from './modules/consumption/routes.js';
import { registerAssessmentRoutes } from './modules/assessments/routes.js';
import { registerContentRoutes } from './modules/content/routes.js';
import { registerClinicalRoutes } from './modules/clinical/routes.js';
import { registerEngagementRoutes } from './modules/engagement/routes.js';
import { registerOperationsRoutes } from './modules/operations/routes.js';
import { registerMonitoringRoutes } from './modules/monitoring/routes.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerApplicationAuthRoutes } from './routes/auth.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';
import { SystemClock, type Clock } from './shared/clock/clock.js';

interface BuildAppOptions {
  config: AppConfig;
  prisma: PrismaClient;
  webRoot?: string;
  emailSender?: AuthEmailSender;
  auth?: AppAuth;
  clock?: Clock;
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
  clock: providedClock,
}: BuildAppOptions) {
  const app = Fastify({
    logger: createLoggerOptions(config.logLevel),
    genReqId: generateRequestId,
    logController: new LogController({
      requestIdLogLabel: 'request_id',
    }),
  });
  const clock = providedClock ?? new SystemClock();

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
  const provisioningAuth = createAuth(prisma, config, emailSender, {
    allowSignUpForFixtureCreation: true,
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
  registerIdentityRoutes(app, prisma, auth, provisioningAuth, config);
  registerProfileRoutes(app, prisma, auth, config, clock);
  registerScheduleRoutes(app, prisma, auth, config, clock);
  registerRoutingRoutes(app, prisma, auth, config, clock);
  registerOnboardingRoutes(app, prisma, auth, config, clock);
  registerSafetyRoutes(app, prisma, auth, config, clock);
  registerReductionSetupRoutes(app, prisma, auth, config, clock);
  registerAssessmentRoutes(app, prisma, auth, config, clock);
  registerContentRoutes(app, prisma, auth, config, clock);
  registerClinicalRoutes(app, prisma, auth, config, clock);
  registerEngagementRoutes(app, prisma, auth, config, clock);
  registerOperationsRoutes(app, prisma, auth, config, clock);
  registerMonitoringRoutes(app, prisma, auth, config, clock);

  if (webRoot) {
    void app.register(fastifyStatic, {
      root: webRoot,
      wildcard: false,
    });
  }

  registerErrorHandlers(app, Boolean(webRoot));

  return app;
}
