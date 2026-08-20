# AUD Subjective Monitoring V1 — Phase 3 Safety, Onboarding, and Reduction Setup Implementation Guide

## Document status

**Status:** **COMPLETE**

**Phase:** 3 of 7

**Phase name:** Safety + Onboarding + Reduction Setup

**Delivery:** 4 primary feature commits plus bounded validation, schema, and UI-closure corrections

**Implementation mode:** Commit packet method

**Validated Phase 1 baseline:** `7a09757b89f1ed25fbc349bc269c217904d94c6e`

**Validated Phase 2 implementation baseline:** `3e31659` (`feat: add authoritative scheduling and regional routing`)

**Phase 2 documentation closeout:** `d6cb7d8` (`docs: update post Phase-2 completion`)

**Validated Phase 3 baseline:** `c7fd012` (`test: close phase 3 activation coverage and validation gaps`)

**Repository state at completion:** Clean `main` branch at the Phase 3 validation-closeout commit above

This document records the implementation boundary, delivered feature commits, validation-closeout corrections, and Phase 4 handoff for Phase 3. It is not a new product, clinical, UX, or architecture specification.

Authority remains:

1. `AUD_Subjective_Monitoring_Master_Specification_V1.md`
2. `AUD_V1_Web_Product_Surface_and_UX_Implementation_Lock.md`
3. `AUD_V1_Locked_Implementation_Architecture.md`
4. `AUD_V1_Phase_1_Foundation_Implementation_Guide.md` as the accepted foundation record
5. `AUD_V1_Phase_2_Identity_and_Core_Platform_Implementation_Guide.md` as the accepted Phase 2 record
6. this Phase 3 guide
7. later packet-specific instructions and implementation, provided they do not conflict with the sources above

If this guide appears to conflict with a governing document, the higher-authority document wins. Do not silently reinterpret a locked decision; record the conflict and correct the packet or this guide.

## Completion record

Phase 3 is implemented and accepted at `c7fd012`. The current codebase delivers:

- server-backed onboarding drafts, immutable submitted onboarding revisions, authoritative revision selection, and completion states (`INCOMPLETE`, `PENDING_SAFETY_REVIEW`, `SAFETY_HANDOFF`, and `COMPLETE`);
- deterministic, versioned safety evaluation with canonical precedence, persisted input/result provenance, safety cases, append-only restrictions/dispositions/lifecycle events, route resolution, and patient-safe safety projections;
- authorized clinician safety-case lifecycle and disposition routes plus admin operational-incident visibility;
- a 28-day local-calendar reduction baseline with explicit known-zero, known-quantity, and unknown days, 14g ethanol conversion provenance, derived metrics, audited correction revisions, and backend target validation;
- versioned `RecoveryGoalVersion` records and one transactional onboarding completion service that applies the safety outcome, creates or withholds the initial schedule, and records auditable completion state;
- patient onboarding, reduction setup, profile/status, patient safety-shell, clinician patient/safety, and admin safety surfaces wired to the current contracts and routes;
- prototype-only activation behavior while readiness continues to refuse `real_patient` operation.

The Phase 3 migration additions are, in order:

1. `20260819140000_onboarding_safety_foundation`
2. `20260820100000_safety_evaluation_context`
3. `20260820103000_safety_cases`
4. `20260820120000_reconcile_safety_case_lifecycle` — synchronizes the current lifecycle projection to the latest historical event without rewriting event history;
5. `20260820223000_reduction_baseline_goal_proposal`
6. `20260821003000_safety_gated_onboarding_activation`

The implemented Phase 3 HTTP surface is:

| Area | Endpoints |
|---|---|
| Patient onboarding | `GET /api/v1/patient/onboarding`, `PUT /api/v1/patient/onboarding/draft`, `POST /api/v1/patient/onboarding/submit`, `POST /api/v1/patient/onboarding/safety-evaluations`, `POST /api/v1/patient/onboarding/complete` |
| Patient reduction setup | `GET /api/v1/patient/reduction-setup`, `POST`/`PUT /api/v1/patient/reduction-setup/baseline-draft`, `POST /api/v1/patient/reduction-setup/baseline-confirm`, `POST /api/v1/patient/reduction-setup/baseline-correction`, and `POST /api/v1/patient/reduction-setup/target-proposal` |
| Patient safety | `GET /api/v1/patient/safety` |
| Clinician safety | Assigned-case list/detail plus `acknowledge`, `begin-review`, `establish-plan`, `disposition`, `escalate`, and `resolve-external-handoff` actions under `/api/v1/clinician/safety-cases/*` |
| Admin safety | Case list/detail routes under `/api/v1/admin/safety-cases/*`, including route-incident projections |

The current automated coverage is concentrated in `apps/backend/test/domain/safety-evaluator.test.ts`, `apps/backend/test/domain/reduction-domain.test.ts`, `apps/backend/test/integration/safety.test.ts`, `apps/backend/test/integration/onboarding-activation.test.ts`, the workspace/profile web tests, and `tests/e2e/access.spec.ts`. Activation-matrix scenarios are covered by backend integration tests; there is not a separate Playwright activation spec in the current tree.

---

# 1. Phase outcome

Phase 3 gives an authenticated patient the real V1 onboarding path, including safety-controlled setup and a reduction baseline when applicable, while the backend remains the sole authority for safety, activation, and scheduling decisions.

The phase provides:

- versioned onboarding drafts and immutable submitted onboarding response records;
- the required AUDIT-C and baseline drinking context with explicit missing/prefer-not-to-say semantics;
- draft recovery direction that is not treated as active until safety and setup requirements permit it;
- the complete V1 safety evaluator, precedence resolver, gate state, restrictions, safety cases, ownership, lifecycle, and authorized dispositions;
- immediate patient-safe safety routing through the already-versioned regional route service;
- a mandatory 28-day local-calendar reduction baseline with known-zero, known-quantity, and unknown states;
- standard-drink/ethanol conversion and immutable baseline metrics with audited correction boundaries;
- proposed reduction targets validated against the authoritative baseline;
- safety-gated goal activation and schedule activation using the Phase 2 service boundaries;
- complete onboarding state and patient-facing safety/activation experiences;
- separate prototype and real-patient behavior, with real-patient readiness still refused when later delivery, worker, content, backup, retention, and operational controls are absent;
- real-PostgreSQL, deterministic evaluator, concurrency, audit, migration, browser, accessibility, and production-build evidence.

