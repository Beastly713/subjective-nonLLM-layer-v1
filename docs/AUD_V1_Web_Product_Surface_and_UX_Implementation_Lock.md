# AUD Subjective Monitoring V1 — Web Product Surface and UX Implementation-Lock Architecture

## Document status

**Purpose:** Implementation-lock product-surface, workflow, and UX architecture for the V1 web application.

**Important:** This document is **not** a new clinical or behavioral specification and does not change the V1 Master Specification. It locks the intended web-product surface and state-driven interaction behavior only where needed to implement the existing V1 safely and consistently. Clinical rules, thresholds, state semantics, routing severity, and historical interpretation remain subordinate to the V1 Master Specification.

The authoritative V1 behavior remains defined by:

- `AUD_Subjective_Monitoring_Master_Specification_V1.md`
- instrument: `AUD_WEEKLY_CHECKIN` version `1.0`
- system version: `subjective_monitoring_v1`

**Current implementation note:** Phases 1–5 are complete, with the validated Phase 5 implementation head at `f6bc02b`. The implemented web surface currently includes authentication, patient onboarding, reduction setup, profile/status, safety-controlled states, weekly Check-in, Check-in history, correction/backfill actions, patient Support and post-check-in support, clinician patients and safety views, clinician subjective-monitoring visibility and Review Queue/detail views, admin users/regional-routing/safety views, and the development foundation reference. Patient Home/Progress, engagement, content management, auxiliary delivery, and broader operations remain locked product design for later implementation; they are not current routes.

---

# 1. Product direction

The V1 solution should be implemented as **one serious product platform** with three role-specific interfaces:

1. **Patient**
2. **Clinician**
3. **Admin**

The product should feel cohesive, professional, sophisticated, and production-quality in presentation. It must not look or behave like a toy, student prototype, generic questionnaire dashboard, or loosely connected collection of screens.

This statement concerns **product quality and implementation discipline**. It does **not** imply that real-patient operation is automatically authorized. Real-patient activation remains controlled by the V1 Master Specification's deployment and safety prerequisites.

The visible sophistication should come from:

- excellent UI/UX;
- disciplined information architecture;
- clear role-specific workflows;
- high-quality state visualization;
- consistent interaction patterns;
- strong provenance/freshness presentation where relevant;
- robust loading, empty, error, stale, restricted, and safety-controlled states;
- strong visual presentation of the underlying deterministic backend behavior.

The architecture should remain comparatively simple wherever possible.

The goal is:

> **Complex domain logic, simple infrastructure, excellent product experience.**

Engineering complexity is justified only when it provides a clear functional, safety, maintainability, deployment, or development-speed advantage.

# 2. High-level product model

```text
                         [ PRODUCT BRAND ]

                               Login
                                 │
                     role / permission resolution
                                 │
             ┌───────────────────┼───────────────────┐
             ▼                   ▼                   ▼
        PATIENT CARE        CLINICAL CARE       ADMINISTRATION
         workspace            workspace            workspace
```

The three workspaces should belong to the same platform and share:

- identity and branding;
- authentication;
- role-based authorization;
- typography;
- spacing;
- iconography;
- component primitives;
- interaction standards;
- API contracts;
- design tokens.

However, each workspace should have its own visual and workflow character.

Conceptually:

```text
/patient/...
/clinician/...
/admin/...
```

The authenticated role determines the appropriate workspace.

---

# 3. Shared backend philosophy

The backend should be treated as the **authoritative product core**.

Web and future mobile clients should remain comparatively thin.

Conceptually:

```text
                         AUD SUPPORT PLATFORM
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
          PATIENT WEB       CLINICIAN WEB      ADMIN WEB
              │                 │                 │
              └─────────────────┼─────────────────┘
                                │
                         Shared API contract
                                │
                                ▼
                ┌────────────────────────────┐
                │                            │
                │     CENTRAL BACKEND        │
                │                            │
                │  domain rules             │
                │  scheduling               │
                │  authoritative state      │
                │  history                  │
                │  cases                    │
                │  audit                    │
                │  delivery orchestration   │
                │                            │
                └──────────────┬─────────────┘
                               │
                               ▼
                          Primary DB

Eventually:

                  Mobile Patient Application
                           │
                           │ same APIs
                           ▼
                      CENTRAL BACKEND
```

Important clinical/domain logic should **not** be duplicated in:

- React components;
- browser-side utilities;
- mobile code;
- per-interface backend implementations.

The clients should primarily:

- collect user input;
- render authoritative backend state;
- execute user actions through APIs;
- present workflow-specific views.

---

# 4. Suggested backend shape

A **modular monolith** is a strong conceptual fit.

Possible internal modules include:

```text
backend/
├── auth/
├── users/
├── profiles/
├── scheduling/
├── assessments/
├── safety/
├── subjective-monitoring/
├── alcohol-consumption/
├── longitudinal/
├── content/
├── clinical-cases/
├── engagement/
├── notifications/
├── administration/
└── audit/
```

This should still behave operationally like one system:

```text
ONE backend application
ONE domain model
ONE primary database
ONE API surface
ONE deployment architecture
```

The objective is to preserve clean internal boundaries without introducing unnecessary distributed-systems complexity.

If time-driven/background work later requires a separate process, it can still share the same backend codebase:

```text
               same backend codebase
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
         API process         Worker process
             │                   │
      HTTP requests        scheduled/background
                           processing
```

This does **not** imply microservices.

---

# 5. Web frontend shape

A single web frontend codebase is likely the most efficient shape to explore.

Conceptually:

```text
web/
│
├── patient/
├── clinician/
├── admin/
│
├── components/
├── design-system/
├── api/
└── shared/
```

Role-specific shells may remain distinct:

```text
PatientShell
ClinicianShell
AdminShell
```

Shared elements may include:

- buttons;
- form controls;
- dialogs;
- navigation primitives;
- typography;
- icons;
- tables;
- chart primitives;
- status indicators;
- error states;
- loading states;
- API client;
- authentication handling;
- design tokens.

The three workspaces should **not** look like the same generic dashboard with different menu items.

---

# 6. Visual direction by role

| Workspace | Intended visual character |
|---|---|
| **Patient** | Calm, spacious, premium digital-health experience, gentle motion, low cognitive load |
| **Clinician** | Sophisticated professional healthcare dashboard, controlled information density, strong state hierarchy |
| **Admin** | Polished operational console, dense but clean, excellent grids/forms/audit views |

The same design language should tie them together, while density and presentation differ by role.

---

# 7. Patient workspace

## 7.1 Intended navigation

```text
Home
Check-in
Progress
Support
Profile
```

