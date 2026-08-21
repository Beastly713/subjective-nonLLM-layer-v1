# AUD Subjective Monitoring V1 — Phase 4 Weekly Monitoring Core Implementation Guide

## Document status

**Status:** **COMPLETE**

**Phase:** 4 of 7

**Phase name:** Weekly Monitoring Core

**Delivery:** 3 primary implementation commits plus bounded correction, validation, and closeout commits

**Implementation mode:** Commit packet method

**Validated Phase 1 implementation baseline:** `7a09757b89f1ed25fbc349bc269c217904d94c6e`

**Validated Phase 2 implementation baseline:** `3e31659` (`feat: add authoritative scheduling and regional routing`)

**Phase 2 documentation closeout:** `d6cb7d8` (`docs: update post Phase-2 completion`)

**Validated Phase 3 implementation baseline:** `c7fd012` (`test: close phase 3 activation coverage and validation gaps`)

**Current repository/documentation baseline inspected for this guide:** `6fc3303` (`docs: update post Phase-3 completion`)

**Validated Phase 4 closeout head:** `a16c1bd` (`closing: Phase-4`)

**Phase 4 implementation commits:** `80bc59c`, `326dbcf`, and `4ff6961`

**Phase 4 correction/validation commits:** `989b30b`, `4a76ac4`, `3a5f0ba`, and `a16c1bd`

The packet sections below are retained as the historical Phase 4 planning and review record. Statements describing the pre-Phase-4 tree, planned file paths, or packet-local exclusions refer to that earlier boundary; the completion record below describes the repository as it exists now.

This document defined the implementation boundary and three-commit execution plan for Phase 4 and now records the accepted result. It is an execution guide and completion record, not a new product, clinical, UX, or architecture specification.

Authority remains:

1. `AUD_Subjective_Monitoring_Master_Specification_V1.md`
2. `AUD_V1_Web_Product_Surface_and_UX_Implementation_Lock.md`
3. `AUD_V1_Locked_Implementation_Architecture.md`
4. `AUD_V1_Phase_3_Safety_Onboarding_and_Reduction_Setup_Implementation_Guide.md` as the accepted Phase 3 record and handoff
5. this Phase 4 guide
6. packet-specific implementation instructions, provided they do not conflict with the sources above

If this guide appears to conflict with a governing document, the higher-authority document wins. Do not silently reinterpret a locked clinical, safety, historical, scheduling, or data-ownership decision. Record the conflict and correct the active packet or this guide before continuing.

## Completion record

Phase 4 is implemented and accepted at the closeout head above. The current codebase delivers:

- the versioned `AUD_WEEKLY_CHECKIN` 1.0 instrument with eleven canonical items and backend-owned wording/scale provenance;
- one logical weekly assessment per patient, scheduled period, instrument, and version, with optimistic server-backed drafts;
- immutable `PARTIAL`/`COMPLETE` revisions, current/late/historical classification, patient correction, assigned-clinician correction, and patient-safe history projections;
- backend-authoritative Monday-to-Monday recall periods, period-effective recovery-goal and preference context, and backend-supplied REDUCTION calendar dates;
- authoritative weekly REDUCTION observations with known-zero, known-quantity, and unknown states, 14g policy provenance, target context, and U1/calendar contradiction protection;
- the pure, deterministic `subjective_monitoring_v1` evaluator with item flags, aggregate context, longitudinal persistence/clearance, abstinence recurrence, candidate patient intervention intents, and candidate clinician reason families;
- immutable evaluation history, weekly U1 interval observations, current-state projections, forward recomputation from historical changes, superseded/revoked history, and trigger-derived effect scopes;
- patient-level processing locks, optimistic version checks, idempotent consequential actions, transactional audit, and provenance across assessment mutations;
- patient Check-in, history, correction, and historical-backfill flows with accessible 0–7 controls and narrow-layout coverage;
- a Phase 4 boundary that deliberately stops before patient content resolution, clinician review-case lifecycle, engagement workflow, durable workers, or pg-boss. Phase 5 now consumes the persisted Phase 4 outputs for governed patient support, clinical review, and durable in-app clinician tasks; engagement, auxiliary delivery, and background workers remain later-phase work.

The Phase 4 migration additions are, in order:

1. `20260821100000_weekly_assessment_foundation`
2. `20260821130000_weekly_monitoring_evaluation`
3. `20260821150000_weekly_monitoring_recompute_history`
4. `20260821203000_phase4_closeout_recurrence_observation`

The implemented Phase 4 HTTP surface is:

| Area | Endpoints |
|---|---|
| Patient Check-in | `POST /api/v1/patient/check-in/start`, `GET /api/v1/patient/check-in/history`, `GET /api/v1/patient/assessments/:assessmentId`, and `POST /api/v1/patient/check-in/backfill/:periodId/start` |
| Patient assessment mutations | `PUT /api/v1/patient/assessments/:assessmentId/draft`, `POST /api/v1/patient/assessments/:assessmentId/submit`, `POST /api/v1/patient/assessments/:assessmentId/backfill-submit`, and `POST /api/v1/patient/assessments/:assessmentId/corrections` |
| Assigned-clinician correction | `POST /api/v1/clinician/patients/:patientId/assessments/:assessmentId/corrections` |

Phase 4 validation is represented by the focused domain tests, real-PostgreSQL integration test, web scale test, browser Check-in suite, and committed database invariant query in `validation/phase4_invariants.sql`. Phase 5 closeout validation is recorded in the Phase 5 guide and `validation/phase5_invariants.sql`. The root CI path also runs formatting, lint, typecheck, migration deployment, web/backend tests, production build, Chromium smoke/accessibility coverage, and the Docker build.

---

# 1. Phase outcome

At the end of Phase 4, an activated patient has the real V1 weekly subjective-monitoring core rather than only an onboarding/safety platform.

The completed phase provides:

- the fixed `AUD_WEEKLY_CHECKIN` version `1.0` instrument exactly as defined by the Master Specification;
- one logical weekly assessment per patient, scheduled period, instrument, and instrument version;
- backend-authoritative scheduled-period identity and recall windows;
- server-backed assessment drafts that survive refresh, sign-out/sign-in, and later client reuse;
- explicit `DRAFT`, submitted `PARTIAL`, and submitted `COMPLETE` semantics;
- immutable submitted assessment revisions with one authoritative revision pointer;
- current, late, historical-backfill, patient-correction, and authorized staff-correction semantics without overwriting history;
- the seven-day weekly alcohol-consumption calendar when the recovery goal effective for that period is `REDUCTION`;
- exact U1/calendar consistency checks;
- a pure, deterministic, versioned weekly monitoring evaluator;
- current-state flags, aggregate risk/protection context, preference-compatible protection interpretation, interactions, longitudinal deltas, persistence, clearance state, abstinence-only recurrence, and reduction-target context;
- candidate patient intervention intents and candidate clinician reason families, without yet implementing content selection, clinician review cases, or delivery;
- period-aware recovery-goal and preference resolution so historical assessments are interpreted using the state that applied to their own period;
- a canonical evaluation-trigger/effect-plan boundary for current submission, current patient correction, staff correction, historical backfill, administrative recomputation, and future policy migration;
- forward recomputation from a corrected or newly backfilled historical period while preserving superseded/revoked history;
- patient-level serialization, optimistic version checks, idempotency, transactional audit, and immutable provenance across consequential assessment mutations;
- a polished patient Check-in experience for current, late, partial, historical, and correction states;
- a stable backend foundation that later content, clinical, engagement, delivery, and worker phases can consume without reimplementing weekly interpretation.

Phase 4 does **not** turn candidate clinician reasons into `ClinicalReviewCase` records, select or deliver patient content, create durable clinician tasks, run missed-check-in engagement workflows, or introduce background workers. Phase 5 now consumes the authoritative outputs created here for governed support, clinical review, and durable in-app clinician tasks; engagement and background delivery remain later systems.

The governing implementation principle for this phase is:

> **Persist the patient’s authoritative weekly observation and its deterministic interpretation completely, but stop before later-phase content, clinical-case, engagement, and delivery side effects.**

---

# 2. Actual Phase 1–3 baseline and carry-forward work

Phase 4 planning was based on direct inspection of the current repository, current Prisma schema, current backend and frontend module trees, current contracts, recent Phase 3 commits, and the governing documents. It must not assume that the original Phase 1–3 plans are identical to the exact implementation that now exists.

## 2.1 Confirmed foundations available for reuse

The current repository already provides the following foundations and Phase 4 must extend them rather than replace them.

### Repository/runtime

- one pnpm workspace monorepo;
- `apps/web`, `apps/backend`, and `packages/contracts`;
- Node.js 24 LTS;
- strict TypeScript/ESM;
- React/Vite frontend;
- Fastify backend;
- PostgreSQL 17;
- Prisma 7 with `@prisma/adapter-pg`;
- one backend process and one primary database;
- no Redis, RabbitMQ, Kafka, secondary datastore, microservice boundary, or worker service.

### Identity and authorization

- Better Auth database-backed sessions;
- application-owned account state;
- role, permission, workspace, and scope resolution;
- direct clinician-patient assignments;
- patient own-record scope;
- assigned-patient clinician scope;
- privileged identity/MFA readiness behavior;
- backend-owned authorization rather than route hiding.

### Shared mutation protections

The repository already contains and uses:

- `idempotency_records`;
- `patient_processing_locks`;
- append-only `audit_events`;
- `operational_incidents`;
- `requireIdempotencyKey(...)`;
- `executeIdempotently(...)`;
- `lockPatientForProcessing(...)`;
- safe domain errors and request IDs.

Phase 4 must reuse these mechanisms. It must not create a second idempotency table, a second patient mutex mechanism, or an assessment-specific audit framework.

### Scheduling

The scheduling subsystem already provides:

