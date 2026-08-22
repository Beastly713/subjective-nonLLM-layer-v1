# AUD Subjective Monitoring V1 — Phase 6 Engagement and Local-Demo Operations Implementation Guide

## Document status

**Status:** **CLOSED**

**Phase:** **6 of 7**

**Phase name:** **Engagement, Missed Check-Ins, and Technical-Failure Workflows**

**Target implementation commits:** **3 balanced commits**

**Execution mode:** **One uninterrupted implementation sweep**

**Closeout mode:** **One autonomous audit + correction + validation sweep**

**Current repository baseline inspected:**  
`d5d6ae71577dbb3f200c721f298b5a9277f3777e` — `docs: refresh post-Phase-5 status`

**Validated Phase 5 implementation head:**  
`f6bc02bff621448fcfdaf20285be3b3e6fe6df15` — `fix: close phase 5 patient support and clinical review`

**Phase 5 closing commit:**  
`9093a21999b64d7451c5f14dd497102a24ae6fec` — `closing: Phase-5`

**Post-Phase-5 documentation refresh:**  
`d5d6ae71577dbb3f200c721f298b5a9277f3777e`

**Phase 6 implementation commits:**

- `0d6020cc74440a8a767a0938c1e5db2add08ae23` — `feat: add deterministic missed-checkin engagement`
- `f5a87a7edea46132a3f468c2eafb0307f50111df` — `feat: add engagement cases and technical operations`
- `10197afb72a0b0d2d0bcee2af9880d863a1fecc7` — `feat: complete phase 6 local demo surfaces`

**Phase 6 implementation-guide commit:**

`dcc2c32ceb41de835af1f2cb510cba2dbf91392c4` — `docs: specs updated`

**Autonomous closeout correction/test commit:**

`a64872a1977b75e653ca6142b13ec08c1fb17e4a` — `fix: close Phase-6 audit findings`

**Validated implementation head:** `a64872a1977b75e653ca6142b13ec08c1fb17e4a`

The closeout documentation was committed as `closing: Phase-6`; this follow-up
documentation commit removes superseded planning and status language.

The implementation-plan sections below are retained as the historical Phase 6
scope and acceptance record. The current status is CLOSED and the closeout
record in section 39.1 is authoritative for validation, deferrals, and the
Phase 7 handoff.

This guide defines the Phase 6 implementation boundary for the **local capstone demonstration**.

It deliberately preserves the locked engagement, scheduling, safety, historical, authorization, audit, and UI/UX semantics while deferring production-only asynchronous/external-delivery infrastructure that is not needed to demonstrate the product locally.

This is not permission to simplify the UI into placeholder screens.

**UI/UX quality remains a first-class implementation requirement.**

The implementation target is:

```text
locked engagement behavior
+
correct persisted business state
+
excellent patient / clinician / operations UI
+
deterministic local demonstration
+
minimal infrastructure
-
production-only external delivery machinery
```

---

# 1. Authority and governing documents

Codex must read the following before implementing Phase 6:

1. `docs/AUD_Subjective_Monitoring_Master_Specification_V1.md`
2. `docs/AUD_V1_Web_Product_Surface_and_UX_Implementation_Lock.md`
3. `docs/AUD_V1_Locked_Implementation_Architecture.md`
4. completed Phase 1 implementation guide
5. completed Phase 2 implementation guide
6. completed Phase 3 implementation guide
7. completed Phase 4 implementation guide
8. completed Phase 5 implementation guide
9. this Phase 6 guide

Authority remains:

```text
Master Specification
>
Web Product / UX Implementation Lock
>
Locked Implementation Architecture
>
accepted completed-phase implementation
>
this Phase 6 guide
>
packet-specific execution instructions
```

This guide may narrow **what is implemented now** for a local prototype.

It does **not** change the target V1 domain behavior.

In particular, do not rewrite or weaken the Master Specification's engagement thresholds, technical-failure formula, safety precedence, missingness rules, case separation, or historical semantics.

---

# 2. Phase 6 execution model

Use the accelerated workflow already adopted for the remaining phases:

```text
LOCKED DOCS + CURRENT HEAD
          ↓
ONE CODEX IMPLEMENTATION SWEEP
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
ONE AUTONOMOUS CLOSEOUT SWEEP
          │
          ├── full Phase-6 audit
          ├── correct all Phase-6 P0/P1 defects immediately
          ├── correct straightforward P2 defects where useful
          ├── add required tests/invariants
          ├── run complete validation
          ├── fix validation failures
          ├── rerun until green
          └── final re-audit
          ↓
PHASE 6 CLOSED
```

Codex must **not stop for approval between the three implementation commits**.

If a substantial implementation issue is discovered, Codex should:

1. inspect the governing docs;
2. determine the intended rule;
3. choose the simplest logical solution consistent with those docs;
4. implement it;
5. continue.

Do not stop simply because a correction is non-trivial.

Only a genuinely irreconcilable governing-document contradiction is a valid reason to stop.

---

# 3. Implementation philosophy

The planning is already done.

Do not wander off.

Do not redesign the platform.

Do not turn Phase 6 into a production messaging platform.

Do not create infrastructure merely because the Locked Architecture describes the eventual real-patient V1 deployment shape.

For this capstone implementation, prefer:

```text
simple
+
deterministic
+
persisted
+
auditable
+
easy to demonstrate
+
easy to connect to a future scheduler
```

over:

```text
background infrastructure
+
provider integrations
+
generic delivery frameworks
+
distributed execution
+
future-proof abstractions
```

At the same time:

> **"Local demo" is not permission to fake domain behavior or downgrade UI quality.**

The patient, clinician, and operations surfaces implemented in this phase must look and behave like real product surfaces and continue the visual quality established in the locked UX documents.

---

# 4. Current repository reality at the Phase 6 baseline

The following observations are based on the repository at:

```text
d5d6ae71577dbb3f200c721f298b5a9277f3777e
```

Codex must inspect the actual local HEAD again before editing.

## 4.1 Phases 1–5 are closed

The codebase already contains:

- identity/authentication/authorization;
- patient profile and schedule;
- safety evaluation and safety cases;
- reduction setup;
- weekly assessment drafts;
- immutable PARTIAL/COMPLETE submissions;
- late submission;
- historical backfill;
- corrections;
- forward monitoring recomputation;
- deterministic monitoring flags/aggregates/longitudinal state;
- governed patient support;
- Level-2 clinician visibility;
- six-family Level-3 clinical review;
- one-open-clinical-case logic;
- durable in-app clinician tasks;
- Patient Support UI;
- clinician Review Queue and monitoring detail.

Phase 6 must consume these accepted boundaries rather than reopen them.

## 4.2 Scheduling already owns authoritative due time

`ScheduledPeriod` already persists:

```text
periodStartAt
periodEndAt
openAt
originalDueAt
effectiveDueAt
version
```

The scheduling module already:

- calculates weekly boundaries on the backend;
- preserves `originalDueAt`;
- reads `effectiveDueAt`;
- supports period provisioning;
- supports explicit due rescheduling;
- uses the existing patient processing lock.

Phase 6 must use this.

Do not create a second engagement-only date calculation or duplicate weekly schedule identity.

## 4.3 Periods can already be materialized deterministically

The scheduling service already contains:

```text
ensureRelevantPeriodsInTransaction(...)
provisionNextPeriodInTransaction(...)
```

The local Phase 6 engagement reconciler should reuse the existing schedule module when it needs currently relevant scheduled periods.

Do not invent a second period generator.

## 4.4 Assessment submission already has the correct ordered-patient transaction seam

The current weekly submission path:

```text
patient lock
→ authoritative revision
→ monitoring recomputation
→ Phase-4/5 downstream reconciliation
→ audit
```

Phase 6 must integrate return-after-gap and engagement reconciliation into this same ordered patient transaction.

Do not add a detached post-commit engagement calculation.

## 4.5 Safety projection already exposes the required engagement pause input

The existing safety projection already exposes:

```text
requiresSafetyShell
monitoringPromptPolicy
reassessmentDueAt
```

Phase 6 should consume:

```text
monitoringPromptPolicy === PAUSE
```

as the authoritative active safety-pause signal.

Do not infer safety from questionnaire answers.

Do not duplicate safety evaluation in `engagement`.

## 4.6 There is currently no engagement module

At the Phase 6 baseline there is no backend:

```text
apps/backend/src/modules/engagement/
```

and no engagement persistence family yet.

That is the correct starting point.

## 4.7 There is currently no broader operations module

There is no general:

```text
apps/backend/src/modules/operations/
```

for technical failures.

Phase 6 may add the **smallest focused operations boundary needed for technical-failure control**.

It must not build the complete Phase 7 operations platform.

## 4.8 pg-boss is not currently installed

The backend package currently does **not** depend on `pg-boss`.

This is important.

The Locked Architecture describes pg-boss as the eventual V1 background execution mechanism, but adding the full worker/scheduler/delivery runtime now would provide little value for the local capstone demonstration and materially enlarge Phase 6.

For this Phase 6 implementation:

```text
DO NOT add pg-boss.
```

Instead, implement the engagement business state so it can later be called by a scheduler without redesign.

## 4.9 External engagement reminder delivery is not present

The current repository has email support for authentication.

It does not have engagement reminder email/push delivery.

Phase 6 must not repurpose authentication email infrastructure into a clinical/engagement notification system.

No engagement Resend messages are required in this phase.

## 4.10 ClinicianTask needs the smallest generic seam for engagement

Phase 5 created durable clinician tasks for clinical cases.

The current model is still clinically shaped in important places, including a clinical-reason-specific cause field.

Phase 6 must generalize this **only enough** to support a separate engagement case/task source.

Do not merge engagement cases into `clinical_review_cases`.

Do not make `ClinicalReasonFamily` represent disengagement.

The intended direction is:

```text
ClinicianTask
├── CLINICAL source
└── ENGAGEMENT source
```