The patient workspace should feel closer to a premium consumer health application than enterprise management software.

Navigation availability is **state-aware**. A safety gate may restrict or replace ordinary navigation as defined in Section 9.

---

## 7.2 Patient Home

The home screen should act as the patient's current-action center.

Conceptually:

```text
┌────────────────────────────────────────────────────────┐
│                                                        │
│  Good evening                                          │
│  Here's where you are this week.                       │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ WEEKLY CHECK-IN                                  │  │
│  │                                                  │  │
│  │ Ready to complete                                │  │
│  │ Aug 10 – Aug 16                                  │  │
│  │                                                  │  │
│  │                       [ Start check-in → ]       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Recovery goal                Recent progress          │
│  ┌───────────────────┐        ┌─────────────────────┐  │
│  │ ...               │        │ ...                 │  │
│  └───────────────────┘        └─────────────────────┘  │
│                                                        │
│  Support for you                                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Selected support/resource                        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

The dominant home-screen action changes from authoritative backend state, for example:

```text
assessment not open     → upcoming check-in
assessment open         → Start check-in
draft exists            → Continue check-in
submitted partial       → Submitted / correction available where allowed
completed               → Up to date
support generated       → eligible support available
safety handoff active   → safety-controlled experience
```

The frontend renders these states rather than deriving them itself.

### Home-screen precedence

Before ordinary progress, reinforcement, recommendations, or convenience actions are shown, the client must resolve the backend-provided state in this order:

```text
safety-controlled experience
        ↓
current required/available patient action
        ↓
eligible patient support
        ↓
ordinary progress/history/reinforcement
```

This is a presentation priority, not a new clinical severity model.

If the safety pathway blocks ordinary monitoring, the normal home surface is replaced by the safety experience rather than showing ordinary cards underneath it.

# 8. Patient onboarding

Onboarding should be a guided flow rather than one large medical form.

The executable sequence should be:

```text
Account and basic profile
        ↓
AUDIT-C and baseline drinking context
        ↓
Draft recovery direction
        ↓
Preferences and relevant context
        ↓
If REDUCTION:
28-day baseline + proposed target
        ↓
Safety assessment using the proposed change
        ↓
Safety resolver
        ↓
┌──────────────────────────────────────────────┐
│ activate monitoring/goal                    │
│ activate/continue with restrictions/handoff │
│ or transfer to safety pathway               │
└──────────────────────────────────────────────┘
        ↓
Onboarding completion
```

The recovery direction selected before safety resolution is a **draft choice**, not an active goal.

For `REDUCTION`, the proposed goal cannot reach activation without the complete baseline and valid proposed target required by the V1. For an abstinence or qualifying major-reduction plan, the safety resolver evaluates the proposed change before activation.

The UI should make status clear without exposing internal implementation codes. Possible patient-facing states include:

- setup in progress;
- safety review required;
- goal pending review;
- monitoring available with restrictions;
- safety handoff in progress;
- setup complete.

A screen should focus on one coherent topic at a time.

Example visual treatment:

```text
             Step 3 of 7

        Your recovery direction

 What would you like to work toward?

 ┌────────────────────────────────┐
 │ ○ Not drinking alcohol         │
 │   Work toward abstinence       │
 └────────────────────────────────┘

 ┌────────────────────────────────┐
 │ ○ Drinking less                │
 │   Set a reduction goal         │
 └────────────────────────────────┘

 ┌────────────────────────────────┐
 │ ○ I'm not sure yet             │
 │   That's okay                  │
 └────────────────────────────────┘

                  [ Continue ]
```

Recommended UX characteristics:

- large controls;
- clear typography;
- visible progress;
- concise explanations;
- minimal clutter;
- low form fatigue;
- persistent server-backed draft progress where appropriate;
- no unnecessary medical-form aesthetic.

# 9. Patient safety experience

Safety is a dedicated state-driven experience, not an ordinary questionnaire, generic banner, or error state.

The internal safety codes remain hidden from patients, but their consequences are explicit in the UI contract.

## 9.1 `ALLOW_MONITORING`

Normal patient workspace is available.

The patient may use ordinary monitoring, goal, progress, and eligible support experiences subject to the normal V1 rules.

## 9.2 `ALLOW_WITH_HANDOFF`

The ordinary patient shell may remain available **only to the extent permitted by the backend-provided restrictions**.

The UI must obey:

- `allowed_subjective_interventions[]`;
- `monitoring_prompt_policy`;
- `goal_change_allowed`;
- `reassessment_due_at`.

Behavior:

- data collection and permitted monitoring may continue;
- ordinary patient interventions are hidden/suppressed unless explicitly allowed;
- if monitoring prompts are paused, the check-in entry point must not be presented as actionable;
- if goal change is not allowed, goal-change controls are disabled and explained in patient-safe wording;
- support browsing still passes through safety compatibility and all normal content-eligibility filters;
- a visible handoff/review status may be shown without exposing internal severity codes.

## 9.3 `BLOCK_AND_HANDOFF`

The normal patient workspace is replaced by a focused safety shell.

Ordinary:

- weekly check-in prompts;
- progress reinforcement;
- recovery recommendations;
- goal-change actions;
- personalized support browsing

are not presented as active patient actions.

The safety shell contains only what is needed for the active handoff, such as:

- clear patient-safe status/instructions resolved from the configured safety pathway;
- the configured primary route/action;
- a configured fallback route/action where the deployment provides one;
- handoff progress or acknowledgement state;
- essential account/session controls that do not bypass the safety flow.

No universal emergency telephone number is hard-coded by this product document. Route details resolve from the deployment's configured regional routing profile.

## 9.4 Safety severity presentation

The patient is not shown `S0`, `S1`, `S2`, or `S3` as unexplained technical labels.

The interface instead renders the backend-authorized patient-facing action for the resolved state.

For clinician/admin surfaces, severity codes may be shown because they are operational domain concepts.

## 9.5 Handoff progress

The patient safety experience should be able to represent the existing lifecycle without inventing additional clinical states:

```text
Detected
→ Handoff initiated
→ Acknowledged
→ Clinical review in progress
→ Plan established
→ Resolved
```

and the emergency external-handoff path where applicable.

## 9.6 Safety delivery failure

A safety-delivery failure is **not** displayed as a normal notification failure or a reason to return to ordinary monitoring.

The patient remains in the safety-controlled experience while the backend executes the configured failure/escalation behavior.

The clinician/admin operational surface should show the resulting incident and routing state.

## 9.7 Returning to ordinary monitoring

The patient returns to the ordinary workspace only after an authorized safety-owner disposition relaxes the gate or restrictions.

The UI must not provide a self-service button that locally clears an S0/S1/S2 safety state.

# 10. Weekly Check-In experience

The weekly check-in should be one of the strongest patient-facing experiences in the product.

The existing conceptual groups can be reflected in the flow:

```text
Alcohol use
     ↓