This phase does not implement weekly assessments or subjective-monitoring evaluation. It prepares the authoritative patient/safety/goal/schedule state those later phases consume.

---

# 2. Actual Phase 2 baseline and carry-forward assessment

The Phase 3 implementation was based on direct inspection of the accepted Phase 2 repository, not only its guide. The following baseline describes the starting boundary at the time Phase 3 began.

## 2.1 Confirmed Phase 2 foundations to reuse

The repository already contains:

- Better Auth sessions, secure cookies, authentication routes, reset/verification capability, and two-factor support;
- application-owned account state, roles, permissions, direct clinician-patient assignments, privileged identity-verification provenance, and authorization-before-query patterns;
- patient profiles with IANA monitoring timezone, immutable preference versions, an onboarding-state foundation, and one processing-lock row per patient;
- Luxon/fixed-clock scheduling math, persisted schedule versions, scheduled periods, timezone-transition handling, delayed period provisioning, and reschedule audit;
- versioned regional routing profiles, route targets, test evidence, active-route resolution, region constraints, and permission/step-up/idempotency protection;
- shared Zod contracts, API projections, shells, confirmation patterns, readiness reporting, audit/idempotency/error infrastructure, seed fixtures, PostgreSQL migrations, Playwright, CI, Docker, and same-origin production serving.

The Phase 3 implementation extends these boundaries without creating a second identity, schedule, routing, locking, audit, or authorization mechanism.

## 2.2 Phase 2 drift and integration points addressed here

No unplanned service, datastore, framework, or conflicting architecture was found in the Phase 2 closeout. The following deliberate Phase 2 boundaries became the Phase 3 integration work and are now implemented:

1. **Onboarding was incomplete by design.** `PatientProfile` and preferences were foundations only. Phase 3 added the draft/submission lifecycle and required response fields without mutating Phase 2 preference history.
2. **No active goal or monitoring schedule existed.** Phase 2 schedule creation was a callable boundary; Phase 3 now calls it only after safety-gated activation.
3. **Regional routing existed but had no safety interpretation.** Phase 3 resolves route targets for the safety pathway and preserves unavailable-route behavior without hard-coded fallback numbers or routing-history rewrites.
4. **Readiness remains intentionally incomplete.** Phase 3 adds truthful safety/onboarding facts but does not claim complete real-patient readiness while worker, durable delivery, approved content, backup/restore, retention, and operational controls remain absent.
5. **Phase 2’s timezone corrections remain authoritative.** Onboarding baseline dates and safety “previous seven calendar days” calculations use the patient’s stored monitoring timezone and existing clock/time utilities, never server-local time.
6. **Phase 2’s audit/idempotency/lock patterns remain mandatory.** Goal activation, onboarding submission, safety disposition, baseline confirmation/correction, and route-mediated handoff actions use the existing transaction and patient-serialization patterns where applicable.
7. **Phase 2 seed data remains synthetic and pre-clinical.** Phase 3 adds explicit safety/onboarding fixtures only in prototype mode; existing users are not silently turned into real clinical patients.

These are integration requirements, not permission to reopen Phase 2 design decisions.

---

# 3. Phase scope

## 3.1 Included

Phase 3 includes only these capabilities:

1. **Onboarding draft and response foundation**
   - server-backed onboarding draft state that survives navigation/session interruption;
   - step/progress state owned by the backend;
   - required AUDIT-C responses and score;
   - drinking days per week, drinks per drinking day, heavy-drinking days in the configured recent window, last-drink response state;
   - draft recovery goal/direction;
   - mutual-help and spiritual-content preferences using canonical null semantics;
   - optional context fields only where the current onboarding UI actually collects them;
   - immutable submitted onboarding revisions and an authoritative revision pointer;
   - explicit provenance, actor, timestamps, configuration/instrument version, and correction boundaries;
   - onboarding remains incomplete until the safety/activation outcome is resolved.

2. **Safety evaluator and gate**
   - typed, versioned safety input contracts;
   - immediate emergency screen;
   - withdrawal-history and current-symptom screens;
   - C-SSRS Recent onboarding screen and explicit-disclosure path, using licensed/approved wording and provenance rather than inventing a questionnaire;
   - pregnancy, other-substance, sedative/opioid, serious-medical-context, and clinician-directed review inputs as applicable to the deployment;
   - pure deterministic predicates for S0, S1, S2, S3, and `S_NONE`;
   - exact `S0 > S1 > S2 > S3 > S_NONE` precedence;
   - `SafetyGateStatus`, allowed intervention list, prompt policy, goal-change permission, reassessment time, and route-resolution result;
   - safety input/result versioning and reproducible evaluation evidence.

3. **Safety cases and authorized lifecycle**
   - durable `SafetyCase` records with domain, severity, reasons, owner role, route/handoff data, gate/restrictions, lifecycle, and provenance;
   - detected, handoff, acknowledgement, review, plan, resolved, emergency escalation, and external-handoff lifecycle states defined by the Master Specification;
   - separate safety case namespace from subjective Levels 0–4;
   - one authoritative active safety state per patient/domain according to the defined invariant;
   - immediate synchronous S0/S1 patient-controlled response after the safety state commits;
   - authorized safety-owner disposition and restriction changes with step-up, optimistic version, idempotency, lock, audit, and route validation;
   - no self-service gate relaxation;
   - operational incident creation for unavailable/misconfigured safety routing where the current infrastructure can record it.

4. **28-day reduction baseline**
   - local-calendar grid for the preceding 28 consecutive days;
   - each day represented as `KNOWN_ZERO`, `KNOWN_QUANTITY`, or `UNKNOWN`;
   - standard-drink input decimal precision of one place;
   - conversion to 14g ethanol per standard drink with unit-policy provenance;
   - complete baseline requirement: all 28 days known;
   - immutable confirmed baseline except through an explicit audited correction workflow;
   - derived baseline metrics exactly as specified;
   - safe resume/draft persistence and visible unknown-versus-zero distinction;
   - no imputation or silent conversion of unknown values.

5. **Reduction target and goal activation**
   - proposed weekly target validated against the immutable baseline;
   - target must be greater than zero and less than baseline average weekly drinks;
   - target zero routes into abstinence rather than a reduction target;
   - zero baseline cannot create a reduction goal;
   - `ReductionGoalVersion` history with effective period, set-by, status, target, baseline reference, and provenance;
   - safety-gate outcome states: active, pending clinical safety review, suspended safety handoff, superseded/ended;
   - safety owner can activate/relax only through an authorized disposition when permitted;
   - no target or goal history is rewritten after activation.

