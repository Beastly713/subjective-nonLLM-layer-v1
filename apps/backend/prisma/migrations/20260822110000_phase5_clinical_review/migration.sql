CREATE TYPE "ClinicalReasonFamily" AS ENUM (
  'CRAVING_LOW_CONFIDENCE',
  'MOOD_CRAVING',
  'PERSISTENT_HIGH_CRAVING',
  'PERSISTENT_HIGH_NEGATIVE_MOOD',
  'CONSECUTIVE_USE',
  'RECURRENT_USE'
);
CREATE TYPE "ClinicianVisibilityFlagStatus" AS ENUM (
  'CURRENT_ACTIVE',
  'CURRENT_CLEARED',
  'STALE_DATA_UNAVAILABLE',
  'REVOKED_BY_REVISION'
);
CREATE TYPE "ClinicalReasonStatus" AS ENUM (
  'INACTIVE',
  'ACTIVE',
  'CLEARANCE_PENDING',
  'RESOLVED'
);
CREATE TYPE "ClinicalReasonEffect" AS ENUM (
  'ELIGIBLE',
  'SUPPRESSED_TRIGGER',
  'HISTORICAL_ONLY',
  'REVOKED_BY_REVISION'
);
CREATE TYPE "ClinicalCaseLifecycle" AS ENUM (
  'NEW',
  'ACKNOWLEDGED',
  'ACTIVE',
  'CLEARANCE_PENDING',
  'RESOLVED',
  'RESOLVED_CORRECTION'
);
CREATE TYPE "ClinicalCaseTier" AS ENUM ('LEVEL_3');
CREATE TYPE "ClinicalCaseEventType" AS ENUM (
  'CASE_CREATED',
  'CASE_ACKNOWLEDGED',
  'REASON_ADDED',
  'REASON_CLEARED',
  'REASON_REVOKED',
  'LIFECYCLE_CHANGED',
  'TASK_CREATED',
  'TASK_UPDATE_REQUIRED'
);
CREATE TYPE "ClinicianTaskCaseType" AS ENUM ('SUBJECTIVE_LEVEL_3_REVIEW');
CREATE TYPE "ClinicianTaskRecipientType" AS ENUM (
  'PRIMARY_CLINICIAN',
  'SYSTEM_UNROUTED_QUEUE'
);
CREATE TYPE "ClinicianDeliveryStatus" AS ENUM (
  'DELIVERED',
  'UNROUTED',
  'UPDATE_REQUIRED',
  'ACKNOWLEDGED'
);

