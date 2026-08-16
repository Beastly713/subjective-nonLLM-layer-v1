import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for production-shaped E2E tests.',
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm --filter @aud-subjective/backend start',
    env: {
      DATABASE_URL: testDatabaseUrl,
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      PORT: '3000',
      APP_MODE: 'prototype',
      BETTER_AUTH_SECRET: 'e2e-only-better-auth-secret-at-least-32-characters',
      APP_BASE_URL: 'http://127.0.0.1:3000',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:3000/health/live',
  },
});
