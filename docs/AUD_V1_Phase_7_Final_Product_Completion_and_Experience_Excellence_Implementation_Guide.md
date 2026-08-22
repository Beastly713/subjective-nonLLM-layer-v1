# AUD Subjective Monitoring V1 — Phase 7 Final Product Completion and Experience Excellence Implementation Guide

## Document status

**Status:** **IMPLEMENTATION PRESENT; FINAL PROJECT AUDIT/VALIDATION/CLOSEOUT PENDING**

**Phase:** **7 of 7 — FINAL**

**Phase name:** **Final Product Completion, Governance, Experience Excellence, and Local-Capstone Closure**

**Target implementation commits:** **3 balanced commits**

**Execution mode:** **One uninterrupted implementation sweep**

**Closeout mode:** **One autonomous full-project audit + correction + validation + final-project closure sweep**

**Current repository baseline inspected:**
`dc2aa3a36c9936feadf7ed99461c1b27157f1222` — `docs: remove stale Phase-6 status text`

**Phase 6 autonomous correction/test commit:**
`a64872a1977b75e653ca6142b13ec08c1fb17e4a` — `fix: close Phase-6 audit findings`

**Phase 6 closing commit:**
`02b1968b8f81f550ac3550a9556f9606d878b906` — `closing: Phase-6`

**Current local-capstone validation baseline:**

- 34 web tests;
- 191 backend tests;
- 10 Playwright E2E tests;
- formatting, lint, typecheck and production build passing;
- Phase 4/5/6 invariant suites passing under their established migration-stage/final-schema validation strategy;
- repeatable prototype seed;
- migration-chain validation;
- automated Playwright accessibility coverage.

**Current implementation-sweep status:** Phase 7 implementation is present;
final project audit/validation/closeout is pending. The three implementation
commits are the required handoff boundary for the later autonomous closeout;
this guide must not be marked CLOSED during the implementation sweep.

This is the **final implementation phase**.

After Phase 7 implementation, autonomous closeout, and final project closure there is no Phase 8.

The purpose of Phase 7 is not merely to add the last few screens.

It must convert the already-correct deterministic platform into a **cohesive, premium, mentor-ready product** while completing every remaining demo-relevant locked surface and explicitly documenting every production-only capability that remains intentionally deferred.

The final result must feel like:

```text
one serious product platform
+
three coherent role experiences
+
correct deterministic domain behavior
+
excellent visual design
+
excellent interaction design
+
complete governance/audit demonstration
+
clear local-capstone boundary
```

and must **not** feel like:

```text
a collection of phase-by-phase prototype pages
a raw admin console
a questionnaire demo
a generic student dashboard
a set of disconnected CRUD screens
a fake analytics product
```

---

# 1. Final-phase mission

Phase 7 closes the project itself.

The final work has four simultaneous responsibilities:

1. **Complete the remaining locked, demo-relevant product surfaces.**
2. **Absorb any legitimate stale/unplanned/carry-forward work from Phases 1–6.**
3. **Perform a product-wide UI/UX excellence pass across every evaluator-facing interface.**
4. **Leave the repository and documentation in one unambiguous final local-capstone state.**

The UI/UX objective is exceptionally important.

The product is being evaluated by mentors who will form an immediate impression from:

- navigation;
- visual hierarchy;
- typography;
- spacing;
- tables;
- charts;
- forms;
- state communication;
- interaction polish;
- accessibility;
- responsive behavior;
- perceived product completeness.

Therefore:

> **UI/UX is not a secondary cleanup item in Phase 7. It is a first-class deliverable equal in priority to backend correctness.**

However, premium UI does **not** mean visual excess.

The product serves people using an AUD/SUD support system and clinicians/administrators supporting them.

The visual language must respect that context.

Use:

```text
calm
trustworthy
clear
restrained
professional
supportive
high-quality
modern
human
```

Avoid:

```text
gamified
shaming
alarmist
medical-theatre
casino-like
neon
over-animated
over-charted
busy
decorative-for-decoration's-sake
```

---

# 2. Governing documents and authority order

Codex must read these **before** making Phase 7 implementation decisions:

1. `docs/AUD_Subjective_Monitoring_Master_Specification_V1.md`
2. `docs/AUD_V1_Web_Product_Surface_and_UX_Implementation_Lock.md`
3. `docs/AUD_V1_Locked_Implementation_Architecture.md`
4. `docs/AUD_V1_Phase_1_Foundation_Implementation_Guide.md`
5. `docs/AUD_V1_Phase_2_Identity_and_Core_Platform_Implementation_Guide.md`
6. `docs/AUD_V1_Phase_3_Safety_Onboarding_and_Reduction_Setup_Implementation_Guide.md`
7. `docs/AUD_V1_Phase_4_Weekly_Monitoring_Core_Implementation_Guide.md`
8. `docs/AUD_V1_Phase_5_Patient_Support_and_Clinical_Review_Implementation_Guide.md`
9. `docs/AUD_V1_Phase_6_Engagement_and_Local_Demo_Operations_Implementation_Guide.md`
10. this Phase 7 guide.

Authority remains:

```text
Master Specification
>
Web Product / UX Implementation Lock
>
Locked Implementation Architecture
>
accepted closed Phase 1–6 implementation
>
this Phase 7 guide
>
packet-specific execution instructions
```

Do not rewrite locked clinical/domain semantics simply to make a UI easier.

Do not reinterpret safety, monitoring, engagement, content selection, clinical-case, correction, or historical semantics.

The final phase may add read models, governance workflows, navigation, visual components, and administrative control surfaces where the locked documents already call for them.

---

# 3. Final-phase execution model

Use the established accelerated workflow:

```text
LOCKED DOCS + CURRENT HEAD
          ↓
ONE IMPLEMENTATION SWEEP
          ↓
Commit 1
          ↓
Commit 2
          ↓
Commit 3
          ↓
STOP — DO NOT PUSH
          ↓
USER PUSHES
          ↓
ONE AUTONOMOUS FINAL CLOSEOUT SWEEP
          │
          ├── audit entire Phase-7 diff
          ├── audit cross-phase stale/carry-forward seams
          ├── fix every P0/P1 immediately
          ├── fix useful/simple P2
          ├── add Phase-7 tests/invariants
          ├── run all required validation
          ├── fix failures
          ├── rerun until green
          ├── final visual/accessibility audit
          ├── final documentation truth sweep
          └── close Phase 7 AND the local-capstone project
          ↓
USER PUSHES
          ↓
PROJECT CLOSED
```

Codex must not stop between implementation commits.

During the later autonomous closeout:

- substantial in-scope corrections are implemented immediately;
- do not ask for approval when the governing docs determine the answer;
- choose the simplest logical correct implementation;
- only a genuinely irreconcilable specification contradiction is a valid stop condition.

---

# 4. Critical implementation philosophy

The planning is already done.

Phase 7 must be thorough, but it must not become an excuse for architectural wandering.

Do NOT:

- redesign the domain model without need;
- create speculative abstractions;
- add production infrastructure merely because the project is ending;
- add unrelated features to look impressive;
- convert the final phase into a months-long refactor;
- rewrite working Phase 1–6 services merely for aesthetic code consistency.

Prefer:

```text
existing correct backend truth
+
focused read models
+
focused governance actions
+
premium presentation
+
clear final documentation
```

over:

```text
new frameworks
+
new service architecture
+
generic analytics platform
+
generic CMS
+
generic workflow engine
```

When multiple approaches are valid:

> choose the **simplest repository-compatible solution that satisfies the locked documents and produces the strongest final product experience.**

---

# 5. Repository state observed at Phase 7 baseline

The repository was inspected at:

```text
dc2aa3a36c9936feadf7ed99461c1b27157f1222
```

The following are current facts and should guide implementation.

---

## 5.1 Patient routes already implemented

Current patient routes include:

```text
/patient/home
/patient/profile
/patient/onboarding
/patient/reduction-setup
/patient/check-in
/patient/check-in/history
/patient/check-in/action
/patient/support
```

The major locked patient surface still absent is:

```text
/patient/progress
```

The existing backend already stores enough authoritative historical material to build a truthful Progress read model:

- scheduled periods;
- authoritative assessment revisions;
- item responses;
- consumption summaries;
- recovery-goal versions;
- completion status;
- correction/revision provenance.

Do not invent a recovery score.

---

## 5.2 Current Patient navigation is not yet aligned with the final lock

The current PatientShell promotes:

```text
Home
Setup
Check-in
History
Support
Profile
```

The locked final top-level patient information architecture is:

```text
Home
Check-in
Progress
Support
Profile
```

Phase 7 should:

- add Progress;
- stop treating Setup and History as permanent top-level patient destinations;
- keep onboarding/setup and history reachable contextually;
- preserve direct routes for old links;
- create a cleaner primary navigation model.

---

## 5.3 Clinician routes already implemented

Current clinician routes include:

```text
/clinician/patients
/clinician/review-queue
/clinician/engagement
/clinician/safety
/clinician/patients/:patientId/monitoring
```

The main remaining locked clinician surfaces are:

```text
/clinician/overview
a cohesive patient detail hub
trajectory visualization
meaningful patient timeline/history
```

The existing monitoring-detail screen already contains:

- freshness;
- Level-2 visibility;
- current Level-3 case;
- task state;
- reason history.

Do not discard that work.

Evolve it into a stronger patient-centered detail experience.

---

## 5.4 Current Clinician navigation is incomplete

The current shell promotes:

```text
Patients
Review Queue
Engagement
Safety
```

The locked final clinician navigation is:

```text
Overview
Patients
Review Queue
Engagement
Safety
```

Phase 7 must add Overview and make route-aware navigation visually correct.

Do not keep any hard-coded tab highlighted regardless of the current route.

---

## 5.5 Admin routes already implemented

Current admin routes include:

```text
/admin/users
/admin/configuration/regional-routing
/admin/safety
/admin/operations
```

The major remaining locked admin surfaces are:

```text
/admin/overview
/admin/content
/admin/audit
```

Phase 7 must complete these.

---

## 5.6 Current Admin navigation is incomplete

The current shell promotes variants of:

```text
Users & Access
Routing
Safety
Operations
```

The locked final admin information architecture is:

```text
Overview
Users & Access
Content
Configuration
Operations
Audit
```

Regional routing should remain available under Configuration.

Safety administration may remain a clear sub-route/current page, but the top-level navigation must not feel like a collection of implementation phases.

---

## 5.7 The current shared design system is useful but still small

Current shared patterns include roughly:

```text
ConfirmActionDialog
FormField
PageHeader
StateBadge
Loading/Error/Empty/Restricted state primitives
```

This is a valid foundation.

Phase 7 should add only genuinely reused patterns needed by the completed product, such as:

```text
Workspace navigation/header pattern
SectionHeader
SummaryMetric / StatCard
DataTable frame
FilterBar
FreshnessBadge
CompletionStatus
DataCoverageIndicator
TrendChart
ChartDataTable / accessible fallback
Timeline
DetailPanel / Drawer pattern where repeatedly useful
```

Do not invent a giant design-system package.

---

## 5.8 Recharts is locked but not yet installed

The Locked Architecture names Recharts for product charts.

The current `apps/web/package.json` does not include it.

Patient Progress and clinician trajectories justify adding this dependency now.

Phase 7 may add Recharts once.

Charts must be wrapped by project-owned accessible components.

Do not sprinkle raw Recharts configuration across multiple pages.

---

## 5.9 Current visual token system is already viable

The global stylesheet already provides:

- semantic OKLCH colors;
- surface hierarchy;
- status colors;
- spacing/page gutter;
- border radius;
- shadows;
- reduced-motion handling.

Phase 7 should refine and extend this rather than replace Tailwind/design tokens.

Do not add another styling framework.

---

