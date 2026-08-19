# AUD Subjective Monitoring V1 — Phase 2 Identity and Core Platform Implementation Guide

## Document status

**Status:** **PLANNED**

**Phase:** 2 of 7

**Phase name:** Identity + Core Platform

**Target commits:** 3 balanced commits

**Implementation mode:** Commit packet method

**Repository baseline inspected:** `e58a3ffa71451d7437c56b1680946362369c7e1b`

**Validated Phase 1 implementation baseline:** `7a09757b89f1ed25fbc349bc269c217904d94c6e`

**Repository state when this guide was written:** Clean `main` branch after Phase 1 completion and its documentation update

This document defines the implementation boundary and commit plan for Phase 2 only. It is an execution guide, not a new product, clinical, UX, or architecture specification.

Authority remains:

1. `AUD_Subjective_Monitoring_Master_Specification_V1.md`
2. `AUD_V1_Web_Product_Surface_and_UX_Implementation_Lock.md`
3. `AUD_V1_Locked_Implementation_Architecture.md`
4. `AUD_V1_Phase_1_Foundation_Implementation_Guide.md` as the accepted foundation record
5. this Phase 2 guide
6. later packet-specific instructions and implementation, provided they do not conflict with the sources above

If this guide appears to conflict with a governing document, the higher-authority document wins. Do not silently reinterpret a locked decision; record the conflict and correct the packet or this guide.

---

# 1. Phase outcome

At the end of Phase 2, the product has one secure identity and core-platform path spanning the existing web, backend, contracts, and PostgreSQL foundation:

- Better Auth owns email/password credential verification, session cookies, session rotation/revocation, and supported two-factor primitives;
- application-owned backend code owns account state, workspace access, roles, permissions, direct clinician-patient assignments, and authorization decisions;
- public self-selection of privileged roles is impossible;
- authenticated users are routed into polished patient, clinician, or admin workspace shells based on backend-provided access;
- unauthorized and cross-patient access is rejected by the backend without leaking resource existence;
- patient profile and preference state has a version-aware, auditable foundation without prematurely completing onboarding or activating a recovery goal;
- the weekly scheduling subsystem can calculate, persist, and query authoritative fixed periods using stored IANA timezones, UTC timestamps, Luxon, and an injectable clock;
- regional safety routing profiles have a versioned, permission-controlled draft/test/activation foundation without implementing safety evaluation or patient handoff behavior;
- identity, assignment, profile, schedule, and routing actions write required audit records transactionally and use the existing idempotency/concurrency foundations where the locked architecture requires them;
- deterministic synthetic Phase 2 accounts and relationships support development and access-control testing;
- the existing CI path validates the new identity/core-platform behavior against real PostgreSQL and the production same-origin application.

The phase creates a serious authenticated platform, not a complete clinical product. A signed-in patient still cannot activate monitoring or submit a weekly assessment until later phases implement the required safety and onboarding behavior.

---

# 2. Actual Phase 1 baseline and carry-forward work

Phase 2 planning is based on direct inspection of the completed repository, not only the Phase 1 completion summary.

## 2.1 Confirmed foundation available for reuse

The repository already provides:

- the intended pnpm workspace with `apps/web`, `apps/backend`, and `packages/contracts`;
- strict TypeScript/ESM, exact direct dependency pins, and a committed lockfile;
- React Router Data Mode, TanStack Query, Tailwind, Base UI, and accessible reusable web primitives;
- a polished non-live foundation reference at `/`;
- Fastify application/server separation, request IDs, redacted structured logging, safe error envelopes, and same-origin SPA serving;
- PostgreSQL 17, Prisma 7, `@prisma/adapter-pg`, a committed migration path, and real-PostgreSQL integration tests;
- `idempotency_records`, `patient_processing_locks`, append-only `audit_events`, and `operational_incidents` foundation tables;
- liveness/readiness endpoints, graceful shutdown, Docker packaging, Playwright/axe checks, and GitHub Actions.

Phase 2 must extend these patterns rather than replace them.

## 2.2 Phase 1 drift assessment

No unplanned product feature, speculative service, second datastore, or conflicting architecture was found. The three additional Phase 1 commits were bounded validation closures and are already accepted in the Phase 1 completion record.

The following real integration work remains and is deliberately absorbed by the relevant Phase 2 packet:

1. **Application mode is not yet modeled.** The current config has `NODE_ENV` but no `APP_MODE=prototype|real_patient`. Commit 1 adds the locked application mode distinction. It must not claim that Phase 2 alone makes real-patient mode ready.
2. **Foundation UUID references are not yet relationally linked.** `idempotency_records.actor_id`, `patient_processing_locks.patient_id`, and nullable audit actor/patient references were created before user/profile tables existed. Commit 2 reviews and adds safe foreign-key relationships where they preserve append-only history and the intended deletion policy.
3. **The root route is still the Phase 1 reference surface.** Commit 1 makes `/` session-aware and moves or gates the reference surface so it remains useful in prototype/development without becoming the production product landing page.
4. **There is no typed browser API client or form library yet.** Commit 1 introduces the locked native-fetch wrapper and React Hook Form only because authentication/profile workflows now concretely require them.
5. **Readiness currently covers only configuration, Prisma, and PostgreSQL.** Commit 1 adds truthful authentication readiness. Commit 3 may add routing-configuration readiness facts, but neither commit may claim pg-boss, delivery, safety, content, backup, or complete real-patient readiness.
6. **Security middleware is not yet installed.** Authentication creates the first concrete need for security headers and targeted rate limits; Commit 1 adds them without applying indiscriminate limits to normal authenticated reads.
7. **CI and README still describe Phase 1.** Each packet updates only the documentation/tests it changes; Commit 3 finishes the Phase 2 naming, validation path, and handoff record without rewriting Phase 1 history.

These are integrations with the accepted foundation, not permission to reopen or redesign Phase 1.

---

# 3. Phase scope

## 3.1 Included

Phase 2 includes only these capabilities:

1. **Authentication and session foundation**
   - Better Auth inside the existing Fastify process and PostgreSQL database;
   - Prisma-backed Better Auth schema through committed Prisma migrations;
   - email/password sign-in and sign-out;
   - current-session resolution;
   - server-managed cookies with production security attributes;
   - strict trusted-origin/CSRF behavior;
   - explicit session expiry, freshness, rotation, and revocation behavior;
   - supported TOTP/two-factor challenge and enrollment foundations for privileged accounts;
   - provider-backed email verification and password recovery through the locked thin Resend adapter, with explicit prototype capability behavior when delivery is not configured;
   - safe authentication error wording, targeted rate limiting, and security headers;
   - accessible login, two-factor, expired-session, and configured recovery screens.

