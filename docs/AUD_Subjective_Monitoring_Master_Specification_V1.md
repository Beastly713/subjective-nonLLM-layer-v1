# Alcohol Use Disorder Support System

## Subjective Monitoring and Alcohol-Consumption Layer — V1 Master Specification

**Document role:** Authoritative implementation specification  
**Instrument:** `AUD_WEEKLY_CHECKIN` version `1.0`  
**System version:** `subjective_monitoring_v1`  
**Primary population:** Adults using an Alcohol Use Disorder support solution  
**Decision model:** Deterministic, auditable, non-LLM

**Implementation status:** Phases 1–5 are implemented in the repository, with the validated Phase 5 implementation head at `f6bc02b` (`fix: close phase 5 patient support and clinical review`). The current codebase includes the weekly assessment and deterministic subjective-monitoring core, governed patient support resolution, Level-2 clinician visibility, Level-3 clinical review cases, durable in-app clinician tasks, and the corresponding patient/clinician workflow surfaces. Engagement workflows, auxiliary/external delivery, background workers, backup/retention controls, and real-patient operation remain later implementation phases. This document remains the target V1 product and clinical specification; the current implementation boundary is recorded in `AUD_V1_Phase_5_Patient_Support_and_Clinical_Review_Implementation_Guide.md`.

---

## 1. Authority and purpose

This document is the single source of truth for V1 of the structured subjective-monitoring and alcohol-consumption subsystem. It defines:

- V1 scope and boundaries;
- onboarding and profile ownership;
- safety-gate integration;
- the exact weekly questionnaire;
- fixed weekly assessment periods;
- partial, late, backfilled, and revised assessment behavior;
- current-state, aggregate, interaction, longitudinal, and recurrence rules;
- reduction-goal measurement;
- patient intervention intents and content selection;
- clinician visibility, clinical review cases, and delivery;
- engagement and technical-failure state machines;
- canonical data structures, provenance, and audit requirements;
- implementation configuration and processing order.

All components must use the identifiers and semantics defined here. A change to a rule, threshold, questionnaire item, state transition, or content contract requires a new version and must not silently reinterpret historical records.

---

## 2. V1 scope

### 2.1 Included

V1 includes:

1. onboarding and recovery-profile collection;
2. a mandatory pre-activation safety-gate interface;
3. one fixed-period weekly subjective check-in;
4. a seven-day alcohol-consumption calendar for `REDUCTION` goals;
5. a 28-day baseline for `REDUCTION` goals;
6. deterministic current-state flags;
7. separate risk and protection context;
8. a small interaction whitelist;
9. longitudinal deltas, persistence, clearance, and recurrence;
10. patient intervention-intent resolution;
11. approved content selection and repetition control;
12. Level-2 clinician visibility flags;
13. Level-3 clinical review cases;
14. separate engagement review cases;
15. safety cases and safety delivery;
16. immutable audit and provenance records.

### 2.2 Outside V1

The following are outside V1:

- Daily/EMA monitoring;
- predictive ML or Bayesian risk estimation;
- autonomous diagnosis;
- autonomous medication or treatment selection;
- withdrawal or detoxification management;
- suicide-risk inference from the weekly negative-mood item;
- emergency treatment decisions beyond detection, blocking, and routing;
- a single weighted or opaque risk score controlling all actions;
- automatic Level-4 subjective-monitoring escalation.

The V1 feature configuration must contain:

```yaml
ema:
  enabled: false
  v1_scope: false
```

---

## 3. Core principles

1. **Individual variables are primary.** Aggregates provide context and never erase item-level concerns.
2. **Current observed state is the anchor.** History modifies interpretation but does not fabricate current state.
3. **Missing means `UNKNOWN`.** It never means use, non-use, abstinence, stability, improvement, or deterioration.
4. **Support is broader than clinician notification.** Patient support may be delivered without opening a clinician case.
5. **A use-positive period is not automatically a relapse.** Patient language follows the active recovery goal.
6. **Risk and protection remain separate dimensions.** Protection may prevent an additional aggregate escalation but never suppresses an item-level intervention.
7. **Rules emit intervention classes.** Approved content owns patient-facing wording.
8. **Eligibility, visibility, case creation, and delivery are separate facts.** A delivery failure never changes clinical severity.
9. **Safety owns safety.** The subjective engine receives a gate state and permitted-intervention list; it does not perform treatment.
10. **Every decision is reproducible.** Raw responses, rule versions, reasons, selected resources, delivery results, and corrections remain auditable.

---

## 4. System architecture

```text
ACCOUNT / ONBOARDING
        |
        v
SAFETY SCREEN ------------------------------+
        |                                    |
        v                                    |
SAFETY RESOLVER                              |
        |                                    |
        +--> SafetyCase / safety handoff     |
        |                                    |
        v                                    |
PROFILE + RECOVERY GOAL                      |
        |                                    |
        +---------------------------+        |
        |                           |        |
        v                           v        |
WEEKLY SUBJECTIVE CHECK-IN   REDUCTION CONSUMPTION CALENDAR
        |                           |
        v                           v
VALIDATION / REVISION / PROVENANCE
        |
        v
CURRENT ITEM FLAGS
        |
        v
RISK + PROTECTION CONTEXT
        |
        v
INTERACTION WHITELIST
        |
        v
LONGITUDINAL / PERSISTENCE / RECURRENCE
        |
        +-----------------------+
        |                       |
        v                       v
PATIENT INTENT RESOLVER   CLINICIAN VISIBILITY / CASE RESOLVER
        |                       |
        v                       v
APPROVED CONTENT          DURABLE CLINICIAN TASK
        |                       |
        v                       v
PATIENT SUPPORT           NOTIFICATION BROKER

Parallel operational path:

MISSED WEEKLY CHECK-INS
        |
        v
ENGAGEMENT STATE
        |
        v
REMINDERS / DASHBOARD FLAG / ENGAGEMENT CASE
```

The future conversational layer may express an already-approved intervention resource. It does not own questionnaire scoring, state derivation, safety routing, clinician tiering, or intervention-class selection.

---

## 5. Canonical identifiers and vocabularies

### 5.1 Recovery goals

```yaml
RecoveryGoal:
  - ABSTINENCE
  - REDUCTION
  - UNSURE
```

### 5.2 Weekly alcohol status

```yaml
WeeklyAlcoholStatus:
  - POSITIVE
  - NEGATIVE
  - UNKNOWN
```

### 5.3 Current-state flags

```yaml
CurrentStateFlag:
  - HIGH_CRAVING
  - HIGH_NEGATIVE_MOOD
  - HIGH_RISKY_SITUATIONS
  - HIGH_RELATIONSHIP_PROBLEMS
  - LOW_CONFIDENCE
  - LOW_SOCIAL_SUPPORT
  - USE_POSITIVE_CURRENT
```

### 5.4 Aggregate context tags

```yaml
AggregateContextTag:
  - HIGH_RISK
  - NOT_HIGH
  - WEAK_PROTECTION
  - INTERMEDIATE_PROTECTION
  - STRONG_PROTECTION
  - HIGH_RISK_WEAK_PROTECTION_CONTEXT
  - HIGH_RISK_STRONG_PROTECTION_CONTEXT
```

When protection applicability prevents a defensible weak/strong classification, no weak, intermediate, or strong protection tag is emitted. Coverage and the possible score range are retained.

### 5.5 Intervention classes

```yaml
InterventionClass:
  - CRAVING_COPING_SUPPORT
  - SELF_EFFICACY_SUPPORT
  - MOOD_COPING_SUPPORT
  - TRIGGER_MANAGEMENT_SUPPORT
  - RELATIONSHIP_COPING_SUPPORT
  - SOCIAL_SUPPORT_ACTIVATION
  - USE_EVENT_RECOVERY_SUPPORT
  - RECURRENT_USE_RECOVERY_SUPPORT
  - RECOVERY_PLAN_REVIEW
  - POSITIVE_REINFORCEMENT
```

### 5.6 Clinical review reason families

```yaml
ClinicalReasonFamily:
  - CRAVING_LOW_CONFIDENCE
  - MOOD_CRAVING
  - PERSISTENT_HIGH_CRAVING
  - PERSISTENT_HIGH_NEGATIVE_MOOD
  - CONSECUTIVE_USE
  - RECURRENT_USE
```

### 5.7 Safety-gate states

```yaml
SafetyGateStatus:
  - NOT_ASSESSED
  - ALLOW_MONITORING
  - ALLOW_WITH_HANDOFF
  - BLOCK_AND_HANDOFF
```

### 5.8 Safety severity

```yaml
SafetySeverity:
  - S0_EMERGENCY
  - S1_URGENT
  - S2_PRIORITY
  - S3_ROUTINE
  - S_NONE
```

Safety severity is separate from clinician subjective-monitoring Levels 0–4.

---

## 6. Time, schedule, and assessment-period identity

### 6.1 Monitoring timezone

Each patient has one IANA `monitoring_timezone`, such as `Asia/Kolkata` or `America/New_York`. Backend timestamps are stored in UTC. Period boundaries are calculated in the period's fixed monitoring timezone.

### 6.2 Weekly schedule

```yaml
weekly_schedule:
  period_start_weekday: MONDAY
  period_start_local_time: "00:00:00"
  duration: 7_local_calendar_days
  open_at: period_end
  due_after_open_hours: 24
  early_final_submission: false
```

For each scheduled period:

```text
period_start = Monday 00:00 local
period_end   = next Monday 00:00 local, exclusive
open_at      = period_end
due_at       = period_end + 24 hours
```

Questions refer to `[period_start, period_end)` regardless of submission time.

### 6.3 Enrollment mid-period

Enrollment does not create a shortened weekly period. If onboarding completes mid-week, the first scheduled period begins at the next Monday 00:00 in the monitoring timezone. Onboarding data may provide context until that first period is complete.

### 6.4 Timezone and schedule changes

- A period retains the timezone and schedule version active when it began.
- A timezone or schedule change takes effect at the next period boundary.
- An in-progress period is never shortened or lengthened.
- A formal reschedule completed before `due_at` replaces `due_at` and is audit-versioned.

### 6.5 Assessment identity

There is one logical assessment per patient and scheduled period:

```yaml
assessment_identity:
  patient_id: UUID
  period_id: UUID
  instrument_id: AUD_WEEKLY_CHECKIN
  instrument_version: "1.0"
```

Corrections create revisions of the same assessment; they do not create duplicate weeks.

---

## 7. Onboarding and profile subsystem

### 7.1 Required response-state fields

Onboarding requires a response state for:

- AUDIT-C responses and score;
- drinking days per week;
- drinks per drinking day;
- heavy-drinking days in the configured recent window;
- last drink date;
- recovery goal;
- mutual-help preference;
- spiritual-content preference.

Optional context:

- currently in treatment;
- AUD medication context;
- known triggers;
- preferred coping strategies;
- support-person availability;
- reasons for change or personal values;
- longest previous abstinent period.

### 7.2 Null and preference semantics

```yaml
LastDrinkDateResponse:
  - KNOWN
  - APPROXIMATE
  - UNKNOWN
  - PREFER_NOT_TO_SAY

MutualHelpPreference:
  - NONE
  - AA_12_STEP
  - ALTERNATIVE
  - UNSURE
  - PREFER_NOT_TO_SAY

SpiritualContentPreference:
  - ALLOW
  - DO_NOT_ALLOW
  - UNSURE
```

`UNSURE` never enables AA/12-step-specific or spiritual personalization.

Metrics dependent on a missing concrete baseline value are not calculated. Values are never imputed.

### 7.3 Ownership precedence

```text
dynamic clinical facts:
latest authoritative scheduled assessment > onboarding baseline

stable preferences and recovery goal:
profile value remains authoritative until explicitly versioned
```

Drinking days and drinks per drinking day are replaced only by comparable quantity/frequency observations. A weekly Boolean use item cannot replace them.

### 7.4 Recovery-goal versioning

Every goal change creates a version:

```yaml
RecoveryGoalVersion:
  goal_version: integer
  goal: ABSTINENCE | REDUCTION | UNSURE
  effective_from_period_id: UUID
  set_by: PATIENT | CLINICIAN | SHARED
  created_at: timestamp
```

Goal changes take effect at the next weekly boundary and never reclassify earlier periods.

### 7.5 Onboarding instruments not used

Standard V1 onboarding does not administer:

- the full AUDIT;
- CAGE;
- OCDS or PACS craving inventories;
- a DSM diagnostic checklist;
- PHQ-9 as part of the basic personalization profile;
- a full TLFB instrument;
- an exhaustive medical intake.

AUDIT-C and baseline drinking descriptors provide onboarding context and never independently create a subjective-monitoring clinician case. Safety-specific questions belong to the safety subsystem defined below.

---

## 8. Required safety-gate interface

### 8.1 Activation contract

Before weekly monitoring or a recovery-goal change is activated, the safety subsystem must return a `SafetyGateStatus`.

Allowed before assessment:

- account creation;
- profile completion;
- draft onboarding.

Automated weekly processing is active only for:

```yaml
ALLOW_MONITORING
ALLOW_WITH_HANDOFF
```

`BLOCK_AND_HANDOFF` transfers patient-facing control to the safety pathway. The subjective engine cannot substitute for it.

### 8.2 Screening points

Safety screening runs:

1. before monitoring activation;
2. before an `ABSTINENCE` goal becomes active;
3. before a `REDUCTION` target meeting `PLANNED_MAJOR_REDUCTION` becomes active;
4. when a patient reports recent cessation or a major reduction;
5. when withdrawal-like symptoms are disclosed;
6. when suicide or self-harm is disclosed;
7. when pregnancy status becomes pregnant or possibly pregnant;
8. when clinically important opioid or sedative use is reported;
9. when an authorized clinician requests reassessment.

The full safety screen is not repeated every week.

### 8.3 Canonical safety predicates

```text
RECENT_REDUCTION:
cessation or >=50% reduction began within the previous 7 calendar days

PLANNED_MAJOR_REDUCTION:
new goal is ABSTINENCE
OR target_weekly_drinks <= 50% of baseline_average_weekly_drinks

PROLONGED_HEAVY_REGULAR_USE:
28-day baseline meets the configured heavy-week threshold
AND the patient reports a similar pattern for at least 3 months

NUMEROUS_PRIOR_WITHDRAWALS:
3 or more prior withdrawal episodes
```

Major withdrawal-risk factors:

```yaml
- AGE_OVER_65
- NUMEROUS_PRIOR_WITHDRAWALS
- PROLONGED_HEAVY_REGULAR_USE
- SEDATIVE_DEPENDENCE
- SERIOUS_MEDICAL_CONDITION
- CURRENT_OPIOID_OR_SEDATIVE_USE
```

Prior withdrawal seizure and prior withdrawal delirium are strong-history factors and are handled directly rather than through the factor count.

### 8.4 Immediate emergency screen

Ask:

> Are you currently having a medical emergency or experiencing any of the following right now?

Options:

- a seizure or seizure-like episode;
- severe confusion or difficulty knowing where you are;
- seeing or hearing things that are not there;
- difficulty staying awake or being awakened;
- trouble breathing;
- repeated vomiting with severe illness;
- none of these.

If hallucinations are selected, immediately ask whether the patient is severely confused, disoriented, or having difficulty knowing where they are. Hallucinations with disorientation route to S0; hallucinations without disorientation after a recent reduction route to S1.

### 8.5 Withdrawal-history screen

Ask:

1. **Previous withdrawal seizure:** Have you ever had a seizure when you stopped or sharply reduced alcohol?
2. **Previous withdrawal delirium:** Have you ever become severely confused, disoriented, or delirious during alcohol withdrawal?
3. **Number of prior withdrawals:** `0`, `1–2`, `3 or more`, or `UNSURE`.
4. **Heavy regular use:** Before your recent or planned change, had you been drinking heavily and regularly for at least three months?
5. **Recent reduction:** Have you stopped drinking or reduced your usual amount by approximately half or more within the last seven days?
6. **Sedative dependence:** Do you regularly take benzodiazepines, barbiturates, or other sedatives, or have you been told you may be physically dependent on them?

Strong-history and sedative questions support `YES`, `NO`, and `UNSURE`.

### 8.6 Current withdrawal-symptom screen

When recent reduction is true or withdrawal is otherwise suspected, ask whether the patient has experienced:

- shaking or tremor;
- unusual sweating;
- racing heartbeat;
- nausea or vomiting;
- severe restlessness or agitation;
- severe anxiety;
- inability to sleep;
- hallucinations;
- seizure;
- severe confusion or disorientation;
- none.

This screen routes care. It does not diagnose withdrawal and is not a self-administered CIWA-Ar.

For the S1 symptom-count rule, `non-emergency withdrawal symptoms` means:

```yaml
- TREMOR
- UNUSUAL_SWEATING
- RACING_HEARTBEAT
- NAUSEA_OR_VOMITING_WITHOUT_SEVERE_ILLNESS
- SEVERE_RESTLESSNESS_OR_AGITATION
- SEVERE_ANXIETY
- INABILITY_TO_SLEEP
```

Seizure, severe confusion/disorientation, impaired consciousness, breathing difficulty, and repeated vomiting with severe illness are evaluated by S0. Hallucinations are evaluated by their dedicated S0/S1 rules and are not added to this symptom count.

### 8.7 Suicide/self-harm screen

Use the official C-SSRS:

- onboarding and scheduled rescreen: `C-SSRS Screener Recent`;
- follow-up after a positive screen: `C-SSRS Since Last Contact`.

Schedule:

```yaml
onboarding: required
routine_rescreen_days: 30
after_positive_screen: each_weekly_checkin_until_case_cleared
explicit_disclosure: immediate
```

The weekly `negative_mood` value never creates a suicide-risk state.

### 8.8 Pregnancy screen

Where appropriate for the deployment population, collect:

```yaml
PregnancyStatus:
  - NO
  - PREGNANT
  - POSSIBLY_PREGNANT
  - TRYING_TO_CONCEIVE
  - PREFER_NOT_TO_SAY
```

Pregnancy-specific content is not inferred from any other profile field.

Pregnancy behavior is deterministic:

- `PREGNANT` or `POSSIBLY_PREGNANT` plus current alcohol use routes to S2 and an obstetric/AUD medical handoff;
- ordinary reduction-success and self-directed reduction messaging remains suppressed until the safety owner records a structured plan;
- any withdrawal or other emergency feature takes S0/S1 precedence;
- `PREFER_NOT_TO_SAY` does not create or imply a pregnancy state.

### 8.9 Other-substance screen

Collect separately from the weekly AUD item:

- opioids;
- benzodiazepines;
- barbiturates;
- other sedatives or sleep medicines;
- stimulants;
- other nonmedical/recreational drugs;
- none;
- prefer not to say.

Also collect daily/near-daily sedative or opioid use and prior withdrawal symptoms from those substances.

### 8.10 Serious medical context

Collect patient-reported or clinician-entered context for:

- serious cardiovascular disease;
- serious liver disease;
- seizure disorder;
- significant brain/head injury;
- serious current medical illness;
- clinician-directed safety review.

### 8.11 Safety routing

#### S0 — emergency

Any of:

```yaml
- CURRENT_SEIZURE
- SEVERE_CONFUSION_OR_DISORIENTATION
- HALLUCINATIONS_WITH_DISORIENTATION
- DIFFICULTY_REMAINING_CONSCIOUS
- BREATHING_DIFFICULTY
- REPEATED_VOMITING_WITH_SEVERE_ILLNESS
- CURRENT_SUICIDE_ATTEMPT
- CURRENT_SELF_HARM_MEDICAL_EMERGENCY
- EXPLICIT_IMMEDIATE_SUICIDE_PLAN_AND_INTENT_TO_ACT_NOW
```

Result:

```yaml
severity: S0_EMERGENCY
gate: BLOCK_AND_HANDOFF
```

#### S1 — urgent

Any of:

```text
C-SSRS item 4 = YES
OR C-SSRS item 5 = YES
OR suicidal behavior within the previous 3 months

OR hallucinations after RECENT_REDUCTION without severe disorientation

OR prior withdrawal seizure/delirium
   AND RECENT_REDUCTION or PLANNED_MAJOR_REDUCTION

OR RECENT_REDUCTION
   AND at least 2 non-emergency withdrawal symptoms

OR RECENT_REDUCTION
   AND at least 2 major withdrawal-risk factors

OR withdrawal symptoms
   AND current opioid/sedative use or sedative dependence
```

Result:

```yaml
severity: S1_URGENT
gate: BLOCK_AND_HANDOFF
```

#### S2 — priority

Any of:

```text
C-SSRS items 1–3 positive without item 4/5
OR one non-emergency withdrawal symptom after RECENT_REDUCTION
OR one major risk factor plus RECENT_REDUCTION
OR PROLONGED_HEAVY_REGULAR_USE plus PLANNED_MAJOR_REDUCTION
OR UNSURE about prior withdrawal seizure/delirium
OR UNSURE about sedative dependence during a planned reduction
OR pregnant/possibly pregnant plus current alcohol use
OR serious medical condition plus planned major reduction
OR prior withdrawal seizure/delirium without a current reduction
```

Result:

```yaml
severity: S2_PRIORITY
gate: ALLOW_WITH_HANDOFF
```

#### S3 — routine context

Examples:

```yaml
- OTHER_SUBSTANCE_USE_WITHOUT_ACUTE_INTERACTION
- STABLE_MEDICAL_CONDITION
- REMOTE_RESOLVED_SAFETY_HISTORY
```

