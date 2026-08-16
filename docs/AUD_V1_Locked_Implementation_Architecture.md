# AUD Subjective Monitoring V1 — Locked Implementation Architecture

## 0. Document status

**Status:** **LOCKED V1 IMPLEMENTATION ARCHITECTURE**

**Purpose:** Define the concrete implementation architecture for the V1 web product while preserving the existing clinical/domain specification and the previously locked product/UX architecture.

**Current implementation status:** Phase 1 foundation is complete. Identity, authentication, authorization, clinical/domain workflows, background jobs, email, and real-patient activation remain future implementation work. See `AUD_V1_Phase_1_Foundation_Implementation_Guide.md` for the validated foundation record.

This document is subordinate to:

1. `AUD_Subjective_Monitoring_Master_Specification_V1.md`
2. `AUD_V1_Web_Product_Surface_and_UX_Implementation_Lock.md`

If this implementation document conflicts with either authoritative behavioral document, the **V1 Master Specification wins** for domain behavior and the **UX Implementation Lock wins** for the intended product surface unless that surface conflicts with the Master Specification.

This document locks the repository/runtime/technology stack, frontend/backend boundaries, persistence model, authentication/session and authorization approach, API contracts, background jobs, transactional enqueueing, audit, patient-level serialization, idempotency, historical recomputation/effect policy, deployment/runtime configuration, real-patient readiness controls, testing architecture, and Codex-oriented implementation conventions.

It does **not** change any V1 questionnaire, threshold, safety, recurrence, reduction, engagement, case, content, or historical interpretation rule.

New infrastructure, services, stores, frameworks, or architectural layers require a concrete unmet requirement. They are not added merely because they are common in production systems.

# 1. Decision philosophy

The implementation is optimized for the following constraints:

1. The product will grow quickly.
2. Implementation will be heavily assisted by Codex.
3. Development cannot afford repeated architectural rewrites.
4. Commits should be coherent and substantial rather than microscopic.
5. Frontend quality is a first-class requirement.
6. Web and future mobile clients should remain thin.
7. Most backend/domain behavior must live in one reusable system.
8. Deployment should be straightforward.
9. Infrastructure complexity must be aggressively minimized.
10. Complexity is accepted only where the V1 domain itself requires it.

The governing implementation rule is:

> **Use the simplest architecture that preserves correctness, auditability, deployment viability, rapid development, and future mobile reuse.**

A second rule is:

> **Do not solve future scale problems before they exist. Preserve clean extraction boundaries instead.**

---

# 2. Locked architecture summary

## 2.1 One repository

Use one **pnpm workspace monorepo**.

No Nx.

No Turborepo initially.

No separate frontend/backend repositories.

No separate repository for domain rules.

No separate repository for contracts.

```text
aud-subjective-platform/
│
├── apps/
│   ├── web/
│   └── backend/
│
├── packages/
│   └── contracts/
│
├── docs/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.mjs
├── docker-compose.yml
├── Dockerfile
└── .github/
    └── workflows/
```

The repository remains small enough to navigate easily while still making ownership clear.

---

## 2.2 One frontend application

Use one web application containing all three workspaces:

```text
PATIENT
CLINICIAN
ADMIN
```

The workspaces share:

- runtime;
- API client;
- authentication client;
- design system;
- routing;
- accessibility primitives;
- error/loading behavior.

They retain separate shells and feature folders.

---

## 2.3 One backend application

Use one **modular monolith**.

The same backend owns:

- authentication integration;
- users/roles/permissions;
- patient profiles;
- scheduling;
- assessments;
- safety;
- reduction/consumption;
- subjective monitoring evaluation;
- content resolution;
- clinician cases;
- engagement;
- durable clinician tasks;
- notifications;
- technical failures;
- admin operations;
- audit/provenance.

There is no service-to-service network boundary inside V1.

---

## 2.4 One backend process in V1

The V1 deployment runs:

```text
ONE Node.js process
```

that performs all of the following:

```text
Fastify HTTP API
+
Better Auth handlers
+
Vite production static-file serving
+
pg-boss background workers/schedules
```

This gives V1 one application service to deploy and operate.

The job-worker code is still isolated internally so it can later become a second process without rewriting domain logic.

**V1 does not deploy a separate worker service unless actual runtime load or operational evidence requires it.**

---

## 2.5 One primary database

Use:

```text
PostgreSQL 17
```

as the single primary persistence system.

It stores:

- application/domain records;
- auth/session data;
- versioned records;
- current projections;
- audit records;
- operational incidents;
- durable job state through `pg-boss`.

No MongoDB.

No Redis.

No Elasticsearch.

No separate event store.

No vector database.

No dedicated message broker.

---

# 3. Concrete technology stack

## 3.1 Runtime and language

```text
Node.js 24 LTS
TypeScript
ESM
strict TypeScript configuration
pnpm
```

Use the Node 24 LTS line rather than Node 26 Current.

Rationale:

- production/LTS runtime;
- modern ESM support;
- shared language across web/backend/contracts;
- straightforward Codex-assisted development;
- excellent library ecosystem;
- avoids cross-language schema duplication.

---

## 3.2 Web

Locked frontend stack:

```text
React >=19.2.7
Vite 7+
React Router 8 (Data Mode via createBrowserRouter)
TanStack Query
React Hook Form
Zod
Tailwind CSS 4
shadcn/ui
Base UI primitives
Lucide icons
Recharts
```

### Responsibilities

**React Router**

- route hierarchy;
- workspace shells;
- role-specific navigation;
- nested layouts;
- route-level error boundaries;
- lazy loading/code splitting.

It does **not** become a second server-side data layer.

**TanStack Query**

- server-state fetching;
- caching;
- invalidation;
- mutation lifecycle;
- loading/error/refetch state.

**React Hook Form**

- form state;
- field registration;
- controlled assessment/onboarding forms;
- accessible validation integration.

**Zod**

- form validation where client-side validation is appropriate;
- shared API request/response schemas through `packages/contracts`.

**Tailwind + shadcn/ui**

- visual implementation;
- design-system primitives;
- rapid customization;
- accessible headless primitives;
- no locked proprietary visual theme.

**Recharts**

- trend/progress charts;
- always wrapped in the project's own accessible chart components.

---

# 4. Why Vite/React instead of Next.js

The web product is primarily an authenticated application.

It does not materially benefit from:

- server components;
- server actions;
- SEO-driven SSR;
- a second backend embedded inside the frontend framework;
- framework-specific backend behavior.

Using Vite keeps the architecture extremely clear:

```text
browser
   ↓
REST API
   ↓
central backend
```

This prevents clinical/domain logic from leaking into a frontend server layer.

Production still remains one-origin because Fastify serves the built Vite application.

---

# 5. Why Fastify instead of NestJS

Use:

```text
Fastify 5
```

for the backend HTTP server.

Do **not** use NestJS for V1.

The project needs modularity, but it does not need:

- dependency-injection containers;
- decorators everywhere;
- modules/controllers/providers with framework ceremony;
- abstraction layers merely to satisfy a framework pattern.

Fastify provides:

- high-quality TypeScript support;
- route/plugin composition;
- request lifecycle hooks;
- structured logging integration;
- schema-oriented request handling;
- low framework overhead.

Module structure will provide organization without a heavy application framework.

---

# 6. Prisma and PostgreSQL driver

Use:

```text
Prisma ORM 7
@prisma/adapter-pg
PostgreSQL 17
```

Prisma owns schema definition, generated client, migrations, relational queries, and application transactions.

## 6.1 Prisma 7 bootstrap

Use the Prisma 7 `prisma-client` generator with an explicit output path:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

Use `prisma.config.ts` for Prisma CLI configuration.

Construct Prisma Client through `@prisma/adapter-pg`. Do not use the pre-v7 connection/bootstrap pattern.

## 6.2 Connection pools

Prisma/application queries and pg-boss worker activity use deliberately and separately sized PostgreSQL pools. Pool budgets must account for HTTP concurrency, jobs, migrations/admin connections, and the managed database's connection limit.

## 6.3 Raw SQL

Raw SQL is allowed only where PostgreSQL functionality is materially clearer or necessary, especially:

- `SELECT ... FOR UPDATE`;
- partial unique indexes;
- specialized constraints;
- database grants for append-only audit enforcement;
- advanced migrations.

Raw SQL must remain parameterized, small, reviewed, and localized. Do not replace Prisma with hand-written SQL across the application.

# 7. Authentication and session policy

## 7.1 Locked solution

Use **Better Auth** inside the Fastify backend, backed by the same PostgreSQL deployment.

Better Auth owns credential authentication and session primitives. Application authorization remains our responsibility.

## 7.2 Prototype/demo mode

Prototype mode may use email/password with sign-in, sign-out, password reset, normal verification where configured, and session invalidation.

Do not add social login, SSO/SAML, passkeys, or enterprise identity features merely for breadth.

## 7.3 Real-patient privileged accounts

Before real-patient activation, clinicians, administrators, and safety owners require:

```text
verified identity
+
MFA
```

Privileged roles are provisioned only through authorized workflows. There is no user-controlled role selection during signup.

## 7.4 Cookie/session transport

Production web sessions use server-managed cookies with:

```text
HttpOnly
Secure
SameSite=Lax
host-only scope
```

Do not persist long-lived bearer credentials in `localStorage`.

## 7.5 CSRF/origin policy

Preserve Better Auth's CSRF/origin protections and configure strict trusted origins. Production must not use a wildcard trusted origin. Application mutations use same-origin/non-simple JSON requests.

## 7.6 Session lifecycle

Configure explicit idle expiry, absolute expiry, rotation, and revocation.

Revoke or rotate sessions after relevant authentication/privilege events, including account disablement, password reset, and material role/permission changes.

## 7.7 Step-up reauthentication

In real-patient mode, require reauthentication/step-up verification for particularly consequential privileged actions, including:

- safety disposition that relaxes restrictions;
- role/permission assignment;
- content approval;
- regional safety-route activation/change where applicable.

## 7.8 Future mobile

The future mobile app uses the same authentication authority and application API. Mobile-specific session transport may use Better Auth's supported mobile integration without creating a second auth system.

# 8. Authorization

Authentication answers:

> Who is the user?

Application authorization answers:

> What is this actor permitted to do to this resource?

Authorization remains entirely backend-authoritative.

The frontend may hide inaccessible controls for UX, but hidden controls are **not** a security mechanism.

---

## 8.1 Access model

The implementation distinguishes:

```text
workspace
role
permission
assignment/scope
```

These are not necessarily identical.

Example:

```text
CLINICIAN workspace
+
CLINICIAN role
+
PATIENT_READ permission
+
assignment to Patient X
```

---