- stored IANA monitoring timezone;
- UTC persisted period boundaries;
- Luxon-based period calculations;
- injected `Clock`;
- Monday 00:00 local period start;
- next Monday 00:00 local period end;
- `open_at = period_end`;
- original and effective due times;
- versioned schedule transitions;
- immutable started-period timezone/schedule ownership;
- `createInitialScheduleInTransaction(...)`;
- `provisionNextPeriodInTransaction(...)`;
- `ensureGoalActivationPeriodInTransaction(...)`;
- pending timezone transition support.

Weekly assessment code must consume `ScheduledPeriod`; it must not calculate a second “week” from browser time or submission time.

### Phase 3 onboarding, safety, and activation

The current implementation provides:

- server-backed onboarding drafts;
- immutable onboarding revisions;
- authoritative onboarding revision selection;
- deterministic safety evaluation;
- persisted safety evaluation provenance;
- safety cases, restrictions, dispositions, and lifecycle history;
- patient-safe safety projections;
- safety-controlled patient shell behavior;
- route availability/provenance;
- 28-day reduction baseline and target proposal;
- versioned `RecoveryGoalVersion`;
- safety-gated activation;
- creation of the initial monitoring schedule when permitted.

Phase 4 begins **after** this activation boundary. It must not re-run onboarding policy as a substitute for weekly evaluation.

### Current patient-visible surface at the Phase 4 planning boundary

At the `6fc3303` planning boundary, the patient frontend had:

- onboarding;
- reduction setup;
- profile/status;
- safety-controlled states.

It did **not** yet have:

- Home;
- Check-in;
- Progress;
- Support.

Phase 4 added the **Check-in**, Check-in history, correction, and historical-backfill surfaces required for the weekly core. Full Home, Progress, and Support remain later product work.

### Backend module tree at the Phase 4 planning boundary

At the Phase 4 planning boundary, the backend had modules for:

```text
consumption
identity
onboarding
profiles
routing
safety
scheduling
```

There was not yet:

```text
assessments
monitoring
clinical
content
engagement
delivery
workers
```

Phase 4 added only `assessments` and `monitoring` (plus the bounded Check-in integration in `consumption`, `profiles`, `scheduling`, and `safety`). The later `clinical`, `content`, `engagement`, `delivery`, and `workers` modules remain intentionally absent. The planning-boundary tree was a clean starting point; no broad reorganization was needed.

---

## 2.2 Phase 1–3 drift and implementation realities Phase 4 must consciously absorb

The current codebase does not contain problematic architecture sprawl, but several implementation realities matter to Phase 4 and must be handled explicitly.

### 1. Phase 3 deliberately did not prebuild weekly monitoring

At the Phase 4 planning boundary, no assessment tables, weekly assessment routes, monitoring evaluator, monitoring seed results, clinician subjective cases, or patient support resolver were present.

This means Phase 4 owns the weekly core cleanly. Do not assume placeholder assessment data exists.

### 2. Safety uses both immutable history and a current projection

Phase 3 added safety lifecycle history and later reconciled the current safety-case lifecycle projection to that history without deleting the historical events.

Phase 4 should use the same general persistence philosophy:

```text
immutable/versioned history
+
current query projection
```

Do not turn weekly monitoring into event sourcing, but do not overwrite historical derived decisions merely because a correction changes the current interpretation.

### 3. `OperationalIncident` exists without a general `operations` module

Safety currently records/reads operational incidents without introducing a broad operations subsystem.

Phase 4 must not “fix” this by creating an unrelated operations refactor. Operational ownership can remain where it currently is until a later operations phase requires a dedicated module.

### 4. The current idempotency helper is already the platform contract

`executeIdempotently(...)` uses a canonical payload hash, an advisory transaction lock, the shared `idempotency_records` table, and stored response snapshots.

Phase 4 consequential HTTP actions must use this path. Do not add assessment-specific replay tokens or local browser deduplication as the authoritative safeguard.

The weekly pure evaluator must still receive explicit time/context and must not use `Date.now()` itself.

### 5. The patient processing lock is already the ordering boundary

`lockPatientForProcessing(...)` performs the required `SELECT ... FOR UPDATE` over `patient_processing_locks`.

Every ordered weekly state mutation must use it before loading the history that drives:

- deltas;
- streaks;
- clearance;
- recurrence;
- authoritative revision changes;
- current projections;
- recomputation.

Do not substitute optimistic revision checks for patient serialization.

### 6. Period provisioning currently has no background worker

Phase 2/3 created the scheduling service, but there is no pg-boss scheduler yet.

Phase 4 therefore cannot assume that a future worker has already materialized every period needed by the Check-in page. The assessment application service must reuse the existing scheduling service through a **bounded synchronous materialization seam** when a valid active schedule needs the next period.

This is not permission to:

- create a server-local timer;
- add pg-boss in Phase 4;
- calculate periods in the browser;
- create arbitrary historical weeks.

Only the existing schedule history and scheduling rules may create a new persisted period.

### 7. Recovery-goal interpretation must be period-aware

Phase 3 stores versioned recovery goals with `effectiveFromPeriodId`.

Weekly evaluation must resolve the recovery goal that applied to the assessment’s scheduled period. It must not simply load the newest current goal and use it for historical assessment interpretation.

This matters for:

- P1 wording;
- whether a seven-day consumption calendar is required;
- whether abstinence recurrence runs;
- reduction target context;
- historical correction/backfill.

A later goal change must never reinterpret earlier periods.

### 8. Preference interpretation must also be period-aware

`ProfilePreferenceVersion` is already versioned, but existing read paths generally expose the latest preference version.

The Master Specification states that recovery goal and stable preferences remain versioned and historical periods use the state that applied at their boundary.

Phase 4 therefore needs one canonical `resolvePreferencesForPeriod(...)` behavior rather than “latest preference wins.”

The current data can support this without inventing another profile system:

- onboarding/pre-activation preference versions exist before the first monitoring period;
- later preference versions have a creation time;
- the evaluator should use the newest preference version recorded no later than the relevant period boundary;
- a mid-period preference change therefore affects the next period’s interpretation, not the already-started period;
- historical recomputation uses the same resolver.

If implementation proves that an explicit effective-period reference is required to make this unambiguous, add the smallest versioned relational field needed. Do not introduce a generic temporal-profile framework.

### 9. Existing reduction arithmetic must be reused

`apps/backend/src/modules/consumption/reduction-domain.ts` already owns:

- 14g ethanol standard-drink policy;
- one-decimal standard-drink precision;
- heavy-day threshold selection;
- heavy-week threshold selection;
- standard-drink to ethanol conversion.

The Phase 4 weekly calendar and summary must reuse or extend this domain code. Do not duplicate conversion constants or heavy-drinking thresholds inside `monitoring` or React.

### 10. Safety gate state is already a backend projection

`loadPatientSafetyProjection(...)` already resolves:

- whether a safety shell is required;
- monitoring prompt `CONTINUE` versus `PAUSE`;
- allowed subjective intervention classes;
- goal-change permission;
- reassessment timing;
- current route/handoff state.

Phase 4 must consume this projection rather than reinterpret raw safety cases.

Rules:

- `ALLOW_MONITORING` permits ordinary weekly collection;
- `ALLOW_WITH_HANDOFF` permits collection only according to its current prompt/restriction state;
- `BLOCK_AND_HANDOFF`/prompt pause must not expose an ordinary actionable Check-in;
- safety suppression changes delivery/effect planning, not the underlying stored patient observation;
- weekly `negative_mood` must never become a suicide-risk input.

### 11. Scheduled safety reassessment is not currently a weekly-monitoring implementation

The Master Specification includes routine/after-positive safety rescreen semantics. Phase 3 built the safety evaluator and reassessment metadata but the current public patient safety-evaluation path is tied to the Phase 3 onboarding/activation flow.

Phase 4 must not silently treat a stale/due safety state as equivalent to `ALLOW_MONITORING`.

The Check-in read/write boundary must consume the authoritative current safety projection and respect `reassessmentDueAt`/prompt policy. If the current safety subsystem indicates that reassessment is required before ordinary collection, Phase 4 must return a dedicated backend-owned safety-reassessment-required state rather than bypass it.

A broad scheduled-rescreen worker, 30-day scheduler, or new safety operations platform is **not** added here. If a minimal reusable patient safety-evaluation route is required to make the existing safety evaluator usable after onboarding, add it as a bounded integration of the current safety module rather than redesigning safety.

### 12. Patient default navigation at the Phase 4 planning boundary

At the Phase 4 planning boundary, the Patient shell exposed Setup and Profile, and the root patient destination remained Profile.

Phase 4 added polished Check-in and History destinations without fabricating Home, Progress, Support, or clinician review screens merely to match future navigation diagrams.

### 13. Planning documentation state before Phase 4 implementation

At the Phase 4 planning boundary, `6fc3303` was the documentation-only closeout on top of the accepted Phase 3 code baseline `c7fd012`.

The Phase 4 packets treated `c7fd012` as the accepted implementation baseline and `6fc3303` as the repository/documentation head. That closeout added no weekly feature; the subsequent Phase 4 commits now provide the weekly implementation recorded above.

---

## 2.3 Carry-forward rule

When the current repository differs in a small implementation detail from the original Phase 1–3 plan, Phase 4 follows this order:

1. preserve the higher-authority Master Specification;
2. preserve the locked UX and implementation architecture;
3. preserve accepted Phase 1–3 behavior that is compatible with those documents;
4. integrate with the actual current code path instead of reimplementing the originally imagined path;
5. correct a prior-phase gap inside Phase 4 only when the weekly core genuinely depends on that correction;
6. do not reopen accepted work for cosmetic consistency.

The point is to build Phase 4 **on the product that actually exists**.

---

# 3. Phase scope