Result:

```yaml
severity: S3_ROUTINE
gate: ALLOW_MONITORING
clinician_context: true
```

#### Resolver precedence

```text
S0 > S1 > S2 > S3 > S_NONE
```

### 8.12 Gate behavior

`ALLOW_MONITORING` permits ordinary weekly processing.

`ALLOW_WITH_HANDOFF`:

- permits data collection, computation, storage, clinician visibility, and case creation;
- suppresses all ordinary patient intervention delivery by default;
- permits only intervention classes listed in `allowed_subjective_interventions[]`;
- continues prompts unless `monitoring_prompt_policy = PAUSE`.

`BLOCK_AND_HANDOFF`:

- pauses weekly prompts;
- pauses engagement timers;
- suppresses ordinary patient interventions and positive reinforcement;
- preserves history, audit data, and clinician access;
- transfers the patient-facing flow to the safety pathway.

### 8.13 Safety ownership and lifecycle

Owners:

- withdrawal/medical: `MEDICAL_SAFETY_OWNER`;
- suicide/self-harm: `BEHAVIORAL_HEALTH_SAFETY_OWNER` or configured crisis service;
- pregnancy: `OBSTETRIC_MEDICAL_OWNER` plus `AUD_MEDICAL_OWNER` when withdrawal is involved.

Lifecycle:

```text
DETECTED
→ HANDOFF_INITIATED
→ ACKNOWLEDGED
→ CLINICAL_REVIEW_IN_PROGRESS
→ PLAN_ESTABLISHED
→ RESOLVED
```

Emergency alternative:

```text
DETECTED
→ ESCALATED_TO_EMERGENCY
→ RESOLVED_EXTERNAL_HANDOFF
```

Only an authorized safety owner may relax an S0, S1, or S2 gate.

Structured dispositions:

```yaml
- SAFE_TO_CONTINUE_STANDARD_MONITORING
- SAFE_TO_CONTINUE_WITH_RESTRICTIONS
- CONTINUE_CLINICAL_HANDOFF
- EMERGENCY_EXTERNAL_MANAGEMENT
- MONITORING_TEMPORARILY_PAUSED
```

Restrictions may define:

```yaml
allowed_subjective_interventions: []
monitoring_prompt_policy: CONTINUE | PAUSE
goal_change_allowed: boolean
reassessment_due_at: timestamp
```

### 8.14 Safety response targets

```yaml
S0_EMERGENCY:
  system_response: immediate
  maximum_system_response_seconds: 60

S1_URGENT:
  acknowledgement_minutes: 15
  disposition_minutes: 60

S2_PRIORITY:
  acknowledgement_hours: 4
  disposition_business_days: 1

S3_ROUTINE:
  review_business_days: 2
```

S0 and S1 use the safety-delivery channel and never wait for ordinary Level-3 batching.

### 8.15 Safety routing profile

Each deployment maintains a versioned regional routing profile:

```yaml
SafetyRoutingProfile:
  country_or_region: string
  emergency_service: RouteTarget
  crisis_service: RouteTarget
  urgent_medical_service: RouteTarget
  on_call_clinician_queue: RouteTarget
  effective_at: timestamp
  version: integer
```

A `RouteTarget` contains the configured telephone, deep-link, queue, or service identifier appropriate to that deployment. Patient-facing emergency instructions resolve from this profile; the application does not hardcode a universal telephone number. Real-patient operation is blocked unless every route required by the enabled safety workflows is configured and has passed a delivery test.

---

## 9. Weekly questionnaire definition

### 9.1 Instrument identity

```yaml
instrument:
  id: AUD_WEEKLY_CHECKIN
  version: "1.0"
  display_name: Weekly Recovery Check-In
  type: CUSTOM_A_CHESS_BAM_INFORMED
  exact_BAM: false
  exact_A_CHESS_replication: false
```

The patient-facing interface must not claim to administer a validated BAM or A-CHESS instrument.

### 9.2 Common recall instruction

Show once:

> Think only about the completed 7-day period from [Monday, DATE] through [Sunday, DATE] when answering the following questions.

### 9.3 U1 — alcohol use

> During this 7-day period, did you drink any alcohol?

```yaml
item_id: U1
key: alcohol_use_reported
type: BOOLEAN
responses:
  0: NO
  1: YES
```

Derivation:

```text
YES → weekly_alcohol_status = POSITIVE
NO  → weekly_alcohol_status = NEGATIVE
missing → weekly_alcohol_status = UNKNOWN
```

### 9.4 Risk items

#### R1 — sleep difficulty

> During this 7-day period, how much difficulty did you have with your sleep, such as falling asleep, staying asleep, or getting restful sleep?

```yaml
item_id: R1
key: sleep_difficulty
scale: INTEGER_0_7
direction: HIGHER_IS_WORSE
anchors:
  0: No difficulty
  7: Extreme difficulty
```

#### R2 — negative mood

> During this 7-day period, how much were you troubled by negative feelings such as sadness, anxiety, anger, or feeling very upset?

```yaml
item_id: R2
key: negative_mood
scale: INTEGER_0_7
direction: HIGHER_IS_WORSE
anchors:
  0: Not at all
  7: Extremely
```

#### R3 — craving

> During this 7-day period, how strong were your urges or cravings to drink alcohol?

```yaml
item_id: R3
key: craving
scale: INTEGER_0_7
direction: HIGHER_IS_WORSE
anchors:
  0: No urge or craving
  7: Extremely strong urge or craving
```

#### R4 — risky situations

> During this 7-day period, how much were you exposed to situations in which drinking alcohol was tempting or harder to avoid?

```yaml
item_id: R4
key: risky_situations
scale: INTEGER_0_7
direction: HIGHER_IS_WORSE
anchors:
  0: Not at all
  7: Extremely
```

#### R5 — relationship problems

> During this 7-day period, how much were you troubled by problems or conflict in your close relationships?

```yaml
item_id: R5
key: relationship_problems
scale: INTEGER_0_7
direction: HIGHER_IS_WORSE
anchors:
  0: Not at all
  7: Extremely
```

Intermediate values from 1 through 6 are displayed without textual labels.

### 9.5 Protection items

#### P1 — recovery confidence

For `ABSTINENCE`:

> During this 7-day period, how confident were you that you could remain alcohol-free?

For `REDUCTION`:

> During this 7-day period, how confident were you that you could stay within your drinking-reduction goal?

For `UNSURE`:

> During this 7-day period, how confident were you that you could follow the alcohol-related change you currently want to make?

```yaml
item_id: P1
key: recovery_confidence
scale: INTEGER_0_7
direction: HIGHER_IS_BETTER
wording_depends_on: recovery_goal
anchors:
  0: Not at all confident
  7: Completely confident
```

#### P2 — mutual-help participation

> During this 7-day period, how much did you participate in mutual-help or peer-support activities that are part of your recovery, such as AA or another recovery group?

```yaml
item_id: P2
key: mutual_help_participation
scale: INTEGER_0_7
direction: HIGHER_IS_BETTER
anchors:
  0: No participation
  7: Very high participation
```

#### P3 — spiritual activity

> During this 7-day period, how much did spiritual or religious activities support your recovery?

```yaml
item_id: P3
key: spiritual_activity
scale: INTEGER_0_7
direction: HIGHER_IS_BETTER
anchors:
  0: Not at all
  7: Extremely
```

#### P4 — productive/recreational activity

> During this 7-day period, how much did productive or enjoyable activities—such as work, study, exercise, hobbies, volunteering, or recreation—support your recovery?

```yaml
item_id: P4
key: productive_recreational_activity
scale: INTEGER_0_7
direction: HIGHER_IS_BETTER
anchors:
  0: Not at all
  7: Extremely
```

#### P5 — family/friend support

> During this 7-day period, how much support for your recovery did you receive from family or friends?

```yaml
item_id: P5
key: family_friend_support
scale: INTEGER_0_7
direction: HIGHER_IS_BETTER
anchors:
  0: No support
  7: Extremely strong support
```

### 9.6 Display organization

Screen 1 — alcohol use:

- U1

Screen 2 — challenges/risk:

- R1 sleep;
- R2 negative mood;
- R3 craving;
- R4 risky situations;
- R5 relationship problems.

Screen 3 — recovery/protection:

- P1 confidence;
- P2 mutual-help;
- P3 spiritual activity;
- P4 productive/recreational activity;
- P5 family/friend support.

### 9.7 Required items

A normal final weekly submission requires all eleven items:

```yaml
required_items:
  - U1
  - R1
  - R2
  - R3
  - R4
  - R5
  - P1
  - P2
  - P3
  - P4
  - P5
```

Every stored response includes instrument, wording, and scale versions.

---

## 10. Assessment completeness, revisions, and backfill

### 10.1 Completion status

```yaml
AssessmentCompletionStatus:
  - DRAFT
  - PARTIAL
  - COMPLETE
```

A submitted assessment missing one or more required items is `PARTIAL`.

### 10.2 Partial-assessment behavior

- Answered individual items may trigger patient-support-only item rules.
- Aggregates are calculated only when every aggregate item is present.
- Aggregates are never prorated.
- An interaction runs only when all required inputs exist.
- An item-specific delta runs only when the same item exists in consecutive scheduled periods.
- An answered U1 remains a valid weekly alcohol observation.
- A partial assessment cannot create a Level-3 case except when a valid U1 satisfies an enabled abstinence-goal recurrence rule.

### 10.3 Immutable revisions

Submitted revisions are immutable:

```yaml
AssessmentRevision:
  assessment_id: UUID
  revision_number: integer
  answers: object
  submitted_at: timestamp
  submitted_by: PATIENT | CLINICIAN | STAFF | IMPORT
  supersedes_revision_number: integer | null
  is_authoritative: boolean
```

Only one revision is authoritative at a time. Every prior revision remains in the audit trail.

### 10.4 Backfill definition

An assessment is a historical backfill when a newer scheduled period already has an authoritative submission. A late assessment with no newer authoritative assessment is a late current submission, not a backfill.

### 10.5 Backfill effects

Historical backfill:

- is stored and scored;
- updates historical features;
- may recompute later derived states;
- does not deliver patient support for the historical period;
- does not create a clinician notification solely because the historical state would have qualified then.

Backfill may alter a current recurrence condition only when:

1. the current authoritative weekly period is `POSITIVE`;
2. the backfilled period is inside the current four-period window;
3. the updated count reaches the recurrence threshold.

### 10.6 Correction effects

After an authoritative correction:

1. recompute the corrected period;
2. recompute longitudinal state forward;
3. recompute affected reason families;
4. update clinician cases;
5. retain prior derived events with a correction state.

Audit states:

```yaml
- SUPERSEDED_BY_REVISION
- REVOKED_BY_REVISION
```

