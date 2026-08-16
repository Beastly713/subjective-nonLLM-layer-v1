# AUD Subjective Monitoring Platform

This repository is the implementation workspace for the V1 AUD subjective monitoring product. It currently contains foundation infrastructure only and does not implement clinical workflows.

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

The liveness endpoint checks only the running process. Readiness checks the implemented configuration, Prisma initialization, and PostgreSQL connectivity; queues, workers, authentication, and safety routing do not exist yet and are not reported.

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

## Production shape

`pnpm build` compiles the contracts package, backend, and Vite application. The multi-stage `Dockerfile` produces one Node.js 24 image in which a single Fastify process serves `/health/*`, `/api/v1/*`, static Vite assets, and SPA navigation fallback. A runtime `DATABASE_URL` is required.

Build the image with:

```sh
docker build -t aud-subjective-platform .
```

## Root commands

```sh
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
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
