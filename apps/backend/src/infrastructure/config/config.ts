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
    APP_MODE: z.enum(['prototype', 'real_patient']).default('prototype'),
    BETTER_AUTH_SECRET: z.string().min(32),
    APP_BASE_URL: z.url().refine((value) => {
      const url = new URL(value);
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.hostname.includes('*') &&
        url.pathname === '/' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    }, 'must be an absolute HTTP(S) application origin without wildcards'),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.email().optional(),
    SAFETY_ROUTING_COUNTRY_CODE: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .optional(),
    SAFETY_ROUTING_REGION_CODE: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]+$/)
      .min(1)
      .max(64)
      .optional(),
  })
  .refine(
    ({ RESEND_API_KEY, EMAIL_FROM }) =>
      Boolean(RESEND_API_KEY) === Boolean(EMAIL_FROM),
    { message: 'RESEND_API_KEY and EMAIL_FROM must be configured together' },
  )
  .transform((environment) => ({
    nodeEnv: environment.NODE_ENV,
    host: environment.HOST,
    port: environment.PORT,
    databaseUrl: environment.DATABASE_URL,
    logLevel: environment.LOG_LEVEL,
    appMode: environment.APP_MODE,
    betterAuthSecret: environment.BETTER_AUTH_SECRET,
    appBaseUrl: environment.APP_BASE_URL,
    resendApiKey: environment.RESEND_API_KEY,
    emailFrom: environment.EMAIL_FROM,
    safetyRoutingCountryCode: environment.SAFETY_ROUTING_COUNTRY_CODE?.toUpperCase(),
    safetyRoutingRegionCode: environment.SAFETY_ROUTING_REGION_CODE?.toUpperCase(),
    authEmailDeliveryAvailable: Boolean(
      environment.RESEND_API_KEY && environment.EMAIL_FROM,
    ),
    trustedOrigins: [
      new URL(environment.APP_BASE_URL).origin,
      ...(environment.NODE_ENV === 'development'
        ? ['http://localhost:5173']
        : []),
    ],
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
