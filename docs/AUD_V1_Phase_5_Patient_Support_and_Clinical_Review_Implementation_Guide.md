# AUD Subjective Monitoring V1 — Phase 5 Patient Support and Clinical Review Implementation Guide

## Document status

**Status:** **CLOSED**

**Phase:** 5 of 7

**Phase name:** Patient Support and Clinical Review

**Target commits:** **3 balanced implementation commits**

**Implementation mode:** **One phase implementation sweep**

**Validated Phase 4 implementation baseline:** `a16c1bd9fc85879938c6a9134ca7af0c8662187b` (`closing: Phase-4`)

**Current repository baseline inspected for this guide:** `a16c1bd9fc85879938c6a9134ca7af0c8662187b`

**Validated Phase 5 implementation head:** `f6bc02bff621448fcfdaf20285be3b3e6fe6df15`

**Phase 5 implementation commits:** `847cf47fbdca6771f34b40766025f581c73772ff`, `0f59461ffe5fa9c7c05d4495263c21078b4ec1d9`, and `1529e40c15cd79d97bd85d9ecb762815936084bd`

**Phase 5 correction/validation commit:** `f6bc02bff621448fcfdaf20285be3b3e6fe6df15` (`fix: close phase 5 patient support and clinical review`)

**Validation ownership:** Phase 5 implementation commits intentionally exclude automated-test additions, validation-only files, validation commands/runs, CI-only changes, and documentation closeout. Those are handled only after the complete Phase 5 implementation sweep has been pushed and audited.

This guide defines the Phase 5 implementation boundary and the execution plan for implementing the whole phase in one Codex session. It is not a new clinical, product, UX, or architecture specification.

## Phase 5 closeout record

Phase 5 is complete and accepted at the validated implementation head above. The implementation delivers governed patient support resolution, immutable approved content versions, deterministic eligibility/rotation/cooldown/refusal behavior, historical/current effect handling, Level-2 clinician visibility, the locked six-family Level-3 reason lifecycle, one-open-case reconciliation, durable clinician tasks with direct or unrouted routing, patient Support and post-check-in surfaces, and the clinician Review Queue/detail workflow.

The bounded correction and validation sweep added the required relational constraints, deterministic-selection and clinical-lifecycle seams, focused domain/integration/UI coverage, final neutral post-check-in handling for `CONTENT_UNAVAILABLE`, and Phase 5 invariant SQL. No Phase 6/7 functionality, external delivery, or real-patient activation was added.

Validation results against the isolated PostgreSQL test database:

- `pnpm format:check` — PASS
- `pnpm lint` — PASS
- `pnpm typecheck` — PASS
- `pnpm test` — PASS (`30` web tests, `175` backend tests, `9` Playwright tests)
- `pnpm build` — PASS
- `pnpm exec playwright test` — PASS (`9` tests; also exercised through `pnpm test`)
- `validation/phase4_invariants.sql` — PASS (`22` weekly assessments in the final test database)
- `validation/phase5_invariants.sql` — PASS (`18` content resolutions, `3` clinical cases, `3` clinician tasks)
- `pnpm db:migrate:deploy` — PASS for both local and isolated test databases; no pending migrations
- prototype seed integration verification — PASS; repeatable `24` resources and `24` approved prototype-provenance versions

Bounded deviations: none. The existing `real_patient` operational refusal remains intentional, and Phase 6/7 work remains outside this closeout.

Authority remains:

1. `docs/AUD_Subjective_Monitoring_Master_Specification_V1.md`
2. `docs/AUD_V1_Web_Product_Surface_and_UX_Implementation_Lock.md`
3. `docs/AUD_V1_Locked_Implementation_Architecture.md`
4. completed Phase 1 implementation guide
5. completed Phase 2 implementation guide
6. completed Phase 3 implementation guide
7. completed Phase 4 implementation guide and accepted Phase 4 implementation
8. this Phase 5 guide
9. packet-specific Codex instructions, provided they do not conflict with the sources above

If this guide appears to conflict with a governing document, the higher-authority document wins. Do not silently reinterpret a locked clinical, safety, historical, content, case, or delivery decision.

---

# 1. Execution model for Phase 5

Phase 5 uses a deliberately compressed workflow:

```text
LOCKED DOCS + CURRENT HEAD
          ↓
ONE CODEX IMPLEMENTATION SESSION
          ↓
Commit 1
          ↓
Commit 2
          ↓
Commit 3
          ↓
STOP — DO NOT PUSH
          ↓
USER PUSHES ONCE
          ↓
ONE FULL-PHASE AUDIT
          ↓
ONE CORRECTION SWEEP IF REQUIRED
          ↓
ONE VALIDATION SWEEP
          ↓
PHASE CLOSED
```

Codex must **not stop for user approval between the three planned implementation commits**.

Codex must:

- inspect the current repository before editing;
- implement Commit 1 completely;
- create the local Git commit;
- immediately continue to Commit 2;
- create the local Git commit;
- immediately continue to Commit 3;
- create the local Git commit;
- stop after Commit 3;
- never push;
- not perform the later audit, validation, or documentation closeout.

The purpose is to preserve coherent commit history without paying the cost of three separate review cycles.

## 1.1 No implementation-time validation sweep

During the implementation sweep, do **not** run or add:

- the full test suite;
- Playwright;
- phase invariant SQL;
- full build validation;
- validation-only scripts;
- validation-only tests;
- documentation completion edits;
- CI work whose sole purpose is Phase 5 validation.

Codex may use narrow compiler/editor feedback necessary to write valid code, but must not turn each commit into a separate validation phase.

## 1.2 Blocker-first implementation rule

If Codex finds a small incompatibility in accepted Phase 1–4 code that directly blocks Phase 5, fix the smallest required seam inside the relevant Phase 5 commit.

Do not reopen accepted earlier phases for:

- cosmetic consistency;
- naming cleanup;
- speculative abstraction;
- unrelated refactoring;
- test expansion;
- “while I am here” changes.

---

# 2. Phase outcome

At the end of Phase 5, the Phase 4 monitoring engine no longer stops at candidate patient intents and candidate clinician reasons.

The completed phase provides:

- governed patient-facing content-resource storage with immutable versions;
- deterministic content eligibility and rotation;
- resource-volume gating;
- preference, safety, goal, locale, contraindication, refusal, channel, and cooldown filtering;
- persisted content-resolution outcomes including `CONTENT_UNAVAILABLE`;
- proactive patient support for the authoritative current monitoring result;
- non-autonomous `AVAILABLE_FOLLOWUP`;
- `DISMISS`, `NOT_HELPFUL`, and `DONT_SHOW_THIS_TYPE` behavior;
- explicit restoration of persistently hidden intervention classes;
- patient post-check-in support and Support surfaces that render backend-selected content rather than selecting it in React;
- Level-2 clinician visibility projections;
- persisted Level-3 clinical reason states and immutable reason history;
- one-open-clinical-case-per-patient semantics;
- exact multi-reason case lifecycle;
- correction/backfill/recompute-aware clinical reconciliation;
- durable in-application clinician task records;
- recipient resolution through the actually available assignment model without discarding unrouted work;
- a clinician Review Queue;
- clinician patient monitoring/review detail;
- clinician acknowledgement of a new review case;
- strict separation between patient support, clinician visibility, clinical review eligibility, clinical case state, and task delivery state;
- atomic integration with the authoritative Phase 4 submission/correction/backfill/recompute pipeline.

The phase does **not** yet implement the missed-check-in engagement subsystem, reminder schedules, technical-failure timing, full notification retry workers, auxiliary email/push delivery, Admin content-governance UI, Admin Operations, or deployment hardening.

The governing Phase 5 principle is:

> **Consume the deterministic Phase 4 result exactly once, turn eligible patient intents into governed support and eligible clinician reasons into durable clinical review state, but do not duplicate monitoring rules or advance into engagement/operations/deployment.**

---

# 3. Actual post-Phase-4 baseline

This guide is based on the repository that actually exists at `a16c1bd9fc85879938c6a9134ca7af0c8662187b`.

## 3.1 Foundations already available

### Repository/runtime

The accepted platform already uses:

- pnpm workspace monorepo;
- `apps/backend`;
- `apps/web`;
- `packages/contracts`;
- strict TypeScript/ESM;
- Fastify;
- React/Vite;
- PostgreSQL 17;
- Prisma 7 with `@prisma/adapter-pg`;
- Better Auth;
- shared idempotency;
- shared patient processing lock;
- append-only audit events;
- operational incidents;
- one backend process;
- one primary database.