## 8.2 Application-owned authorization data

Use application tables such as:

```text
users
user_role_assignments
clinician_patient_assignments
```

Role/permission resolution lives in backend code.

Do not put the authoritative patient-access model in the React application.

Do not trust a user-supplied patient ID without checking access.

---

## 8.3 Permission constants

Permissions are named code constants, for example conceptually:

```text
PATIENT_READ
PATIENT_MONITORING_READ
CLINICAL_CASE_ACKNOWLEDGE
SAFETY_DISPOSITION
CONTENT_APPROVE
ENGAGEMENT_TECHNICAL_OVERRIDE
AUDIT_READ
USER_ADMIN
```

The exact permission list grows only when an actual V1 action requires it.

Do not build a generic enterprise IAM product.

---

# 9. Repository structure

```text
aud-subjective-platform/
│
├── apps/
│   │
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── router/
│   │   │   │   ├── providers/
│   │   │   │   └── shells/
│   │   │   │
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── patient/
│   │   │   │   ├── clinician/
│   │   │   │   └── admin/
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── ui/
│   │   │   │   ├── patterns/
│   │   │   │   └── charts/
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── api/
│   │   │   │   ├── auth/
│   │   │   │   ├── query/
│   │   │   │   ├── formatting/
│   │   │   │   └── accessibility/
│   │   │   │
│   │   │   ├── styles/
│   │   │   └── main.tsx
│   │   │
│   │   └── vite.config.ts
│   │
│   └── backend/
│       ├── src/
│       │   ├── server.ts
│       │   ├── app.ts
│       │   │
│       │   ├── modules/
│       │   │   ├── identity/
│       │   │   ├── profiles/
│       │   │   ├── scheduling/
│       │   │   ├── assessments/
│       │   │   ├── safety/
│       │   │   ├── consumption/
│       │   │   ├── monitoring/
│       │   │   ├── content/
│       │   │   ├── clinical/
│       │   │   ├── engagement/
│       │   │   ├── delivery/
│       │   │   ├── operations/
│       │   │   └── audit/
│       │   │
│       │   ├── policy/
│       │   │   ├── instruments/
│       │   │   ├── subjective-monitoring-v1.ts
│       │   │   └── policy-registry.ts
│       │   │
│       │   ├── jobs/
│       │   │   ├── register-jobs.ts
│       │   │   ├── engagement-jobs.ts
│       │   │   ├── delivery-jobs.ts
│       │   │   └── schedule-jobs.ts
│       │   │
│       │   ├── infrastructure/
│       │   │   ├── db/
│       │   │   ├── auth/
│       │   │   ├── jobs/
│       │   │   ├── email/
│       │   │   └── logging/
│       │   │
│       │   └── shared/
│       │       ├── errors/
│       │       ├── authz/
│       │       ├── clock/
│       │       ├── ids/
│       │       ├── pagination/
│       │       └── validation/
│       │
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       │
│       └── package.json
│
├── packages/
│   └── contracts/
│       ├── src/
│       │   ├── common/
│       │   ├── auth/
│       │   ├── patient/
│       │   ├── clinician/
│       │   └── admin/
│       └── package.json
│
├── docs/
│   ├── AUD_Subjective_Monitoring_Master_Specification_V1.md
│   ├── AUD_V1_Web_Product_Surface_and_UX_Implementation_Lock.md
│   └── AUD_V1_Actual_Implementation_Architecture.md
│
├── docker-compose.yml
├── Dockerfile
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

# 10. Package-boundary rules

## `apps/web`

May depend on:

```text
packages/contracts
```

Must not depend on:

```text
backend domain code
Prisma
database code
backend policy evaluator internals
```

---

## `apps/backend`

May depend on:

```text
packages/contracts
```

Owns all domain logic and infrastructure.

---

## `packages/contracts`

Must remain:

```text
runtime-light
database-independent
framework-independent
```

It contains:

- request schemas;
- response schemas;
- API enums intended for clients;
- shared validation structures;
- API-facing TypeScript types.

It must not contain:

- Prisma types;
- database models;
- Fastify objects;
- React code;
- clinical calculation implementation.

---

# 11. Frontend architecture

## 11.1 Route hierarchy

Conceptually:

```text
/
├── /login
├── /forgot-password
│
├── /patient
│   ├── /home
│   ├── /onboarding
│   ├── /check-in
│   ├── /check-in/:periodId
│   ├── /progress
│   ├── /support
│   └── /profile
│
├── /clinician
│   ├── /overview
│   ├── /patients
│   ├── /patients/:patientId
│   ├── /review
│   ├── /engagement
│   └── /safety
│
└── /admin
    ├── /overview
    ├── /users
    ├── /content
    ├── /configuration
    ├── /operations
    └── /audit
```

The exact nested page routes may grow within these namespaces without changing the architecture.

---

# 12. Frontend feature structure

Do not organize frontend files primarily by low-level type:

```text
components/
hooks/
utils/
pages/
```

for the entire application.

Prefer feature ownership.

Example:

```text
features/patient/check-in/
├── api.ts
├── queries.ts
├── components/
├── screens/
├── forms/
└── helpers.ts
```

Shared components are promoted only when they are genuinely reused.

---

# 13. Frontend state management

Use three state locations only.

## Server state

```text
TanStack Query
```

Examples:

- patient home;
- current assessment;
- clinician queue;
- patient detail;
- content library;
- audit results.

---

## URL state

Use URL/search params for:

- filters;
- pagination;
- selected tab when useful;
- search query;
- sort order.

This makes clinician/admin views linkable and refresh-safe.

---

## Local UI state

Use React state for:

- open/closed dialogs;
- temporary selection;
- form interaction;
- presentation-only controls.

---

## Explicit non-decision

Do **not** add:

```text
Redux
MobX
Zustand
XState
```

in V1.

If a later feature demonstrates a real need for a global client store or state machine, add it then.

The domain state machine already lives on the backend.

---

# 14. API client

Use one typed wrapper around native `fetch`.

Conceptually:

```text
apiClient.get(...)
apiClient.post(...)
apiClient.patch(...)
```

Responsibilities:

- JSON serialization;
- credentials/session handling;
- request ID propagation;
- shared error parsing;
- response validation where enabled;
- abort signals;
- safe retry policy for reads.

Do not add Axios unless native `fetch` proves inadequate.

---

# 15. API architecture

Use:

```text
REST
JSON
/api/v1
```

Do not use:

- GraphQL;
- tRPC;
- gRPC for browser APIs;
- generic CRUD endpoint generation.

REST is deliberately chosen because:

- browser and future mobile clients can both consume it;
- contracts remain explicit;
- behavior is easy to inspect/debug;
- external tooling can consume it later;
- it keeps backend ownership obvious.

---

# 16. API contract strategy

`packages/contracts` is the compile-time/runtime validation contract.

Use Zod schemas for:

- request bodies;
- query parameters;
- route parameters where useful;
- response payloads;
- error detail structures.

Example conceptual pattern:

```ts
export const SubmitAssessmentRequest = z.object({
  periodId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  completionIntent: z.enum(["PARTIAL", "COMPLETE"]),
  answers: ...
})
```

Backend:

```text
parse request
→ authorize
→ application service
→ validate output contract
→ respond
```

Frontend:

```text
form
→ request contract
→ API
→ response contract
```

No duplicate handwritten DTO types.

---

# 17. API route philosophy

Use two route styles.

## Read-model routes

Purpose-built responses for screens.

Examples:

```text
GET /api/v1/patient/home
GET /api/v1/patient/progress
GET /api/v1/clinician/overview
GET /api/v1/clinician/patients/:id
GET /api/v1/admin/overview
```

These endpoints may aggregate several underlying tables.

This is intentional.

The frontend should not need twelve requests and domain joins to render one dashboard.

---

## Action routes

Use explicit domain actions.

Examples:

```text
POST /api/v1/patient/assessments/:id/submit
POST /api/v1/patient/assessments/:id/corrections
POST /api/v1/clinician/cases/:id/acknowledge
POST /api/v1/safety/cases/:id/disposition
POST /api/v1/admin/content/:id/submit-review
POST /api/v1/admin/content/:id/approve
POST /api/v1/admin/technical-failures/:id/resolve
```

Avoid endpoints such as:

```text
PATCH /case/:id { status: "RESOLVED" }
```

when the transition has domain rules.

The API expresses actions, not arbitrary database mutation.

---

# 18. Backend module pattern

Modules use straightforward functions and explicit dependencies.

Do not introduce a dependency-injection container.

A module may contain:

```text
routes.ts
service.ts
queries.ts
domain/
types.ts
```

Typical control flow:

```text
route handler
    ↓
authorization
    ↓
application service
    ↓
database transaction
    ↓
pure domain evaluator
    ↓
persistence
    ↓
audit
    ↓
job creation
    ↓
response projection
```

---

# 19. Backend module boundaries

## 19.1 `identity`

Owns user linkage, roles, permissions, clinician-patient assignments, account state, and authorization helpers.

## 19.2 `profiles`

Owns patient profile, stable preferences, recovery-goal versions, monitoring-timezone changes, and onboarding profile state.

## 19.3 `scheduling`

Owns schedule versions, scheduled periods, period identity/boundaries, `original_due_at`, `effective_due_at`, and reschedule metadata.

## 19.4 `assessments`

Owns weekly logical assessments, drafts, immutable submitted revisions, completion state, late/backfill classification, corrections, and source answer persistence.

## 19.5 `safety`

Owns safety inputs/evaluator, safety cases, severity, gate, restrictions, dispositions, ownership, synchronous patient safety-presentation result, and safety-delivery eligibility.

## 19.6 `consumption`

Owns 28-day baseline, standard-drink conversion, daily alcohol records, reduction-goal versions, weekly calendar/summary, targets, heavy-day/WHO context, and goal transitions.

## 19.7 `monitoring`

Computes:

```text
current flags
aggregate context
preference-compatible protection
interaction results
longitudinal features
persistence/clearance
recurrent-use state
candidate clinical reasons
patient intervention intents
resolver-precedence inputs
```

`monitoring` computes candidate/derived results but **does not own persisted clinical reason lifecycle or cases**.

## 19.8 `content`

Owns resource versions, eligibility, deterministic rotation, cooldown/refusal/suppression, locale/safety compatibility, `content_resolution_records`, `available_followups`, and content-delivery audit.

## 19.9 `clinical`

Owns clinician visibility, persisted `clinical_reason_states`, `clinical_reason_history`, clinical review cases/lifecycle, and clinician-task eligibility.

## 19.10 `engagement`

Owns engagement state, missed-check-in timing, reminders, engagement cases, return-after-gap, opt-out, technical-failure pause effects, and engagement-task eligibility.

## 19.11 `delivery`

Owns durable `clinician_tasks` for clinical/engagement/safety origins, recipient routing, notification records, outbound email, retries, delivery/bundling state, provider callback handling, and delivery-related operational failure creation.

Delivery never changes clinical severity or eligibility.

## 19.12 `operations`

Owns technical failures, operational incidents, routing health, worker/scheduler readiness, and real-patient readiness records.

## 19.13 `audit`

Owns append-only audit creation/query helpers and actor/time/reason/provenance capture.

# 20. Deterministic engine design

The most important backend rule is:

> **Clinical/domain evaluation functions should be pure whenever possible.**

Example:

```text
load authoritative state
        ↓
