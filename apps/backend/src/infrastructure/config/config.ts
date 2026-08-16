import { fileURLToPath } from 'node:url';

import { config as loadEnvironment } from 'dotenv';
import { z } from 'zod';

const AppConfigSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    DATABASE_URL: z
      .string()
      .min(1)
      .refine(
        (value) =>
          value.startsWith('postgresql://') || value.startsWith('postgres://'),
        'must be a PostgreSQL connection URL',
      ),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .transform((environment) => ({
    nodeEnv: environment.NODE_ENV,
    host: environment.HOST,
    port: environment.PORT,
    databaseUrl: environment.DATABASE_URL,
    logLevel: environment.LOG_LEVEL,
  }));

const TestDatabaseConfigSchema = z.object({
  TEST_DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) =>
        value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'must be a PostgreSQL connection URL',
    ),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function loadRootEnvironment() {
  loadEnvironment({
    path: fileURLToPath(new URL('../../../../../.env', import.meta.url)),
    quiet: true,
  });
}

export function parseConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const result = AppConfigSchema.safeParse(environment);

  if (!result.success) {
    const invalidKeys = result.error.issues
      .map((issue) => issue.path.join('.') || 'environment')
      .join(', ');

    throw new Error(`Invalid runtime configuration: ${invalidKeys}`);
  }

  return result.data;
}

export function parseTestDatabaseUrl(environment: NodeJS.ProcessEnv) {
  const result = TestDatabaseConfigSchema.safeParse(environment);

  if (!result.success) {
    throw new Error('TEST_DATABASE_URL must be a PostgreSQL connection URL.');
  }

  return result.data.TEST_DATABASE_URL;
}