with shared delivery/routing state.

## 4.11 Current web routes leave Phase 6 surfaces cleanly available

The current web application has no:

```text
/patient/home
/clinician/engagement
/admin/operations
```

route.

Phase 6 can add these without replacing accepted Phase-5 screens.

## 4.12 Current PatientShell has no Home destination

The current patient navigation includes setup/check-in/history/support/profile.

The UX lock intends:

```text
Home
Check-in
Progress
Support
Profile
```

Phase 6 should add **Home** because it is the correct current-action and missed-check-in reminder surface.

`Progress` remains later work.

## 4.13 Current ClinicianShell has no Engagement destination

The existing clinician navigation already includes:

```text
Patients
Review Queue
Safety
```

Phase 6 adds:

```text
Engagement
```

as a first-class distinct work queue.

## 4.14 Current AdminShell has no Operations destination

The current Admin workspace already has users, routing, and safety.

Phase 6 adds a focused:

```text
Operations
```

surface for technical failures only.

The complete Phase-7 admin operations dashboard remains later.

## 4.15 Prototype seed is still narrow

The current seed creates the standard:

```text
patient.demo@example.test
clinician.demo@example.test
admin.demo@example.test
```

plus Phase-5 prototype content.

It does not yet create the representative engagement states called for by the architecture.

Phase 6 should add deterministic synthetic engagement demonstration scenarios without putting fake data directly into React.

---

# 5. Locked Phase 6 engagement policy

These rules come from the Master Specification and must not drift.

## 5.1 Engagement is operational, not clinical interpretation

A missed check-in means:

```text
missing monitoring data
```

It does **not** mean:

```text
alcohol use
relapse
worsening condition
clinical deterioration
```

The UI and backend vocabulary must preserve this distinction.

## 5.2 Canonical engagement states

Use only:

```text
ENGAGED
OVERDUE
AT_RISK_OF_DISENGAGEMENT
DISENGAGED
RETURNED_AFTER_GAP
OPTED_OUT
TECHNICAL_FAILURE
```

Do not invent a second set of overlapping engagement severity states.

## 5.3 Timing anchor

Every missed-check-in threshold is measured from:

```text
scheduled_period.effective_due_at
```

Never use:

```text
last completed check-in timestamp
last login
last page visit
last assessment submission timestamp
browser time
```

as the authoritative threshold anchor.

The last completed check-in may be shown as secondary clinician context only.

## 5.4 Exact thresholds

The locked configuration is:

```yaml
first_reminder_days_after_effective_due: 7
second_final_reminder_days_after_effective_due: 14
reminder_cooldown_days: 7
level2_days_after_effective_due: 14
disengagement_case_days_after_effective_due: 30
max_automated_reminders_per_cycle: 2
technical_recovery_grace_hours: 24
```

Phase 6 must put these in the versioned policy/configuration structure rather than scatter numbers through handlers.

Recommended addition to the existing `SUBJECTIVE_MONITORING_V1` policy object:

```ts
engagement: {
  firstReminderDaysAfterEffectiveDue: 7,
  secondFinalReminderDaysAfterEffectiveDue: 14,
  level2DaysAfterEffectiveDue: 14,
  disengagementCaseDaysAfterEffectiveDue: 30,
  maxAutomatedRemindersPerCycle: 2,
  technicalRecoveryGraceHours: 24,
}
```

Do not make these ordinary environment variables.

## 5.5 State timeline

Conceptually:

```text
before effective_due_at
        ↓
ENGAGED / awaiting scheduled submission

effective_due_at passed
        ↓
OVERDUE

effective_due_at + 7 days
        ↓
first neutral reminder eligible

effective_due_at + 14 days
        ↓
second/final reminder eligible
+
AT_RISK_OF_DISENGAGEMENT
+
clinician Level-2 engagement visibility

effective_due_at + 30 days
        ↓
DISENGAGED
+
open Level-3 engagement case
+
durable clinician engagement task

NO third automated reminder
```

Boundary comparisons must be explicit and tested.

At the exact threshold instant, the threshold is considered reached.

## 5.6 One missed cycle, not a new reminder campaign every week

A continuous gap is one missed-check-in cycle.

Do not start another +7/+14 reminder series for every later weekly period while the patient remains in the same unresolved gap.

The cycle anchor is the earliest still-relevant missed scheduled period after the last engagement reset boundary.

A reset boundary occurs after an authoritative return/re-engagement event such as:

- a valid current/late assessment that resolves the gap;
- explicit monitoring re-enable after opt-out;
- initial monitoring activation.

This implementation detail prevents reminder spam while preserving the Master Specification's:

```text
max_automated_reminders_per_missed_cycle = 2
```

## 5.7 Missing clinical data behavior

Engagement logic must not modify Phase-4/5 clinical semantics.

Missing periods continue to mean:

- current weekly observation is UNKNOWN/missing;
- deltas do not bridge the gap;
- persistence does not bridge the gap;
- clearance counts pause;
- existing clinical cases do not resolve simply because data disappeared.

Do not add engagement code that mutates clinical reason states.

## 5.8 Engagement Level 2 is not clinical Level 2

At +14 days, the patient becomes visible as:

```text
AT_RISK_OF_DISENGAGEMENT
```

for engagement purposes.

Do not create:

- a clinical reason;
- a clinical case;
- a clinical Level-3 alert;
- a safety case.

The Clinician Engagement page owns this visibility.

## 5.9 Engagement case creation

At:

```text
effective_due_at + 30 days
```

create an engagement review case only when all are true:

- the missed cycle still has no valid returning weekly submission;
- monitoring is active;
- the patient is not opted out;
- no confirmed technical access failure covers the cycle;
- no active safety monitoring pause covers the cycle.

At most one open engagement case may exist per patient.

This is independent of the one-open-clinical-case constraint.

A patient may simultaneously have:

```text
1 open clinical case
+
1 open engagement case
```

These are never merged.

## 5.10 Engagement case lifecycle

Use:

```text
NEW
→ ACKNOWLEDGED
→ OUTREACH_IN_PROGRESS
→ RESOLVED_*
```

Terminal outcomes:

```text
RESOLVED_RETURNED
RESOLVED_OPT_OUT
RESOLVED_PROGRAM_CLOSED
RESOLVED_TECHNICAL_CORRECTION
```

Phase 6 local demo implements:

- `RESOLVED_RETURNED`;
- `RESOLVED_OPT_OUT`;
- `RESOLVED_TECHNICAL_CORRECTION`.

`RESOLVED_PROGRAM_CLOSED` should exist in the canonical enum/model if needed for compatibility, but the full program-closure admin workflow remains Phase 7.

Do not add a generic free-form `PATCH status`.

## 5.11 Return after gap

A valid return must:

```text
open gap / engagement case
        ↓
RETURNED_AFTER_GAP transition/event
        ↓
resolve open engagement case as RESOLVED_RETURNED
        ↓
end pending reminder work
        ↓
process the authoritative weekly assessment normally
        ↓
final current engagement projection returns to ENGAGED
```

The transition through `RETURNED_AFTER_GAP` should be preserved through immutable event/audit history even if the final current projection is `ENGAGED` in the same transaction.

A purely historical backfill must not be treated as proof that the patient returned to the current engagement cycle when a newer active missed cycle still exists.

Use the existing submission classification and authoritative period relationship.

Do not resolve the current gap merely because an unrelated old period was backfilled.

## 5.12 Repeated disengagement

After a resolved engagement case, a future separate missed cycle that reaches +30 days creates:

```text
a new engagement case ID
```

Do not reopen or overwrite the old engagement case.

## 5.13 Opt-out

An explicit monitoring opt-out must:

- use a consequential confirmation in the patient UI;
- acquire the patient processing lock;
- transition current engagement state to `OPTED_OUT`;
- resolve the open engagement case as `RESOLVED_OPT_OUT`;
- stop future missed-check-in reminder/case creation;
- cancel future pending reminder opportunities for the open cycle;
- preserve historical rows;
- write audit.

Monitoring remains suppressed until explicitly re-enabled.

Re-enable must:

- be explicit;
- reset the engagement cycle boundary;
- return the current engagement state to `ENGAGED`;
- not replay old reminders from the opted-out interval;
- not reopen resolved engagement cases.

Do not silently infer opt-out from inactivity.

---

# 6. Local-demo reminder implementation

The Master Specification defines two missed-check-in reminders.

The eventual production architecture uses durable scheduled background execution and may use auxiliary delivery.

For the local capstone demonstration, implement reminder **business state and in-app presentation** without pretending an external message was sent.

## 6.1 Persist two reminder slots

For one missed cycle, persist at most:

```text
Reminder 1:
eligible_at = effective_due_at + 7 days

Reminder 2:
eligible_at = effective_due_at + 14 days
```

No reminder 3.

Use a duplicate-proof identity such as:

```text
patient + missed_cycle_period + reminder_number
```

## 6.2 Recommended reminder representation

The precise enum names may follow repository conventions, but the stored model should distinguish at least:

- reminder number `1 | 2`;
- cycle/source period;
- `eligible_at`;
- whether it was surfaced in-app;
- `presented_at` where applicable;
- `cancelled_at` where applicable;
- cancellation/suppression reason;
- created/updated provenance.

Do not use a field named `email_sent` or `provider_delivered` because no such delivery occurs in this phase.

## 6.3 In-app presentation rule

Patient Home is the primary patient reminder surface.

When a reminder threshold is reached:

- show a neutral current-action reminder;
- never shame the patient;
- never imply alcohol use;
- link to the current valid check-in action;
- obey safety/opt-out/technical-failure precedence.

If the application first materializes a gap after both reminder thresholds have already elapsed, do **not** dump two stale reminder cards on the patient.

Show only the most current applicable reminder/action while preserving the two scheduled reminder slots/history.

Do not falsely mark a reminder as externally delivered.

## 6.4 No third message at +30