Challenges
     ↓
Recovery/support
     ↓
Review
     ↓
Submit
```

For 0–7 items, a visually strong accessible control should be used:

```text
How strong were your urges or cravings
to drink alcohol?

No urge                                      Extremely strong

 0     1     2     3     4     5     6     7
 ○     ○     ○     ○     ○     ○     ●     ○

                                            [ Continue ]
```

The completed recall period remains clearly visible:

```text
Weekly Recovery Check-In
10 Aug – 16 Aug
```

## 10.1 Draft lifecycle

There is one logical assessment for the scheduled period.

During entry:

- answers are saved to the central backend as a `DRAFT`;
- leaving the flow does not create a second assessment;
- `Save and exit` returns the patient to the workspace after confirming the current draft is stored;
- `Continue check-in` resumes the same draft;
- draft state survives browser refresh, sign-out/sign-in, and future mobile access through the same backend.

The frontend should not keep the only authoritative draft in browser-local state.

## 10.2 Final complete submission

When all eleven required items are answered, the review screen allows final submission.

While the request is in flight:

- the submit control is disabled;
- a stable submission/idempotency identity is used;
- retry must not create a duplicate logical submission.

Success is based on assessment persistence/evaluation, not on whether later content delivery succeeds.

## 10.3 Missing-item review and partial submission

If required items are missing, the review screen explicitly lists unanswered items.

The patient may:

1. return and complete them; or
2. explicitly submit the available answers as a `PARTIAL` assessment.

Partial submission requires a confirmation that:

- unanswered items remain unknown;
- the submitted assessment is still a real submitted record rather than a draft;
- available answered items may still affect the V1 state according to the master specification.

The product must visually distinguish:

```text
DRAFT
PARTIAL — submitted
COMPLETE — submitted
```

## 10.4 Late submission

When the assessment is submitted after its due time but no newer authoritative assessment exists:

- the period being answered remains explicit;
- the UI labels it as a late check-in;
- the backend treats it as the authoritative submission for that period according to V1 semantics.

The UI must not silently relabel the recall window around the submission date.

## 10.5 Historical backfill

If the patient is submitting an older period after a newer authoritative period already exists:

- the UI clearly identifies the historical period;
- the patient is informed that the entry updates their record/history;
- the UI must not promise old-period support or a retroactive notification;
- the backend processes backfill according to the existing V1 rules.

Historical backfill is visually distinct from the current open check-in.

## 10.6 Corrections and immutable revisions

A submitted authoritative assessment is never edited in place.

Selecting `Correct this check-in` opens a correction flow based on the current authoritative revision.

Before submitting the correction, the UI confirms:

- this creates a new revision;
- the previous revision remains in history;
- current derived state may change after recomputation.

After correction, the history screen can show revision metadata and which revision is authoritative.

Staff/clinician corrections are exposed only to authorized roles and do not use the patient correction flow.

## 10.7 Submission succeeds but support delivery fails

Assessment success and content delivery success are separate.

If the assessment is stored/evaluated but no content can be delivered:

- the check-in remains submitted;
- the UI does not ask the patient to resubmit;
- the result can show an appropriate neutral completion state such as support currently unavailable;
- the delivery failure remains an operational concern rather than changing the assessment status.

# 11. Reduction-goal workflow

`REDUCTION` requires its own coherent product flow rather than only a seven-day calendar.

## 11.1 Standard-drink education

Before baseline/target entry, the product provides concise standard-drink examples.

A beverage calculator may be provided as the V1 allows, with calculation and provenance owned by the shared backend/domain implementation.

This is an assistive calculator, not a second source of clinical policy.

## 11.2 Required 28-day baseline

Before a reduction goal can activate, the patient completes the preceding 28 consecutive local-calendar days.

The UI should use a dedicated calendar/grid flow.

Each day can be represented as:

```text
0 drinks
known quantity
unknown
```

The interface must visibly distinguish `UNKNOWN` from zero.

A baseline containing any unknown day remains incomplete and cannot activate the reduction goal.

The patient may save and return to the baseline-entry flow without losing progress.

## 11.3 Proposed target

Once the baseline is complete, the patient creates the proposed weekly target.

The backend validates the target against the authoritative baseline.

The UI must not locally infer that a target is valid or active.

`0` is not presented as a valid reduction target; it routes into the abstinence-goal flow defined by V1.

## 11.4 Safety-review states

A proposed reduction target can be represented in product UX as:

```text
Draft
Pending safety review
Active
Suspended during safety handoff
Superseded / ended
```

Patient wording should be plain-language rather than exposing enum identifiers.

If the target is pending clinical safety review, the product may continue permitted measurement but must not tell the patient that the reduction target is active until the backend-authorized state permits it.

## 11.5 Weekly consumption calendar

For an active reduction workflow, the weekly check-in includes the seven-day alcohol calendar.

Conceptual treatment:

```text
Your week

MON     TUE     WED     THU     FRI     SAT     SUN
 0       2       0       1       0       3       0
drinks  drinks          drink           drinks

Weekly total
6 standard drinks

Goal
≤ 8 standard drinks
```

Each day can remain explicitly unknown when applicable.

## 11.6 U1/calendar consistency correction

Before final submission, contradiction between U1 and the seven-day calendar blocks submission.

The UI shows the conflicting entries together and asks the patient to correct one of them.

The product never silently picks one source over the other.

## 11.7 Partial-week behavior

When the weekly calendar is incomplete:

- observed coverage is shown;
- unknown days remain visually unknown;
- no complete-week metric is visually implied;
- if the known total has already exceeded the target, the backend-provided not-met state may be shown;
- otherwise target status remains unresolved until a complete week exists.

## 11.8 Goal and target changes

Goal changes use a dedicated confirmation workflow.

`REDUCTION → ABSTINENCE` and `ABSTINENCE → REDUCTION` are treated as versioned goal transitions rather than editing historical records.

A new reduction target creates a new version; it does not rewrite the target that applied to earlier periods.

## 11.9 Progress visualization

Missing periods or unknown daily coverage are shown as gaps.

Charts must not interpolate, smooth through, or visually imply values for missing observations.

Coverage/completeness is visible where it materially affects interpretation.

WHO risk-drinking-level and heavy-day metrics are not required as patient-facing V1 widgets. If surfaced in the clinician workspace, they remain contextual metrics and must show their data-coverage requirements.

# 12. Patient post-submission/support experience

Patients should not be shown raw internal flags, scores, reason-family codes, or clinician tiers.

Avoid patient-facing output such as:

```text
HIGH_CRAVING
LOW_CONFIDENCE
risk_score = 26
LEVEL_2
```

Instead, present the approved patient-facing support resolved by the backend.

Conceptual example:

```text
Check-in complete
────────────────────────────