## 3.1 Included

Phase 4 includes only the weekly monitoring core and the minimum integration needed to make that core correct.

### 1. Canonical weekly instrument and policy registry

Implement the exact V1 instrument:

```text
AUD_WEEKLY_CHECKIN
version 1.0
```

Required items:

```text
U1
R1
R2
R3
R4
R5
P1
P2
P3
P4
P5
```

The backend policy registry owns:

- canonical item IDs and keys;
- item scale/type;
- direction;
- wording/anchor version;
- required-item set;
- V1 thresholds;
- interaction whitelist;
- persistence/clearance constants;
- recurrence constants;
- reduction policy references;
- rule-set version `subjective_monitoring_v1`.

Do not scatter thresholds through handlers or React.

### 2. Logical assessment identity and server-backed draft

Implement one logical assessment per:

```text
patient
+
scheduled period
+
instrument
+
instrument version
```

A draft:

- is backend-owned;
- is mutable until submitted;
- has an optimistic draft version;
- survives browser/session interruption;
- preserves unanswered items as unanswered;
- may contain a partially entered reduction calendar where applicable;
- never creates a second logical assessment for the same identity.

### 3. Submitted PARTIAL and COMPLETE revisions

Implement:

```text
DRAFT
PARTIAL
COMPLETE
```

A submitted `PARTIAL` is a real immutable submitted revision, not a draft.

A submitted `COMPLETE` requires all eleven required items.

Every submitted revision stores:

- assessment identity;
- revision number;
- source draft version where applicable;
- answers;
- submitted time;
- submitting actor/type;
- superseded revision reference;
- instrument/rule/configuration provenance;
- authoritative status through the logical assessment pointer;
- late/backfill classification.

### 4. Fixed period and recall semantics

The assessment always refers to the persisted `ScheduledPeriod`.

The backend owns:

- period start;
- period end;
- open time;
- due time;
- monitoring timezone;
- schedule version;
- late/backfill classification.

Submission time never changes the recall interval.

Early final submission remains prohibited.

### 5. Period-effective recovery goal and preferences

Evaluation uses the recovery goal and stable preferences that apply to that period.

This controls:

- P1 wording/context;
- abstinence recurrence eligibility;
- reduction calendar requirement;
- target/baseline context;
- protection applicability.

Historical correction/backfill must use historical context, not today’s newest settings.

### 6. Weekly REDUCTION calendar

For a period whose effective goal is `REDUCTION`, support seven daily observations covering the period’s local calendar dates.

Each day preserves:

```text
KNOWN_ZERO
KNOWN_QUANTITY
UNKNOWN
```

Final submission enforces the U1/calendar consistency rules.

The weekly consumption subsystem computes the V1 summary and target context from authoritative daily observations.

### 7. Pure deterministic weekly evaluator

Implement pure functions for:

- weekly alcohol status;
- item-level current flags;
- complete-assessment risk score;
- raw protection score;
- recovery progress;
- preference-compatible protection bounds and tags;
- whitelisted interactions;
- item-specific deltas;
- persistence activation;
- clearance counters/state inputs;
- abstinence-only consecutive-use and four-period recurrence;
- use-after-observed-stability context;
- reduction summary/target status;
- candidate patient intervention intents;
- candidate clinician reason families;
- deterministic effect-plan inputs.

The evaluator:

- receives all required state explicitly;
- does not query Prisma;
- does not use HTTP;
- does not call safety/routing/email services;
- does not use `Date.now()` directly;
- does not write database rows;
- does not create clinical cases or content deliveries.

### 8. Historical and current derived persistence

Persist the relational history/current projection families required by the locked architecture, including the applicable subset of:

```text
assessment_evaluations
state_flag_observations
current_state_flags
aggregate_context_records
longitudinal_feature_records
patient_intervention_intents
use_observation_ledger
alcohol_consumption_days
weekly_consumption_summaries
```

The exact columns may be reconciled to the actual Prisma schema, but the ownership and historical semantics are fixed.

### 9. Evaluation trigger and effect planning

Use the canonical trigger vocabulary:

```text
CURRENT_PATIENT_SUBMISSION
CURRENT_PATIENT_CORRECTION
STAFF_CORRECTION
HISTORICAL_BACKFILL
POLICY_MIGRATION
ADMINISTRATIVE_RECOMPUTE
```

Phase 4 needs the first four as executable behavior and must model the latter two without inventing effects.

Evaluation produces two conceptual outputs:

```text
DerivedStateChanges
EffectPlan
```

The caller does not pass an arbitrary `suppressNotifications` boolean.

Effect policy derives from:

- trigger;
- current/historical status;
- safety gate/restrictions;
- authoritative period/revision;
- missingness;
- period-effective goal/preferences.

Phase 4 persists candidate/suppressed effects. It does not deliver content or clinician tasks.

### 10. Corrections, backfill, and forward recomputation

Implement one canonical service:

```text
recomputePatientMonitoringFromPeriod(patientId, periodId, authoritativeTrigger)
```

It must:

- hold the patient processing lock;
- load authoritative weekly history from the changed period forward;
- preserve missing-period adjacency semantics;
- re-evaluate affected authoritative revisions chronologically;
- preserve superseded/revoked derived history;
- rebuild the current projection;
- update recurrence/persistence/clearance state deterministically;
- avoid duplicate candidate side effects;
- apply trigger-specific effect suppression.

### 11. Use-observation ledger integration

Persist U1 as a weekly interval observation.

Persist weekly daily quantities as consumption observations.

Do not turn a weekly Boolean into a confirmed event or timestamped episode.

### 12. Patient Check-in UX

Add the patient Check-in route and flow described by the UX lock:

```text
Alcohol use
→ Challenges
→ Recovery/support
→ Review
→ Submit
```

The UI must support:

- upcoming/not-open state;
- open/current state;
- saved draft;
- PARTIAL submission;
- COMPLETE submission;
- late current submission;
- historical backfill;
- correction/revision;
- REDUCTION seven-day calendar;
- U1/calendar conflict correction;
- safety-controlled unavailable/paused state;
- neutral successful completion without exposing internal flags/scores/tiers.

The browser renders backend-provided period, goal, safety, completion, and historical state. It does not derive them independently.

### 13. Assessment authorization

Add the smallest explicit permissions necessary for:

- patient assessment read;
- patient assessment draft/update/submit/correct;
- assigned-clinician read/correction only if the staff correction endpoint is implemented in Commit 3.

Do not grant Admin blanket clinical access merely because Admin exists.

---

## 3.2 Explicitly excluded

The following remain outside Phase 4:

- approved content resource storage/governance;
- content eligibility filtering and deterministic resource rotation;
- patient content body rendering/delivery;
- cooldown/refusal resource workflows except candidate intent data needed by later phases;
- Level-2 clinician visibility persistence if it requires the later clinical projection subsystem;
- `clinical_reason_states`;
- `clinical_reason_history`;
- `clinical_review_cases`;
- clinician subjective Review Queue;
- case acknowledgement/resolution for subjective monitoring;
- durable `ClinicianTask`;
- notification broker;
- email/push delivery;
- pg-boss;
- worker registration;
- period-provisioning schedules;
- engagement state;
- missed-check-in reminders;
- engagement cases;
- technical-failure timing;
- Admin Operations expansion;
- full Patient Home;
- Patient Progress;
- Patient Support library;
- broad Clinician Overview/trajectory UI;
- automatic use-event creation or candidate event linking;
- EMA/daily subjective monitoring;
- predictive ML, Bayesian inference, or opaque risk scoring;
- automatic Level-4 subjective escalation;
- treatment, diagnosis, detoxification, medication, or emergency-treatment instructions;
- broad real-patient readiness, backups, retention/deletion, or approval to process real-patient data.

The monitoring evaluator may emit **candidate** clinician reason families and patient intervention classes because later phases need them. It must not cross the boundary into case/content/delivery ownership.

---

# 4. Locked decisions Phase 4 must realize

| Concern | Phase 4 decision |
|---|---|
| Instrument | `AUD_WEEKLY_CHECKIN` version `1.0`; exactly eleven canonical items |
| Instrument claim | Custom A-CHESS/BAM-informed check-in; never claim exact BAM/A-CHESS administration |
| Assessment identity | One logical assessment per patient + scheduled period + instrument + version |
| Period authority | Persisted `ScheduledPeriod`; browser/submission time never defines the recall week |
| Opening | Final submission cannot occur before `open_at` |
| Draft | Server-backed mutable draft with optimistic version |
| Submitted record | Immutable revision; no edit-in-place |
| Completeness | `PARTIAL` may omit required items; `COMPLETE` requires all eleven |
| Missingness | Missing remains `UNKNOWN`; no zero/non-use/stability imputation |
| Late submission | Late current when no newer authoritative period is already submitted |
| Backfill | Historical when a newer authoritative weekly period already exists |
| Correction | New immutable revision of the same logical assessment |
| Authoritative revision | Exactly one pointer per logical assessment |
| Goal semantics | Resolve the goal version effective for the assessment period |
| Preference semantics | Resolve stable preference version as of the period boundary; never use “latest” blindly |
| Reduction calendar | Required only for period-effective `REDUCTION` |
| Standard drink | Reuse 14g/unit policy and one-decimal input from current consumption domain |
| U1/calendar | Contradictions block final submission; never silently choose one source |
| Evaluator | Pure, deterministic, explicit input, versioned output |
| Rule set | `subjective_monitoring_v1` |
| High craving | `R3 >= 6` |
| High negative mood | `R2 >= 6` |
| High risky situations | `R4 >= 6` |
| High relationship problems | `R5 >= 6` |
| Low confidence | `P1 <= 2` |
| Low social support | `P5 <= 2` |
| High risk | complete risk score `>= 25` |
| Protection | raw score retained; operational interpretation uses preference-compatible bounds |
| Interactions | Only the Master Specification whitelist |
| Delta | Only consecutive valid observations for the same item |
| Persistence | `N_PERSIST = 2`; missing resets activation streak |
| Clearance | `N_CLEAR = 2`; missing pauses clearance count |
| Recurrence | Only `ABSTINENCE`; current positive required |
| Rolling recurrence | Current + previous 3 periods; positive count `>= 2` |
| Stability context | Previous 12 periods explicitly negative |
| Reduction target | Consumption-only result never creates Level 3 |
| Patient intents | Persist candidate classes/reasons; do not select content resources |
| Clinical reasons | Persist candidate evaluation output; do not create clinical cases |
| Safety | Existing safety subsystem owns gate/restrictions; monitoring consumes them |
| Negative mood | Never becomes suicide-risk inference |
| Use observation | U1 is an interval observation, not an event |
| Historical state | Preserve old derived records; supersede/revoke rather than delete |
| Recompute | Forward from changed historical period under one patient lock |
| Serialization | Existing `patient_processing_locks` row first |
| Idempotency | Existing `executeIdempotently(...)`/`idempotency_records` |
| Audit | Same transaction as authoritative state transition |
| Frontend authority | Collect/render only; backend owns periods, status, scoring, classification, recomputation |
| Infrastructure | No worker/broker/cache/new datastore |
| Real-patient mode | Remains refused |