Do not introduce:

- Redis;
- Kafka;
- RabbitMQ;
- NATS;
- microservices;
- a second backend;
- a generic event bus;
- CQRS/event-sourcing frameworks;
- a dependency-injection framework.

### Phase 4 assessment and monitoring core

The repository now contains:

```text
apps/backend/src/modules/assessments/
apps/backend/src/modules/monitoring/
apps/backend/src/modules/consumption/
apps/backend/src/modules/safety/
```

Phase 4 already owns:

- weekly assessment drafts;
- PARTIAL and COMPLETE submission;
- immutable submitted revisions;
- historical backfill;
- patient correction;
- authorized staff correction;
- forward recomputation;
- current/late/historical effect scope;
- deterministic evaluation;
- current flags;
- aggregate context;
- longitudinal features;
- persistence/clearance snapshots;
- abstinence recurrence;
- weekly reduction metrics;
- patient intervention intents;
- candidate clinician reason families;
- effect planning;
- current projections and immutable derived history.

Phase 5 must consume those results. It must not calculate the questionnaire or monitoring rules again.

### Existing Phase 4 derived persistence

The current Prisma schema already includes Phase 4 records such as:

```text
assessment_evaluations
state_flag_observations
current_state_flags
aggregate_context_records
longitudinal_feature_records
patient_intervention_intents
```

`PatientInterventionIntent` already preserves:

- patient;
- assessment revision;
- scheduled period;
- evaluation;
- intervention class;
- source reasons;
- resolver metadata;
- effect;
- suppression reason;
- evaluation trigger.

This is the Phase 5 content-resolver input.

### Existing authorization baseline

The current permission registry already includes:

```text
PATIENT_ASSESSMENT_READ
PATIENT_ASSESSMENT_UPDATE
PATIENT_ASSESSMENT_STAFF_CORRECT
```

but does not yet contain the dedicated patient-support or clinical-review permissions Phase 5 needs.

Phase 5 extends the existing permission model. It does not create a second authorization mechanism.

### Current web surface

Patient features currently include:

```text
check-in
onboarding
profile
reduction
safety
```

Clinician features currently include:

```text
patients
safety
```

There is no current:

```text
patient support feature
clinical review queue
clinical case feature
content feature
delivery feature
```

Phase 5 adds only the real surfaces justified by the new backend capabilities.

### No current content/clinical/delivery modules

At the Phase 5 baseline there is no backend:

```text
content/
clinical/
delivery/
```

That is the correct starting point.

### No current pg-boss dependency

The backend package does not currently depend on `pg-boss`.

Phase 5 does **not** need to add pg-boss merely to make durable in-app clinician tasks exist. Background reminder/retry/auxiliary-delivery workers remain Phase 6 work unless implementation proves a locked Phase 5 invariant literally cannot be satisfied without the queue.

---

# 4. Carry-forward realities Phase 5 must absorb

## 4.1 Phase 4 candidate output is authoritative

Phase 5 must not inspect raw R/P/U answers and re-decide which intervention class or clinician reason should exist.

The boundary is:

```text
Phase 4 monitoring evaluator
        ↓
persisted PatientInterventionIntent
+
persisted evaluation/effect plan
+
persisted longitudinal reason lifecycle snapshot
        ↓
Phase 5 content / clinical resolution
```

If content or clinical code starts reproducing threshold logic such as:

```text
R3 >= 6
P1 <= 2
positive count in four weeks
```

the implementation is wrong.

## 4.2 Phase 4 effect semantics remain authoritative

The current evaluation distinguishes effects such as:

```text
ELIGIBLE
HISTORICAL_ONLY
SUPPRESSED_TRIGGER
SUPPRESSED_SAFETY
```

Phase 5 acts on this effect result.

Rules:

- patient content is proactively delivered only from patient intents whose effect is currently eligible;
- a historical-only intent remains stored but cannot generate historical support;
- a staff-trigger-suppressed patient intent remains stored but cannot generate patient support;
- safety-suppressed content remains suppressed without deleting the clinical observation;
- clinician reason eligibility follows the Phase 4 clinician effect plan rather than the patient-content effect.

Do not “fix” an effect in the content/clinical layer by independently reinterpreting the trigger.

## 4.3 Current Phase 4 intervention output and follow-up

The current monitoring evaluator already applies the proactive two-class limit.

The Master Specification also requires lower-priority compatible content to be represented as `AVAILABLE_FOLLOWUP`.

Phase 5 must preserve the rule:

```text
at most 2 proactive intervention classes
```

while allowing patient-requested follow-up without duplicating monitoring logic.

Implementation order:

1. first inspect whether the accepted Phase 4 output retains enough deterministic information to identify follow-up classes;
2. if it already does, consume it;
3. if it does not, make the **smallest Phase 5 dependency fix** in the monitoring output/persistence so that lower-priority follow-up eligibility can be represented;
4. do not change the proactive priority order or the two-class proactive cap;
5. do not reconstruct candidate classes in `content` from questionnaire thresholds.

A small extension such as an explicit persisted follow-up-candidate list is acceptable if needed. Reopening the evaluator’s clinical rules is not.

## 4.4 Submission success remains separate from support availability

A stored/evaluated assessment remains successful even when:

```text
CONTENT_UNAVAILABLE
```

is the resolver result.

The UI must never ask the patient to resubmit a check-in merely because no resource could be selected.

## 4.5 Historical recomputation now has downstream consumers

Phase 4 recomputes monitoring state forward after backfill/correction.

Phase 5 must integrate downstream reconciliation into that chronological recompute path.

For every recomputed authoritative evaluation:

- content resolution respects the stored effect plan;
- old follow-up/content resolution produced by a superseded authoritative revision is invalidated/replaced appropriately;
- historical-only support is not delivered;
- clinical reason state is recomputed;
- clinical cases are reconciled;
- correction-based case closure is handled;
- only a currently eligible/materially new clinical reason can create a new task.

Do not recompute monitoring first and leave stale clinical/content projections indefinitely.

## 4.6 Current assignment model is smaller than the future routing model

The Master Specification routing order is:

```text
primary clinician
→ care-team queue
→ service fallback queue
→ SYSTEM_UNROUTED_QUEUE
```

The current accepted repository has direct clinician-patient assignments but no full care-team/fallback-routing subsystem for ordinary Level-3 review.

Phase 5 must not invent a broad care-team platform.

For this phase:

- treat a single unambiguous active direct clinician assignment as the available primary-clinician route;
- confirm that the recipient currently has the required clinical-review permission;
- if there is no usable unambiguous recipient, preserve the case and create a durable task routed to `SYSTEM_UNROUTED_QUEUE`;
- create an `OperationalIncident` for the unrouted condition;
- never discard the case because routing is incomplete;
- never choose a clinician through arbitrary lexical/random ordering when the assignment state is ambiguous.

A later operational/configuration phase may add richer queue/fallback configuration.

## 4.7 Level-2 staleness is time-dependent

The Master Specification requires clinician visibility to become stale when a newer period passes its due time without the corresponding valid item.

Phase 5 does not need an engagement worker merely to show the correct clinician status.

Prefer a projection that stores enough authoritative source/freshness data to derive:

```text
CURRENT_ACTIVE
CURRENT_CLEARED
STALE_DATA_UNAVAILABLE
REVOKED_BY_REVISION
```

at read time from the injected backend clock and scheduled-period due state.

Do not calculate staleness in React.

The Phase 6 engagement sweep may later materialize additional time-driven operational state; it must not be required for Phase 5 clinician reads to be truthful.

## 4.8 Seed content is development/demo content, not real-patient approval

The resolver requires approved resources to demonstrate the complete system, but real-patient readiness remains outside Phase 5.

Add deterministic development seed content sufficient to exercise the locked resource-volume gate for the single supported prototype locale.

Requirements:

- seed content must be clearly identified in provenance as development/prototype content;
- use the existing synthetic seeded actor/reviewer mechanism where practical;
- it may use `APPROVED` review state so the resolver can operate in the development product;
- the implementation/documentation must not imply that prototype fixtures represent external clinical/regulatory approval;
- real-patient mode remains blocked by later readiness requirements.

Do not build the Admin content-governance workflow in this phase.

---

# 5. Phase 5 scope

## 5.1 Included

Phase 5 includes:

### Content domain