2. **Application authorization and account administration**
   - backend-authoritative workspace, role, permission, assignment, and account-state resolution;
   - application-owned role assignments and permission constants limited to actions implemented in this phase;
   - direct clinician-patient assignments;
   - authorized account provisioning and disable/enable behavior;
   - session invalidation after account disablement and material role/permission changes;
   - fresh-session/step-up enforcement for the privileged actions implemented now;
   - transactional audit for privileged identity/access changes;
   - idempotency and optimistic concurrency for consequential mutations;
   - purpose-built session/access projections rather than raw Better Auth or Prisma records.

3. **Role-specific web foundation**
   - one web application with distinct Patient, Clinician, and Admin shells;
   - session-aware root routing and guarded workspace namespaces;
   - navigation containing only implemented/usable Phase 2 destinations;
   - a polished Admin Users & Access workflow for the actions implemented now;
   - a clinician assigned-patient access surface limited to identity/profile context available now;
   - a patient account/profile foundation surface;
   - designed unauthenticated, loading, expired, restricted, empty, and error states;
   - frontend visibility rules for UX only, with backend checks remaining authoritative.

4. **Patient profile foundation**
   - one patient profile linked to one patient identity;
   - basic profile/account linkage and monitoring timezone;
   - canonical response-state types needed for stable preferences where this phase exposes them;
   - versioned preference/permission records when a value affects later personalization or delivery;
   - profile ownership and assigned-clinician read rules;
   - auditable profile/timezone/preference changes;
   - onboarding progress represented as incomplete until Phase 3 completes the required sequence.

5. **Scheduling foundation**
   - centralized Luxon-based period calculations using an injected clock;
   - versioned monitoring schedules;
   - scheduled-period identity and canonical timestamps/status;
   - next-boundary behavior for enrollment, timezone changes, and schedule changes;
   - immutable period timezone/schedule version once a period begins;
   - original versus effective due timestamps and auditable reschedule structure;
   - callable backend service boundaries for Phase 3 activation and later period provisioning;
   - no authoritative date calculation in the browser.

6. **Regional safety-routing foundation**
   - versioned PostgreSQL routing profiles and structured route targets;
   - draft, validation, test-evidence, activation, supersession, and historical-read behavior required by the locked UX;
   - permission, step-up, optimistic-concurrency, idempotency, and transactional-audit enforcement for activation/change;
   - deterministic lookup of the active profile by country/region and effective time;
   - no hard-coded universal telephone number or fallback route in source;
   - an admin configuration surface limited to the implemented routing lifecycle.

7. **Testing and development data**
   - focused unit tests for permission and time-boundary logic;
   - real-PostgreSQL integration tests for auth, account state, assignments, authorization order, versioning, audit, and routing invariants;
   - Playwright flows for authentication and representative cross-role access behavior;
   - deterministic synthetic Phase 2 accounts/profiles/assignments in prototype/demo mode only;
   - clean, repeatable seed behavior that is blocked in real-patient mode.

## 3.2 Explicitly excluded

The following belong to later phases and must not be implemented in Phase 2:

- the safety questionnaire, C-SSRS flow, safety evaluator, safety gate, safety cases, dispositions, handoff presentation, or safety delivery;
- final monitoring or recovery-goal activation;
- the complete onboarding sequence, AUDIT-C computation, full drinking baseline context, or safety-controlled onboarding completion;
- the 28-day reduction baseline, reduction target validation, or consumption calendar;
- weekly assessment drafts, submissions, revisions, corrections, late/backfill behavior, or questionnaire screens;
- monitoring policy/evaluator code, canonical threshold registry, current flags, recurrence, persistence, recomputation, or effect planning;
- content governance/resolution, patient support, clinical review cases/tasks, engagement, reminders, or technical-failure workflows;
- pg-boss workers, schedules, durable clinician tasks, or application email notification queues;
- a generic notification framework; any authentication email integration stays a thin auth-specific adapter;
- social login, SSO/SAML, passkeys, magic links, SMS, mobile push, or a second authentication authority;
- generic care-team, organization, tenant, or enterprise-IAM systems;
- patient file upload, EHR integration, appointment scheduling, billing, analytics, or unrelated admin tools;
- broad production readiness, backup/restore configuration, retention/deletion workflow, or permission to process real-patient data;
- full patient, clinician, or admin dashboards whose authoritative data does not exist yet.

Phase 2 must not create active recovery-goal history or an active monitoring schedule merely to make seeded screens look complete. Phase 3 owns activation after the required safety and onboarding decisions exist.

---

# 4. Locked decisions Phase 2 must realize

| Concern | Phase 2 decision |
|---|---|
| Authentication authority | Better Auth inside Fastify, backed by the existing PostgreSQL deployment |
| Identity mapping | One canonical UUID user identity; avoid a synchronized shadow-user system unless current official adapter constraints prove it necessary |
| Credential surface | Email/password; no breadth-oriented identity providers |
| Privileged identity | Provisioned through authorized workflows; verified identity plus MFA is required before real-patient privileged use |
| Session transport | Host-only `HttpOnly`, `Secure` in production, `SameSite=Lax` cookies; no bearer token persistence in browser storage |
| CSRF/origins | Preserve Better Auth protections; explicit trusted origins; no production wildcard |
| Authorization | Application-owned and backend-authoritative |
| Access dimensions | Workspace, role, permission, and assignment/scope remain distinct |
| Patient access | Own record for patient; explicit assignment/scope for clinician; admin is not automatically a clinical superuser |
| API shape | Purpose-built REST/JSON `/api/v1` projections and explicit action routes |
| Browser state | TanStack Query for server state, URL for filters, React for local presentation; no global client store |
| Forms | React Hook Form plus shared/client Zod validation and existing design-system fields |
| Time | UTC persistence, stored IANA monitoring timezone, Luxon backend calculation, injectable clock |
| Schedule | Fixed Monday-to-Monday local periods, open at period end, due 24 hours later, no early final submission |
| Routing | Versioned regional profiles in PostgreSQL; no hard-coded universal route |
| Consequential actions | Confirmation in UI; backend permission, freshness, idempotency, concurrency, and audit remain authoritative |
| Data history | Version rather than overwrite where the Master Specification requires historical interpretation |

## 4.1 Specification traceability