## 4.1 Specification traceability

| Phase 4 concern | Governing source |
|---|---|
| Weekly schedule and assessment identity | Master Specification §6 |
| Weekly questionnaire and wording | Master Specification §9 |
| Draft/PARTIAL/COMPLETE, revisions, late/backfill/corrections | Master Specification §10 |
| Risk/protection aggregates | Master Specification §11 |
| Current-state flags | Master Specification §12 |
| Interaction whitelist | Master Specification §13 |
| Longitudinal delta/persistence/clearance | Master Specification §14 |
| Abstinence recurrence | Master Specification §15 |
| REDUCTION weekly calendar and target metrics | Master Specification §16 |
| Use-observation separation | Master Specification §22 |
| Data ownership and historical provenance | Master Specification §§23–24 |
| V1 configuration constants | Master Specification §25 |
| Canonical assessment/consumption structures | Master Specification §26 |
| Disabled logic/invariants | Master Specification §27 |
| Versioning/audit | Master Specification §29 |
| Check-in UX, draft, late/backfill/correction | UX Implementation Lock §10 |
| Reduction weekly UX | UX Implementation Lock §11 |
| Patient completion language | UX Implementation Lock §12 |
| Backend module ownership | Locked Implementation Architecture §§18–21 |
| Assessment persistence | Locked Implementation Architecture §§24–27 |
| Ordered patient mutation | Locked Implementation Architecture §27 and §§43–45 |
| Recompute/effect planning | Locked Implementation Architecture §53 |
| Phase 3 handoff | Phase 3 Implementation Guide §14 |

These references constrain Phase 4. They do not authorize later content, clinical-case, engagement, delivery, or worker systems.

---

# 5. Three-commit plan

| Commit | Identity | Coherent result |
|---|---|---|
| 1 | `feat: establish weekly assessment drafts and period context` | Canonical weekly instrument/policy, logical assessment identity, server-backed drafts, period-effective context, REDUCTION draft calendar, and patient Check-in entry/resume surface |
| 2 | `feat: submit and evaluate weekly subjective monitoring` | Immutable PARTIAL/COMPLETE submission, weekly consumption persistence, pure deterministic evaluator, current/longitudinal/recurrence derived state, candidate effects, and neutral post-submit UX |
| 3 | `feat: add assessment backfill corrections and recomputation` | Historical backfill, patient/staff correction revisions, canonical forward recomputation/effect policy, superseded/revoked derived history, and patient revision/history workflow |

There is **no planned fourth Phase 4 implementation commit**.

If a packet has a defect, remain on that packet until it is accepted. Do not hide a correction in the next nominal commit and do not create a validation-only fourth commit merely to preserve chronology.

---

# 6. Commit 1 packet definition

## Commit identity

```text
feat: establish weekly assessment drafts and period context
```

## Goal

Create the authoritative weekly assessment identity, exact V1 instrument/policy foundation, server-backed draft lifecycle, period-effective context resolution, and patient Check-in entry/resume experience without yet allowing an authoritative submitted weekly evaluation.

This commit should make the patient’s weekly input safely resumable and correctly bound to a scheduled period, recovery goal, stable preferences, and safety state.

## Assumptions to verify before implementation

- At Commit 1 start, `main` reflected the inspected Phase 3 implementation plus documentation closeout.
- At Commit 1 start, no assessment or monitoring module had been added.
- Phase 3 `RecoveryGoalVersion`, safety projection, reduction baseline, schedule, patient lock, idempotency, audit, and profile preference structures remain the authoritative inputs.
- The current schedule service remains the only authority allowed to materialize a new period.
- The weekly questionnaire wording in the Master Specification remains unchanged.
- No later content/clinical/worker infrastructure has been introduced independently.

## Exact scope

1. Add the canonical V1 policy registry and instrument definition:
   - `AUD_WEEKLY_CHECKIN`;
   - version `1.0`;
   - all eleven canonical item IDs/keys;
   - exact value domains;
   - exact risk/protection direction;
   - required-item set;
   - wording/anchor version identifiers;
   - rule-set/configuration identifiers needed by later evaluation.

2. Add the logical weekly assessment persistence foundation:
   - one assessment identity per patient/period/instrument/version;
   - draft version;
   - mutable draft answer snapshot;
   - optional draft weekly-consumption snapshot for REDUCTION;
   - authoritative submitted revision pointer, initially null;
   - completion projection;
   - created/updated actor/timestamps;
   - relational link to the authoritative `ScheduledPeriod`.

3. Add the immutable submitted-revision table shape now if needed to preserve a stable schema boundary for Commits 2–3:
   - assessment ID;
   - revision number;
   - submitted answers;
   - completion state;
   - submitted actor/type;
   - submitted time;
   - source draft version;
   - superseded revision link;
   - classification/provenance fields;
   - no write path that creates a submitted revision yet.

4. Add item-response schema required for immutable submitted answers:
   - canonical item ID/key;
   - typed persisted value;
   - instrument version;
   - wording version;
   - scale/version provenance;
   - revision ownership.
   Do not store unstructured questionnaire data only in one opaque JSON blob when the locked relational model requires item-level history.

5. Implement one backend period-context resolver that returns the authoritative inputs needed by Check-in:
   - scheduled period;
   - derived period availability (`UPCOMING`, `OPEN`, `LATE`, historical where applicable);
   - stored monitoring timezone;
   - effective recovery goal for that period;
   - effective reduction target/baseline reference where applicable;
   - stable preference version applicable to the period;
   - current safety projection/prompt policy;
   - whether weekly consumption input is required.

6. Resolve recovery goal by effective period, not latest current status alone.

7. Resolve stable preferences as-of the period boundary. A preference update made after a period began must not reinterpret that already-started period.

8. Integrate bounded period materialization with the existing scheduling service:
   - only when an active schedule exists;
   - only through current scheduling functions;
   - no server-local timer;
   - no arbitrary period creation;
   - no browser period arithmetic.

9. Add assessment read/start behavior:
   - find or create the one logical assessment for a valid period;
   - never create a duplicate identity;
   - do not create an assessment before the valid scheduled period exists;
   - do not expose an ordinary actionable Check-in when the safety prompt policy is paused.

10. Add draft save/update behavior:
    - expected draft version;
    - patient ownership;
    - patient processing lock where ordered patient state can overlap;
    - preserve unanswered items;
    - validate only supplied item values at draft time;
    - persist REDUCTION daily draft values without treating them as authoritative consumption observations;
    - server-backed resume after reload/session change;
    - transactional audit for material draft creation/update only where the existing audit policy requires it.

11. Add the smallest assessment permissions needed for the patient read/write workflow.

12. Add shared API contracts for:
    - instrument projection;
    - assessment period context;
    - draft read;
    - draft save;
    - item values;
    - REDUCTION weekly day input;
    - patient-safe availability/safety states.

13. Add patient Check-in route and first complete draft/resume UI:
    - clear recall-period header;
    - Alcohol use screen;
    - Challenges screen;
    - Recovery/support screen;
    - seven-day REDUCTION calendar when required;
    - Review screen;
    - Save and exit;
    - Continue saved draft;
    - upcoming/not-open state;
    - safety-paused state;
    - loading/error/restricted states.

14. The frontend must use backend-provided wording context and period dates. It may render the canonical instrument but must not calculate authoritative completeness, late/backfill state, recovery-goal applicability, or safety eligibility locally.

15. Do not expose final authoritative submission in this commit. The Review screen can be complete as a draft workflow, but authoritative PARTIAL/COMPLETE submission begins only once Commit 2 can evaluate and persist the result atomically.

## Expected file-level changes

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase_4_weekly_assessment_foundation>/migration.sql

apps/backend/src/policy/instruments/aud-weekly-checkin-v1.ts
apps/backend/src/policy/subjective-monitoring-v1.ts
apps/backend/src/policy/policy-registry.ts