Thanks for checking in.

Based on what you reported, we've selected
something that may be useful this week.

┌───────────────────────────────────────┐
│ Working through strong cravings      │
│                                      │
│ 4 min                                │
│                                      │
│ [ View support ]                     │
└───────────────────────────────────────┘

Need something else?
[ Show more support ]
```

The backend determines:

- whether patient support is currently permitted by the safety gate;
- which intervention classes are active;
- priority/deduplication;
- content eligibility;
- refusal/cooldown behavior;
- the selected approved resource version.

The frontend presents the resolved resource.

If delivery or content selection fails after assessment success, the assessment remains complete/partial as submitted and the UI shows a neutral no-support-available state rather than encouraging resubmission.

# 13. Patient Progress

The progress page should visualize longitudinal information without inventing a single synthetic recovery score.

Possible structure:

```text
Progress
────────────────────────────────────

Last 8 weeks

Craving
7 ┤
6 ┤        ●
5 ┤      ●   ●
4 ┤   ●
3 ┤ ●             ●
2 ┤
1 ┤
0 ┤
  └────────────────────────

Confidence
...

Alcohol use / reduction
...

Check-in history
────────────────────────────────────
Aug 10–16       Completed
Aug 03–09       Partial
Jul 27–Aug 02   Missing
```

Useful visual candidates include:

- item trajectories;
- weekly alcohol quantities;
- valid goal progress;
- check-in completion history.

Required presentation rules:

- missing observations render as gaps, not zeros;
- partial periods are visibly marked;
- charts do not interpolate through unknown periods;
- corrected periods show the current authoritative value while revision history remains accessible;
- target/goal context is tied to the version effective for the displayed period;
- a stale/missing period is never described as stability or improvement.

Avoid visually impressive but clinically meaningless synthetic metrics.

# 14. Patient Support

Possible structure:

```text
Support

Recommended for you
─────────────────────────
[ Resource ]
[ Resource ]

Explore
─────────────────────────
Managing cravings
Handling difficult situations
Building confidence
Managing difficult emotions
Social support
...
```

A useful conceptual distinction is:

```text
system-selected personalized support
              ≠
patient manually browsing support
```

Both may exist, but **manual browsing is not an eligibility bypass**.

Every resource surfaced through browse/search still respects:

- approval/enabled state;
- locale/language;
- active recovery goal compatibility;
- mutual-help/spiritual preferences;
- safety-gate compatibility;
- contraindications;
- explicit refusal state;
- delivery-channel compatibility where relevant.

Cooldown may be overridden only where the V1 explicitly permits reuse on a user request, and that override remains auditable.

During `BLOCK_AND_HANDOFF`, ordinary support browsing is not offered. During `ALLOW_WITH_HANDOFF`, only safety-compatible/permitted support is surfaced.

# 15. Patient Profile

Possible structure:

```text
Profile
├── Personal information
├── Recovery goal
├── Preferences
├── Monitoring & timezone
├── Notifications / channels
├── Privacy / permissions
└── Account
```

`Monitoring & timezone` must not imply that the patient can arbitrarily change the V1 fixed weekly schedule.

Patient-editable controls are limited to product settings and versioned/profile changes the backend explicitly permits, such as the monitoring timezone where supported, notification/channel preferences, consent/permission settings, and recovery preferences.

Changes with V1 domain consequences start a backend workflow rather than behaving as direct local edits.

Consequential changes use explicit confirmation, including:

- monitoring opt-out;
- recovery-goal change;
- persistent `DONT_SHOW_THIS_TYPE` suppression;
- consent/permission changes that alter clinician delivery;
- other changes the backend marks as consequential.

A goal change is shown as pending until the effective-period/safety rules allow it to become active.

# 16. Clinician workspace

## 16.1 Intended navigation

```text
Overview
Patients
Review Queue
Engagement
Safety
```

The clinician workspace should prioritize rapid understanding of:

- workload;
- current patient state;
- which signals are informational;
- which situations require review;
- what changed over time.

---

# 17. Clinician Overview

A possible information hierarchy:

```text
Clinical Overview
────────────────────────────────────────────────────────

Requires review          Engagement           Safety
       6                     3                   1
    patients                patients             active


Requires attention
────────────────────────────────────────────────────────
Patient       Reason                  Since        Status

A. Kumar      Craving + confidence    Today        New
R. Singh      Recurrent use           Yesterday    Active
...


Current monitoring
────────────────────────────────────────────────────────
124 Active patients

93  Up to date
17  Awaiting check-in
 8  Overdue
 6  Stale / unavailable
```

Numbers here are illustrative only.

The core principle is:

> A clinician should understand current workload immediately after opening the application.

---

# 18. Patient Directory

A searchable, polished, information-dense table.

Conceptual example:

```text
Patients

[ Search patients... ]          Filters ▾

Name          Goal         Last check-in      Current       Review
───────────────────────────────────────────────────────────────
A Kumar       Abstinence   Today              ● 2 flags      Required
R Singh       Reduction    Yesterday          ○ Stable       —
...
```

Avoid unnecessary columns.

The directory should help the clinician enter the correct patient record quickly.

---

# 19. Clinician Patient Detail

This should be one of the major centerpieces of the product.

Possible structure:

```text
Aarav Kumar
ABSTINENCE · Active monitoring

Overview   Check-ins   Consumption   Cases   Timeline
────────────────────────────────────────────────────────
```

## 19.1 Current monitoring state

Conceptual example:

```text
Current monitoring state
────────────────────────────────────────────────────────

Craving                 High
Confidence              Low
Negative mood           No current flag
Risky situations        No current flag
Relationship problems   ...
Social support           ...

Source period
Aug 10 – Aug 16

Submission
Aug 17, 08:42 · Revision 2 · Complete

Freshness
Current
```

Every current-state/flag panel should expose enough provenance to prevent a clinician from mistaking old or partial data for a fresh complete observation.

Where relevant, show:

- scheduled assessment period;
- submitted time;
- authoritative revision number/time;
- `COMPLETE` or `PARTIAL`;
- current/cleared/stale/revision-revoked status;
- observed coverage;
- goal version effective for that period;
- source assessment link.

## 19.2 Current clinical review

Conceptual example:

```text
Current clinical review
────────────────────────────────────────────────────────