| Phase 2 concern | Governing source |
|---|---|
| Authentication and sessions | Locked Implementation Architecture §§7, 33–34, 57, 93–96, 128, 151 |
| Authorization, roles, permissions, assignments | Locked Implementation Architecture §§8, 19.1, 25 Identity/access, 45, 148–150 |
| Route hierarchy, shells, client/API patterns | Locked Implementation Architecture §§11–18, 46; UX Implementation Lock §§2–6, 16, 24, 26 |
| Profile ownership and preferences | Master Specification §7 and §23; Locked Implementation Architecture §19.2 and §25 Profile/onboarding; UX Implementation Lock §§8 and 15 |
| Scheduling and timezone semantics | Master Specification §6 and §26.1; Locked Implementation Architecture §§19.3, 22, 25 Scheduling, 161–163 |
| Regional safety-routing profile | Master Specification §8.15; Locked Implementation Architecture §§59 and 124; UX Implementation Lock §28.2 |
| Versioning, provenance, and audit | Master Specification §§23 and 29; Locked Implementation Architecture §§37–38, 44–45 |
| Accessibility and restricted/session states | UX Implementation Lock §§26.3–26.5, 33, 41–43; Locked Implementation Architecture §§65, 68–70 |
| Simplicity and commit boundaries | Locked Implementation Architecture §§101–117, 168–177 |

These references constrain Phase 2. They do not authorize implementation of the later clinical behavior described near them.

## 4.2 Implementation-time technical verification

Before Commit 1 changes dependencies or generates auth schema, the packet must recheck the selected stable Better Auth version against its official Fastify, Prisma-adapter, database/UUID, session, security, and two-factor documentation.

Important current constraints to preserve:

- the Better Auth Prisma adapter can generate Prisma schema but Prisma migrations remain repository-owned and committed;
- Prisma 7 uses the repository's explicit generated-client output rather than an `@prisma/client` default import;
- the Fastify integration forwards the standard Request/Response boundary without creating a second HTTP server;
- Better Auth's origin and CSRF protections must remain enabled;
- UUID generation must align with the existing UUID-based foundation records;
- application roles and permissions must not be delegated to a generic Better Auth admin-role model merely because a plugin exists.

Use current official documentation as technical input, not as authority over the locked product/domain documents.

---

# 5. Commit plan at a glance

| Commit | Identity | Coherent result |
|---|---|---|
| 1 | `feat: establish secure authentication and session handling` | Better Auth, secure cookie sessions, MFA foundation, session-aware routing, typed API/form foundations, and auth security controls |
| 2 | `feat: enforce role-based access and patient assignments` | Application-owned RBAC, direct assignments, profile foundation, role-specific shells, Users & Access, and audited access mutations |
| 3 | `feat: add authoritative scheduling and regional routing` | Luxon scheduling/versioned periods, regional route lifecycle/resolution, final Phase 2 seeds/tests/CI, and a clean Phase 3 handoff |

The commit count is a target and these boundaries are the default. Split only if repository evidence shows a commit has become genuinely unreviewable. Merge only if a locked library or migration dependency makes two boundaries inseparable. Any boundary change must be justified in the active packet before implementation.

---

# 6. Commit 1 packet definition

## Commit identity

```text
feat: establish secure authentication and session handling
```

## Goal

Add one secure authentication/session authority to the existing Fastify/PostgreSQL application and replace the anonymous foundation entrypoint with a polished, accessible, session-aware product entry. This commit proves identity without inventing application roles or domain access rules that belong to Commit 2.

## Assumptions to verify before implementation

- The repository is still at or cleanly descended from the inspected Phase 1/doc baseline.
- Better Auth's current stable Fastify and Prisma adapter APIs remain compatible with Node.js 24, Fastify 5, Prisma 7, and the explicit generated client path.
- UUIDs can be used consistently for Better Auth user/session-related identities needed by application records.
- The existing Prisma client can be shared with the Better Auth Prisma adapter without creating a second application Prisma instance.
- Production remains same-origin, while local Vite access is the only additional trusted browser origin.
- No authentication/provider code was introduced after this guide was written.

If an assumption is false, record the actual evidence and adjust only the affected implementation detail. Do not replace Better Auth, Prisma, Fastify, or the same-origin architecture.

## Exact scope

1. Add exact stable versions of Better Auth and its official Prisma adapter. Add only the supported two-factor client/server plugin required by this packet.
2. Configure Better Auth in `apps/backend/src/infrastructure/auth` using the existing Prisma client and PostgreSQL database.
3. Generate/reconcile the required Better Auth Prisma models, then create and review one committed Prisma migration. The generated schema is input to the migration; `prisma db push` is not the delivery mechanism.
4. Use UUID identifiers consistent with the foundation schema. Treat the Better Auth user record as the canonical user identity unless official adapter evidence requires a separate linkage; do not create two user sources of truth by habit.
5. Mount Better Auth under `/api/auth/*` inside the existing Fastify application using the official request/response conversion pattern.
6. Configure:
   - email/password credentials;
   - public signup disabled by default;
   - explicit trusted origins;
   - host-only secure production cookies with `HttpOnly` and `SameSite=Lax`;
   - explicit idle/rotation and absolute-session behavior;
   - session revocation capabilities;
   - TOTP/two-factor plugin schema and challenge support;
   - no social providers or long-lived browser bearer tokens.
7. Add `APP_MODE=prototype|real_patient`, `BETTER_AUTH_SECRET`, `APP_BASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, and any strictly required auth settings to typed configuration and `.env.example`. Prototype remains the local default. Secret values never receive insecure application defaults; provider configuration may be optional only in prototype mode with the capability reported unavailable.
8. Implement email-address verification and password recovery through one thin Resend infrastructure adapter:
   - keep auth templates minimal and privacy-safe;
   - do not log tokens, links, or sensitive delivery payloads;
   - inject a fake adapter in tests;
   - permit a clearly reported prototype-without-email capability state when provider configuration is absent;
   - do not expose a recovery action as successful delivery when the environment capability is unavailable;
   - require configured delivery before reporting the relevant real-patient auth readiness check as ready.
9. Keep this adapter specific to Better Auth operational messages. Do not pre-build Phase 6 notification records, queues, retry policy, clinician delivery, or a provider-plug-in framework.
10. Add targeted rate limiting for sign-in, recovery, verification, and two-factor endpoints plus security headers compatible with the Vite bundle. Do not broadly throttle authenticated dashboard reads.
11. Extend readiness with non-sensitive authentication/configuration facts that actually exist. It must continue to state no conclusion about RBAC, routing, workers, safety, backups, or full real-patient readiness.
12. Add one typed native-fetch API client for application `/api/v1` calls with credentials, request-ID handling, shared error parsing, abort signals, and safe-read retry boundaries. Better Auth's supported client may own `/api/auth` calls.
13. Add React Hook Form because real authentication forms now require it. Reuse existing `FormField`, button, dialog, and system-state patterns rather than replacing the Phase 1 design system.
14. Implement accessible routes/screens for the capabilities actually enabled, expected to include:
   - `/login`;
   - a two-factor challenge route;
   - session-expired handling;
   - sign-out;
   - recovery/request-reset and reset completion only when backed by the implemented capability.
15. Make `/` resolve session state and route unauthenticated users to login. Authenticated users without application access assignments may see a neutral account-setup state until Commit 2.
16. Preserve the Phase 1 reference surface under a clearly non-live prototype/development route or remove it from production routing if keeping it would expose an internal showcase. Do not duplicate its components.
17. Add focused tests for auth schema/migration, cookie attributes, trusted-origin rejection, session creation/resolution/revocation, two-factor challenge behavior, rate limits, safe errors, and accessible form/session states.

## Expected file-level changes

The packet should reconcile these paths with the actual repository and current library output:

```text
package.json
pnpm-lock.yaml
.env.example
README.md