- logical `ContentResource`;
- immutable `ContentResourceVersion`;
- review state persisted for resolver eligibility;
- enabled/effective/retired state;
- intervention-class ownership;
- recovery-goal compatibility;
- single supported prototype locale/language;
- delivery-channel compatibility;
- mutual-help requirement;
- spiritual requirement;
- safety-gate compatibility;
- contraindication metadata;
- constrained Markdown content body;
- deterministic content eligibility;
- deterministic rotation;
- resource cooldown;
- explicit refusal/suppression state;
- resource-volume gating;
- content resolution records;
- available follow-up;
- content delivery/audit history;
- deterministic development seed resources.

### Patient support behavior

- proactive selected support after a qualifying current evaluation;
- at most two proactive intervention classes;
- lower-priority eligible follow-up represented separately;
- manual “show more/explore” as user-requested support;
- manual browse never bypasses eligibility;
- cooldown override only where the Master permits `USER_REQUEST`;
- `DISMISS`;
- `NOT_HELPFUL`;
- `DONT_SHOW_THIS_TYPE`;
- explicit restoration of a hidden intervention class;
- neutral `CONTENT_UNAVAILABLE`;
- no resubmission requirement when support is unavailable;
- post-check-in support projection;
- Patient Support page.

### Clinician visibility

- Level-2 visibility projection for the locked current flags/context;
- freshness/source provenance;
- current/cleared/stale/revision-revoked semantics;
- reduction target-not-met visibility where the Master requires it;
- no acknowledgement/task for Level 2.

### Clinical Level 3

Only the locked reason families:

```text
CRAVING_LOW_CONFIDENCE
MOOD_CRAVING
PERSISTENT_HIGH_CRAVING
PERSISTENT_HIGH_NEGATIVE_MOOD
CONSECUTIVE_USE
RECURRENT_USE
```

Implement:

- persisted current reason state;
- immutable reason history;
- activation;
- clearance pending;
- resolved;
- revision revocation;
- one open subjective clinical case per patient;
- multiple independent reasons inside one case;
- `NEW`;
- acknowledgement event;
- `ACTIVE`;
- `CLEARANCE_PENDING`;
- `RESOLVED`;
- `RESOLVED_CORRECTION`;
- materially-new-reason detection;
- no repeat notification/task for unchanged open reasons;
- new case ID after a previously resolved case qualifies again.

### Durable clinician task

Implement the internal durable task as business state:

- case type `CLINICAL`;
- case ID;
- patient;
- recipient type;
- recipient ID;
- eligibility time;
- created/delivered time;
- delivery status;
- attempt count fields required by the canonical schema;
- update-required marker for corrected/revoked prior notifications/tasks;
- unrouted incident linkage.

For the Phase 5 in-app task:

- a successfully persisted/routed task may become `DELIVERED_TASK` synchronously because it is immediately available in the authenticated Review Queue;
- optional auxiliary email/push is not required;
- background retry states may be represented in schema for compatibility but their worker mechanics remain Phase 6 unless literally required.

### Clinician product surface

- Review Queue;
- patient monitoring detail;
- Level-2 current visibility;
- active/clearance-pending clinical reasons;
- case lifecycle;
- source period/revision/completeness/freshness;
- durable task state;
- acknowledgement action;
- correction-aware case history;
- permission/restricted states.

---

## 5.2 Explicitly excluded

Do **not** implement in Phase 5:

- missed-check-in engagement state;
- first/second missed-check-in reminders;
- engagement Level-2 timing;
- disengagement cases;
- `RETURNED_AFTER_GAP`;
- opt-out engagement transitions;
- technical-failure `NONE → SUSPECTED → CONFIRMED → RESOLVED`;
- technical-failure pause/recovery timing;
- engagement sweep workers;
- reminder workers;
- broad pg-boss worker platform unless a locked Phase 5 invariant cannot otherwise be met;
- auxiliary email or push for ordinary Level-3 review;
- Resend clinician-review messages;
- notification-provider callbacks;
- retry schedules for external auxiliary delivery;
- notification bundling across clinical/engagement cases;
- full service fallback/care-team routing configuration;
- Admin Content Management UI;
- content draft/review/approval authoring workflow;
- Admin Operations;
- Audit Explorer;
- full Clinician Overview dashboard;
- Clinician Engagement screen;
- Patient Home;
- Patient Progress charts;
- generic search/analytics platform;
- use-event reconciliation expansion;
- predictive ML;
- EMA;
- automatic Level 4;
- treatment/detox/medication advice;
- real-patient readiness approval;
- backups/retention/deletion work;
- deployment hardening;
- documentation closeout;
- test/validation work during implementation.

---

# 6. Locked patient-content behavior

## 6.1 Intervention classes

The content module consumes only these Phase 4 intervention classes:

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

No new intervention class may be invented.

## 6.2 Total priority

The authoritative order remains:

```text
recurrent use
> current reported use
> craving
> trigger exposure
> negative mood
> low confidence
> relationship problems
> low social support
> recovery-plan review
> positive reinforcement
```

Phase 5 may use the priority metadata produced by Phase 4. It must not reinterpret it as comparative clinical severity.

## 6.3 Proactive class cap

```text
MAX_INTERVENTION_CLASSES_PER_DELIVERY = 2
```

Never proactively show more than:

```text
1 primary
+
1 secondary
```

for one evaluation.

## 6.4 Eligibility pipeline

Every resource selection must pass:

```text
candidate resource
→ APPROVED
→ enabled
→ effective/not retired
→ locale compatible
→ recovery-goal compatible
→ mutual-help/spiritual preference compatible
→ safety compatible
→ contraindication compatible
→ explicit-refusal/suppression compatible
→ delivery-channel compatible
→ resource-volume gate
→ cooldown
→ eligible
```

No manual browse or support-page action may skip this pipeline.

## 6.5 Deterministic resource rotation

Among eligible resources, use the locked deterministic order:

1. explicitly helpful historical resource, when represented in stored interaction history and outside cooldown;
2. never shown before;
3. least recently shown;
4. lowest historical exposure count;
5. lexical `resource_id`.

Do not use random selection.

Do not use an LLM.

Do not use a recommendation model.

## 6.6 Cooldown

```text
SAME_RESOURCE_COOLDOWN_DAYS = 7
```

Cooldown applies to the resource, not the whole class.

Another eligible resource in the same class may be used immediately.

An explicit user request may override resource cooldown only where the Master permits:

```text
cooldown_override_reason = USER_REQUEST
```

The override is audited.

## 6.7 Refusal

### DISMISS

- record interaction outcome where useful;
- create no persistent suppression.

### NOT_HELPFUL

Suppress the specific resource for:

```text
14 days
```

Do not suppress the whole intervention class.

### DONT_SHOW_THIS_TYPE

- persist a class-level suppression;
- no automatic expiration;
- require explicit user confirmation;
- provide an explicit restoration action;
- do not silently clear the suppression on a later assessment.

## 6.8 CONTENT_UNAVAILABLE

If no resource is eligible:

```text
content_result = CONTENT_UNAVAILABLE
```

Persist the resolution outcome.

Do not:

- violate safety;
- violate preference;
- ignore contraindications;
- ignore approval state;
- ignore locale;
- ignore refusal;
- ignore cooldown;
- invent fallback wording in React.

## 6.9 Resource-volume gate

For each supported prototype locale:

High-frequency classes require at least:

```text
3 approved enabled eligible resources
```

High-frequency:

```text
CRAVING_COPING_SUPPORT
SELF_EFFICACY_SUPPORT
MOOD_COPING_SUPPORT
TRIGGER_MANAGEMENT_SUPPORT
```

Other intervention classes require at least:

```text
2 approved enabled resources
```

A class below its minimum is disabled for patient delivery.

The development seed should intentionally satisfy this gate for the single supported prototype locale so Phase 5 can be demonstrated end-to-end.

## 6.10 Safe content rendering

Store patient-facing body as constrained Markdown plus structured metadata.

Rules:

- raw HTML disabled;
- no `dangerouslySetInnerHTML` rendering of stored content;
- executable HTML/JavaScript rejected;
- unsafe URL schemes rejected;
- links use one safe-link policy;
- renderer is reusable for the future Admin preview;
- patient UI renders the backend-selected resource version exactly.

Use a small established Markdown/sanitization library if required rather than writing a general Markdown parser.

---

# 7. Locked clinician behavior

## 7.1 Level 2 is visibility only

Level-2 observations are:

- dashboard/patient-detail visibility;
- not cases;
- not tasks;
- not acknowledged;
- not outbound notifications.

Status vocabulary:

```text
CURRENT_ACTIVE
CURRENT_CLEARED
STALE_DATA_UNAVAILABLE
REVOKED_BY_REVISION
```