CREATE TABLE "clinical_reason_states" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "reason_family" "ClinicalReasonFamily" NOT NULL,
  "status" "ClinicalReasonStatus" NOT NULL,
  "effect" "ClinicalReasonEffect" NOT NULL,
  "source_evaluation_id" UUID,
  "source_revision_id" UUID,
  "source_period_id" UUID,
  "first_active_at" TIMESTAMPTZ(6),
  "last_observed_at" TIMESTAMPTZ(6) NOT NULL,
  "clearance_count" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_reason_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinical_reason_states_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_reason_states_evaluation_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_reason_states_revision_fk" FOREIGN KEY ("source_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_reason_states_period_fk" FOREIGN KEY ("source_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "clinical_reason_history" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "reason_family" "ClinicalReasonFamily" NOT NULL,
  "from_status" "ClinicalReasonStatus",
  "to_status" "ClinicalReasonStatus" NOT NULL,
  "effect" "ClinicalReasonEffect" NOT NULL,
  "source_evaluation_id" UUID,
  "source_revision_id" UUID,
  "source_period_id" UUID,
  "cause" VARCHAR(128) NOT NULL,
  "trigger" "AssessmentEvaluationTrigger" NOT NULL,
  "metadata" JSONB,
  "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_reason_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinical_reason_history_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_reason_history_evaluation_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_reason_history_revision_fk" FOREIGN KEY ("source_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_reason_history_period_fk" FOREIGN KEY ("source_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "clinician_visibility_flags" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "flag_key" VARCHAR(128) NOT NULL,
  "status" "ClinicianVisibilityFlagStatus" NOT NULL,
  "source_evaluation_id" UUID,
  "source_revision_id" UUID,
  "source_period_id" UUID,
  "source_completion_status" "AssessmentRevisionCompletionStatus",
  "source_submitted_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinician_visibility_flags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinician_visibility_flags_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinician_visibility_flags_evaluation_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinician_visibility_flags_revision_fk" FOREIGN KEY ("source_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinician_visibility_flags_period_fk" FOREIGN KEY ("source_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "clinical_review_cases" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "tier" "ClinicalCaseTier" NOT NULL DEFAULT 'LEVEL_3',
  "lifecycle" "ClinicalCaseLifecycle" NOT NULL,
  "case_version" INTEGER NOT NULL DEFAULT 1,
  "active_reason_families" JSONB NOT NULL,
  "clearance_pending_reason_families" JSONB NOT NULL,
  "highest_historical_tier" "ClinicalCaseTier" NOT NULL DEFAULT 'LEVEL_3',
  "followup_visibility" BOOLEAN NOT NULL DEFAULT true,
  "source_evaluation_id" UUID,
  "source_revision_id" UUID,
  "source_period_id" UUID,
  "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  "resolution_reason" VARCHAR(128),
  CONSTRAINT "clinical_review_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinical_review_cases_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_review_cases_evaluation_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_review_cases_revision_fk" FOREIGN KEY ("source_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_review_cases_period_fk" FOREIGN KEY ("source_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "clinical_case_events" (
  "id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "event_type" "ClinicalCaseEventType" NOT NULL,
  "from_lifecycle" "ClinicalCaseLifecycle",
  "to_lifecycle" "ClinicalCaseLifecycle",
  "reason_family" "ClinicalReasonFamily",
  "source_evaluation_id" UUID,
  "source_revision_id" UUID,
  "source_period_id" UUID,
  "actor_id" UUID,
  "metadata" JSONB,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_case_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinical_case_events_case_fk" FOREIGN KEY ("case_id") REFERENCES "clinical_review_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_case_events_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_case_events_evaluation_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_case_events_revision_fk" FOREIGN KEY ("source_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_case_events_period_fk" FOREIGN KEY ("source_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinical_case_events_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "clinician_tasks" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "case_type" "ClinicianTaskCaseType" NOT NULL,
  "recipient_type" "ClinicianTaskRecipientType" NOT NULL,
  "recipient_id" UUID,
  "delivery_status" "ClinicianDeliveryStatus" NOT NULL,
  "created_reason" "ClinicalReasonFamily" NOT NULL,
  "source_evaluation_id" UUID,
  "source_revision_id" UUID,
  "source_period_id" UUID,
  "title" VARCHAR(255) NOT NULL,
  "detail" JSONB,
  "alert_update_required" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinician_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinician_tasks_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinician_tasks_case_fk" FOREIGN KEY ("case_id") REFERENCES "clinical_review_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinician_tasks_recipient_fk" FOREIGN KEY ("recipient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinician_tasks_evaluation_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinician_tasks_revision_fk" FOREIGN KEY ("source_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clinician_tasks_period_fk" FOREIGN KEY ("source_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "clinical_reason_states_patient_family_key"
  ON "clinical_reason_states"("patient_id", "reason_family");
CREATE INDEX "clinical_reason_states_patient_status_idx"
  ON "clinical_reason_states"("patient_id", "status");
CREATE INDEX "clinical_reason_history_patient_family_idx"
  ON "clinical_reason_history"("patient_id", "reason_family", "recorded_at");
CREATE INDEX "clinical_reason_history_patient_recorded_idx"
  ON "clinical_reason_history"("patient_id", "recorded_at");
CREATE UNIQUE INDEX "clinician_visibility_flags_patient_flag_key"
  ON "clinician_visibility_flags"("patient_id", "flag_key");
CREATE INDEX "clinician_visibility_flags_patient_status_idx"
  ON "clinician_visibility_flags"("patient_id", "status");
CREATE UNIQUE INDEX "clinical_review_cases_one_open_per_patient"
  ON "clinical_review_cases"("patient_id")
  WHERE "lifecycle" IN ('NEW', 'ACKNOWLEDGED', 'ACTIVE', 'CLEARANCE_PENDING');
CREATE INDEX "clinical_review_cases_patient_lifecycle_idx"
  ON "clinical_review_cases"("patient_id", "lifecycle");
CREATE INDEX "clinical_review_cases_patient_updated_idx"
  ON "clinical_review_cases"("patient_id", "updated_at");
CREATE INDEX "clinical_case_events_case_occurred_idx"
  ON "clinical_case_events"("case_id", "occurred_at");
CREATE INDEX "clinical_case_events_patient_occurred_idx"
  ON "clinical_case_events"("patient_id", "occurred_at");
CREATE UNIQUE INDEX "clinician_tasks_case_reason_key"
  ON "clinician_tasks"("case_id", "created_reason");
CREATE INDEX "clinician_tasks_recipient_status_idx"
  ON "clinician_tasks"("recipient_id", "delivery_status", "created_at");
CREATE INDEX "clinician_tasks_patient_created_idx"
  ON "clinician_tasks"("patient_id", "created_at");

CREATE OR REPLACE FUNCTION prevent_phase5_clinical_history_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'clinical reason and case history are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clinical_reason_history_append_only
  BEFORE UPDATE OR DELETE ON "clinical_reason_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_phase5_clinical_history_change();

CREATE TRIGGER clinical_case_events_append_only
  BEFORE UPDATE OR DELETE ON "clinical_case_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_phase5_clinical_history_change();