CRAVING + LOW CONFIDENCE

Reason state
ACTIVE

Case status
NEW

Activated
Aug 16

Source assessment
Aug 10 – Aug 16 · Rev 2

[ Acknowledge review ]
```

A case may contain multiple reason families. The UI shows:

- active reason families;
- clearance-pending reason families;
- reason history;
- case lifecycle;
- current and historical tier context;
- source observations.

## 19.3 Clinician actions

The UI must not give clinicians unrestricted state-edit controls.

Permitted workflow actions are state-aware:

- acknowledge a `NEW` review;
- open the source assessment/revision;
- view reason history;
- view task routing/delivery status where authorized;
- perform only correction or case actions permitted to the clinician's role.

Clinical reason activation, clearance, recurrence, and ordinary case resolution remain driven by authoritative V1 evaluation.

A clinician cannot manually resolve an ordinary clinical review case while a qualifying reason remains `ACTIVE`.

When no reason remains active but at least one is clearance-pending, the UI represents the case as `CLEARANCE_PENDING`, not resolved.

If a reason returns during clearance, the UI reflects the backend transition back to `ACTIVE`.

After a case is resolved, a future qualifying assessment creates a new case rather than reopening historical records.

## 19.4 Recent trajectory

```text
Recent trajectory
────────────────────────────────────────────────────────

Craving      ▁▂▃▃▆
Confidence   ▆▆▅▄▂
Mood         ...
```

Missing/partial observations remain visually explicit and are not interpolated.

# 20. Clinician Review Queue

The Level-3 review workflow deserves a dedicated work queue.

Conceptual structure:

```text
Review Queue

New  4      Active  6      Clearance pending  2
──────────────────────────────────────────────────────

A Kumar
Craving + low confidence
Created today

Current signals
Craving 6/7 · Confidence 2/7

Source
Aug 10–16 · Complete · Rev 2

[ Open patient ]
```

Level-2 visibility remains distinct from Level-3 work.

The Review Queue therefore contains actual clinician-review cases/tasks rather than every visible flag.

Queue cards/rows should make clear:

- lifecycle (`NEW`, `ACKNOWLEDGED`, `ACTIVE`, `CLEARANCE_PENDING`);
- active reason families;
- source period and freshness;
- task recipient/assignment where applicable;
- delivery state where operationally relevant.

Acknowledgement does not erase the underlying reason.

Repeated unchanged Level-3 conditions should not visually generate duplicate new tasks/alerts when the backend has kept the same case open.

# 21. Clinician Engagement

Engagement remains visually and conceptually separate from clinical risk.

The authoritative clock is the missed period's `effective_due_at`, **not** time since the patient's last completed check-in.

Possible presentation:

```text
Engagement
────────────────────────────────────────────────────────────────────

Patient   Missed period   Effective due   Days overdue   State
A ...     Aug 3–9         Aug 11 00:00    17             At risk
B ...     Jul 20–26       Jul 28 00:00    34             Disengaged
```

Useful columns/details include:

```text
Missed period
Effective due date/time
Days overdue
Reminder 1 status
Final reminder status
Technical/safety pause
Engagement case status
Last completed check-in — secondary context only
```

Opening a patient can show:

- engagement state;
- effective-due timeline;
- reminder history;
- pause periods/reasons;
- engagement case lifecycle;
- last completed check-in as context.

Engagement case workflow should support the existing lifecycle:

```text
NEW
→ ACKNOWLEDGED
→ OUTREACH_IN_PROGRESS
→ RESOLVED_*
```

State-aware actions may include:

- acknowledge;
- begin outreach;
- record an authorized terminal outcome where the V1 permits it.

A newly valid weekly assessment resolves the open engagement case through the backend as returned-after-gap. An explicit monitoring opt-out resolves it as opt-out.

Missing monitoring data must never be rendered as alcohol use, deterioration, or relapse.

# 22. Clinician Safety

Safety remains a distinct workspace rather than mixing with ordinary subjective-monitoring alerts.

Conceptual example:

```text
Safety
─────────────────────────────────────────────────────

Priority cases
1

Patient      Domain        Severity      Status
A ...        Withdrawal    S2 Priority   Handoff initiated
```

Inside a case:

```text
Safety case

Severity
S2 PRIORITY

Domain
Withdrawal

Current gate
ALLOW WITH HANDOFF

Assigned owner
...

Restrictions
...

Lifecycle
Detected
    ↓
Handoff initiated
    ↓
Acknowledged
    ↓
Clinical review
    ↓
Plan established
```

The UI preserves the distinction between:

- subjective-monitoring clinician Levels 0–4;
- safety severity S0–S3;
- safety gate state;
- safety-case lifecycle.

## 22.1 Safety-owner actions

Only an authorized safety owner may perform gate-relaxing or disposition actions.

The safety case UI can provide structured actions for:

- acknowledge;
- record handoff initiation;
- move into clinical review;
- record a structured disposition;
- establish/update permitted restrictions;
- record a plan;
- resolve through an allowed lifecycle transition.

Restriction controls map directly to the existing structured fields:

- allowed subjective interventions;
- monitoring prompt policy;
- goal-change permission;
- reassessment due time.

The UI must not expose a generic `Resolve` button that bypasses authorization or lifecycle requirements.

## 22.2 Safety delivery failure

S0/S1 safety delivery failure is surfaced prominently as an operational incident.

It does not downgrade severity, clear the case, or return the patient to ordinary monitoring.

The interface shows configured routing/fallback status rather than inventing a new clinical state.

# 23. Clinician Timeline

A unified human-readable patient timeline could make the product especially strong.

Conceptual example:

```text
16 Aug
● Weekly assessment submitted
● HIGH_CRAVING became active
● LOW_CONFIDENCE became active
● Clinical review case created
● Patient support delivered

09 Aug
● Weekly assessment submitted
● HIGH_CRAVING active

02 Aug
● Weekly assessment submitted
● No current actionable state
```

This should show clinically meaningful system history.

The full forensic/system audit belongs in the administrative/audit tooling.

---

# 24. Admin workspace

The V1 Master Specification does not define one canonical "Admin Portal."

The Admin workspace is therefore the operational/governance surface for capabilities that the V1 implementation genuinely needs, rather than a place to invent extra product features.

Navigation:

```text
Overview
Users & Access
Content
Configuration
Operations
Audit
```

Regional routing can live under Configuration for V1 unless its operational complexity later justifies a dedicated top-level screen.

Admin access follows least-privilege authorization. The existence of an Admin workspace does not imply unrestricted access to every patient's clinical data.

# 25. Admin Overview

Conceptual example:

```text
Administration
────────────────────────────────────────────────────