6. **Safety-gated onboarding completion and schedule activation**
   - exact activation order: validate onboarding and baseline/target → evaluate safety → persist gate/case → resolve authorized route/presentation → activate goal if permitted → create initial schedule through Phase 2 service → mark onboarding complete;
   - `ALLOW_MONITORING` permits ordinary activation;
   - `ALLOW_WITH_HANDOFF` permits only backend-listed measurement/interventions and may activate a pending/limited state as specified;
   - `BLOCK_AND_HANDOFF` pauses ordinary prompts/goal activation and transfers control to the safety shell;
   - activation is transactional, idempotent, patient-serialized, and auditable;
   - retries return the original result and never duplicate goals, schedules, cases, or audit effects.

7. **Patient UX and clinician/admin safety surfaces**
   - guided multi-step onboarding using the existing shell/design system;
   - standard-drink education and reduction calendar/target screens;
   - safety shell for blocked/handoff states with route data resolved from the backend;
   - restricted/pending/review/complete/unknown/error/offline-safe states;
   - clinician/admin safety view with severity, reasons, owner, lifecycle, route/test status, and authorized disposition affordances;
   - patients never see raw S0–S3 codes, internal predicates, risk scores, or clinician tiers;
   - route failure remains safety-controlled and is not presented as ordinary submission failure.

8. **Testing and development data**
   - pure table-driven safety predicate tests at every boundary and precedence combination;
   - real-PostgreSQL integration tests for immutable revisions, safety cases, goal activation, baseline constraints, transactions, locks, idempotency, and audit;
   - fixed-clock/timezone tests for 28 local-calendar days and activation period boundaries;
   - Playwright coverage for complete onboarding, reduction baseline, U1/target contradictions where applicable, safety states, and restricted access;
   - deterministic synthetic safety scenarios that remain prototype-only;
   - updated CI/README and truthful readiness output.

## 3.2 Explicitly excluded

The following belong to later phases and must not be implemented in Phase 3:

- weekly `AUD_WEEKLY_CHECKIN` screens or assessment draft/submission/revision/backfill lifecycle;
- subjective-monitoring evaluator, current flags, aggregates, interactions, persistence, recurrence, clearance, or recomputation;
- patient support/content repository/resolution/delivery;
- clinician Level-2/Level-3 monitoring views, clinical reason states, clinical review cases, or durable clinician tasks except the safety-case surface required here;
- engagement reminders, missed-check-in state, technical-failure timing, or pg-boss workers;
- general email/notification queues or ordinary safety auxiliary delivery workers;
- autonomous treatment, diagnosis, withdrawal management, medication decisions, detox instructions, or emergency treatment;
- suicide-risk inference from weekly negative mood;
- full CI production readiness, backup/restore, retention/deletion, approved content coverage, or authorization for real patients;
- daily/EMA monitoring;
- automatic event reconciliation or use-event creation from weekly onboarding answers;
- speculative generic questionnaire engines, form builders, state-machine frameworks, or workflow orchestration platforms.

The implemented safety and onboarding state machines remain explicit module-local transitions, not a generic workflow platform.

---

# 4. Locked decisions realized by Phase 3

| Concern | Phase 3 decision |
|---|---|
| Safety owner | Safety subsystem owns safety; monitoring/goal code consumes gate and restrictions |
| Evaluation | Pure deterministic functions with explicit input, clock, policy/configuration version, reasons, and output |
| Precedence | `S0 > S1 > S2 > S3 > S_NONE` |
| Gate | `ALLOW_MONITORING`, `ALLOW_WITH_HANDOFF`, `BLOCK_AND_HANDOFF`, `NOT_ASSESSED` |
| Missingness | `UNKNOWN` remains unknown; never impute zero, abstinence, safety, or stability |
| Safety namespace | S0–S3 separate from subjective monitoring Levels 0–4 |
| Safety routing | Resolve already-configured regional route profile; never hard-code a universal emergency number |
| Patient control | No patient action can relax a safety gate or create active monitoring without backend authorization |
| Onboarding | Server-backed draft, immutable submitted revisions, one authoritative revision |
| Recovery goal | Draft before safety; versioned activation at a period boundary; no historical reinterpretation |
| Reduction baseline | 28 consecutive local-calendar days; all known before confirmation; immutable except audited correction |
| Standard drink | 14g ethanol policy version; one-decimal input precision |
| Target | `0` becomes abstinence; positive target must be below baseline average weekly drinks |
| Activation transaction | Safety result/case/gate, goal state, initial schedule, audit, and idempotency result commit atomically where the transition applies |
| Time | UTC persistence; stored IANA timezone; existing Luxon and injectable clock utilities |
| Concurrency | Existing patient processing lock before ordered patient state mutations |
| Client authority | UI collects/renders; backend validates, evaluates, activates, and resolves routes |
| Real-patient mode | Remains refused until later delivery, worker, content, backup, retention, and operational requirements are present |

## 4.1 Specification traceability

| Phase 3 concern | Governing source |
|---|---|
| Onboarding ownership and response semantics | Master Specification §§7, 23, 26; UX Implementation Lock §8 |
| Safety predicates, gate, lifecycle, and response targets | Master Specification §8 and §§23–24; UX Implementation Lock §9; Locked Implementation Architecture §§19.5, 31, 164–165 |
| Routing and immediate response | Master Specification §§8.11–8.15; Phase 2 routing implementation; UX Implementation Lock §§9.3–9.7 |
| Reduction baseline, target, and goal activation | Master Specification §16; UX Implementation Lock §11 |
| Scheduling activation and local dates | Master Specification §6; Phase 2 scheduling implementation |
| Audit, idempotency, serialization, and versions | Master Specification §§23, 29; Locked Implementation Architecture §§26–28, 37–45 |
| Patient/admin/clinician surfaces and accessibility | UX Implementation Lock §§8–9, 24, 26, 28–43 |
| Minimal infrastructure and Codex boundaries | Locked Implementation Architecture §§20–21, 99–117, 165–177 |

These references constrain Phase 3. They do not authorize Phase 4 weekly assessment or monitoring behavior.

---

# 5. Delivered commit record

