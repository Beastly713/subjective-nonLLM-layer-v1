CREATE TYPE "AssessmentEvaluationTrigger" AS ENUM (
  'CURRENT_PATIENT_SUBMISSION',
  'CURRENT_PATIENT_CORRECTION',
  'STAFF_CORRECTION',
  'HISTORICAL_BACKFILL',
  'POLICY_MIGRATION',
  'ADMINISTRATIVE_RECOMPUTE'
);
CREATE TYPE "AssessmentEvaluationLifecycle" AS ENUM (
  'ACTIVE',
  'SUPERSEDED_BY_REVISION',
  'REVOKED_BY_REVISION'
);
CREATE TYPE "UseObservationStatus" AS ENUM ('POSITIVE', 'NEGATIVE', 'UNKNOWN');
CREATE TYPE "StateFlagObservationState" AS ENUM ('ACTIVE', 'CLEAR', 'UNKNOWN');
CREATE TYPE "CurrentStateFlagState" AS ENUM (
  'CURRENT_ACTIVE',
  'CURRENT_CLEARED',
  'STALE_DATA_UNAVAILABLE',
  'REVOKED_BY_REVISION'
);
CREATE TYPE "PatientInterventionClass" AS ENUM (
  'CRAVING_COPING_SUPPORT',
  'SELF_EFFICACY_SUPPORT',
  'MOOD_COPING_SUPPORT',
  'TRIGGER_MANAGEMENT_SUPPORT',
  'RELATIONSHIP_COPING_SUPPORT',
  'SOCIAL_SUPPORT_ACTIVATION',
  'USE_EVENT_RECOVERY_SUPPORT',
  'RECURRENT_USE_RECOVERY_SUPPORT',
  'RECOVERY_PLAN_REVIEW',
  'POSITIVE_REINFORCEMENT'
);
CREATE TYPE "PatientInterventionEffect" AS ENUM (
  'ELIGIBLE',
  'SUPPRESSED_SAFETY',
  'SUPPRESSED_TRIGGER',
  'HISTORICAL_ONLY'
);
CREATE TYPE "WeeklyConsumptionTargetStatus" AS ENUM ('MET', 'NOT_MET', 'UNRESOLVED');

CREATE TABLE "assessment_evaluations" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "assessment_id" UUID NOT NULL,
  "assessment_revision_id" UUID NOT NULL,
  "scheduled_period_id" UUID NOT NULL,
  "trigger" "AssessmentEvaluationTrigger" NOT NULL,
  "lifecycle" "AssessmentEvaluationLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "rule_set_version" VARCHAR(128) NOT NULL,
  "configuration_version" VARCHAR(128) NOT NULL,
  "instrument_version" VARCHAR(64) NOT NULL,
  "recovery_goal_version_id" UUID,
  "preference_version_id" UUID,
  "evaluated_at" TIMESTAMPTZ(6) NOT NULL,
  "input_snapshot" JSONB NOT NULL,
  "result_snapshot" JSONB NOT NULL,
  "derived_state_changes_snapshot" JSONB,
  "effect_plan_snapshot" JSONB,
  "candidate_clinician_reason_families" JSONB NOT NULL,
  CONSTRAINT "assessment_evaluations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assessment_evaluations_revision_trigger_key" UNIQUE ("assessment_revision_id", "trigger"),
  CONSTRAINT "assessment_evaluations_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessment_evaluations_assessment_fk" FOREIGN KEY ("assessment_id") REFERENCES "weekly_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessment_evaluations_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessment_evaluations_period_fk" FOREIGN KEY ("scheduled_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessment_evaluations_goal_fk" FOREIGN KEY ("recovery_goal_version_id") REFERENCES "recovery_goal_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessment_evaluations_preference_fk" FOREIGN KEY ("preference_version_id") REFERENCES "profile_preference_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "assessment_evaluations_patient_evaluated_idx" ON "assessment_evaluations" ("patient_id", "evaluated_at");
CREATE INDEX "assessment_evaluations_period_lifecycle_idx" ON "assessment_evaluations" ("scheduled_period_id", "lifecycle");

CREATE TABLE "use_observation_ledger" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "assessment_id" UUID NOT NULL,
  "assessment_revision_id" UUID NOT NULL,
  "scheduled_period_id" UUID NOT NULL,
  "source" VARCHAR(64) NOT NULL,
  "period_start_at" TIMESTAMPTZ(6) NOT NULL,
  "period_end_at" TIMESTAMPTZ(6) NOT NULL,
  "status" "UseObservationStatus" NOT NULL,
  "observed_at" TIMESTAMPTZ(6) NOT NULL,
  "provenance" JSONB,
  "evaluation_id" UUID,
  CONSTRAINT "use_observation_ledger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "use_observation_ledger_revision_source_key" UNIQUE ("assessment_revision_id", "source"),
  CONSTRAINT "use_observation_ledger_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "use_observation_ledger_assessment_fk" FOREIGN KEY ("assessment_id") REFERENCES "weekly_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "use_observation_ledger_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "use_observation_ledger_period_fk" FOREIGN KEY ("scheduled_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "use_observation_ledger_evaluation_fk" FOREIGN KEY ("evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "use_observation_ledger_patient_period_idx" ON "use_observation_ledger" ("patient_id", "period_start_at");

CREATE TABLE "alcohol_consumption_days" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "scheduled_period_id" UUID NOT NULL,
  "assessment_revision_id" UUID NOT NULL,
  "local_date" DATE NOT NULL,
  "status" "AlcoholDayStatus" NOT NULL,
  "standard_drinks" DECIMAL(12,4),
  "ethanol_grams" DECIMAL(12,4),
  "source" VARCHAR(64) NOT NULL,
  "unit_policy_version" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alcohol_consumption_days_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "alcohol_consumption_days_revision_date_key" UNIQUE ("assessment_revision_id", "local_date"),
  CONSTRAINT "alcohol_consumption_days_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "alcohol_consumption_days_period_fk" FOREIGN KEY ("scheduled_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "alcohol_consumption_days_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "alcohol_consumption_days_values_check" CHECK (
    ("status" = 'UNKNOWN' AND "standard_drinks" IS NULL AND "ethanol_grams" IS NULL)
    OR ("status" = 'KNOWN_ZERO' AND "standard_drinks" = 0 AND "ethanol_grams" = 0)
    OR ("status" = 'KNOWN_QUANTITY' AND "standard_drinks" > 0 AND "ethanol_grams" > 0 AND "ethanol_grams" = "standard_drinks" * 14)
  )
);
CREATE INDEX "alcohol_consumption_days_patient_date_idx" ON "alcohol_consumption_days" ("patient_id", "local_date");