## 5.10 Current Patient Home is functional and reasonably polished

Patient Home already has:

- current-action hero;
- check-in status;
- support summary;
- reminder state;
- safety boundary.

Phase 7 should **refine**, not rewrite it.

Remove implementation/debug-style patient copy such as explanatory statements about external notifications or reconciliation mechanics.

Those belong in documentation/admin context, not the patient-facing product.

---

## 5.11 Current clinician directory still exposes implementation-oriented information

The current patient directory includes:

- raw patient UUID in the main identity cell;
- raw-ish preference values;
- relatively implementation-oriented status text.

The final product should:

- prioritize patient name and clinically useful monitoring context;
- humanize enums;
- move raw identifiers into secondary/copyable detail;
- preserve provenance without making the directory feel like a database inspector.

---

## 5.12 Current clinician monitoring detail is a good backend-truth foundation

Do not rebuild clinical review semantics.

Improve information architecture so the final patient detail can present:

```text
Overview
Check-ins
Consumption
Cases
Timeline
```

or an equivalent compact structure.

The exact tab implementation can follow existing components, but backend truth must remain authoritative.

---

## 5.13 Current Admin Users page is functional but visually operational/basic

It already supports:

- provisioning;
- roles;
- account state;
- identity verification;
- patient assignments;
- consequential confirmation.

Phase 7 should preserve these semantics and improve:

- table hierarchy;
- role/state labels;
- detail-panel quality;
- forms;
- responsive behavior;
- consistent navigation.

Do not rewrite identity management.

---

## 5.14 Content persistence already exists but Admin governance does not

Phase 5 already created:

```text
content_resources
content_resource_versions
content_feedback
content_suppressions
content_resolution_records
available_followups
content_delivery_audits
```

The current API is patient-only.

There is no Admin Content Management route.

Phase 7 must add governance around the existing model.

---

## 5.15 Important content-governance database issue

The Phase-5 migration created an update/delete trigger on:

```text
content_resource_versions
```

that currently rejects **every** UPDATE or DELETE.

Despite the trigger message referring to approved content, it applies to:

```text
DRAFT
UNDER_REVIEW
APPROVED
RETIRED
REJECTED
```

equally.

This means a real draft/review workflow cannot be implemented without a controlled migration.

Phase 7 must correct this surgically.

The final rule must be:

```text
DRAFT
→ editable under optimistic concurrency

DRAFT
→ UNDER_REVIEW
→ content fields freeze

UNDER_REVIEW
→ APPROVED or REJECTED
→ explicit privileged review transition

APPROVED
→ immutable content/eligibility fields

APPROVED
→ RETIRED
→ lifecycle-only audited transition

REJECTED / RETIRED
→ historical/read-only
```

DELETE remains forbidden.

Do not remove the immutability guard entirely.

---

## 5.16 Current content resolver must remain authoritative

The patient content resolver already correctly:

- selects approved resources;
- uses latest eligible version per logical resource;
- applies content volume;
- preferences;
- safety;
- cooldown;
- suppression;
- deterministic rotation.

Admin governance must not duplicate or bypass these rules.

There is never an Admin:

```text
FORCE DELIVER
```

action.

---

## 5.17 Audit persistence already exists

The platform already has append-only:

```text
audit_events
```

with:

```text
eventId
actor
action
entity type/id
patientId
occurredAt
reason
rule-set version
instrument version
configuration version
source revision reference
metadata
requestId
```

There is no dedicated Audit Explorer module/page yet.

Phase 7 should expose a **read-only, permissioned, privacy-aware** explorer around this authoritative table.

Do not build event sourcing.

---

## 5.18 Focused Operations exists but broader operational visibility is incomplete

Phase 6 added technical failures.

Current Operations does not yet provide a coherent read view of general:

```text
OperationalIncident
```

rows.

Phase 7 should add useful incident visibility because those records already exist and are a strong demonstration of safe failure handling.

Do not fake external delivery/provider/job sections that were explicitly deferred.

---

## 5.19 The prototype seed lacks rich longitudinal showcase history

Current seed provides:

- core patient;
- clinician;
- admin;
- approved content;
- Phase-6 engagement scenarios.

It does not provide a rich multi-week longitudinal patient history suitable for a visually meaningful Progress/trajectory demonstration.

Phase 7 should solve this carefully.

Do not hard-code fake chart arrays into React.

Prefer a small deterministic prototype showcase history created through accepted domain/service seams so:

- authoritative revisions remain valid;
- derived monitoring remains reproducible;
- corrections/provenance remain coherent;
- invariant suites remain green.

If generating a complete showcase history through existing domain services proves disproportionately complex, prefer a smaller **valid** history over a large inconsistent fake history.

Correctness wins over fixture spectacle.

---

# 6. Known stale/carry-forward items Phase 7 must explicitly resolve

This final phase must not leave ambiguous “later” work behind.

During implementation and closeout, search the repository for:

```text
TODO
FIXME
Phase 7
later scope
future phase
pending
not implemented
not current
placeholder
closeout pending
validation pending
production TODO
```

Classify each finding into exactly one category:

```text
A. Required for final local capstone
   → implement now.

B. Production-only / explicitly deferred
   → retain as deferred and document clearly.

C. Historical implementation-guide text
   → preserve as historical where useful,
     but correct misleading current-status statements.

D. Obsolete/stale statement
   → remove or correct.
```

Do not silently ignore stale current-state documentation.

---

## 6.1 Known stale UX-lock evaluator journey

The current UX document contains a stale later section saying:

```text
Patient Home/Progress, engagement ... are not current routes.
```

This is now false because:

- Patient Home exists;
- clinician Engagement exists;
- focused Operations exists.

Phase 7 must rewrite the **current evaluator/demo journey** to match the final implementation.

Do not leave contradictory “current state” descriptions in different parts of the same authoritative UX document.

---

## 6.2 Known Phase-6 guide SHA typo

The current Phase-6 guide records its implementation-guide commit as:

```text
dcc2c32ceb41de835af1f2cb510cba2dbf91392c4
```

but the actual commit is:

```text
dcc2c32ceb41de835af1f2cb510cba2dbf91392c
```

Phase 7 final documentation sweep must correct this historical metadata typo.

---

## 6.3 Phase-6 wording that implies production items must be Phase 7

Some Phase-6 text uses wording similar to:

```text
production/Phase-7 handoff items
```

For this final local-capstone plan, production-only items are **not** automatically Phase-7 blockers.

Update current/final documentation so they are explicitly:

```text
production-deferred beyond the local-capstone project boundary
```

where appropriate.

---

## 6.4 `RESOLVED_PROGRAM_CLOSED` carry-forward

The Master Specification contains the canonical engagement terminal vocabulary:

```text
RESOLVED_PROGRAM_CLOSED
```

The current local implementation has the enum/event vocabulary but does not provide a full program enrollment/discharge lifecycle.

Do **not** invent a discharge/program-management subsystem without a governing state model.

During Phase 7:

1. inspect whether any accepted existing program-closure owner/state exists;
2. if there is enough locked behavior to implement a small explicit authorized transition safely, do so;
3. otherwise document `RESOLVED_PROGRAM_CLOSED` as reserved canonical terminal vocabulary not exercised by the local capstone because full program-membership/discharge semantics are not specified.

Do not leave a misleading “Phase 7 will definitely build a full program closure system” statement.

---

# 7. Final local-capstone implementation boundary

Phase 7 completes the product for local demonstration.

It does not convert the system into a real-patient deployed clinical service.

---

## 7.1 Implement in Phase 7

### Patient

- final Patient shell/navigation;
- Patient Progress;
- accessible longitudinal charts;
- completion/missingness visualization;
- goal-aware consumption progress;
- final refinement of Home;
- final refinement of onboarding;
- final refinement of reduction setup;
- final refinement of Check-in;
- final refinement of history/corrections;
- final refinement of Support;
- final refinement of Profile;
- final refinement of safety-controlled patient experience.

### Clinician

- Clinician Overview;
- final patient directory;
- cohesive patient detail;
- trajectories;
- check-in/consumption context;
- cases;
- meaningful timeline/history;
- final Review Queue refinement;
- final Engagement refinement;
- final Safety refinement.

### Admin

- Admin Overview;
- Content Management;
- Content version/review governance;
- content coverage;
- focused operational-incident visibility;
- final technical-failure Operations refinement;
- Audit Explorer;
- final Users/Access refinement;
- final Configuration/Regional Routing refinement;
- final Safety administration refinement.

### Product-wide

- premium role-specific shells;
- route-aware navigation;
- account/sign-out affordance;
- auth-page refinement;
- design-system completion;
- Recharts accessible wrapper;
- responsive polish;
- accessibility polish;
- copy polish;
- prototype showcase state;
- final demo runbook;
- final documentation truth sweep.

---

## 7.2 Intentionally defer beyond local capstone

Do NOT implement merely to claim completeness:

```text
pg-boss production scheduler
unattended recurring engagement workers
external engagement email
external clinician notification email
push notifications
SMS
notification provider callbacks
notification retry queues
notification bundling infrastructure
production worker health/capacity
automatic outage/cohort detector
production care-team routing
service fallback delivery platform
backup automation
restore automation
RPO/RTO enforcement
retention/deletion engine
production secret management
deployment infrastructure
horizontal scaling
high availability
vendor/compliance activation
full real-patient readiness
```

These items must be explicitly documented as:

```text
production-deferred
```

not:

```text
forgotten
pending mysterious later phase
```

There is no later capstone phase.

---

# 8. Final target information architecture

The final evaluator-facing application should converge on:

```text
APPLICATION
│
├── Patient
│   ├── Home
│   ├── Check-in
│   ├── Progress
│   ├── Support
│   └── Profile
│
│   Contextual routes:
│   ├── Onboarding
│   ├── Reduction setup
│   ├── Check-in history
│   └── Safety-controlled flow
│
├── Clinician
│   ├── Overview
│   ├── Patients
│   ├── Review Queue
│   ├── Engagement
│   └── Safety
│
│   Patient detail:
│   ├── Overview
│   ├── Check-ins
│   ├── Consumption
│   ├── Cases
│   └── Timeline
│
└── Admin
    ├── Overview
    ├── Users & Access
    ├── Content
    ├── Configuration
    ├── Operations
    └── Audit
```

Do not turn historical/setup pages into permanent first-level navigation unless the UX lock requires it.

---

# 9. Final route target

At final local-capstone closeout, aim for:

## Patient

```text
/patient/home
/patient/check-in
/patient/check-in/action
/patient/check-in/history
/patient/progress
/patient/support
/patient/profile
/patient/onboarding
/patient/reduction-setup
```

## Clinician

```text
/clinician/overview
/clinician/patients
/clinician/patients/:patientId
/clinician/patients/:patientId/monitoring   # retained compatibility/redirect if useful
/clinician/review-queue
/clinician/engagement
/clinician/safety
```

## Admin

```text
/admin/overview
/admin/users
/admin/content
/admin/content/:resourceId
/admin/configuration/regional-routing
/admin/safety
/admin/operations
/admin/audit
```

Do not break accepted old deep links unnecessarily.

---

# 10. Phase 7 implementation commits

Use THREE balanced implementation commits.

| Commit | Message | Outcome |
|---|---|---|
| 1 | `feat: add longitudinal progress and clinician overview` | Patient Progress, chart system, Clinician Overview, cohesive patient detail/trajectory/timeline read models and screens |
| 2 | `feat: add admin content governance and audit tooling` | Content lifecycle/governance, Admin Overview, operational incidents, Audit Explorer, permissions/contracts/routes |
| 3 | `feat: deliver final product experience and capstone cohesion` | Whole-product shell/design refinement, auth/patient/clinician/admin polish, showcase seed/demo cohesion, stale-work sweep, final deferral/documentation alignment |