Level-2 projection must preserve:

- source scheduled period;
- source assessment;
- authoritative revision;
- completion status;
- observed item/coverage;
- source timestamp;
- freshness/stale boundary;
- goal context where relevant.

## 7.2 Level-3 whitelist

No reason outside the six locked reason families can open the subjective clinical case.

In particular, do not create Level 3 from:

- high risk aggregate alone;
- weak protection alone;
- reduction target not met;
- WHO context;
- one delta alone;
- sleep;
- low social support alone;
- relationship problems alone;
- count of abnormal domains.

## 7.3 Persisted reason lifecycle

Canonical state:

```text
INACTIVE
→ ACTIVE
→ CLEARANCE_PENDING
→ RESOLVED
```

Correction state:

```text
REVOKED_BY_REVISION
```

The clinical subsystem consumes the reason lifecycle generated by monitoring.

Critical rule:

- a non-use PARTIAL assessment cannot newly activate a Level-3 reason;
- an already-open reason may remain active/clearance-pending across missing data according to the Phase 4 lifecycle;
- valid U1 recurrence may activate on PARTIAL when the Master permits it.

Therefore, use:

```text
Phase 4 candidate clinician eligibility
+
Phase 4 lifecycle snapshot
+
previous persisted clinical state
```

Do not use the raw lifecycle snapshot alone as permission to create a new case.

## 7.4 One open clinical case

At most one subjective-monitoring clinical review case may be open per patient.

Enforce with a database constraint/partial unique index, not only an application query.

## 7.5 Case lifecycle

```text
NEW
→ ACKNOWLEDGED
→ ACTIVE
→ CLEARANCE_PENDING
→ RESOLVED
```

Correction terminal state:

```text
RESOLVED_CORRECTION
```

A practical projection may record the acknowledgement transition in immutable case events and leave the current case projection `ACTIVE` immediately when active reasons remain.

The acknowledgement must never make the reason disappear.

## 7.6 Multi-reason semantics

Every reason clears independently.

Case current projection:

If at least one reason is ACTIVE:

```text
lifecycle = ACTIVE
current_tier = LEVEL_3
```

If no reason is ACTIVE and at least one is CLEARANCE_PENDING:

```text
lifecycle = CLEARANCE_PENDING
current_tier = NONE
followup_visibility = true
highest_historical_tier = LEVEL_3
```

Close only when every reason is:

```text
RESOLVED
or
REVOKED_BY_REVISION
```

## 7.7 Re-notification/task rule

Create a new task for an already-open case only when:

- a materially new Level-3 reason family appears; or
- a later implementation introduces a genuine tier increase.

V1 subjective monitoring has no automatic Level-4 tier increase.

Therefore Phase 5 re-tasking is normally:

```text
materially new reason
```

Do not create a duplicate task every time the same active reason is re-evaluated.

Do not task solely because the case is in clearance pending.

## 7.8 Correction

If a correction removes the final valid reason:

```text
case.lifecycle = RESOLVED_CORRECTION
```

Prior tasks remain in history.

Mark the already-created task/notification representation with:

```text
alert_update_required = true
```

or the closest explicit field implementing the Master’s update-required semantics.

Do not delete the old task.

## 7.9 Historical backfill

A historical reason that would have qualified in the past must not create a retroactive task solely for that past state.

If forward recomputation changes the **current** authoritative reason state and the Phase 4 effect plan says the current reason is eligible, the clinical subsystem may create/reconcile the current case.

Always consume the effect plan; do not infer this from trigger names in React or route code.

---

# 8. Data-model additions

Use relational stable identities and query keys. Use JSONB only for structured metadata/provenance where appropriate.

## 8.1 Content tables

Add the locked families:

```text
content_resources
content_resource_versions
content_feedback
content_suppressions
content_resolution_records
available_followups
content_delivery_audits
```

### content_resources

Logical resource identity.

Recommended ownership:

```text
id/resource_id
intervention_class
current_approved_version_id where useful
created_at
created_by
```

Do not store mutable approved body text here.

### content_resource_versions

Immutable resource versions.

Persist enough to reproduce eligibility:

```text
resource_version_id
resource_id
version
intervention_class
locale
language
recovery_goals_allowed
delivery_channels
mutual_help_requirement
spiritual_requirement
contraindications
safety_gate_compatibility
estimated_duration
markdown_body
review_status
reviewed_by
reviewed_at
effective_from
retired_at
enabled
created_at
provenance
```

Approved versions are immutable.

### content_feedback

Persist user interaction against exact resource/version/delivery context.

At minimum:

```text
patient
resource
resource_version
resolution/delivery reference
outcome
recorded_at
```

### content_suppressions

Represent:

```text
RESOURCE_NOT_HELPFUL
INTERVENTION_CLASS_DONT_SHOW
```

Persist:

```text
patient
scope type
resource/class
starts_at
expires_at nullable
ended_at nullable
source feedback
reason
```

`DONT_SHOW_THIS_TYPE` has no automatic expiry.

### content_resolution_records

Every attempted content resolution stores:

```text
patient
source assessment/evaluation
source intervention intent(s)
resolver input/version
content result
selected resource/version(s)
selection reasons
filter summary
cooldown result
effect/suppression result
resolved_at
```

Store `CONTENT_UNAVAILABLE`.

### available_followups

Persist:

```text
patient
source evaluation
intervention class/resource candidate
available_from
expires_at
superseded/revoked status
```

Expiry is the next weekly evaluation.

A corrected authoritative current assessment supersedes follow-up from the old revision.

### content_delivery_audits

For an in-app resource that is actually surfaced as selected support, persist the Master-required delivery provenance.

Do not call a resource “delivered” merely because it existed in the database.

## 8.2 Clinical tables

Add:

```text
clinician_visibility_flags
clinical_reason_states
clinical_reason_history
clinical_review_cases
clinical_case_events
```

### clinician_visibility_flags

Current clinician-facing projection with enough source information to derive current/cleared/stale/revoked truth.

Do not overwrite immutable Phase 4 state history.

### clinical_reason_states

One current state per:

```text
patient + reason_family
```

Persist:

```text
status
activated_at_period_id
clearance_count
last_evaluated_period_id
source evaluation/revision
updated_at
```

### clinical_reason_history

Immutable transition records:

```text
reason family
from status
to status
source evaluation
source revision
period
trigger
effect
recorded_at
correction/revocation metadata
```

### clinical_review_cases

Persist the Master case shape.

At minimum:

```text
case_id
patient_id
active_reason_families
lifecycle
current_tier
highest_historical_tier
followup_visibility
created_at
acknowledged_at
resolved_at
version
```

Reason history may be queried relationally rather than duplicated as an unbounded JSON list.

### clinical_case_events

Immutable case lifecycle/event history.

Examples:

```text
CASE_CREATED
CASE_ACKNOWLEDGED
CASE_BECAME_ACTIVE
REASON_ADDED
REASON_CLEARANCE_PENDING
REASON_RESOLVED
REASON_REVOKED
CASE_CLEARANCE_PENDING
CASE_RESOLVED
CASE_RESOLVED_CORRECTION
CASE_REACTIVATED
```

Do not build event sourcing; the case row remains the current authoritative projection.

## 8.3 Durable task table

Add:

```text
clinician_tasks
```

Persist the canonical source-of-truth fields needed now and later:

```text
task_id
case_type
case_id
patient_id
recipient_type
recipient_id nullable
eligibility_recorded_at
created_at
delivery_status
attempt_count
next_attempt_at nullable
operational_incident_id nullable
alert_update_required
created_reason/cause
```

Use a duplicate-prevention identity so the same case/reason state cannot accidentally create the same task twice under retry.

Do not add `notification_deliveries` unless the Phase 5 implementation actually sends an external auxiliary notification. It should not.

---

# 9. Authorization additions

Extend the existing permission registry using the current role/scope model.

Use the smallest explicit permissions required.

Recommended Phase 5 permissions:

```text
PATIENT_SUPPORT_READ
PATIENT_SUPPORT_FEEDBACK

PATIENT_MONITORING_READ
CLINICAL_REVIEW_READ
CLINICAL_REVIEW_ACKNOWLEDGE
```

Assignments:

### PATIENT

Own-record only:

```text
PATIENT_SUPPORT_READ
PATIENT_SUPPORT_FEEDBACK
```

Do not grant patient access to raw clinical reason/case data.

### CLINICIAN

Assigned-patient only:

```text
PATIENT_MONITORING_READ
CLINICAL_REVIEW_READ
CLINICAL_REVIEW_ACKNOWLEDGE
```

Continue to use existing assessment staff-correction permission separately.

### ADMIN / OPERATIONS

Do not grant blanket clinical-review access merely because the workspace is administrative.

Later operations/content governance gets its own explicit permissions.

All clinician patient/case lookup must scope the actor **before** returning record existence/details.

---

# 10. API boundary

Use purpose-built read models and explicit actions.

Do not expose Prisma rows directly.

## 10.1 Patient support reads

Provide one coherent current support read model, for example:

```text
GET /api/v1/patient/support
```

Response should be backend-owned and may include:

```text
current selected support
secondary selected support
available follow-up
content unavailable state
resource/version identity
title
safe body/markdown
estimated duration
interaction controls
hidden intervention classes
source assessment period/revision where appropriate
```

The patient API must not expose:

```text
HIGH_CRAVING
CRAVING_LOW_CONFIDENCE
LEVEL_3
raw risk score
internal resolver reason codes not needed by UI
```

## 10.2 Patient support feedback

Use explicit action endpoints, e.g.:

```text
POST /api/v1/patient/support/resources/:resourceId/feedback
```

Contract action:

```text
DISMISS
NOT_HELPFUL
DONT_SHOW_THIS_TYPE
```

Require an idempotency key for persistent/consequential feedback.

`DISMISS` may be recorded without a persistent suppression.

For class restoration use an explicit action such as:

```text
POST /api/v1/patient/support/intervention-classes/:class/restore
```

Do not expose a generic PATCH over suppression rows.

## 10.3 Manual support request/browse

If the Support page allows “show more” or class exploration, use an explicit backend read/action that:

- re-runs the eligibility pipeline;
- records `USER_REQUEST` cooldown override only where used;
- never exposes blocked/unsafe resources;
- never lets the browser pick from the full content table.

## 10.4 Clinician Review Queue

Provide a purpose-built route, for example:

```text
GET /api/v1/clinician/review-queue
```

Return only tasks/cases available to the authenticated clinician.

Include useful projection fields:

```text
task id
case id
patient identity allowed by scope
reason summary
case lifecycle
since/created time
source period
freshness
task delivery status
new/acknowledged state
```

## 10.5 Clinician patient monitoring detail

Prefer extending the existing clinician patient-detail read model if that keeps one request per screen.

The read model should expose:

- current Level-2 monitoring observations;
- freshness;
- source period;
- submission time;
- authoritative revision;
- COMPLETE/PARTIAL;
- goal effective for the source period;
- active reasons;
- clearance-pending reasons;
- clinical case summary;
- case/task history needed for the current workflow.

Do not send raw audit events as the clinician timeline.

## 10.6 Case acknowledgement

Explicit action:

```text
POST /api/v1/clinician/review-cases/:caseId/acknowledge
```

Requirements:

- assigned-patient scope;
- explicit permission;
- expected case version if the projection is mutable/versioned;
- idempotency key;
- actor/time provenance;
- no arbitrary status payload;
- no generic “resolve” endpoint.

Case resolution remains driven by monitoring/recompute/correction state.

---

# 11. Patient UI requirements

## 11.1 Post-check-in result

After a successful assessment:

If support is selected:

- show neutral check-in completion;
- show backend-selected primary resource;
- show secondary resource only if present;
- offer `View support`;
- offer `Show more support` only when backend follow-up is available/permitted.

If no content is available:

- keep the assessment successful;
- show a neutral “support is not available right now” state;
- do not reveal resolver failure internals;
- do not ask the patient to submit again.

## 11.2 Support page

Add a polished patient Support destination.

It may contain:

```text
Recommended for you
Available follow-up
Explore support
Hidden support types / manage preference
```

Rules:

- recommendations come from backend resolution;
- browsing goes through backend eligibility;
- blocked safety state does not expose ordinary support;
- preference-incompatible spiritual/mutual-help content never leaks in titles/previews;
- `DONT_SHOW_THIS_TYPE` requires consequential confirmation;
- restoring a hidden type is explicit.

## 11.3 Resource rendering

Present:

- title;
- estimated duration;
- content body;
- safe links;
- allowed feedback controls.

Do not display:

- resource review internals;
- clinical flags;
- clinician reason families;
- patient “risk level”;
- synthetic recovery score.

## 11.4 Patient navigation

Add Support only when the real Phase 5 capability exists.

Do not fabricate Patient Home or Progress merely to match the final product map.

---

# 12. Clinician UI requirements

## 12.1 Review Queue

Add a real Review Queue destination.

The queue must communicate:

- patient;
- reason in clinician-readable wording;
- new/active/clearance-pending state;
- source period;
- age/since;
- task state;
- no fake severity gauge.

Do not display Level-2 visibility rows as Review Queue tasks.

## 12.2 Patient monitoring detail

Extend the current clinician patient surface with a monitoring/review area.

Display enough provenance to distinguish fresh from stale/partial/corrected data:

```text
source period
submitted time
revision
COMPLETE/PARTIAL
freshness
goal context
visibility state
```

## 12.3 Current clinical review

Show:

- case lifecycle;
- active reason families;
- clearance-pending reason families;
- created/acknowledged time;
- source observations;
- durable task state;
- correction/revocation history when relevant.

Do not expose a generic state editor.

## 12.4 Acknowledge action

For a `NEW` case:

```text
Acknowledge review
```

After acknowledgement:

- actor/time is recorded;
- immutable case event is created;
- current case remains active when active reasons still exist;
- no reason is cleared merely by acknowledgement.

---

# 13. Integration into assessment submission/recompute

This is the most important Phase 5 engineering boundary.

## 13.1 Current submission

Inside the existing ordered patient transaction:

```text
patient lock
→ authoritative assessment/revision
→ monitoring evaluation
→ Phase 4 derived persistence
→ Phase 5 content resolution
→ Phase 5 clinician visibility reconciliation
→ Phase 5 clinical reason/case reconciliation
→ durable clinician task if newly eligible
→ audit
→ idempotency result
```

Do not run a second independent post-commit clinical calculation.

## 13.2 Current patient correction

A current patient correction may:

- replace current support resolution;
- expire/revoke old available follow-up;
- select newly eligible current support;
- update visibility;
- activate/clear/revoke clinical reasons;
- create/reconcile the open case;
- mark prior task update-required if its reason was invalidated;
- create a new task only when a materially new currently eligible reason appears.

## 13.3 Staff correction

Staff correction:

- recomputes monitoring;
- updates clinician visibility;
- updates clinical reasons/cases;
- keeps patient content trigger-suppressed according to Phase 4;
- may keep current clinician reason eligibility where Phase 4 says `ELIGIBLE`;
- never sends patient support automatically merely because staff edited the assessment.

## 13.4 Historical backfill

Historical period effects remain historical-only.

The forward recomputation can still change the current authoritative monitoring state.

Phase 5 follows the effect plan of each recomputed evaluation.

Do not create a historical patient resource or a historical task merely because an old period once qualified.

## 13.5 Idempotency

Repeated assessment/correction/backfill requests must not duplicate:

- content resolution;
- delivery audit;
- feedback;
- reason history;
- clinical case;
- case event;
- clinician task;
- operational incident.

Reuse existing `executeIdempotently(...)`.

## 13.6 Patient serialization

All content/clinical state that depends on ordered patient monitoring history is reconciled while holding the existing patient processing lock.

Do not add another patient lock.

---

# 14. Three-commit implementation plan

| Commit | Identity | Coherent result |
|---|---|---|
| 1 | `feat: add governed patient support resolution` | Content persistence, immutable versions, deterministic resolver, cooldown/refusal/follow-up, prototype seed resources, patient support APIs, and submission/recompute integration for content |
| 2 | `feat: add clinical review cases and durable tasks` | Level-2 visibility, persisted clinical reason state/history, one-open-case lifecycle, correction/backfill reconciliation, recipient routing, durable in-app clinician tasks, and acknowledgement API |
| 3 | `feat: expose patient support and clinician review workflows` | Polished patient post-check-in/Support UI plus clinician Review Queue and monitoring/case detail, using backend-owned read models and permissions |

There is **no planned fourth Phase 5 implementation commit**.

Codex must create all three commits sequentially in the same implementation session.

---

# 15. Commit 1 packet — governed patient support resolution

## Commit identity

```text
feat: add governed patient support resolution
```

## Goal

Turn Phase 4 `PatientInterventionIntent` records into deterministic, auditable, preference/safety-compatible patient support without changing the monitoring rules that produced those intents.