construct evaluation input
        ↓
evaluateWeeklyAssessment(input)
        ↓
deterministic result
        ↓
persist result
```

A pure evaluator:

- does not query Prisma;
- does not call external APIs;
- does not send email;
- does not use `Date.now()` directly;
- does not mutate global state.

This makes rule testing extremely fast and reproducible.

---

# 21. Policy registry

Do not scatter V1 thresholds throughout handlers.

Use a single versioned policy registry.

Conceptually:

```text
policy/
├── instruments/
│   └── aud-weekly-checkin-v1.ts
│
├── subjective-monitoring-v1.ts
└── policy-registry.ts
```

Example:

```ts
export const subjectiveMonitoringV1 = {
  version: "subjective_monitoring_v1",
  ...
} as const
```

Historical records persist:

```text
rule_set_version
instrument_version
configuration_version
```

A future changed policy is added as another version.

The V1 object is never silently edited in a way that changes historical semantics.

---

# 22. Time handling

Time is a first-class domain concern.

## Locked rules

- database timestamps use UTC;
- patient monitoring timezone uses an IANA timezone;
- period calculations use the period's stored monitoring timezone;
- frontend does not calculate authoritative period boundaries;
- browser timezone is never assumed to be the monitoring timezone.

---

## Date/time library

Use:

```text
Luxon
```

for V1 backend timezone/calendar calculations.

Do not use raw JavaScript `Date` arithmetic for weekly boundary logic.

All scheduling helpers live in:

```text
shared/clock/
scheduling/
```

---

## Injectable clock

Use a minimal application clock abstraction:

```ts
interface Clock {
  now(): Date
}
```

Production uses the real system clock.

Tests use a fixed/fake clock.

This is a justified abstraction because the V1 contains many time-dependent state transitions.

---

# 23. Database modeling philosophy

Use relational tables for domain identities and relationships.

Use JSONB only where it is genuinely appropriate for:

- immutable raw payload snapshots;
- provenance payloads;
- structured reason metadata;
- configuration snapshots;
- audit detail.

Do not make the entire data model one large JSON document.

Do not use schemaless persistence for convenience.

---

# 24. Persistence pattern: history + current projection

The V1 needs both:

```text
immutable history
+
fast current state
```

Implement both directly.

Example:

```text
assessment_revisions      ← immutable history
weekly_assessments        ← logical/current pointer

clinical_reason_history   ← history
clinical_reason_states    ← current projection

content_resource_versions ← immutable history
content_resources         ← logical resource/current state
```

This is **not event sourcing**.

The relational records themselves remain authoritative.

---

# 25. Database domain groups

The exact Prisma columns are implemented incrementally, but the following table families are locked.

## Identity/access

```text
Better Auth auth tables
users
user_role_assignments
clinician_patient_assignments
delivery_permission_versions
```

## Idempotency/concurrency

```text
idempotency_records
patient_processing_locks
```

## Profile/onboarding

```text
patient_profiles
recovery_goal_versions
monitoring_schedule_versions
profile_preference_versions where required
```

## Scheduling

```text
scheduled_periods
period_reschedule_audits
```

## Assessments

```text
weekly_assessments
assessment_revisions
assessment_item_responses
assessment_evaluations
```

`assessment_evaluations` stores evaluation trigger/context and rule/config provenance.

## Alcohol-use observation/event reconciliation

```text
use_observation_ledger
confirmed_use_events
use_observation_link_history
```

This preserves:

```text
weekly interval observation
≠ dated daily observation
≠ confirmed real-world event
```

Candidate linkage never silently merges observations.

## Safety

```text
safety_screen_records
safety_cases
safety_case_events
safety_dispositions
```

## Consumption/reduction

```text
reduction_goal_versions
alcohol_consumption_days
weekly_consumption_summaries
```

## Monitoring / derived history

```text
state_flag_observations
current_state_flags
aggregate_context_records
longitudinal_feature_records
patient_intervention_intents
```

Derived state retains history; it is not only a mutable current projection. Intervention intents remain stored even when content cannot be delivered.

## Clinical

```text
clinician_visibility_flags
clinical_reason_states
clinical_reason_history
clinical_review_cases
clinical_case_events
```

## Engagement

```text
engagement_states
engagement_cases
engagement_case_events
missed_checkin_reminders
```

## Content

```text
content_resources
content_resource_versions
content_feedback
content_suppressions
content_resolution_records
available_followups
content_delivery_audits
```

`content_resolution_records` stores resolver outcomes including `CONTENT_UNAVAILABLE` and suppressed/no-delivery outcomes. `available_followups` stores eligibility and expiry at the next weekly evaluation.

## Delivery/operations

```text
clinician_tasks
notification_deliveries
technical_failures
operational_incidents
safety_routing_profiles
real_patient_readiness_records
```

`clinician_tasks` belongs to Delivery because tasks may originate from clinical, engagement, or safety cases.

## Audit

```text
audit_events
```

## Jobs

```text
pg-boss managed schema/tables
```

pg-boss tables are execution infrastructure, not authoritative domain history.

# 26. Assessment storage

A logical weekly assessment has one identity per patient/period.

The database reflects:

```text
WeeklyAssessment
        │
        ├── Revision 1
        ├── Revision 2
        └── Revision 3 ← authoritative
```

Submitted revisions are immutable.

Draft changes may update the current draft record until submission.

Once submitted:

```text
edit in place = prohibited
```

Correction:

```text
create new immutable revision
→ mark authoritative revision pointer
→ recompute forward
```

---

# 27. Transactions and ordered patient-state mutation

Use PostgreSQL transactions for domain changes that must remain atomic.

## 27.1 Patient processing lock

Use `patient_processing_locks`, one row per patient.

Every transaction that changes ordered patient monitoring state must first:

```text
SELECT the patient lock row FOR UPDATE
```

then load/recompute the relevant authoritative history.

This applies to current submission, correction, backfill, recomputation, goal changes that affect monitoring state, safety dispositions that affect the gate, return-after-gap processing, and engagement transitions for the same patient.

## 27.2 Lock order

When multiple locks are needed:

```text
1. patient_processing_locks
2. patient-owned logical domain rows
3. case/task/content rows
```

Bulk cross-patient operations process patients in stable patient-ID order and bounded per-patient transactions.

## 27.3 Retry

Serialization/deadlock failures use a small bounded retry with jitter. Never retry indefinitely.

## 27.4 Database uniqueness

Use partial unique indexes for invariants such as:

```text
at most one open clinical review case per patient
at most one open engagement case per patient
```

## 27.5 Assessment submission

One transaction covers:

```text
patient lock
source revision + authoritative pointer
assessment_evaluation
derived/current/history records
clinical reasons/cases
patient intents/content resolution
clinician task if eligible
audit
transactional durable-job enqueue
```

## 27.6 Safety disposition

One transaction covers patient lock, disposition, case/gate/restriction changes, resulting patient state/presentation inputs, audit, and required durable delivery work.

## 27.7 Content approval

Content approval does not require a patient lock. Approve one immutable version, update the logical resource pointer/state, record reviewer, and audit atomically.

## 27.8 External calls

Never hold a domain database transaction open while calling email or another external provider.

# 28. Background jobs and transactional enqueueing

Use **pg-boss** backed by the same PostgreSQL database.

No Redis, RabbitMQ, Kafka, or separate broker.

## 28.1 Prisma 7 transaction integration

Lock:

```text
Prisma 7
@prisma/adapter-pg
pg-boss fromPrisma(tx)
```

When a job must commit atomically with Prisma domain writes, use:

```ts
await prisma.$transaction(async (tx) => {
  // domain writes through tx

  await boss.send(queueName, payload, {
    db: fromPrisma(tx),
  });
});
```

Do **not** call ordinary `boss.send()` inside a Prisma transaction and assume it shares that transaction.

## 28.2 Business truth

pg-boss is execution machinery only. Durable business state remains in application tables such as `clinician_tasks`, `notification_deliveries`, reminders, and incidents.

# 29. Background worker execution

For V1, job workers run inside the backend process.

Startup:

```text
Fastify start
      +
pg-boss start
      +
register workers
      +
register schedules
```

Graceful shutdown stops accepting HTTP traffic and shuts down pg-boss cleanly.

If actual load later requires separation:

```text
apps/backend/src/server.ts
apps/backend/src/worker.ts
```

can become separate entrypoints using the same modules.

That is an extraction, not an architectural rewrite.

---

# 30. Job categories

Keep the queue list small.

Conceptually:

```text
clinician-task-delivery
patient-reminder-delivery
safety-delivery
technical-failure-recovery
engagement-sweep
period-provisioning
scheduled-safety-reassessment
notification-retry
```

Do not create one queue per rule.

Do not turn every synchronous domain calculation into a job.

---

# 31. Synchronous versus asynchronous work

The architecture separates:

```text
immediate authoritative patient response
≠ asynchronous external/clinician delivery
```

## 31.1 Ordinary assessment processing

Submission waits synchronously for validation, authorization, persistence, deterministic evaluation, derived/current state persistence, case update, patient-intent/content resolution, and required audit persistence.

## 31.2 S0/S1 immediate safety response

A stopped/delayed worker must never prevent the patient from seeing the immediate safety-controlled presentation.

For S0/S1, the request synchronously:

1. persists the safety result/case;
2. sets the gate/restrictions;
3. resolves the configured regional route/patient presentation;
4. records required audit;
5. commits;
6. returns the safety-controlled response immediately.

It does not wait for email or auxiliary clinician notification.

## 31.3 Asynchronous safety delivery

After commit, pg-boss performs clinician/safety-owner task delivery, auxiliary outbound notification, retries, and failure escalation.

Reserve worker capacity/concurrency for `safety-delivery` so ordinary reminder/email backlog cannot consume all worker capacity.

A safety-delivery failure creates/updates the required operational incident immediately.

Worker/scheduler health is part of real-patient readiness.

## 31.4 Other async work

Use jobs for email, retries, reminders, engagement sweeps, scheduled safety reassessment, and operational recovery. Do not defer core deterministic evaluation asynchronously merely for architecture style.

# 32. Clinician task source of truth

The domain table:

```text
clinician_tasks
```

is the durable business source of truth.

A `pg-boss` job is only execution machinery.

If a worker crashes, the durable clinician task remains.

Delivery state never determines clinical severity.

---

# 33. Notifications

## V1 delivery channels

Primary in-product state:

```text
web application
```

Auxiliary outbound channel:

```text
email
```

Default email provider:

```text
Resend
```

The provider is wrapped by one thin infrastructure adapter.

Do not build a generic pluggable notification framework.

Do not add SMS unless explicitly required later.

Do not add mobile push until the mobile application exists.

---

# 34. Notification privacy

Outbound messages contain the minimum necessary detail.

Do not put sensitive assessment/safety contents into email subject lines or preview text.

Prefer:

```text
"You have a review task available"
```

over:

```text
"Patient X reported suicidal intent..."
```

The authenticated application is the destination for sensitive details.

---

# 35. Content storage

Patient-facing content resource bodies are stored in PostgreSQL for V1.

No S3/object storage is required for plain text/Markdown content.

A content resource has:

```text
logical resource
        ↓