At disengagement review time:

- create the engagement case/task;
- do not create another patient reminder.

Patient Home may still show the current check-in action, but it must not claim that a third automated reminder was sent.

---

# 7. Local deterministic reconciliation instead of a production worker

## 7.1 Why this phase does not add pg-boss

The target architecture still uses pg-boss for unattended background execution.

For the local capstone demo, the expensive part is not needed.

The important Phase 6 work is the deterministic function:

```text
persisted schedule + authoritative submissions + safety + technical state + clock
        ↓
reconcileEngagementForPatient(...)
        ↓
current engagement state
reminder slots
engagement case
durable task
audit/events
```

Implement that function now.

A future pg-boss worker should only invoke this authoritative service.

It must not contain another copy of the rules.

## 7.2 Permitted local materialization triggers

For prototype/local operation, it is acceptable to invoke engagement reconciliation:

- before returning `GET /api/v1/patient/home`;
- before returning the assigned-clinician Engagement queue/detail;
- after a valid weekly submission;
- after opt-out/re-enable;
- after technical-failure confirmation/resolution/correction;
- from deterministic prototype seed/setup helpers where needed.

The clinician multi-patient read should process patients in a stable order and use bounded per-patient transactions.

## 7.3 No server-local timers

Do not use:

```text
setTimeout
setInterval
long-running in-memory timer state
```

for multi-day engagement deadlines.

All timing truth remains persisted.

## 7.4 Important limitation

Because unattended scheduling is intentionally deferred:

```text
state is guaranteed current when an authoritative Phase-6 reconciliation path runs
```

but the local demo does not claim that a background process materializes transitions while the application is completely idle.

This limitation must be documented explicitly.

It must not be disguised as production-ready behavior.

---

# 8. Safety pause behavior

Safety remains higher priority than engagement.

If the current safety projection has:

```text
monitoringPromptPolicy = PAUSE
```

Phase 6 must:

- suppress patient engagement reminders;
- suppress new engagement case creation;
- suppress new engagement task creation;
- keep clinical/safety cases untouched;
- show the safety-controlled patient experience instead of ordinary engagement messaging.

Do not create an `EngagementState` value called `SAFETY_PAUSED`; it is not a canonical engagement state.

The engagement read model may include a presentation field such as:

```text
timingPaused = true
pauseReason = SAFETY
```

without changing the canonical state vocabulary.

### Safety-pause recovery boundary

The governing documents clearly require an active safety pause to stop engagement escalation, but they do not provide the same explicit due-date recalculation formula that they provide for a confirmed technical access failure.

Therefore Phase 6 must **not invent a new clinical scheduling formula**.

Implement the active-pause suppression correctly.

If the existing accepted safety/scheduling code provides an authoritative recovery timing boundary, reuse it.

If it does not, record the absence of an explicit safety-pause recovery formula as a bounded prototype implementation limitation in the documentation rather than silently inventing one.

The closeout audit must at minimum prove:

```text
no reminder
no engagement escalation
no disengagement case
```

is created while the safety pause is active.

---

# 9. Technical-failure semantics

Technical failure handling is included because it directly changes engagement timing.

It remains separate from ordinary notification delivery failure.

## 9.1 Canonical lifecycle

Persist:

```text
SUSPECTED
→ CONFIRMED
→ RESOLVED
```

and:

```text
CONFIRMED
→ CORRECTED_FALSE_POSITIVE
```

`NONE` is the absence of a TechnicalFailure row/current effect.

## 9.2 What can confirm an assessment access failure

The Master permits confirmation from evidence that the assessment/UI/API was actually unavailable to the affected patient/cohort.

Do not confirm from:

- bounced email;
- unopened reminder;
- no patient response;
- device offline;
- failure to read a notification.

## 9.3 Local-demo detection scope

Production automatic availability monitoring is deferred.

Phase 6 implements the **manual authorized confirmation workflow**.

For the capstone demo, support patient-scoped technical failures.

The persistence model may retain a generic affected-scope JSON/provenance field so a future cohort detector does not require destructive migration, but do not build cohort detection infrastructure now.

## 9.4 Authorization

Manual confirmation/correction requires explicit permission:

```text
ENGAGEMENT_TECHNICAL_OVERRIDE
```

Add a separate read permission if useful:

```text
TECHNICAL_FAILURE_READ
```

Do not treat ordinary admin role presence as sufficient without the permission map granting it.

## 9.5 TechnicalFailure record

Persist enough to reproduce the decision.

At minimum:

```text
failure_id
failure_type
affected scope
affected_patient_id for the implemented prototype path
started_at
evidence
status
confirmed_by
confirmed_at
resolved_by / resolved_at
corrected_by / corrected_at where applicable
reason/provenance
source/missed period where applicable
previous_effective_due_at where changed
recalculated_effective_due_at where changed
created_at
updated_at
version
```

Use relational fields for stable identities/timestamps and JSON only for structured evidence/scope metadata.

## 9.6 On confirmation

When a valid access failure is confirmed:

```text
engagement current projection → TECHNICAL_FAILURE
```

and:

- cancel/suppress pending future missed-check-in reminder presentation for the affected cycle;
- pause engagement escalation;
- do not create a disengagement case while failure remains confirmed;
- do not resolve or modify clinical cases;
- preserve prior reminder history;
- audit actor/time/evidence.

## 9.7 On resolution — exact formula

Use the Master Specification exactly:

```text
pause_duration = resolved_at - started_at

effective_due_at = max(
  original_due_at + pause_duration,
  resolved_at + 24 hours
)
```

Use the persisted:

```text
scheduled_period.original_due_at
```

Do not replace this formula with an approximation.

Persist the resulting new `effective_due_at`.

Preserve the previous value/provenance.

All later +7/+14/+30 engagement thresholds use the recalculated value.

## 9.8 False-positive correction

When a confirmed technical failure is corrected as a false positive:

- restore/reconcile the applicable timing from authoritative pre-failure provenance;
- recompute current engagement;
- do not emit a backlog of expired reminders;
- do not fabricate external delivery;
- if an engagement case exists only because the incorrect timing produced it, close it as `RESOLVED_TECHNICAL_CORRECTION`;
- keep the correction in immutable event/audit history.

Do not delete the TechnicalFailure record.

---

# 10. Engagement persistence model

Use the table families locked by the architecture:

```text
engagement_states
engagement_cases
engagement_case_events
missed_checkin_reminders
technical_failures
```

Do not implement full event sourcing.

Use:

```text
current projection
+
immutable case/event/audit history
```

## 10.1 `engagement_states`

One current projection per patient.

Recommended fields:

```text
patient_id
state
version
missed_cycle_period_id nullable
cycle_tracking_from_at
source_effective_due_at nullable
last_valid_assessment_revision_id nullable
last_valid_period_id nullable
source_technical_failure_id nullable
opted_out_at nullable
returned_after_gap_at nullable
last_transition_at
updated_at
```

A small implementation field such as `cycle_tracking_from_at` is permitted to prevent old resolved/opted-out cycles from becoming active again.

It is not a new clinical state.

## 10.2 `missed_checkin_reminders`

Recommended fields:

```text
id
patient_id
missed_cycle_period_id
reminder_number        # 1 or 2
eligible_at
presented_at nullable
cancelled_at nullable
cancellation_reason nullable
created_at
updated_at
```

Constraint:

```text
unique(patient_id, missed_cycle_period_id, reminder_number)
```

and:

```text
reminder_number IN (1, 2)
```

No third reminder.

## 10.3 `engagement_cases`

Recommended fields:

```text
id
patient_id
lifecycle
case_version
source_missed_period_id
source_effective_due_at
opened_at
acknowledged_at nullable
outreach_started_at nullable
resolved_at nullable
resolution_reason nullable
source_technical_failure_id nullable
updated_at
```

Database-enforce:

```text
at most one open engagement case per patient
```

Open:

```text
NEW
ACKNOWLEDGED
OUTREACH_IN_PROGRESS
```

Terminal:

```text
RESOLVED_RETURNED
RESOLVED_OPT_OUT
RESOLVED_PROGRAM_CLOSED
RESOLVED_TECHNICAL_CORRECTION
```

This partial unique constraint is independent of the clinical case constraint.

## 10.4 `engagement_case_events`

Append-only immutable events.

Useful event vocabulary:

```text
CASE_CREATED
CASE_ACKNOWLEDGED
OUTREACH_STARTED
CASE_RESOLVED_RETURNED
CASE_RESOLVED_OPT_OUT
CASE_RESOLVED_PROGRAM_CLOSED
CASE_RESOLVED_TECHNICAL_CORRECTION
```

Engagement-state transitions themselves may be represented through the existing append-only `audit_events` table rather than creating a second generic event-sourcing stream.

## 10.5 `technical_failures`

Use the model described in Section 9.

Do not add:

```text
notification_deliveries
```

because Phase 6 does not send an external engagement notification.

---

# 11. Generalize `clinician_tasks` only enough for engagement

This is an important Phase-5-to-Phase-6 seam.

The current task schema contains clinical-specific cause information.

Phase 6 must preserve existing clinical-task behavior while allowing a task originating from an engagement case.

## 11.1 Required conceptual result

A task must be able to represent:

```text
case_type = CLINICAL
case_id = <clinical_review_case>
cause = <clinical reason family>
```

or:

```text
case_type = ENGAGEMENT
case_id = <engagement_case>
cause = DISENGAGEMENT_REVIEW
```

## 11.2 Smallest recommended schema evolution

Inspect the current migration/FK state first.

A reasonable minimal direction is:

- add `ENGAGEMENT` to `ClinicianTaskCaseType`;
- keep existing clinical-reason provenance nullable/backward-compatible;
- introduce a generic durable `created_cause` / `task_identity` string;
- backfill existing tasks from their clinical reason;
- make duplicate prevention use:

```text
case_type + case_id + task_identity
```

