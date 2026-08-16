import { fileURLToPath } from 'node:url';

import { buildApp } from './app.js';
import {
  loadRootEnvironment,
  parseConfig,
} from './infrastructure/config/config.js';
import { createPrismaClient } from './infrastructure/db/prisma.js';

loadRootEnvironment();

async function start() {
  const config = parseConfig(process.env);
  const prisma = createPrismaClient(config.databaseUrl);
  const productionWebRoot = fileURLToPath(
    new URL('../../web/dist', import.meta.url),
  );
  const app = buildApp({
    config,
    prisma,
    ...(config.nodeEnv === 'production' ? { webRoot: productionWebRoot } : {}),
  });
  let shuttingDown = false;

  const shutdown = async (signal: 'SIGINT' | 'SIGTERM') => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    app.log.info({ signal }, 'Shutting down');

    try {
      await app.close();
    } finally {
      await prisma.$disconnect();
    }
  };

  const handleSignal = (signal: 'SIGINT' | 'SIGTERM') => {
    void shutdown(signal).catch(() => {
      app.log.error({ signal }, 'Graceful shutdown failed');
      process.exitCode = 1;
    });
  };

  process.once('SIGINT', () => handleSignal('SIGINT'));
  process.once('SIGTERM', () => handleSignal('SIGTERM'));

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error(
      {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      },
      'Backend startup failed',
    );
    await shutdown('SIGTERM');
    process.exitCode = 1;
  }
}

try {
  await start();
} catch {
  console.error('Backend configuration or initialization failed.');
  process.exitCode = 1;
}