Users                 Active monitoring
342                    281

Clinical tasks         Delivery failures
12 open                2

Content
10 intervention classes defined
(enabled/operational coverage shown separately)

System status
● API healthy
● Database healthy
● Background processing healthy


Needs attention
────────────────────────────────────────────────────
2 delivery failures
1 configuration issue
...
```

Numbers are illustrative only.

The dashboard must distinguish:

- classes defined by V1;
- classes currently enabled;
- classes meeting required approved-resource coverage;
- operational failures.

The objective is to give administrators an immediate view of system operations without presenting configuration health as clinical severity.

# 26. Users, Access, and Privacy

Possible administrative entities include:

```text
Patients
Clinicians
Administrators / operational users
Roles
Assignments / relationships
Account states
```

Conceptual table:

```text
Users

[ Search... ]     Role ▾     Status ▾

Name             Role         Status       Last active
──────────────────────────────────────────────────────
A Kumar          Patient      Active       Today
Dr Mehta         Clinician    Active       Today
...
```

## 26.1 Access model

The implementation should enforce authorization on the backend, not by hiding navigation alone.

Baseline workspace expectations:

- **Patient:** own permitted patient data/workflows only.
- **Clinician:** patients assigned directly or available through an authorized care-team scope; privileged safety/correction actions require explicit permissions.
- **Admin/operations:** administrative and operational surfaces according to explicit permissions; Admin role alone is not a blanket entitlement to patient clinical content.
- **Safety owner functions:** available only to actors authorized for the relevant safety domain.

Unauthorized access returns a dedicated restricted state and is auditable where required.

## 26.2 Privileged actions

Privileged operations such as:

- staff/clinician correction;
- content approval;
- role/assignment changes;
- safety disposition/restriction changes;
- route activation;
- technical-failure confirmation/correction;
- other manually confirmed case transitions

must record the authorized actor, time, and required reason/provenance.

## 26.3 Session behavior

Authentication/session behavior must not create hidden data loss.

If a patient session expires while a server-backed draft exists, reauthentication should return them to that saved draft rather than creating a duplicate assessment.

Privileged actions require a current authorized session and should not be executed from stale UI state.

## 26.4 Notification privacy

Auxiliary email/push notifications should be minimal.

Notification previews should not expose questionnaire answers, detailed safety disclosures, or sensitive clinical reasoning when the user has not authenticated into the application.

Notifications should primarily communicate that attention/action is available and deep-link into the authorized product surface.

## 26.5 Restricted states

Every workspace has a designed permission-denied/restricted state.

The product must not leak sensitive record existence or content through disabled controls, URLs, table counts, notifications, or error details.

# 27. Admin Content Management

Content management is a strong candidate for a polished administrative experience.

Conceptual content library:

```text
Content Library

All   Draft   In review   Approved   Retired

────────────────────────────────────────────────────────

Managing a strong craving
CRAVING_COPING_SUPPORT

English (India)
Approved · v3

Goals
Abstinence · Reduction

Last reviewed
12 Aug 2026

                              [ Open ]
```

Possible resource detail sections:

```text
Content
Eligibility
Versions
Review
Delivery history
```

## 27.1 Content governance

Content versions are immutable once approved.

Editing approved patient content does **not** mutate the approved version. It creates a new draft version that must pass review before it can become approved/enabled.

Only an actor with explicit content-review approval permission may approve/reject a resource version.

The UI should visibly distinguish:

```text
DRAFT
UNDER_REVIEW
APPROVED
RETIRED
REJECTED
```

and expose:

- resource/version identity;
- intervention class;
- locale/language;
- allowed recovery goals;
- preference constraints;
- safety compatibility;
- contraindication metadata;
- review actor/time;
- effective/retired state;
- enabled state.

Patient delivery still requires the complete backend eligibility pipeline.

The Admin UI never provides a "force deliver" action that bypasses approval, safety, contraindication, refusal, locale, or preference rules.

# 28. Admin Configuration and Routing

Possible organization:

```text
Configuration

Monitoring
Safety
Content
Delivery
Regional routing
```

Configuration is not treated as one giant editable settings object.

## 28.1 Editable versus view-only

The UI distinguishes:

### Editable operational/deployment configuration

Only values explicitly intended to be configurable by the V1 implementation and the current actor's permissions.

Examples may include:

- deployment routing targets;
- permitted notification/channel settings;
- operational assignments;
- other deployment-specific values represented as configurable by the backend.

### Versioned policy/configuration

Changes create a new configuration/version record and do not reinterpret historical calculations.

### View-only canonical V1 policy

Canonical questionnaire identifiers, historical rule versions, fixed period semantics, and rule thresholds are not casual text-field settings in the normal Admin UI.

Changing such policy requires a deliberate versioned implementation/policy change, not an ordinary runtime edit.

### Historical configuration

Historical versions are view-only and remain available for audit reconstruction.

## 28.2 Regional safety routing

Routing profiles use a controlled lifecycle:

```text
Edit/draft route configuration
        ↓
Validate required fields
        ↓
Perform/test delivery route
        ↓
Record test result
        ↓
Activate new version
```

Real-patient activation remains blocked if required routes/protections are missing or have not passed the required delivery test.

A routing change never silently overwrites the version that governed historical events.

# 29. Admin Operations

Possible operational sections:

```text
Operations

System incidents
Technical failures
Delivery failures
Notification attempts
Background jobs/status
```

Example technical-failure view:

```text
Assessment access issue
─────────────────────────────────────────────────

Affected
23 patients

Started
16 Aug 18:03

Status
CONFIRMED

Evidence
...

Engagement timing
PAUSED

[ Resolve / correct… ]
```

`Resolve / correct…` opens a structured authorized workflow. It is not a one-click state mutation.

The flow records the information required by the existing technical-failure semantics, including:

- affected patient/cohort scope;
- failure type;
- start time;
- evidence;
- confirming/correcting actor;
- confirmation/correction time;
- resolution time where applicable;
- resolution or false-positive correction reason/provenance.

When a confirmed access failure resolves, engagement timing is recomputed by the backend from the V1 `effective_due_at` rule.

The Admin interface must not manually recalculate or override engagement timing in the browser.

Operational delivery failures remain distinct from clinical eligibility/severity.

# 30. Audit Explorer

A dedicated audit surface can showcase deterministic reproducibility without cluttering ordinary clinician or patient screens.

Conceptual example:

```text
Audit