A patient correction to the latest assessment may deliver newly qualifying current support. A staff-side correction updates state and cases but does not automatically send patient content.

If a correction removes the final valid reason from a clinical case:

```yaml
case_status: RESOLVED_CORRECTION
```

Previously delivered notifications remain in history and receive `alert_update_required = true`.

---

## 11. Weekly scores and context

### 11.1 Complete-assessment scores

```text
risk_score = R1 + R2 + R3 + R4 + R5
range = 0..35

raw_protection_score = P1 + P2 + P3 + P4 + P5
range = 0..35

recovery_progress = raw_protection_score - risk_score
range = -35..+35
```

`recovery_progress` is display, trend, analytics, and future-model data. It never independently triggers an action.

### 11.2 Aggregate labels

```text
risk_score >= 25 → HIGH_RISK
risk_score < 25  → NOT_HIGH

raw_protection_score <= 5  → candidate WEAK_PROTECTION
raw_protection_score >= 25 → candidate STRONG_PROTECTION
otherwise                  → candidate INTERMEDIATE_PROTECTION
```

`NOT_HIGH` does not mean absence of item-level concerns.

### 11.3 Preference-compatible protection interpretation

The raw five-item score is always retained when complete. Operational interpretation accounts for domains excluded by explicit preference.

Applicability values:

```yaml
ProtectionDomainApplicability:
  - OPERATIONALLY_APPLICABLE
  - NOT_APPLICABLE_BY_PREFERENCE
  - UNKNOWN_APPLICABILITY
```

Rules:

- `mutual_help_preference = NONE` makes P2 inapplicable to operational weak/strong classification.
- `spiritual_content_preference = DO_NOT_ALLOW` makes P3 inapplicable.
- No score is renormalized.
- No value is imputed.

Store:

```yaml
operational_protection_domains_observed: integer
operational_protection_domains_total: 5
protection_coverage_ratio: decimal
minimum_possible_protection: integer
maximum_possible_protection: integer
```

For every inapplicable or applicability-unknown domain, the possible value range is `0..7`.

Classification:

```text
maximum_possible_protection <= 5
    → WEAK_PROTECTION

minimum_possible_protection >= 25
    → STRONG_PROTECTION

all five domains applicable and raw score between 6 and 24
    → INTERMEDIATE_PROTECTION

otherwise
    → emit no weak/intermediate/strong protection tag
```

`HIGH_RISK_WEAK_PROTECTION_CONTEXT` fires only when both component tags are present.

---

## 12. Current-state item policy

| Flag | Condition | Patient intent | Clinician visibility |
|---|---|---|---|
| `HIGH_CRAVING` | `craving >= 6` | `CRAVING_COPING_SUPPORT` | Level 2 |
| `HIGH_NEGATIVE_MOOD` | `negative_mood >= 6` | `MOOD_COPING_SUPPORT` | Level 2 |
| `HIGH_RISKY_SITUATIONS` | `risky_situations >= 6` | `TRIGGER_MANAGEMENT_SUPPORT` | Level 2 |
| `HIGH_RELATIONSHIP_PROBLEMS` | `relationship_problems >= 6` | `RELATIONSHIP_COPING_SUPPORT` | Level 2 |
| `LOW_CONFIDENCE` | `recovery_confidence <= 2` | `SELF_EFFICACY_SUPPORT` | Level 2 |
| `LOW_SOCIAL_SUPPORT` | `family_friend_support <= 2` | `SOCIAL_SUPPORT_ACTIVATION` | Level 2 |
| `USE_POSITIVE_CURRENT` | `weekly_alcohol_status = POSITIVE` | `USE_EVENT_RECOVERY_SUPPORT` | Level 2 |

### 12.1 Measurements without autonomous item rules

Sleep difficulty:

- contributes to `risk_score`;
- appears in dashboard context;
- remains available for analytics;
- creates no autonomous patient intent or clinician case.

Mutual-help participation, spiritual activity, and productive/recreational activity:

- contribute to the raw protection score;
- remain contextual;
- create no autonomous low-value rule.

AA/12-step and spiritual content is controlled only by preference, never by a low participation score.

### 12.2 Goal-aware use semantics

Every positive U1 is recorded and may emit neutral `USE_EVENT_RECOVERY_SUPPORT`.

For `ABSTINENCE`:

- a positive period may participate in recurrence rules;
- approved content may use abstinence-compatible lapse language when appropriate.

For `REDUCTION` and `UNSURE`:

- a positive period does not establish goal failure;
- abstinence recurrence rules do not run;
- patient wording remains goal-neutral.

---

## 13. Interaction policy

Individual rules fire first. Interactions may add concrete intents or a clinician reason. There is no numeric severity accumulator and no patient-support urgency tier.

| Interaction | Patient behavior | Clinician behavior |
|---|---|---|
| `HIGH_CRAVING + LOW_CONFIDENCE` | `CRAVING_COPING_SUPPORT` plus optional `SELF_EFFICACY_SUPPORT`, subject to the two-class resolver | `CRAVING_LOW_CONFIDENCE`, Level 3 |
| `HIGH_NEGATIVE_MOOD + HIGH_CRAVING` | `CRAVING_COPING_SUPPORT` plus optional `MOOD_COPING_SUPPORT`, subject to the two-class resolver | `MOOD_CRAVING`, Level 3 |
| `HIGH_RISK + WEAK_PROTECTION` | Emit `HIGH_RISK_WEAK_PROTECTION_CONTEXT`; optionally offer `RECOVERY_PLAN_REVIEW` if a content slot remains | No Level-3 reason |
| `HIGH_RISK + STRONG_PROTECTION` | Emit `HIGH_RISK_STRONG_PROTECTION_CONTEXT`; retain every item-level action | No aggregate escalation |

No dedicated interaction exists for:

- craving plus risky situations;
- risky situations plus low confidence;
- mood plus low social support;
- relationship problems plus low social support;
- sleep plus another variable;
- spiritual activity plus another variable;
- productive activity plus another variable;
- count of abnormal domains.

Those states emit their independent actions.

---

## 14. Longitudinal policy

### 14.1 Features

```text
craving_delta = current_craving - previous_craving
confidence_delta = current_recovery_confidence - previous_recovery_confidence
negative_mood_delta = current_negative_mood - previous_negative_mood
```

Additional state:

```yaml
actionable_flag_streak: map
clearance_count: map
weekly_alcohol_history: sequence
trend_data_valid: boolean
```

Secondary aggregate changes are retained as context:

```text
risk_score_delta
raw_protection_score_delta
recovery_progress_delta
```

They never independently generate patient support or a clinician case.

### 14.2 Delta rules

| Rule | Condition | Patient intent | Clinician behavior |
|---|---|---|---|
| `SHARP_CRAVING_INCREASE` | Consecutive scheduled observations and `craving_delta >= 2` | `CRAVING_COPING_SUPPORT` | No delta-only case |
| `SHARP_CONFIDENCE_DROP` | Consecutive scheduled observations and `confidence_delta <= -2` | `SELF_EFFICACY_SUPPORT` | No delta-only case |
| `SHARP_NEGATIVE_MOOD_INCREASE` | Consecutive scheduled observations and `negative_mood_delta >= 2` | `MOOD_COPING_SUPPORT` | No delta-only case |

A delta is not calculated across a missing period or when the item is absent from either period.

### 14.3 Persistence activation

```yaml
N_PERSIST: 2
```

The first qualifying scheduled period gives `streak = 1`. The immediately following scheduled period must contain the same item and independently meet the same threshold to give `streak = 2` and fire persistence.

A missing scheduled period or missing required item resets the activation streak to zero.

Persistence may create Level 3 only for:

```yaml
PERSISTENT_HIGH_CRAVING: enabled
PERSISTENT_HIGH_NEGATIVE_MOOD: enabled
PERSISTENT_LOW_CONFIDENCE: disabled
```

Risky situations, relationship problems, low social support, sleep, mutual-help participation, spiritual activity, and productive activity never create Level 3 through persistence.

### 14.4 Reason clearance

```yaml
N_CLEAR: 2
```

When a current flag resolves:

- its current patient-support intent stops immediately;
- its persistence or interaction reason enters `CLEARANCE_PENDING`;
- no repeat notification is sent solely for clearance;
- patient support does not continue solely because clearance is pending.

Clearance requires two valid non-qualifying observations. Missing data pauses `clearance_count`; it does not increment, reset, or resolve it.

If the qualifying condition returns during clearance:

```yaml
reason_status: ACTIVE
clearance_count: 0
```

### 14.5 Improvement reinforcement

`POSITIVE_REINFORCEMENT` may fire when:

1. a flag was active in the immediately previous scheduled period;
2. the relevant item is valid in both periods;
3. the flag is inactive in the current period;
4. no scheduled period is missing between them;
5. no current actionable state or use event requires patient support.

At most one reinforcement intent is emitted per assessment.

---

## 15. Recurrent alcohol-use policy

### 15.1 Terminology

- One positive weekly period means reported alcohol use somewhere in that period; it may represent one or more drinking events.
- Multiple positive periods are a recurrent-use pattern.
- Consecutive positive periods are a consecutive-use pattern.
- The system does not infer clinical relapse severity from the Boolean item.

### 15.2 Eligibility

Automatic recurrence processing requires:

```yaml
recovery_goal: ABSTINENCE
current_period_alcohol_status: POSITIVE
```

It is disabled for `REDUCTION` and `UNSURE`.

### 15.3 Consecutive use

```text
CONSECUTIVE_USE_PATTERN:
current scheduled period = POSITIVE
AND immediately previous scheduled period = POSITIVE
```

Action:

```yaml
patient_intents:
  - RECURRENT_USE_RECOVERY_SUPPORT
  - RECOVERY_PLAN_REVIEW
clinical_reason: CONSECUTIVE_USE
tier: LEVEL_3
```

### 15.4 Four-period recurrence

The window is the current scheduled period plus the previous three scheduled periods.

```text
RECURRENT_USE_PATTERN:
current scheduled period = POSITIVE
AND positive_count_in_4_periods >= 2
```

`UNKNOWN` contributes neither positive nor negative. Store `observed_use_periods = n/4`.

Action:

```yaml
patient_intent: RECURRENT_USE_RECOVERY_SUPPORT
clinical_reason: RECURRENT_USE
tier: LEVEL_3
```

If consecutive and rolling rules are both satisfied by the same observations, emit one recurrent-use patient escalation. Both reason calculations may be recorded, but the case resolver sends at most one notification per cycle.

### 15.5 Use after observed stability

```yaml
FIRST_USE_AFTER_OBSERVED_NONUSE_PERIODS: 12
```

`USE_AFTER_STABILITY` requires:

- current scheduled period `POSITIVE`;
- previous 12 scheduled periods all explicitly `NEGATIVE`;
- no missing U1 observation in those 12 periods.