apps/backend/package.json
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase_2_auth_migration>/migration.sql
apps/backend/src/app.ts
apps/backend/src/server.ts
apps/backend/src/infrastructure/config/*
apps/backend/src/infrastructure/auth/*
apps/backend/src/infrastructure/email/*          # thin auth-message adapter only
apps/backend/src/infrastructure/logging/*       # redaction additions only if required
apps/backend/src/routes/health.ts
apps/backend/src/shared/errors/*                # stable auth-safe mappings only
apps/backend/test/integration/auth*.test.ts

packages/contracts/src/auth/*                   # application-facing session/capability contracts only
packages/contracts/src/health/*
packages/contracts/src/index.ts

apps/web/package.json
apps/web/src/app/providers/*
apps/web/src/app/router/*
apps/web/src/features/auth/*
apps/web/src/lib/api/*
apps/web/src/lib/auth/*
apps/web/src/features/foundation/*              # move/gate, do not redesign
apps/web/src/**/*.test.tsx

tests/e2e/auth*.spec.ts
playwright.config.ts                            # only if auth fixtures require a focused extension
```

Do not export Better Auth internals through `packages/contracts`. Shared application contracts describe the product-facing session/access capability, while Better Auth owns its own endpoint types.

## Acceptance criteria

1. A clean database applies the Phase 1 migration followed by the committed auth migration without `db push`.
2. Better Auth uses the existing Prisma 7 client/adapter path and does not create an unbudgeted second application connection pool.
3. Auth identifiers are compatible with the repository's UUID foundation.
4. Same-origin `/api/auth/*` works through Fastify in the production-shaped application.
5. Valid email/password credentials create a server-managed session; invalid credentials return generic safe errors without email/account enumeration.
6. Production cookie settings are host-only, `HttpOnly`, `Secure`, and `SameSite=Lax`; no session bearer token is stored in `localStorage` or IndexedDB.
7. Untrusted browser origins are rejected and Better Auth CSRF/origin checks remain enabled.
8. Session expiry, freshness/rotation, sign-out, revocation, and absolute-lifetime behavior are explicit and tested.
9. Two-factor challenge behavior is supported and tested without treating an incomplete challenge as an authenticated session.
10. `APP_MODE` is parsed and defaults to `prototype` locally; the application does not report real-patient readiness merely because auth works.
11. Missing required production auth configuration fails safely at startup or reports not-ready according to the documented environment contract.
12. Auth endpoints have focused rate limits and the app sends compatible security headers.
13. The login/session UI is polished, keyboard-operable, correctly labelled, responsive, and free of automated WCAG 2.2 AA violations in its tested states.
14. `/` is session-aware, unauthenticated users reach `/login`, and no role/workspace is guessed in the browser.
15. Email verification and password-recovery messages use the thin Resend adapter in configured environments and a fake adapter in tests; an environment without delivery reports the capability honestly and never simulates a sent message.
16. The native-fetch application API client validates known contracts and does not automatically retry consequential writes.
17. Authentication logs and errors contain request/error identifiers but no passwords, cookies, secrets, reset tokens, TOTP secrets, backup codes, or full auth payloads.
18. Existing Phase 1 checks/builds remain green and the reference components are reused rather than forked.

## Do not do

- Do not implement application roles, permissions, assignments, or patient profiles in this commit.
- Do not use the Better Auth admin role as the application's authorization source of truth.
- Do not enable user-selected roles during signup.
- Do not add social login, SSO, passkeys, magic links, SMS, or a second auth framework.
- Do not disable CSRF/origin checks to make local development easier.
- Do not store bearer credentials in browser persistence.
- Do not write a custom password hasher, session store, or MFA algorithm when Better Auth owns those primitives.
- Do not build a generic email/notification framework or add pg-boss for auth email.
- Do not claim complete account recovery if no email is actually sent.
- Do not expose the internal auth/session database model as an API response.
- Do not implement clinical onboarding, monitoring, safety, or future workspace dashboards.

## Evidence required for review

- official-version/API verification note and dependency diff;
- generated-schema reconciliation and migration SQL inspection;
- clean migration application against PostgreSQL 17;
- auth integration tests for trusted origins, cookies, session lifecycle, 2FA, rate limits, and safe errors;
- direct inspection showing secrets/tokens are absent from logs and client storage;
- login and session-state screenshots at mobile/desktop widths;
- keyboard and automated accessibility evidence;
- production same-origin auth smoke test;
- readiness evidence with and without required auth configuration;
- complete validation output, `git diff --check`, and actual diff review.

---

# 7. Commit 2 packet definition

## Commit identity

```text
feat: enforce role-based access and patient assignments
```

## Goal

Turn authenticated identities into backend-authorized product actors. Implement the smallest application-owned role, permission, direct-assignment, account-state, and patient-profile model that supports real Phase 2 workflows, then expose distinct role-specific shells without leaking future domain data.

## Assumptions to verify before implementation

- Commit 1 is approved and its auth/session behavior is the actual starting point.
- Better Auth user IDs are canonical UUID application identities.
- Public privileged-role selection is disabled.
- The Phase 1 idempotency/audit/lock records still have no conflicting foreign keys.
- Direct clinician-patient assignment satisfies current V1 scope; no deployed care-team/organization requirement has appeared.
- The existing design-system primitives remain the visual foundation.

## Exact scope

1. Define stable application access concepts without building generic IAM:
   - workspace identifiers: `PATIENT`, `CLINICIAN`, `ADMIN`;
   - roles needed now, including patient, clinician, admin/operations, and permission-driven safety-owner responsibility where applicable;
   - permission constants only for Phase 2 actions;
   - direct assignment scope;
   - account states needed for provisioning, active access, and disablement.
2. Store application-owned role assignments and clinician-patient assignments relationally with actor, time, active/revoked state, and version/provenance needed for audit reconstruction.
3. Avoid a duplicate synchronized user table if the canonical Better Auth user row plus application-owned access tables satisfies the architecture. If application-only account state cannot be safely represented, add one tightly scoped one-to-one record and justify it in the packet.
4. Represent privileged real-patient identity verification as application-owned status/provenance with verifier and timestamp. Better Auth's `emailVerified` proves control of an email address; it must not be treated as equivalent to authorized clinician/admin/safety-owner identity verification.
5. Add one patient profile per patient identity with:
   - stable user/profile linkage;
   - IANA monitoring timezone;
   - only basic profile fields actually required for Phase 2 identity/profile workflows;
   - explicit onboarding-incomplete state;
   - version/concurrency field;
   - created/updated provenance.
6. Add versioned stable preference/delivery-permission records only for values the Phase 2 profile surface actually collects and that later rules must interpret historically. Use the Master Specification's canonical null/preference semantics; never impute missing values.
7. Do not create an active `RecoveryGoalVersion`. A recovery direction entered before Phase 3 safety resolution is not an active goal and must not be represented as one.
8. Create `patient_processing_locks` transactionally with patient profiles so later ordered patient-state services can safely assume one lock row per patient.
9. Review Phase 1 reference columns and add safe foreign keys where appropriate:
   - idempotency actor to canonical user;
   - patient-processing lock to patient profile;
   - audit actor/patient references only if the chosen `RESTRICT`/historical behavior cannot undermine append-only audit or future retention policy.
10. Implement an application session/access projection under `/api/v1` that returns only safe actor, account, workspace, role, permission, MFA/readiness, and allowed-destination data.
11. Implement request authentication and authorization helpers in the existing request pipeline:
    - authenticate;
    - verify active account;
    - resolve roles/permissions;
    - enforce assignment/resource scope;
    - then validate/serve the requested resource without leaking unauthorized existence.
12. Keep permission resolution explicit in backend code. Do not store an editable arbitrary permission matrix or trust frontend route state.
13. Implement authorized actions for the Phase 2 access model, expected to include:
    - provision an account through an authorized server workflow;
    - disable/enable an account;
    - grant/revoke a role;
    - assign/end a direct clinician-patient relationship;
    - read/update one's permitted patient profile fields.
14. Consequential access mutations require the existing confirmation pattern, fresh/step-up session where applicable, expected version, idempotency where replay risk exists, one transaction, session invalidation when privileges materially change, and append-only audit.
15. Add purpose-built read projections for:
    - current actor/session access;
    - admin Users & Access list/detail sufficient for implemented actions;
    - clinician assigned-patient identity/profile list;
    - patient own profile/account foundation.
16. Search/filter authorization must narrow scope before matching, sorting, and pagination. Do not search all patients and filter afterward.
17. Build distinct `PatientShell`, `ClinicianShell`, and `AdminShell` using the Phase 1 visual foundation. Navigation exposes only implemented Phase 2 destinations; future entries need not be fake links.
18. Implement polished Phase 2 screens:
    - Admin Users & Access for real provisioning/access/assignment actions;
    - clinician assigned-patient directory limited to available identity/profile context;
    - patient profile/account foundation with explicit onboarding-not-complete state.
19. Add deterministic prototype seed identities for at least patient, clinician, and admin, with explicit direct assignment and no real-person data. Seed/reset must refuse to run under `APP_MODE=real_patient`.
20. Add table-driven permission tests and real-PostgreSQL integration tests covering own-record, assigned, unassigned, disabled-account, stale-version, idempotency, session invalidation, audit, and authorization-before-search behavior.
21. Add Playwright coverage for representative patient, clinician, admin, restricted, and session-expiry paths.

## Expected file-level changes

```text
package.json
README.md

apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase_2_access_profile_migration>/migration.sql
apps/backend/prisma/seed.ts
apps/backend/src/app.ts
apps/backend/src/modules/identity/*
apps/backend/src/modules/profiles/*
apps/backend/src/shared/authz/*
apps/backend/src/shared/errors/*
apps/backend/src/infrastructure/auth/*
apps/backend/test/domain/authorization*.test.ts
apps/backend/test/integration/identity*.test.ts
apps/backend/test/integration/profiles*.test.ts

packages/contracts/src/auth/*
packages/contracts/src/patient/profile*.ts
packages/contracts/src/clinician/*
packages/contracts/src/admin/users*.ts
packages/contracts/src/common/*               # pagination/version/idempotency only if used
packages/contracts/src/index.ts

apps/web/src/app/router/*
apps/web/src/app/shells/*
apps/web/src/features/auth/*
apps/web/src/features/patient/profile/*
apps/web/src/features/clinician/patients/*
apps/web/src/features/admin/users/*
apps/web/src/lib/api/*
apps/web/src/**/*.test.tsx