| Commit | Primary commit | Coherent result |
|---|---|---|
| 1 | `e916f76` — `feat: establish onboarding drafts and deterministic safety evaluation` | Versioned onboarding inputs, pure safety evaluator/gate, safety contracts, and unit/integration foundation |
| 2 | `13fd026` — `feat: add safety cases and controlled patient handoff` | Durable safety cases, route-mediated synchronous safety response, owner lifecycle/dispositions, and safety-controlled UX; completed through subsequent safety-invariant and surface corrections |
| 3 | `12bd5af` — `feat: implement the reduction baseline and goal proposal` | 28-day calendar/baseline, standard-drink metrics, proposed target validation, and reduction setup UX |
| 4 | `db9aa75` — `feat: complete safety-gated onboarding and activation` | Transactional onboarding completion, goal/schedule activation, final role surfaces, and Phase 4 handoff |

The primary feature boundaries were delivered as planned. Bounded corrections were completed in `37100a6`, `457b3a9`, `4e76d76`, `f17deae`, and `c7fd012`; they closed safety transaction invariants, migration/schema alignment, patient/role surfaces, activation coverage, and validation gaps without introducing a fifth product scope.

Sections 6–9 retain the original packet definitions as a historical scope record. They describe the constraints used during implementation, not pending work.

---

# 6. Original Commit 1 packet definition

## Commit identity

```text
feat: establish onboarding drafts and deterministic safety evaluation
```

## Goal

Create the authoritative, versioned inputs and pure deterministic evaluator needed for onboarding safety decisions. This commit must make safety results reproducible and testable without yet creating active safety cases, patient handoff state, goals, schedules, or real-patient activation.

## Assumptions to verify before implementation

- Phase 2 is accepted at the inspected baseline and the working tree is clean.
- Existing `PatientProfile`, preference versions, schedule/routing services, clock, authz, audit, idempotency, and patient lock patterns remain available.
- The deployment’s approved C-SSRS wording/licensing/provenance is available or can be represented as versioned configuration without inventing content.
- Safety routing profiles may be absent in prototype/demo environments; evaluator output must remain explicit about unavailable delivery.
- No weekly assessment or monitoring evaluator has been added outside Phase 3.

## Exact scope

1. Add versioned onboarding draft/submission schema and migration. Keep raw response values, response-state semantics, instrument/version identifiers, draft step, authoritative revision, actor, timestamps, and provenance explicit.
2. Model required onboarding fields from the Master Specification, including AUDIT-C, drinking descriptors, last-drink response, draft recovery direction, preferences, and safety-triggering context. Do not silently collapse `UNKNOWN`, `UNSURE`, and `PREFER_NOT_TO_SAY`.
3. Add versioned safety input/result configuration structures and shared contracts for predicates, reasons, severity, gate, restrictions, owner role, and route-resolution inputs.
4. Implement pure evaluator functions for:
   - immediate emergency conditions;
   - withdrawal history/recent reduction/current symptom rules;
   - C-SSRS result interpretation as provided by the approved instrument contract;
   - pregnancy/current-use routing;
   - other-substance and medical context;
   - S0/S1/S2/S3/S_NONE precedence;
   - gate and default restriction output.
5. Evaluators receive all data and a fixed clock/context; they do not query Prisma, resolve routes, send messages, or mutate cases.
6. Add draft save/read/update endpoints with patient ownership and server-side validation. Draft changes must be safe to resume after session interruption and must not create safety cases or active goals.
7. Add a backend safety-evaluation action that validates a complete required safety input set, persists an immutable safety evaluation result/provenance, and returns the result for the next commit’s case/handoff service. It may store `NOT_ASSESSED`/draft state but must not activate monitoring.
8. Add table-driven unit tests for exact thresholds, unknown handling, hallucination/disorientation distinction, C-SSRS item precedence, risk-factor combinations, pregnancy and substance rules, and safety precedence.
9. Add real-PostgreSQL tests for draft ownership, immutable submitted safety input/result records, authoritative revision identity, idempotency, patient serialization, and audit.
10. Add the first guided onboarding screens for account/profile context, AUDIT-C/baseline context, draft recovery direction, preferences, and safety inputs. Use existing forms/shells; keep safety result presentation limited until Commit 2 implements the full handoff experience.
11. Extend contracts/API error vocabulary and readiness with truthful onboarding/safety-schema status. Do not report safety delivery or real-patient readiness as ready merely because tables exist.