Do not stop between commits.

Do not push.

Tests and Phase-7 invariant SQL are added during the later autonomous final closeout sweep.

---

# 11. Commit 1 — longitudinal progress and clinician overview

## Commit message

```text
feat: add longitudinal progress and clinician overview
```

## Primary goal

Complete the remaining patient/clinician longitudinal experience using existing authoritative data.

No predictive model.

No synthetic recovery score.

No new clinical decision rules.

---

# 12. Commit 1 — inspect before editing

Before implementing Commit 1, inspect:

```text
apps/backend/prisma/schema.prisma

apps/backend/src/modules/assessments/
apps/backend/src/modules/monitoring/
apps/backend/src/modules/consumption/
apps/backend/src/modules/profiles/
apps/backend/src/modules/clinical/
apps/backend/src/modules/engagement/
apps/backend/src/modules/safety/

apps/backend/src/shared/authz/
apps/backend/src/shared/clock/
apps/backend/src/app.ts

packages/contracts/src/patient/
packages/contracts/src/clinician/

apps/web/src/features/patient/
apps/web/src/features/clinician/
apps/web/src/components/
apps/web/src/app/
apps/web/src/styles/

apps/web/package.json
```

Do not create a generic analytics service.

Use the module that owns the underlying truth.

---

# 13. Patient Progress backend contract

Add:

```text
GET /api/v1/patient/progress
```

Permission:

```text
PATIENT_PROGRESS_READ
```

Scope:

```text
OWN_PATIENT
```

The backend read model is authoritative.

React must not join multiple APIs and decide whether a point is missing/partial/corrected.

---

# 14. Patient Progress period window

Use a small useful historical window.

Recommended default:

```text
8 most recent scheduled weekly periods
```

This matches the intended compact product view.

If a slightly larger existing repository convention is already present, reuse it.

Do not add an arbitrary analytics date-range builder.

Every scheduled period in the selected window must appear even if there is no valid assessment.

That is necessary to render missingness truthfully.

---

# 15. Patient Progress authoritative revision policy

For each period:

```text
scheduled period
→ logical WeeklyAssessment where present
→ current authoritative revision only
→ item responses tied to authoritative revision
```

Corrections:

- chart the current authoritative value;
- expose that a revision/correction exists;
- link to existing history for revision detail;
- do not draw obsolete superseded values as current.

Historical backfill:

- show in its correct scheduled period;
- do not place it according to submission timestamp.

---

# 16. Patient Progress missing/partial policy

Use explicit point metadata:

```text
MISSING
PARTIAL
COMPLETE
```

Rules:

### MISSING

```text
value = null
chart gap = true
```

No interpolation.

### PARTIAL

Answered items may appear.

Unanswered items:

```text
value = null
```

A partial marker must be visually distinguishable from a complete point.

### COMPLETE

All required values may display.

Charts must use:

```text
connectNulls = false
```

or equivalent.

Do not smooth across missing weeks.

---

# 17. Patient Progress item trajectories

The strongest patient-facing default trajectories are:

```text
craving
recovery_confidence
negative_mood
```

These are direct weekly item measurements.

They are not synthetic health scores.

Use clear patient-facing labels such as:

```text
Cravings
Confidence
Mood difficulty
```

The scale remains:

```text
0–7
```

Do not invert values secretly to make every line “up is good.”

If direction differs:

- label it clearly;
- use explanatory microcopy;
- do not transform the raw score without explicit documentation.

Optional secondary signals may be shown in a compact selector if the implementation stays simple:

```text
risky_situations
relationship_problems
family_friend_support
sleep_difficulty
```

Do not make the screen visually overloaded.

---

# 18. Patient Progress alcohol/goal visualization

For a period-effective REDUCTION goal:

show truthful consumption context.

For complete weekly coverage:

```text
completeWeekTotalStandardDrinks
targetWeeklyStandardDrinks
targetStatus
```

For partial coverage:

- show known quantity only as explicitly partial;
- show coverage;
- do not represent it as a complete-week total;
- do not claim target met from incomplete data unless the locked rules explicitly support a NOT_MET determination.

For ABSTINENCE:

do not fabricate a quantity chart when quantity data is not required.

A simple weekly reported-use/completion context may be shown where patient-safe.

For UNSURE:

remain goal-neutral.

---

# 19. Patient Progress forbidden metrics

Do NOT show as a patient-facing headline score:

```text
riskScore
rawProtectionScore
recoveryProgress
WHO rank
Level 2
Level 3
clinical reason codes
```

Do not create:

```text
Recovery score 82%
Sobriety score
Wellness score
Risk gauge
```

The product does not have a validated overall patient score.

---

# 20. Patient Progress summary

Useful summary cards may include factual operational values such as:

```text
check-ins completed in shown window
partial check-ins
missing scheduled periods
current recovery goal
```

These are allowed because they are direct counts/context.

Do not convert them into performance grades.

---

# 21. Recharts and shared chart architecture

Add Recharts as the one justified Phase-7 web dependency.

Create a small project-owned chart layer, for example:

```text
apps/web/src/components/charts/
  chart-frame.tsx
  trend-chart.tsx
  chart-data-table.tsx
```

Exact naming may adapt.

The wrapper must own:

- semantic chart title;
- text description;
- responsive container;
- axis formatting;
- tooltip formatting;
- missing-data behavior;
- partial-data indication;
- accessible tabular alternative;
- reduced-motion behavior where relevant.

Do not import raw Recharts directly from every page.

---

# 22. Chart visual rules

Use:

```text
simple lines
simple bars
clear target reference lines
clear markers
restrained grid lines
semantic status colors
```

Avoid:

```text
3D
donuts for arbitrary counts
radial gauges
gradients purely for decoration
smoothed curves that imply measurements between weeks
animated chart theatre
```

Use linear geometry.

Do not imply continuous physiological measurement from weekly survey points.

---

# 23. Chart accessibility

Every important chart needs an accessible alternative.

At minimum:

- visible title;
- contextual summary;
- programmatic label/description;
- table/list fallback containing the same values;
- missing and partial states represented in text;
- colors never act as the only differentiator;
- focusable/keyboard-usable controls;
- tooltips are supplementary, not the only source of data.

Charts must remain useful at 200% zoom.

---

# 24. Patient Progress UI

Add:

```text
/patient/progress
```

The page should feel calm and motivating without implying clinical success/failure.

Suggested composition:

```text
Progress
────────────────────────────────────

Your recent check-ins
[ factual completion summary ]

[ Cravings  | Confidence | Mood difficulty ]

8-week trend chart
[ accessible table ]

Alcohol and goal context
[ only when applicable ]

Check-in completion history

[ View detailed check-in history ]
```

Do not make every metric a card.

Use whitespace.

---

# 25. Patient Progress safety precedence

Wrap the Progress surface in the established patient safety boundary.

If ordinary monitoring/content presentation must be blocked:

the safety-controlled experience takes precedence.

Do not expose a visually normal Progress dashboard behind a `BLOCK_AND_HANDOFF` safety state.

---

# 26. Clinician Overview backend

Add:

```text
GET /api/v1/clinician/overview
```

Permission:

```text
CLINICIAN_OVERVIEW_READ
```

Scope:

```text
ASSIGNED_PATIENTS
```

Only directly assigned/currently authorized patients appear.

Do not make this an admin-wide patient census.

---

# 27. Clinician Overview facts

Useful factual summary counts:

```text
assigned patients
open clinical review work
engagement attention
active safety work
monitoring current/stale/unavailable distribution
```

All counts must come from actual backend state.

Do not use illustrative numbers.

---

# 28. Clinician Overview attention model

Do not invent one synthetic global clinical “priority score.”

Instead present separate attention categories:

```text
Clinical review
Engagement
Safety
```

Within a category, use its existing lifecycle/tier/severity rules.

Suggested composition:

```text
Clinician Overview
────────────────────────────────────

Assigned patients      Review work
Engagement attention   Safety

Needs attention

Clinical Review
[ actual rows ]

Engagement
[ actual rows ]

Safety
[ actual rows ]

Monitoring coverage
[ current / stale / unavailable ]
```

No fake cross-domain severity ranking.

---

# 29. Clinician patient detail target

Create a cohesive patient hub.

Preferred route:

```text
/clinician/patients/:patientId
```

Retain:

```text
/clinician/patients/:patientId/monitoring
```

as a compatibility route or redirect to the new hub if useful.

Do not break accepted existing links.

---

# 30. Clinician patient detail structure

Recommended information structure:

```text
Patient name
current goal
monitoring freshness
latest check-in

Tabs/sections:
Overview
Check-ins
Consumption
Cases
Timeline
```

The exact visual form may be tabs, segmented navigation, or clear page sections.

Keep it easy to scan.

---

# 31. Clinician patient Overview

Reuse current accepted truth:

- source/freshness;
- completion;
- period;
- goal context;
- Level-2 visibility;
- open Level-3 clinical case;
- engagement state;
- safety status where actor may view it;
- current durable task context.

Do not duplicate calculations in React.

---

# 32. Clinician Check-ins / trajectories

Reuse the same authoritative weekly period/revision semantics as Patient Progress.

Clinician may receive richer provenance:

```text
period
completion
submission classification
revision number
corrected indicator
source revision
```

Keep raw UUIDs secondary.

Trajectories can include more direct weekly items than the patient page if useful.

Still:

- no interpolation;
- no synthetic recovery score;
- missing remains a gap.

---

# 33. Clinician Consumption

For REDUCTION:

show:

```text
weekly quantities
coverage
target
baseline context
target status
valid WHO context only where computed
```

For non-reduction goal:

show an appropriate neutral state.

Do not display WHO context as a patient-facing recommendation.

Do not turn it into a new notification rule.

---

# 34. Clinician Cases

Present separate:

```text
Clinical review
Engagement
Safety
```

Never merge case identities.

Use consistent lifecycle components.

Do not create new cross-case status.

---

# 35. Clinician Timeline

The timeline is a human-readable clinical/product history.

It is **not** the full forensic Audit Explorer.

Useful events include:

```text
weekly assessment submitted
assessment corrected
historical assessment added
current flag changed
clinical case created/changed
engagement case created/returned
safety case event
patient support made available/delivered
goal change
```

Only show events the clinician is allowed to see for the assigned patient.

Do not give clinicians blanket raw AuditEvent access.

---

# 36. Clinician timeline implementation strategy

Prefer a typed patient-timeline projection composed from existing authoritative domain tables/events.

Do not expose arbitrary JSON metadata.

Each timeline item should carry:

```text
type
title
short factual description
occurredAt
source/revision reference where useful
state label
```

No internal stack traces/configuration blobs.

---

# 37. Clinician directory final refinement

Upgrade the directory to prioritize:

```text
patient
current monitoring context
latest check-in/freshness
current goal
review indicator
engagement indicator
safety indicator where authorized
```

Do not overload the table.

Raw UUID should not dominate the row.

If an identifier is useful:

place it in secondary detail or copy control.

Humanize enums.

---

# 38. Commit 1 likely files

Likely changes include:

```text
apps/backend/src/modules/monitoring/*
apps/backend/src/modules/clinical/*
apps/backend/src/modules/engagement/*        # read-model reuse only
apps/backend/src/modules/safety/*            # read-model reuse only
apps/backend/src/shared/authz/permissions.ts
apps/backend/src/app.ts

packages/contracts/src/patient/progress.ts
packages/contracts/src/clinician/overview.ts
packages/contracts/src/clinician/patient-detail.ts
packages/contracts/src/index.ts
packages/contracts/src/auth/auth.ts          # final destination/permission contract if needed

apps/web/package.json
pnpm-lock.yaml

apps/web/src/components/charts/*
apps/web/src/components/patterns/*

apps/web/src/features/patient/progress/*
apps/web/src/features/clinician/overview/*
apps/web/src/features/clinician/patients/*
apps/web/src/features/clinician/review/*

apps/web/src/app/router/router.tsx
apps/web/src/app/shells/patient-shell.tsx
apps/web/src/app/shells/clinician-shell.tsx
```