[ Patient / Assessment / Case ID... ]

────────────────────────────────────────────────────

16 Aug 22:14:03
ASSESSMENT_SUBMITTED

16 Aug 22:14:03
ASSESSMENT_EVALUATED
rule_set     subjective_monitoring_v1
revision     1

16 Aug 22:14:03
FLAG_ACTIVATED
HIGH_CRAVING

16 Aug 22:14:03
CASE_CREATED
CRAVING_LOW_CONFIDENCE

16 Aug 22:14:04
CONTENT_SELECTED
resource: craving_support_03
```

This is especially useful for demonstrating:

- deterministic behavior;
- policy/version provenance;
- state transitions;
- auditability;
- resource selection;
- case creation.

---

# 31. Design-system principles

UI quality is part of the implementation architecture rather than a final styling phase.

A shared visual system should be established early enough that later Codex-assisted implementation follows the same language.

Important primitives include:

```text
Typography
Spacing
Radius
Surface hierarchy
Navigation
Cards
Forms
Tables
Status representation
Charts
Empty states
Loading states
Error states
Dialogs
Responsive behavior
Motion
Iconography
Accessibility behavior
```

The goal is to avoid screen-by-screen improvisation.

Design-system components should encode recurring state behavior such as:

- destructive/consequential confirmation;
- restricted/permission-denied state;
- stale-data badge;
- partial-data badge;
- safety-controlled shell;
- loading skeletons;
- retry-safe form submission;
- accessible chart alternatives;
- validation/error association.

# 32. Beautiful does not mean visually busy

Use visualizations where they materially improve understanding.

Good candidates:

- item trajectories;
- weekly alcohol quantities;
- valid goal progress;
- assessment completion history;
- current clinician workload;
- patient-monitoring distribution;
- operational health/status.

Avoid:

- arbitrary donut charts;
- invented health scores;
- gauges for every metric;
- visual decoration presented as analytics;
- 3D charts;
- dashboards overloaded merely to look advanced.

Sophistication should come from clarity and hierarchy.

---

# 33. Loading, empty, error, stale, and restricted states

Every important workflow should have designed states for:

```text
loading
nothing here yet
no current assessment
draft exists
submitted partial
late submission
historical backfill
stale information
revision superseded/revoked
permission denied
network error
submission retry in progress
submission stored but content unavailable
technical failure
safety-controlled flow
```

Avoid generic or unfinished states such as:

```text
Error 500
```

or blank tables without explanation.

State handling principles:

- frontend retries must not create duplicate domain records;
- a delivery failure must not be presented as a failed clinical evaluation;
- stale and missing data are visibly different from normal/current data;
- patient-safe wording hides internal codes while clinician/admin surfaces may expose operational identifiers where useful;
- restricted states reveal only the minimum information appropriate to the actor.

These patterns should be reusable design-system primitives.

# 34. Dark mode

Dark mode is not a necessary initial priority.

A highly polished, authoritative light-mode healthcare interface is preferable to splitting design effort across two themes too early.

A second theme can be added later if it becomes worthwhile.

---

# 35. Professional does not mean feature-heavy

The product does not need a very large number of screens to feel complete.

A smaller number of excellent, coherent workflows is more valuable than many mediocre or incomplete features.

Professional quality should come from:

- strong hierarchy;
- consistent typography;
- thoughtful spacing;
- high-quality forms;
- careful tables;
- clear charts;
- meaningful empty states;
- robust error handling;
- subtle motion;
- excellent copy;
- consistent state representation;
- fast, predictable interactions.

---

# 36. Features intentionally not implied by this V1 product map

The following should not be introduced merely to make the product appear larger:

```text
patient social feed
chat rooms
community system
video consultations
appointment scheduling
billing
EHR integration
generic CMS
AI assistant embedded into every screen
gamification badges
leaderboards
complex analytics builder
custom dashboard widgets
```

Any such capability should be added only if a later feature/service explicitly requires it.

---

# 37. Suggested evaluator/demo journey

The current prototype can be demonstrated through this flow:

```text
1. Sign in as PATIENT
       ↓
2. Open onboarding and save/resume a server-backed draft
       ↓
3. Submit the authoritative onboarding revision
       ↓
4. Complete the safety assessment and observe the patient-safe projection
       ↓
5. If REDUCTION, complete the 28-day baseline and propose a target
       ↓
6. Finish onboarding and observe COMPLETE, pending-review, or safety-handoff state
       ↓
7. Open Check-in and resume the backend-backed weekly draft
       ↓
8. Submit a PARTIAL or COMPLETE assessment and inspect the neutral recorded state
       ↓
9. Open Check-in history and exercise a correction or historical backfill


10. Switch to CLINICIAN
       ↓
11. Open assigned patients and safety cases
       ↓
12. Acknowledge, review, disposition, or escalate an authorized safety case


13. Switch to ADMIN
        ↓
14. Inspect users, regional routing, safety cases, and route incidents
        ↓
15. Demonstrate that prototype activation remains separate from real-patient readiness
```

The weekly check-in, history, correction, historical-backfill, patient Support, and clinician subjective-review journeys are now current. Patient Home/Progress, engagement, and longitudinal-monitoring presentation remain the later implementation path described by the product lock; those screens are not current routes.

The current evaluator should be able to see that the application is doing more than storing questionnaire answers: authoritative revisions, safety state, reduction provenance, goal status, schedule activation, access boundaries, and audit effects are all backend-controlled.

---

# 38. Consolidated product-surface map

## Patient

```text
Patient
├── Onboarding
├── Safety / activation flow
├── Home
├── Weekly check-in
├── Reduction alcohol calendar where applicable
├── Post-check-in support
├── Progress
├── Support
└── Profile / preferences
```

## Clinician

```text
Clinician
├── Overview
├── Patient directory
├── Patient monitoring detail
├── Review Queue
├── Engagement
├── Safety
└── Patient timeline / history
```

## Admin

```text
Admin
├── Overview
├── Users & Access
├── Content Management
├── Configuration
├── Operations
└── Audit Explorer
```

---

# 39. Overall architecture map

```text
                         PLATFORM
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
           PATIENT       CLINICIAN      ADMIN
              │             │             │
              │             │             │
        ┌─────┴─────┐   ┌───┴────┐   ┌───┴─────────┐
        │           │   │        │   │             │
     Onboard       Home Overview Patients Overview Users
        │           │      │        │      │       │
      Safety     Check-in Review   Detail Content Config
        │           │      │        │      │       │
       Goal      Progress Engage   Cases Operations Audit
        │           │      │        │
     Profile     Support  Safety  Timeline