## Expected file-level changes

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase_3_onboarding_safety_inputs>/migration.sql
apps/backend/src/modules/onboarding/*
apps/backend/src/modules/safety/domain/*
apps/backend/src/modules/safety/contracts.ts
apps/backend/src/modules/safety/service.ts       # pure evaluation orchestration only
apps/backend/src/shared/clock/*                  # extend existing utilities only
apps/backend/src/shared/errors/*
apps/backend/test/domain/safety*.test.ts
apps/backend/test/integration/onboarding*.test.ts
apps/backend/test/integration/safety-input*.test.ts

packages/contracts/src/onboarding/*
packages/contracts/src/safety/*
packages/contracts/src/index.ts

apps/web/src/features/patient/onboarding/*
apps/web/src/features/patient/safety/*           # input states only in this commit
apps/web/src/**/*.test.tsx
tests/e2e/onboarding-draft*.spec.ts
```

## Acceptance criteria

1. Onboarding drafts are server-backed, resumable, patient-scoped, and not confused with submitted authoritative revisions.
2. Raw values preserve the exact response-state semantics required by the Master Specification; missing/unknown/prefer-not-to-say values are never imputed.
3. Submitted onboarding/safety input and evaluation records are immutable; corrections create a new revision rather than overwrite history.
4. Safety evaluator functions are pure, deterministic, fixed-clock testable, and independent of Prisma, HTTP, route resolution, or email.
5. Exact S0/S1/S2/S3 predicates and precedence are covered by boundary tests, including hallucinations with versus without disorientation.
6. Weekly negative mood is not used as suicide-risk input; only the approved C-SSRS contract and explicit disclosure paths may create that safety signal.
7. Evaluation produces canonical severity, gate, allowed interventions, prompt policy, goal-change permission, owner role, reassessment timing, reasons, and version provenance.
8. Draft/evaluation actions do not create active goals, schedules, assessments, safety cases, handoff delivery, or patient monitoring.
9. API authorization, idempotency, patient locks, audit, and safe errors reuse Phase 2 mechanisms.
10. The onboarding UI resumes safely and exposes plain-language progress without exposing evaluator codes or scores to patients.
11. Existing Phase 1–2 migrations, builds, tests, and accessibility checks remain structurally compatible.

## Do not do

- Do not create `SafetyCase` lifecycle mutations yet; Commit 2 owns them.
- Do not activate goals, monitoring schedules, or real-patient operation.
- Do not implement the weekly questionnaire or subjective evaluator.
- Do not infer suicide risk from `negative_mood`.
- Do not use a generic questionnaire/workflow engine.
- Do not put evaluator logic in React or shared browser code.
- Do not call routing providers or hard-code emergency instructions.
- Do not add treatment, detoxification, medication, diagnosis, CIWA-Ar, or emergency-treatment advice.

## Evidence required for review

- current Phase 2 tree/migrations inspected before work;
- migration and raw response/revision schema review;
- pure evaluator table tests and fixed-clock evidence;
- PostgreSQL draft/revision/idempotency/audit tests;
- onboarding draft/resume browser evidence;
- direct proof no goal/schedule/case/assessment is created;
- contract/error/readiness diff review and `git diff --check`.

---

# 7. Original Commit 2 packet definition

## Commit identity

```text
feat: add safety cases and controlled patient handoff
```

## Goal

Turn the deterministic safety result into a durable, auditable safety state with immediate patient-safe routing and authorized owner lifecycle actions. This commit establishes safety precedence in the product without activating monitoring or reduction goals.

## Assumptions to verify before implementation

- Commit 1 is approved and the safety evaluator/result contract is authoritative.
- Phase 2 regional routing resolver and route evidence lifecycle are unchanged and available.
- The current worker/delivery infrastructure does not exist; S0/S1 patient response must be synchronous after commit, while auxiliary delivery remains an explicit unavailable/deferred state.
- Safety-owner permissions and privileged identity-verification/step-up helpers are available.

## Exact scope

1. Add durable `SafetyCase`, safety evaluation/result, restriction, disposition, and lifecycle history tables as required by the canonical structures.
2. Implement case creation/update transactionally from a committed safety evaluation, preserving severity even when route delivery is unavailable.
3. Enforce safety precedence and one active safety-controlled state per patient/domain without collapsing separate safety domains or overwriting history.
4. Implement synchronous safety response behavior:
   - persist result/case/gate/restrictions;
   - resolve the configured regional route profile;
   - record route availability/provenance;
   - commit audit/idempotency;
   - return the patient-safe safety-controlled projection immediately;
   - never wait on email, pg-boss, or ordinary clinician delivery.
5. Implement owner lifecycle actions: acknowledge, begin handoff/review, establish plan, resolve, escalate external emergency handoff, and apply structured dispositions. Only authorized safety owners may relax S0/S1/S2 restrictions.
6. Require fresh/step-up session, expected case version, idempotency key, patient lock where patient state changes, transactional audit, and safe error mapping for consequential dispositions.
7. Implement route-unavailable/failed state as an operational incident and keep the patient safety-controlled. Do not downgrade severity or return to ordinary monitoring.
8. Add patient-safe safety projection and UI:
   - `ALLOW_MONITORING` normal state;
   - `ALLOW_WITH_HANDOFF` restricted state honoring allowed interventions/prompt/goal-change flags;
   - `BLOCK_AND_HANDOFF` dedicated safety shell with configured primary/fallback routes only;
   - handoff lifecycle and resolution states;
   - no raw severity code for patients.
9. Add clinician/admin safety views with severity, reasons, owner, lifecycle, route status, and authorized disposition controls. Keep this separate from future subjective review queues.
10. Add integration/browser tests for S0/S1 synchronous response, route unavailable behavior, owner authorization, stale/idempotent disposition, safety precedence, patient shell replacement, and no self-service gate relaxation.

## Expected file-level changes

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase_3_safety_cases>/migration.sql
apps/backend/src/modules/safety/*
apps/backend/src/modules/operations/*             # incident creation only
apps/backend/src/modules/routing/*                # resolver integration only
apps/backend/src/shared/authz/*
apps/backend/test/integration/safety-case*.test.ts
apps/backend/test/integration/safety-disposition*.test.ts

packages/contracts/src/safety/*
packages/contracts/src/clinician/safety*.ts
packages/contracts/src/admin/safety*.ts

apps/web/src/features/patient/safety/*
apps/web/src/features/clinician/safety/*
apps/web/src/features/admin/safety/*
apps/web/src/app/shells/*                         # safety precedence integration
tests/e2e/safety-flow*.spec.ts
```

## Acceptance criteria

1. Safety severity and gate are persisted before any patient-safe response is returned.
2. S0/S1 response is synchronous and does not depend on absent workers/email; route failure creates operational state without changing severity.
3. `S0 > S1 > S2 > S3 > S_NONE` is enforced when multiple domains/triggers are present.
4. Safety cases have durable lifecycle/history and remain distinct from subjective Levels 0–4, clinical cases, and engagement cases.
5. Only authorized safety owners with required fresh/step-up session can relax S0/S1/S2 restrictions.
6. Dispositions are optimistic-version checked, idempotent, patient-serialized where needed, audited, and safe on retries.
7. `BLOCK_AND_HANDOFF` pauses ordinary patient actions; `ALLOW_WITH_HANDOFF` honors every backend restriction; no client-only clearing exists.
8. Patient-facing routes resolve from the active regional profile and never contain hard-coded universal emergency numbers.
9. Clinician/admin views may show operational severity and reasons; patient views do not expose internal codes or clinical tiers.
10. Safety delivery/route failure does not cause resubmission, downgrade, or return to normal monitoring.

## Do not do

- Do not add pg-boss, clinician notification delivery, or generic outbound notification infrastructure.
- Do not create weekly assessment or monitoring cases.
- Do not let route availability determine clinical severity.
- Do not expose C-SSRS raw answers or sensitive safety details in email/logs/browser URLs.
- Do not let a patient dismiss, resolve, or relax a safety gate locally.
- Do not use safety status as a generic application error.

## Evidence required for review

- migration and lifecycle state inspection;
- S0/S1 synchronous response timing/path evidence;
- route unavailable incident evidence;
- owner authorization/step-up/version/idempotency tests;
- browser safety-shell screenshots and accessibility evidence;
- direct source check for no hard-coded emergency route;
- complete diff and packet-boundary review.

---

# 8. Original Commit 3 packet definition

## Commit identity

```text
feat: implement the reduction baseline and goal proposal
```

## Goal

Implement the complete reduction setup required before a reduction goal can be considered for safety review: standard-drink education, 28-day local-calendar baseline, exact derived metrics, immutable baseline provenance, and validated proposed target. This commit creates proposals, not active reduction monitoring.