## Assumptions to verify before implementation

Before editing, Codex must verify:

- HEAD is the provided Phase 4 baseline or a descendant containing no Phase 5 implementation;
- `PatientInterventionIntent` remains the canonical patient support intent source;
- Phase 4 effect values remain present;
- safety projection remains authoritative;
- profile preferences/recovery goal can be resolved for the evaluation period;
- there is no existing content module/table family;
- there is no Admin content governance implementation to preserve;
- current submission/correction/recompute services are the authoritative write paths.

## Exact scope

1. Add `content` backend module with explicit service/domain/query boundaries as needed.
2. Add content Prisma tables/enums listed in this guide.
3. Create migration(s) for content persistence.
4. Keep logical resource separate from immutable versions.
5. Prevent approved-version body mutation in normal application service paths.
6. Implement one supported prototype content locale without browser-driven locale guessing.
7. Implement the exact ten intervention classes only.
8. Implement complete resource eligibility pipeline.
9. Implement resource-volume gate.
10. Implement deterministic resource rotation.
11. Implement seven-day same-resource cooldown.
12. Implement `USER_REQUEST` cooldown override.
13. Implement `DISMISS`.
14. Implement 14-day `NOT_HELPFUL` resource suppression.
15. Implement persistent class-level `DONT_SHOW_THIS_TYPE`.
16. Implement explicit class restoration.
17. Persist `CONTENT_UNAVAILABLE`.
18. Persist content resolution provenance.
19. Persist available follow-up with next-evaluation expiry.
20. Revoke/supersede follow-up generated by a superseded current revision.
21. Persist content delivery audit when a selected resource is actually surfaced.
22. Add deterministic development seed content that satisfies the resource-volume gate for every Phase 5-enabled class in the prototype locale.
23. Clearly mark seed provenance as development/prototype.
24. Extend patient-support contracts.
25. Add patient support backend routes.
26. Add the smallest patient-support permissions.
27. Integrate content resolution into current submission, current patient correction, staff correction, backfill, and recompute according to the existing effect plan.
28. If the Phase 4 two-class output cannot represent follow-up candidates without re-deriving thresholds in `content`, make the smallest monitoring-output extension necessary.
29. Never add a second patient intent evaluator.
30. Never select resources in the frontend.

## Expected file-level changes

