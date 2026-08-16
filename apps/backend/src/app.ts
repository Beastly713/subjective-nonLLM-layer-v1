import { randomUUID } from 'node:crypto';

import fastifyStatic from '@fastify/static';
import { RequestIdSchema } from '@aud-subjective/contracts';
import Fastify, { LogController } from 'fastify';

import type { PrismaClient } from './generated/prisma/client.js';
import type { AppConfig } from './infrastructure/config/config.js';
import { createLoggerOptions } from './infrastructure/logging/logger-options.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';

interface BuildAppOptions {
  config: AppConfig;
  prisma: PrismaClient;
  webRoot?: string;
}

function generateRequestId(request: { headers: Record<string, unknown> }) {
  const incomingRequestId = RequestIdSchema.safeParse(
    request.headers['x-request-id'],
  );

  return incomingRequestId.success ? incomingRequestId.data : randomUUID();
}

export function buildApp({ config, prisma, webRoot }: BuildAppOptions) {
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

  registerHealthRoutes(app, prisma);

  if (webRoot) {
    void app.register(fastifyStatic, {
      root: webRoot,
      wildcard: false,
    });
  }

  registerErrorHandlers(app, Boolean(webRoot));

  return app;
}