Do not modify unrelated domain evaluation logic.

---

# 39. Commit 1 acceptance criteria

1. Patient Progress exists.
2. Progress uses scheduled periods, not submission dates.
3. Missing weeks are visible gaps.
4. Partial weeks are explicit.
5. Corrected authoritative values replace obsolete values.
6. Patient sees no synthetic recovery/risk score.
7. Reduction consumption is coverage-aware.
8. Charts are accessible.
9. Charts have table/text fallback.
10. Clinician Overview uses actual assigned-patient state.
11. No fake overview counts.
12. Clinical/engagement/safety remain separate.
13. Patient detail is cohesive.
14. Clinician trajectories preserve provenance.
15. Timeline is meaningful but not raw forensic audit.
16. Old `/monitoring` deep link remains valid or redirects safely.
17. Backend remains authoritative.
18. No new clinical decision rule exists.

After the commit:

- stage only intended files;
- create local commit;
- do not push;
- do not stop;
- continue directly to Commit 2.

---

# 40. Commit 2 — Admin Content Governance and Audit Tooling

## Commit message

```text
feat: add admin content governance and audit tooling
```

## Primary goal

Complete the locked administrative/governance surface around existing authoritative records.

This is not a generic CMS.

This is not a generic BI dashboard.

It is governance tooling for this specific deterministic AUD monitoring product.

---

# 41. Commit 2 — permissions

Add the minimum explicit permissions.

Recommended names:

```text
ADMIN_OVERVIEW_READ

CONTENT_RESOURCE_READ
CONTENT_RESOURCE_EDIT
CONTENT_RESOURCE_APPROVE

AUDIT_READ

OPERATIONAL_INCIDENT_READ
```

Adapt names only if existing repository conventions strongly favor another exact form.

Do not use one giant:

```text
ADMIN_ALL
```

permission.

---

# 42. Permission assignment

Recommended:

## ADMIN

May receive:

```text
ADMIN_OVERVIEW_READ
CONTENT_RESOURCE_READ
CONTENT_RESOURCE_EDIT
CONTENT_RESOURCE_APPROVE
AUDIT_READ
OPERATIONAL_INCIDENT_READ
```

subject to existing privileged identity/freshness requirements.

## OPERATIONS

May receive:

```text
ADMIN_OVERVIEW_READ
AUDIT_READ
OPERATIONAL_INCIDENT_READ
TECHNICAL_FAILURE_READ
ENGAGEMENT_TECHNICAL_OVERRIDE
```

Do not automatically give OPERATIONS content-approval permission.

## CLINICIAN

No Admin Content or full Audit Explorer permission.

## PATIENT

No Admin permissions.

Least privilege remains authoritative.

---

# 43. Content-governance migration

Add one focused migration to make the existing version model governable.

Do not replace the content tables.

---

## 43.1 Add optimistic concurrency to content drafts

Add to `ContentResourceVersion` if not already present:

```text
rowVersion
updatedAt
```

Recommended:

```text
row_version INTEGER NOT NULL DEFAULT 1
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Use `rowVersion` for mutable DRAFT actions.

Do not use timestamps as the only concurrency token.

---

## 43.2 Replace the over-broad append-only trigger safely

Keep the protective trigger name if possible so earlier invariant/history checks remain meaningful:

```text
content_resource_versions_append_only
```

but replace its function with controlled lifecycle enforcement.

The DB guard must enforce:

### DELETE

Always reject.

### DRAFT

Permit:

- content/eligibility edits;
- rowVersion increment;
- transition to UNDER_REVIEW.

Never allow changing:

```text
resourceId
version number
```

### UNDER_REVIEW

Content and eligibility fields are frozen.

Permit only controlled review transition:

```text
UNDER_REVIEW → APPROVED
UNDER_REVIEW → REJECTED
```

with reviewer/time/provenance.

### APPROVED

Content/eligibility fields remain immutable.

Permit only the explicitly controlled lifecycle transition:

```text
APPROVED → RETIRED
```

where:

- content body unchanged;
- eligibility metadata unchanged;
- `retiredAt` set;
- delivery eligibility disabled as required;
- actor/action audited by application service.

### RETIRED / REJECTED

Read-only historical rows.

Do not permit casual reactivation.

---

# 44. One currently approved version per resource

The existing resolver must never accidentally fall back to an old approved version after retiring a newer one.

A clean governance model is:

```text
one current APPROVED version per logical resource
```

When approving a newer version:

```text
current approved version
→ RETIRED

under-review new version
→ APPROVED
```

in one transaction.

Where practical add a DB partial unique constraint/index for:

```text
resource_id WHERE review_status = APPROVED
```

after verifying current data is compatible.

Do not retroactively rewrite content bodies.

---

# 45. New content resource workflow

Add a specific Admin action:

```text
Create content resource
```

It creates:

```text
ContentResource
+
version 1 or next repository-compatible initial version
+
DRAFT
```

Use explicit structured fields.

Do not accept arbitrary JSON blobs for the whole resource.

---

# 46. New draft from approved content

Editing approved content must create a NEW DRAFT version.

Never edit the approved body in place.

Conceptually:

```text
approved version vN
        ↓
Create new draft
        ↓
vN+1 DRAFT
```

Copy fields as a starting point.

Clear:

```text
reviewedBy
reviewedAt
retiredAt
```

New draft remains non-deliverable until approved.

---

# 47. Draft editing

Permit editing only DRAFT.

Require:

```text
expectedRowVersion
```

On success:

```text
rowVersion++
```

Update `updatedAt`.

Stale edit returns:

```text
409 VERSION_CONFLICT
```

The UI must reload current data.

---

# 48. Submit for review

Explicit action:

```text
DRAFT → UNDER_REVIEW
```

Require:

- content edit permission;
- expected row version;
- idempotency key;
- audit event.

After submission:

content fields are frozen.

No generic status dropdown.

---

# 49. Approve content

Explicit privileged action:

```text
UNDER_REVIEW → APPROVED
```

Require:

- `CONTENT_RESOURCE_APPROVE`;
- fresh privileged session where repository policy expects it;
- expected row version/current lifecycle;
- idempotency key;
- actor;
- timestamp;
- reason/provenance if required;
- one transaction.

If a previous APPROVED version exists:

retire it in the same transaction before approving the new version.

Record audit.

---

# 50. Reject content

Explicit privileged action:

```text
UNDER_REVIEW → REJECTED
```

Require:

- approval permission;
- fresh session where required;
- reason;
- actor/time;
- audit.

Rejected content never reaches patients.

To revise:

create another DRAFT.

Do not mutate rejected row back to draft.

---

# 51. Retire content

Explicit privileged action:

```text
APPROVED → RETIRED
```

Require:

- approval/governance permission;
- confirmation;
- reason;
- actor/time;
- audit.

Retired content is unavailable for future patient selection.

Historical delivery records still resolve to the retired version.

Do not delete it.

---

# 52. Content eligibility integrity

Admin UI cannot bypass:

```text
APPROVED
enabled
locale
goal
preference
safety
contraindication
suppression
channel
resource-volume gate
cooldown
rotation
```

Do not add:

```text
Deliver now
Force show
Ignore safety
Override refusal
```

---

# 53. Admin content API

Recommended routes:

```text
GET  /api/v1/admin/content
GET  /api/v1/admin/content/:resourceId

POST /api/v1/admin/content

POST /api/v1/admin/content/:resourceId/versions

PUT  /api/v1/admin/content/:resourceId/versions/:versionId

POST /api/v1/admin/content/:resourceId/versions/:versionId/submit-review

POST /api/v1/admin/content/:resourceId/versions/:versionId/approve

POST /api/v1/admin/content/:resourceId/versions/:versionId/reject

POST /api/v1/admin/content/:resourceId/versions/:versionId/retire
```

Exact route names may adapt.

Do not expose a generic:

```text
PATCH status
```

endpoint.

---

# 54. Content list/read model

Admin Content list should show:

```text
title
intervention class
locale
current version
current lifecycle
effective/retired state
resource coverage contribution
last review
```

Tabs/filters:

```text
All
Draft
In review
Approved
Retired
Rejected
```

Use server-side filtering if simple.

Do not implement a generic full-text search engine.

---

# 55. Content coverage

Show resource coverage by intervention class and locale.

Reuse the exact same Phase-5 volume policy:

```text
high-frequency:
minimum 3 approved eligible logical resources

other:
minimum 2
```

Counts must be logical resources, not version rows.

Show clearly:

```text
3 / 3 — coverage met
1 / 2 — coverage gap
```

Do not claim content coverage equals clinical quality.

---

# 56. Content detail UI

Suggested sections:

```text
Content
Eligibility
Versions
Review
Delivery history
```

Show:

- safe Markdown preview;
- intervention class;
- locale/language;
- allowed goals;
- preference constraints;
- safety compatibility;
- contraindications;
- duration;
- status;
- reviewer/time;
- effective date;
- retired state;
- provenance.

Do not render raw JSON as the primary interface.

Technical details may appear in an expandable secondary section.

---

# 57. Share safe Markdown

The patient Support screen already has constrained safe Markdown rendering.

Promote/reuse that renderer in a shared safe location if needed.

Admin preview and patient delivery must not drift into different HTML safety policies.

No `dangerouslySetInnerHTML`.

---

# 58. Admin Overview backend

Add:

```text
GET /api/v1/admin/overview
```

Permission:

```text
ADMIN_OVERVIEW_READ
```

This is operational/governance overview, not clinical charting.

---

# 59. Admin Overview factual metrics

Useful values:

```text
total provisioned users
active patients / monitoring participation count
open durable clinician tasks
unrouted tasks
open operational incidents
confirmed technical failures
content classes defined
content classes meeting volume coverage
routing configuration state
application mode
```

If displaying clinical-task totals:

show aggregate operational workload only.

Do not reveal patient clinical details to Admin Overview.

---

# 60. Admin Overview system status

Be truthful about the local-capstone boundary.

Do not display:

```text
Background workers healthy
Push delivery healthy
External notifications healthy
```

because those systems do not exist locally.

Instead either omit them or clearly show:

```text
Application/API     Available
PostgreSQL          Available
Prototype mode      Active
Real-patient mode   Intentionally unavailable
Background jobs     Deferred for local capstone
External delivery   Deferred for local capstone
```

Do not present a deferred production capability as a red failure.

---

# 61. Admin Overview needs-attention

Good candidates:

```text
open OperationalIncident rows
SYSTEM_UNROUTED_QUEUE tasks
confirmed technical failures
content coverage gaps
routing configuration issues
```

Do not create a fake cross-domain severity score.

---

# 62. Operational incidents

Extend Operations so it can show existing:

```text
OperationalIncident
```

rows.

Recommended:

```text
Technical failures
System incidents
```

as two coherent views/tabs.

Read-only incident inspection is sufficient unless an existing locked incident-resolution action already exists.

Do not invent a generic incident-management workflow.

---

# 63. Audit Explorer backend

Add a focused module/read service, for example:

```text
apps/backend/src/modules/audit/
```

This module is query-only.

It does not become a second event store.

---

# 64. Audit Explorer permission

Require:

```text
AUDIT_READ
```

and Admin/Operations authorized scope.

Do not grant it to ordinary patients/clinicians.

Clinician timeline uses a different, restricted projection.

---

# 65. Audit query filters

Recommended exact filters:

```text
patientId
entityType
entityId
action
actorId
from
to
cursor/page
```

A single exact-ID search box may resolve an entered identifier against:

```text
patientId
entityId
sourceRevisionReference
```

where safe.

Do not perform arbitrary unbounded ILIKE search inside metadata JSON.

---

# 66. Audit pagination

Use bounded pagination.

Recommended:

```text
default 25
max 100
```

Cursor by:

```text
occurredAt + eventId
```

or an equally deterministic stable ordering.

Do not return every audit row in one request.

---

# 67. Audit privacy

Audit Explorer may show:

```text
event id
timestamp
action
actor identity/role where allowed
entity type/id
patient reference
rule/config versions
reason
source revision reference
small safe metadata summary
```

Do not expose raw questionnaire responses or sensitive safety disclosure payloads merely because metadata exists.

Use a safe projection.

---

# 68. Audit Explorer UI

Suggested:

```text
Audit
──────────────────────────────────