rather than a clinical-only reason column;
- keep the old clinical reason field where useful for Phase-5 read compatibility;
- update Phase-5 clinical creation to populate the generic identity as well;
- engagement tasks use a stable identity such as:

```text
DISENGAGEMENT_REVIEW
```

Do not create a fake `ClinicalReasonFamily.DISENGAGEMENT`.

## 11.3 Polymorphic case reference

If the current database migration has a `clinician_tasks.case_id` FK directly to `clinical_review_cases`, that cannot represent engagement.

Do not merge the tables merely to preserve that FK.

Use the simplest safe generalization.

Acceptable approaches include:

1. generic `case_type + case_id` with application/SQL invariant validation; or
2. separate nullable typed FK columns while preserving the API's generic task projection.

Choose the smallest change that preserves existing Phase-5 behavior.

The Phase-6 invariant SQL must verify:

- clinical task → existing clinical case;
- engagement task → existing engagement case;
- task patient matches case patient.

## 11.4 Routing

Reuse the accepted Phase-5 direct-assignment rule:

```text
exactly one usable active direct clinician assignment
→ route to clinician

no usable or ambiguous recipient
→ SYSTEM_UNROUTED_QUEUE
→ preserve task
→ preserve engagement case
→ OperationalIncident
```

Do not build care-team/fallback routing in Phase 6.

## 11.5 Delivery state

The durable in-app task is enough.

No auxiliary email is required.

Delivery/routing failure does not change engagement state.

---

# 12. Engagement application service

Add a focused backend module:

```text
apps/backend/src/modules/engagement/
```

Recommended files only as useful:

```text
routes.ts
service.ts
domain/evaluate-engagement.ts
types.ts
```

Do not force extra layers.

## 12.1 Pure evaluator

Where practical, keep threshold calculation pure.

Conceptual input:

```text
now
effectiveDueAt
hasValidReturningSubmission
monitoringActive
optedOut
technicalFailureActive
safetyPaused
current engagement state
existing missed-cycle identity
```

Conceptual output:

```text
desired engagement state
reminder slot eligibility
engagement case eligibility
suppression reason
```

The pure evaluator must not import Prisma.

## 12.2 Reconciler

Persistence service:

```text
reconcileEngagementForPatient(...)
```

must:

1. acquire the existing patient processing lock;
2. ensure relevant scheduled periods exist using the scheduling module;
3. identify the current missed cycle deterministically;
4. load current safety projection;
5. load current technical-failure state;
6. load current engagement projection;
7. evaluate exact `effective_due_at` thresholds;
8. upsert the two reminder slots idempotently;
9. reconcile current engagement state;
10. create/reconcile engagement case;
11. create durable engagement task only when the +30 case first opens;
12. route task through existing direct-assignment logic;
13. write required audit/events;
14. return role-appropriate projection data.

No separate patient lock.

No raw `Date.now()`.

Use the injected `Clock`.

---

# 13. Missed-cycle identification

This deserves explicit implementation attention.

Do not simply query:

```text
latest period with no assessment
```

because that can restart reminder timing every week.

The algorithm should identify the first unresolved missed period after the current engagement cycle boundary.

Conceptually:

```text
active schedule
+
persisted scheduled periods
+
current cycle_tracking_from_at
+
authoritative weekly submissions
        ↓
earliest period whose effective_due_at has passed
and whose valid authoritative submission is absent
and which belongs to the current unresolved engagement cycle
```

Once that gap begins:

- later missing weekly periods do not start another reminder campaign;
- they remain part of the same gap until return/opt-out/technical resolution changes the engagement boundary.

After a return:

```text
cycle tracking boundary advances
```

so old historical gaps never reactivate.

---

# 14. What counts as a valid return

Use existing assessment provenance.

A valid current/late authoritative weekly submission that represents renewed monitoring participation can resolve the active engagement gap.

`PARTIAL` and `COMPLETE` are both genuine submitted assessments for engagement participation purposes unless the Master explicitly disqualifies the submission.

Do not treat:

```text
DRAFT
```

as return.

Do not treat a purely historical backfill unrelated to the current active gap as return.

Do not treat a content-support view/login/page load as return.

---

# 15. Assessment submission integration

Phase 6 must extend the existing ordered transaction, not create a second workflow.

Conceptually:

```text
patient lock
→ authoritative assessment revision
→ determine whether this submission closes active engagement gap
→ Phase-4 monitoring evaluation/recompute
→ Phase-5 content/clinical reconciliation
→ Phase-6 return-after-gap reconciliation
→ engagement case/reminder/task reconciliation
→ audit
→ idempotency result
```

It is acceptable to internally split return handling into:

```text
mark RETURNED_AFTER_GAP
...
finalize ENGAGED
```

as long as both occur atomically and immutable history proves the transition.

A normal submission with no gap simply preserves/returns `ENGAGED`.

Historical backfill must not incorrectly cancel a current missed cycle.

---

# 16. Clinical and engagement case separation

This is a hard invariant.

Never:

```text
merge EngagementCase into ClinicalReviewCase
reuse ClinicalReasonFamily for engagement
convert clinical case to engagement case
resolve a clinical case because engagement returned
resolve engagement because clinical state cleared
```

A patient can have:

```text
clinical_review_cases: one open
engagement_cases: one open
```

at the same time.

The clinician product may present both in one patient context, but the backend identities remain independent.

---

# 17. Patient Home — first-class Phase 6 UI

Patient Home is included in Phase 6 because it is the natural current-action and reminder surface described by the UX lock.

Add:

```text
/patient/home
```

and make it a polished patient-facing screen.

## 17.1 Backend-owned projection

Provide:

```text
GET /api/v1/patient/home
```

The browser must not join schedule + safety + support + engagement and decide priority itself.

The backend projection should contain enough state to render:

- safety-controlled mode;
- current check-in action/state;
- engagement/reminder presentation;
- current recovery-goal summary where already available;
- eligible support summary/link where appropriate;
- neutral current status.

Do not use Phase 6 as an excuse to build Patient Progress.

## 17.2 Home precedence

Use the locked order:

```text
safety-controlled experience
        ↓
current required/available patient action
        ↓
eligible patient support
        ↓
ordinary status/context
```

Engagement reminders belong in:

```text
current required/available patient action
```

not above safety.

## 17.3 State-aware examples

### ENGAGED / upcoming

Show:

- next/current check-in timing;
- no artificial reminder.

### OVERDUE before +7

Show:

- current check-in overdue/available;
- no claim that a reminder was sent.

### +7

Show first neutral reminder/action.

### AT_RISK / +14

Show final reminder/action.

Do not expose:

```text
AT_RISK_OF_DISENGAGEMENT
LEVEL_2
```

as raw patient language.

### DISENGAGED / +30

Do not show a third automated reminder.

Keep a calm route back into the valid check-in workflow.

### TECHNICAL_FAILURE

Show a neutral "check-in timing is paused while an access issue is being reviewed" style state where appropriate.

Do not show internal evidence or operations details.

### OPTED_OUT

Show monitoring paused/disabled and the explicit re-enable action where allowed.

## 17.4 Visual quality

Patient Home must preserve:

- calm healthcare visual language;
- mobile-first layout;
- strong typography;
- low cognitive load;
- clear single primary action;
- proper loading/error/restricted states;
- keyboard accessibility;
- responsive reflow;
- no invented health score;
- no shame-oriented engagement copy.

---

# 18. Patient Profile — monitoring opt-out/re-enable

Extend the existing Profile experience.

Do not add an unrelated settings framework.

Add an explicit Monitoring section.

## Opt-out

Use the existing consequential-action confirmation pattern.

The dialog must clearly state:

- monitoring/check-in reminders stop;
- historical records remain;
- the action can be reversed through explicit re-enable;
- this does not delete previous assessments.

Backend action example:

```text
POST /api/v1/patient/monitoring/opt-out
```

Require:

- own-patient scope;
- permission;
- idempotency key;
- patient processing lock;
- audit.

## Re-enable

Explicit action example:

```text
POST /api/v1/patient/monitoring/re-enable
```

Re-enable must not replay the old missed-cycle reminder backlog.

---

# 19. Clinician Engagement — first-class Phase 6 UI

Add:

```text
/clinician/engagement
```

to the real ClinicianShell navigation.

This page is not optional polish.

It is one of the key Phase-6 demonstration surfaces.

## 19.1 Purpose

The clinician should immediately distinguish:

```text
engagement problem
≠
clinical risk/review
≠
safety case
```

## 19.2 Suggested information hierarchy

A polished table/card hybrid may show:

```text
Patient
Missed period
Effective due
Days overdue
Engagement state
Reminder 1
Final reminder
Technical/safety pause
Engagement case
Last completed check-in (secondary context)
```

Use the backend-provided state.

Do not calculate `days overdue` from browser timestamps if it has domain meaning; backend may return it as a display projection.

## 19.3 Queue categories

Useful filters/tabs:

```text
Overdue
At risk
Disengaged / outreach
Paused
Returned / resolved where useful
```

Do not fabricate dashboard counts.

Counts must come from the backend result.

## 19.4 Patient engagement detail

Provide either:

- a dedicated engagement detail route; or
- a clearly separated Engagement section linked from the existing clinician patient detail.

Choose the smallest implementation that produces a coherent product.

It should show:

- current engagement state;
- missed-cycle period;
- `effective_due_at`;
- reminder history;
- technical/safety pause state;
- engagement case lifecycle;
- case timestamps;
- task routing state;
- last valid check-in as secondary context.

No alcohol-use inference.

## 19.5 Actions

State-aware actions:

### NEW case

```text
Acknowledge
```

### ACKNOWLEDGED

```text
Begin outreach
```

### OUTREACH_IN_PROGRESS

Display ongoing status.

Do not provide a generic manual Resolve action.

Return and opt-out resolve through authoritative workflows.

Program closure remains Phase 7.

---

# 20. Engagement case actions

Example routes:

```text
POST /api/v1/clinician/engagement-cases/:caseId/acknowledge

POST /api/v1/clinician/engagement-cases/:caseId/start-outreach
```

Requirements:

- clinician permission;
- assigned-patient scope;
- expected case version;
- idempotency key;
- actor/time provenance;
- patient lock;
- immutable case event;
- audit.

Acknowledge:

```text
NEW → ACKNOWLEDGED
```

Start outreach:

```text
ACKNOWLEDGED → OUTREACH_IN_PROGRESS
```

Do not permit:

```text
NEW → RESOLVED
```

through a generic status payload.

---

# 21. Focused Admin Operations / Technical Failure UI

Add:

```text
/admin/operations
```

but keep Phase 6 scope focused.

This Phase-6 Operations screen owns:

```text
Technical failures
```

only.

Do not implement the entire Phase-7 operations center.

## 21.1 Page quality

The page should look like a real operations console.

Useful structure:

```text
Operations
────────────────────────────────────────

Technical access failures

Status filters
SUSPECTED | CONFIRMED | RESOLVED | CORRECTED

Affected patient
Failure type
Started
Current status
Engagement timing impact
Confirmed by
Resolved/corrected at
```

Provide a good detail/side-panel/dialog workflow rather than raw database forms.

## 21.2 Structured actions

Examples:

```text
Record suspected failure
Confirm failure
Resolve confirmed failure
Correct false positive
```

No generic status editor.

## 21.3 Consequential confirmation

Confirmation/resolution/correction should use the shared consequential-action pattern.

UI must explain the timing consequence.

## 21.4 Scope

Prototype implementation may support:

```text
patient-scoped failure
```

only.

Do not build:

- automated uptime detection;
- cohort-rule engine;
- incident paging;
- external observability integration;
- worker dashboard.

Those are deferred.

---

# 22. Permissions

Extend the existing permission registry minimally.

Recommended Phase-6 permissions:

```text
PATIENT_HOME_READ
PATIENT_MONITORING_MANAGE

ENGAGEMENT_READ
ENGAGEMENT_CASE_ACKNOWLEDGE
ENGAGEMENT_CASE_OUTREACH

TECHNICAL_FAILURE_READ
ENGAGEMENT_TECHNICAL_OVERRIDE
```

Exact names may adapt to repository conventions.

### Patient

Own record:

```text
PATIENT_HOME_READ
PATIENT_MONITORING_MANAGE
```

### Clinician

Assigned patients:

```text
ENGAGEMENT_READ
ENGAGEMENT_CASE_ACKNOWLEDGE
ENGAGEMENT_CASE_OUTREACH
```

### Admin / Operations

Explicit operational permissions:

```text
TECHNICAL_FAILURE_READ
ENGAGEMENT_TECHNICAL_OVERRIDE
```

Do not grant patient clinical-review visibility simply because an actor can manage technical failures.

Scope check before existence/details.

---

# 23. API contracts

Use `packages/contracts`.

Do not return raw Prisma rows.

Recommended contract families:

```text
packages/contracts/src/patient/home.ts
packages/contracts/src/patient/monitoring.ts

packages/contracts/src/clinician/engagement.ts

packages/contracts/src/admin/operations.ts
```

## 23.1 Patient Home response

Patient-safe only.

Possible shape:

```text
status / presentationMode
primaryAction
checkIn
engagementNotice
goalSummary
supportSummary
safetyPresentation
```

Do not expose raw clinician engagement case internals.

## 23.2 Clinician Engagement response

Can expose operational domain state:

```text
patient
engagementState
missedCycle
effectiveDueAt
daysOverdue
reminders
pause
engagementCase
task
lastCompletedCheckIn
```

## 23.3 Admin technical-failure response

Expose only operations-authorized data.

Include:

```text
failure identity
affected scope
status
timestamps
evidence summary
actor provenance
due-time adjustment
engagement effect
```

Do not expose unrelated clinical assessment contents.

---

# 24. Documentation alignment is REQUIRED during Phase 6 implementation

The user has deliberately changed the implementation target from a full real-patient/deployed V1 realization to a **local capstone demonstration**.

This must be written down so later Phase 7 work does not accidentally reintroduce deferred infrastructure.

Phase 6 implementation must update the existing documentation.

Do **not** rewrite clinical policy.

## 24.1 Master Specification

In:

```text
docs/AUD_Subjective_Monitoring_Master_Specification_V1.md
```

Do not alter the normative engagement or technical-failure rules.

Update only the implementation-status / non-normative implementation note to make clear:

- Phase 6 local-demo engagement behavior is implemented;
- production unattended scheduling remains deferred;
- external engagement delivery remains deferred;
- real-patient operation remains blocked;
- target V1 semantics remain unchanged.

Do not downgrade the Master Specification acceptance criteria.

## 24.2 Locked Implementation Architecture

In:

```text
docs/AUD_V1_Locked_Implementation_Architecture.md
```

add/update an explicit section such as:

```text
Local capstone implementation boundary — Phases 6–7
```

Record:

### Implemented now

- persisted engagement state;
- exact effective-due threshold evaluation;
- in-app reminder business records/presentation;
- engagement case/task;
- technical-failure timing behavior;
- on-demand deterministic reconciliation;
- first-class UI.

### Intentionally deferred

- pg-boss dependency/worker registration;
- unattended recurring engagement sweep;
- background reminder delivery jobs;
- `notification_deliveries` for engagement external channels;
- Resend engagement reminders;
- push notifications;
- provider webhooks/callbacks;
- retry queues;
- outbound notification bundling;
- production worker/readiness health;
- broad care-team/fallback routing;
- automatic platform/cohort outage detection;
- real-patient deployment hardening.

Make clear:

> the architecture remains the target production shape; these are implementation deferrals for the capstone local-demo boundary, not a redefinition of the domain.

## 24.3 Web Product / UX Lock

Update the current implementation note and route/demo status.

After Phase 6 implementation, it should reflect that:

- Patient Home is now implemented;
- Clinician Engagement is now implemented;
- focused Admin Operations/technical-failure UI is now implemented;
- external notification UX/delivery internals are deferred;
- Patient Progress remains later;
- broader Admin Operations/Audit/Content governance remains Phase 7;
- UI/UX quality was not deferred.

Do not remove intended final product surfaces from the lock.

## 24.4 README

Update the implementation status and local-demo boundary.

README should explicitly say:

- Phase 6 engagement state materializes through deterministic authorized reconciliation paths in local prototype mode;
- no background worker is claimed;
- no external missed-check-in email/push is claimed;
- `real_patient` remains refused;
- UI routes available.

The completed closeout status is:

```text
Phase 6 closed for the local capstone implementation boundary.
```

---

# 25. Explicit Phase 6 deferrals

The following are intentionally **not implemented now**.

This list must appear in the documentation updates described above.

## External delivery

Do not implement:

- missed-check-in email;
- missed-check-in push;
- engagement-task email;
- engagement-task push;
- SMS;
- Resend engagement messages;
- generic notification center.

## Delivery persistence/infrastructure

Do not implement:

- `notification_deliveries` solely for deferred external engagement messages;
- provider delivery/bounce callbacks;
- external retry state machines;
- provider webhook verification;
- notification batching/bundling.

## Worker runtime

Do not implement:

- pg-boss;
- job-registration system;
- recurring engagement worker;
- reminder delivery worker;
- technical-failure recovery worker;
- queue health/readiness checks.

## Automated outage detection

Do not implement:

- uptime/availability monitoring service;
- browser telemetry pipeline;
- automatic cohort outage detector;
- alert paging.

Manual authorized technical-failure workflows are sufficient for the local demo.

## Routing expansion

Do not implement:

- care-team queue;
- service fallback queue;
- routing optimizer.

Reuse the direct assignment / system-unrouted behavior.

## Production deployment controls

Do not implement in Phase 6:

- backup/restore infrastructure;
- RPO/RTO;
- retention/deletion engine;
- production compliance/vendor readiness;
- real-patient readiness completion;
- production scaling;
- worker capacity reservation.

Those remain later/deferred.

---

# 26. UI/UX is explicitly NOT deferred

The following are **not** allowed to be treated as optional because the app is local:

- polished Patient Home;
- polished Clinician Engagement;
- polished focused Admin Operations technical-failure workflow;
- responsive behavior;
- role-appropriate information density;
- designed loading state;
- designed empty state;
- designed error state;
- designed restricted state;
- stale/paused state;
- consequential confirmations;
- accessible controls;
- keyboard navigation;
- visual hierarchy;
- consistent design-system reuse;
- patient-safe wording;
- clinician provenance;
- admin operational clarity.

Do not build temporary ugly screens with the intention of "polishing later."

The UX lock explicitly says:

```text
build real state contract
→ implement functional screen
→ apply design-system quality
→ validate responsive/accessibility
```

Follow it.

---

# 27. Prototype demonstration data

Phase 6 should improve the deterministic prototype seed so the UI can be demonstrated without manually corrupting the database.

Use synthetic data only.

Create a small representative engagement set, for example:

```text
ENGAGED
OVERDUE / before first reminder
FIRST REMINDER DUE
AT_RISK / FINAL REMINDER
DISENGAGED / open engagement case
TECHNICAL_FAILURE
```

Do not create dozens of accounts.

Prefer a small number of clearly named synthetic patient scenarios assigned to the existing prototype clinician.

Requirements:

- prototype mode only;
- deterministic IDs/provenance where practical;
- repeatable seed;
- no fake data hard-coded into React;
- no claim these are real patients;
- no seed behavior in `real_patient`.

The existing prototype patient account should remain usable.

If adding scenario-only synthetic patients, the clinician should be assigned to them so the Engagement UI has meaningful rows.

---

# 28. Phase 6 implementation plan

Use three balanced commits.

