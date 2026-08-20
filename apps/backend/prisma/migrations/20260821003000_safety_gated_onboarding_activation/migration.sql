CREATE TYPE "OnboardingCompletionStatus" AS ENUM (
  'INCOMPLETE',
  'PENDING_SAFETY_REVIEW',
  'SAFETY_HANDOFF',
  'COMPLETE'
);

ALTER TABLE "patient_onboarding_states"
  ADD COLUMN "completion_status" "OnboardingCompletionStatus" NOT NULL DEFAULT 'INCOMPLETE',
  ADD COLUMN "completion_safety_evaluation_result_id" UUID,
  ADD COLUMN "completed_at" TIMESTAMPTZ(6),
  ADD COLUMN "completed_by_user_id" UUID;

ALTER TABLE "patient_onboarding_states"
  ADD CONSTRAINT "patient_onboarding_states_completion_safety_fk"
  FOREIGN KEY ("completion_safety_evaluation_result_id")
  REFERENCES "safety_evaluation_results"("id")
  ON DELETE RESTRICT;

CREATE TYPE "RecoveryGoal" AS ENUM ('ABSTINENCE', 'REDUCTION', 'UNSURE');
CREATE TYPE "RecoveryGoalStatus" AS ENUM (
  'PENDING_CLINICAL_SAFETY_REVIEW',
  'ACTIVE',
  'SUSPENDED_SAFETY_HANDOFF',
  'SUPERSEDED',
  'ENDED'
);
CREATE TYPE "RecoveryGoalSetBy" AS ENUM ('PATIENT', 'CLINICIAN', 'SHARED');

CREATE TABLE "recovery_goal_versions" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "goal_version" INTEGER NOT NULL,
  "goal" "RecoveryGoal" NOT NULL,
  "status" "RecoveryGoalStatus" NOT NULL,
  "baseline_revision_id" UUID,
  "baseline_start" DATE,
  "baseline_end" DATE,
  "baseline_average_weekly_drinks" DECIMAL(12,4),
  "target_weekly_standard_drinks" DECIMAL(12,4),
  "effective_from_period_id" UUID,
  "set_by" "RecoveryGoalSetBy" NOT NULL,
  "source_onboarding_revision_id" UUID NOT NULL,
  "source_safety_evaluation_result_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_user_id" UUID NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_user_id" UUID NOT NULL,
  "provenance" JSONB,
  CONSTRAINT "recovery_goal_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recovery_goal_versions_goal_version_positive" CHECK ("goal_version" > 0),
  CONSTRAINT "recovery_goal_versions_patient_fk"
    FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT,
  CONSTRAINT "recovery_goal_versions_baseline_fk"
    FOREIGN KEY ("baseline_revision_id") REFERENCES "reduction_baseline_revisions"("id") ON DELETE RESTRICT,
  CONSTRAINT "recovery_goal_versions_period_fk"
    FOREIGN KEY ("effective_from_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT,
  CONSTRAINT "recovery_goal_versions_onboarding_fk"
    FOREIGN KEY ("source_onboarding_revision_id") REFERENCES "onboarding_revisions"("id") ON DELETE RESTRICT,
  CONSTRAINT "recovery_goal_versions_safety_fk"
    FOREIGN KEY ("source_safety_evaluation_result_id") REFERENCES "safety_evaluation_results"("id") ON DELETE RESTRICT,
  CONSTRAINT "recovery_goal_versions_patient_version_key" UNIQUE ("patient_id", "goal_version"),
  CONSTRAINT "recovery_goal_versions_goal_data_check" CHECK (
    (
      "goal" = 'REDUCTION'
      AND "baseline_revision_id" IS NOT NULL
      AND "baseline_start" IS NOT NULL
      AND "baseline_end" IS NOT NULL
      AND "baseline_average_weekly_drinks" IS NOT NULL
      AND "target_weekly_standard_drinks" > 0
      AND "target_weekly_standard_drinks" < "baseline_average_weekly_drinks"
    )
    OR (
      "goal" = 'ABSTINENCE'
      AND "target_weekly_standard_drinks" IS NULL
    )
    OR (
      "goal" = 'UNSURE'
      AND "baseline_revision_id" IS NULL
      AND "baseline_start" IS NULL
      AND "baseline_end" IS NULL
      AND "baseline_average_weekly_drinks" IS NULL
      AND "target_weekly_standard_drinks" IS NULL
    )
  ),
  CONSTRAINT "recovery_goal_versions_active_period_check" CHECK (
    "status" <> 'ACTIVE' OR "effective_from_period_id" IS NOT NULL
  )
);

CREATE UNIQUE INDEX "recovery_goal_versions_one_current_per_patient"
ON "recovery_goal_versions"("patient_id")
WHERE "status" IN (
  'PENDING_CLINICAL_SAFETY_REVIEW',
  'ACTIVE',
  'SUSPENDED_SAFETY_HANDOFF'
);