CREATE TABLE "weekly_consumption_summaries" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "scheduled_period_id" UUID NOT NULL,
  "assessment_revision_id" UUID NOT NULL,
  "recovery_goal_version_id" UUID NOT NULL,
  "baseline_revision_id" UUID,
  "observed_day_count" INTEGER NOT NULL,
  "unknown_day_count" INTEGER NOT NULL,
  "coverage_ratio" DECIMAL(8,6) NOT NULL,
  "known_standard_drinks_total" DECIMAL(12,4) NOT NULL,
  "complete_week_total_standard_drinks" DECIMAL(12,4),
  "complete_week_ethanol_grams" DECIMAL(12,4),
  "drinking_days" INTEGER NOT NULL,
  "alcohol_free_days" INTEGER,
  "average_drinks_per_drinking_day" DECIMAL(12,4),
  "maximum_daily_standard_drinks" DECIMAL(12,4),
  "heavy_drinking_days" INTEGER NOT NULL,
  "target_weekly_standard_drinks" DECIMAL(12,4),
  "target_status" "WeeklyConsumptionTargetStatus" NOT NULL,
  "baseline_average_weekly_drinks" DECIMAL(12,4),
  "reduction_from_baseline_percent" DECIMAL(12,4),
  "who_window_complete" BOOLEAN NOT NULL DEFAULT FALSE,
  "who_risk_rank" INTEGER,
  "who_risk_rank_change" INTEGER,
  "who_two_level_reduction" BOOLEAN,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "weekly_consumption_summaries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "weekly_consumption_summaries_revision_key" UNIQUE ("assessment_revision_id"),
  CONSTRAINT "weekly_consumption_summaries_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "weekly_consumption_summaries_period_fk" FOREIGN KEY ("scheduled_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "weekly_consumption_summaries_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "weekly_consumption_summaries_goal_fk" FOREIGN KEY ("recovery_goal_version_id") REFERENCES "recovery_goal_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "weekly_consumption_summaries_baseline_fk" FOREIGN KEY ("baseline_revision_id") REFERENCES "reduction_baseline_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "weekly_consumption_summaries_patient_period_idx" ON "weekly_consumption_summaries" ("patient_id", "scheduled_period_id");