tests/e2e/access*.spec.ts
```

Use feature-local components first. Promote a shared navigation/table/action pattern only when the implemented patient, clinician, or admin surfaces demonstrate genuine reuse.

## Acceptance criteria

1. Authentication alone grants no role, workspace, patient scope, or privileged action.
2. Workspace, role, permission, and assignment are distinct in storage/code and in the safe access projection.
3. Privileged roles cannot be selected through public/client-controlled signup data.
4. Privileged identity-verification provenance is application-owned and distinct from Better Auth email-address verification.
5. Account provisioning and role/assignment mutations are backend-authorized, version-checked, transactionally audited, and protected from accidental duplicate execution.
6. Disabling an account blocks further application access and revokes relevant sessions.
7. Material privilege changes revoke/refresh sessions so stale client state cannot retain old access.
8. Patient access is limited to the patient's own record; clinician patient access requires an active direct assignment; admin workspace access alone does not imply unrestricted clinical visibility.
9. An unauthorized patient identifier returns a non-leaking restricted/not-found response according to the common error policy.
10. Search scope is applied before search, sort, counts, and pagination.
11. One patient profile maps to one patient identity and has one processing-lock row.
12. Monitoring timezone accepts valid IANA zones and rejects invalid/free-form offsets.
13. Missing or declined preference/profile values remain explicit and are never imputed.
14. No active recovery goal or completed onboarding state can be created by Phase 2 endpoints.
15. Phase 1 UUID references are reconciled without breaking append-only audit history or migration from a clean database.
16. The frontend consumes backend-provided access and projections; it does not calculate permissions or trust hidden controls as security.
17. Patient, clinician, and admin shells are visibly distinct, responsive, keyboard-accessible, and consistent with the locked UX/design tokens.
18. Users & Access actions use the consequential-confirmation pattern and explain their immediate effect.
19. Synthetic seed data is deterministic, contains no real-person data, and cannot run in real-patient mode.
20. Unit, PostgreSQL integration, and Playwright tests demonstrate allowed and denied behavior, including disabled accounts and unassigned clinician access.
21. Existing authentication, migration, production-build, Docker, and accessibility checks remain green.

## Do not do

- Do not create a generic RBAC editor, policy language, tenant model, organization hierarchy, or arbitrary permission database.
- Do not grant every clinician access to every patient.
- Do not make Admin a blanket clinical superuser.
- Do not create a fourth safety-owner frontend application.
- Do not trust role, workspace, permission, patient ID, or assignment claims sent by the browser.
- Do not expose raw Better Auth session objects or Prisma user/profile rows.
- Do not add the full future permission vocabulary; add permissions only for actions that now exist.
- Do not implement care-team queues without a concrete deployment requirement.
- Do not complete onboarding, activate monitoring, activate a goal, or fabricate current clinical state.
- Do not copy the foundation reference into three generic dashboards.
- Do not allow seed/reset behavior in real-patient mode.

## Evidence required for review

- migration/schema and foreign-key behavior inspection;
- canonical user/account mapping explanation;
- permission/role map and route-to-permission matrix;
- table-driven authorization tests;
- real-PostgreSQL evidence for transaction, version, idempotency, audit, disable/revocation, and assignment invariants;
- direct unauthorized-access tests showing no existence/count leakage;
- seed repeatability and real-patient refusal evidence;
- patient/clinician/admin/restricted screenshots at representative widths;
- keyboard and automated accessibility results;
- complete diff, dependency/lockfile review, validation output, and `git diff --check`.

---

# 8. Commit 3 packet definition

## Commit identity

```text
feat: add authoritative scheduling and regional routing
```

## Goal

Complete the Phase 2 core platform by implementing the authoritative time/schedule model and the versioned regional route lifecycle that Phase 3 safety/onboarding will consume. Reuse Commit 2 authorization and the Phase 1 audit/idempotency foundations; do not implement safety evaluation or monitoring activation early.

## Assumptions to verify before implementation

- Commits 1 and 2 are approved and present in the actual working tree.
- Every patient profile has a validated IANA monitoring timezone and processing-lock row.
- Phase 2 permissions and step-up helpers can protect routing actions.
- No active monitoring period or recovery goal has been created outside the agreed Phase 2 boundary.
- The deployment has not introduced a concrete external routing provider requiring a new adapter.
- The current CI remains the accepted clean-checkout baseline.

## Exact scope

1. Add Luxon and its maintained TypeScript support only to the backend.
2. Add a minimal shared clock contract with real and fixed/fake implementations. Domain time services receive a clock; they do not call `Date.now()` directly.
3. Implement pure scheduling calculations for the Master Specification's fixed V1 schedule:
   - Monday 00:00 local period start;
   - seven local-calendar-day duration;
   - exclusive next-Monday period end;
   - `open_at = period_end`;
   - original due at 24 hours after open;
   - no early final submission;
   - enrollment mid-period starts at the next Monday;
   - DST-safe local-calendar behavior;
   - when a monitoring timezone changes, materialized periods remain historical facts. The next period is the first Monday 00:00 in the new timezone that is not earlier than the end of the latest materialized period. Offset changes can therefore produce a one-time transition gap; Phase 2 deliberately does not create overlapping, shortened, stretched, or non-Monday bridge periods.
4. Persist `monitoring_schedule_versions`, `scheduled_periods`, and `period_reschedule_audits` with canonical UUID identity, UTC instants, stored IANA timezone, schedule version, original/effective due times, and required provenance.
5. Enforce one logical scheduled period per patient/schedule interval and immutable period identity/boundaries after creation. Do not rely on frontend date generation.
6. Implement service boundaries for:
   - creating the initial schedule/first period when a later authorized activation calls it;
   - applying timezone/schedule changes at the next period boundary;
   - provisioning a bounded next period idempotently;
   - formally rescheduling before due time with `original_due_at` preserved and audit written.
7. Do not expose monitoring activation to Phase 2 users. Phase 3 invokes the service only after safety/onboarding eligibility exists.
8. Add role-safe schedule read projections so a patient can see own schedule state when it exists and assigned clinicians can see permitted patient schedule context. Empty/not-activated is an explicit backend state.
9. Persist versioned regional safety-routing profiles and route targets capable of representing telephone, deep link, internal queue/service target, or external service identifier without one unstructured settings blob.
10. Implement the routing lifecycle:
    - create/edit a draft version;
    - validate required fields and safe target formats;
    - record structured delivery-test evidence/result through an authorized action;
    - activate only a complete, successfully tested version;
    - supersede the prior active version without rewriting it;
    - retain historical versions read-only.
11. A recorded route test is provenance for a real deployment test, not a browser-only checkbox. The system must not manufacture passing evidence or pretend to call an external service it does not integrate with.
12. Route activation/change requires routing permission, fresh/step-up authentication, expected version, `Idempotency-Key`, one transaction, and append-only audit.
13. Implement deterministic active-route resolution by normalized country/region and effective time. An absent/misconfigured route produces a typed unavailable result and operational/readiness concern; no universal fallback is hard-coded.
14. The routing resolver returns structured authorized route data for the future safety module. Do not render patient emergency instructions or choose a safety severity in this phase.
15. Add an Admin Configuration/Regional Routing surface for the real lifecycle implemented now, reusing version/history/confirmation patterns. It must clearly distinguish draft, tested, active, superseded, invalid, and unavailable states.
16. Extend readiness with truthful auth/RBAC/routing-configuration facts. `APP_MODE=real_patient` must still remain not ready/ineligible for monitoring activation because safety, workers, delivery, content, backups, retention, and other required protections are absent.
17. Complete deterministic Phase 2 seed data with profile/timezone/assignment data and optional synthetic **draft** routing configuration. Do not seed a falsely tested/active real-world emergency route.
18. Add exhaustive time-boundary unit tests, including non-DST and DST zones, half-hour/quarter-hour offsets, year boundaries, enrollment mid-week, timezone changes, and immutable existing periods.
19. Add real-PostgreSQL tests for schedule uniqueness, versioning, concurrent/idempotent provisioning, reschedule audit, route lifecycle, one active route version per region/effective window, activation idempotency, stale version conflict, and historical immutability.
20. Add Playwright coverage for the routing administration lifecycle using synthetic test fixtures and for empty/not-activated patient schedule presentation.
21. Update CI naming/steps and repository documentation to describe the complete Phase 2 platform accurately while retaining Phase 1 history.

## Expected file-level changes

```text
package.json
pnpm-lock.yaml
.env.example                             # only if routing/readiness config truly requires it
README.md
.github/workflows/ci.yml