immutable versions
```

Approved versions never change in place.

If V1 later adds substantial media files, object storage may be added for those assets only.

---

# 36. Content rendering security

Store patient-facing bodies as constrained:

```text
Markdown + structured metadata
```

Admin preview and patient delivery use the same safe renderer.

Rules:

- raw HTML disabled;
- executable HTML/JavaScript never accepted;
- supported elements/attributes allowlisted;
- unsafe URL schemes rejected;
- links sanitized through one safe-link policy;
- output tested for accessibility.

Content records are data, not executable UI code.

# 37. Audit model and enforcement

Use an append-only `audit_events` table plus immutable/versioned domain records. Do not implement full event sourcing.

Capture, where applicable:

```text
event_id
actor_id
actor role/context
action
entity type/id
patient_id
timestamp
reason
rule/instrument/config version
source revision
structured metadata
request_id
```

Do not duplicate sensitive raw payloads into audit JSON when immutable source records already contain them.

## 37.1 Database enforcement

Append-only is enforced.

The normal application database role receives only the necessary `INSERT`/`SELECT` capability on `audit_events`; ordinary application paths do not update existing audit rows.

Deletion occurs only through a separately authorized retention/deletion process where permitted.

## 37.2 Immutable records

Unsupported mutation of submitted assessment revisions and approved content versions is rejected at service/database boundaries.

## 37.3 Privileged audit access

Audit access requires explicit permission. Privileged audit access is itself auditable where deployment policy requires it.

# 38. Audit write rule

Whenever a privileged/domain transition requires audit, write the audit record in the **same database transaction** as the state change.

Avoid:

```text
change state
commit
later try to write audit
```

for actions where the audit entry is part of the V1 invariant.

---

# 39. Operational incident model

Operational failures use explicit records.

Examples:

- clinician task delivery terminal failure;
- unconfigured routing;
- safety delivery failure;
- confirmed technical access failure;
- worker-processing failure requiring manual review.

The Admin Operations workspace reads these records.

Do not try to reconstruct critical operational state only from application logs.

---

# 40. Logging

Fastify/Pino structured JSON logs.

Every request receives:

```text
request_id
```

Log:

- route;
- status;
- duration;
- actor ID where appropriate;
- error code;
- operation/entity IDs.

Do **not** log:

- passwords;
- auth cookies;
- reset tokens;
- raw safety answers;
- full questionnaire payloads;
- patient-facing content bodies unless necessary;
- unrestricted PII.

Configure Pino redaction for known sensitive paths.

---

# 41. Error handling

Use one backend error vocabulary.

Conceptual response:

```json
{
  "error": {
    "code": "ASSESSMENT_REVISION_CONFLICT",
    "message": "This check-in changed before your update was submitted.",
    "requestId": "..."
  }
}
```

Optional:

```text
fieldErrors
details safe for the client
```

Never return:

- stack traces;
- Prisma errors;
- raw SQL errors;
- Better Auth internals;
- pg-boss errors

to the browser.

---

# 42. Domain errors versus operational errors

Examples of domain/client errors:

```text
ASSESSMENT_NOT_OPEN
MISSING_REQUIRED_ITEMS
U1_CALENDAR_CONFLICT
GOAL_CHANGE_BLOCKED_BY_SAFETY
PERMISSION_DENIED
REVISION_CONFLICT
```

Examples of operational errors:

```text
DATABASE_UNAVAILABLE
EMAIL_PROVIDER_FAILURE
JOB_PROCESSING_FAILURE
UNROUTED_CONFIGURATION
```

The frontend renders domain-safe wording.

Operational incidents are separately recorded when required.

---

# 43. Concurrency and patient-level serialization

Optimistic revision checks alone are insufficient for longitudinal patient state.

## Mandatory lock

Every ordered patient-state mutation acquires:

```text
patient_processing_locks(patient_id)
```

with `SELECT ... FOR UPDATE` before loading evaluation history.

This serializes races such as:

- submission + historical correction;
- two backfills;
- correction + goal change;
- submission + safety disposition;
- return-after-gap + engagement sweep;
- two recomputations.

This protects streaks, clearance counts, current flags, reason states, one-open-case constraints, content selection, and reminder/case transitions.

## Other DB protections

Use unique logical assessment identity, one authoritative revision pointer, optimistic revision checks, partial unique open-case indexes, unique reminder identities, idempotency records, and duplicate-safe job identities.

## Integration tests

Run true concurrent integration tests for submission/correction/backfill/recompute/engagement races and assert valid serialized state.

# 44. Optimistic concurrency

Mutation requests that edit existing versioned state include an expected version/revision.

Example:

```text
expected_revision_number
```

If stale:

```text
409 Conflict
```

The UI reloads current state and asks the user to re-review the change.

Do not silently overwrite a newer revision.

---

# 45. Executable idempotency contract

Consequential writes require an `Idempotency-Key`.

Required for:

- assessment submission;
- correction;
- safety disposition;
- case acknowledgement/manual resolution where allowed;
- technical-failure confirmation/resolution/correction;
- goal activation/change;
- content approval;
- route activation.

Persist:

```text
actor_id
route/action
idempotency_key
request_payload_hash
response_status
response snapshot or stable result reference
created_at
expires_at
```

Same key + same canonical payload returns the original committed result.

Same key + different payload returns:

```text
409 IDEMPOTENCY_KEY_REUSE
```

Idempotency does **not** replace patient locks, optimistic version checks, or uniqueness constraints.

Where practical, durable-job identities derive from the committed operation/effect identity so job retries cannot duplicate side effects.

# 46. API response projections

Do not send raw database models to the frontend.

The backend builds role-specific projections.

Examples:

```text
PatientHomeView
PatientAssessmentView
PatientProgressView

ClinicianOverviewView
ClinicianPatientView
ClinicalReviewQueueView