```

Everything authoritative underneath:

```text
                      SHARED BACKEND
                            │
          ┌─────────────────┼──────────────────┐
          │                 │                  │
       domain             state              orchestration
          │                 │                  │
          └─────────────────┼──────────────────┘
                            │
                           DB
```

---

# 40. Current implementation philosophy

The product direction represented by this document is locked around the following principles:

1. **One product, three role-specific workspaces.**
2. **One central backend owns nearly all meaningful domain behavior.**
3. **Web and future mobile remain comparatively thin clients.**
4. **Use clean internal backend modules without premature microservices or unnecessary distributed infrastructure.**
5. **Prefer simple technology wherever it satisfies the actual functional, safety, deployment, and maintainability requirements.**
6. **Do not add engineering complexity because it is fashionable, mainstream, or architecturally impressive.**
7. **Optimize the codebase for fast expansion and heavy Codex-assisted implementation.**
8. **Treat visual quality and UX consistency as first-class engineering concerns.**
9. **Plan coherent feature slices and contracts before implementation instead of discovering architecture through endless tiny commits.**
10. **Keep domain/state complexity in the backend so the web and future mobile clients do not reimplement V1 semantics.**
11. **Make state provenance, freshness, partiality, safety restriction, and permission boundaries explicit wherever misunderstanding would be harmful.**
12. **Use versioning/immutability already required by V1 rather than building ad-hoc overwrite workflows.**
13. **Add a new service/technology only when a concrete new requirement justifies it.**
14. **Deployment architecture is considered from the beginning, while real-patient activation remains separately gated by the V1 Master Specification.**
15. **The finished V1 must present as a professional, sophisticated product—not a prototype—even though the implementation underneath is intentionally restrained.**

# 41. Consequential-action confirmation contract

Consequential actions must not be ambiguous one-click mutations.

Use a consistent confirmation pattern for actions such as:

- monitoring opt-out;
- recovery-goal change;
- persistent content-type suppression;
- consent/permission changes with downstream effects;
- assessment correction/revision submission;
- content approval/retirement;
- role or assignment changes;
- regional route activation;
- safety disposition/restriction changes;
- technical-failure resolution/correction;
- program-close or other authorized terminal case outcomes.

A confirmation should state:

- what is changing;
- when it becomes effective where relevant;
- whether history remains unchanged/versioned;
- any immediate product consequence;
- whether the action can be reversed through another explicit workflow.

The backend remains authoritative; confirmation dialogs never perform domain calculation themselves.

---

# 42. Accessibility architecture requirement

The web product baseline is **WCAG 2.2 AA**.

Accessibility is part of the component and acceptance architecture rather than a later polish pass.

At minimum, the product requires:

- complete keyboard operation;
- visible, unobscured focus;
- correct semantic structure and screen-reader names;
- programmatic status/error announcements where needed;
- no state communicated by color alone;
- accessible 0–7 assessment controls;
- correctly associated instructions and validation errors;
- text/table alternatives for charts and visual trends;
- sufficient contrast;
- adequate pointer/target sizing;
- responsive reflow and zoom support;
- reduced-motion behavior;
- accessible authentication/session-expiry flows;
- safe timeout/session-extension behavior where timeouts exist.

Accessibility should be checked through both automated tooling and manual interaction testing.

The design system should encode these behaviors so feature work inherits them by default.

---

# 43. State and provenance presentation contract

To prevent polished UI from hiding clinically important uncertainty, every role-specific surface follows these rules:

- `UNKNOWN`/missing is never rendered as zero, negative, abstinent, stable, or improved.
- Partial data is visibly partial.
- Historical/backfilled data is visibly historical.
- Stale data is visibly stale.
- A correction/revision never silently rewrites the visible historical record.
- Clinician views expose source period/revision/freshness for actionable state.
- Patient views use plain-language wording without exposing internal clinical tier codes.
- Goal/target-dependent displays use the version effective for the displayed period.
- Delivery status is not conflated with rule eligibility or severity.
- Engagement status uses `effective_due_at`, not a heuristic based on last activity.
- Safety restriction has presentation precedence over ordinary support/progress.

---

# 44. Implementation-lock outcome

With the corrections in this document, the intended **product surface and state-driven UX architecture are ready to lock for V1 implementation**, subject to the following authority boundary:

> If any later implementation detail conflicts with `AUD_Subjective_Monitoring_Master_Specification_V1.md`, the Master Specification wins.

This lock covers:

- the three-workspace product model;
- navigation/workspace responsibilities;
- central-backend/thin-client philosophy;
- state-driven patient experience;
- assessment lifecycle UX;
- reduction workflow UX;
- clinician work/case presentation;
- engagement timing presentation;
- safety interaction surfaces;
- admin governance surfaces;
- access/privacy presentation principles;
- content/version governance;
- technical-operations UX;
- audit/product visualization;
- design-system/accessibility expectations;
- consequential-action confirmation;
- missing/stale/partial/provenance handling.

It does **not** yet lock:

- framework/library choices;
- database schema;
- endpoint names;
- repository/package structure;
- exact deployment provider;
- authentication vendor/mechanism;
- queue/job implementation;
- exact component library;
- visual brand palette or final screen mockups.

Those belong to the next implementation-design agenda.

---

# 45. Consolidated lock summary

## Patient

```text
Patient
├── Onboarding
│   ├── profile/drinking context
│   ├── draft recovery direction
│   ├── reduction baseline/target when applicable
│   └── safety resolution before activation
├── Safety-controlled experience
├── Home
├── Weekly check-in
│   ├── draft/resume
│   ├── complete/partial submission
│   ├── late/backfill
│   └── revision/correction
├── Reduction workflow
├── Post-check-in support
├── Progress
├── Support
└── Profile / preferences / permissions
```

## Clinician

```text
Clinician
├── Overview
├── Patient directory
├── Patient monitoring detail
│   ├── source period/revision/freshness
│   └── longitudinal context
├── Level-3 Review Queue
├── Engagement
│   └── effective_due_at-based state
├── Safety
│   └── authorized disposition/restriction workflow
└── Patient timeline / history
```

## Admin

```text
Admin
├── Overview
├── Users & Access
├── Content Management
│   └── immutable approved versions
├── Configuration & Regional Routing
├── Operations
│   ├── technical failures
│   └── delivery/incident visibility
└── Audit Explorer
```

## Shared implementation posture

```text
Professional product surface
            +
One authoritative modular backend
            +
Thin web/mobile clients
            +
One primary relational source of truth
            +
Versioned/auditable domain state
            +
Minimal necessary infrastructure
```