CREATE TABLE "state_flag_observations" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "assessment_revision_id" UUID NOT NULL,
  "scheduled_period_id" UUID NOT NULL,
  "evaluation_id" UUID NOT NULL,
  "flag_key" VARCHAR(64) NOT NULL,
  "state" "StateFlagObservationState" NOT NULL,
  "observed_value" JSONB,
  "observed_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "state_flag_observations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "state_flag_observations_evaluation_flag_key" UNIQUE ("evaluation_id", "flag_key"),
  CONSTRAINT "state_flag_observations_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "state_flag_observations_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "state_flag_observations_period_fk" FOREIGN KEY ("scheduled_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "state_flag_observations_evaluation_fk" FOREIGN KEY ("evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "state_flag_observations_patient_flag_idx" ON "state_flag_observations" ("patient_id", "flag_key", "observed_at");

CREATE TABLE "current_state_flags" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "flag_key" VARCHAR(64) NOT NULL,
  "state" "CurrentStateFlagState" NOT NULL,
  "source_evaluation_id" UUID NOT NULL,
  "source_revision_id" UUID NOT NULL,
  "source_period_id" UUID NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "current_state_flags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "current_state_flags_patient_flag_key" UNIQUE ("patient_id", "flag_key"),
  CONSTRAINT "current_state_flags_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "current_state_flags_evaluation_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "current_state_flags_revision_fk" FOREIGN KEY ("source_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "current_state_flags_period_fk" FOREIGN KEY ("source_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "current_state_flags_patient_state_idx" ON "current_state_flags" ("patient_id", "state");

CREATE TABLE "aggregate_context_records" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "assessment_revision_id" UUID NOT NULL,
  "scheduled_period_id" UUID NOT NULL,
  "evaluation_id" UUID NOT NULL,
  "risk_score" INTEGER,
  "raw_protection_score" INTEGER,
  "recovery_progress" INTEGER,
  "risk_tag" VARCHAR(64),
  "protection_tag" VARCHAR(64),
  "operational_protection_domains_observed" INTEGER NOT NULL,
  "operational_protection_domains_total" INTEGER NOT NULL DEFAULT 5,
  "protection_coverage_ratio" DECIMAL(8,6),
  "minimum_possible_protection" INTEGER,
  "maximum_possible_protection" INTEGER,
  "interaction_tags" JSONB NOT NULL,
  CONSTRAINT "aggregate_context_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aggregate_context_records_evaluation_key" UNIQUE ("evaluation_id"),
  CONSTRAINT "aggregate_context_records_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "aggregate_context_records_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "aggregate_context_records_period_fk" FOREIGN KEY ("scheduled_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "aggregate_context_records_evaluation_fk" FOREIGN KEY ("evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "aggregate_context_records_patient_period_idx" ON "aggregate_context_records" ("patient_id", "scheduled_period_id");

CREATE TABLE "longitudinal_feature_records" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "assessment_revision_id" UUID NOT NULL,
  "scheduled_period_id" UUID NOT NULL,
  "evaluation_id" UUID NOT NULL,
  "craving_delta" INTEGER,
  "confidence_delta" INTEGER,
  "negative_mood_delta" INTEGER,
  "risk_score_delta" INTEGER,
  "raw_protection_score_delta" INTEGER,
  "recovery_progress_delta" INTEGER,
  "persistence_streak_snapshot" JSONB NOT NULL,
  "clearance_reason_state_snapshot" JSONB NOT NULL,
  "consecutive_use" BOOLEAN NOT NULL,
  "recurrent_use" BOOLEAN NOT NULL,
  "use_after_stability" BOOLEAN NOT NULL,
  "trend_data_valid" BOOLEAN NOT NULL,
  CONSTRAINT "longitudinal_feature_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "longitudinal_feature_records_evaluation_key" UNIQUE ("evaluation_id"),
  CONSTRAINT "longitudinal_feature_records_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "longitudinal_feature_records_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "longitudinal_feature_records_period_fk" FOREIGN KEY ("scheduled_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "longitudinal_feature_records_evaluation_fk" FOREIGN KEY ("evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "longitudinal_feature_records_patient_period_idx" ON "longitudinal_feature_records" ("patient_id", "scheduled_period_id");

CREATE TABLE "patient_intervention_intents" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "assessment_revision_id" UUID NOT NULL,
  "scheduled_period_id" UUID NOT NULL,
  "evaluation_id" UUID NOT NULL,
  "intervention_class" "PatientInterventionClass" NOT NULL,
  "source_reasons" JSONB NOT NULL,
  "resolver_metadata" JSONB,
  "effect" "PatientInterventionEffect" NOT NULL,
  "suppression_reason" VARCHAR(255),
  "trigger" "AssessmentEvaluationTrigger" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_intervention_intents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "patient_intervention_intents_evaluation_class_key" UNIQUE ("evaluation_id", "intervention_class"),
  CONSTRAINT "patient_intervention_intents_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "patient_intervention_intents_revision_fk" FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "patient_intervention_intents_period_fk" FOREIGN KEY ("scheduled_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "patient_intervention_intents_evaluation_fk" FOREIGN KEY ("evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "patient_intervention_intents_patient_created_idx" ON "patient_intervention_intents" ("patient_id", "created_at");