## Assumptions to verify before implementation

- Safety cases/gate projection from Commit 2 is available, but target proposal must remain safe while activation is deferred to Commit 4.
- Patient monitoring timezone and Phase 2 clock/scheduling services are authoritative.
- No weekly consumption calendar or assessment model exists yet.
- Decimal precision and 14g unit policy remain exactly those in the Master Specification.

## Exact scope

1. Add baseline day records and baseline/revision tables with patient, local date, status, quantity, ethanol grams, source, unit policy, actor, timestamps, and provenance.
2. Enforce one baseline day per patient/date and complete 28-day contiguous local-date window. Unknown blocks confirmation; known zero is a real observation.
3. Implement pure standard-drink/ethanol and baseline metric functions for all specified metrics, including heavy-drinking-day thresholds using the configured sex-profile threshold and explicit missingness.
4. Implement save/resume baseline draft and confirm/submit action with expected version, idempotency, patient lock, immutable confirmed revision, and audit.
5. Implement audited baseline correction only as a versioned correction path; do not mutate the authoritative confirmed baseline in place.
6. Add standard-drink education and a constrained assistive calculator whose output is provenance-bearing and never becomes a second clinical policy source.
7. Add proposed weekly target validation:
   - positive target only;
   - target below authoritative baseline average weekly drinks;
   - zero target routes to abstinence proposal;
   - zero baseline cannot produce reduction;
   - target status remains proposal/pending until Commit 4 safety-gated activation.
8. Add contracts and patient UX showing 28 days, coverage, unknowns, metrics, target validation errors, draft/proposed/pending states, and no false claim that the goal is active.
9. Add tests for decimal boundaries, exact 28-day windows, DST/local-date behavior, unknown handling, heavy-day thresholds, zero baseline, target boundaries, correction immutability, and concurrent confirmation.