This is a context tag only and does not add clinician severity.

### 15.6 Recurrence clearance

When an active recurrence reason is followed by an explicit negative period:

- current-use state clears immediately;
- the reason enters `CLEARANCE_PENDING`;
- the same old positives remaining inside the four-period window do not re-fire recurrence during a current negative period.

Resolve after two valid negative observations. Missing U1 data pauses the clearance count. A new positive observation returns the reason to `ACTIVE` and resets clearance to zero.

---

## 16. Alcohol-consumption module for REDUCTION

### 16.1 Activation

The alcohol-consumption calendar is mandatory for `REDUCTION` and is not required for `ABSTINENCE` or `UNSURE`.

```yaml
ABSTINENCE:
  weekly_consumption_calendar_required: false

REDUCTION:
  weekly_consumption_calendar_required: true

UNSURE:
  weekly_consumption_calendar_required: false
```

### 16.2 Alcohol unit policy

```yaml
AlcoholUnitPolicy:
  version: "1.0"
  standard_drink_grams_ethanol: 14
  patient_input_precision: 1_decimal_place
```

```text
ethanol_grams = standard_drinks × 14
```

All stored decimal conversions use `ROUND_HALF_UP` at one decimal standard drink.

The UI displays standard-drink examples and may provide a beverage calculator using:

```text
ethanol_grams = volume_ml × (ABV_percent / 100) × 0.789
standard_drinks = ethanol_grams / 14
displayed_standard_drinks = ROUND_HALF_UP(standard_drinks, 1)
```

The calculator retains the unrounded ethanol-gram result and the unit-policy version in provenance.

### 16.3 Reduction baseline

Before a `REDUCTION` goal becomes active, collect the preceding 28 consecutive local calendar days.

Each day is:

```yaml
AlcoholDayStatus:
  - KNOWN_ZERO
  - KNOWN_QUANTITY
  - UNKNOWN
```

The baseline is complete only when all 28 days are known. An incomplete baseline blocks activation. The confirmed baseline is immutable except through an audited correction.

Derived baseline metrics:

```text
baseline_total_standard_drinks_28d
baseline_total_ethanol_grams_28d
baseline_drinking_days_28d
baseline_heavy_drinking_days_28d
baseline_max_standard_drinks_day
baseline_average_drinks_per_drinking_day
baseline_average_weekly_drinks = baseline_total_standard_drinks_28d / 4
```

### 16.4 Quantitative target

Activation requires:

```text
0 < target_weekly_standard_drinks
  < baseline_average_weekly_drinks
```

`target = 0` creates an `ABSTINENCE` goal. A zero baseline cannot produce a `REDUCTION` goal.

```yaml
ReductionGoalVersion:
  goal_version: integer
  baseline_start: local_date
  baseline_end: local_date
  baseline_average_weekly_drinks: decimal
  target_weekly_standard_drinks: decimal
  effective_from_period_id: UUID
  set_by: PATIENT | CLINICIAN | SHARED
  status: DRAFT | PENDING_CLINICAL_SAFETY_REVIEW | ACTIVE | SUSPENDED_SAFETY_HANDOFF | SUPERSEDED | ENDED
```

Goal activation also resolves through the safety gate:

- `ALLOW_MONITORING` activates a complete, valid target;
- `ALLOW_WITH_HANDOFF` stores the target as `PENDING_CLINICAL_SAFETY_REVIEW`, continues measurement, and does not tell the patient to begin reducing until the safety owner permits it;
- `BLOCK_AND_HANDOFF` sets `SUSPENDED_SAFETY_HANDOFF` and transfers control to the safety pathway;
- a safety owner may activate the goal only through a recorded disposition that permits goal change;
- every activation, suspension, and reactivation creates an auditable status transition.

### 16.5 Weekly calendar

For each day in the scheduled weekly period, ask:

> How many standard drinks of alcohol did you have on [DATE]? Enter 0 if you did not drink.

Input is a non-negative decimal with one decimal place.

### 16.6 U1 consistency

Before final submission:

```text
U1 = NO and any daily quantity > 0
    → block submission and request correction

U1 = YES and all seven daily quantities = 0
    → block submission and request correction
```

The system never silently selects one source over the other.

### 16.7 Weekly consumption summary

A complete summary requires seven known days.

```text
weekly_total_standard_drinks
weekly_total_ethanol_grams
drinking_days = count(day > 0)
alcohol_free_days = 7 - drinking_days
average_drinks_per_drinking_day =
    weekly_total_standard_drinks / drinking_days
    or 0 when drinking_days = 0
maximum_daily_standard_drinks
heavy_drinking_days
```

### 16.8 Target status

```text
complete week and weekly_total <= target
    → REDUCTION_TARGET_MET

complete week and weekly_total > target
    → REDUCTION_TARGET_NOT_MET

partial week and known_total > target
    → REDUCTION_TARGET_NOT_MET

partial week and known_total <= target
    → target status absent until complete
```

### 16.9 Reduction percentage

```text
reduction_from_baseline_percent =
  (
    baseline_average_weekly_drinks
    - current_weekly_total_standard_drinks
  )
  / baseline_average_weekly_drinks
  × 100
```

Negative values are retained. The result is calculated only for a complete week.

### 16.10 Target-driven patient behavior

`REDUCTION_TARGET_MET`:

- may emit `POSITIVE_REINFORCEMENT` when no higher-priority current intent exists;
- patient wording states that reported drinking was within the user's goal;
- never states that the patient is recovered.

`REDUCTION_TARGET_NOT_MET`:

- emits `RECOVERY_PLAN_REVIEW`;
- creates a Level-2 visibility flag;
- does not create a Level-3 case by itself;
- never uses relapse, failure, or broken-sobriety language.

No consumption-only V1 rule creates Level 3.

### 16.11 Threshold profile

```yaml
AlcoholThresholdProfile:
  - LOWER_THRESHOLD
  - HIGHER_THRESHOLD
```

Assignment:

- reported female sex profile → `LOWER_THRESHOLD`;
- reported male sex profile → `HIGHER_THRESHOLD`;
- intersex, unknown, or prefer-not-to-say → `LOWER_THRESHOLD`;
- authorized clinician override → audited profile revision.

Thresholds:

| Profile | Heavy day | Heavy week |
|---|---:|---:|
| `LOWER_THRESHOLD` | 4 standard drinks | 8 standard drinks |
| `HIGHER_THRESHOLD` | 5 standard drinks | 15 standard drinks |

`NO_HEAVY_DRINKING_DAYS` means `heavy_drinking_days = 0`. It is context unless explicitly incorporated into the patient's goal plan.

### 16.12 WHO risk-drinking level

Calculate only when the current period and previous three scheduled periods are consecutive and all 28 daily quantities are known.

```text
mean_daily_ethanol_grams = total_ethanol_grams_28d / 28
```

Ranks:

| Rank | Name | `LOWER_THRESHOLD` | `HIGHER_THRESHOLD` |
|---:|---|---:|---:|
| 0 | `ABSTINENT` | `0 g/day` | `0 g/day` |
| 1 | `LOW` | `>0–20 g/day` | `>0–40 g/day` |
| 2 | `MODERATE` | `>20–40 g/day` | `>40–60 g/day` |
| 3 | `HIGH` | `>40–60 g/day` | `>60–100 g/day` |
| 4 | `VERY_HIGH` | `>60 g/day` | `>100 g/day` |

```text
WHO_RDL_CHANGE = baseline_WHO_rank - current_WHO_rank
WHO_TWO_LEVEL_REDUCTION = WHO_RDL_CHANGE >= 2
```

WHO metrics are clinician context, analytics, and future-model features. They do not generate patient drinking recommendations or clinician notifications.

### 16.13 Goal transitions

`REDUCTION → ABSTINENCE`:

- takes effect at the next period boundary;
- retains quantity history;
- archives the reduction goal;
- starts abstinence recurrence counting with the first abstinence-goal period;
- never reinterprets earlier reduction periods as abstinence use events.

`ABSTINENCE → REDUCTION`:

- requires a new `ReductionGoalVersion`;
- uses an existing complete prior 28-day daily record when available;
- otherwise requires the retrospective 28-day baseline.

---

## 17. Patient intervention and content resolver

### 17.1 Intervention meanings

| Intervention class | Purpose |
|---|---|
| `CRAVING_COPING_SUPPORT` | Urge management, alternative activity, relaxation, coping-plan prompts |
| `SELF_EFFICACY_SUPPORT` | Recall coping successes, achievable next steps, goal confidence |
| `MOOD_COPING_SUPPORT` | Stress management, relaxation, safe behavioral activation |
| `TRIGGER_MANAGEMENT_SUPPORT` | Trigger identification, leaving/avoiding when reasonable, if-then planning, coping rehearsal |
| `RELATIONSHIP_COPING_SUPPORT` | Neutral problem-solving and safe support/professional-discussion prompts |
| `SOCIAL_SUPPORT_ACTIVATION` | Use explicitly available and preferred support resources |
| `USE_EVENT_RECOVERY_SUPPORT` | Goal-compatible, nonjudgmental reflection and next-step planning after reported alcohol use |
| `RECURRENT_USE_RECOVERY_SUPPORT` | Broader recovery-plan review for repeated use during an abstinence goal |
| `RECOVERY_PLAN_REVIEW` | Review goals, coping options, triggers, and available protective resources |
| `POSITIVE_REINFORCEMENT` | Brief factual acknowledgement of a resolved flag or met reduction target |

`RELATIONSHIP_COPING_SUPPORT` is limited to neutral communication, boundary-setting, seeking safe support, and discussing concerns with a qualified professional. It does not provide personalized conflict directives. A disclosure of abuse, coercion, stalking, or immediate interpersonal danger stops ordinary relationship content and invokes the configured safety/handoff intake.

### 17.2 Deterministic total priority

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

This priority is a content-delivery ordering rule. It is not a comparative clinical-severity statement.

### 17.3 Delivery cap

```yaml
MAX_INTERVENTION_CLASSES_PER_DELIVERY: 2
```

The resolver emits one primary class and at most one secondary class. Duplicate requests for the same class are merged and retain all reason IDs.

An interaction-generated secondary class may be displaced when a higher-priority current state consumes the second slot.

### 17.4 Follow-up content

Lower-priority compatible content becomes `AVAILABLE_FOLLOWUP`.

- It is shown only when the patient asks for more help or continues the interaction.
- It never creates an autonomous later push.
- Weekly follow-up expires at the next weekly assessment evaluation.
- A corrected authoritative current assessment replaces follow-up generated by the superseded revision.

### 17.5 Resource schema