AdminOverviewView
AdminContentResourceView
AuditSearchResult
```

These projections are defined in `packages/contracts`.

This keeps:

- internal database structure private;
- frontend stable;
- mobile reuse straightforward.

---

# 47. Patient home projection

The backend should assemble patient home state in one request.

Conceptually:

```text
GET /api/v1/patient/home
```

returns:

```text
current primary action
assessment state
goal summary
safety presentation mode
eligible support summary
progress summary
relevant notices
```

The browser does not reconstruct safety/support priority itself.

---

# 48. Clinician patient projection

The clinician detail endpoint may combine:

```text
profile summary
active goal
latest assessment provenance
current flags
freshness
recent trajectories
active reasons
case
engagement
safety context
```

This intentionally avoids a waterfall of small HTTP requests.

---

# 49. Pagination

Clinician/admin list endpoints use cursor pagination where lists may grow materially.

Small bounded lists may use simple page/limit.

Do not create a generic pagination framework beyond a small shared contract/helper.

---

# 50. Search

V1 search uses PostgreSQL. No Elasticsearch/OpenSearch.

Relevant searches include patients, internal IDs, case IDs, content IDs, and audit actor/entity/request IDs.

## Authorization-before-search

Authorization scope is applied **before** matching, sorting, and pagination.

For clinician patient search:

```text
authorized assigned/care-team patient scope
→ search/filter
→ sort
→ paginate
```

Never search all patients and filter unauthorized rows afterward.

Apply the same rule to audit and patient-scoped administrative/operations queries to prevent cross-assignment enumeration.

# 51. Database indexes

Add indexes based on known V1 query patterns.

Examples:

```text
patient_id + period_start
patient_id + period_id
patient_id + submitted_at
patient_id + status
case lifecycle/status
clinician assignment
delivery status + next_attempt_at
effective_due_at
content class + locale + enabled/review_status
audit patient/entity/time
```

Do not add speculative indexes for hypothetical analytics.

---

# 52. Derived state

Do not recalculate the entire patient history on every dashboard read.

Important derived/current state is persisted when evaluation occurs.

Reads therefore remain straightforward.

Corrections/backfill intentionally trigger forward recomputation where the V1 requires it.

---

# 53. Historical recomputation and side-effect policy

Use one service:

```text
recomputePatientMonitoringFromPeriod(patientId, periodId, authoritativeTrigger)
```

The caller never passes an arbitrary `suppressNotifications` boolean. Effect policy derives from authoritative provenance.

## 53.1 EvaluationTrigger

Persist one canonical trigger:

```text
CURRENT_PATIENT_SUBMISSION
CURRENT_PATIENT_CORRECTION
STAFF_CORRECTION
HISTORICAL_BACKFILL
POLICY_MIGRATION
ADMINISTRATIVE_RECOMPUTE
```

## 53.2 Two outputs

Evaluation produces:

```text
DerivedStateChanges
EffectPlan
```

`DerivedStateChanges` contains flags/history, aggregate/longitudinal features, recurrence, reason/case consequences, and intervention intents.

`EffectPlan` contains allowed patient delivery, clinician-task eligibility, follow-up creation, auxiliary notification, and explicit suppressed effects/reasons.

## 53.3 Trigger rules

**CURRENT_PATIENT_SUBMISSION:** ordinary currently qualifying effects may occur.

**CURRENT_PATIENT_CORRECTION:** may produce newly qualifying current support and current case/task changes.

**STAFF_CORRECTION:** recomputes state/cases but does not automatically send patient content.

**HISTORICAL_BACKFILL:** updates history and permitted current recurrence/forward state; never sends historical patient content and never creates a notification merely because the historical period would have qualified then.

**POLICY_MIGRATION:** requires an explicitly versioned migration/effect plan and never silently reinterprets V1 history.

**ADMINISTRATIVE_RECOMPUTE:** rebuilds deterministic state from authoritative inputs without inventing user-originated effects.

## 53.4 Idempotency

Repeated evaluation of the same authoritative inputs produces no duplicate patient content, tasks, reminders, or case transitions.

Every suppressed candidate effect records its suppression reason.

# 54. Data freshness

Backend projections calculate explicit freshness/state labels.

Frontend must not infer:

```text
current
stale
partial
missing
revoked
```

from timestamps alone.

The backend returns those meanings.

---

# 55. Demo/prototype data

Provide deterministic database seed scenarios.

`pnpm db:seed` should create:

```text
patient demo accounts
clinician demo account
admin demo account
```

and representative synthetic patients for:

- ordinary monitoring;
- high craving;
- craving + low confidence Level-3 case;
- persistent negative mood;
- partial assessment;
- late submission;
- backfill;
- correction/revision;
- reduction baseline/target;
- reduction target met/not met;
- engagement overdue/at-risk/disengaged;
- technical failure;
- safety S2 handoff;
- content cooldown/refusal.

This dramatically improves:

- UI development;
- evaluator demo quality;
- manual testing;
- Playwright testing;
- Codex verification.

Seed data is synthetic only.

---

# 56. Prototype and real-patient mode

Use:

```text
APP_MODE=prototype
APP_MODE=real_patient
```

Local/development/demo defaults to prototype.

## 56.1 Real-patient readiness guard

`APP_MODE=real_patient` validates concrete readiness records/configuration before monitoring activation.

Required checks include:

- authenticated users and backend RBAC;
- authorized privileged-account provisioning;
- MFA for clinician/admin/safety-owner accounts;
- encryption in transit;
- provider-managed encryption at rest;
- auditable privileged access;
- retention/deletion policy;
- consent/delivery-permission configuration;
- approved content coverage for every enabled class/locale;
- clinician/care-team routing;
- safety-owner routing;
- tested regional safety routes;
- durable clinician-task infrastructure;
- worker health and required schedules;
- reserved safety-delivery capacity;
- privacy-safe outbound notifications;
- backups enabled;
- successful restore test with timestamp;
- operational incident ownership;
- demo reset/seed disabled;
- deployment/vendor agreements required for the jurisdiction where applicable.

If required readiness is missing:

```text
real-patient monitoring activation = refused
```

## 56.2 Backup readiness

Deployment configuration must explicitly define:

```text
RPO
RTO
backup frequency
backup retention
restore-test frequency
last successful restore-test timestamp
```

The concrete values are deployment decisions made before real-patient activation, not guessed by application code.

# 57. Configuration

Use environment variables for secrets/infrastructure.

Examples:

```text
DATABASE_URL
BETTER_AUTH_SECRET
APP_BASE_URL
RESEND_API_KEY
EMAIL_FROM
LOG_LEVEL
APP_MODE
```

Use a typed environment parser at startup.

Invalid required configuration causes startup failure.

---

# 58. Domain configuration

Clinical/policy configuration is **not** loaded ad hoc from environment variables.

The canonical V1 policy lives in versioned code/config structures.

Deployment-specific operational configuration that is meant to be editable lives in database-backed versioned records where required.

Do not expose:

```text
HIGH_CRAVING_THRESHOLD=6
```

as an ordinary environment variable.

---

# 59. Regional safety routing

Persist versioned routing profiles in PostgreSQL.

Routes may contain:

```text
telephone
deep link
internal queue/service target
external service identifier
```

depending on deployment.

Activation requires validation/testing according to the Master Specification.

No universal emergency number is coded into UI source.

---

# 60. Web design system

Build the design system inside:

```text
apps/web/src/components/ui
apps/web/src/components/patterns
apps/web/src/styles
```

Use shadcn-generated/open-code components as the foundation.

Do not install a second large component framework.

No Material UI.

No Ant Design.

No Chakra UI.

---

# 61. Design tokens

Define authoritative tokens early:

```text
typography
spacing
radius
surface
border
shadow
motion
semantic state colors
layout widths
```

Semantic colors are named by meaning, not raw color.

Example:

```text
--state-danger
--state-warning
--state-info
--state-success
--state-stale
```

Never encode domain semantics only through color.

---

# 62. Product pattern components

Create product-specific reusable patterns where repeated.

Examples:

```text
WorkspaceShell
PageHeader
SectionHeader
StateBadge
FreshnessBadge
AssessmentStatus
EmptyState
ErrorState
RestrictedState
SafetyShell
LoadingSkeleton
ConfirmActionDialog
DataCoverageIndicator
TrendChart
Timeline
CaseLifecycle
```

Avoid building an abstract "universal card" framework.

---

# 63. Workspace shells

Three explicit shells:

```text
PatientShell
ClinicianShell
AdminShell
```

They share low-level primitives but not information density or navigation behavior.

This prevents the three interfaces from looking like recolored versions of one template.

---

# 64. Responsive design

Patient workspace:

```text
mobile-first
```

because the future patient mobile application and current web experience should share mental models.

Clinician/admin:

```text
desktop-first but responsive
```

because tables, patient lists, and operational work require density.

All critical actions remain usable at tablet/mobile widths.

---

# 65. Accessibility

Baseline:

```text
WCAG 2.2 AA
```

Implementation requirements include:

- keyboard operation;
- focus visibility;
- semantic labels;
- error association;
- screen-reader status announcements;
- chart text alternatives;
- adequate target sizes;
- contrast;
- reduced motion;
- zoom/reflow support.

Accessibility is part of component acceptance, not a final review pass.

---

# 66. Chart architecture

Recharts is wrapped by project components.

No page should import raw chart components repeatedly with one-off styling.

Each chart wrapper supports:

- accessible label/title;
- keyboard/accessibility layer where supported;
- table/text fallback;
- explicit missing-data gaps;
- partial-data markers;
- consistent tooltip/date formatting.

---

# 67. No invented visual metrics

The UI does not create:

- recovery score;
- risk gauge;
- arbitrary severity percentage;
- synthetic "health score";
- trend smoothing over missing observations.

Backend-provided V1 metrics only.

---

# 68. Forms

Forms use:

```text
React Hook Form
+
Zod
+
design-system fields
```

Field patterns handle:

- label;
- helper text;
- errors;
- disabled/restricted state;
- required/optional messaging;
- screen-reader associations.

---

# 69. Long forms

Onboarding/check-ins use multi-step screens.

Server-backed draft persistence is used for workflows that must survive navigation/session interruption.

Do not keep the only copy of an assessment draft in React state.

---

# 70. Consequential confirmations

Use one reusable confirmation pattern.

The backend action still enforces the rule.

Examples:

- monitoring opt-out;
- assessment correction;
- goal change;
- persistent support-type suppression;
- content approval;
- safety disposition;
- route activation;
- technical-failure correction/resolution.

---

# 71. Testing strategy

Testing follows the risk structure of the product.

Highest effort:

```text
deterministic domain behavior
time/scheduling
revision/backfill
safety precedence
case lifecycle
engagement timing
authorization
```

Moderate effort:

```text
API integration
critical UI workflows
accessibility
```

Low effort:

```text
trivial presentational component unit tests
```

---

# 72. Domain tests

Use:

```text
Vitest
```

Pure evaluators receive exhaustive table-driven tests.

The Master Specification acceptance criteria become first-class test groups.

Examples:

```text
high-craving boundary
partial aggregate suppression
protection applicability bounds
interaction two-class cap
missing-period persistence reset
clearance pause
abstinence recurrence
backfill suppression
U1/calendar conflict
WHO boundaries
safety precedence
```

These tests should be fast enough to run constantly.

---

# 73. Backend integration tests

Use real PostgreSQL.

Do not substitute SQLite for integration tests.

Test:

- Prisma transactions;
- unique constraints;
- revision behavior;
- pg-boss enqueue/worker behavior;
- authorization;
- Fastify route contracts;
- migration correctness.

CI launches a PostgreSQL service/container.

---

# 74. Frontend tests

Use:

```text
Vitest
Testing Library
```

selectively for:

- complex form behavior;
- state-rendering components;
- consequential confirmations;
- accessibility-sensitive custom controls.

Do not snapshot every component.

---

# 75. End-to-end tests

Use:

```text
Playwright
```

for high-value flows.

Required flows should eventually include at least:

```text
patient login
patient onboarding path
weekly complete submission
partial submission
correction/revision
reduction calendar contradiction
clinician review workflow
engagement view
safety restricted flow
admin content approval/versioning
permission-denied behavior
```

---

# 76. Accessibility testing

Use Playwright with axe-based automated checks on major screens.

Automated checks do not replace manual testing.

Manual checks include:

- keyboard-only navigation;
- focus order;
- screen-reader-friendly naming;
- zoom/reflow;
- reduced motion;
- chart alternatives.

---

# 77. Visual regression

Use Playwright screenshots for a **small curated set** of important screens/states.

Examples:

```text
Patient Home
Weekly Check-In
Patient Progress
Clinician Overview
Clinician Patient Detail
Review Queue
Safety Case
Admin Content Library
```

Do not create thousands of brittle screenshot snapshots.

The purpose is to stop obvious visual regressions in the evaluator-facing surfaces.

---

# 78. Linting and formatting

Use:

```text
ESLint
Prettier
TypeScript strict mode
```

One root configuration.

Do not maintain independent style rules in every package.

---

# 79. TypeScript rules

Important settings:

```text
strict: true
noUncheckedIndexedAccess: true
exactOptionalPropertyTypes: true
```

Avoid:

```text
any
```

unless interacting with genuinely untyped boundaries.

Do not silence compiler errors with broad casts.

---

# 80. CI

Use GitHub Actions.

Primary workflow:

```text
install
→ lint
→ typecheck
→ domain/unit tests
→ database migration/integration tests
→ build backend
→ build web
→ key Playwright tests
```

Do not introduce a complex multi-stage CI orchestration platform.

---

# 81. Database migrations

Development:

```text
prisma migrate dev
```

Deployment:

```text
prisma migrate deploy
```

Migrations are committed.

Do not use:

```text
prisma db push
```

as the production schema-change mechanism.

---

# 82. Production build and release

One root build produces the backend build plus Vite web build. The final image contains compiled backend, generated Prisma client, web static assets, and production dependencies.

Fastify serves the SPA.

## Release order

Database migrations run **before new application code begins serving normal traffic**:

```text
prisma migrate deploy
→ app startup
→ readiness checks
→ receive traffic
```

Use the platform's pre-deploy/release command when available.

Migration failure prevents the release from becoming ready.

Do not run destructive migrations concurrently from every scaled app instance.

# 83. Same-origin production

Production shape:

```text
https://product.example.com/
        │
        ├── /                 → Vite SPA
        ├── /api/v1/*         → Fastify API
        └── /api/auth/*       → Better Auth
```

Benefits:

- no production CORS complexity;
- secure cookie session is straightforward;
- one application domain;
- one app service to deploy;
- simpler operational debugging.

---

# 84. Development shape

Local development:

```text
Vite dev server
http://localhost:5173

Fastify backend
http://localhost:3000

PostgreSQL 17
localhost:5432
```

Vite proxies:

```text
/api
```

to Fastify.

Browser code still calls relative `/api/...` URLs.

---

# 85. Docker Compose

Local Docker Compose runs infrastructure only:

```text
PostgreSQL
```

Developers run web/backend natively through pnpm for fast hot reload.

Do not run five application containers locally unless later needed.

---

# 86. Root development command

Target:

```text
pnpm dev
```

starts:

- backend;
- Vite frontend.

Backend startup includes pg-boss workers.

A new developer should not need to manually start six terminals.

---

# 87. Deployment packaging

Use a standard Dockerfile.

The application can deploy to any Docker-compatible platform.

The codebase should not depend on proprietary serverless runtime APIs.

---

# 88. Initial deployment shape

```text
Internet
   ↓
managed TLS / platform ingress
   ↓
ONE application container
   │
   ├── Fastify API
   ├── Better Auth
   ├── static React application
   └── pg-boss workers
   │
   ├──────────────→ Resend
   │
   └──────────────→ PostgreSQL 17
```

This is the complete V1 infrastructure shape.

---

# 89. Deployment provider

The architecture does **not** hard-code one PaaS vendor into application code.

Default practical deployment target can be a Docker-capable managed PaaS such as Railway or an equivalent provider.

Provider selection is an operational deployment choice, not an application architecture dependency.

The code must remain portable to another container host.

---

# 90. PostgreSQL hosting

Use managed PostgreSQL in deployed environments.

Requirements:

- automated backups;
- TLS connections;
- restricted credentials;
- private networking where supported;
- documented restore process;
- region selected for deployment needs.

Real-patient authorization still requires verification of all Master Specification requirements; using managed Postgres does not itself establish compliance.

---

# 91. Health and readiness endpoints

Provide:

```text
GET /health/live
GET /health/ready
```

`/health/live` verifies the process can respond.

`/health/ready` verifies at least:

- PostgreSQL reachable;
- Prisma initialized;
- pg-boss initialized;
- required queues registered;
- required schedules registered;
- worker registration complete;
- startup configuration valid.

In real-patient mode, critical worker/scheduler availability is part of readiness.

Do not expose secrets or sensitive route configuration.

# 92. Graceful shutdown

On shutdown:

1. stop accepting new requests;
2. finish/stop pg-boss work safely;
3. close Fastify;
4. disconnect Prisma/database;
5. exit.

This matters for deployment restarts and migrations.

---

# 93. Rate limiting

Use Fastify rate limiting selectively.

Strongest limits:

- login;
- password reset;
- verification;
- public account creation if enabled;
- sensitive action endpoints.

Do not rate-limit every authenticated dashboard read aggressively.

---

# 94. Security headers

Use Fastify helmet/security middleware.

Production should set:

- Content Security Policy;
- HSTS where appropriate;
- frame protection;
- MIME sniffing protection;
- referrer policy.

The CSP must be compatible with the actual Vite bundle and external services intentionally used.

---

# 95. CORS

Production:

```text
same origin
```

therefore no broad CORS configuration is needed for the web product.

Development may allow the Vite development origin only.

Future mobile API access can add explicit mobile-compatible authentication/API rules without opening wildcard browser CORS.

---

# 96. Secrets

Secrets exist only in runtime environment/secret management.

Never commit:

- auth secret;
- database URL;
- email API key;
- deployment route secrets.

Provide:

```text
.env.example
```

with names only.

---

# 97. Data redaction

Backend logging/error reporting uses explicit redaction.

Sensitive domain values should be represented in logs by:

- entity ID;
- rule/event code;
- request ID;

rather than raw patient answers.

---

# 98. Data deletion/retention

The architecture must support configured retention/deletion behavior required for real-patient operation.

Do not implement physical deletion rules ad hoc in feature handlers.

Retention/deletion should have one operations-level policy/service when that deployment requirement is implemented.

Immutable audit semantics must be reconciled explicitly with the configured legal/deployment retention policy rather than silently deleting rows.

---

# 99. Performance target philosophy

No premature performance infrastructure.

Expected V1 load is well within:

```text
one Node process
+
one PostgreSQL database
```

The first scaling step is:

```text
increase application/database resources
```

not immediately split services.

---

# 100. Extraction path if scale appears

Only after evidence.

Possible future extraction order:

1. pg-boss workers into a second process;
2. static frontend to a CDN if worthwhile;
3. read replicas/reporting if actual query load requires it;
4. specialized services only for genuinely independent workloads.

Domain modules remain unchanged.

---

# 101. No caching service in V1

No Redis.

Use:

- TanStack Query browser caching;
- PostgreSQL;
- efficient queries;
- persisted projections.

If actual backend hot-read load appears, add caching then.

---

# 102. No event bus in V1

No Kafka.

No RabbitMQ.

No NATS.

No internal distributed pub/sub.

The backend is one process.

Function calls are cheaper and easier to reason about than events when no network boundary exists.

Durable asynchronous execution uses pg-boss only.

---

# 103. No event sourcing

The V1 needs auditability and immutable history.

That does **not** require event sourcing.

Use:

```text
relational authoritative state
+
immutable revisions/history
+
append-only audit
```

This is far easier to build, test, and query.

---

# 104. No CQRS framework

Screen projections may use purpose-built queries.

That is enough.

Do not introduce separate command/query services, buses, handlers, and projection infrastructure merely to call the architecture CQRS.

---

# 105. No generic repository layer

Do not wrap Prisma in meaningless abstractions such as:

```text
GenericRepository<T>
BaseRepository
IDataStore
```

Each module may have a small `queries.ts`/persistence helper for nontrivial database operations.

Prisma is already the persistence abstraction.

---

# 106. No dependency injection framework

Dependencies are explicit function parameters/application context.

Example conceptually:

```ts
createAssessmentService({
  db,
  clock,
  audit,
  jobs
})
```

Do not add Inversify, tsyringe, or Nest-style containers.

---

# 107. No premature domain package shared with frontend

The frontend shares API contracts, not backend domain evaluators.

Do **not** move clinical rule functions into a package consumed by the browser.

The backend remains authoritative.

---

# 108. Future mobile architecture

When mobile work begins:

```text
apps/
├── web/
├── backend/
└── mobile/
```

The mobile application consumes:

```text
packages/contracts
```

when technologically compatible.

It calls the same:

```text
/api/v1
```

and does not reimplement:

- scheduling;
- safety;
- assessment semantics;
- recurrence;
- content eligibility;
- clinician logic;
- engagement.

---

# 109. Mobile-specific backend additions

Only device-specific capabilities should be added later.

Examples:

```text
device registration
push notification token management
mobile session transport
deep-link metadata
```

These are small backend additions around the same domain core.

---

# 110. Codex implementation conventions

This architecture is intentionally designed to make Codex safe and effective.

Each implementation task should point Codex at:

```text
one module
one coherent capability
explicit contracts
explicit acceptance criteria
explicit do-not-do boundaries
```

Codex should not be asked to invent architecture during feature implementation.

---

# 111. File locality

A feature change should usually touch a predictable set:

```text
backend module
contracts
web feature
tests
```

rather than dozens of generic framework layers.

This makes diffs reviewable.

---

# 112. Naming

Use canonical names from the V1 Master Specification in backend/domain code.

Examples:

```text
HIGH_CRAVING
CLEARANCE_PENDING
RECURRENT_USE
SafetyGateStatus
ReductionGoalVersion
```

Do not invent alternative internal terminology for the same domain concept.

Frontend patient-facing copy may use human wording, but API/domain identifiers remain canonical.

---

# 113. Comments

Comments explain:

- non-obvious V1 semantics;
- why a rule exists;
- important invariants;
- unusual transaction behavior.

Do not comment obvious syntax.

Reference the Master Specification section in comments for complex policy logic when helpful.

---

# 114. Architecture guardrails for Codex

Codex must not:

- introduce a new infrastructure service without explicit instruction;
- move clinical logic to the frontend;
- bypass contracts with ad hoc response shapes;
- use raw database models directly as API responses;
- mutate immutable submitted revisions;
- overwrite approved content versions;
- compute weekly period identity in the browser;
- hard-code safety route phone numbers;
- add generic abstractions merely to "clean up";
- add Redux/global state automatically;
- add queues/events for synchronous operations;
- add microservices;
- add new product features outside the current commit.

---

# 115. Feature implementation shape

A normal vertical feature can contain:

```text
contract
backend route
application service
domain evaluator/update
database migration/query
web screen/component
tests
```

This is preferred over horizontal phases such as:

```text
all schema first
all APIs second
all UI third
```

because the feature becomes demonstrably correct end-to-end.

---

# 116. Commit-size philosophy

Implementation commits should be:

```text
balanced
coherent
dependency-aware
reviewable
```

Not:

```text
one enum per commit
one DTO per commit
one component per commit
```

And not:

```text
half the platform in one unreviewable mega-commit
```

The architecture is already settled, so commits focus on implementation, not recurring design debate.

---

# 117. Implementation order

Locked dependency order:

```text
1. Repository, database, contracts, design-system foundation
2. Identity, authentication, authorization, assignments
3. Profiles, scheduling, regional routing
4. Safety evaluator, safety gate, cases, immediate patient routing
5. Reduction baseline, proposed target, safety-gated goal activation
6. Complete onboarding activation flow
7. Assessment draft/partial/revision/backfill lifecycle
8. Subjective-monitoring evaluator + historical recomputation/effect policy
9. Content resolution + patient support
10. Clinician visibility, reasons, cases, durable tasks
11. Engagement, reminders, technical-failure handling
12. Admin operations, content governance, configuration, audit
13. Deployment hardening + full acceptance matrix
```

Safety and reduction move earlier because monitoring/goal activation depends on them.

This is dependency order, **not** a requirement for many tiny phases/commits. Adjacent capabilities can be implemented in substantial coherent commit packets.

# 118. UI quality workflow

Do not wait until the backend is finished to polish the UI.

For each major surface:

```text
build real state contract
→ implement functional screen
→ apply design-system quality
→ validate responsive/accessibility
→ preserve visual regression
```

Do not build throwaway ugly screens that will later require complete replacement.

---

# 119. Design reference implementation

Early in implementation, create a small set of polished representative components/screens that establish:

- typography;
- spacing;
- cards;
- forms;
- status language;
- empty/error states.

The Phase 1 foundation reference establishes these shared visual and interaction primitives plus representative patient, clinician, and admin density. Navigation, tables, and charts arrive with the first real feature and authoritative data that require them; do not fabricate them merely to enlarge the reference surface.

Subsequent Codex tasks must reuse these patterns.

This prevents AI-generated visual drift.

---

# 120. No separate mock backend

Do not maintain a second fake application backend.

Static, explicitly non-live design-reference content is permitted before domain schemas exist. Once functional feature UI begins, use:

```text
real backend
+
deterministic seed data
```

for UI development.

This avoids mock contracts diverging from real behavior.

---

# 121. Contract evolution

A contract change is intentional.

When a response changes:

1. update `packages/contracts`;
2. update backend;
3. update web;
4. update affected tests.

Do not silently add untyped fields.

---

# 122. API version

Use:

```text
/api/v1
```

for application API versioning.

This is separate from:

```text
subjective_monitoring_v1
```

The API can evolve compatibly without implying a change to the clinical rule set.

---

# 123. Database versioning versus API versioning

These are independent:

```text
Prisma migration history
API /v1
subjective_monitoring_v1
AUD_WEEKLY_CHECKIN 1.0
content resource version
configuration version
```

Do not conflate them into one global version number.

---

# 124. Admin configuration editing

Admin UI only edits values the backend explicitly exposes as operationally editable.

Canonical V1 rules remain code/version governed.

Configuration changes that affect historical interpretation create versions.

Do not implement a generic JSON configuration editor.

---

# 125. Audit Explorer query path

Audit search queries the relational `audit_events` table with indexes.

No Elasticsearch.

Filters:

```text
patient
actor
entity
event/action
date range
request ID
case/assessment ID
```

The Admin UI receives paginated projections.

---

# 126. Clinician timeline

The clinician timeline is **not** the raw audit table.

Backend builds a human-relevant timeline from domain history:

- assessment submitted;
- flag activated/cleared;
- case created;
- case acknowledged;
- safety handoff;
- support delivered;
- correction/revision.

Audit remains the forensic source.

---

# 127. Content review workflow

Content:

```text
logical ContentResource
        ↓
draft ContentResourceVersion
        ↓
UNDER_REVIEW
        ↓
APPROVED
```

Editing approved content creates:

```text
new version
```

Never mutate approved body text.

---

# 128. Email templates

Email templates live in backend source code for operational/auth messages.

Patient support content does not become email-template source code if it is governed through the content repository.

Keep email templates minimal and privacy-safe.

---

# 129. In-app support rendering

The patient receives the resolved content resource from the backend.

Backend returns:

```text
resource/version ID
title
safe body/render model
estimated duration
allowed interaction controls
```

Frontend does not select a different resource.

---

# 130. Patient content feedback

Actions such as:

```text
DISMISS
NOT_HELPFUL
DONT_SHOW_THIS_TYPE
```

use explicit API actions.

The backend updates suppression/cooldown state.

The browser does not simply hide the card locally forever.

---

# 131. Client retry policy

TanStack Query may retry safe reads.

Do not automatically retry consequential writes indiscriminately.

Mutations use explicit retry/idempotency behavior defined by the endpoint.

Assessment submission may safely resume/retry using operation identity.

---

# 132. Offline behavior

V1 web is online-first.

Do not build a full offline synchronization system.

Draft autosave may retry transiently while the page remains open.

If offline:

- show clear offline state;
- retain safe temporary form state in memory where useful;
- do not claim the backend saved it until confirmed.

The future mobile application can add stronger offline behavior if required.

---

# 133. Browser storage

Do not persist sensitive clinical records broadly into:

```text
localStorage
IndexedDB
```

unless an explicit future offline feature requires it.

Server state remains authoritative.

Browser persistence is limited to non-sensitive UX preferences when useful.

Authentication session handling is owned by Better Auth.

---

# 134. File uploads

No generic upload subsystem in V1.

If no V1 feature requires file attachments, do not introduce object storage or upload endpoints.

---

# 135. Internationalization

The content model already versions locale/language.

The application UI may begin with one supported UI locale.

Do not add a full runtime translation platform until multilingual UI is actually required.

Patient content localization remains separately approved/versioned as required by V1.

---

# 136. Feature flags

Use simple typed backend configuration.

Required:

```text
EMA disabled
```

Do not introduce LaunchDarkly or a feature-flag SaaS.

Small V1 flags can live in typed configuration.

---

# 137. Analytics

No product analytics SDK is required for clinical logic.

If evaluator/product usage analytics are later added, they must not receive sensitive health data by default.

Do not let analytics tooling become part of authoritative patient state.

---

# 138. Observability level for V1 deployment

Required:

- structured logs;
- request IDs;
- health endpoints;
- operational incident records;
- pg-boss failure visibility;
- deployment platform CPU/memory/restart logs;
- database backup/health monitoring.

An external APM platform is optional and is not a V1 architectural dependency.

---

# 139. Database backup strategy

Managed deployment must enable automatic backups.

Before a real-patient activation attempt, restore procedure must be tested.

Local development database is disposable.

Seed data can recreate local/demo environments.

---

# 140. Migration rollback philosophy

Prefer forward-fix migrations.

Do not assume every production schema migration can be safely reversed.

Destructive migration requires:

- explicit review;
- data migration plan;
- backup verification.

---

# 141. Environment tiers

Use:

```text
development
staging/demo
production
```

`staging/demo` runs synthetic/deidentified data unless real-patient activation has been independently approved.

Do not share the production database with local development.

---

# 142. Demo environment

The evaluator-facing deployment should have deterministic demo accounts and scenarios.

This allows a polished walkthrough without modifying production-like real-patient data.

Demo state can be reset through a controlled seed/reset operation restricted to non-real-patient environments.

---

# 143. Real-patient mode separation

Never allow:

```text
demo reset
seed overwrite
test shortcuts
```

against real-patient mode.

The backend blocks those operations based on environment mode.

---

# 144. Status constants

Backend canonical enums derive from the Master Specification.

Do not store presentation text as the canonical state.

Example:

```text
CURRENT_ACTIVE
```

database/domain;

```text
"Current concern"
```

clinician UI;

```text
patient-safe copy
```

patient UI where appropriate.

---

# 145. Database enums versus strings

Use Prisma/Postgres enums for highly stable canonical vocabularies.

Use strings/versioned tables where values are deployment-configured or expected to expand operationally.

Do not force every string into an enum.

---

# 146. Monetary/billing concerns

None in V1.

Do not build billing/subscriptions.

---

# 147. Multi-tenancy

Do not build generic SaaS multi-tenancy unless the deployment explicitly requires multiple independent organizations.

V1 can represent service/care-team assignments without a full tenant platform.

If multi-organization deployment becomes a real requirement, add an organization boundary then.

---

# 148. Patient-clinician assignment

Store explicit relationship/assignment records.

Clinician patient access is based on those assignments and allowed care-team scope.

Do not expose all patients to all clinicians by default.

---

# 149. Admin does not mean superuser

Admin workspace permission is granular.

Administrative actors should not automatically gain unrestricted patient clinical visibility unless their role/permission requires it.

This distinction is enforced server-side.

---

# 150. Safety-owner access

Safety-owner operations may use the clinician/admin visual workspace depending on deployment role, but authorization is permission-driven.

The architecture does not create a fourth frontend application.

---

# 151. Request pipeline

Fastify request pipeline:

```text
request ID
→ logging context
→ authentication
→ authorization guard
→ contract validation
→ route handler
→ application service
→ response projection
→ contract-safe response
```

Error handler maps known errors to stable API errors.

---

# 152. Database access from routes

Route handlers should not contain arbitrary Prisma queries.

Routes call application services.

Simple read-only endpoint projection queries may live in module query helpers.

Keep domain state transitions out of route files.

---

# 153. Database access from domain evaluators

Pure evaluator code receives already-loaded typed input.

No Prisma imports inside pure rule files.

This is a hard boundary.

---

# 154. External provider access

No external provider client inside pure domain code.

Infrastructure adapters include:

```text
email
```

and later any explicitly required external delivery system.

Safety route data itself is domain configuration; external emergency treatment is not implemented by this module.

---

# 155. Testing time-dependent jobs

Jobs use the same injected clock/domain services where possible.

Do not make tests wait real hours/days.

Use fixed time inputs and direct job invocation.

---

# 156. pg-boss schema

pg-boss uses its own database schema.

Its internal tables are not treated as domain tables.

Admin operational UI reads domain delivery/incident state rather than exposing pg-boss internals to ordinary users.

Developer operations may inspect pg-boss directly when debugging.

---

# 157. Worker idempotency

Every job handler assumes it may be invoked again.

Before external side effects it checks authoritative delivery/task state.

Retries cannot create duplicate reminders or duplicate case transitions.

---

# 158. Email and auxiliary delivery model

Conceptually:

```text
eligible delivery
→ notification_deliveries row
→ transactional pg-boss enqueue
→ Resend
→ provider result persisted
```

Provider failure changes delivery state, never clinical state.

## `DELIVERED_WITH_AUXILIARY`

For V1 this means:

> the durable in-app clinician task exists and the auxiliary provider has successfully **accepted** the outbound message request.

It does not claim the recipient opened/read the message.

If provider webhooks are later enabled:

- verify signatures;
- process events idempotently;
- persist provider delivery/bounce state separately;
- never alter clinical eligibility/tier from provider delivery state.

# 159. Clinician task delivery

Conceptually:

```text
clinical/engagement/safety case
        ↓
eligibility
        ↓
ClinicianTask persisted
        ↓
recipient routing
        ↓
in-app work queue available
        ↓
optional auxiliary email
```

The internal task is useful even if email is unavailable.

---

# 160. In-app notifications

Do not build a separate notification center initially unless the UX later explicitly requires it.

Clinician work is visible through the relevant queues.

Patient actions are visible through Home/Check-In/Support.

This avoids redundant state.

---

# 161. Scheduler implementation

Do not rely on server-local `setTimeout` for multi-day deadlines.

Use persisted timestamps plus pg-boss scheduled/recurring work.

Examples:

- engagement sweeps;
- reminders;
- scheduled safety rescreen checks;
- future-period provisioning.

---

# 162. Period status

Authoritative period dates are persisted.

Read models may derive display status from:

```text
open_at
effective_due_at
current time
```

where this does not change the canonical identity.

Any persisted lifecycle field must remain consistent with those dates.

Do not duplicate period calculations in frontend code.

---

# 163. Engagement scheduling

The worker uses:

```text
effective_due_at
```

as the authoritative timing anchor.

Jobs/reminder logic remains idempotent if `effective_due_at` changes due to technical failure/rescheduling.

Old scheduled work must not blindly send stale reminders.

---

# 164. Safety synchronous response and scheduled work

## Immediate S0/S1 patient response

Safety resolution and the patient-facing safety presentation are synchronous and do not depend on pg-boss worker completion.

## Safety delivery

After commit, `safety-delivery` jobs handle clinician/safety-owner delivery, auxiliary outbound delivery, retries, and operational escalation.

Reserve worker capacity for safety jobs. Ordinary email/reminder backlog must not consume all worker capacity.

## Scheduled reassessment

Scheduled safety reassessments use durable jobs and do not wait for the engagement sweep.

## Failure

Safety-delivery failure records an operational incident immediately and invokes configured routing-failure behavior. Worker failure never clears/relaxes the safety gate.

# 165. Failure priority

Operational failure handling should reflect domain consequence:

```text
safety delivery failure
>
clinician durable-task failure
>
auxiliary email failure
```

This prioritization affects operational incident visibility, not clinical state.

---

# 166. Database connection handling

Use one Prisma Client instance per backend process.

Use `@prisma/adapter-pg` with a deliberately sized application pool.

pg-boss receives its own deliberately sized worker/queue connection capacity.

Pool budgets account for:

```text
HTTP/API concurrency
+
worker concurrency
+
migration/admin connections
+
safety headroom
```

and remain below the managed PostgreSQL connection limit.

If workers later become a separate process, connection budgets are recalculated rather than copied blindly.

# 167. Local database version

`docker-compose.yml` pins:

```text
postgres:17-alpine
```

Do not use `latest`.

---

# 168. Dependency pinning

Commit the lockfile:

```text
pnpm-lock.yaml
```

Pin direct dependencies to exact patch versions when they are introduced. Choose major and minor versions deliberately, and let the committed lockfile make transitive resolution reproducible.

Do not automatically follow prerelease versions for core dependencies.

---

# 169. Upgrade policy

Do not perform opportunistic framework upgrades during feature work.

Dependency upgrades are separate coherent maintenance commits unless required by the current feature/security issue.

This protects high-speed Codex development from unrelated churn.

---

# 170. Security update exception

Critical security updates may override the normal upgrade cadence.

Such upgrades remain separate and explicitly reviewed.

---

# 171. Documentation inside repository

Keep these top-level architectural documents under:

```text
/docs
```

Codex implementation packets should reference them when a task touches domain or product behavior.

Do not duplicate the V1 rules into multiple conflicting markdown files.

---

# 172. Source of truth hierarchy

```text
1. V1 Master Specification
2. Web Product/UX Implementation Lock
3. Actual Implementation Architecture
4. module-level implementation docs/comments
5. code
```

If code and documents conflict, fix the code or explicitly version the governing specification.

---

# 173. Technology choice matrix

| Concern | Locked choice | Explicitly not used |
|---|---|---|
| Package manager | pnpm workspaces | npm/yarn workspace split |
| Monorepo orchestration | plain pnpm scripts | Nx/Turborepo initially |
| Runtime | Node.js 24 LTS | Node Current |
| Language | TypeScript ESM | mixed backend languages |
| Web | React `>=19.2.7` + Vite 7+ | Next.js |
| Routing | React Router 8 **Data Mode** with `createBrowserRouter` | Framework/SSR mode |
| Server state | TanStack Query | Redux for API state |
| Forms | React Hook Form + Zod | ad hoc form state |
| Styling | Tailwind CSS 4 | multiple CSS frameworks |
| Components | shadcn/ui + Base UI | MUI/Ant/Chakra |
| Charts | Recharts via wrappers | custom canvas chart engine |
| Backend | Fastify 5 | NestJS/microservices |
| Auth | Better Auth | custom auth implementation |
| Database | PostgreSQL 17 | MongoDB/multi-database |
| ORM | Prisma 7 + `@prisma/adapter-pg` | custom SQL everywhere |
| Jobs | pg-boss + `fromPrisma(tx)` | Redis/BullMQ/RabbitMQ/Kafka |
| Email | Resend | self-hosted mail server |
| Contracts | shared Zod package | duplicated DTOs |
| API | REST JSON `/api/v1` | GraphQL/tRPC |
| Unit/domain tests | Vitest | mixed test runners |
| E2E | Playwright | Selenium |
| Deployment | one Docker app + managed Postgres | Kubernetes |
| Logging | Fastify/Pino | custom logger |
| Audit | DB-enforced append-only table + immutable domain history | full event sourcing |

# 174. Technology verification notes

The locked stack was rechecked against current official/project documentation before finalizing this version.

## React Router 8

Use:

```text
Node 24 LTS
React >= 19.2.7
React DOM >= 19.2.7
Vite 7+
React Router 8 Data Mode
createBrowserRouter
```

Do not accidentally introduce React Router Framework/SSR mode; V1 intentionally keeps Fastify as the sole application backend.

## Prisma 7

Use:

```text
prisma-client generator
explicit generated-client output
prisma.config.ts
@prisma/adapter-pg
```

## pg-boss

When enqueueing atomically with a Prisma transaction, use:

```text
fromPrisma(tx)
```

## Better Auth

Fastify integration is supported. Preserve its origin/CSRF protections. Its supported 2FA capability can satisfy the privileged-user MFA requirement without building custom MFA.

## Dependency pinning

Exact patch versions are pinned through `package.json` and `pnpm-lock.yaml` when each dependency is first introduced by its owning implementation scope.

Framework/library versions are not opportunistically changed during unrelated feature work.

# 175. Architecture acceptance criteria

The implementation architecture is correctly realized when:

1. One repository runs the local app with PostgreSQL plus `pnpm dev`.
2. Production is one app container plus managed PostgreSQL.
3. No frontend code contains authoritative V1 rule calculations.
4. Shared API schemas live in `packages/contracts`.
5. Fastify modules follow the locked ownership boundaries.
6. Pure evaluators import neither Prisma nor external clients.
7. PostgreSQL is the only application datastore.
8. pg-boss is the only async job system.
9. Prisma 7 uses `@prisma/adapter-pg`, explicit client output, and `prisma.config.ts`.
10. Transactional job creation uses `fromPrisma(tx)` when atomicity is required.
11. Better Auth owns auth/session primitives; application authorization is backend-owned.
12. Privileged real-patient accounts require authorized provisioning and MFA.
13. Consequential actions implement persisted `Idempotency-Key` semantics.
14. Ordered patient-state mutations acquire the per-patient processing lock.
15. One-open-case invariants are database-enforced.
16. Submitted assessment revisions and approved content versions are immutable.
17. Required evaluation/observation/intent/follow-up/history structures are persisted.
18. Weekly/daily observations remain distinct from confirmed use events.
19. Historical recomputation derives effects from canonical `EvaluationTrigger`.
20. Backfill cannot send historical support or historical-only notifications.
21. Audit-required changes write audit transactionally.
22. `audit_events` is append-only by DB/application-role enforcement.
23. Durable clinician tasks are independent from auxiliary delivery.
24. S0/S1 patient safety response is synchronous and worker-independent.
25. Safety worker capacity cannot be consumed entirely by ordinary backlog.
26. APIs return role-specific projections rather than raw Prisma models.
27. Engagement uses `effective_due_at`.
28. Timezone logic is centralized/tested.
29. Search authorization is applied before search/pagination.
30. Markdown rendering disallows raw HTML/unsafe links.
31. `/health/ready` verifies queues, schedules, and worker registration.
32. Migrations execute before the new release accepts normal traffic.
33. WCAG 2.2 AA patterns are built into reusable UI components.
34. Key evaluator-facing screens have Playwright visual coverage.
35. Deterministic synthetic demo scenarios exist.
36. No hard-coded emergency telephone number exists in product source.
37. `APP_MODE=real_patient` validates concrete readiness and refuses activation when incomplete.
38. Readiness includes route tests, worker health, notification privacy, backup/restore records, retention configuration, and no demo-reset capability.
39. No Redis/Kafka/RabbitMQ/NestJS/Next.js/Kubernetes/event-sourcing infrastructure is added without a newly justified architecture decision.

# 176. Final architecture

```text
                         FUTURE MOBILE
                              │
                              │
                              ▼
                    SAME REST API / CONTRACTS
                              │
                              │
┌──────────────────────────────────────────────────────────────┐
│                      ONE V1 APP SERVICE                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                 FASTIFY BACKEND                       │  │
│  │                                                       │  │
│  │  Better Auth                                          │  │
│  │  REST /api/v1                                         │  │
│  │  Authorization                                        │  │
│  │                                                       │  │
│  │  Profiles / Scheduling / Assessments                  │  │
│  │  Safety / Consumption / Monitoring                    │  │
│  │  Content / Clinical / Engagement                     │  │
│  │  Delivery / Operations / Audit                       │  │
│  │                                                       │  │
│  │  pg-boss workers                                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │        STATIC REACT 19 + VITE WEB APPLICATION         │  │
│  │                                                       │  │
│  │   Patient        Clinician        Admin               │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               │
                               ▼
                  ┌─────────────────────────┐
                  │      PostgreSQL 17      │
                  │                         │
                  │ domain state            │
                  │ immutable history       │
                  │ auth/session data       │
                  │ audit                   │
                  │ operational state       │
                  │ pg-boss jobs            │
                  └─────────────────────────┘
                               │
                               │
                       auxiliary delivery
                               ▼
                         ┌──────────┐
                         │  Resend  │
                         └──────────┘
```

---

# 177. Final implementation principle

The architecture deliberately keeps infrastructure boring while making domain correctness and product quality rigorous.

The **product** should look sophisticated.

The **domain implementation** should be deterministic, versioned, and auditable.

The **ordered patient state** should be serialized.

The **effects** should be explicit and idempotent.

The **infrastructure** should remain minimal.

Target:

```text
excellent UI
+
correct deterministic rules
+
clear module ownership
+
complete historical persistence
+
patient-level serialization
+
explicit evaluation/effect planning
+
transactional PostgreSQL
+
durable pg-boss execution
+
strong auth/audit/readiness controls
+
one deployable backend
```

Avoid:

```text
microservices
multiple databases
distributed caches
extra brokers
framework ceremony
generic enterprise platforms
```

This document is the **locked V1 implementation architecture**.

A new service, datastore, queue, state-management system, repository split, or framework is introduced only when a concrete later requirement proves the current architecture cannot satisfy it cleanly.

Architectural simplicity is never used as an excuse to omit correctness mechanisms the V1 genuinely requires, including patient serialization, idempotency, immutable history, safety precedence, authorization, audit, and operational readiness.