## Expected file-level changes

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase_3_reduction_baseline>/migration.sql
apps/backend/src/modules/consumption/*
apps/backend/src/modules/reduction/*                # may remain consumption-owned
apps/backend/test/domain/reduction*.test.ts
apps/backend/test/integration/reduction-baseline*.test.ts

packages/contracts/src/reduction/*
packages/contracts/src/patient/reduction*.ts
packages/contracts/src/index.ts

apps/web/src/features/patient/onboarding/reduction/*
apps/web/src/features/patient/reduction/*
apps/web/src/components/patterns/*                  # only demonstrated reuse
tests/e2e/reduction-baseline*.spec.ts
```

## Acceptance criteria

1. Baseline uses the patient’s local calendar and exactly 28 consecutive days.
2. Every day is visibly `KNOWN_ZERO`, `KNOWN_QUANTITY`, or `UNKNOWN`; unknown is never rendered as zero.
3. Confirmation is blocked unless all 28 days are known.
4. Standard-drink conversion uses 14g ethanol and one-decimal input policy with persisted provenance.
5. Baseline metrics match the Master Specification and never impute missing values.
6. Confirmed baseline is immutable except through an audited correction revision.
7. Proposed target validation rejects zero as reduction, rejects targets not below baseline average, and rejects reduction when baseline average is zero.
8. A target proposal cannot activate a goal, schedule, monitoring, safety case, or weekly calendar in this commit.
9. Drafts survive navigation/session interruption and are backend-authoritative.
10. Baseline/target mutations are version-checked, idempotent, patient-serialized, audited, and safe under concurrent attempts.
11. Patient UX clearly distinguishes education, draft, incomplete, proposed, pending-review, and active (not yet available) states.

## Do not do

- Do not calculate target validity solely in React.
- Do not create a weekly consumption calendar for active monitoring.
- Do not create a reduction goal version as active.
- Do not silently reinterpret U1; weekly U1 belongs to Phase 4 assessment/reduction integration.
- Do not add WHO-RDL weekly history beyond baseline data required here.
- Do not add treatment recommendations or self-directed major-reduction advice.

## Evidence required for review

- local-date/DST fixed-clock test matrix;
- baseline schema constraints and immutability evidence;
- exact metric/threshold tests;
- concurrent confirmation/correction/idempotency tests;
- browser baseline screenshots and unknown-versus-zero evidence;
- proof no active goal/schedule/assessment is created;
- complete diff and migration review.

---

# 9. Original Commit 4 packet definition

## Commit identity

```text
feat: complete safety-gated onboarding and activation
```

## Goal

Join the completed onboarding, safety, reduction proposal, and Phase 2 scheduling foundations into one authoritative activation transaction and finish the Phase 3 patient setup experience. This is the only Phase 3 commit allowed to create an active recovery goal or monitoring schedule, and only when the exact safety gate permits it.

## Assumptions to verify before implementation

- Commits 1–3 are approved in the actual repository.
- Safety evaluation/cases, route resolution, baseline/target proposal, patient locks, idempotency, audit, profile, and schedule services are available.
- No Phase 4 assessment/monitoring code has been introduced.
- Real-patient readiness remains blocked by later operational requirements.

## Exact scope

1. Implement one onboarding completion/application service that validates the current authoritative onboarding revision, baseline/target requirements, profile preferences, and safety result.
2. Implement the exact activation matrix:
   - `ALLOW_MONITORING`: activate permitted goal/monitoring and create the initial schedule at the next complete local Monday boundary;
   - `ALLOW_WITH_HANDOFF`: persist pending/restricted goal state and only activate measurement/schedule behavior permitted by the safety disposition; never tell the patient an unapproved target is active;
   - `BLOCK_AND_HANDOFF`: persist suspended/not-active state, keep safety case/handoff authoritative, pause ordinary prompts, and do not create active monitoring;
   - `NOT_ASSESSED`: reject completion safely.
3. For `ABSTINENCE`, require the appropriate safety evaluation before activation and create a versioned goal effective from the scheduled period boundary.
4. For `REDUCTION`, require complete immutable baseline and valid proposed target, evaluate `PLANNED_MAJOR_REDUCTION` exactly, and activate/pause/pending according to the safety disposition.
5. For `UNSURE`, persist the draft/complete onboarding outcome without inventing an active abstinence or reduction goal; expose the backend-authorized next step.
6. In one transaction, where applicable, persist activation result, goal version/status, schedule creation through the Phase 2 service, onboarding completion, safety linkage, audit, and idempotency response. Do not hold a transaction while calling email/external services.
7. Ensure retries and concurrent completion requests serialize on the patient lock and cannot duplicate goals, schedule periods, cases, audit, or route effects.
8. Add authorized clinician/safety-owner completion/disposition paths needed to move pending/restricted goals to active or resolved states. Patient cannot self-relax a gate.
9. Finish patient onboarding/home/profile setup state and safety-controlled shell transitions. Show clear plain-language setup statuses and preserve unknown/missing provenance.
10. Add clinician/admin read projections for onboarding status, safety state, proposed/active goal state, baseline completeness, and route availability without exposing unnecessary raw sensitive answers.
11. Add deterministic prototype scenarios for:
    - ordinary abstinence activation;
    - reduction pending safety review;
    - blocked S0/S1 handoff;
    - S2 restricted continuation;
    - incomplete/unknown baseline;
    - `UNSURE` goal;
    - unavailable route/operational incident.
12. Update readiness/README/CI descriptions to reflect Phase 3 capabilities while clearly refusing real-patient activation until later requirements are implemented.
13. Add end-to-end tests for the activation matrix, retries, stale revisions, route unavailable, access boundaries, safety precedence, baseline/target requirements, and no premature weekly assessment.

## Expected file-level changes

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase_3_activation_and_onboarding_completion>/migration.sql
apps/backend/src/modules/onboarding/*
apps/backend/src/modules/safety/*
apps/backend/src/modules/consumption/*
apps/backend/src/modules/profiles/*
apps/backend/src/modules/scheduling/*             # call existing service; avoid rewrite
apps/backend/src/routes/health.ts
apps/backend/src/shared/authz/*
apps/backend/src/shared/errors/*
apps/backend/prisma/seed.ts
apps/backend/test/integration/onboarding-activation*.test.ts
apps/backend/test/integration/safety-activation*.test.ts

packages/contracts/src/onboarding/*
packages/contracts/src/safety/*
packages/contracts/src/reduction/*
packages/contracts/src/patient/*

apps/web/src/features/patient/onboarding/*
apps/web/src/features/patient/safety/*
apps/web/src/features/patient/profile/*
apps/web/src/features/clinician/safety/*
apps/web/src/features/admin/safety/*
apps/web/src/app/shells/*
tests/e2e/onboarding-complete*.spec.ts
tests/e2e/safety-activation*.spec.ts
```

## Acceptance criteria

1. Onboarding completion is backend-authoritative, idempotent, patient-serialized, version-checked, and transactionally audited.
2. No activation occurs without the required authoritative onboarding revision and safety result.
3. `ALLOW_MONITORING`, `ALLOW_WITH_HANDOFF`, `BLOCK_AND_HANDOFF`, and `NOT_ASSESSED` produce exactly the permitted activation/pause/restriction behavior.
4. `REDUCTION` cannot activate without all 28 known baseline days and a valid positive target below baseline average.
5. Target zero becomes an abstinence proposal and follows abstinence safety rules.
6. `UNSURE` never becomes an invented active goal.
7. Active goal versions and schedules begin at correct period boundaries and never reinterpret prior records.
8. Safety cases/gates remain authoritative after activation; route failure never downgrades safety or causes duplicate submission.
9. Patient safety shell precedence prevents ordinary prompts/support/goal actions when blocked and honors restrictions when allowed with handoff.
10. Authorized owner transitions are fresh/step-up protected, versioned, idempotent, serialized, and audited.
11. Seed scenarios are deterministic, synthetic, and prototype-only; real-patient mode remains refused by missing later readiness controls.
12. Phase 1–2 behavior remains green and no Phase 4 weekly assessment is created or implied.

## Do not do

- Do not implement weekly check-ins, assessment identity, or monitoring evaluator.
- Do not make route testing, email delivery, or seed data imply real-patient authorization.
- Do not activate a goal from the browser or from a stale onboarding draft.
- Do not bypass safety because a patient has completed baseline/target setup.
- Do not send external safety email synchronously or add worker infrastructure.
- Do not turn onboarding into a generic configurable workflow engine.
- Do not expose raw safety answers, C-SSRS details, or internal clinical codes to patients.

## Evidence required for review

- activation transaction and lock/idempotency/audit inspection;
- full activation-matrix integration tests;
- concurrent completion/retry evidence;
- schedule/goal effective-boundary evidence;
- route-unavailable and safety-shell browser evidence;
- prototype seed scenarios and real-patient readiness refusal;
- final CI-equivalent validation, build/Docker/same-origin smoke, accessibility, `git diff --check`, and complete diff review.

---

# 10. Phase-wide acceptance record

The following criteria were used for Phase 3 closeout. The current implementation at `c7fd012` is the accepted result:

1. All four commit scopes have been implemented and individually reviewed through the packet method.
2. Onboarding drafts and submitted revisions are server-backed, immutable/versioned, auditable, resumable, and patient-scoped.
3. Required onboarding fields, AUDIT-C/context, preferences, and null semantics match the Master Specification without imputation.
4. Safety evaluation is pure, deterministic, versioned, fixed-clock testable, and exact at every S0–S3 boundary.
5. Safety precedence is `S0 > S1 > S2 > S3 > S_NONE`; safety is separate from monitoring Levels 0–4.
6. Durable safety cases and authorized lifecycle/disposition behavior exist with synchronous S0/S1 patient response and route-failure preservation.
7. `BLOCK_AND_HANDOFF` and `ALLOW_WITH_HANDOFF` control patient presentation according to backend restrictions; no self-service gate relaxation exists.
8. Regional route resolution uses Phase 2 versioned profiles and never hard-codes emergency routes.
9. Reduction baseline requires 28 consecutive known local-calendar days, distinguishes unknown from zero, preserves 14g policy provenance, and supports audited correction only.
10. Baseline metrics and target validation match exact V1 rules, including zero-target and zero-baseline behavior.
11. Goal versions are safety-gated, period-effective, immutable in history, and never activate from stale/replayed requests.
12. Initial schedule creation is called through the Phase 2 service only after activation eligibility and remains timezone/DST-correct.
13. `ALLOW_MONITORING`, `ALLOW_WITH_HANDOFF`, `BLOCK_AND_HANDOFF`, and `UNSURE` outcomes are represented accurately in backend and patient UI.
14. Patient, clinician, and admin safety/onboarding surfaces are polished, accessible, role-scoped, and free of raw internal codes in patient views.
15. Patient locks, idempotency, optimistic versions, audit, and safe errors protect all consequential setup/safety transitions.
16. Prototype fixtures cover ordinary, restricted, blocked, incomplete, unknown, pending, and unavailable-route states without real-person data.
17. No weekly assessment, subjective monitoring, content, engagement, worker, or later-phase system has been pre-built.
18. Real-PostgreSQL migrations/tests, pure evaluator tests, browser/accessibility tests, production build, Docker image, and same-origin smoke remain green.
19. Readiness remains truthful and refuses real-patient activation until later delivery, workers, content, backups, retention, and operational requirements exist.
20. Documentation and CI describe Phase 3 accurately while preserving the accepted Phase 1 and Phase 2 records.

Phase 3 was not accepted merely because an onboarding form rendered or a safety score was computed. The closeout covered reproducible safety decisions, durable controlled handoff, complete reduction setup, correct activation transactions, and honest patient state together.

---

# 11. Commit packet operating method (historical)

The four definitions above were phase-level packet templates. The process below records the method used during Phase 3 and is retained for auditability; it is not an instruction to implement another Phase 3 packet.

## 11.1 Before issuing a packet

Inspect the actual repository, never only the previous summary:

```text
git status --short --branch
git diff --stat
git diff
git log --oneline --decorate -n <reasonable count>
current Prisma schema and every migration
current Phase 1/2 modules, contracts, routes, tests, CI, README
current seed/config/readiness behavior
prior packet verdict and unresolved corrections
```

For safety or clinical wording, verify the exact current governing document section, approved instrument/version/provenance, and route configuration contract before implementation.

## 11.2 Required packet contents

Every executable packet must state:

1. **Commit identity/message**.
2. **Goal**.
3. **Verified starting state**.
4. **Prior correction status**.
5. **Assumptions**.
6. **Exact scope**.
7. **File-level plan**.
8. **Migration and contract impact**.
9. **Acceptance criteria**.
10. **Verification commands/evidence** proportionate to clinical, safety, migration, concurrency, and security risk.
11. **Do-not-do boundaries**.

The packet should be specific about invariants and observable behavior while leaving ordinary implementation mechanics to Codex where the governing documents do not decide them.

## 11.3 Implementation authority

Codex may modify the working tree only for the active packet and should commit the completed packet locally using the specified message.

Codex must not:

- push;
- implement the next packet;
- implement Phase 4 or later behavior;
- run destructive database/data commands against an unverified target;
- alter accepted Phase 1/2 foundations without a concrete active-packet reason;
- add speculative infrastructure or unrelated refactors.

## 11.4 Review and verdict

Review the actual diff and evidence, not Codex’s summary. Inspect schema/migrations, evaluator purity, safety precedence, input provenance, route resolution, activation transactions, locks/idempotency/audit, UI state precedence, sensitive logging, and all packet boundaries.

Every review ends with exactly one verdict:

```text
APPROVE
APPROVE WITH SMALL FOLLOW-UP
REQUEST FIXES
REJECT
```

`APPROVE WITH SMALL FOLLOW-UP` carries a small correction into the next coherent packet. `REQUEST FIXES` blocks progression until the same packet is corrected. `REJECT` replaces the approach. Corrections are never hidden inside unrelated work.

## 11.5 Commit handoff

After approval:

1. report the reviewed scope and evidence;
2. report any follow-up;
3. wait for explicit user instruction before pushing;
4. inspect the repository again before preparing the next packet.

Do not implement all four commits in one working-tree change.

---

# 12. Decision rules for ambiguity during Phase 3

When the governing documents do not specify an implementation detail:

1. reuse Phase 2 identity, authz, route, schedule, lock, audit, idempotency, error, contract, and UI patterns;
2. keep safety evaluation pure and orchestration explicit;
3. preserve all missing/unknown/prefer-not-to-say states;
4. deny activation by default when required evidence is missing;
5. separate safety severity, gate, route availability, and delivery status;
6. apply patient serialization before ordered state changes;
7. version instead of overwriting historical onboarding, safety, baseline, goal, or route facts;
8. use the simplest relational model that proves the invariant;
9. add a framework/abstraction only for a concrete correctness requirement or demonstrated reuse;
10. record material implementation choices for Phase 4 consumers.

Pause and request direction only when the decision would change a locked safety predicate, instrument contract, activation meaning, data invariant, deployment shape, or phase boundary.

---

# 13. Phase 3 non-goals and architectural guardrails

Throughout this phase:

- safety owns safety;
- patients cannot self-clear safety or activate monitoring;
- the backend owns all activation and route decisions;
- the browser never computes authoritative safety, baseline, target, or period state;
- raw safety answers and sensitive details are not logged or placed in email/URLs;
- safety route availability never changes severity;
- onboarding completion does not imply clinical readiness;
- a proposed target is not an active reduction goal;
- `UNSURE` is a legitimate unresolved direction, not an implicit abstinence/reduction choice;
- unknown baseline days remain unknown;
- Phase 2 schedule/routing histories remain authoritative and are not rewritten;
- one application, one PostgreSQL database, and existing migrations remain the deployment shape;
- no worker/broker/cache/extra database/generic workflow engine is introduced.

Required complexity must remain: deterministic safety rules, immutable revisions, safety lifecycle, patient locks, idempotency, audit, version conflicts, route provenance, and exact local-calendar calculations.

---

# 14. Phase completion handoff to Phase 4

Phase 3 now hands Phase 4 an activated-or-controlled patient platform with reproducible safety and reduction setup—not a weekly monitoring engine.

Phase 4 may rely on:

- authoritative onboarding revisions and provenance;
- persisted safety results, gates, restrictions, cases, route resolution, and owner dispositions;
- complete/incomplete reduction baselines, immutable metrics, target proposals, and active goal versions where permitted;
- active or intentionally non-active schedule periods from the Phase 2 scheduling service;
- patient locks, idempotency, audit, version-conflict, and safe error patterns;
- role-scoped patient/clinician/admin projections and safety-controlled shell precedence;
- deterministic synthetic safety/goal scenarios and real-PostgreSQL/browser test fixtures.

Phase 4 owns:

- the `AUD_WEEKLY_CHECKIN` instrument and 11-item assessment lifecycle;
- draft/partial/complete/late/backfill/revision/correction behavior;
- deterministic monitoring evaluator, longitudinal state, recurrence, recomputation, serialization, and effect planning;
- assessment-driven consumption calendar integration for active reduction goals.

Phase 3 did not pre-implement those behaviors through weekly prompts, assessment tables, monitoring evaluators, or synthetic “current” assessment results.