| Commit | Message | Coherent outcome |
|---|---|---|
| 1 | `feat: add deterministic missed-checkin engagement` | engagement policy, state/reminder persistence, exact effective-due reconciliation, opt-out/re-enable, return-after-gap integration, reminder slots, patient Home backend contract |
| 2 | `feat: add engagement cases and technical-failure controls` | separate engagement cases/events, generic engagement clinician task seam, direct/unrouted routing, acknowledgement/outreach, technical-failure lifecycle and due recalculation, operations APIs |
| 3 | `feat: expose engagement workflows for local demonstration` | polished Patient Home/Profile monitoring controls, Clinician Engagement queue/detail, Admin Operations technical-failure UI, prototype engagement scenarios, required documentation-deferral updates |

No fourth implementation commit is planned.

Tests and invariant SQL are added only in the later autonomous closeout sweep.

---

# 29. Commit 1 packet — deterministic missed-checkin engagement

## Commit identity

```text
feat: add deterministic missed-checkin engagement
```

## Goal

Implement the exact engagement clock and current missed-cycle/reminder business state using persisted `effective_due_at`, without adding production workers or external notification delivery.

## Before editing

Inspect:

```text
git status --short --branch
git log --oneline --decorate -n 20
git rev-parse HEAD

apps/backend/prisma/schema.prisma
apps/backend/src/policy/subjective-monitoring-v1.ts

apps/backend/src/modules/scheduling/
apps/backend/src/modules/assessments/
apps/backend/src/modules/safety/
apps/backend/src/modules/clinical/
apps/backend/src/shared/authz/
apps/backend/src/shared/clock/
apps/backend/src/app.ts

packages/contracts/src/

apps/web/src/features/patient/
apps/web/src/app/shells/patient-shell.tsx
```

Verify no Phase-6 implementation already exists.

## Exact scope

1. Add exact engagement thresholds to versioned policy configuration.
2. Add canonical engagement state enum.
3. Add `engagement_states`.
4. Add `missed_checkin_reminders`.
5. Add migration and constraints.
6. Add `engagement` backend module.
7. Add pure threshold evaluator where useful.
8. Add deterministic patient reconciler.
9. Reuse `ScheduledPeriod.effectiveDueAt`.
10. Reuse `ensureRelevantPeriodsInTransaction`.
11. Identify one continuous missed cycle.
12. Prevent a new reminder campaign for every missing week in one gap.
13. Persist exactly two reminder slots.
14. Implement +7 first reminder eligibility.
15. Implement +14 final reminder eligibility.
16. Implement +14 AT_RISK state.
17. Implement +30 DISENGAGED state eligibility output but do not create the case until Commit 2.
18. Suppress timing progression when safety monitoring prompts are paused.
19. Support canonical `OPTED_OUT`.
20. Add explicit opt-out service/action.
21. Add explicit re-enable service/action.
22. Advance/reset cycle boundary correctly after re-enable.
23. Integrate return-after-gap into authoritative weekly submission.
24. Preserve `RETURNED_AFTER_GAP` transition in audit/history.
25. End/cancel pending reminder opportunities on return.
26. Do not let historical backfill falsely resolve a current gap.
27. Add patient Home read contract/backend projection.
28. Home read may invoke deterministic reconciliation for the current patient.
29. Do not implement the Patient Home React page yet.
30. Do not add pg-boss.
31. Do not send external reminders.

## Likely files

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase6_engagement_core>/migration.sql

apps/backend/src/policy/subjective-monitoring-v1.ts