apps/backend/package.json
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase_2_schedule_routing_migration>/migration.sql
apps/backend/prisma/seed.ts
apps/backend/src/app.ts
apps/backend/src/shared/clock/*
apps/backend/src/modules/scheduling/*
apps/backend/src/modules/operations/routing/*  # ownership may remain operations/configuration
apps/backend/src/modules/identity/*            # permission wiring only
apps/backend/src/routes/health.ts
apps/backend/test/domain/scheduling*.test.ts
apps/backend/test/integration/scheduling*.test.ts
apps/backend/test/integration/routing*.test.ts

packages/contracts/src/patient/schedule*.ts
packages/contracts/src/admin/routing*.ts
packages/contracts/src/health/*
packages/contracts/src/index.ts

apps/web/src/app/router/*
apps/web/src/app/shells/*
apps/web/src/features/patient/profile/*        # schedule state presentation only
apps/web/src/features/admin/configuration/*
apps/web/src/components/patterns/*             # promote only demonstrated reuse
apps/web/src/**/*.test.tsx

tests/e2e/scheduling-routing*.spec.ts
```

The exact module path for routing should follow the locked ownership boundary: operational configuration and routing health may live under `operations`, while future safety evaluation remains under `safety`. Do not create a safety evaluator module merely to house routing records.

## Acceptance criteria

1. Authoritative scheduling uses Luxon in backend code with an injectable clock; the browser performs no weekly-boundary calculation.
2. Fixed-period calculations match Monday-to-Monday local calendar semantics and remain correct across daylight-saving and non-hour-offset zones.
3. Enrollment mid-period produces the next full Monday-start period, never a shortened week.
4. A period retains its stored timezone and schedule version after it begins; later profile changes cannot rewrite it.
5. `original_due_at` remains immutable and `effective_due_at` changes only through the authorized audited reschedule path.
6. Schedule/period uniqueness and idempotent provisioning are database-enforced and tested under concurrent attempts.
7. Phase 2 endpoints cannot activate monitoring; schedule activation remains a callable backend boundary for Phase 3.
8. Schedule projections explicitly represent not-activated/no-period state without the frontend inferring it from timestamps.
9. Routing profiles are versioned and historical active versions are never overwritten.
10. A route cannot activate until every required target is structurally valid and has current successful test evidence.
11. Route activation/change enforces permission, fresh/step-up session, expected version, idempotency, one transaction, and audit.
12. Same idempotency key plus same canonical activation payload returns the original result; reuse with a different payload returns `409 IDEMPOTENCY_KEY_REUSE`.
13. At most one active applicable routing profile is resolved for a region/effective time according to a database-backed invariant.
14. Missing or invalid regional configuration returns a typed unavailable state and never falls back to a hard-coded telephone number or URL.
15. No patient safety severity, gate, instruction, case, or handoff is produced in this phase.
16. The routing UI clearly presents lifecycle/version/test provenance, uses consequential confirmation, and is keyboard/responsive/WCAG-oriented.
17. Readiness reports only implemented facts and continues to refuse any implication that real-patient monitoring is ready.
18. Synthetic seeds contain no active real-world safety route and cannot run in real-patient mode.
19. Unit, integration, browser, migration, production build, Docker, and accessibility checks all pass in the final Phase 2 CI path.
20. README and CI describe Phase 2 accurately without rewriting the accepted Phase 1 record.

## Do not do

- Do not calculate schedule boundaries with raw JavaScript `Date` arithmetic.
- Do not calculate or repair authoritative periods in the frontend.
- Do not use server-local timers for future period provisioning.
- Do not register pg-boss schedules or engagement jobs in this phase.
- Do not activate monitoring or create assessments as a side effect of schedule creation.
- Do not implement safety screening, severity, gate, case, handoff, or patient emergency copy.
- Do not hard-code a country, emergency number, crisis URL, queue, or universal fallback.
- Do not mark a route tested merely because its fields validate.
- Do not overwrite an active/historical route version.
- Do not implement a generic JSON configuration editor or external routing-provider framework.
- Do not add cache, broker, worker service, second database, or deployment-provider coupling.

## Evidence required for review

- pure scheduling test matrix with expected local and UTC boundaries;
- fixed-clock and DST test output;
- schema/migration constraints and indexes inspection;
- concurrent period-provisioning and route-activation evidence;
- original/effective-due and reschedule-audit evidence;
- routing lifecycle, test-provenance, idempotency, step-up, and historical-version tests;
- source search confirming no hard-coded emergency route/telephone fallback;
- patient empty-schedule and admin routing screenshots at representative widths;
- readiness evidence in prototype and attempted real-patient configurations;
- final CI-equivalent validation, production/Docker smoke, `git diff --check`, and complete diff review.

---

# 9. Phase-wide acceptance criteria

Phase 2 is complete only when all of the following are true:

1. All three commit scopes have been implemented and individually reviewed through the packet method.
2. Better Auth is the sole credential/session authority and runs inside the existing Fastify/PostgreSQL application.
3. Application authorization is backend-owned and distinguishes workspace, role, permission, assignment, and account state.
4. Privileged roles cannot be self-selected and require provisioned access; real-patient privileged readiness includes application-owned identity-verification provenance and MFA state rather than treating email verification as sufficient.
5. Production sessions use safe host-only cookies, trusted origins, explicit lifecycle rules, revocation, and targeted auth rate limiting.
6. Frontend routes render backend-provided access state but do not enforce security by hiding controls alone.
7. Patients can access only their own profile; clinicians can access only actively assigned patients; admin access does not silently imply clinical access.
8. Privileged access changes are version-checked, idempotent where required, transactionally audited, and invalidate stale sessions.
9. Phase 1 UUID reference tables are reconciled safely with canonical user/profile identities.
10. Patient profile/preference state preserves explicit missing/declined semantics and remains onboarding-incomplete.
11. No Phase 2 path activates a recovery goal or monitoring before Phase 3 safety/onboarding logic exists.
12. Scheduling is centralized, Luxon-based, fixed-clock testable, persisted in UTC with stored IANA timezone, and correct across DST.
13. Existing periods are immutable; future changes take effect at the correct boundary; original/effective due semantics are preserved.
14. Regional routing is versioned, tested before activation, permission/step-up/idempotency protected, auditable, and resolved without hard-coded fallback.
15. Patient, clinician, and admin shells are polished, distinct, responsive, accessible, and contain only real implemented Phase 2 workflows/states.
16. Synthetic accounts/profiles/assignments are deterministic and unavailable to real-patient mode.
17. Shared contracts remain framework/database independent and API responses remain role-specific projections.
18. Real-PostgreSQL integration tests prove authorization order, relational/versioning invariants, audit, scheduling, and routing behavior.
19. Playwright demonstrates authentication, representative allowed/denied access, session handling, and the implemented admin routing path.
20. The complete CI, production build, Docker image, same-origin runtime, and accessibility baseline remain green.
21. Readiness remains truthful: authentication/core-platform health does not imply safety, workers, delivery, content, backup, or real-patient monitoring readiness.
22. No Phase 3–7 clinical workflow, speculative infrastructure, or unrelated refactor has entered the phase.

Phase 2 is **not** accepted merely because login works or role names appear in the UI. It must prove server-authoritative access, relational assignment scope, auditable profile foundations, correct time semantics, safe regional routing, and a professional cross-role product foundation together.

---

# 10. Commit packet operating method

The three definitions above are phase-level packet templates. Before each implementation attempt, create a current packet from the relevant template using the process below.

## 10.1 Before issuing a packet

The packet author must inspect the actual repository rather than rely on the prior implementation summary. At minimum inspect:

```text
git status --short --branch
git diff --stat
git diff
git log --oneline --decorate -n <reasonable count>
relevant source/configuration tree
current Prisma schema and all migrations
current package manifests and lockfile changes
current contracts, routes, tests, CI, and README
the prior packet verdict and unresolved corrections
```

For authentication/library work, also verify the exact installed/target versions against current official documentation before generating schema or copying integration code.

Preserve unrelated user changes. If the actual tree overlaps the packet in an unexplained way, stop and resolve the overlap before implementation.

## 10.2 Required packet contents

Every executable packet must state:

1. **Commit identity/message** — the intended coherent commit name.
2. **Goal** — the observable outcome, not only a file list.
3. **Verified starting state** — relevant repository facts observed directly.
4. **Prior correction status** — any carried follow-up or regression discovered from completed work.
5. **Assumptions** — only assumptions still necessary after inspection.
6. **Exact scope** — required behavior and boundaries.
7. **File-level plan** — expected additions/changes/removals reconciled to actual paths.
8. **Migration/contract impact** — data evolution, compatibility, and authoritative API changes.
9. **Acceptance criteria** — objectively checkable completion conditions.
10. **Verification commands/evidence** — proportionate to security, authorization, concurrency, time, and migration risk.
11. **Do-not-do boundaries** — later work and tempting unrelated changes explicitly excluded.

The packet should be precise about security/domain boundaries and observable behavior while leaving ordinary implementation mechanics to Codex where the governing documents do not lock them.

## 10.3 Implementation authority

For each packet, Codex is authorized to modify the working tree only.

Codex must **not**:

- create a Git commit;
- push a branch;
- open a pull request;
- implement the next packet;
- run destructive database/data commands against an unverified target;
- perform unrelated refactors;
- add optional infrastructure or speculative abstractions.

Commit, push, publication, external email delivery, and activation of real deployment routes require separate explicit authority where applicable.

## 10.4 Review and verdict

After implementation, inspect the actual working tree and direct evidence. Codex's summary is orientation, not proof.

Review at minimum:

- complete diff, diff stat, and untracked files;
- dependency and lockfile changes;
- Prisma schema and handwritten migration SQL;
- generated auth schema reconciliation;
- contracts and all callers;
- authorization order and negative-access tests;
- session/cookie/origin behavior;
- audit/idempotency/concurrency behavior;
- time-boundary/routing test evidence where relevant;
- runtime/browser/accessibility evidence;
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
- **REQUEST FIXES** — packet is not acceptable yet. The next issued packet corrects the same intended commit; nominal next-commit scope does not begin.
- **REJECT** — the approach materially violates the governing specifications, security/access boundary, data invariants, or commit scope and should be replaced rather than incrementally patched.

Corrections are never hidden inside unrelated work. A correction may lead the next nominal packet only after `APPROVE WITH SMALL FOLLOW-UP`; `REQUEST FIXES` and `REJECT` block progression.

## 10.5 Commit handoff

When a packet receives `APPROVE`, or `APPROVE WITH SMALL FOLLOW-UP` under the user's chosen workflow:

1. report the exact reviewed scope and evidence;
2. report any carried follow-up;
3. wait for explicit instruction before committing;
4. after any user-authorized commit, inspect the repository again before preparing the next packet.

Do not treat this guide as permission to implement all three commits in one working-tree change.

---

# 11. Decision rules for ambiguity during Phase 2

When the governing documents do not specify an implementation detail:

1. preserve one canonical identity and avoid synchronized duplicates;
2. deny access by default and add only the permission needed by a real action;
3. apply authorization scope before lookup/search whenever record existence is sensitive;
4. use Better Auth for credential/session/MFA primitives and application code for authorization;
5. use a relational/versioned model where historical meaning matters;
6. use the existing transaction, idempotency, audit, and error foundations rather than parallel mechanisms;
7. keep time calculations pure, backend-owned, and fixed-clock testable;
8. represent unavailable/not-active state honestly instead of seeding false clinical readiness;
9. choose the simplest official library-supported integration;
10. add an abstraction only for a locked correctness need or demonstrated second use;
11. record a material choice where later phases need to rely on it.

Pause and request direction only when the choice would materially change the locked authentication authority, access model, clinical/safety semantics, data history, deployment shape, or commit boundary.

---

# 12. Phase 2 non-goals and architectural guardrails

Throughout this phase:

- Better Auth authenticates; application code authorizes;
- one canonical backend remains authoritative;
- browser routing and hidden controls never substitute for permission checks;
- `packages/contracts` contains safe API projections, not Better Auth/Prisma internals;
- user, role, assignment, profile, schedule, and route history remain relational and auditable;
- missing profile/onboarding information remains unknown, not complete or safe;
- an unactivated schedule remains unactivated; no UI convenience may invent a current period;
- a validated route is not automatically a tested route;
- a tested route is not a safety severity or handoff;
- real-patient mode remains unavailable until every later readiness requirement is genuinely satisfied;
- the existing one-app/one-database deployment remains unchanged;
- no new service, framework, datastore, package, or abstraction is introduced without a concrete active-packet requirement.

Architectural simplicity is not permission to omit MFA readiness for privileged actors, session revocation, backend authorization, direct assignment scope, transactional audit, optimistic concurrency, idempotency, timezone correctness, or route versioning.

---

# 13. Phase completion handoff to Phase 3

Phase 2 hands Phase 3 an authenticated, authorized, versioned core platform—not a partially implemented safety system.

Phase 3 may rely on:

- canonical authenticated users and secure sessions;
- explicit roles, permissions, account state, and direct clinician-patient assignments;
- patient profiles, stable preference semantics, and stored monitoring timezone;
- one processing-lock row per patient;
- backend-only authorization and safe role-specific projections;
- reusable Patient, Clinician, and Admin shells;
- pure fixed-period scheduling and persisted schedule/period services;
- versioned regional route configuration and active-route resolution;
- transactional audit, idempotency, version-conflict, and step-up patterns;
- deterministic prototype accounts and access fixtures;
- expanded real-PostgreSQL, browser, accessibility, build, and CI validation.

Phase 3 must still inspect the actual repository before defining its first packet. It then owns:

- the safety evaluator/gate/cases and immediate patient routing behavior;
- the 28-day reduction baseline and proposed target;
- safety-gated recovery-goal and monitoring activation;
- completion of the full onboarding sequence.

Phase 2 must not pre-empt those behaviors through seeded active goals, fake passed safety results, active monitoring, safety-case placeholders, or patient-facing emergency instructions.
