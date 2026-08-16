# AUD Subjective Monitoring Platform

This repository is the implementation workspace for the V1 AUD subjective monitoring product. It contains the runtime, accessible product-design foundation, and Phase 2 identity/session foundation. Application roles and clinical workflows are not implemented.

## Prerequisites

- Node.js 24 LTS (see `.nvmrc`)
- pnpm 10.24.0, as pinned by the root `packageManager` field

Install dependencies from the repository root:

```sh
pnpm install
```

Create the local environment file and start PostgreSQL 17:

```sh
cp .env.example .env
docker compose up -d postgres
```

Generate a secret with `openssl rand -base64 32` and paste it into
`BETTER_AUTH_SECRET` in `.env` before starting the application.

Apply the committed migrations and generate the Prisma client:

```sh
pnpm db:migrate:dev
pnpm db:generate
```

## Local development

Start the web and backend development processes together:

```sh
pnpm dev
```

- Web: <http://localhost:5173>
- Backend: <http://localhost:3000>
- Backend liveness endpoint: <http://localhost:3000/health/live>
- Backend readiness endpoint: <http://localhost:3000/health/ready>

The web development server proxies relative `/api` requests to the backend. Browser code should use relative paths such as `/api/v1/...`.

The root route resolves the authoritative server session. Anonymous visitors are sent to `/login`; authenticated accounts see a neutral setup/access-pending state. In development, the Phase 1 design-system reference remains available at `/dev/foundation`.

Authentication uses Better Auth database-backed, HTTP-only cookie sessions. Public signup is disabled. Configure `RESEND_API_KEY` and `EMAIL_FROM` together to enable verification and password recovery; prototype mode reports email as unavailable when they are absent, while `real_patient` mode reports the application not ready. Readiness covers configuration, Prisma, PostgreSQL, auth core, and auth email delivery only.

## Database commands

```sh
pnpm db:generate
pnpm db:migrate:dev
pnpm db:migrate:deploy
pnpm db:seed
```

Migrations are applied as a release or pre-deploy action, not independently by every application instance at startup. The foundation seed command intentionally creates no records.

## Tests

Backend integration tests require a migrated, isolated real PostgreSQL database identified by `TEST_DATABASE_URL`. With the local Compose service running, create the example database and deploy migrations to it before the Phase 1 validation run:

```sh
docker compose exec postgres createdb -U aud_subjective aud_subjective_test
DATABASE_URL=postgresql://aud_subjective:aud_subjective_dev@localhost:5432/aud_subjective_test pnpm db:migrate:deploy
```

SQLite and in-memory database substitutes are not used.

Install the one browser used by the Phase 1 end-to-end path once:

```sh
pnpm exec playwright install chromium
```

The test boundaries are explicit:

```sh
pnpm test:web       # focused web component tests
pnpm test:backend   # real-PostgreSQL backend integration tests
pnpm test:e2e       # build, then test the production Fastify + SPA process
pnpm test           # aggregate Phase 1 test command
```

The Playwright path uses Chromium to smoke-test the same-origin production application at narrow and desktop widths and runs a focused automated axe accessibility scan. Automated results complement rather than replace manual accessibility review.

## Production shape

`pnpm build` compiles the contracts package, backend, and Vite application. The multi-stage `Dockerfile` produces one Node.js 24 image in which a single Fastify process serves `/health/*`, `/api/v1/*`, static Vite assets, and SPA navigation fallback. A runtime `DATABASE_URL` is required.

Build the image with:

```sh
docker build -t aud-subjective-platform .
```

GitHub Actions performs formatting, lint, typecheck, web component, real-PostgreSQL integration, production build, Chromium smoke/accessibility, and Docker image checks against PostgreSQL 17.

## Root commands

```sh
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:web
pnpm test:backend
pnpm test:e2e
pnpm build
pnpm db:generate
pnpm db:migrate:dev
pnpm db:migrate:deploy
pnpm db:seed
```

## Workspace layout

```text
apps/web             React and Vite web application
apps/backend         Fastify backend application
packages/contracts   Compiled, framework-independent shared Zod API contracts
```