```yaml
ContentResource:
  resource_id: string
  resource_version_id: string
  intervention_class: InterventionClass
  locale: string
  language: string
  recovery_goals_allowed: []
  delivery_channels: []
  mutual_help_requirement: string
  spiritual_requirement: string
  contraindications: []
  safety_gate_compatibility: []
  estimated_duration: duration
  content_body_reference: string
  review_status: DRAFT | UNDER_REVIEW | APPROVED | RETIRED | REJECTED
  reviewed_by: actor_id
  reviewed_at: timestamp
  effective_from: timestamp
  retired_at: timestamp | null
  enabled: boolean
```

Only `APPROVED` and enabled resources may reach patients.

### 17.6 Eligibility pipeline

```text
candidate resources
→ approved and enabled
→ locale compatible
→ recovery-goal compatible
→ mutual-help/spiritual preference compatible
→ safety-gate compatible
→ contraindication check
→ explicit-refusal suppression
→ delivery-channel compatibility
→ resource cooldown
→ eligible resources
```

No rule bypasses this pipeline.

### 17.7 Deterministic rotation

Choose among eligible resources in this order:

1. a resource explicitly marked helpful, when outside cooldown;
2. a resource never shown before;
3. least recently shown;
4. lowest historical exposure count;
5. lexical `resource_id` order.

### 17.8 Resource cooldown

```yaml
SAME_RESOURCE_COOLDOWN_DAYS: 7
```

Cooldown applies to `resource_id`, not to an intervention class. Another approved resource in the same class may be offered immediately.

If no alternative is eligible, proactive repetition is suppressed. An explicit user request for help may reuse a resource and records:

```yaml
cooldown_override_reason: USER_REQUEST
```

A newly confirmed alcohol-use event may re-offer use-event support.

### 17.9 Refusal behavior

Every resource supports:

```yaml
- DISMISS
- NOT_HELPFUL
- DONT_SHOW_THIS_TYPE
```

`DISMISS` creates no persistent suppression.

`NOT_HELPFUL` suppresses the specific `resource_id` for:

```yaml
NOT_HELPFUL_RESOURCE_SUPPRESSION_DAYS: 14
```

`DONT_SHOW_THIS_TYPE` suppresses the intervention class until the user explicitly changes the preference. It has no automatic expiry.

Notification or channel muting is a separate preference.

### 17.10 Content availability

If every resource is refused, contraindicated, unavailable in the locale, disabled, or on cooldown:

```yaml
content_result: CONTENT_UNAVAILABLE
```

The intent remains logged. The resolver never breaks a safety, preference, contraindication, or approval rule to select fallback content.

### 17.11 Resource-volume gate

Per supported locale:

```yaml
high_frequency_classes_minimum_resources: 3
other_classes_minimum_resources: 2
```

High-frequency classes:

- `CRAVING_COPING_SUPPORT`;
- `SELF_EFFICACY_SUPPORT`;
- `MOOD_COPING_SUPPORT`;
- `TRIGGER_MANAGEMENT_SUPPORT`.

All other classes require two approved resources. A class below its minimum is disabled for patient delivery.

### 17.12 Localization

Every localization is a separately reviewed resource version. Approved English content does not authorize runtime machine translation into another language.

### 17.13 Content audit

Every delivery stores:

```yaml
ContentDeliveryAudit:
  patient_id: UUID
  assessment_or_event_id: UUID
  state_reasons: []
  intervention_class: InterventionClass
  resource_id: string
  resource_version_id: string
  selection_reasons: []
  preference_filters: object
  contraindication_result: object
  cooldown_result: object
  delivered_at: timestamp
  channel: string
  interaction_outcome: string | null
```

---

## 18. Clinician visibility and review policy

### 18.1 Tier vocabulary

| Tier | Meaning | Notification |
|---|---|---|
| Level 0 — Observe | Ordinary data availability | No |
| Level 1 — Patient Support | Automated patient support | No |
| Level 2 — Clinician Visible | Dashboard observation tied to current data | No |
| Level 3 — Clinician Review | Durable non-emergency clinician task | Yes |
| Level 4 — Higher-Priority Review | Capability reserved outside active V1 subjective rules | No automatic V1 rule |

Safety `S0–S3` is a separate namespace and uses a separate delivery channel.

### 18.2 Level-2 flags

Level 2 is a dashboard flag, not a review case.

```yaml
ClinicianVisibilityFlagStatus:
  - CURRENT_ACTIVE
  - CURRENT_CLEARED
  - STALE_DATA_UNAVAILABLE
  - REVOKED_BY_REVISION
```

Behavior:

- A valid current item updates its corresponding flag.
- When the next period passes `due_at` without that item, the prior flag becomes `STALE_DATA_UNAVAILABLE`.
- A partial assessment containing the item updates normally.
- A partial assessment omitting the item makes the prior observation stale after the new period is due.
- A correction recomputes the flag and marks the old flag `REVOKED_BY_REVISION` when no longer supported.

Level-2 flags have no acknowledgement, work-list task, case lifecycle, or outbound notification.

### 18.3 Level-3 whitelist

| Reason | Level-3 behavior |
|---|---|
| `CRAVING_LOW_CONFIDENCE` | Enabled |
| `MOOD_CRAVING` | Enabled |
| `PERSISTENT_HIGH_CRAVING` | Enabled at streak 2 |
| `PERSISTENT_HIGH_NEGATIVE_MOOD` | Enabled at streak 2 |
| `CONSECUTIVE_USE` | Enabled for `ABSTINENCE` |
| `RECURRENT_USE` | Enabled for `ABSTINENCE` |

No other subjective V1 state creates Level 3.

### 18.4 Clinical reason lifecycle

```text
INACTIVE
→ ACTIVE
→ CLEARANCE_PENDING
→ RESOLVED
```

```yaml
ReasonState:
  reason_family: ClinicalReasonFamily
  status: INACTIVE | ACTIVE | CLEARANCE_PENDING | RESOLVED | REVOKED_BY_REVISION
  activated_at_period_id: UUID
  clearance_count: integer
  last_evaluated_period_id: UUID
```

An active reason contributes Level 3. A clearance-pending reason:

- sends no repeat notification solely for pending clearance;
- continues no patient intervention solely because it remains pending;
- keeps the case visible for follow-up.

### 18.5 Clinical review case

At most one clinical subjective-monitoring case may be open per patient.

```yaml
ClinicalReviewCase:
  case_id: UUID
  patient_id: UUID
  active_reason_families: []
  reason_history: []
  lifecycle: NEW | ACKNOWLEDGED | ACTIVE | CLEARANCE_PENDING | RESOLVED | RESOLVED_CORRECTION
  current_tier: LEVEL_3 | NONE
  highest_historical_tier: LEVEL_3
  followup_visibility: boolean
  created_at: timestamp
  acknowledged_at: timestamp | null
  resolved_at: timestamp | null
```

Lifecycle:

```text
NEW → ACKNOWLEDGED → ACTIVE → CLEARANCE_PENDING → RESOLVED
```

If a reason returns during case clearance, the case returns to `ACTIVE`. After `RESOLVED`, a future qualifying assessment creates a new case.

A materially new reason is a Level-3 reason family not previously present in the open case. Re-notify only on:

- a tier increase; or
- a materially new reason.

Do not send repeated unchanged notifications while the case remains open.

### 18.6 Multi-reason behavior

Each reason clears independently. The case closes only when every reason is `RESOLVED` or `REVOKED_BY_REVISION`.

When at least one reason is active:

```yaml
case.lifecycle: ACTIVE
case.current_tier: LEVEL_3
```

When no reason is active and at least one is clearance-pending:

```yaml
case.lifecycle: CLEARANCE_PENDING
case.current_tier: NONE
case.followup_visibility: true
case.highest_historical_tier: LEVEL_3
```

---

## 19. Clinician task and delivery mechanics

### 19.1 Durable task as source of truth

Rule engines never send email, push, or external messages directly.

```text
ReviewCase
→ NotificationBroker
→ durable ClinicianTask
→ optional auxiliary push/email
```

### 19.2 Recipient routing

Order:

1. assigned primary clinician;
2. assigned care-team queue;
3. configured service fallback queue;
4. `SYSTEM_UNROUTED_QUEUE` plus an operational incident.

No review case is discarded.

### 19.3 Delivery states

```yaml
ClinicianDeliveryStatus:
  - PENDING
  - DELIVERED_TASK
  - DELIVERED_WITH_AUXILIARY
  - SUPPRESSED_NO_PERMISSION
  - UNROUTED_CONFIGURATION_ERROR
  - DELIVERY_RETRYING
  - DELIVERY_FAILED_TERMINAL
```

Rule processing always records `CLINICIAN_REVIEW_ELIGIBLE`. Permission failure or delivery failure does not erase eligibility and does not lower or increase the tier.

### 19.4 Retry schedule

Internal task creation attempts occur at:

```yaml
clinician_task_attempt_minutes:
  - 0
  - 1
  - 5
  - 15
```

After the final failed attempt:

```yaml
delivery_status: DELIVERY_FAILED_TERMINAL
operational_incident: true
```

The Level-3 durable-task target is five minutes from eligibility. Missing that target creates an operational incident while retries continue.

Auxiliary push/email may retry at `+5` and `+30` minutes. Failure of an auxiliary channel does not change a successfully created durable task.

### 19.5 Permission behavior

`SUPPRESSED_NO_PERMISSION`:

- preserves the review case and eligibility result;
- sends no outbound delivery;
- does not retry until permission changes.

### 19.6 Bundling

Clinical and engagement cases remain separate. If both become deliverable to the same recipient in one processing cycle, the broker may send one envelope containing both case references.

### 19.7 Safety delivery

S0 and S1 cases use a dedicated safety channel and bypass ordinary Level-3 notification batching. Failure in safety delivery creates an immediate operational incident and activates the configured external emergency/urgent routing behavior.

---

## 20. Engagement and missed-check-in policy

### 20.1 Separation from clinical state

Engagement is an operational subsystem. A missed check-in never fabricates alcohol use or clinical deterioration.

### 20.2 Engagement states

```yaml
EngagementState:
  - ENGAGED
  - OVERDUE
  - AT_RISK_OF_DISENGAGEMENT
  - DISENGAGED
  - RETURNED_AFTER_GAP
  - OPTED_OUT
  - TECHNICAL_FAILURE
```

### 20.3 Timing from effective due time

Every threshold is measured from `effective_due_at`:

```yaml
first_reminder_after_days: 7
second_final_reminder_after_days: 14
level2_visibility_after_days: 14
disengagement_review_after_days: 30
max_automated_reminders_per_missed_cycle: 2
```

Behavior:

| Time | State/action |
|---|---|
| Before `effective_due_at` | `ENGAGED` or awaiting scheduled submission |
| `effective_due_at` passed | `OVERDUE`; no immediate extra message |
| `+7 days` | First neutral reminder |
| `+14 days` | Second/final reminder; `AT_RISK_OF_DISENGAGEMENT`; Level-2 visibility |
| `+30 days` | `DISENGAGED`; create Level-3 engagement case; no third automated message |

