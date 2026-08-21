# AUD Subjective Monitoring Platform

This repository is the implementation workspace for the V1 AUD subjective monitoring product. Phase 1 foundation, Phase 2 identity/core-platform work, Phase 3 safety-gated onboarding and reduction setup, Phase 4 weekly monitoring core, and Phase 5 patient support and clinical review are complete. Phase 5 is validated at implementation head `f6bc02b` (`fix: close phase 5 patient support and clinical review`). The current codebase includes server-backed onboarding and weekly-assessment drafts/revisions, deterministic safety and weekly-monitoring evaluation, governed patient support resolution, Level-2 clinician visibility, Level-3 clinical review cases, and durable in-app clinician tasks.

The weekly assessment and subjective-monitoring core is implemented, including current/late/historical submissions, immutable revisions, patient and assigned-clinician corrections, deterministic derived state, candidate intervention/reason outputs, and forward recomputation. Phase 5 consumes those authoritative outputs for deterministic patient support and clinician review without adding engagement workers, external delivery, backup/retention controls, or other later-phase operational controls. Prototype activation is supported; `real_patient` operation remains refused until the locked production requirements are present.

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

The root route resolves the authoritative server session and backend-provided workspace destinations. Anonymous visitors are sent to `/login`; restricted accounts see their application access state. In development, the Phase 1 design-system reference remains available at `/dev/foundation`.

Authentication uses Better Auth database-backed, HTTP-only cookie sessions. Public signup is disabled. Application-owned account state, roles, permissions, direct assignments, and privileged-identity provenance control backend access. Configure `RESEND_API_KEY` and `EMAIL_FROM` together to enable verification and password recovery.

Weekly boundaries are calculated only by the backend from the stored IANA monitoring timezone and persisted as immutable Monday-to-Monday periods. Phase 3 onboarding completion can create the initial goal and schedule only after the required authoritative onboarding revision, reduction setup where applicable, and safety result are present. The Phase 4 assessment API now provides server-backed drafts, immutable `PARTIAL`/`COMPLETE` revisions, backend-supplied recall dates, reduction-week observations, corrections, historical backfill, and forward monitoring recomputation. Phase 5 resolves the persisted patient and clinician effects into governed support resources, Level-2 visibility, Level-3 review cases, and durable in-app clinician tasks. Regional routing is relational, versioned, and requires current per-target deployment-test evidence before a draft can activate; the platform never supplies a universal emergency fallback.

Readiness separately reports PostgreSQL, authentication and authorization schemas, regional-routing schema/configuration, onboarding/safety and safety-case schemas, instrument configuration, email capability, and real-patient operational status. Prototype mode can be healthy without an active real-world route. `real_patient` remains explicitly not ready because the full locked operational controls are not present.

## Database commands

```sh
pnpm db:generate
pnpm db:migrate:dev
pnpm db:migrate:deploy
pnpm db:seed
```

Migrations are applied as a release or pre-deploy action, not independently by every application instance at startup.

`pnpm db:seed` creates repeatable prototype-only identities and refuses to run
in `real_patient` mode:

- `patient.demo@example.test` / `DemoPatient!2026`
- `clinician.demo@example.test` / `DemoClinician!2026`
- `admin.demo@example.test` / `DemoAdmin!2026`

## Tests

Backend integration tests require a migrated, isolated real PostgreSQL database identified by `TEST_DATABASE_URL`. With the local Compose service running, create the example database and deploy migrations to it before the platform validation run:

```sh
docker compose exec postgres createdb -U aud_subjective aud_subjective_test
DATABASE_URL=postgresql://aud_subjective:aud_subjective_dev@localhost:5432/aud_subjective_test pnpm db:migrate:deploy
```

SQLite and in-memory database substitutes are not used.

Install the browser used by the production-shaped end-to-end path once:

```sh
pnpm exec playwright install chromium
```

The test boundaries are explicit:

```sh
pnpm test:web       # focused web component tests
pnpm test:backend   # real-PostgreSQL backend integration tests
pnpm test:e2e       # build, then test the production Fastify + SPA process
pnpm test           # aggregate platform validation command
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
pnpm contracts:build
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

## Documentation

- [V1 Master Specification](docs/AUD_Subjective_Monitoring_Master_Specification_V1.md) — authoritative product and clinical rules;
- [Locked Implementation Architecture](docs/AUD_V1_Locked_Implementation_Architecture.md) — repository, runtime, persistence, and module boundaries;
- [Web Product Surface and UX Lock](docs/AUD_V1_Web_Product_Surface_and_UX_Implementation_Lock.md) — intended role-based product surface and current route boundary;
- [Phase 1](docs/AUD_V1_Phase_1_Foundation_Implementation_Guide.md), [Phase 2](docs/AUD_V1_Phase_2_Identity_and_Core_Platform_Implementation_Guide.md), [Phase 3](docs/AUD_V1_Phase_3_Safety_Onboarding_and_Reduction_Setup_Implementation_Guide.md), [Phase 4](docs/AUD_V1_Phase_4_Weekly_Monitoring_Core_Implementation_Guide.md), and [Phase 5](docs/AUD_V1_Phase_5_Patient_Support_and_Clinical_Review_Implementation_Guide.md) — implementation completion records and historical packet plans;
- [Phase 4 invariant validation](validation/phase4_invariants.sql) and [Phase 5 invariant validation](validation/phase5_invariants.sql) — committed database invariant queries used by the phase closeout sweeps.