Likely:

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase_5_content>/migration.sql
apps/backend/prisma/seed.ts
apps/backend/src/modules/content/*
apps/backend/src/modules/assessments/submission-service.ts
apps/backend/src/modules/assessments/correction-service.ts
apps/backend/src/modules/assessments/recompute-service.ts
apps/backend/src/modules/monitoring/*                  # only if follow-up seam requires minimal extension
apps/backend/src/shared/authz/permissions.ts
apps/backend/src/app.ts

packages/contracts/src/content/*
packages/contracts/src/patient/support*
packages/contracts/src/index.ts
```

No clinician UI yet.

No engagement/delivery worker module yet.

No tests/validation/docs.

## Acceptance criteria

1. Only approved, enabled, effective resources can be selected.
2. Safety restrictions cannot be bypassed.
3. Goal compatibility cannot be bypassed.
4. Mutual-help/spiritual preference constraints cannot be bypassed.
5. Explicit refusal cannot be bypassed.
6. Resource cooldown is deterministic.
7. Rotation is deterministic.
8. Resource-volume gate is enforced.
9. `CONTENT_UNAVAILABLE` is persisted rather than throwing or choosing unsafe fallback.
10. Proactive delivery remains capped at two classes.
11. Follow-up is non-autonomous.
12. Follow-up expires at the next evaluation.
13. Staff-trigger-suppressed patient content remains suppressed.
14. Historical-only patient support remains historical-only.
15. Current patient correction can replace current support.
16. Same idempotent assessment request cannot duplicate resolution/audit records.
17. Development seed is clearly prototype-only.
18. No content rule recalculates R/P/U thresholds.
19. No Admin content governance is introduced.
20. No background-delivery infrastructure is introduced without necessity.

## Do not do

- no random resource selection;
- no LLM content selection;
- no browser content selection;
- no raw HTML;
- no patient-facing internal rule codes;
- no force-deliver endpoint;
- no machine translation;
- no content approval UI;
- no generic CMS;
- no email/push;
- no tests/validation/docs.

---

# 16. Commit 2 packet — clinical review cases and durable tasks

## Commit identity

```text
feat: add clinical review cases and durable tasks
```

## Goal

Turn Phase 4 clinician reason/effect outputs into authoritative Level-2 visibility, persisted reason lifecycle, one-open-case Level-3 clinical review, and durable in-app clinician tasks without introducing engagement or auxiliary delivery.

## Assumptions to verify before implementation

- Commit 1 is locally committed.
- Phase 4 evaluation output remains unchanged except any minimal follow-up seam.
- No clinical/delivery module exists.
- Current direct clinician-patient assignment is the only implemented ordinary clinical routing relationship.
- Operational incidents remain reusable.
- existing audit/idempotency/patient-lock helpers remain authoritative.

## Exact scope

1. Add `clinical` module.
2. Add `clinician_visibility_flags`.
3. Add `clinical_reason_states`.
4. Add `clinical_reason_history`.
5. Add `clinical_review_cases`.
6. Add `clinical_case_events`.
7. Add `clinician_tasks` in a minimal `delivery` ownership boundary or equivalent locked module boundary.
8. Add migrations/constraints.
9. Enforce one open clinical review case per patient through DB constraint/index.
10. Persist Level-2 projection independently from Level-3 case state.
11. Project exact stale/cleared/current/revoked Level-2 status from backend authoritative time/source data.
12. Include reduction-target-not-met Level-2 visibility where the Master requires it.
13. Implement only the six Level-3 reason families.
14. Consume Phase 4 candidate clinician eligibility for new activation.
15. Consume Phase 4 lifecycle snapshot and previous persisted reason state for continuation/clearance.
16. Prevent non-use PARTIAL from creating a new Level-3 case.
17. Preserve an already-active reason correctly across missing data.
18. Permit valid PARTIAL U1 recurrence Level-3 behavior.
19. Persist every clinical reason transition immutably.
20. Create new case when first eligible active reason appears and no open case exists.
21. Add materially new reason to existing open case.
22. Do not create duplicate case for a second reason.
23. Keep reasons independent.
24. Derive case `ACTIVE` when any reason active.
25. Derive case `CLEARANCE_PENDING` when no reason active and at least one pending.
26. Close only when all reasons resolved/revoked.
27. Use `RESOLVED_CORRECTION` when correction removes final valid reason.
28. Reappearance during clearance returns case to active.
29. A new qualifying state after a resolved case creates a new case ID.
30. Add immutable case events.
31. Add clinician-review permissions.
32. Add clinician review read routes.
33. Add idempotent acknowledge action.
34. Acknowledge records actor/time/event but never clears a reason.
35. Add durable clinician task creation on initial case eligibility.
36. Create another task only for a materially new reason in the open case.
37. Never task on unchanged reevaluation.
38. Never task solely for clearance pending.
39. Use current direct assignment as recipient only when it is unambiguous and authorized.
40. If no usable recipient exists, preserve the case/task through `SYSTEM_UNROUTED_QUEUE` and create an operational incident.
41. Do not discard a clinical case because notification/delivery routing fails.
42. Mark prior task update-required when a correction invalidates its reason.
43. Integrate clinical reconciliation into current submission/correction/backfill/recompute transaction order.
44. Ensure idempotent retry cannot duplicate case/reason history/tasks.
45. Do not add broad care-team/fallback configuration.
46. Do not add auxiliary email/push.
47. Do not add engagement.

## Expected file-level changes

Likely:

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase_5_clinical>/migration.sql

apps/backend/src/modules/clinical/*
apps/backend/src/modules/delivery/*                    # minimal durable task ownership only
apps/backend/src/modules/assessments/submission-service.ts
apps/backend/src/modules/assessments/correction-service.ts
apps/backend/src/modules/assessments/recompute-service.ts
apps/backend/src/modules/identity/*
apps/backend/src/shared/authz/permissions.ts
apps/backend/src/app.ts

packages/contracts/src/clinician/*
packages/contracts/src/monitoring/*
packages/contracts/src/index.ts
```

No patient UI/clinician UI implementation yet except contract/read-model support.

No worker platform.

No tests/validation/docs.

## Acceptance criteria

1. Level 2 never creates a case/task.
2. Only six locked reason families can create Level 3.
3. Non-use PARTIAL cannot newly create Level 3.
4. Valid recurrence from U1 PARTIAL remains allowed.
5. Missing data does not resolve an active reason.
6. Every reason clears independently.
7. At most one open clinical case exists per patient.
8. Additional reason joins the same open case.
9. Unchanged active reason does not create another task.
10. Clearance pending does not create another task.
11. Correction removing final reason resolves `RESOLVED_CORRECTION`.
12. Prior task remains historical and update-required.
13. Resolved case is never silently reopened; later qualification creates a new case.
14. Historical-only old qualification does not create retroactive task.
15. Current eligible state after recomputation may create/reconcile the current case.
16. Unrouted configuration never discards the case.
17. No arbitrary clinician recipient selection.
18. Case acknowledgement is explicit/idempotent/audited.
19. No generic clinician status mutation endpoint exists.
20. No engagement/auxiliary worker functionality is introduced.

## Do not do

- no Level 3 from aggregates;
- no Level 3 from WHO;
- no Level 3 from target-not-met alone;
- no Level 4;
- no “resolve case” button/action divorced from domain state;
- no repeated task spam;
- no task deletion on correction;
- no admin blanket clinical access;
- no engagement;
- no email/push;
- no tests/validation/docs.

---

# 17. Commit 3 packet — patient support and clinician review workflows

## Commit identity

```text
feat: expose patient support and clinician review workflows
```

## Goal

Expose the completed Phase 5 backend through polished, backend-authoritative patient and clinician product surfaces without moving domain logic to React.

## Assumptions to verify before implementation

- Commits 1 and 2 are locally committed.
- Patient support API returns safe backend-owned content.
- Clinical Review Queue/read models exist.
- Case acknowledgement action exists.
- Existing patient/clinician shells and design-system patterns remain authoritative.
- Existing Check-in result/history flows remain working and must be extended rather than replaced.

## Exact scope

### Patient

1. Add Support navigation destination.
2. Add post-check-in support presentation.
3. Show backend-selected primary/secondary resource.
4. Show `CONTENT_UNAVAILABLE` neutral state.
5. Show available follow-up only when backend provides it.
6. Add Support page.
7. Add manual “show more/explore” through backend eligibility.
8. Add safe Markdown rendering component.
9. Add `DISMISS`.
10. Add `NOT_HELPFUL`.
11. Add consequential confirmation for `DONT_SHOW_THIS_TYPE`.
12. Add explicit restoration of hidden class.
13. Preserve safety-controlled shell behavior.
14. Do not display raw monitoring/clinical codes.
15. Do not ask the patient to repeat a successful check-in because content is unavailable.

### Clinician

16. Add Review Queue navigation destination.
17. Add polished review queue.
18. Distinguish NEW / ACTIVE / CLEARANCE_PENDING.
19. Show task status without equating it to clinical severity.
20. Extend clinician patient detail with current monitoring state.
21. Show Level-2 flags as visibility, not tasks.
22. Show freshness/stale/revoked/cleared truth.
23. Show source period, submission time, revision, completeness, and goal context.
24. Show current clinical review case.
25. Show active and clearance-pending reasons.
26. Show case created/acknowledged state.
27. Add acknowledgement action only when allowed.
28. Show correction/revocation history necessary to understand the current case.
29. Use designed restricted/empty/loading/error states.
30. Keep authorization backend-owned.
31. Do not expose Admin/Operations work.
32. Do not add Engagement page content.
33. Do not build full Clinician Overview metrics yet.
34. Do not build Patient Home/Progress yet.

## Expected file-level changes

Likely:

```text
apps/web/src/features/patient/support/*
apps/web/src/features/patient/check-in/*
apps/web/src/features/clinician/review/*
apps/web/src/features/clinician/patients/*
apps/web/src/components/patterns/*
apps/web/src/app/*
apps/web/src/api/*

packages/contracts/src/patient/*
packages/contracts/src/clinician/*
packages/contracts/src/index.ts
```

Add the smallest package dependency required for safe constrained Markdown rendering if the repository does not already contain one.

No backend domain rewrite should be necessary except small read-model corrections found while integrating the real UI.

No tests/validation/docs.

## Acceptance criteria

1. Patient Support renders only backend-selected resources.
2. Support browse cannot bypass backend eligibility.
3. Patient never sees raw clinical flags/reason codes/tiers.
4. `CONTENT_UNAVAILABLE` does not look like failed assessment submission.
5. DONT_SHOW confirmation is explicit.
6. Hidden class can be explicitly restored.
7. Safety-controlled state still takes precedence over ordinary Support.
8. Clinician Review Queue contains Level-3 work only.
9. Level-2 observations appear in monitoring detail without task/ack controls.
10. Stale/partial/corrected data is visually explicit.
11. Review case shows multiple reason families correctly.
12. Acknowledge action is available only when authorized/state-valid.
13. No generic case-state editor exists.
14. No browser code recalculates clinical state.
15. No fake dashboard counts or invented metrics.
16. Existing Check-in/onboarding/safety workflows are reused, not rewritten.
17. UI remains responsive and uses existing design-system language.
18. No Phase 6/7 surface is falsely implemented.

## Do not do

- no client-side content resolver;
- no client-side clinician reason resolver;
- no invented “risk percentage”;
- no generic dashboard filler;
- no Patient Home/Progress;
- no Engagement page;
- no Admin content manager;
- no email/push;
- no tests/validation/docs.

---

# 18. Whole-phase invariants

These invariants apply across all three commits.

## 18.1 Domain authority

```text
monitoring
→ emits deterministic intent/reason/effect
content
→ selects patient resource
clinical
→ persists visibility/reason/case
delivery
→ persists durable task
```

No lower layer may reimplement the higher layer’s rules.

## 18.2 Patient support and clinical review are independent

A patient may receive support without a Level-3 case.

A Level-3 case may exist when patient support is unavailable/suppressed.

Never model:

```text
content delivered == clinician case
```

or:

```text
content unavailable == no clinical eligibility
```

## 18.3 Delivery state never changes clinical tier

Routing/delivery failure:

- does not lower severity;
- does not raise severity;
- does not remove the case;
- does not alter reason state.

## 18.4 Safety precedence

Safety can restrict patient support.

Safety does not erase:

- the assessment;
- the monitoring observation;
- clinician visibility;
- clinician reason eligibility.

Do not infer safety from weekly negative mood.

## 18.5 Historical truth

Never mutate:

- submitted assessment revisions;
- approved content versions;
- clinical reason history;
- clinical case events;
- prior clinician tasks.

Use current projection + immutable history.

## 18.6 Current authoritative revision

Content, visibility, reason state, and clinical case current projections must trace to the authoritative monitoring history.

A superseded assessment revision cannot remain the source of a current patient recommendation or current clinician state.

## 18.7 Patient lock

If a Phase 5 mutation changes patient-specific ordered monitoring-derived state, acquire the existing patient processing lock first.

## 18.8 Audit

Consequential transitions use the existing append-only audit model.

Examples:

```text
CONTENT_FEEDBACK_NOT_HELPFUL
CONTENT_CLASS_SUPPRESSED
CONTENT_CLASS_RESTORED
CLINICAL_CASE_CREATED
CLINICAL_CASE_ACKNOWLEDGED
CLINICAL_REASON_TRANSITION
CLINICIAN_TASK_CREATED
CLINICIAN_TASK_UNROUTED
CASE_RESOLVED_CORRECTION
```

Do not duplicate sensitive content bodies/raw questionnaire responses into audit metadata unnecessarily.

---

# 19. Phase 5 acceptance matrix

Phase 5 implementation is functionally complete only when the code supports all of the following, even though validation is performed later.

## Content/support

1. Eligible current craving intent resolves to an approved compatible resource.
2. Preference-incompatible content is filtered.
3. Safety-incompatible content is filtered.
4. Goal-incompatible content is filtered.
5. Disabled/unapproved content is filtered.
6. Resource-volume gate can disable a class.
7. Never-shown resource wins before recently shown resource.
8. Cooldown prevents proactive same-resource repetition.
9. Another resource in same class may be used.
10. User request can produce audited cooldown override where allowed.
11. NOT_HELPFUL suppresses only that resource for 14 days.
12. DONT_SHOW suppresses the whole class until explicit restoration.
13. CONTENT_UNAVAILABLE preserves the underlying intent.
14. Historical/backfill-only effects do not deliver old support.
15. Staff correction does not automatically deliver patient support.
16. Current patient correction may replace the current recommendation.
17. Superseded follow-up is not left available.
18. Idempotent replay does not duplicate content audit.

## Clinician visibility

19. Current active item becomes Level-2 visible.
20. Current cleared item becomes Level-2 cleared.
21. Missing newer data becomes stale after the authoritative due boundary.
22. Correction can revoke old visibility.
23. PARTIAL containing an item updates that item.
24. PARTIAL omitting an item does not fabricate a current value.
25. Reduction target-not-met is visible at Level 2 only.

## Clinical reasons/cases

26. CRAVING_LOW_CONFIDENCE can create Level 3.
27. MOOD_CRAVING can create Level 3.
28. persistent high craving can create Level 3 at the locked condition.
29. persistent high negative mood can create Level 3 at the locked condition.
30. consecutive abstinence-goal use can create Level 3.
31. recurrent abstinence-goal use can create Level 3.
32. no other monitoring state can create Level 3.
33. second reason joins the same open case.
34. unchanged reason does not create duplicate task.
35. missing data does not resolve the case.
36. clearance pending remains visible.
37. all reasons resolved closes the case.
38. correction removing final reason uses RESOLVED_CORRECTION.
39. reappearance during clearance reactivates same open case.
40. new qualification after resolved case creates new case ID.
41. historical-only old qualification does not retroactively task.
42. current state changed by recomputation can reconcile the current case.

## Durable task

43. New case creates one durable task.
44. Materially new reason can create a new task on the existing case.
45. Unchanged reason does not.
46. clearance pending does not.
47. ambiguous/unavailable routing becomes SYSTEM_UNROUTED_QUEUE + incident.
48. case remains even when task cannot be routed.
49. correction does not delete prior task.
50. invalidated prior task is marked update-required.
51. clinician sees only tasks within assignment/permission scope.

## UI

52. patient sees safe content, not internal codes.
53. patient sees neutral content-unavailable state.
54. support browse remains backend-authoritative.
55. clinician Review Queue shows Level-3 work only.
56. Level-2 state is visibly distinct from Level 3.
57. source/freshness/completeness are visible.
58. clinician can acknowledge NEW review.
59. clinician cannot arbitrarily resolve/edit reason state.
60. no Phase 6/7 functionality is falsely presented.

---

# 20. Phase 5 “do not do” master list

Codex must not:

- change questionnaire thresholds;
- change recurrence semantics;
- change persistence/clearance semantics;
- add a new clinical reason;
- add Level 4;
- infer suicide risk from negative mood;
- treat one U1 positive as diagnosed relapse;
- recompute content classes from raw weekly answers;
- select content in React;
- use random content selection;
- use LLM content selection;
- bypass preference/safety/approval/cooldown/refusal;
- mutate approved content version in place;
- mutate submitted assessment revision in place;
- delete old clinical reason history;
- delete old tasks on correction;
- create repeated task spam;
- create Level-3 case from Level-2 flag;
- merge future engagement and clinical cases;
- build missed-check-in engagement;
- build technical failures;
- build auxiliary ordinary-review email/push;
- add broad worker infrastructure prematurely;
- add Redis/message broker;
- add microservices;
- add generic repository/DI/CQRS frameworks;
- add Admin content governance;
- add Admin Operations;
- add full deployment hardening;
- add Patient Home/Progress;
- add fake dashboard metrics;
- add tests/validation-only files during implementation;
- run the full validation sweep;
- update documentation closeout;
- push commits.

---

# 21. Codex one-sweep operating instructions

When Phase 5 implementation starts, Codex must follow this exact operating rule.

## Before Commit 1

Inspect:

```text
git status
git log --oneline -n 15
apps/backend/prisma/schema.prisma
apps/backend/src/modules/assessments/
apps/backend/src/modules/monitoring/
apps/backend/src/modules/safety/
apps/backend/src/modules/identity/
apps/backend/src/shared/authz/
apps/backend/src/app.ts
apps/backend/prisma/seed.ts
packages/contracts/src/
apps/web/src/features/patient/
apps/web/src/features/clinician/
apps/web/src/app/
```

Read the governing docs before making domain decisions.

Do not produce a new architecture proposal.

## Commit 1

Implement the complete Commit 1 packet.

Stage only Commit 1 files.

Create:

```text
feat: add governed patient support resolution
```

Do not stop for user approval.

## Commit 2

Immediately inspect the working tree after Commit 1.

Implement the complete Commit 2 packet.

Create:

```text
feat: add clinical review cases and durable tasks
```

Do not stop for user approval.

## Commit 3

Immediately continue.

Implement the complete Commit 3 packet.

Create:

```text
feat: expose patient support and clinician review workflows
```

## After Commit 3

Stop.

Do not:

- push;
- add tests;
- run full validation;
- modify docs;
- start Phase 6.

Final Codex response should be minimal:

```text
Phase 5 implementation sweep complete.

Commit 1: <sha>
Commit 2: <sha>
Commit 3: <sha>

Important caveat: <only if there is one real implementation blocker/caveat>
```

If there is no real caveat, omit it.

---

# 22. Audit/correction sweep — separate from implementation

This section describes what happens **after the user pushes the complete Phase 5 sweep**. Codex must not perform it during the implementation session.

The audit should compare the full Phase 5 diff against:

1. Master Specification;
2. UX Implementation Lock;
3. Locked Implementation Architecture;
4. accepted Phase 4 behavior;
5. this Phase 5 guide.

Audit only for phase-closing blockers.

Classify findings:

```text
P0/P1 — must fix before Phase 5 closes
P2 — useful but non-blocking; defer
cosmetic/nice-to-have — ignore for closeout
```

The correction pass should be **one bounded sweep**, not another sequence of micro-packets.

Do not reopen Phase 5 for:

- aesthetic preference;
- speculative future scale;
- broader refactor;
- extra abstractions;
- non-blocking test coverage;
- future Phase 6/7 work.

---

# 23. Validation sweep — separate from implementation

Only after the complete implementation is audited/corrected should Phase 5 receive one validation sweep.

Validation should focus on the risk structure:

```text
content eligibility
content refusal/cooldown
historical/current effect policy
Level-2 truth/staleness
clinical reason lifecycle
one-open-case invariant
multi-reason case behavior
correction/recompute
idempotency
authorization
durable-task duplication/routing
critical patient support UI
critical clinician review UI
```

Do not run a separate full validation cycle after each implementation commit.

The validation artifact/commands are produced separately after the audit identifies the final implementation HEAD.

---

# 24. Documentation closeout — outside this implementation guide

Documentation status updates are not part of the three Phase 5 implementation commits.

After implementation + audit/correction + validation are complete, documentation may separately record:

- Phase 5 completed status;
- final validated SHA;
- updated implementation baseline;
- remaining Phase 6/7 scope.

Do not mix this with feature commits.

---

# 25. Phase 6 handoff

Phase 5 stops at:

```text
patient support
+
clinician visibility
+
clinical reason/case
+
durable in-app clinician task
```

The next phase owns the time-driven/operational layer, including the remaining locked work such as:

```text
engagement state
missed-check-in reminders
engagement cases
return-after-gap
opt-out timing
technical-failure pause/recovery
background schedules/workers
notification retry/auxiliary delivery where required
broader operational delivery state
```

Phase 6 must consume the durable Phase 5 case/task boundaries rather than merge engagement and clinical cases.

Do not begin Phase 6 until Phase 5 is formally closed.

---

# 26. Final Phase 5 implementation definition

Phase 5 is implemented when this end-to-end path exists:

```text
WEEKLY ASSESSMENT
        ↓
PHASE 4 DETERMINISTIC EVALUATION
        ↓
        ├─────────────────────────────────────┐
        │                                     │
        ▼                                     ▼
PATIENT INTERVENTION INTENT            CLINICIAN REASON
        │                                     │
        ▼                                     ▼
CONTENT ELIGIBILITY                    CLINICAL REASON STATE
        │                                     │
        ▼                                     ▼
DETERMINISTIC RESOURCE                 CLINICAL REVIEW CASE
        │                                     │
        ▼                                     ▼
PATIENT SUPPORT                         DURABLE CLINICIAN TASK
        │                                     │
        ▼                                     ▼
PATIENT SUPPORT UI                     CLINICIAN REVIEW QUEUE
```

while preserving:

```text
safety precedence
missingness
historical effect policy
immutable revisions
immutable content versions
reason/case history
idempotency
patient serialization
authorization
auditability
```

and without advancing into Phase 6/7 functionality.

That is the complete Phase 5 implementation boundary.