### 20.4 Clinical data during gaps

- Current weekly observation is `UNKNOWN` for the missing period.
- Item deltas and persistence activation do not bridge the gap.
- Clearance counts pause.
- Existing clinical cases do not resolve because data disappeared.
- On return, current-state rules run immediately and longitudinal adjacency restarts from the new valid observation.

### 20.5 Engagement case creation

Create an engagement case at `effective_due_at + 30 days` only when:

- no valid weekly submission exists;
- monitoring is active;
- the patient has not opted out;
- no confirmed technical failure covers the cycle;
- no active safety pause covers the cycle.

At most one engagement case may be open per patient.

### 20.6 Engagement lifecycle

```text
NEW
→ ACKNOWLEDGED
→ OUTREACH_IN_PROGRESS
→ RESOLVED_*
```

Terminal statuses:

```yaml
- RESOLVED_RETURNED
- RESOLVED_OPT_OUT
- RESOLVED_PROGRAM_CLOSED
- RESOLVED_TECHNICAL_CORRECTION
```

Any new valid weekly assessment resolves an open engagement case as `RESOLVED_RETURNED`, transitions the patient through `RETURNED_AFTER_GAP`, processes the assessment, and returns engagement to `ENGAGED`.

An explicit opt-out resolves the case as `RESOLVED_OPT_OUT` and suppresses future missing-check-in cases until monitoring is re-enabled.

Administrative program closure resolves it as `RESOLVED_PROGRAM_CLOSED`. The subjective engine never decides discharge.

Repeated disengagement after resolution creates a new case ID.

### 20.7 Separate clinical and engagement cases

```yaml
clinical:
  separate_case: true
  max_open_per_patient: 1

engagement:
  separate_case: true
  max_open_per_patient: 1

cross_case_merging:
  enabled: false

presentation:
  combine_into_patient_worklist_row: true

notifications:
  bundle_same_recipient_same_delivery_cycle: true
```

---

## 21. Technical-failure semantics

### 21.1 Failure types

Notification delivery failure and assessment access failure are separate. Only confirmed assessment access failure pauses engagement timers.

### 21.2 Lifecycle

```text
NONE → SUSPECTED → CONFIRMED → RESOLVED
```

Correction alternative:

```text
CONFIRMED → CORRECTED_FALSE_POSITIVE
```

### 21.3 Automatic confirmation

An access failure may be confirmed by:

1. platform monitoring proving that the assessment endpoint or UI was unavailable to the affected patient/cohort; or
2. a blocking authenticated-client error correlated with a failed backend request/session.

The following do not confirm access failure:

- bounced push notification;
- bounced email;
- unopened notification;
- device offline status;
- patient nonresponse.

### 21.4 Manual confirmation

An authorized operations/support user with `ENGAGEMENT_TECHNICAL_OVERRIDE` may confirm or correct a failure.

Required record:

```yaml
TechnicalFailure:
  failure_id: UUID
  failure_type: string
  affected_patient_or_cohort: object
  started_at: timestamp
  evidence: object
  confirmed_by: actor_id
  confirmed_at: timestamp
  resolved_at: timestamp | null
  status: SUSPECTED | CONFIRMED | RESOLVED | CORRECTED_FALSE_POSITIVE
```

### 21.5 Timer behavior

When confirmed:

- set engagement state to `TECHNICAL_FAILURE`;
- cancel pending missed-check-in messages;
- pause engagement timing;
- suppress engagement escalation;
- leave clinical cases unchanged.

On resolution:

```text
pause_duration = resolved_at - started_at

effective_due_at = max(
  original_due_at + pause_duration,
  resolved_at + 24 hours
)
```

All 7/14/30-day engagement calculations use `effective_due_at`.

### 21.6 False-positive correction

Recompute the current engagement state but do not send a backlog of expired reminders. If an engagement case existed only because of the corrected timing, resolve it as `RESOLVED_TECHNICAL_CORRECTION`.

---

## 22. Use-observation reconciliation

### 22.1 Separate observation from event

The system distinguishes:

- a weekly interval observation;
- a dated daily consumption observation;
- a confirmed real-world use event.

U1 does not establish an episode count or timestamp.

### 22.2 Ledger

```yaml
UseObservationLedgerEntry:
  observation_id: UUID
  patient_id: UUID
  source: WEEKLY_USE_ITEM | CONSUMPTION_CALENDAR | CLINICIAN | PATIENT_CONFIRMATION
  recall_start: timestamp
  recall_end: timestamp
  observed_value: object
  observed_at: timestamp
  assessment_id: UUID | null
  use_event_id: UUID | null
  provenance: object
```

### 22.3 Confirmed event

Create `ConfirmedUseEvent` only when event-level information exists through explicit patient confirmation, a dated consumption record sufficient for the intended event representation, or authorized staff reconciliation.

Weekly Boolean observations are not automatically assigned an event ID.

### 22.4 Candidate linkage

The system may suggest a candidate linkage when:

1. observation intervals overlap or are adjacent within 12 hours; and
2. no explicit negative alcohol observation lies between them.

Candidate linkage never merges records automatically.

Authorized patient or staff confirmation records actor, time, reason, old linkage, and new linkage. Event reconciliation never changes weekly recurrence unless the authoritative weekly U1 itself is corrected.

---

## 23. Data ownership and provenance

| Information | Authoritative owner | Rule |
|---|---|---|
| Current weekly subjective state | Latest authoritative weekly revision | Baseline cannot override it |
| Weekly period identity | Scheduling subsystem | Submission time cannot redefine recall |
| Recovery goal and stable preferences | Versioned profile | Remain until changed at a period boundary |
| Weekly alcohol status | Authoritative U1 | Recurrence uses weekly status only |
| Daily alcohol quantities | Alcohol-consumption ledger | U1 does not overwrite quantity data |
| Reduction baseline/target | `ReductionGoalVersion` | Historical periods use the version effective then |
| Longitudinal state | Trend engine over scheduled-period history | Activation does not bridge missing periods |
| Engagement state | Engagement subsystem | Never becomes clinical risk |
| Clinical case lifecycle | Clinical review subsystem | Separate from content delivery |
| Engagement case lifecycle | Engagement subsystem | Separate from clinical case |
| Safety state and restrictions | Safety subsystem | Highest precedence over patient delivery |
| Content wording/resources | Approved content repository | Rule engine emits class only |
| Delivery status | Notification broker | Never changes rule severity |

Every derived output stores:

```yaml
rule_set_version: subjective_monitoring_v1
instrument_version: "1.0"
configuration_version: string
source_assessment_revision: integer
computed_at: timestamp
reason_ids: []
```

---

## 24. Unified processing pipelines

### 24.1 Weekly evaluation

```text
1. Verify safety gate and prompt policy
2. Resolve scheduled period and authoritative assessment revision
3. Validate item values and COMPLETE/PARTIAL status
4. Store raw responses, schedule version, instrument version, and provenance
5. Derive weekly alcohol status and answered item states
6. Validate reduction-calendar consistency when goal = REDUCTION
7. Compute item-level current flags
8. Compute aggregates only when complete
9. Apply protection applicability and aggregate tags
10. Apply whitelisted interactions when required inputs exist
11. Validate item-specific longitudinal adjacency
12. Compute deltas and persistence activation
13. Compute alcohol recurrence and clearance
14. Compute reduction metrics and target status
15. Generate candidate patient intents
16. Apply total priority, deduplication, two-class cap, safety gate,
    preferences, refusals, contraindications, and cooldown
17. Create AVAILABLE_FOLLOWUP without an autonomous push
18. Update Level-2 dashboard flags
19. Update clinical reason families and clinical case
20. Update engagement state and engagement case separately
21. Create durable clinician tasks and delivery records
22. Persist the final versioned audit record
```

### 24.2 Safety evaluation

```text
1. Store trigger and screen provenance
2. Validate required screen responses
3. Derive S0 conditions
4. Derive S1 conditions
5. Derive S2 conditions
6. Derive S3 context
7. Select highest safety severity
8. Create/update SafetyCase
9. Set SafetyGateStatus and patient-intervention whitelist
10. Apply prompt/engagement pause behavior
11. Deliver through safety channel when S0/S1
12. Persist audit and structured disposition
```

### 24.3 Reduction evaluation

```text
1. Resolve active ReductionGoalVersion
2. Validate seven daily statuses
3. Reconcile U1 with calendar
4. Compute weekly summary when complete
5. Compute immediate NOT_MET when partial known total already exceeds target
6. Compute target status and reduction percentage
7. Compute heavy-day metrics
8. Compute WHO-RDL only from 28 consecutive known days
9. Emit patient intent and Level-2 context
10. Persist summary and provenance
```

### 24.4 Resolver precedence

```text
safety delivery restrictions
> current valid actionable state
> abstinence recurrence
> interaction intents
> delta/persistence support
> reduction target support
> contextual recovery-plan review
> positive reinforcement
```

Safety suppression prevents delivery but never erases the underlying state, intent, or clinician-eligibility result.

---

## 25. V1 configuration registry

```yaml
subjective_monitoring_v1:
  instrument:
    id: AUD_WEEKLY_CHECKIN
    version: "1.0"
    required_items: 11

  weekly_schedule:
    timezone_type: IANA
    start_weekday: MONDAY
    start_local_time: "00:00:00"
    duration_local_calendar_days: 7
    open_at_period_end: true
    due_after_open_hours: 24
    early_final_submission: false

  thresholds:
    high_craving: 6
    high_negative_mood: 6
    high_risky_situations: 6
    high_relationship_problems: 6
    low_confidence: 2
    low_social_support: 2
    high_risk_score: 25
    weak_protection_score: 5
    strong_protection_score: 25

  interactions:
    craving_low_confidence: true
    mood_craving: true
    high_risk_weak_protection_context: true
    high_risk_weak_protection_level3: false
    high_risk_strong_protection_context: true
    abnormality_count_rule: false

  longitudinal:
    sharp_craving_increase: 2
    sharp_confidence_drop: 2
    sharp_negative_mood_increase: 2
    n_persist: 2
    n_clear: 2
    persistent_high_craving_level3: true
    persistent_high_negative_mood_level3: true
    persistent_low_confidence_level3: false
    delta_only_level3: false
    rolling_average_action: false
    personal_baseline_action: false
    volatility_action: false

  recurrent_use:
    enabled_goals:
      - ABSTINENCE
    consecutive_positive_periods: 2
    rolling_positive_count: 2
    rolling_window_periods: 4
    current_positive_required: true
    first_use_after_observed_nonuse_periods: 12
    clearance_valid_negative_observations: 2

  reduction:
    baseline_calendar_days: 28
    baseline_known_days_required: 28
    standard_drink_grams_ethanol: 14
    weekly_calendar_days: 7
    input_decimal_places: 1
    consumption_only_level3: false
    who_window_consecutive_days: 28

  patient_content:
    max_classes_per_delivery: 2
    same_resource_cooldown_days: 7
    not_helpful_resource_suppression_days: 14
    high_frequency_minimum_resources_per_locale: 3
    other_minimum_resources_per_locale: 2
    autonomous_followup_push: false

  clinical_cases:
    max_open_per_patient: 1
    automatic_level4: false
    duplicate_while_open: false
    renotify_on_new_reason: true
    renotify_on_tier_increase: true

  delivery:
    task_target_minutes: 5
    task_attempt_minutes: [0, 1, 5, 15]
    auxiliary_attempt_minutes: [5, 30]
    cross_case_merge: false
    same_cycle_notification_bundle: true

  engagement:
    first_reminder_days_after_effective_due: 7
    second_final_reminder_days_after_effective_due: 14
    reminder_cooldown_days: 7
    level2_days_after_effective_due: 14
    disengagement_case_days_after_effective_due: 30
    max_automated_reminders_per_cycle: 2
    technical_recovery_grace_hours: 24

  use_reconciliation:
    candidate_adjacency_hours: 12
    automatic_event_merge: false

  ema:
    enabled: false
    v1_scope: false
```

