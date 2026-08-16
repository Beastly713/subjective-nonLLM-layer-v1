# AUD Subjective Monitoring V1 — Phase 1 Foundation Implementation Guide

## Document status

**Status:** **COMPLETE**

**Phase:** 1 of 7

**Phase name:** Foundation

**Delivery:** 3 planned foundation commits plus 3 bounded validation-closure commits

**Implementation method used:** Commit packet method

**Validated implementation baseline:** `7a09757b89f1ed25fbc349bc269c217904d94c6e`

**Validation evidence:** [Phase 1 CI run 3](https://github.com/Beastly713/subjective-nonLLM-layer-v1/actions/runs/31975071028), completed successfully on 2026-08-16 UTC

**Repository state when this guide was written:** Documentation-only repository containing the three governing V1 specifications. This is retained as historical planning context; the repository now contains the completed Phase 1 foundation.

This document defined the implementation boundary and commit plan for Phase 1 only and now records its accepted result. It is an execution guide and completion record, not a new product, clinical, UX, or architecture specification.

Authority remains:

1. `AUD_Subjective_Monitoring_Master_Specification_V1.md`
2. `AUD_V1_Web_Product_Surface_and_UX_Implementation_Lock.md`
3. `AUD_V1_Locked_Implementation_Architecture.md`
4. this Phase 1 guide
5. later packet-specific instructions and implementation, provided they do not conflict with the sources above

If this guide appears to conflict with a governing document, the higher-authority document wins. Do not silently reinterpret a locked decision; record the conflict and correct the packet or this guide.

## Completion record

Phase 1 is implemented and accepted at the validated baseline above. The repository now contains the planned workspace, PostgreSQL/Prisma runtime, shared contracts, safe Fastify request pipeline, same-origin production packaging, accessible design-system reference, focused tests, and CI baseline described by this guide.

The three planned delivery commits were followed by three narrowly scoped closure commits discovered through end-of-phase validation. Those closures removed TypeScript 6 and Fastify deprecations, preserved strict unknown-error handling, removed inert state actions, added Vite's client type shim, and corrected two automated WCAG AA contrast findings. They did not widen Phase 1 scope.

The successful CI run verified frozen dependency installation, formatting, linting, strict typechecking, committed migration deployment against PostgreSQL 17, web component tests, backend integration tests against real PostgreSQL, the production build, Chromium smoke and axe accessibility checks, and the Docker image build.

Phase 1 remains foundation-only. Authentication, authorization, clinical/domain workflows, background jobs, email, and real-patient activation remain deliberately unimplemented.

---

# 1. Phase outcome

At the end of Phase 1, the repository is a small, coherent pnpm workspace with:

- one React/Vite web application;
- one Fastify backend application;
- one framework-independent shared contracts package;
- PostgreSQL 17 and Prisma 7 connected through the locked driver pattern;
- a first committed migration containing foundation infrastructure only;
- typed environment validation and safe application startup;
- live and readiness health endpoints;
- a polished, accessible design-system reference surface that establishes the visual language for later work;
- root development, validation, test, and build commands;
- GitHub Actions that exercise the checks the repository actually supports by the end of this phase;
- one production-shaped Docker build serving the compiled web application and API from the same backend process.

The phase proves the chosen architecture can run locally, test against real PostgreSQL, build as one deployable application, and support consistent future feature work.

It does **not** make the product clinically functional. No patient, clinician, or admin workflow is complete in this phase.

---

# 2. Phase scope

## 2.1 Included

Phase 1 includes only these foundation capabilities:

1. **Repository and tooling foundation**
   - plain pnpm workspace monorepo;
   - Node.js 24 LTS, TypeScript ESM, strict shared compiler settings;
   - root lint, format, typecheck, test, build, and development commands;
   - deliberately pinned dependency versions and committed lockfile;
   - one web app, one backend app, and one contracts package;
   - concise repository setup documentation.

2. **Local and deployable runtime foundation**
   - Vite development server and Fastify backend;
   - relative `/api/...` browser requests with a development proxy;
   - one root command that starts web and backend development processes;
   - PostgreSQL-only Docker Compose for local infrastructure;
   - one production Docker image in which Fastify serves both `/api/v1` and the built SPA;
   - startup and graceful-shutdown structure suitable for later pg-boss integration without starting speculative job workflows now.

3. **Database and backend platform foundation**
   - PostgreSQL 17;
   - Prisma ORM 7 using the `prisma-client` generator, explicit generated-client output, `prisma.config.ts`, and `@prisma/adapter-pg`;
   - one Prisma client per backend process;
   - typed environment/configuration parsing;
   - first migration for cross-cutting foundation records whose need is already locked;
   - real-PostgreSQL migration and integration-test harness;
   - request IDs, structured/redacted logging, centralized safe API error shape, liveness, and readiness.

4. **Shared contract foundation**
   - Zod-based common response/error and health contracts;
   - inferred TypeScript types rather than duplicate handwritten DTOs;
   - package export boundaries that work in backend and web builds;
   - contract-validation examples through the health endpoint path;
   - conventions for later role-specific request and response projections.

5. **Web and design-system foundation**
   - React 19, Vite 7+, React Router 8 Data Mode, and TanStack Query provider wiring;
   - Tailwind CSS 4, shadcn/open-code components, Base UI primitives, and Lucide icons using the locked stack;
   - authoritative light-theme tokens for typography, spacing, radii, surfaces, borders, shadows, motion, semantic states, and layout widths;
   - accessible low-level primitives and a restrained set of reusable product patterns justified by the reference surface;
   - a polished responsive reference surface showing the distinct patient, clinician, and admin visual directions without implementing their workflows;
   - representative loading, empty, error, restricted, stale, partial, and safety-controlled presentations;
   - accessibility checks appropriate to the implemented surface.

6. **Quality and CI foundation**
   - ESLint, Prettier, strict TypeScript, Vitest, Testing Library, and Playwright wiring;
   - real PostgreSQL for backend integration tests;
   - GitHub Actions for install, formatting/linting, typecheck, unit/integration tests, production builds, and a small browser smoke/accessibility check;
   - no redundant orchestration platform.

## 2.2 Explicitly excluded

The following belong to later phases and must not be implemented in Phase 1:

- Better Auth configuration, login, signup, password reset, MFA, or session flows;
- roles, permissions, authorization policy, user provisioning, or clinician-patient assignments;
- patient profiles, onboarding forms, recovery-goal activation, or scheduling behavior;
- weekly questionnaire behavior, assessment drafts, submissions, revisions, corrections, or backfill;
- safety questions, safety evaluator, gates, cases, dispositions, or real routing targets;
- reduction baselines, drinking calendars, targets, or consumption calculations;
- monitoring rules, policy evaluators, recurrence, persistence, recomputation, or effect planning;
- content repository behavior, patient support selection, clinician cases/tasks, engagement, reminders, or email delivery;
- pg-boss queues, schedules, and workers unless the final locked package version requires a minimal non-running compatibility seam; no business job may be registered;
- complete production readiness or authorization for real-patient data;
- deterministic demo users or clinical scenarios, which require later domain tables and flows;
- final patient, clinician, or admin navigation and feature screens;
- speculative table families, columns, indexes, abstractions, services, stores, packages, or deployment-provider integrations.

Phase 1 may create empty module directories only when a tool requires them. Prefer creating a module when its first real capability is implemented.

---

# 3. Locked decisions Phase 1 must realize

Implementation must preserve these decisions from the governing documents:

| Concern | Phase 1 decision |
|---|---|
| Repository | One plain pnpm workspace; no Nx or Turborepo |
| Applications | `apps/web` and `apps/backend` |
| Shared package | `packages/contracts`, runtime-light and framework/database independent |
| Runtime | Node.js 24 LTS, TypeScript, ESM |
| Web | React, Vite, React Router Data Mode, TanStack Query |
| Backend | Fastify modular monolith |
| Database | PostgreSQL 17 only |
| ORM | Prisma 7 with `@prisma/adapter-pg`, explicit generated output, `prisma.config.ts` |
| API | REST/JSON under `/api/v1` |
| Validation | Shared Zod schemas; no duplicated handwritten DTO types |
| Styling | Tailwind CSS 4 with shadcn/open-code and Base UI foundations |
| Production | One Docker app serving API and SPA, plus managed PostgreSQL later |
| Local infrastructure | Docker Compose runs PostgreSQL only; application processes run through pnpm |
| Tests | Vitest, Testing Library, Playwright, and real PostgreSQL integration tests |
| CI | GitHub Actions using direct, understandable jobs/steps |
| Accessibility | WCAG 2.2 AA is built into component acceptance |
| Product quality | Professional reference quality from the first web foundation |

Exact dependency patch versions were resolved from stable compatible releases in the commit that first required each dependency, then pinned in `package.json` and `pnpm-lock.yaml`. Do not repeatedly reconsider the locked technology choices during later phases. If a locked version combination cannot install or build, capture concrete evidence and make the smallest compatible correction rather than substituting an architecture.

## 3.1 Specification traceability

The phase plan is primarily derived from these governing sections:

| Phase 1 concern | Governing source |
|---|---|
| Repository, runtime, apps, datastore, and technology choices | Locked Implementation Architecture §§2–6, 9–10, 173–174 |
| Shared REST/Zod contract boundary | Locked Implementation Architecture §§15–18, 46, 121–123 |
| Database/Prisma bootstrap and incremental modeling | Locked Implementation Architecture §§23–25, 37–38, 81, 167–168 |
| Request IDs, logging, errors, configuration, and redaction | Locked Implementation Architecture §§40–42, 57–59, 91, 96–97, 151 |
| Local development, same-origin production, and packaging | Locked Implementation Architecture §§82–92 |
| Design system, product patterns, responsiveness, and accessibility | UX Implementation Lock §§1–6, 31–35, 40–43; Locked Implementation Architecture §§60–70, 118–119 |
| Testing and CI | Locked Implementation Architecture §§71–80 |
| Simplicity and Codex-oriented implementation boundaries | Locked Implementation Architecture §§99–117, 169–172, 175–177 |
| Domain terms and invariants that foundation code must not distort | Master Specification §§2–5, 23, 27–30 |

These references define constraints, not permission to implement the later features described near them.

---

# 4. Commit plan and completion record

| Commit | SHA | Identity | Result |
|---|---|---|---|
| 1 | `ccdd59f` | `chore: bootstrap the V1 workspace and application skeleton` | Complete — strict pnpm monorepo with web/backend/contracts boundaries and root developer commands |
| 2 | `bb0b0ea` | `feat: establish the PostgreSQL and API runtime foundation` | Complete — Prisma/PostgreSQL, initial migration, shared health/error contracts, safe Fastify runtime, and production-shaped packaging |
| 3 | `4259e7d` | `feat: establish the accessible product design system and CI baseline` | Complete — polished responsive reference surface, reusable state patterns, focused UI tests, Playwright, and Phase 1 CI baseline |
| Closure 1 | `18ca4e3` | `fix: close Phase 1 validation issues` | Complete — TypeScript 6 strictness and inert state-action corrections |
| Closure 2 | `8241c6b` | `fix: resolve remaining Phase 1 validation blockers` | Complete — Vite client typing, Fastify logging API, and formatting correction |
| Closure 3 | `7a09757` | `fix: axe detecting two WCAG AA contrast violations` | Complete — final automated contrast corrections; full Phase 1 CI passed |

The original three-commit delivery plan was preserved. The additional commits were bounded validation closures made after the primary Commit 3 history had already been pushed; they are part of the accepted Phase 1 record rather than new feature scope.

---

# 5. Commit 1 packet definition

## Commit identity

```text
chore: bootstrap the V1 workspace and application skeleton
```

## Goal

Create the smallest correct repository skeleton that proves the locked package boundaries and development workflow. A developer should be able to install dependencies, run the web and backend together, and execute the initial static checks without feature code or architectural ambiguity.

## Assumptions to verify before implementation

- The repository still contains only the governing documentation and any explicitly accepted corrections.
- Node.js 24 LTS and pnpm are available or their required versions can be declared clearly.
- No existing root/package configuration must be preserved.
- Stable, mutually compatible versions exist for the locked core stack.
- The final production database/runtime integration is intentionally deferred to Commit 2.

If any assumption is false, the packet must describe the observed state and adjust only the affected file plan.

## Exact scope

1. Establish root workspace metadata and package discovery.
2. Add shared TypeScript, ESLint, and Prettier configuration with strict compiler rules, including:
   - `strict`;
   - `noUncheckedIndexedAccess`;
   - `exactOptionalPropertyTypes`.
3. Add deterministic root scripts for development, linting, formatting checks, typechecking, unit tests, and builds. Scripts may call package scripts directly; do not add a monorepo orchestrator.
4. Bootstrap:
   - `apps/web` as React + Vite;
   - `apps/backend` as Fastify;
   - `packages/contracts` as a framework-independent Zod package.
5. Configure React Router 8 in Data Mode with `createBrowserRouter`, but implement only a temporary foundation route and route-level error boundary. Do not create future feature routes.
6. Configure TanStack Query at the application-provider boundary without adding global client state.
7. Add a minimal Fastify application factory and server entrypoint. At this commit it may expose a temporary liveness response; the contract-backed health implementation belongs to Commit 2.
8. Configure Vite to proxy relative `/api` requests to the backend in development.
9. Add a root `pnpm dev` command that runs web and backend with clean termination behavior.
10. Add minimal setup documentation and safe repository hygiene files.

## Expected file-level changes

The packet should expect changes in these paths, adjusted to actual tool output and repository state:

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.base.json
eslint.config.js
prettier.config.mjs
.gitignore
.editorconfig                      # only if it adds concrete cross-editor value
.nvmrc or .node-version            # choose one, not both
README.md

apps/web/package.json
apps/web/index.html
apps/web/tsconfig*.json
apps/web/vite.config.ts
apps/web/src/main.tsx
apps/web/src/app/router/*
apps/web/src/app/providers/*
apps/web/src/styles/*               # only the minimum needed to render safely

apps/backend/package.json
apps/backend/tsconfig.json
apps/backend/src/app.ts
apps/backend/src/server.ts

packages/contracts/package.json
packages/contracts/tsconfig.json
packages/contracts/src/index.ts
```

Do not create placeholder files for every future backend module or frontend feature folder.

## Acceptance criteria

1. `pnpm install` completes and produces a committed lockfile.
2. The repository uses pnpm workspaces without Nx or Turborepo.
3. `pnpm dev` starts one Vite development server and one Fastify backend process from a single root command.
4. The browser application renders the foundation route and uses React Router Data Mode.
5. Browser API paths remain relative and Vite proxies `/api` in development.
6. `packages/contracts` can be imported by both apps, but imports neither React, Fastify, nor Prisma.
7. The web application imports no backend source, and the backend exposes no database model to the web.
8. Root format check, lint, typecheck, unit-test command, and build command all succeed for the code that exists.
9. TypeScript is strict and does not rely on `any`, broad casts, or disabled checks to pass.
10. No clinical/domain behavior, authentication, database schema, or future feature screen has been implemented.
11. Setup documentation accurately describes current prerequisites and commands without claiming the application is clinically functional.

## Do not do

- Do not add Next.js, NestJS, Nx, Turborepo, Redux, Zustand, Axios, or a dependency-injection framework.
- Do not add Docker Compose, Prisma, auth, jobs, email, or deployment-provider configuration in this commit.
- Do not create role-specific dashboards or fake product data.
- Do not reproduce Master Specification enums merely to make the contracts package look substantial.
- Do not add empty generic helpers, repositories, services, hooks, or component libraries.
- Do not commit generated build output.

## Evidence required for review

- repository tree for new source/config files;
- dependency and workspace summary;
- output of root format/lint/typecheck/test/build checks;
- a brief run log or direct HTTP/browser evidence showing both development processes start;
- `git diff --check` and the complete diff inspected by the reviewer.

---

# 6. Commit 2 packet definition

## Commit identity

```text
feat: establish the PostgreSQL and API runtime foundation
```

## Goal

Connect the backend to the single locked datastore, establish the first real shared API contracts and backend platform behavior, and prove both local and production-shaped runtime paths without implementing feature domains.

## Assumptions to verify before implementation

- Commit 1 is approved and its working-tree result is the actual starting point.
- The chosen Prisma 7, adapter, PostgreSQL driver, and Fastify versions are compatible under Node.js 24.
- Docker is available for local/integration verification, or the packet records a concrete environment limitation without weakening the implementation.
- No Phase 2 identity/auth schema has already been introduced.
- The normal application database role and deployment role strategy can be represented without pretending local development fully provisions production security.

## Exact scope

1. Add PostgreSQL 17 Alpine as the only Docker Compose service, with a health check and persistent local volume.
2. Add typed environment parsing for the configuration currently required, including database URL, runtime mode, host/port, base URL or allowed development origin where applicable, and log level. Provide `.env.example` with names and safe local examples only.
3. Configure Prisma 7 with:
   - `prisma.config.ts`;
   - `prisma-client` generator;
   - explicit generated-client output;
   - `@prisma/adapter-pg`;
   - one backend Prisma client lifecycle.
4. Create the first committed migration containing only foundation records already justified across multiple later features:
   - `idempotency_records` for the executable consequential-write contract;
   - `patient_processing_locks` for ordered patient-state serialization;
   - `audit_events` for append-only audit history;
   - `operational_incidents` for durable critical operational failure state;
   - `real_patient_readiness_records` only if the implementation can define a minimal versioned readiness record without guessing deployment policy fields.
5. Use stable canonical fields needed by the locked contracts: UUID identity, timestamps, action/scope/status fields, structured metadata where appropriate, request/provenance references, and expiry/version fields where specified. Add only constraints and indexes supported by known V1 access/invariant needs.
6. Add migration SQL needed for database-level append-only protection of `audit_events`. Keep environment-specific grants separable if the local migration user cannot represent the final deployment-role model safely.
7. Add shared Zod contracts for:
   - common API error envelope;
   - liveness response;
   - readiness response and non-sensitive check status;
   - request ID representation where exposed.
8. Add the common Fastify request pipeline foundation:
   - request ID creation/propagation;
   - Pino structured logging and explicit sensitive-path redaction;
   - centralized error mapping to the shared safe error contract;
   - no raw stack, Prisma, SQL, or internal provider errors in browser responses.
9. Implement:
   - `GET /health/live` for process liveness;
   - `GET /health/ready` for startup configuration and PostgreSQL/Prisma readiness.
10. Readiness must report only checks that actually exist. Because jobs are not implemented in this phase, it must not falsely claim queue, schedule, or worker readiness. The response or documentation should make that limited Phase 1 meaning explicit.
11. Add migration, generation, and seed command structure. A seed may be empty or foundation-only; do not create fake clinical data before its authoritative schema exists.
12. Add a real-PostgreSQL integration test proving migration/application connectivity, contract-valid health responses, request ID behavior, and safe error serialization.
13. Add one standard multi-stage Dockerfile that builds contracts, web, and backend; contains the generated Prisma client and production dependencies; and has Fastify serve the SPA and API from one process.
14. Add graceful shutdown for Fastify and Prisma/database resources. Leave an explicit internal lifecycle seam for later pg-boss shutdown, but do not implement a generic lifecycle framework.

## Expected file-level changes

```text
docker-compose.yml
Dockerfile
.dockerignore
.env.example
package.json                         # database/build/runtime scripts

apps/backend/package.json
apps/backend/prisma.config.ts
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<initial_foundation_migration>/migration.sql
apps/backend/prisma/seed.ts          # only if useful without speculative data
apps/backend/src/generated/prisma/*  # handling follows the chosen Prisma build strategy
apps/backend/src/infrastructure/config/*
apps/backend/src/infrastructure/db/*
apps/backend/src/infrastructure/logging/*
apps/backend/src/shared/errors/*
apps/backend/src/app.ts
apps/backend/src/server.ts
apps/backend/src/routes/health.ts     # or an equally local, non-generic location
apps/backend/test/integration/*

packages/contracts/src/common/*
packages/contracts/src/health/*
packages/contracts/src/index.ts

apps/web/vite.config.ts              # production/static or proxy alignment if needed
README.md
```

Generated Prisma client files are committed only if the selected Prisma 7/tooling strategy and reproducible builds clearly require it. Otherwise generate them during install/build and keep output ignored. The packet must state and verify the selected approach rather than leaving generated artifacts accidental.

## Acceptance criteria

1. `docker compose up -d` starts only PostgreSQL 17 and reaches healthy state.
2. Prisma uses the locked Prisma 7 generator/config/adapter pattern; no pre-v7 bootstrap remains.
3. A clean database can apply committed migrations using the documented development/deployment commands.
4. The first migration includes only justified cross-cutting foundation tables and their known constraints/indexes.
5. `audit_events` cannot be updated or deleted through the normal application persistence path; the exact local and deployment enforcement boundary is documented and tested where executable.
6. Shared Zod schemas validate both liveness and readiness responses, and inferred types are used by consumers.
7. `/health/live` responds without requiring database availability.
8. `/health/ready` fails or reports not ready when required configuration/database connectivity is unavailable and succeeds when PostgreSQL is ready.
9. Health output contains no secrets, connection strings, or sensitive routing details.
10. Every request has a request ID; safe API errors include it and never expose stack traces or database internals.
11. Logging is structured and redacts configured secrets, authentication material, and likely sensitive request fields.
12. Backend integration tests use real PostgreSQL, not SQLite or an in-memory substitute.
13. A production build creates one runnable image/process that serves the SPA and backend endpoints under the intended same-origin shape.
14. Shutdown closes HTTP and database resources cleanly.
15. The root validation suite remains green.
16. No auth/domain workflow, job queue, external email, or provider-specific deployment dependency has been introduced.

## Do not do

- Do not model every table family listed in the architecture. Domain columns are intentionally implemented with their owning feature.
- Do not add Better Auth tables early; they belong with the Phase 2 identity implementation and the selected adapter/migration flow.
- Do not add Redis, RabbitMQ, Kafka, a second database, a cache, or a separate worker process.
- Do not implement pg-boss business queues or pretend readiness checks exist for unregistered workers.
- Do not create a generic repository, transaction manager, event bus, service container, or universal audit framework.
- Do not put Prisma types into `packages/contracts`.
- Do not expose raw Prisma records as API responses.
- Do not use `prisma db push` as the migration workflow.
- Do not add hard-coded safety routes or emergency numbers.
- Do not claim real-patient readiness from infrastructure boot success.

## Evidence required for review

- clean migration application against PostgreSQL 17;
- Prisma generation output and adapter/bootstrap inspection;
- database table/constraint/index evidence for the initial migration;
- append-only audit enforcement test/evidence;
- liveness/readiness responses in ready and database-unavailable conditions;
- safe error and request-ID integration-test output;
- production image build plus same-origin SPA/API smoke evidence;
- graceful-shutdown evidence;
- root validation output, `git diff --check`, and complete diff inspection.

---

# 7. Commit 3 packet definition

## Commit identity

```text
feat: establish the accessible product design system and CI baseline
```

## Goal

Create a polished visual and interaction foundation that later feature packets can reuse, then make the complete Phase 1 contract enforceable in CI. The result should demonstrate product seriousness without pretending that future role workflows already exist.

## Assumptions to verify before implementation

- Commits 1 and 2 are approved and present in the working tree.
- The web stack and shared contracts work in development and production builds.
- No visual brand palette beyond the UX direction has been locked; restrained design judgment is therefore allowed.
- Light mode is the only required initial theme.
- CI can launch PostgreSQL and a browser in the selected GitHub-hosted runner.

## Exact scope

1. Establish authoritative light-theme design tokens for:
   - typography;
   - spacing;
   - radii;
   - surface hierarchy;
   - borders and shadows;
   - layout widths;
   - focus treatment;
   - restrained motion and reduced-motion behavior;
   - semantic danger, warning, information, success, stale, and restricted states.
2. Configure the locked UI stack. Add only shadcn/open-code and Base UI primitives used by this commit's reference surface.
3. Implement a small, reusable foundation set, expected to include:
   - button and link treatment;
   - form field/label/help/error treatment;
   - card/surface primitive;
   - badge/state indicator that never depends on color alone;
   - dialog/confirmation primitive;
   - loading skeleton;
   - empty, error, and restricted states.
4. Implement only product patterns demonstrated more than once or central to future consistency, expected to include:
   - `PageHeader` or equivalent hierarchy primitive;
   - `StateBadge` and `FreshnessBadge` or a carefully shared equivalent;
   - `LoadingState`, `EmptyState`, `ErrorState`, and `RestrictedState`;
   - `ConfirmActionDialog`;
   - a minimal shell/navigation pattern capable of expressing distinct role density.
5. Build one polished responsive **foundation reference surface** at the temporary root route. It should:
   - show the common brand/design language;
   - demonstrate calm/mobile-first patient presentation;
   - demonstrate denser clinician and admin presentation samples;
   - show representative state and form patterns;
   - label all content clearly as a design-system/reference surface, not live patient state;
   - use static local examples only, not a fake backend or fabricated authoritative metrics.
6. Represent loading, empty, error, restricted, stale, partial, and safety-controlled styles without implementing their domain transitions.
7. Meet WCAG 2.2 AA-oriented component requirements for keyboard use, visible focus, semantic names, error association, status messaging, contrast, target sizing, zoom/reflow, and reduced motion.
8. Add focused Vitest/Testing Library tests for accessibility-sensitive or stateful primitives. Do not snapshot every component.
9. Add one small Playwright smoke/accessibility path for the reference surface and same-origin production serving. Automated accessibility tooling may be added only for this concrete test need.
10. Add GitHub Actions that execute the complete Phase 1 validation path:
    - pinned pnpm setup and frozen-lockfile install;
    - format/lint;
    - typecheck;
    - unit/component tests;
    - PostgreSQL migration/integration tests;
    - backend and web production builds;
    - the small Playwright smoke/accessibility check.
11. Keep CI understandable and fast. Parallelize independent checks only where it saves meaningful time without duplicating expensive setup excessively.
12. Update setup documentation with the verified clean-clone development, database, testing, and production-build workflow.

## Expected file-level changes

```text
apps/web/package.json
apps/web/components.json             # if required by the selected shadcn setup
apps/web/src/styles/*
apps/web/src/components/ui/*         # only primitives actually used
apps/web/src/components/patterns/*   # only patterns actually demonstrated/reused
apps/web/src/app/router/*
apps/web/src/features/foundation/*   # reference surface; not a fake product feature
apps/web/src/**/*.test.tsx

tests/e2e/* or apps/web/e2e/*         # choose one clear project convention
playwright.config.ts                  # location may follow the chosen convention

.github/workflows/ci.yml
package.json
README.md
```

Avoid creating chart wrappers in Phase 1 unless the reference surface has a real backend-provided metric to chart. The chart architecture remains locked, but feature-owned chart wrappers can arrive with the first real chart in a later phase.

## Acceptance criteria

1. The reference surface looks intentional and professional at representative mobile, tablet, and desktop widths.
2. Patient, clinician, and admin samples share tokens and primitives while visibly reflecting their intended differences in spacing and information density.
3. No surface is presented as a functioning role dashboard, and no fake clinical result is implied to be authoritative.
4. Tokens are centralized and semantic state meaning is never encoded by color alone.
5. The implemented controls are fully keyboard operable with visible, unobscured focus.
6. Form labels, help text, validation errors, dialogs, and status changes have correct semantic relationships/announcements.
7. Reduced-motion and zoom/reflow behavior are usable; the main reference surface has no horizontal overflow at supported narrow widths.
8. Loading, empty, error, restricted, stale, partial, and safety-controlled examples are visually distinct and use appropriate plain language.
9. Only primitives used by the reference surface are added; there is no universal component framework or second UI library.
10. Focused component tests pass without broad snapshot coverage.
11. Playwright verifies the reference route, a meaningful keyboard path, an automated accessibility scan, and same-origin production smoke behavior.
12. CI starts real PostgreSQL for migration/integration testing and runs every Phase 1 quality gate from a clean checkout with a frozen lockfile.
13. CI and local scripts call the same underlying checks so local success predicts CI success.
14. A clean production build and Docker build remain successful.
15. No dark mode, analytics SDK, runtime translation platform, chart dashboard, authentication UI, or future feature workflow has been added.

## Do not do

- Do not build complete PatientShell, ClinicianShell, or AdminShell navigation before identity/routing work requires them.
- Do not add polished but fake clinical dashboards, invented scores, arbitrary charts, or mock API layers.
- Do not install a second component framework or bulk-generate unused shadcn components.
- Do not add dark mode merely because tokens make it possible.
- Do not create thousands of screenshots or snapshot tests.
- Do not add a visual-regression SaaS, APM, analytics, or other external service.
- Do not weaken accessibility checks to preserve a visual effect.
- Do not move domain state interpretation into UI components; examples are presentation states only.
- Do not expand CI into a release/deployment workflow in this phase.

## Evidence required for review

- screenshots at agreed representative mobile and desktop widths;
- keyboard navigation and visible-focus evidence;
- automated accessibility result plus noted limitations of automation;
- component and Playwright test output;
- complete CI-equivalent local command output;
- clean PostgreSQL migration/integration run;
- production web/backend and Docker build output;
- same-origin production smoke result;
- `git diff --check` and complete diff inspection.

---

# 8. Phase-wide acceptance criteria

**Completion verdict: COMPLETE.** All criteria below were satisfied by the validated implementation baseline and successful Phase 1 CI run recorded in the document status.

1. All three commit scopes have been implemented and individually reviewed through the packet method.
2. The workspace is one repository with one web app, one backend app, and one contracts package.
3. A clean setup can reach a working local environment using PostgreSQL plus `pnpm dev` without undocumented terminals or services.
4. PostgreSQL is the only datastore and Docker Compose runs infrastructure only.
5. Prisma 7 uses `prisma.config.ts`, explicit client output, and `@prisma/adapter-pg`.
6. Shared API schemas live in `packages/contracts` and contain no framework, database, or domain-evaluator implementation.
7. The backend owns response construction and returns contract-safe projections rather than database objects.
8. The initial migration is narrow, committed, reproducible, and does not pre-build later domain schemas.
9. Request IDs, safe structured errors, redacted structured logging, liveness, readiness, and graceful shutdown are operational.
10. The development browser uses relative API paths and production uses the same-origin SPA/API shape.
11. One production Docker image builds and runs without provider-specific runtime APIs.
12. Root scripts and CI enforce formatting, linting, strict typechecking, tests, migrations/integration tests, builds, and the small browser/accessibility smoke suite.
13. The web foundation visibly establishes a polished, coherent light-theme design language suitable for all three workspaces.
14. Accessibility behavior is embedded in implemented primitives rather than deferred to Phase 7.
15. The repository contains no authentication, domain workflows, fake backend, speculative infrastructure, or unnecessary abstraction.
16. Documentation states accurately what is ready, what remains deliberately absent, and that real-patient use is not authorized.

Phase 1 is **not** accepted merely because packages install or placeholder apps render. It must prove the architecture, database/runtime path, contract boundary, visual baseline, and repeatable validation workflow together.

That proof is now recorded by the successful end-to-end CI path. Later phases must preserve these criteria but should not reopen Phase 1 unless a regression is found.

---

# 9. Commit packet operating method

The three definitions above are retained as the historical Phase 1 packet templates. Phase 1 implementation is complete, so this operating method is no longer an active instruction to create additional Phase 1 work. It remains useful as provenance for how the accepted foundation was produced.

## 9.1 Before issuing a packet

The packet author must inspect the actual repository, not rely on the previous implementation summary. At minimum inspect:

```text
git status --short
git diff --stat
git diff
git log --oneline --decorate -n <reasonable count>
relevant file tree
relevant package manifests/configuration
the tests and commands affected by the next packet
```

Also confirm the prior verdict and any unresolved correction. Preserve unrelated user changes and identify overlapping changes before implementation.

## 9.2 Required packet contents

Every executable packet must state:

1. **Commit identity/message** — the intended coherent commit name.
2. **Goal** — the outcome, not a list of files.
3. **Verified starting state** — relevant facts observed directly in the repository.
4. **Assumptions** — only assumptions still necessary after inspection.
5. **Exact scope** — required behavior and boundaries for this packet.
6. **File-level plan** — files expected to be added/changed/removed, reconciled with actual paths.
7. **Acceptance criteria** — objectively checkable completion conditions.
8. **Verification commands/evidence** — proportionate to risk and runnable in the current repository.
9. **Do-not-do boundaries** — future work and tempting unrelated changes explicitly excluded.
10. **Corrections carried forward** — any required fix from the prior verdict, placed before new scope.

The packet should be precise about outcomes and boundaries while leaving ordinary implementation details to Codex when the specifications do not lock them.

## 9.3 Implementation authority

For each packet, Codex is authorized to modify the working tree only.

Codex must **not**:

- create a Git commit;
- push a branch;
- open a pull request;
- implement the next packet;
- perform unrelated refactors;
- add optional infrastructure or speculative abstractions.

Commit, push, and publication require a separate explicit user instruction.

## 9.4 Review and verdict

After Codex reports completion, the reviewer must inspect the actual working tree and evidence. The summary is useful orientation, not proof.

Review at minimum:

- complete diff and diff stat;
- untracked files;
- relevant generated artifacts;
- dependency/lockfile changes;
- migration SQL and schema changes where present;
- tests and validation output;
- runtime/browser evidence where required;
- compliance with the packet's do-not-do boundary.

The verdict must be exactly one of:

```text
APPROVE
APPROVE WITH SMALL FOLLOW-UP
REQUEST FIXES
REJECT
```

Use them as follows:

- **APPROVE** — packet meets its criteria and has no required correction.
- **APPROVE WITH SMALL FOLLOW-UP** — packet is acceptable as a coherent unit; a small, non-risky correction is explicitly carried at the start of the next packet.
- **REQUEST FIXES** — packet is not yet acceptable. The next issued packet is a correction packet for the same intended commit; nominal next-commit scope must not begin until the fixes pass review.
- **REJECT** — the approach materially violates the specifications, architecture, safety boundary, or commit scope and should be replaced rather than incrementally patched.

Corrections are never buried silently inside unrelated later work. Each correction is listed first, tied to failed evidence or an unmet criterion, and re-verified. A correction may be included at the front of the next nominal packet only for `APPROVE WITH SMALL FOLLOW-UP`; `REQUEST FIXES` and `REJECT` block progression.

## 9.5 Commit handoff

When a packet receives `APPROVE`, or `APPROVE WITH SMALL FOLLOW-UP` under the user's chosen workflow:

1. report the exact reviewed scope;
2. report remaining follow-up, if any;
3. wait for explicit instruction before committing;
4. after any user-authorized commit, inspect the repository again before preparing the next packet.

Do not treat the phase plan as permission to implement all three commits in one working-tree change.

---

# 10. Decision rules for ambiguity during Phase 1

When the governing documents do not specify an implementation detail:

1. choose the simplest option that satisfies the current packet and locked architecture;
2. prefer conventional library-supported configuration over custom infrastructure;
3. preserve the web/contracts/backend boundary;
4. keep changes local to the capability being implemented;
5. add an abstraction only after a second concrete use or a locked correctness need demonstrates it;
6. avoid naming future domain behavior before its owning phase;
7. record a material choice in the packet or nearby repository documentation only when future work needs to rely on it.

Pause and request direction only when the choice would materially change a locked architecture decision, product behavior, safety behavior, data invariant, deployment shape, or commit boundary.

---

# 11. Phase 1 non-goals and architectural guardrails

Throughout this phase:

- infrastructure remains one application plus PostgreSQL;
- the backend remains authoritative even though domain behavior is not implemented yet;
- the frontend remains thin and does not calculate authoritative domain state;
- contracts describe API boundaries, not database models;
- schema work remains incremental and owned by concrete requirements;
- design-system work serves real recurring product needs, not a generic component showcase;
- CI validates the repository without becoming a separate platform;
- production packaging remains portable and same-origin;
- real-patient mode remains unavailable and must never be implied by a green health check;
- `ema.enabled` and other canonical policy configuration are not prematurely implemented merely to copy the specification into code.

No new service, framework, datastore, package, or abstraction is acceptable unless the active packet identifies the concrete requirement it satisfies and explains why the existing locked stack cannot satisfy that requirement more simply.

---

# 12. Phase completion handoff to Phase 2

Phase 1 hands Phase 2 a verified platform foundation, not a partially implemented identity system.

Phase 2 may rely on:

- stable workspace and package boundaries;
- working PostgreSQL/Prisma migrations;
- common API/error/health contract patterns;
- backend application and request-pipeline conventions;
- production-shaped local/build behavior;
- reusable accessible visual tokens and primitives;
- repeatable tests and CI.

Phase 2 must still inspect the actual repository before defining its first packet. It should then implement identity, authentication, authorization/assignments, profiles, scheduling, and routing foundation according to its own phase guide and the governing specifications.

Phase 1 must not pre-empt those decisions through placeholder implementations.