apps/backend/src/modules/engagement/*
apps/backend/src/modules/assessments/submission-service.ts
apps/backend/src/modules/assessments/routes.ts        # only if action/read integration requires
apps/backend/src/modules/scheduling/*                 # minimal seam only if needed
apps/backend/src/shared/authz/permissions.ts
apps/backend/src/app.ts

packages/contracts/src/patient/home.ts
packages/contracts/src/patient/monitoring.ts
packages/contracts/src/engagement/*
packages/contracts/src/index.ts
```

## Acceptance criteria

1. Before due time no overdue escalation occurs.
2. Due time passed produces OVERDUE.
3. +7 produces only first reminder eligibility.
4. +14 produces final reminder eligibility and AT_RISK.
5. +30 produces DISENGAGED eligibility.
6. No reminder number greater than 2 can exist.
7. Same continuous gap does not start a new reminder series every week.
8. `effective_due_at` is authoritative.
9. Browser timestamps are irrelevant to domain state.
10. Safety pause suppresses reminder/escalation.
11. Opt-out prevents future cycle escalation.
12. Re-enable does not replay old reminders.
13. Valid return closes the gap semantics.
14. Historical backfill does not falsely represent a current return.
15. Missingness/clinical lifecycle remains untouched.
16. No pg-boss or external engagement notification is introduced.

## Do not do

- no engagement case table yet if not needed for this commit;
- no clinician task change yet;
- no technical failure table yet;
- no UI page implementation yet;
- no tests/validation;
- no docs closeout;
- no push.

After this commit, immediately continue.

---

# 30. Commit 2 packet — engagement cases and technical-failure controls

## Commit identity

```text
feat: add engagement cases and technical-failure controls
```

## Goal

Turn +30 disengagement eligibility into a separate durable engagement case/task, and implement the technical-failure timing controls that can pause/recalculate engagement.

## Exact scope

### Engagement case

1. Add canonical engagement case lifecycle enum.
2. Add `engagement_cases`.
3. Add `engagement_case_events`.
4. DB-enforce one open engagement case per patient.
5. Create case only at +30 while still eligible.
6. Preserve clinical-case independence.
7. New case starts `NEW`.
8. Acknowledge action: `NEW → ACKNOWLEDGED`.
9. Begin outreach: `ACKNOWLEDGED → OUTREACH_IN_PROGRESS`.
10. Valid return: terminal `RESOLVED_RETURNED`.
11. Opt-out: terminal `RESOLVED_OPT_OUT`.
12. Technical timing correction when applicable: `RESOLVED_TECHNICAL_CORRECTION`.
13. Preserve `RESOLVED_PROGRAM_CLOSED` vocabulary for later, but do not implement full program-closure UI.
14. New future missed cycle after resolution creates a new case ID.

### Durable clinician task

15. Generalize `clinician_tasks` only enough for ENGAGEMENT.
16. Do not merge engagement and clinical cases.
17. Do not invent a clinical reason.
18. Add generic stable task cause/identity.
19. Backfill/preserve Phase-5 clinical tasks.
20. Add duplicate-safe engagement task identity.
21. Create one engagement task when engagement case first opens.
22. No repeated task on every reconciliation.
23. Direct unambiguous clinician assignment routes the task.
24. Ambiguous/no recipient becomes SYSTEM_UNROUTED_QUEUE + incident.
25. Routing state never changes engagement state.
26. Acknowledge/outreach remains engagement case workflow.

### Technical failure

27. Add `technical_failures`.
28. Implement patient-scoped SUSPECTED record.
29. Implement authorized CONFIRM action.
30. On confirm transition engagement to TECHNICAL_FAILURE.
31. Suppress/cancel pending future reminder presentation.
32. Suppress engagement escalation while confirmed.
33. Leave clinical cases untouched.
34. Implement RESOLVE action.
35. Apply exact due recalculation:

```text
pause_duration = resolved_at - started_at

effective_due_at = max(
  original_due_at + pause_duration,
  resolved_at + 24 hours
)
```

36. Preserve previous/new due provenance.
37. Reconcile engagement from new effective due.
38. Implement CORRECT_FALSE_POSITIVE action.
39. Do not emit backlog of expired reminders after correction.
40. Resolve invalid engagement case as RESOLVED_TECHNICAL_CORRECTION where applicable.
41. Audit every manual technical transition.
42. Require expected version where mutable.
43. Require idempotency key.
44. Add operations permissions.
45. Add clinician engagement read/actions.
46. Add technical failure operations read/actions.
47. No UI yet.
48. No pg-boss.
49. No external delivery.

## Likely files

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase6_engagement_cases_operations>/migration.sql

apps/backend/src/modules/engagement/*
apps/backend/src/modules/operations/*
apps/backend/src/modules/clinical/*                  # only shared task seam if currently owned there
apps/backend/src/modules/assessments/submission-service.ts
apps/backend/src/modules/scheduling/*
apps/backend/src/shared/authz/permissions.ts
apps/backend/src/app.ts

packages/contracts/src/clinician/engagement.ts
packages/contracts/src/admin/operations.ts
packages/contracts/src/index.ts
```

## Acceptance criteria

1. Clinical and engagement open cases can coexist.
2. Only one open engagement case exists per patient.
3. +30 creates one case and one durable engagement task.
4. Reconciliation replay does not duplicate case/task.
5. Engagement case acknowledgement is explicit/idempotent.
6. Outreach start is explicit/idempotent.
7. Return resolves engagement case only.
8. Opt-out resolves engagement case only.
9. Clinical case/reasons remain unchanged by engagement transitions.
10. Technical failure confirmation pauses engagement.
11. Notification failure cannot masquerade as technical access failure.
12. Technical resolution uses exact formula.
13. `originalDueAt` remains preserved.
14. New `effectiveDueAt` drives later thresholds.
15. False-positive correction creates no stale reminder burst.
16. Unrouted task remains durable and creates incident.
17. Existing Phase-5 clinical tasks remain valid.
18. No production worker/outbound system is introduced.

After this commit, immediately continue.

---

# 31. Commit 3 packet — first-class product surfaces and documented local-demo boundary

## Commit identity

```text
feat: expose engagement workflows for local demonstration
```

## Goal

Expose the real Phase-6 backend through polished patient, clinician, and operations experiences and explicitly document all production-only deferrals.

## Patient scope

1. Add `/patient/home`.
2. Add Home to PatientShell.
3. Preserve mobile-first patient layout.
4. Render backend-owned current action.
5. Preserve safety precedence.
6. Render check-in state.
7. Render first/final in-app reminder when applicable.
8. Do not show a third reminder.
9. Render technical-failure pause safely.
10. Render opt-out state.
11. Link to valid check-in flow.
12. Show support summary/link only when backend allows.
13. Extend Profile with monitoring controls.
14. Add consequential opt-out confirmation.
15. Add explicit re-enable action.
16. Do not expose raw engagement enum/severity wording unnecessarily.
17. Do not implement Patient Progress.

## Clinician scope

18. Add Engagement navigation.
19. Add `/clinician/engagement`.
20. Build polished engagement queue/list.
21. Show missed period.
22. Show effective due.
23. Show backend-provided overdue duration.
24. Show state.
25. Show first/final reminder state.
26. Show safety/technical pause.
27. Show engagement case state.
28. Show durable engagement task/routing state.
29. Show last completed check-in only as secondary context.
30. Add engagement detail or coherent patient-detail section.
31. Add Acknowledge action for NEW.
32. Add Begin outreach for ACKNOWLEDGED.
33. No generic resolve action.
34. Do not mix clinical review labels with engagement labels.
35. Proper loading/error/empty/restricted states.

## Admin/operations scope

36. Add Operations navigation when permission allows.
37. Add `/admin/operations`.
38. Build focused Technical Failures view.
39. Show SUSPECTED/CONFIRMED/RESOLVED/CORRECTED states.
40. Add structured record/confirm/resolve/correct workflows.
41. Use consequential confirmations.
42. Show timing impact and effective-due adjustment.
43. Do not show unrelated patient clinical content.
44. Do not build full Phase-7 Operations dashboard.

## Prototype seed

45. Add a small set of engagement demonstration scenarios.
46. Assign scenario patients to the prototype clinician.
47. Keep seed repeatable.
48. Keep all data synthetic/prototype-only.
49. No hard-coded fake rows in React.

## Documentation

50. Update Master implementation-status note without changing normative rules.
51. Update Locked Architecture with explicit local-demo deferral boundary.
52. Update UX Lock current route/surface status.
53. Update README with the closed local-capstone Phase-6 status.
54. Explicitly list deferred pg-boss/external delivery/worker/provider/readiness items.
55. Explicitly state UI/UX is not deferred.
56. Marked Phase 6 CLOSED only after the documented closeout validation passed.

## Likely files

```text
apps/web/src/app/router/router.tsx
apps/web/src/app/shells/patient-shell.tsx
apps/web/src/app/shells/clinician-shell.tsx
apps/web/src/app/shells/admin-shell.tsx

apps/web/src/features/patient/home/*
apps/web/src/features/patient/profile/*
apps/web/src/features/clinician/engagement/*
apps/web/src/features/clinician/patients/*
apps/web/src/features/admin/operations/*

apps/web/src/components/patterns/*                    # reuse/promote only genuine shared patterns

apps/backend/prisma/seed.ts

packages/contracts/src/patient/*
packages/contracts/src/clinician/*
packages/contracts/src/admin/*
packages/contracts/src/index.ts

docs/AUD_Subjective_Monitoring_Master_Specification_V1.md
docs/AUD_V1_Locked_Implementation_Architecture.md
docs/AUD_V1_Web_Product_Surface_and_UX_Implementation_Lock.md
README.md
```

## Acceptance criteria

1. Patient Home is a real current-action center.
2. Patient reminders are calm and patient-safe.
3. Safety overrides ordinary engagement presentation.
4. Technical pause is visible without operational detail leakage.
5. Opt-out/re-enable are consequential explicit actions.
6. Clinician Engagement is visibly separate from Review Queue/Safety.
7. Clinician sees `effective_due_at` provenance.
8. Missing data is never called relapse/use.
9. Engagement case actions follow backend lifecycle.
10. Admin technical-failure workflow is structured and permissioned.
11. UI works at narrow and desktop widths.
12. Existing design-system patterns are reused.
13. No fake dashboard filler is introduced.
14. Prototype seed supports a useful evaluator walkthrough.
15. Docs clearly distinguish implemented local behavior from deferred production infrastructure.
16. Phase 6 is marked CLOSED only by the completed closeout record.

After Commit 3, STOP.

Do not push.

Do not add tests/validation files in the implementation sweep.

---

# 32. Whole-phase invariants

## 32.1 Effective due is authoritative

```text
engagement threshold
=
effective_due_at + configured offset
```

No other time anchor replaces it.

## 32.2 Reminder maximum

For one missed cycle:

```text
count(reminder slots) <= 2
```

## 32.3 Separate cases

```text
clinical case identity
≠
engagement case identity
≠
safety case identity
```

## 32.4 Missingness

```text
missing check-in
≠
alcohol use
```

Always.

## 32.5 Engagement does not clear clinical state

Return, opt-out, technical failure, and outreach never directly clear clinical reasons.

## 32.6 Safety precedence

Active safety monitoring pause blocks ordinary engagement reminder/escalation.

## 32.7 Technical failure changes timing, not clinical truth

Technical failure:

- may change engagement state;
- may change `effective_due_at`;
- may cancel engagement reminder eligibility;
- may close an engagement case through correction semantics;

but must not change:

- weekly answers;
- clinical reason eligibility;
- clinical severity;
- safety severity.

## 32.8 Historical rows are preserved

Never delete:

- past engagement case events;
- past reminder rows;
- resolved engagement cases;
- technical failure records;
- prior clinician tasks.

## 32.9 Idempotency

Repeated reconciliation/action cannot duplicate:

- reminder slot;
- engagement case;
- engagement case event;
- clinician task;
- operational incident;
- technical failure transition;
- opt-out/return event.

## 32.10 Patient serialization

Ordered engagement mutations use the existing patient processing lock.

No second lock system.

---

# 33. Do-not-do master list

Codex must not:

- change the 7/14/30-day thresholds;
- use `last completed check-in` as engagement clock;
- infer alcohol use from missing data;
- merge clinical and engagement cases;
- create a clinical reason for disengagement;
- create a third missed-check-in reminder;
- restart a reminder series every missed week in one continuous gap;
- let safety-paused patients escalate;
- let confirmed technical-failure patients escalate;
- alter clinical reason state because engagement changed;
- invent a technical-failure due formula;
- use notification failure as proof of assessment-access failure;
- build automatic outage monitoring;
- add pg-boss;
- add Redis;
- add RabbitMQ;
- add Kafka;
- add a generic job framework;
- use `setTimeout`/`setInterval` for multi-day deadlines;
- add engagement email/push;
- add notification provider callbacks;
- add retry queues;
- add notification bundling;
- add care-team routing platform;
- build full Admin Operations;
- build Admin Audit Explorer;
- build Admin Content Governance;
- build Patient Progress;
- build full Clinician Overview;
- add fake metrics;
- move engagement timing logic into React;
- downgrade UI quality because the app is local;
- claim Phase 6 closure before the closeout validation is complete;
- push commits.

---

# 34. Phase 6 acceptance matrix for the later closeout sweep

The completed closeout sweep verified all of these before marking Phase 6
CLOSED.

## Timing

1. before due → no overdue escalation;
2. due passed → OVERDUE;
3. +7 → first reminder slot;
4. +14 → final reminder slot;
5. +14 → AT_RISK visibility;
6. +30 → DISENGAGED;
7. +30 → engagement case;
8. no third reminder;
9. due reschedule changes timing through `effective_due_at`;
10. browser timezone does not change state.

## Cycle behavior

11. continuous multi-week gap remains one missed cycle;
12. only two reminder slots in that cycle;
13. return resets cycle;
14. future separate gap creates new cycle;
15. future separate +30 gap creates new case ID.

## Return

16. valid current/late PARTIAL can count as returned participation;
17. valid current/late COMPLETE can count as returned participation;
18. DRAFT cannot;
19. unrelated historical backfill cannot falsely resolve current gap;
20. return resolves engagement case as `RESOLVED_RETURNED`;
21. current state ends ENGAGED;
22. clinical state remains authoritative and independently recomputed.

## Opt-out

23. opt-out is explicit/idempotent;
24. open case resolves `RESOLVED_OPT_OUT`;
25. future reminder/case creation suppressed;
26. re-enable resets cycle;
27. old reminder backlog not replayed.

## Safety

28. active safety pause suppresses reminder materialization/presentation;
29. active safety pause suppresses engagement case;
30. clinical/safety cases remain unchanged.

## Technical failure

31. SUSPECTED alone does not falsely apply confirmed pause behavior unless the Master says so;
32. CONFIRMED sets technical engagement pause;
33. no engagement escalation while confirmed;
34. resolution uses exact formula;
35. original due remains preserved;
36. recalculated effective due becomes the new engagement anchor;
37. false-positive correction preserves history;
38. no expired reminder backlog blast;
39. incorrect case can resolve technical correction when required;
40. notification failure does not create technical access failure.

## Cases/tasks

41. max one open engagement case per patient;
42. max one open clinical case separately;
43. both may coexist;
44. new engagement case creates one task;
45. unchanged reconciliation creates no duplicate task;
46. direct unambiguous clinician routing works;
47. ambiguous/no routing becomes SYSTEM_UNROUTED_QUEUE + incident;
48. task delivery state does not alter engagement state;
49. acknowledge is version/idempotency safe;
50. outreach transition is version/idempotency safe.

## Authorization

51. patient sees only own Home/monitoring actions;
52. clinician sees assigned patients only;
53. clinician cannot mutate unassigned engagement case;
54. admin without permission cannot perform technical override;
55. technical operator does not gain clinical-review visibility merely from operations permission.

## UI

56. Patient Home follows safety/action/support precedence;
57. reminder copy is patient-safe;
58. no raw internal disengagement severity exposed unnecessarily;
59. Clinician Engagement is separate from Review Queue;
60. effective-due provenance is visible;
61. missing data is not portrayed as relapse;
62. focused Admin Operations page is usable;
63. technical actions use confirmation;
64. loading/error/empty/restricted states exist;
65. narrow/desktop presentation is polished;
66. no fake frontend data.

---

# 35. Autonomous closeout sweep — after the user pushes implementation

This is not part of the implementation sweep.

After the three Phase-6 commits are pushed, perform one autonomous closeout.

The closeout must:

```text
audit full Phase-6 diff
→ fix P0/P1 issues immediately
→ fix useful/simple P2 issues
→ add required tests
→ add validation/phase6_invariants.sql
→ run complete validation
→ fix failures
→ rerun until green
→ final diff audit
→ update Phase-6 closeout docs/status
→ create closeout/closing commits
→ stop without push
```

Do not ask the user for permission to fix a discovered Phase-6 defect.

Use the simplest correct solution allowed by the docs.

---

# 36. Closeout test focus

Add focused tests rather than a giant new framework.

## Domain/time tests

At minimum:

- exact due boundary;
- +7 boundary;
- +14 boundary;
- +30 boundary;
- two-reminder max;
- one-cycle behavior across multiple missing weeks;
- return/reset;
- opt-out/re-enable;
- safety pause suppression;
- technical confirmed pause;
- technical resolution formula;
- false-positive correction;
- no reminder backlog.

Use fake/injected clock.

No real-time waiting.

## Integration tests

At minimum:

- real PostgreSQL constraints;
- one-open-engagement-case;
- clinical+engagement coexistence;
- duplicate-safe reminder rows;
- duplicate-safe task;
- direct/unrouted task;
- return through actual assessment submission;
- historical backfill non-return boundary;
- idempotent actions;
- authorization;
- task genericization did not regress Phase-5 clinical review;
- technical failure due update transaction.

## UI tests

At minimum:

- Patient Home core states;
- opt-out confirmation;
- Clinician Engagement state rendering/actions;
- Admin technical failure confirmation;
- restricted state;
- patient-safe missing-data copy.

## E2E

Add/extend a focused evaluator path including:

```text
patient Home
→ overdue/final reminder state
→ current check-in return
→ clinician Engagement
→ engagement case acknowledge/outreach
→ admin technical failure workflow
```

Do not create brittle excessive screenshots.

UI accessibility remains required.

---

# 37. Phase 6 SQL invariants

The closeout sweep should add:

```text
validation/phase6_invariants.sql
```

At minimum verify:

- <= 1 open engagement case per patient;
- reminder number is only 1/2;
- no duplicate patient/cycle/reminder slot;
- no more than two reminder rows per missed cycle;
- engagement task references valid engagement case under final task representation;
- clinical task still references valid clinical case;
- task patient matches case patient;
- no open engagement case for OPTED_OUT patient where the transaction should have resolved it;
- no duplicate engagement task identity;
- no impossible terminal case without `resolved_at`;
- no unresolved case with a terminal lifecycle;
- technical RESOLVED has `resolved_at`;
- technical CORRECTED_FALSE_POSITIVE retains correction provenance;
- recalculated effective due does not destroy `original_due_at`;
- immutable engagement-case event trigger/guard exists if implemented through DB trigger.

Keep SQL focused on real invariants.

---

# 38. Validation sequence

After audit/correction and tests:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright test
```

Then run existing invariant suites:

```text
validation/phase4_invariants.sql
validation/phase5_invariants.sql
validation/phase6_invariants.sql
```

Verify migration/seed repeatability using the existing isolated PostgreSQL test workflow.

Phase 6 does **not** require:

```text
pg-boss validation
external engagement email validation
provider webhook validation
worker readiness validation
```

because those are explicitly deferred.

Any failed repository-related validation must be corrected and rerun autonomously.

---

# 39. Closeout documentation

The closeout sweep is complete. This guide is now `Status: CLOSED` and records:

- three implementation SHAs;
- correction/test SHA;
- final validated SHA;
- actual test counts;
- Phase 4/5/6 invariant results;
- explicit local-demo deferrals;
- Phase 7 handoff.

## 39.1 Phase 6 closeout record

Phase 6 is **CLOSED** for the local capstone implementation boundary. The
validated implementation range is:

```text
d5d6ae71577dbb3f200c721f298b5a9277f3777e..a64872a1977b75e653ca6142b13ec08c1fb17e4a
```

The autonomous sweep corrected the accepted implementation seams without
changing the locked domain semantics. Corrections included persisted and
audited Patient Home reminder presentation, strict engagement lifecycle
transitions, exact technical-failure due-time reconciliation and provenance,
safe false-positive correction, repeatable prototype seed geometry, and
Phase-6 authorization/read-only behavior. The sweep also added focused domain,
backend integration, web, Playwright, and SQL-invariant coverage.

Validation was run against a fresh isolated PostgreSQL database after applying
all 20 committed migrations and seeding twice:

- `pnpm format:check` — passed;
- `pnpm lint` — passed;
- `pnpm typecheck` — passed;
- `pnpm build` — passed;
- backend — 19 test files, 191 tests passed;
- web — 12 test files, 34 tests passed;
- Playwright — 10 tests passed, including the Phase-6 accessibility smoke;
- focused Phase-6 integration — 8 tests passed.

The invariant results were:

- Phase 4 invariants — passed on a Phase-5-only database (`weekly_assessments=0`);
- Phase 5 invariants — passed on both the Phase-5-only database and the final
  Phase-6 database (`content_resolutions=6`, `clinical_cases=3`,
  `clinician_tasks=6` on the final database);
- Phase 6 invariants — passed (`engagement_states=13`, `engagement_cases=6`,
  `reminders=22`, `technical_failures=6`, `engagement_tasks=4`).

The final local-demo boundary remains explicit: no unattended background
worker, pg-boss scheduler, external email/push delivery, provider callback or
retry machinery, notification-delivery platform, automatic outage detector,
production care-team routing, deployment hardening, or real-patient operation
was introduced. Those remain production/Phase-7 handoff items; they do not
block this local capstone closeout.

The current-status notes in the Master Specification, Locked Architecture, UX
Lock, and README now state:

```text
Phase 6 closed for the local capstone implementation boundary
```

Do not describe the system as real-patient ready.

The Phase 6 record above remains the historical closeout record. At the current
Phase 7 handoff, Phase 7 implementation is present and final project
audit/validation/closeout is pending; the Phase 6 CLOSED status and validation
evidence are unchanged.

---

# 40. Phase 7 handoff

After Phase 6 closes, the remaining capstone phase should focus on demo-relevant product completion.

Phase 7 should retain first-class UI/UX and should prioritize:

```text
Admin Content Governance
focused Admin Audit / operational visibility
Patient Progress / remaining high-value product surface
selected Clinician overview/timeline integration where justified
final end-to-end demo cohesion
final acceptance
```

while continuing to defer production-only hardening that the capstone does not require.

Likely Phase-7 deferrals remain:

```text
production deployment
real-patient readiness completion
backup/restore infrastructure
RPO/RTO enforcement
retention/deletion engine
external engagement notification provider
pg-boss production scheduling
provider callbacks/retries
production worker-health capacity guarantees
scaling infrastructure
vendor/compliance activation
```

Phase 7 must use the documentation changes made in Phase 6 so these items are not accidentally treated as missing blockers for the local capstone closeout.

---

# 41. One-sweep implementation record

The Phase 6 implementation sweep and subsequent autonomous closeout are
complete. The three planned implementation outcomes were delivered in these
commits:

- `0d6020cc74440a8a767a0938c1e5db2add08ae23` — deterministic missed-check-in engagement;
- `f5a87a7edea46132a3f468c2eafb0307f50111df` — engagement cases and technical operations;
- `10197afb72a0b0d2d0bcee2af9880d863a1fecc7` — local demonstration surfaces.

The later closeout sweep added the audit corrections, tests, SQL invariants,
validation evidence, and documentation recorded in section 39.1. At the Phase 6
closeout baseline, no Phase 7 work had started; the current Phase 7
implementation/closeout boundary is recorded in the Phase 7 guide.

If there is no genuine caveat, omit the caveat line.

---

# 42. Final Phase 6 definition

Phase 6 is correctly implemented for the local capstone when this behavior exists:

```text
PERSISTED SCHEDULE
      │
      │ effective_due_at
      ▼
DETERMINISTIC ENGAGEMENT RECONCILIATION
      │
      ├──────── before due ─────────────→ ENGAGED
      │
      ├──────── due passed ─────────────→ OVERDUE
      │
      ├──────── +7 ─────────────────────→ REMINDER 1
      │
      ├──────── +14 ────────────────────→ FINAL REMINDER
      │                                  + AT_RISK VISIBILITY
      │
      └──────── +30 ────────────────────→ DISENGAGED
                                         + ENGAGEMENT CASE
                                         + DURABLE TASK

VALID WEEKLY RETURN
      ↓
RETURNED_AFTER_GAP event
      ↓
RESOLVED_RETURNED
      ↓
ENGAGED

OPT OUT
      ↓
RESOLVED_OPT_OUT
      ↓
NO FUTURE MISSED-CYCLE ESCALATION

CONFIRMED ACCESS FAILURE
      ↓
TECHNICAL_FAILURE
      ↓
PAUSE ENGAGEMENT

RESOLUTION
      ↓
effective_due_at =
max(original_due_at + pause_duration,
    resolved_at + 24 hours)
      ↓
RECONCILE AGAIN
```

and the user can demonstrate it through:

```text
PATIENT HOME
+
PATIENT PROFILE MONITORING CONTROL
+
CLINICIAN ENGAGEMENT
+
ADMIN OPERATIONS / TECHNICAL FAILURES
```

while preserving:

```text
safety precedence
clinical/engagement separation
missingness semantics
patient serialization
idempotency
auditability
authoritative backend timing
excellent UI/UX
```

without pretending the local capstone has:

```text
background production scheduling
external reminder delivery
provider retry machinery
production worker health
real-patient readiness
```

That is the complete Phase 6 implementation boundary.