apps/backend/src/modules/assessments/*
apps/backend/src/modules/scheduling/service.ts          # bounded period-materialization integration only
apps/backend/src/modules/profiles/*                     # period-effective resolver only if needed
apps/backend/src/modules/consumption/*                  # reuse weekly input/unit-domain types only
apps/backend/src/modules/safety/*                       # projection reuse/minimal post-onboarding integration only if required
apps/backend/src/shared/authz/permissions.ts
apps/backend/src/app.ts

packages/contracts/src/assessment/*
packages/contracts/src/monitoring/*                     # policy-facing enums/types only
packages/contracts/src/patient/check-in*
packages/contracts/src/reduction/*                      # weekly day input reuse/extension only
packages/contracts/src/index.ts

apps/web/src/features/patient/check-in/*
apps/web/src/app/router/router.tsx
apps/web/src/app/shells/patient-shell.tsx
```

Expected paths are a planning map, not permission to create unnecessary files. Reconcile to the actual current tree before coding.

No Phase 4 test files, test commands, or validation-only changes belong in this packet.

## Migration and contract impact

The migration should introduce the minimum relational assessment foundation needed for all three Phase 4 commits without rewriting accepted Phase 1–3 tables.

Required invariants include:

- logical assessment uniqueness;
- valid scheduled-period foreign key;
- authoritative revision pointer integrity;
- revision numbering uniqueness once revisions exist;
- no cascade behavior that can delete historical assessment provenance accidentally.

The contracts package remains framework-independent and must not expose Prisma models.

## Acceptance criteria

1. The exact V1 weekly instrument is represented once in the versioned backend policy registry.
2. One patient/period/instrument/version can have only one logical weekly assessment.
3. A draft is server-backed, resumable, version-checked, and not a submitted assessment.
4. Missing answers remain missing.
5. Draft REDUCTION days remain draft data and are not yet authoritative alcohol-consumption ledger entries.
6. Assessment period identity comes only from the scheduling subsystem.
7. No final submission can be represented before the period opens.
8. Recovery goal is resolved by the period that it governs.
9. Stable preferences are resolved as-of the relevant period boundary.
10. A mid-period preference update cannot reinterpret the period already in progress.
11. `REDUCTION` requires the seven-day draft calendar; `ABSTINENCE` and `UNSURE` do not.
12. Check-in availability honors the current safety prompt policy.
13. A blocked/paused safety state cannot be bypassed by directly calling the draft mutation endpoint.
14. The Check-in UX shows the fixed completed-period recall window supplied by the backend.
15. Browser refresh/sign-out/sign-in does not create a second assessment or lose the stored draft.
16. No current flags, monitoring evaluation, clinical case, content delivery, engagement state, or worker is created in this commit.
17. Existing Phase 1–3 domain ownership remains intact.

## Do not do

- Do not implement final PARTIAL/COMPLETE submission yet.
- Do not calculate risk/protection scores in React.
- Do not introduce a generic form/questionnaire engine.
- Do not create a browser-owned authoritative draft.
- Do not calculate weeks from browser timezone.
- Do not create periods with raw `Date` arithmetic.
- Do not duplicate recovery-goal or preference history into assessment-owned profile tables.
- Do not create `ClinicalReviewCase`, clinician tasks, content resources, or engagement records.
- Do not add pg-boss or a timer to provision periods.
- Do not change safety severity rules.
- Do not infer suicide risk from weekly negative mood.
- Do not add Home/Progress/Support pages merely for navigation completeness.
- Do not add tests or validation work to this implementation packet.

---

# 7. Commit 2 packet definition

## Commit identity

```text
feat: submit and evaluate weekly subjective monitoring
```

## Goal

Turn a valid weekly draft into an immutable authoritative `PARTIAL` or `COMPLETE` submission and synchronously compute/persist the deterministic V1 monitoring result, including weekly REDUCTION measurements, current flags, aggregate context, longitudinal state, abstinence recurrence, candidate patient intents, and candidate clinician reasons.

This commit creates the authoritative weekly monitoring result for current and late-current periods. It does not yet enable historical backfill/correction recomputation, which Commit 3 owns.

## Assumptions to verify before implementation

- Commit 1 is accepted in the actual working tree.
- One logical assessment and server-backed draft exist per scheduled period.
- Period-effective goal/preference context is available through one backend resolver.
- Existing safety projection and patient lock/idempotency/audit helpers remain unchanged.
- Existing reduction-domain constants/functions remain authoritative.
- No clinical/content/engagement/delivery module has appeared outside this packet.

## Exact scope

1. Complete the immutable submission model:
   - create submitted revision number 1 for first submission;
   - retain the logical assessment identity;
   - move the authoritative revision pointer atomically;
   - preserve draft source version/provenance;
   - store item responses relationally;
   - classify submitted completion as `PARTIAL` or `COMPLETE`;
   - record submission actor/type and exact period identity.

2. Implement explicit completion intent:
   - `COMPLETE` is rejected unless all eleven required items are present and valid;
   - `PARTIAL` may omit one or more items;
   - omitted items remain `UNKNOWN`;
   - the server never upgrades PARTIAL to COMPLETE silently.

3. Implement final-submission opening/time rules:
   - final submit only at or after `open_at`;
   - submission after `effective_due_at` is late;
   - if no newer authoritative weekly submission exists, it remains a late-current submission;
   - historical backfill after a newer authoritative submission is reserved for Commit 3.

4. Implement REDUCTION weekly finalization:
   - exactly the period’s seven local calendar dates;
   - each day `KNOWN_ZERO`, `KNOWN_QUANTITY`, or `UNKNOWN`;
   - one-decimal standard-drink policy;
   - reuse 14g conversion and heavy-day thresholds;
   - persist authoritative daily observations tied to the submitted revision;
   - persist the weekly consumption summary;
   - retain target/baseline/goal-version provenance effective for that period.

5. Enforce U1/calendar consistency before commit:
   - U1 `NO` + any positive daily quantity → reject;
   - U1 `YES` + seven known zero quantities → reject;
   - no silent reconciliation.

6. Persist U1 to the use-observation ledger as a weekly interval observation:
   - recall start/end equal the scheduled period;
   - no episode count;
   - no event timestamp;
   - no automatic confirmed use event.

7. Implement the pure deterministic evaluator for the exact V1 rules.

### Current item flags

```text
HIGH_CRAVING
HIGH_NEGATIVE_MOOD
HIGH_RISKY_SITUATIONS
HIGH_RELATIONSHIP_PROBLEMS
LOW_CONFIDENCE
LOW_SOCIAL_SUPPORT
USE_POSITIVE_CURRENT
```

Sleep and the other contextual protection items do not receive invented autonomous rules.

### Complete-assessment aggregate context

Compute only when required aggregate inputs are complete:

```text
risk_score
raw_protection_score
recovery_progress
```

No aggregate proration.

Apply:

```text
HIGH_RISK
NOT_HIGH
WEAK_PROTECTION
INTERMEDIATE_PROTECTION
STRONG_PROTECTION
HIGH_RISK_WEAK_PROTECTION_CONTEXT
HIGH_RISK_STRONG_PROTECTION_CONTEXT
```

exactly according to the Master Specification’s preference-compatible bounds.

### Interaction whitelist

Implement only:

```text
HIGH_CRAVING + LOW_CONFIDENCE
HIGH_NEGATIVE_MOOD + HIGH_CRAVING
HIGH_RISK + WEAK_PROTECTION
HIGH_RISK + STRONG_PROTECTION
```

Do not introduce an abnormal-domain count, weighted severity, or other combinations.

### Longitudinal features

Compute only across valid consecutive scheduled observations:

```text
craving_delta
confidence_delta
negative_mood_delta
risk_score_delta
raw_protection_score_delta
recovery_progress_delta
```

Apply exact sharp-change rules.

### Persistence and clearance inputs/state

Implement:

```text
N_PERSIST = 2
N_CLEAR = 2
```

Rules:

- missing scheduled period resets persistence activation streak;
- missing required item resets that item’s persistence activation streak;
- missing observation pauses clearance count;
- reappearance during clearance returns the candidate reason to active and resets clearance count;
- persistence Level-3 candidate reasons exist only for high craving and high negative mood.

The evaluator may compute candidate reason lifecycle state needed by later clinical persistence, but it does not create a clinical case.

### Abstinence recurrence

Run only when the period-effective recovery goal is `ABSTINENCE` and the current U1 is positive.

Implement:

```text
CONSECUTIVE_USE
RECURRENT_USE in current+previous 3 periods
USE_AFTER_STABILITY context after 12 explicit negative periods
```

Unknown periods do not count positive or negative.

Do not run abstinence recurrence for `REDUCTION` or `UNSURE`.

### Reduction context

Compute:

- observed-day coverage;
- total standard drinks when defensible;
- ethanol grams;
- drinking days;
- alcohol-free days when complete;
- average drinks per drinking day;
- maximum daily quantity;
- heavy-drinking days;
- target met/not met semantics;
- reduction from baseline percentage when complete;
- WHO context only where the exact required 28-day known window exists and the Master Specification allows it.

Consumption-only state never creates Level 3.

8. Implement deterministic candidate patient intervention classes from the evaluator result.

The evaluator may emit:

```text
CRAVING_COPING_SUPPORT
SELF_EFFICACY_SUPPORT
MOOD_COPING_SUPPORT
TRIGGER_MANAGEMENT_SUPPORT
RELATIONSHIP_COPING_SUPPORT
SOCIAL_SUPPORT_ACTIVATION
USE_EVENT_RECOVERY_SUPPORT
RECURRENT_USE_RECOVERY_SUPPORT
RECOVERY_PLAN_REVIEW
POSITIVE_REINFORCEMENT
```

Implement deterministic precedence/dedup information required by the Master Specification, but stop before selecting a `ContentResource`.

9. Implement candidate clinician reason families:

```text
CRAVING_LOW_CONFIDENCE
MOOD_CRAVING
PERSISTENT_HIGH_CRAVING
PERSISTENT_HIGH_NEGATIVE_MOOD
CONSECUTIVE_USE
RECURRENT_USE
```

Persist them as evaluation output/provenance only. Do not create `clinical_reason_states` or a `ClinicalReviewCase`.

10. Implement `DerivedStateChanges` and `EffectPlan` output.

For a current patient submission:

- current deterministic state is persisted;
- candidate patient classes may be marked eligible subject to safety restrictions;
- candidate clinician reasons may be marked eligible for later clinical resolution;
- no content or clinician task is delivered.

Safety restrictions must be applied to the **effect plan**, not by deleting the underlying derived observation.

11. Persist the applicable derived-state history/current projections:
    - assessment evaluation record;
    - state flag observations;
    - current state flag projection;
    - aggregate context;
    - longitudinal feature record;
    - intervention intent records;
    - weekly alcohol history/use ledger;
    - reduction weekly summary where applicable.

12. Make final submission one atomic consequential operation:
    - idempotency replay boundary;
    - patient processing lock first;
    - expected draft/logical version;
    - immutable revision + item responses;
    - authoritative pointer;
    - consumption observations/summary;
    - evaluation record;
    - derived history/current projections;
    - candidate intents/reasons/effect plan;
    - audit;
    - committed response snapshot.

13. Repeated request with same idempotency key/payload returns the original committed result.

14. Same idempotency key with a different canonical payload returns the platform reuse conflict.

15. Add patient post-submit UX:
    - explicit PARTIAL versus COMPLETE success;
    - period and revision identity;
    - neutral “check-in recorded” wording;
    - no raw internal flags/scores/Level codes;
    - no promise that support content was selected;
    - no resubmission prompt merely because later content does not exist yet.

16. Keep Check-in route available for viewing the submitted current period and its authoritative revision metadata.

## Expected file-level changes

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase_4_monitoring_evaluation>/migration.sql

apps/backend/src/modules/assessments/*
apps/backend/src/modules/monitoring/*
apps/backend/src/modules/monitoring/domain/*
apps/backend/src/modules/consumption/*
apps/backend/src/modules/safety/projections.ts            # consume only; change only if integration requires
apps/backend/src/policy/*
apps/backend/src/shared/authz/*
apps/backend/src/app.ts

packages/contracts/src/assessment/*
packages/contracts/src/monitoring/*
packages/contracts/src/reduction/*
packages/contracts/src/patient/check-in*
packages/contracts/src/index.ts

apps/web/src/features/patient/check-in/*
```

No clinical/content/engagement/delivery/worker module is expected.

No Phase 4 test files, test commands, or validation-only changes belong in this packet.

## Migration and contract impact

This packet adds the minimum durable monitoring/evaluation tables required by the locked architecture.

Likely table families:

```text
assessment_evaluations
use_observation_ledger
alcohol_consumption_days
weekly_consumption_summaries
state_flag_observations
current_state_flags
aggregate_context_records
longitudinal_feature_records
patient_intervention_intents
```

The actual schema should use relational columns for stable identities/query keys and JSONB only for structured snapshots/reasons/provenance where appropriate.

Do not create clinical/content/delivery tables early merely because the full architecture document lists them.

## Acceptance criteria

1. PARTIAL and COMPLETE are immutable submitted revisions, not mutable drafts.
2. COMPLETE requires all eleven canonical items.
3. PARTIAL preserves every omitted item as unknown.
4. Final submission cannot occur before the scheduled period opens.
5. Late-current classification uses the fixed scheduled period and effective due time.
6. The period-effective recovery goal controls P1 semantics, recurrence eligibility, and REDUCTION calendar requirement.
7. REDUCTION final submission uses exactly seven period-local calendar days.
8. U1/calendar contradiction blocks final submission.
9. Weekly U1 is stored as an interval observation and never creates a confirmed event automatically.
10. The evaluator is pure and deterministic.
11. All item thresholds match the Master Specification exactly.
12. Aggregates are absent unless the required inputs are complete.
13. Protection is not renormalized or imputed.
14. Preference-inapplicable domains affect operational protection bounds exactly as specified.
15. Only whitelisted interactions run.
16. Deltas do not bridge a missing scheduled period.
17. Persistence activation resets across missing data as specified.
18. Clearance counts pause rather than resolve across missing observations.
19. Abstinence recurrence requires a current positive period.
20. Recurrence never runs for REDUCTION or UNSURE.
21. Reduction target context never becomes a consumption-only Level-3 reason.
22. Candidate patient intents are persisted without selecting content resources.
23. Candidate clinician reasons are persisted without creating a clinical case.
24. Safety restrictions suppress/permit candidate effects without erasing underlying state.
25. One transaction protects revision, evaluation, current projection, audit, and idempotency result.
26. Patient lock is acquired before ordered monitoring history is loaded/mutated.
27. Replayed submission cannot duplicate revisions, ledger entries, evaluations, intents, or audit transitions.
28. Patient UI shows a neutral authoritative completion result without internal flags/scores.
29. No historical backfill or correction path is falsely claimed complete yet.
30. No later-phase infrastructure is introduced.

## Do not do

- Do not create a single synthetic “recovery risk score” controlling actions.
- Do not alert directly from risk/protection/recovery-progress totals.
- Do not invent weighted interaction severity.
- Do not bridge missing periods for deltas or persistence.
- Do not infer relapse diagnosis from U1.
- Do not infer suicide risk from negative mood.
- Do not use the latest goal/preferences for historical periods.
- Do not treat U1 and daily quantities as interchangeable sources.
- Do not create confirmed use events from weekly U1.
- Do not select or render patient content resources.
- Do not create clinician visibility/case/task tables.
- Do not send email or push.
- Do not add pg-boss.
- Do not create engagement timers/reminders.
- Do not add tests or validation work to this implementation packet.

---

# 8. Commit 3 packet definition

## Commit identity

```text
feat: add assessment backfill corrections and recomputation
```

## Goal

Complete the weekly monitoring core’s historical semantics by adding immutable correction revisions, historical backfill, authorized staff correction, and canonical forward recomputation under patient serialization and trigger-derived effect policy.

After this commit, changing an authoritative historical weekly observation produces the same deterministic current state that would have existed if the corrected/backfilled history had always been authoritative, while preserving the full old history and suppressing prohibited retroactive effects.

## Assumptions to verify before implementation

- Commits 1 and 2 are accepted in the actual working tree.
- Current/late-current submission and deterministic evaluation are authoritative.
- Derived history/current projection tables exist.
- Every current/late submission already records rule/instrument/configuration/source revision provenance.
- No clinical/content/engagement/delivery system has been introduced outside Phase 4.
- The current patient lock and idempotency utilities remain the platform mutation boundary.

## Exact scope

1. Implement canonical backfill classification:

A submitted assessment is `HISTORICAL_BACKFILL` when a newer scheduled period already has an authoritative submitted revision.

A late assessment with no newer authoritative submitted period remains late-current, not backfill.

Classification is backend-owned.

2. Allow final submission of a missing historical period using the same logical assessment identity, item rules, and REDUCTION consistency rules as current submission.

3. Historical backfill must:
   - persist the new authoritative revision;
   - evaluate the historical period;
   - update historical feature records;
   - recompute all affected later authoritative periods;
   - never deliver/mark eligible historical patient support merely because that old period would have qualified;
   - never create a clinician notification merely because the old period would have qualified;
   - permit a changed **current** recurrence result only under the Master Specification’s current-positive/rolling-window rules.

4. Implement patient correction:
   - correction targets the same logical assessment;
   - starts from the current authoritative revision;
   - creates a new immutable revision;
   - old revision remains;
   - expected authoritative revision/version is required;
   - the new revision becomes authoritative only inside the successful transaction;
   - latest patient correction may create newly qualifying **current** candidate patient support/effect state;
   - no historical content is delivered for an old corrected period.

5. Implement authorized staff/clinician correction as a separate backend action if the current role boundary can support it cleanly:
   - assigned-patient scope before record lookup;
   - explicit correction permission;
   - explicit reason/provenance;
   - fresh/step-up requirement where the existing privileged-action pattern requires it;
   - expected authoritative revision;
   - idempotency key;
   - patient lock;
   - immutable new revision;
   - staff-trigger effect policy.

A staff correction updates deterministic state and later clinical eligibility but does **not** automatically permit patient content delivery.

Do not add an unrestricted admin clinical-edit capability.

6. Implement the canonical recomputation service:

```text
recomputePatientMonitoringFromPeriod(
  patientId,
  periodId,
  authoritativeTrigger
)
```

The service must:

1. acquire the patient lock;
2. resolve the changed period;
3. load ordered scheduled periods from that point forward;
4. load each authoritative assessment revision;
5. resolve the goal effective for each period;
6. resolve stable preferences effective for each period;
7. reconstruct adjacency/missingness exactly from scheduled-period history;
8. re-evaluate chronologically;
9. create new evaluation/derived-history records rather than mutate old derived history into a false past;
10. supersede/revoke old evaluation outputs where no longer authoritative;
11. rebuild current state projections from the recomputed authoritative sequence;
12. compute the effect plan from the authoritative trigger;
13. write audit provenance for the authoritative change and resulting recomputation;
14. remain idempotent under retry.

7. Preserve historical derived state explicitly.

Prior derived observations/evaluations must remain reconstructable and receive an explicit superseded/revoked relationship/status when a new authoritative revision invalidates them.

Do not delete the old evaluation simply because it no longer drives the current projection.

8. Implement exact forward semantics:

- current flags are based on the newest valid authoritative observation;
- item delta adjacency cannot bridge missing periods;
- persistence activation is recomputed from scheduled adjacency;
- missing periods reset persistence activation;
- clearance missingness pauses counts;
- recurrence uses only authoritative weekly U1;
- goal transitions do not reinterpret earlier periods;
- preference changes do not reinterpret periods before their effective boundary;
- reduction target history uses the goal version effective for the period;
- old U1 ledger observations remain provenance history but only the authoritative weekly revision drives recurrence.

9. Implement canonical trigger-derived effect policy.

### `CURRENT_PATIENT_CORRECTION`

May produce newly qualifying current candidate patient support and current clinician-reason eligibility.

### `STAFF_CORRECTION`

Recomputes state and clinician-reason eligibility but suppresses automatic patient-support delivery eligibility.

### `HISTORICAL_BACKFILL`

Recomputes history/current state but suppresses old-period patient support and old-period notification eligibility.

### `ADMINISTRATIVE_RECOMPUTE`

May rebuild deterministic state but does not fabricate a patient-originated effect.

### `POLICY_MIGRATION`

Remain modeled/reserved and require an explicit future migration/effect plan. Do not silently reinterpret V1 history.

10. Repeated recomputation of the same authoritative inputs must not duplicate:
    - assessment revisions;
    - evaluation history;
    - current projections;
    - patient intents;
    - ledger entries;
    - audit transitions;
    - future case/task identities.

11. Add patient assessment history/revision projection sufficient for the Check-in workflow:
    - period;
    - DRAFT/PARTIAL/COMPLETE;
    - current/late/backfill label;
    - authoritative revision number;
    - prior revision metadata;
    - correction availability;
    - no raw internal clinical flags/scores.

12. Add patient correction UX:
    - `Correct this check-in`;
    - load current authoritative revision;
    - explicit confirmation that a new revision will be created;
    - previous revision remains in history;
    - backend may recompute current state;
    - retry does not create duplicate correction.

13. Add historical/backfill UX inside the Check-in feature:
    - clearly identify the older recall period;
    - distinguish from the current open check-in;
    - state that it updates the record/history;
    - do not promise retroactive support or alerting.

14. Keep full Patient Progress/history visualization for a later phase. The Phase 4 history surface should be only what Check-in correction/backfill needs.

15. Make all consequential correction/backfill mutations use:
    - explicit action route;
    - expected version/revision;
    - idempotency key;
    - patient processing lock;
    - transactional audit;
    - safe conflict/error response.

16. If a Phase 1–3 integration gap is discovered while implementing recomputation, correct it only when it is required to preserve the weekly historical invariant. Record the correction in the packet review rather than hiding it as an unrelated refactor.

## Expected file-level changes

```text
apps/backend/prisma/schema.prisma                         # only if supersession/status fields are still required
apps/backend/prisma/migrations/<phase_4_recompute_history>/migration.sql
                                                         # only when a real schema need remains

apps/backend/src/modules/assessments/recompute-service.ts
apps/backend/src/modules/assessments/*
apps/backend/src/modules/monitoring/*
apps/backend/src/modules/consumption/*
apps/backend/src/modules/profiles/*                      # period-effective resolution only
apps/backend/src/shared/authz/permissions.ts             # explicit staff correction permission if used
apps/backend/src/shared/authz/*
apps/backend/src/app.ts

packages/contracts/src/assessment/*
packages/contracts/src/monitoring/*
packages/contracts/src/patient/check-in*
packages/contracts/src/index.ts

apps/web/src/features/patient/check-in/*
apps/web/src/app/router/router.tsx
apps/web/src/app/shells/patient-shell.tsx
```

Prefer designing Commits 1–2 schemas so Commit 3 does not require a large corrective migration. Add a third Phase 4 migration only for a genuine historical/recompute invariant that could not responsibly be represented earlier.

No Phase 4 test files, test commands, or validation-only changes belong in this packet.

## Migration and contract impact

The final contract surface should support explicit actions rather than arbitrary mutation.

Representative action shape:

```text
GET  /api/v1/patient/check-in
GET  /api/v1/patient/assessments/:assessmentId
PUT  /api/v1/patient/assessments/:assessmentId/draft
POST /api/v1/patient/assessments/:assessmentId/submit
POST /api/v1/patient/assessments/:assessmentId/corrections
```

If staff correction is exposed in Phase 4, use an assignment-scoped explicit action route rather than a generic PATCH.

Exact route naming may be reconciled to the current module style, but the action semantics are locked.

## Acceptance criteria

1. Backfill is classified only when a newer authoritative weekly submission already exists.
2. Late-current and historical-backfill are not conflated.
3. A backfilled period is stored and evaluated without sending/marking eligible retroactive old-period patient support.
4. Backfill can change a current recurrence result only under the exact current-positive rolling-window rule.
5. A correction creates a new immutable revision of the same assessment.
6. The previous revision remains reconstructable.
7. Exactly one revision is authoritative after the transaction commits.
8. Patient correction to the latest assessment may produce newly qualifying current candidate support.
9. Staff correction suppresses automatic patient-support effect eligibility.
10. Historical correction suppresses old-period patient-support/notification effects.
11. Forward recomputation begins at the earliest changed period and processes authoritative later history chronologically.
12. Recompute uses scheduled-period gaps rather than only submitted assessment adjacency.
13. Goal context is period-effective during recomputation.
14. Stable preferences are period-effective during recomputation.
15. Reduction target/baseline context is period-effective during recomputation.
16. U1 recurrence reads only authoritative weekly observations.
17. Old use observations remain provenance history and are not silently deleted.
18. Old evaluation/derived records remain visible as superseded/revoked history.
19. Current projections match the recomputed authoritative history.
20. Re-running the same authoritative recomputation does not duplicate durable state/effects.
21. Correction/backfill routes are version-checked, idempotent, patient-serialized, and audited.
22. Assigned staff cannot correct an unassigned patient.
23. Admin role alone does not imply clinical correction permission.
24. Patient history UI distinguishes current, late, backfilled, corrected, PARTIAL, and COMPLETE states without internal clinical labels.
25. No clinical case, content resource, clinician task, engagement case, worker, or outbound notification is created.
26. Phase 4 ends with a complete weekly monitoring core that later phases can consume directly.

## Do not do

- Do not mutate a submitted revision in place.
- Do not delete superseded/revoked evaluation history.
- Do not recompute from “latest submissions only” while ignoring scheduled missing periods.
- Do not use current preferences or current goal indiscriminately for history.
- Do not let caller-provided `suppressNotifications` decide effect policy.
- Do not create retroactive patient support for backfill.
- Do not create retroactive clinician notification solely because a historical state qualified.
- Do not auto-merge U1/daily observations into a confirmed event.
- Do not add a generic workflow/recompute engine.
- Do not add clinical case lifecycle tables as a convenience.
- Do not add content selection/delivery.
- Do not add engagement.
- Do not add workers/pg-boss.
- Do not add tests or validation work to this implementation packet.

---

# 9. Phase-wide acceptance criteria

The following criteria were used for Phase 4 closeout. The current implementation at `a16c1bd` is the accepted result:

1. All three implementation commit scopes have been delivered and individually reviewed through the packet method.
2. The canonical weekly instrument is `AUD_WEEKLY_CHECKIN` version `1.0` with the exact eleven items and value domains from the Master Specification.
3. One logical assessment exists per patient/period/instrument/version.
4. Draft state is server-backed and resumable.
5. PARTIAL and COMPLETE submissions are immutable revisions.
6. COMPLETE requires all eleven items; PARTIAL never imputes missing values.
7. Recall periods come only from persisted scheduling state.
8. Final submission is not available before the period opens.
9. Late-current and historical-backfill semantics are correct.
10. Corrections create revisions and never overwrite submitted history.
11. Recovery goal is resolved by effective period.
12. Stable preferences are resolved by period boundary rather than latest-state shortcut.
13. REDUCTION weekly calendar is required only when the period-effective goal is REDUCTION.
14. Weekly quantity observations preserve known-zero/known-quantity/unknown distinctions.
15. U1/calendar contradictions block final submission.
16. Weekly U1 is an interval observation and does not become a confirmed drinking event automatically.
17. The deterministic monitoring evaluator is pure and versioned.
18. Item thresholds exactly match the Master Specification.
19. Aggregates are not prorated.
20. Preference-compatible protection bounds are exact and preserve the raw score.
21. Only the whitelisted interactions exist.
22. Deltas do not bridge missing scheduled periods.
23. Persistence activation and clearance missingness semantics are exact.
24. Abstinence recurrence requires current positive U1 and is disabled for REDUCTION/UNSURE.
25. Reduction target context never creates a consumption-only Level-3 escalation.
26. Candidate patient intervention intents are persisted without selecting patient content.
27. Candidate clinician reason families are persisted without creating clinical review cases.
28. Safety restrictions control the effect plan without deleting underlying observations.
29. Patient submission/correction/backfill are serialized through the existing patient processing lock.
30. Consequential HTTP actions use the existing idempotency contract.
31. Audit records are written transactionally with authoritative state changes.
32. Forward recomputation rebuilds affected later state from the earliest changed historical period.
33. Recompute preserves superseded/revoked historical evaluation records.
34. Historical backfill does not create prohibited retroactive patient support or notification eligibility.
35. Staff correction does not automatically permit patient content delivery.
36. Repeated retry/recompute does not duplicate durable revision/evaluation/intent/ledger state.
37. The patient Check-in experience is polished, role-safe, state-aware, and does not expose raw flags/scores/tiers.
38. Full Home/Progress/Support and clinician review surfaces have not been fabricated before their backend owners exist.
39. No pg-boss, broker, cache, second database, microservice, or speculative infrastructure has entered the phase.
40. `real_patient` readiness remains truthful and refused until later requirements are implemented.

Phase 4 was **not** accepted merely because a questionnaire could be submitted. The closeout covered authoritative assessment identity, immutable history, deterministic interpretation, correction/recomputation semantics, patient-safe projections, and the explicit boundary before later content, clinician-case, engagement, and delivery systems.

It must prove:

```text
authoritative weekly identity
+
immutable revisions
+
exact deterministic interpretation
+
period-aware longitudinal state
+
safe historical recomputation
+
correct concurrency/idempotency/audit
```

as one coherent weekly monitoring core.

The criteria are satisfied by the committed Phase 4 implementation, focused regression coverage, and the closeout invariant query in `validation/phase4_invariants.sql`.

---

# 10. Commit packet operating method

The three definitions above are phase-level packet templates. Before each implementation attempt, create a current executable packet from the relevant template using the actual repository state.

## 10.1 Before issuing a packet

Inspect the actual repository rather than relying only on this guide or the prior packet summary.

At minimum inspect:

```text
git status --short --branch
git diff --stat
git diff
git log --oneline --decorate -n <reasonable count>

current Prisma schema
every current migration
current apps/backend/src/modules tree
current policy/shared helpers
current contracts
current patient routes/shell/router
current scheduling service
current safety projection/service
current recovery-goal/reduction implementation
current profile preference behavior
current README/readiness state

prior packet verdict
unresolved carried correction
```

For Commit 2/3, also inspect the actual assessment/monitoring schema and code produced by the earlier Phase 4 packet rather than assuming it matches this planning file exactly.

Preserve unrelated user changes.

If the tree already contains overlapping unexplained assessment/monitoring work, resolve that overlap before issuing a new packet.

## 10.2 Required packet contents

Every executable Phase 4 packet must state:

1. **Commit identity/message**
2. **Goal**
3. **Verified starting state**
4. **Prior correction status**
5. **Assumptions still requiring care**
6. **Exact scope**
7. **File-level plan reconciled to actual paths**
8. **Migration and contract impact**
9. **Acceptance criteria**
10. **Do-not-do boundaries**

Phase 4 packets intentionally omit test commands, validation commands, CI validation instructions, and “evidence required” sections. Those are handled manually outside the implementation packet.

The packet should be precise about:

- clinical/domain invariants;
- historical semantics;
- concurrency;
- idempotency;
- provenance;
- period/goal/preference ownership;
- visible API/UX behavior.

Leave ordinary implementation mechanics to Codex where the governing documents do not lock them.

## 10.3 Implementation authority

For each packet, Codex may modify the working tree only for the active packet.

Codex must **not**:

- create a Git commit;
- push;
- open a pull request;
- implement the next packet;
- add tests/validation work that the user has reserved for manual handling;
- add a validation-only commit;
- run destructive database/data commands against an unverified target;
- alter accepted Phase 1–3 behavior without an active-packet correctness reason;
- add optional infrastructure;
- perform unrelated refactors;
- prebuild later content/clinical/engagement/delivery features.

The three-commit plan is a scope plan, not permission to implement all three packets in one working-tree change.

## 10.4 Review and verdict

After Codex implements a packet, review the actual working tree rather than relying on its summary.

At minimum inspect:

- complete diff and untracked files;
- schema and handwritten migration;
- contracts and every caller;
- module ownership;
- period/goal/preference resolution;
- patient lock order;
- idempotency boundary;
- authoritative revision/pointer behavior;
- immutable history;
- evaluator purity;
- historical side-effect policy;
- safety integration;
- patient-facing state projection;
- do-not-do boundary.

Manual test/validation output may be reviewed separately when the user runs it, but it is not part of the Codex implementation packet.

Every review ends with exactly one verdict:

```text
APPROVE
APPROVE WITH SMALL FOLLOW-UP
REQUEST FIXES
REJECT
```

Use them as follows:

- **APPROVE** — the packet meets its scope and has no required code correction.
- **APPROVE WITH SMALL FOLLOW-UP** — the packet is coherent; one bounded correction is explicitly carried into the next packet.
- **REQUEST FIXES** — remain on the same intended commit until corrected.
- **REJECT** — the approach materially conflicts with the governing specification or architecture and should be replaced.

A `REQUEST FIXES` or `REJECT` result blocks progression to the next nominal commit.

Do not create a fourth Phase 4 commit simply because a correction was discovered after a packet. Keep the fix inside the active packet until that packet is accepted unless the user explicitly decides otherwise.

## 10.5 Commit handoff

After approval:

1. report the exact reviewed scope;
2. report any carried follow-up;
3. wait for explicit user instruction before commit/push;
4. after any user-authorized commit, inspect the repository again;
5. only then prepare the next packet.

---

# 11. Decision rules for ambiguity during Phase 4

When the governing documents do not specify an implementation detail:

1. use the existing schedule period as the weekly identity anchor;
2. preserve missing as unknown;
3. preserve immutable submitted history;
4. prefer one logical row + immutable revisions + current projection over event sourcing;
5. resolve recovery goal by effective period;
6. resolve stable preferences by the period boundary;
7. load all evaluator inputs first, then call a pure evaluator;
8. keep evaluator output separate from persistence orchestration;
9. derive side-effect policy from the authoritative trigger, never an arbitrary caller boolean;
10. use the existing patient lock before ordered monitoring history;
11. use the existing idempotency helper for consequential HTTP actions;
12. use the existing audit table in the same transaction as authoritative state changes;
13. reuse current consumption-domain constants/functions;
14. consume the current safety projection rather than duplicate gate logic;
15. persist enough history to reconstruct why the current state exists;
16. do not create a later-phase table merely because a candidate output exists;
17. expose a truthful unavailable/deferred state instead of fabricating content/case/delivery success;
18. use the smallest relational model that proves the invariant;
19. introduce no new dependency/framework unless the current requirement cannot be met cleanly with the existing stack;
20. if prior-phase code conflicts with a locked Master Specification rule required by weekly monitoring, correct the narrow dependency and document the correction in the active packet review.

Request direction only when the unresolved choice would materially change:

- a locked questionnaire item/scale;
- a threshold;
- missingness semantics;
- recurrence/persistence/clearance behavior;
- safety ownership;
- historical reinterpretation;
- recovery-goal meaning;
- assessment identity;
- phase boundary.

Do not stop for ordinary naming, file placement, or implementation mechanics that can be resolved from existing repository conventions.

---

# 12. Phase 4 non-goals and architectural guardrails

Throughout Phase 4:

- scheduling owns weekly periods;
- assessments own raw weekly identity/draft/revisions;
- consumption owns alcohol quantities and reduction summary arithmetic;
- monitoring owns deterministic interpretation and candidate outputs;
- safety owns safety;
- profiles own recovery-goal/preference history;
- Phase 5 clinical-review code owns clinical reason/case lifecycle;
- Phase 5 content code owns approved resource selection;
- Phase 5 owns durable in-app clinician tasks; later delivery code owns notifications;
- later engagement code will own missed-check-in state.

The following separations must remain explicit:

```text
weekly U1
≠
daily alcohol quantities
≠
confirmed alcohol-use event
```

```text
candidate clinician reason
≠
clinical review case
≠
clinician task
≠
notification delivery
```

```text
candidate intervention class
≠
approved content resource
≠
patient content delivery
```

```text
derived clinical/monitoring state
≠
safety severity/gate
```

```text
historical backfill
≠
retroactive patient support
```

```text
missing data
≠
non-use
≠
stability
≠
improvement
```

Required complexity must remain where correctness demands it:

- immutable revisions;
- authoritative pointers;
- version provenance;
- patient serialization;
- idempotency;
- scheduled-period adjacency;
- period-effective goals/preferences;
- deterministic recomputation;
- effect-trigger semantics;
- superseded/revoked history.

Avoid complexity that does not serve those invariants:

- no microservices;
- no event sourcing;
- no generic rule engine;
- no workflow engine;
- no form builder;
- no message broker;
- no cache;
- no new datastore;
- no generic notification framework;
- no speculative analytics pipeline;
- no ML/prediction layer.

---

# 13. Phase completion handoff to Phase 5

Phase 4 handed the next phase a complete weekly monitoring **interpretation core**, not a partially implemented content or clinician-delivery system. Phase 5 has now completed that handoff by consuming the persisted outputs below.

Later phases may rely on:

- one logical assessment per scheduled period;
- server-backed draft state;
- immutable PARTIAL/COMPLETE revisions;
- authoritative revision pointers;
- exact period/goal/preference provenance;
- weekly U1 observations;
- weekly REDUCTION quantities and summaries;
- pure deterministic evaluation;
- historical state-flag observations;
- current state projection;
- aggregate/protection context;
- longitudinal/persistence/clearance state;
- abstinence recurrence state;
- candidate patient intervention intents;
- candidate clinician reason families;
- evaluation trigger/effect-plan records;
- forward recomputation from correction/backfill;
- patient lock/idempotency/audit integration;
- patient Check-in and correction/backfill flows.

Phase 4 must **not** pre-empt later phases by converting those outputs into:

- approved patient resources;
- patient content delivery;
- clinician visibility/case lifecycle;
- review-queue tasks;
- engagement reminders/cases;
- notification delivery;
- background worker jobs.

The next phase must again inspect the actual repository before defining its first packet.

The expected dependency direction is:

```text
Phase 4 authoritative weekly observation/evaluation
        ↓
later content resolver
        ↓
later clinician visibility/case resolver
        ↓
later durable delivery/engagement/operations
```

The weekly engine should not need to be rewritten when those systems arrive. They should consume its versioned outputs.

---

# 14. Phase 4 implementation summary

The Phase 4 implementation sequence is intentionally:

```text
Commit 1
Weekly identity + exact instrument + period context + server-backed draft
        ↓
Commit 2
Immutable submission + deterministic evaluation + current derived state
        ↓
Commit 3
Historical backfill/correction + forward recomputation + revision history
```

This ordering avoids two common failure modes:

1. building a polished questionnaire before its authoritative data/history model is correct;
2. building current-only scoring first and discovering later that backfill/correction requires a second interpretation architecture.

The phase should finish with one coherent rule:

> **For any patient and scheduled period, the system can identify the authoritative weekly observation, reproduce exactly how V1 interpreted it, and deterministically rebuild every affected later monitoring state when history changes.**

That is the required Phase 4 boundary.