---

## 26. Canonical data structures

### 26.1 Scheduled period

```yaml
ScheduledPeriod:
  period_id: UUID
  patient_id: UUID
  schedule_version: string
  monitoring_timezone: IANA_timezone
  period_start: timestamp
  period_end: timestamp
  open_at: timestamp
  original_due_at: timestamp
  effective_due_at: timestamp
  status: SCHEDULED | OPEN | DUE | CLOSED
```

### 26.2 Weekly assessment

```yaml
WeeklyAssessment:
  assessment_id: UUID
  patient_id: UUID
  period_id: UUID
  instrument_id: AUD_WEEKLY_CHECKIN
  instrument_version: "1.0"
  authoritative_revision_number: integer
  completion_status: DRAFT | PARTIAL | COMPLETE
  submitted_at: timestamp | null
  backfill: boolean
```

### 26.3 Alcohol-consumption day

```yaml
AlcoholConsumptionDay:
  patient_id: UUID
  local_date: date
  standard_drinks: decimal | null
  ethanol_grams: decimal | null
  status: KNOWN_ZERO | KNOWN_QUANTITY | UNKNOWN
  source: WEEKLY_RECALL | BASELINE_RECALL | PATIENT_CORRECTION | CLINICIAN_CORRECTION
  assessment_id: UUID | null
  unit_policy_version: "1.0"
```

### 26.4 Weekly consumption summary

```yaml
WeeklyConsumptionSummary:
  patient_id: UUID
  period_id: UUID
  observed_days: integer
  total_standard_drinks: decimal | null
  total_ethanol_grams: decimal | null
  drinking_days: integer | null
  alcohol_free_days: integer | null
  average_drinks_per_drinking_day: decimal | null
  maximum_daily_standard_drinks: decimal | null
  heavy_drinking_days: integer | null
  target_weekly_standard_drinks: decimal
  target_status: MET | NOT_MET | null
  reduction_from_baseline_percent: decimal | null
  completeness: COMPLETE | PARTIAL
  who_risk_rank: 0 | 1 | 2 | 3 | 4 | null
```

### 26.5 Safety case

```yaml
SafetyCase:
  case_id: UUID
  patient_id: UUID
  domain: WITHDRAWAL | SUICIDE | PREGNANCY | POLYSUBSTANCE | MEDICAL | EMERGENCY
  severity: S0_EMERGENCY | S1_URGENT | S2_PRIORITY | S3_ROUTINE
  triggering_reasons: []
  gate_status: SafetyGateStatus
  owner_role: string
  assigned_owner: actor_id | null
  status: DETECTED | HANDOFF_INITIATED | ACKNOWLEDGED | CLINICAL_REVIEW_IN_PROGRESS | PLAN_ESTABLISHED | RESOLVED | ESCALATED_TO_EMERGENCY | RESOLVED_EXTERNAL_HANDOFF
  created_at: timestamp
  acknowledged_at: timestamp | null
  handoff_started_at: timestamp | null
  clinical_plan_at: timestamp | null
  resolved_at: timestamp | null
  allowed_subjective_interventions: []
  monitoring_prompt_policy: CONTINUE | PAUSE
  goal_change_allowed: boolean
  reassessment_due_at: timestamp | null
  resolution: object | null
```

### 26.6 Clinician task

```yaml
ClinicianTask:
  task_id: UUID
  case_type: CLINICAL | ENGAGEMENT | SAFETY
  case_id: UUID
  patient_id: UUID
  recipient_type: PRIMARY_CLINICIAN | CARE_TEAM_QUEUE | FALLBACK_QUEUE | SYSTEM_UNROUTED_QUEUE
  recipient_id: string
  eligibility_recorded_at: timestamp
  created_at: timestamp | null
  delivery_status: ClinicianDeliveryStatus
  attempt_count: integer
  next_attempt_at: timestamp | null
  operational_incident_id: UUID | null
```

---

## 27. V1 disabled logic and invariants

The following behavior must not exist in V1:

- one net recovery score controlling patient or clinician actions;
- direct alert from `risk_score`, `raw_protection_score`, or `recovery_progress` alone;
- weighted interaction equation;
- escalation based on a count of abnormal domains;
- alert because any item worsened once;
- automatic action from rolling averages, volatility, or personal-baseline models;
- treating one positive period as a relapse diagnosis;
- treating missing weekly data as use or abstinence;
- repeated unchanged clinician notifications;
- hard-coded patient wording inside the rule engine;
- AA or spiritual recommendations without matching preference;
- autonomous medication, detoxification, diagnostic, or emergency-treatment instructions;
- automatic Level-4 subjective-monitoring escalation;
- EMA prompts or EMA-derived rules;
- automatic patient content from historical backfill;
- automatic merge of observations into confirmed drinking events;
- consumption-only Level-3 escalation for a reduction goal.

---

## 28. Prototype and real-patient operating modes

### 28.1 Prototype mode

```yaml
prototype_mode:
  permitted_data:
    - SYNTHETIC
    - EXPLICITLY_DEIDENTIFIED_TEST_DATA
  real_patient_delivery: false
  emergency_service_claims: false
```

Prototype mode exercises the complete deterministic architecture without presenting itself as a live clinical service.

### 28.2 Real-patient activation gate

Real-patient mode remains disabled until the deployment has:

- authenticated users and role-based access;
- encryption in transit and at rest;
- auditable privileged access;
- configured retention and deletion behavior;
- configured consent/permission behavior;
- approved content for every enabled class and locale;
- a durable clinician task queue;
- assigned clinical and safety routing;
- location-appropriate emergency, crisis, and urgent medical services;
- tested operational incident handling.

The application must refuse real-patient activation when any required route or protection is absent.

---

## 29. Versioning and audit invariants

1. Raw submissions are immutable.
2. Corrections create revisions.
3. Period definitions are immutable after the period begins.
4. Questionnaire wording and anchors are versioned.
5. Recovery goals and reduction targets are versioned by effective period.
6. Content resources are immutable by version.
7. Derived events are superseded or revoked, never deleted.
8. Historical calculations retain the policy and configuration version used.
9. Delivery records remain separate from rule eligibility.
10. Every manually confirmed safety, technical-failure, event-linkage, and case transition records actor, timestamp, and reason.

---

## 30. Implementation acceptance criteria

An implementation conforms to this specification only when automated tests demonstrate:

1. fixed-period scheduling across local timezone and daylight-saving changes;
2. one assessment identity per period with immutable revisions;
3. correct partial-assessment behavior;
4. no aggregate proration;
5. exact item thresholds and canonical identifiers;
6. preference-compatible protection bounds;
7. interaction behavior under the two-class cap;
8. persistence activation reset across missing periods;
9. clearance pause across missing observations;
10. abstinence-only recurrence with current-positive requirement;
11. no retroactive patient delivery from backfill;
12. complete and partial reduction-calendar behavior;
13. U1/calendar inconsistency blocking;
14. exact heavy-day and WHO-RDL boundary handling;
15. safety precedence and gate suppression;
16. separate Level-2 flags, clinical cases, engagement cases, and safety cases;
17. notification retry, bundling, permission, and failure behavior;
18. exactly two missed-check-in reminders;
19. technical-failure `effective_due_at` recalculation;
20. deterministic content selection, cooldown, refusal, and unavailable-content behavior;
21. immutable audit reconstruction for every decision;
22. V1 EMA feature flag remaining off;
23. real-patient mode refusing activation without required routes and protections.

---

## 31. Source basis

The architecture and measurement constructs are informed by:

- Brief Addiction Monitor constructs;
- A-CHESS Weekly Check-In architecture;
- NIAAA standard-drink, heavy-drinking, AUD, withdrawal, and overdose guidance;
- ASAM Clinical Practice Guideline on Alcohol Withdrawal Management;
- Columbia Suicide Severity Rating Scale healthcare and outpatient triage materials;
- FDA qualification material for WHO alcohol risk-drinking-level reduction;
- WHO alcohol-consumption monitoring guidance.

Primary references:

1. [NIAAA — The Basics: Defining How Much Alcohol Is Too Much](https://www.niaaa.nih.gov/health-professionals-communities/core-resource-on-alcohol/basics-defining-how-much-alcohol-too-much)
2. [NIAAA — Alcohol Use Disorder: From Risk to Diagnosis to Recovery](https://www.niaaa.nih.gov/health-professionals-communities/core-resource-on-alcohol/alcohol-use-disorder-risk-diagnosis-recovery)
3. [NIAAA — Understanding the Dangers of Alcohol Overdose](https://www.niaaa.nih.gov/publications/brochures-and-fact-sheets/understanding-dangers-of-alcohol-overdose)
4. [ASAM — Clinical Practice Guideline on Alcohol Withdrawal Management](https://downloads.asam.org/sitefinity-production-blobs/docs/default-source/quality-science/the_asam_clinical_practice_guideline_on-alcohol-1.pdf?sfvrsn=ba255c2_0)
5. [Columbia Lighthouse Project — Healthcare and Community C-SSRS](https://cssrs.columbia.edu/the-columbia-scale-c-ssrs/cssrs-for-communities-and-healthcare/)
6. [Columbia Lighthouse Project — C-SSRS Triage](https://cssrs.columbia.edu/the-columbia-scale-c-ssrs/triage-c-ssrs/)
7. [FDA — WHO Risk Drinking Levels Qualification Material](https://www.fda.gov/media/131767/download?attachment=)
8. [WHO — International Guide for Monitoring Alcohol Consumption and Related Harm](https://iris.who.int/bitstream/handle/10665/66529/WHO_MSD_MSB_00.4.pdf)

---

**End of V1 Master Specification**