[ Search ID… ]  Action ▾  Entity ▾  Date ▾

Timeline/table

16 Aug 22:14
Assessment submitted
patient ...
revision ...

16 Aug 22:14
Assessment evaluated
rule set ...
configuration ...

16 Aug 22:14
Clinical case created
...
```

Provide human-readable labels first.

Raw technical identifiers are secondary/copyable.

This surface should visibly demonstrate:

- deterministic state change;
- revisions;
- provenance;
- resource selection;
- case creation;
- technical/engagement operations.

---

# 69. Commit 2 likely files

```text
apps/backend/prisma/schema.prisma
apps/backend/prisma/migrations/<phase7_content_governance>/migration.sql

apps/backend/src/modules/content/*
apps/backend/src/modules/audit/*
apps/backend/src/modules/operations/*
apps/backend/src/modules/identity/*        # only aggregate read-model seam if useful
apps/backend/src/shared/authz/permissions.ts
apps/backend/src/app.ts

packages/contracts/src/admin/overview.ts
packages/contracts/src/admin/content.ts
packages/contracts/src/admin/audit.ts
packages/contracts/src/admin/operations.ts
packages/contracts/src/auth/auth.ts
packages/contracts/src/index.ts

apps/web/src/features/admin/overview/*
apps/web/src/features/admin/content/*
apps/web/src/features/admin/audit/*
apps/web/src/features/admin/operations/*
apps/web/src/features/admin/users/*
apps/web/src/features/admin/routing/*
apps/web/src/app/router/router.tsx
apps/web/src/app/shells/admin-shell.tsx

apps/web/src/components/patterns/*
```

Do not rewrite patient content resolution.

---

# 70. Commit 2 acceptance criteria

1. Admin Overview exists.
2. Overview numbers are real.
3. Deferred capabilities are not shown as fake healthy systems.
4. Content library exists.
5. DRAFT is editable.
6. DRAFT uses optimistic concurrency.
7. UNDER_REVIEW freezes content.
8. APPROVED content body/eligibility remains immutable.
9. Editing approved creates a new draft.
10. Approval is explicit and privileged.
11. Rejection is explicit and privileged.
12. Retirement is explicit and historical.
13. Previous approved version retires atomically when a new version is approved.
14. One current approved version per logical resource.
15. Patient resolver continues deterministic Phase-5 behavior.
16. No force-delivery bypass.
17. Coverage counts logical resources.
18. Safe Markdown preview is shared.
19. Operational incidents are visible.
20. Audit Explorer exists.
21. Audit access is permissioned.
22. Audit projection is privacy-aware.
23. Clinician does not gain Admin audit access.
24. No generic CMS or analytics system is introduced.

Then create the local Commit 2 and continue immediately.

---

# 71. Commit 3 — Final Product Experience and Capstone Cohesion

## Commit message

```text
feat: deliver final product experience and capstone cohesion
```

This commit is intentionally cross-cutting.

It is the final evaluator-facing refinement pass.

It is **not** permission to change locked domain logic.

---

# 72. Commit 3 mission

Every evaluator-facing page must look like it belongs to the same mature product.

Audit and refine:

## Authentication

```text
/login
/two-factor
/recover-account
/reset-password
/session-expired
workspace chooser/root
```

## Patient

```text
Home
Onboarding
Reduction setup
Check-in landing
Check-in action
Check-in history
Progress
Support
Profile
Safety-controlled states
```

## Clinician

```text
Overview
Patients
Patient detail
Review Queue
Engagement
Safety
```

## Admin

```text
Overview
Users & Access
Content
Configuration/Regional Routing
Safety
Operations
Audit
```

If an existing page is already excellent:

do not rewrite it merely to touch the file.

But no evaluator-facing screen should remain visibly unfinished, debug-like, or inconsistent.

---

# 73. Role-specific visual identities

The UX Lock deliberately expects different density per role.

---

## 73.1 Patient

Character:

```text
premium digital health
calm
spacious
gentle
clear
human
low cognitive load
```

Priorities:

- one clear next action;
- generous whitespace;
- readable type;
- reassuring state communication;
- minimal technical jargon;
- mobile-first.

Patient should not feel like a clinician dashboard.

---

## 73.2 Clinician

Character:

```text
professional healthcare workspace
controlled information density
strong hierarchy
fast scanning
clear provenance
serious worklist
```

Priorities:

- attention state;
- freshness;
- meaningful context;
- structured tables;
- efficient patient switching;
- responsive desktop-first layout.

Do not make it look like a consumer wellness app.

---

## 73.3 Admin

Character:

```text
polished operational console
dense but clean
governance-oriented
precise
high information confidence
```

Priorities:

- tables;
- filters;
- lifecycle/status;
- auditability;
- explicit privileged actions;
- clear operational state.

Do not make it visually sterile/raw.

---

# 74. Final authenticated shell architecture

Current simple top-navigation shells are not sufficient as the final visual system.

Implement a cohesive shell pattern.

Do not create three totally unrelated applications.

---

# 75. Patient shell target

For patient:

### Mobile

Use a polished compact header plus stable bottom navigation or equally strong mobile-first pattern for:

```text
Home
Check-in
Progress
Support
Profile
```

Ensure safe-area/padding behavior.

Do not let nav cover content.

### Desktop/tablet

Use a clean top/side navigation appropriate to the existing layout.

Setup and History remain contextual links.

---

# 76. Clinician shell target

For clinician desktop:

a restrained left navigation rail/sidebar is appropriate:

```text
Overview
Patients
Review Queue
Engagement
Safety
```

The content area should feel like a professional dashboard workspace.

At smaller widths:

collapse to a compact accessible menu.

Do not allow horizontal nav wrapping into awkward multiple lines.

---

# 77. Admin shell target

Use a professional operational sidebar/rail:

```text
Overview
Users & Access
Content
Configuration
Operations
Audit
```

Safety may remain reachable through an appropriate admin secondary route/context without breaking existing URL behavior.

The sidebar should communicate current location clearly.

---

# 78. Route-aware navigation

Use router-aware active state.

Do not hard-code:

```text
Safety is always active
Home is always active
Users is always active
```

Nested paths should highlight their parent destination.

---

# 79. Account affordance

Authenticated shells should include a consistent account affordance:

- user name or short identity;
- workspace/role;
- sign out.

Do not require returning to the root chooser merely to sign out.

Reuse current Better Auth sign-out behavior.

Keep account details subtle.

---

# 80. Root/workspace destinations

Once final overview/home routes exist, inspect the backend/session destination logic.

Update default destinations where correct:

```text
Patient   → /patient/home
Clinician → /clinician/overview
Admin     → /admin/overview
```

Do not break onboarding/safety gating.

If an incomplete patient must still enter setup first:

backend authority wins.

The root route should not bypass required onboarding/safety workflow.

---

# 81. Auth-page visual refinement

Use one cohesive auth shell.

Possible composition:

```text
product mark / identity
clear page title
short reassuring context
focused form
secondary help actions
```

Avoid giant marketing copy.

Avoid health promises.

Improve:

- field hierarchy;
- error messages;
- loading/submission state;
- 2FA clarity;
- recovery flow;
- session-expired state;
- workspace chooser.

---

# 82. Page-header consistency

Use one strong page-header system.

Each primary page should generally provide:

```text
eyebrow/context
clear H1
short description
optional primary action
```

Do not repeat technical implementation details as page descriptions.

---

# 83. Typography and spacing

Refine global hierarchy, not font novelty.

Recommended visual hierarchy:

```text
Page title
Section title
Card title
Label
Supporting text
Metadata
```

Use consistent vertical rhythm.

Do not make every card header visually equal.

Keep body line length readable.

---

# 84. Surface hierarchy

Use a restrained system such as:

```text
application background
primary content surface
subtle secondary surface
interactive surface
status surface
```

Avoid 10 competing shades.

Use shadows sparingly.

Important patient safety/clinical alerts should stand out through semantic styling, not huge decorative effects.

---

# 85. Status semantics

Every status should combine:

```text
text
+
shape/icon where useful
+
semantic color
```

Never color alone.

Humanize raw enums:

```text
CURRENT_ACTIVE → Current
CLEARANCE_PENDING → Clearance pending
SYSTEM_UNROUTED_QUEUE → Unrouted
```

Do not simply `replaceAll('_', ' ')` everywhere when a better user-facing phrase is needed.

---

# 86. Identifier presentation

Raw UUIDs are useful for provenance, not as primary UI.

Use:

- copyable secondary identifier;
- abbreviated ID in detail panel;
- full ID in Audit Explorer/technical details.

Do not put UUIDs directly under every patient name in main tables unless justified.

---

# 87. Date/time presentation

Centralize consistent date/time formatting.

Display:

- human-readable local date/time;
- timezone context where clinically relevant;
- exact timestamp in detail/tooltip if useful.

Do not show inconsistent browser-default formatting across pages.

The backend still owns period semantics.

---

# 88. Tables

Clinician/Admin tables should support:

- readable column widths;
- responsive horizontal behavior where unavoidable;
- strong row hover/focus;
- sticky headers where useful;
- accessible column headers;
- meaningful empty states;
- clear primary row action;
- filters aligned with workflow.

Do not put six buttons in every row.

Use row click/detail panel or one primary action plus overflow only if necessary.

---

# 89. Forms

Improve:

- labels;
- help text;
- inline validation;
- disabled/loading state;
- section grouping;
- destructive/privileged action separation.

Do not expose raw JSON textareas when structured controls are practical.

---

# 90. Dialogs and detail panels

Reuse `ConfirmActionDialog` for consequential mutations.

For detail side panels/drawers:

- title;
- status;
- sections;
- close control;
- keyboard focus;
- Escape support;
- responsive full-screen behavior on small devices.

Do not hand-build inaccessible fixed overlays.

If current implementation uses a manual fixed aside, refactor to an accessible project pattern if justified by reuse.

---

# 91. Loading states

Do not show an empty white page with spinner.

Use designed loading states/skeletons consistent with the destination.

Avoid skeletons that imply fake content where a simple loading block is clearer.

---

# 92. Empty states

Every major table/dashboard should explain:

- what is empty;
- whether that is normal;
- next action if one exists.

Examples:

```text
No patients currently require clinical review.
No technical access failures are open.
No draft content versions yet.
No check-in history is available for this period window.
```

---

# 93. Error states

No raw:

```text
Error 500
```

Use:

- concise description;
- retry where safe;
- restricted state where permission;
- version-conflict messaging;
- no sensitive leak.

---

# 94. Motion

Subtle motion is acceptable:

- small hover transitions;
- accordion/drawer transitions;
- navigation active changes.

Respect:

```text
prefers-reduced-motion
```

Avoid:

- animated statistics;
- bouncing cards;
- excessive page transitions;
- gamified celebration.

---

# 95. Iconography

Continue using Lucide.

Use icons consistently.

Do not mix multiple icon libraries.

Icons supplement text.

Do not create icon-only ambiguous primary actions.

---

# 96. Patient-wide UI refinement checklist

Audit each patient page.

---

## 96.1 Home

Keep the strong current-action hierarchy.

Improve final copy.

Remove implementation-facing statements such as:

```text
No external message is being sent.
Monitoring state is updated when you open this space...
```

Those are architecture facts, not ideal patient copy.

Keep reminders neutral and non-shaming.

---

## 96.2 Onboarding

Ensure:

- progress is obvious;
- autosave/resume state is understandable;
- question groups are visually calm;
- safety interruption is immediate and unambiguous;
- form controls are large/mobile-friendly.

Do not turn it into a long raw questionnaire.

---

## 96.3 Reduction setup

Ensure:

- baseline calendar is understandable;
- standard-drink guidance is readable;
- target proposal is clearly distinguished from clinical approval;
- safety pending/blocked state is visible;
- quantities use tabular numerals.

Do not use achievement/gamification language.

---

## 96.4 Check-in landing

Show:

- period dates;
- open/due status;
- saved draft;
- current next action.

Avoid exposing internal schedule IDs.

---

## 96.5 Check-in action

This is a core evaluator screen.

Ensure:

- one question/group focus;
- readable scale controls;
- clear anchors;
- progress through check-in;
- draft saved state;
- partial/complete choice clarity;
- reduction calendar only when required;
- consistency errors are understandable;
- safety precedence.

---

## 96.6 Check-in history

Ensure:

- current authoritative revision visually primary;
- corrected/historical status distinct;
- period ordering clear;
- correction/backfill actions explicit;
- raw provenance available but secondary.

No ambiguous “latest submission” wording that ignores period identity.

---

## 96.7 Progress

Must satisfy Commit-1 chart rules.

This should be one of the visual centerpiece screens.

Sophisticated but calm.

---

## 96.8 Support

Improve:

- resource hierarchy;
- reading width;
- safe Markdown typography;
- helpful/not-helpful actions;
- hide-type confirmation;
- restored-type control;
- content unavailable state;
- no internal resolver codes.

---

## 96.9 Profile

Organize into sections:

```text
Preferences
Monitoring
Timezone/context
Account/session action where appropriate
```

Opt-out remains consequential.

Do not clutter it with clinical status.

---

## 96.10 Patient safety experience

This remains the strongest-priority patient state.

Do not visually bury safety guidance inside ordinary cards.

Ensure configured actions are clear.

Never invent universal emergency numbers.

---

# 97. Clinician-wide UI refinement checklist

---

## 97.1 Overview

Final professional landing page.

No fake metrics.

Strong scan hierarchy.

---

## 97.2 Patients

Improve:

- search;
- patient identity;
- current context;
- row action;
- raw ID de-emphasis;
- humanized preferences/status.

---

## 97.3 Patient detail

This should become a major product centerpiece.

Use clear section navigation.

Provide provenance without raw-data overload.

---

## 97.4 Review Queue

Keep Level 3 distinct.

Improve:

- NEW vs ACTIVE vs CLEARANCE_PENDING hierarchy;
- task state;
- patient link;
- reason humanization;
- source freshness;
- empty state.

Do not infer severity from delivery state.

---

## 97.5 Engagement

Keep separate from clinical review.

Improve:

- overdue duration;
- reminder state;
- effective due;
- case lifecycle;
- task routing;
- acknowledgement/outreach action hierarchy.

Missingness never becomes relapse wording.

---

## 97.6 Safety

Keep S0–S3 namespace visually distinct from Level 0–4 clinician monitoring.

Use structured case lifecycle.

Safety owner actions remain explicit.

---

# 98. Admin-wide UI refinement checklist

---

## 98.1 Overview

Operational command center.

No fake production-health claims.

---

## 98.2 Users & Access

Improve visual structure without changing identity semantics.

Use:

- human-readable roles;
- account-state badges;
- MFA/identity assurance summary;
- assignment detail;
- accessible panel.

---

## 98.3 Content

Make this a visually strong governance workflow.

Lifecycle should be obvious at a glance.

Preview should feel like actual patient content.

---

## 98.4 Configuration / Routing

Keep canonical V1 policy view-only.

Keep regional routing lifecycle controlled.

Improve route table/forms/test evidence presentation.

Do not turn thresholds into casual editable settings.

---

## 98.5 Safety

Admin view remains operational/safety governance.

Do not conflate with clinician patient review.

---

## 98.6 Operations

Technical failures + system incidents.

Do not show fake job/provider sections.

---

## 98.7 Audit

Make deterministic provenance visually impressive without becoming unreadable.

Use a timeline/table hybrid if helpful.

---

# 99. Prototype showcase data

The final mentor demo should not depend on manually constructing dozens of records at the last moment.

Extend prototype-only data sufficiently to demonstrate the major surfaces.

---

# 100. Showcase data principles

All showcase data must be:

```text
synthetic
repeatable
prototype-only
valid
auditable
clearly not real-patient data
```

Never hard-code fake arrays in React.

Never seed in `real_patient`.

---

# 101. Longitudinal showcase patient

Create a small coherent multi-week synthetic patient history.

Recommended:

```text
6–8 historical scheduled periods
```

with a mixture such as:

```text
COMPLETE
COMPLETE
PARTIAL
MISSING
COMPLETE
corrected COMPLETE
COMPLETE
current
```

The values should be plausible direct survey measurements.

Do not manipulate them to tell a fake “successful recovery” story.

A neutral varied history is better.

---

# 102. Use existing domain services for showcase history

Do not manually insert derived monitoring records if existing accepted submission/recompute services can generate them.

Preferred strategy:

```text
create valid synthetic source state
→ use existing assessment draft/submission/backfill services
→ allow monitoring recomputation to create derived state
```

A fixed/injected Clock may be used inside prototype fixture preparation.

Do not use runtime browser automation to seed the database.

If full service-path generation requires a small reusable fixture helper:

keep it prototype-specific.

Do not pollute production domain code with fixture branches.

---

# 103. Showcase progress safety

Ensure the showcase patient has valid safety/onboarding context needed to submit historical assessments through accepted paths.

Do not bypass safety merely because it is a demo fixture.

If the fixture uses only historical backfill:

honor historical effect rules.

No retroactive patient support/task spam.

---

# 104. Showcase content governance

In addition to approved seeded resources, create a small number of governance examples:

```text
one DRAFT
one UNDER_REVIEW
one RETIRED or historical version where valid
```

These must not reduce the existing approved resource-volume gate.

Do not accidentally make patient support unavailable.

---

# 105. Showcase overview state

Existing Phase-6 engagement scenarios can continue to provide:

- overdue;
- at-risk;
- disengaged;
- technical pause.

Use them in Clinician/Admin overview.

Do not duplicate another large patient set.

---

# 106. Audit showcase

Do not seed fake clinical audit claims merely for visuals.

Audit Explorer becomes meaningful through:

- legitimate seed-governance actions where audited;
- patient workflow;
- content governance;
- technical failure;
- engagement;
- correction/backfill.

The final demo runbook should order actions so the Audit Explorer contains useful records by the time it is shown.

---

# 107. Final demo runbook

Create a concise final document:

```text
docs/AUD_V1_Local_Capstone_Demo_Runbook.md
```

This is not another specification.

It is an evaluator/demo checklist.

Include:

- startup commands;
- prototype credentials;
- relevant scenario accounts;
- recommended browser width;
- recommended walkthrough order;
- where to switch roles;
- which surfaces demonstrate which architectural property;
- known intentionally deferred production capabilities;
- recovery/reset instructions for the prototype database if already supported safely.

Do not include secret values beyond existing synthetic demo passwords.

---

# 108. Recommended final evaluator journey

The final demonstration should be much stronger than the stale old UX section.

Suggested flow:

```text
1. Sign in as Patient
       ↓
2. Patient Home
   show current action / support / calm hierarchy
       ↓
3. Weekly Check-in
   show saved draft and deterministic period
       ↓
4. Submit or inspect recorded assessment
       ↓
5. Progress
   show missing/partial-aware longitudinal charts
       ↓
6. Support
   show governed safe content and preferences
       ↓
7. Check-in history
   show immutable revision/correction provenance

8. Switch to Clinician
       ↓
9. Overview
   show actual workload across separate domains
       ↓
10. Patients
    open the showcase patient
       ↓
11. Patient detail
    show trajectories, freshness, consumption, cases, timeline
       ↓
12. Review Queue
    show durable Level-3 work
       ↓
13. Engagement
    show operational missed-check-in workflow
       ↓
14. Safety
    show separate S0–S3 safety namespace

15. Switch to Admin
       ↓
16. Overview
    show operational/governance status
       ↓
17. Content
    show Draft → Review → Approval/versioning
       ↓
18. Operations
    show technical failure / operational incident
       ↓
19. Audit
    trace deterministic actions and provenance
       ↓
20. Close with local-capstone boundary
    real-patient mode intentionally remains blocked
```

This demonstrates the product as a system, not just a questionnaire.

---

# 109. Documentation updates required in Commit 3

Phase 7 must update current documentation so the repository has ONE final truth.

---

## 109.1 Master Specification

Do not rewrite normative clinical rules.

Update only implementation-status notes to say:

```text
Phases 1–7 complete for the local-capstone implementation boundary.
```

List the final major surfaces.

Retain explicit production deferrals.

Retain:

```text
real_patient = not ready
```

---

## 109.2 Locked Implementation Architecture

Add/update:

```text
Final local-capstone implementation boundary
```

Clearly distinguish:

### Complete locally

- deterministic core;
- safety;
- weekly monitoring;
- content;
- clinical review;
- engagement;
- progress read models;
- governance;
- admin audit;
- polished web product;
- local prototype seed/demo.

### Production-deferred

the explicit list from Section 7.2.

Do not leave production target architecture confused with currently implemented runtime.

---

## 109.3 UX Lock

Update:

- current implementation note;
- current route list;
- evaluator/demo journey;
- remaining/deferred list.

Remove stale statements that Home/Engagement are not current.

After Phase 7 implementation, the intended product-surface map should match actual routes.

---

## 109.4 Phase 6 guide

Correct the known SHA typo.

Correct misleading current/final handoff wording only.

Do not rewrite the historical Phase-6 plan.

---

## 109.5 README

At Commit 3 implementation-sweep time state:

```text
Phase 7 implementation present; final project closeout validation pending.
```

Do NOT mark project fully closed until the autonomous closeout passes.

List final local routes.

List production deferrals clearly.

---

# 110. Final UI copy sweep

Search evaluator-facing code for:

```text
prototype
phase 1
phase 2
phase 3
phase 4
phase 5
phase 6
phase 7
backend
resolver
internal
debug
no external message
current implementation
```

Not every occurrence is wrong.

But evaluator-facing patient/clinician UI should not sound like engineering documentation.

Keep implementation terminology in:

- Admin technical detail;
- Audit Explorer;
- docs;
- dev foundation.

Remove it from ordinary patient copy where unnecessary.

---

# 111. Final enum-label sweep

Search for generic:

```ts
value.replaceAll('_', ' ')
```

and equivalent.

Replace with explicit user-facing label maps where domain nuance matters.

Examples:

```text
AT_RISK_OF_DISENGAGEMENT
→ "Check-in follow-up"

CLEARANCE_PENDING
→ "Follow-up pending"

SYSTEM_UNROUTED_QUEUE
→ "Needs routing"

CORRECTED_FALSE_POSITIVE
→ "Corrected — false positive"
```

Do not oversimplify labels used for clinician/admin domain precision.

---

# 112. Final accessibility target

WCAG 2.2 AA baseline.

At minimum:

- keyboard navigation;
- visible focus;
- no keyboard traps;
- dialog focus management;
- correct labels;
- proper heading order;
- meaningful table headers;
- color contrast;
- status not color-only;
- charts with accessible alternatives;
- `aria-live` only where appropriate;
- 200% zoom;
- narrow/mobile reflow;
- reduced motion.

---

# 113. Final responsive target

Manually inspect at least representative widths:

```text
~390 px mobile
~768 px tablet
~1440 px desktop
```

Patient must be excellent on mobile.

Clinician/Admin must remain usable on narrow widths but may prioritize desktop information density.

No accidental horizontal page scroll.

Tables may intentionally scroll within their own container when necessary.

---

# 114. Performance restraint

Do not degrade local demo experience with unnecessary heavy UI.

Avoid:

- loading giant audit datasets;
- client-side joining every patient record;
- rendering all historical rows at once;
- importing all chart code eagerly if simple route-level chunking already occurs.

Use bounded backend queries.

Do not over-optimize prematurely.

---

# 115. Commit 3 stale-work sweep

Before creating Commit 3, perform a focused repository search.

Resolve demo-relevant stale work.

Explicitly inspect:

```text
docs/
README.md
apps/web/
apps/backend/
packages/contracts/
```

for Phase-7/pending/current-status contradictions.

Do not modify historical prose that is clearly labeled as historical plan unless it creates current-state confusion.

---

# 116. Commit 3 acceptance criteria

1. All intended final routes exist.
2. Patient top-level nav is correct.
3. Clinician top-level nav is correct.
4. Admin top-level nav is correct.
5. Navigation active state is route-aware.
6. Account/sign-out is accessible.
7. Authentication pages look integrated.
8. Patient UI is calm/mobile-first.
9. Clinician UI feels like a professional dashboard.
10. Admin UI feels like a polished operational console.
11. No major screen feels like an unstyled CRUD page.
12. Raw IDs/enums are de-emphasized.
13. All key states are designed.
14. No fake metrics.
15. Charts remain truthful.
16. No patient debug/prototype copy.
17. Demo seed is useful and valid.
18. Final demo runbook exists.
19. Current docs accurately record production deferrals.
20. UX evaluator journey is no longer stale.
21. Phase-6 SHA typo is corrected.
22. No Phase-8 implication remains.
23. README says validation pending, not closed.

After Commit 3:

STOP.

Do not push.

Do not run the autonomous final closeout yet.

---

# 117. No tests/closeout validation during implementation sweep

Follow the established workflow.

During the three implementation commits:

do NOT create:

```text
validation/phase7_invariants.sql
```

yet.

Do NOT repeatedly run:

```text
pnpm test
full Playwright
full invariant suites
```

after every commit.

Use narrow compiler/type/editor feedback when needed.

The final autonomous closeout owns full testing and validation.

---

# 118. Do not push

Codex may:

- edit;
- migrate;
- add dependency;
- stage;
- create the three local implementation commits.

Codex must NOT:

```text
git push
open PR
create Phase 8
start production deployment
```

The user pushes.

---

# 119. Phase 7 implementation-sweep final response

After Commit 3 return only:

```text
Phase 7 implementation sweep complete.

Commit 1: <sha>
Commit 2: <sha>
Commit 3: <sha>

Important caveat: <only if a genuinely unresolved specification caveat exists>
```

If no caveat:

omit it.

---

# 120. Final autonomous closeout — scope

After the user pushes the three Phase-7 implementation commits, perform ONE final autonomous project closeout.

This closeout is broader than prior phase closeouts.

It must audit:

```text
the complete Phase-7 diff
+
all final product routes
+
all cross-phase carry-forward/stale seams
+
final documentation truth
+
final evaluator experience
```

Do not redo the entire domain implementation from scratch.

But if a concrete earlier-phase defect becomes visible through final integration:

fix it.

No known in-scope correctness defect is allowed to remain simply because its origin was Phase 2/3/4/5/6.

---

# 121. Final closeout severity

## P0

Must fix.

Examples:

- safety/privacy bypass;
- destructive data error;
- domain rule corruption;
- patient sees clinical/admin protected data;
- content approval bypass;
- immutable approved content editable;
- audit exposes sensitive source payload;
- clinician assignment leak;
- production-mode false readiness claim.

## P1

Must fix.

Examples:

- locked final surface missing;
- incorrect progress history;
- missing data interpolated;
- fake dashboard count;
- content lifecycle wrong;
- stale documentation contradicts implementation;
- route/nav broken;
- major responsive/accessibility defect;
- invalid content-version concurrency;
- resolver regression;
- old approved resource reactivates after retirement.

## P2

Fix if straightforward or important to final quality.

Examples:

- inconsistent spacing;
- unclear empty state;
- awkward label;
- small table responsiveness issue;
- secondary accessibility defect.

## P3

Cosmetic micro-polish only.

Do not burn time indefinitely.

---

# 122. Phase 7 backend tests

Add focused coverage for new functionality.

---

# 123. Patient Progress tests

At minimum:

1. scheduled missing period produces null/gap;
2. PARTIAL shows only answered items;
3. COMPLETE shows valid item values;
4. corrected authoritative revision replaces old value;
5. superseded revision not charted as current;
6. historical backfill appears at scheduled period;
7. period order based on schedule;
8. goal context version-correct;
9. REDUCTION complete quantity shown;
10. partial quantity does not claim complete total;
11. ABSTINENCE does not fabricate reduction target;
12. patient cannot access another patient's progress;
13. no clinical reason/risk score leaked.

---

# 124. Clinician Overview/detail tests

At minimum:

14. only assigned patients counted;
15. review count matches actual open clinical work;
16. engagement count matches actual state;
17. safety count is permission/assignment correct;
18. stale/current distribution is backend-derived;
19. unassigned patient detail returns protected not-found/restricted behavior;
20. timeline only includes allowed patient;
21. missing periods remain missing;
22. clinical/engagement/safety cases remain separate;
23. trajectory provenance correct.

---

# 125. Content governance tests

At minimum:

24. create logical resource creates DRAFT;
25. DRAFT edit works;
26. stale rowVersion rejected;
27. submit-review works;
28. UNDER_REVIEW content fields cannot edit;
29. unauthorized actor cannot approve;
30. approval requires correct state/version;
31. approve records reviewer/time/audit;
32. previous APPROVED retires when new approved;
33. at most one APPROVED per logical resource;
34. approved body cannot edit;
35. editing approved creates new DRAFT;
36. reject records reason/audit;
37. retired content no longer patient-eligible;
38. historical delivery still references retired version;
39. resource-volume counts logical resources;
40. Admin cannot force-deliver;
41. existing deterministic rotation still passes;
42. existing content safety/filter tests remain green.

---

# 126. Audit tests

At minimum:

43. `AUDIT_READ` required;
44. patient/clinician cannot access full explorer;
45. exact patient filter works;
46. entity filter works;
47. action filter works;
48. date filtering works;
49. pagination stable;
50. metadata projection does not expose prohibited raw response payload;
51. deterministic ordering.

---

# 127. Admin Overview/operations tests

At minimum:

52. overview counts real rows;
53. content coverage correct;
54. open incidents correct;
55. unrouted task count correct;
56. application mode truthful;
57. deferred production capability not reported healthy;
58. operations incident list permissioned.

---

# 128. Final web component tests

Add representative—not exhaustive—UI tests.

At minimum cover:

### Shells

- active route highlight;
- responsive nav control;
- account/sign-out affordance;
- permissions hide unauthorized admin destinations.

### Patient

- Progress missing/partial chart state;
- chart table fallback;
- Home patient-safe copy;
- Profile monitoring action;
- Support content rendering.

### Clinician

- Overview counts/sections;
- patient detail tabs/sections;
- Review/Engagement separation;
- timeline item rendering.

### Admin

- Overview;
- Content lifecycle actions;
- approval confirmation;
- Audit filters;
- Operations incident state.

---

# 129. Final E2E coverage

Extend the E2E suite to cover the final evaluator journey at a practical level.

Do not automate every click in the product.

Strong final coverage:

```text
Patient login
→ Home
→ Check-in
→ Progress
→ Support

Clinician login
→ Overview
→ patient detail
→ Review Queue / Engagement

Admin login
→ Overview
→ Content
→ Operations
→ Audit
```

Keep existing onboarding/safety/engagement critical paths.

---

# 130. Visual regression / screenshot coverage

Because final UI quality is critical, add a small curated Playwright screenshot baseline if deterministic in the repository environment.

Recommended screens:

```text
Patient Home — desktop
Patient Home — mobile
Patient Check-in
Patient Progress
Clinician Overview
Clinician Patient Detail
Clinician Review Queue
Admin Overview
Admin Content
Admin Audit
```

Do not screenshot every page.

Mask or stabilize timestamps/IDs if necessary.

Do not create brittle screenshots from constantly changing dynamic timestamps.

If the repository environment cannot provide stable screenshot baselines without hacks:

perform strong manual visual QA instead and document it.

Do not cheat visual tests.

---

# 131. Accessibility E2E

Run automated axe coverage on the final key routes.

No serious/critical accessibility violations.

Do not disable rules merely to get green.

Fix real problems.

---

# 132. Create `validation/phase7_invariants.sql`

Keep it focused.

---

# 133. Phase 7 content invariants

Verify:

- no more than one APPROVED version per resource;
- approved versions have reviewer/time;
- rejected versions have valid review provenance where stored/required;
- retired version has retiredAt;
- retired version is not enabled if final lifecycle requires disabled;
- DRAFT/UNDER_REVIEW never patient-delivery audited;
- no content delivery references non-approved-at-delivery impossible state where reconstructable;
- resource/version intervention class consistent;
- version number positive;
- rowVersion positive.

---

# 134. Phase 7 audit invariants

Verify:

- AuditEvent primary identity unique by DB;
- audit table/index exists;
- no invalid null core fields;
- content governance privileged actions produce matching audit patterns in fixture/integration data where appropriate.

Do not attempt to prove every application event through SQL.

---

# 135. Phase 7 cross-domain integrity

Verify important final read-model assumptions:

- current authoritative revision belongs to logical assessment;
- progress source revision belongs to same patient/period;
- content delivery references valid resource/version;
- clinician task case polymorphism remains valid;
- engagement case one-open constraint;
- clinical case one-open constraint;
- final new migration did not weaken Phase-5/6 guards.

Reuse existing invariants rather than duplicate every query.

---

# 136. Migration-stage validation strategy

Do not blindly run Phase-4 invariants against a final Phase-7 database if the Phase-4 invariant file intentionally asserts later-phase tables do not exist.

Preserve the established Phase-6 validation strategy.

Use isolated databases/migration stages appropriately.

Recommended:

### Historical boundary DB

Migrate through the relevant pre-Phase-6 boundary and run:

```text
Phase 4 invariants
Phase 5 invariants
```

according to their intended boundary.

### Final DB

Apply ALL migrations and run:

```text
Phase 5 invariants where compatible
Phase 6 invariants
Phase 7 invariants
```

The final closeout report must state which database/schema stage each invariant suite used.

Do not produce a misleading “all SQL ran on one final DB” claim if that is false by design.

---

# 137. Final validation sequence

After all autonomous corrections/tests:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

`pnpm test` already includes web/backend/E2E under the root scripts.

Run any targeted Playwright visual/accessibility suites as required.

Then run the SQL invariant strategy from Section 136.

Also verify:

- clean migration chain;
- prototype seed;
- prototype seed repeatability;
- final demo data;
- route accessibility;
- no console errors in evaluator journey.

---

# 138. Final autonomous failure loop

If validation fails:

```text
failure
→ diagnose
→ fix
→ narrow retest
→ rerun complete affected sequence
```

Do not ask:

```text
Should I fix this?
```

Fix it.

If a substantial correction is clearly required by locked docs:

implement the simplest logical solution and continue.

---

# 139. Final visual QA checklist

Perform manual or deterministic automated review of every evaluator-facing route.

At minimum inspect:

```text
390px
768px
1440px
```

Check:

- no clipped controls;
- no page-level horizontal scroll;
- nav usability;
- headings;
- text wrapping;
- modal/drawer fit;
- tables;
- chart labels;
- focus;
- contrast;
- empty/error states;
- long patient names;
- long content titles;
- status chips;
- date/time display.

---

# 140. Product-wide final consistency audit

Before closure, verify:

```text
same brand language
same typography system
same button hierarchy
same state-badge vocabulary
same dialog behavior
same date formatting
same account controls
same empty/error treatment
same accessibility expectations
```

Role density may differ.

Visual language should still feel related.

---

# 141. Final privacy audit

Check that:

### Patient

does not see:

- clinician internal reason codes;
- Level-3 internals;
- audit metadata;
- technical evidence;
- admin content lifecycle.

### Clinician

does not see:

- unassigned patients;
- full Admin Audit Explorer;
- admin-only identity operations;
- unrelated technical operational metadata.

### Admin

does not automatically receive:

- questionnaire content;
- clinician-only detailed patient reasoning;
- full patient clinical records merely by role.

Admin aggregate operational counts are okay where the UX lock expects them.

---

# 142. Final domain regression audit

Phase 7 must not alter:

- weekly monitoring thresholds;
- recurrence;
- persistence;
- clearance;
- safety gate;
- engagement 7/14/30;
- technical failure formula;
- content selection;
- clinical reason whitelist;
- case separation;
- historical/backfill semantics.

If new read models accidentally reproduce domain calculations:

remove duplicated logic.

Read persisted authoritative output.

---

# 143. Final stale-code audit

Search for:

```text
TODO
FIXME
console.log
debugger
temporary
placeholder
fake
mock
hardcoded demo
not implemented
```

Resolve or explicitly classify.

No evaluator-facing mock data.

---

# 144. Final documentation audit

Search all current docs for:

```text
Phase 7 pending
later implementation path
not current routes
validation pending
Phase 6 implementation present
future capstone phase
```

Correct only current-status statements.

Historical implementation packet sections may remain when clearly historical.

There must be no ambiguity about:

```text
what is complete
what is local-demo-only
what is production-deferred
```

---

# 145. Final README state after successful closeout

README should say clearly:

```text
Phases 1–7 are CLOSED for the local capstone implementation boundary.
```

It should summarize:

- deterministic platform;
- final product surfaces;
- test/validation status;
- demo commands;
- demo runbook;
- production deferrals;
- `real_patient` still intentionally blocked.

Do not call it production-ready.

---

# 146. Final Master status

Master implementation-status note should state:

```text
local-capstone implementation complete
```

while preserving canonical target semantics and future production requirements.

No normative clinical rule is removed because the local demo defers infrastructure.

---

# 147. Final Architecture status

Architecture document should clearly distinguish:

```text
target real-patient architecture
```

from:

```text
implemented local-capstone runtime
```

No reader should mistakenly believe pg-boss/external delivery exists.

---

# 148. Final UX Lock status

UX lock should say the consolidated patient/clinician/admin surface map is implemented for the local capstone, subject only to explicitly named production-deferred capabilities.

Replace the stale evaluator journey with the final one.

---

# 149. Phase 7 closeout record

After green validation update this Phase-7 guide to:

```text
Status: CLOSED
```

Record:

- implementation commits;
- correction/test commit;
- final validated SHA;
- final closing SHA;
- web test count;
- backend test count;
- Playwright count;
- visual/accessibility result;
- migration result;
- seed repeatability;
- Phase 4/5/6/7 invariant strategy/results;
- final local-demo deferrals;
- final project status.

---

# 150. Closeout commit naming

If corrections are required:

```text
fix: close phase 7 and final product
```

If truly only tests/coverage are added:

```text
test: close phase 7 and final product
```

Then final documentation closure:

```text
closing: Phase-7 and local capstone
```

Do not push.

---

# 151. Final project definition of done

The project is locally complete only when all of the following are true.

---

## Domain

```text
[ ] Phases 1–6 accepted behavior remains valid
[ ] no new unsupported clinical rule
[ ] missingness remains missingness
[ ] safety remains highest precedence
[ ] clinical/engagement/safety cases remain separate
[ ] content remains deterministic/governed
```

---

## Patient

```text
[ ] Home polished
[ ] Check-in polished
[ ] Progress implemented
[ ] Support polished
[ ] Profile polished
[ ] onboarding polished
[ ] reduction setup polished
[ ] history/correction polished
[ ] safety-controlled experience polished
[ ] mobile navigation excellent
```

---

## Clinician

```text
[ ] Overview implemented
[ ] Patients polished
[ ] patient detail cohesive
[ ] trajectories truthful
[ ] consumption context truthful
[ ] Review Queue polished
[ ] Engagement polished
[ ] Safety polished
[ ] timeline implemented
```

---

## Admin

```text
[ ] Overview implemented
[ ] Users & Access polished
[ ] Content governance implemented
[ ] content version lifecycle correct
[ ] Configuration polished
[ ] Operations includes incidents/technical failures
[ ] Audit Explorer implemented
[ ] safety admin polished
```

---

## UI/UX

```text
[ ] role-specific premium visual identity
[ ] one coherent product language
[ ] route-aware navigation
[ ] account/sign-out affordance
[ ] no implementation-stage page left
[ ] no fake metrics
[ ] no patient debug copy
[ ] responsive
[ ] accessible
[ ] charts accessible
[ ] empty/loading/error/restricted designed
[ ] consequential actions confirmed
```

---

## Demo

```text
[ ] prototype seed repeatable
[ ] longitudinal showcase available
[ ] governance showcase available
[ ] engagement scenarios available
[ ] demo runbook complete
[ ] evaluator journey coherent
```

---

## Documentation

```text
[ ] Phase-7 guide CLOSED
[ ] README final
[ ] Master status final
[ ] Architecture boundary final
[ ] UX current route/evaluator journey final
[ ] Phase-6 SHA typo fixed
[ ] no stale current-status contradictions
[ ] production deferrals explicit
[ ] no Phase 8 implied
```

---

## Validation

```text
[ ] format passes
[ ] lint passes
[ ] typecheck passes
[ ] web tests pass
[ ] backend tests pass
[ ] E2E passes
[ ] build passes
[ ] accessibility passes
[ ] visual QA passes
[ ] migrations pass
[ ] seed repeatability passes
[ ] Phase-4 historical boundary invariants pass
[ ] Phase-5 invariants pass
[ ] Phase-6 invariants pass
[ ] Phase-7 invariants pass
[ ] git diff --check passes
[ ] working tree clean
```

---

# 152. Final production-deferred ledger

At project closure the following remain **intentionally outside the local capstone**:

```text
unattended worker scheduler
pg-boss runtime
email/push/SMS engagement delivery
clinician auxiliary notifications
provider callbacks
retry workers
notification batching
automatic platform outage detector
production service-fallback routing
care-team routing expansion
backup automation
restore automation
retention/deletion execution
RPO/RTO enforcement
high availability
production scaling
production secret infrastructure
vendor/compliance activation
real-patient activation
```

Do not describe these as bugs.

Do not hide them.

Do not implement them accidentally.

---

# 153. Final UX quality bar

A mentor opening the application should immediately perceive:

### Patient

> “This feels calm, intentional, trustworthy, and genuinely usable.”

### Clinician

> “This looks like a serious care-team monitoring product with controlled operational detail.”

### Admin

> “This is a real governance/operations console, not a developer page.”

### System

> “The application has thought through state, provenance, safety, roles, history, and operational failure.”

That is the target.

---

# 154. Things that must NEVER be added just to impress mentors

Do not add:

```text
AI-generated risk prediction
LLM recommendations
fake real-time physiological dashboard
gamification
streak rewards
leaderboards
social feed
chat room
video call
appointments
billing
EHR integration
random KPI charts
recovery percentage
sobriety score
risk donut
animated gauges
fake system health
```

The product should impress through discipline.

---

# 155. Final architecture principle

The final project should preserve the original engineering principle:

```text
Complex domain logic
+
simple infrastructure
+
excellent product experience
```

Not:

```text
Complex domain logic
+
complex infrastructure
+
complex interface
```

---

# 156. Final implementation packet summary

Codex Phase-7 implementation flow:

```text
CURRENT HEAD
dc2aa3a36c9936feadf7ed99461c1b27157f1222
        ↓

READ ALL GOVERNING DOCS
        ↓

COMMIT 1
feat: add longitudinal progress and clinician overview
        ↓
Patient Progress
Recharts wrapper
Clinician Overview
Cohesive Patient Detail
Trajectories
Timeline

        ↓

COMMIT 2
feat: add admin content governance and audit tooling
        ↓
Content governance migration
Content Admin
Admin Overview
Operational incidents
Audit Explorer

        ↓

COMMIT 3
feat: deliver final product experience and capstone cohesion
        ↓
Whole-product UI/UX pass
Final shells/navigation
Auth polish
Every role surface polish
Showcase data
Demo runbook
Stale-work sweep
Deferral documentation

        ↓
STOP
NO PUSH
NO FULL CLOSEOUT YET
```

Then after user push:

```text
AUTONOMOUS FINAL CLOSEOUT
        ↓
Full Phase-7 audit
Cross-phase integration audit
Corrections
Tests
Phase-7 invariants
Full validation
Visual/accessibility audit
Documentation truth sweep
        ↓
fix/test closeout commit
        ↓
closing: Phase-7 and local capstone
        ↓
STOP
NO PUSH
```

---

# 157. Codex final operating instruction

When executing this guide:

- do not wander;
- do not ask the user to redesign already-locked behavior;
- do not overengineer;
- implement the sufficient solution;
- preserve Phase 1–6 accepted semantics;
- take UI/UX extremely seriously;
- use the current codebase rather than replacing it;
- make role-specific interfaces visually excellent;
- finish all three implementation commits in one sweep;
- leave tests/validation to the autonomous closeout;
- do not push.

---

# 158. Final Phase-7 implementation response format

After the three implementation commits, Codex should return:

```text
Phase 7 implementation sweep complete.

Commit 1: <sha>
Commit 2: <sha>
Commit 3: <sha>

Important caveat: <only if a genuinely unresolved specification caveat exists>
```

No long narrative.

No validation commands.

No Phase 8.

No push.

---

# 159. Final project closure response format

After the later autonomous closeout, Codex should return:

```text
Phase 7 and local-capstone project closeout complete.

Implementation commits:
- <commit 1>
- <commit 2>
- <commit 3>

Final corrections:
- <important corrections>

Coverage:
- web: <count>
- backend: <count>
- Playwright: <count>
- visual/accessibility: PASS

Validation:
- format:check — PASS
- lint — PASS
- typecheck — PASS
- tests — PASS
- build — PASS
- diff check — PASS
- migration chain — PASS
- seed repeatability — PASS
- Phase 4 boundary invariants — PASS
- Phase 5 invariants — PASS
- Phase 6 invariants — PASS
- Phase 7 invariants — PASS

Closeout commit:
<sha>

Final closing commit:
<sha>

Phase 7 status: CLOSED
Local capstone project status: CLOSED

Production-deferred capabilities remain explicitly documented.

Important caveat:
<only if a genuine unresolved caveat remains>
```

If there is no caveat:

omit it.

---

# 160. End state

After Phase 7 closure, the project is:

```text
A locally demonstrable,
deterministic,
auditable,
safety-aware,
role-based,
governed AUD subjective monitoring platform
with premium patient, clinician, and administrative interfaces.
```

It is **not** represented as:

```text
a deployed real-patient clinical system.
```

That distinction must remain explicit.

This is the final implementation boundary.
