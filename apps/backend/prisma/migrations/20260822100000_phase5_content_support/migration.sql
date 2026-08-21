CREATE TYPE "ContentReviewStatus" AS ENUM ('DRAFT','UNDER_REVIEW','APPROVED','RETIRED','REJECTED');
CREATE TYPE "ContentFeedbackOutcome" AS ENUM ('DISMISS','NOT_HELPFUL','DONT_SHOW_THIS_TYPE','HELPFUL');
CREATE TYPE "ContentSuppressionScope" AS ENUM ('RESOURCE','INTERVENTION_CLASS');
CREATE TYPE "ContentSuppressionReason" AS ENUM ('RESOURCE_NOT_HELPFUL','INTERVENTION_CLASS_DONT_SHOW');
CREATE TYPE "ContentResolutionResult" AS ENUM ('SELECTED','CONTENT_UNAVAILABLE');

CREATE TABLE "content_resources" (
    "id" UUID NOT NULL,
    "intervention_class" "PatientInterventionClass" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    CONSTRAINT "content_resources_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_resources_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "content_resource_versions" (
    "id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "intervention_class" "PatientInterventionClass" NOT NULL,
    "locale" VARCHAR(32) NOT NULL,
    "language" VARCHAR(16) NOT NULL,
    "recovery_goals_allowed" JSONB NOT NULL,
    "delivery_channels" JSONB NOT NULL,
    "mutual_help_requirement" VARCHAR(64) NOT NULL,
    "spiritual_requirement" VARCHAR(64) NOT NULL,
    "contraindications" JSONB NOT NULL,
    "safety_gate_compatibility" JSONB NOT NULL,
    "estimated_duration_seconds" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "markdown_body" TEXT NOT NULL,
    "review_status" "ContentReviewStatus" NOT NULL,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "retired_at" TIMESTAMPTZ(6),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "provenance" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_resource_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_resource_versions_resource_fk" FOREIGN KEY ("resource_id") REFERENCES "content_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_resource_versions_reviewed_by_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_resource_versions_version_positive" CHECK ("version" > 0),
    CONSTRAINT "content_resource_versions_duration_positive" CHECK ("estimated_duration_seconds" > 0),
    CONSTRAINT "content_resource_versions_retirement_order" CHECK ("retired_at" IS NULL OR "retired_at" >= "effective_from")
);

CREATE TABLE "content_feedback" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "resource_version_id" UUID NOT NULL,
    "resolution_id" UUID,
    "outcome" "ContentFeedbackOutcome" NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_feedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_feedback_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_feedback_resource_fk" FOREIGN KEY ("resource_id") REFERENCES "content_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_feedback_version_fk" FOREIGN KEY ("resource_version_id") REFERENCES "content_resource_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "content_suppressions" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "scope" "ContentSuppressionScope" NOT NULL,
    "resource_id" UUID,
    "intervention_class" "PatientInterventionClass",
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "source_feedback_id" UUID,
    "reason" "ContentSuppressionReason" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_suppressions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_suppressions_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_suppressions_resource_fk" FOREIGN KEY ("resource_id") REFERENCES "content_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_suppressions_feedback_fk" FOREIGN KEY ("source_feedback_id") REFERENCES "content_feedback"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_suppressions_scope_values" CHECK (
      ("scope" = 'RESOURCE' AND "resource_id" IS NOT NULL AND "intervention_class" IS NULL)
      OR ("scope" = 'INTERVENTION_CLASS' AND "resource_id" IS NULL AND "intervention_class" IS NOT NULL)
    ),
    CONSTRAINT "content_suppressions_expiry_order" CHECK ("expires_at" IS NULL OR "expires_at" >= "starts_at")
);

CREATE TABLE "content_resolution_records" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "source_assessment_id" UUID NOT NULL,
    "source_assessment_revision_id" UUID NOT NULL,
    "source_evaluation_id" UUID NOT NULL,
    "scheduled_period_id" UUID NOT NULL,
    "resolver_input_version" VARCHAR(64) NOT NULL,
    "content_result" "ContentResolutionResult" NOT NULL,
    "selected_resource_ids" JSONB NOT NULL,
    "selected_resource_version_ids" JSONB NOT NULL,
    "selected_intervention_classes" JSONB NOT NULL,
    "selection_reasons" JSONB NOT NULL,
    "filter_summary" JSONB NOT NULL,
    "cooldown_result" JSONB NOT NULL,
    "effect_result" JSONB NOT NULL,
    "resolved_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "content_resolution_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_resolution_records_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_resolution_records_assessment_fk" FOREIGN KEY ("source_assessment_id") REFERENCES "weekly_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_resolution_records_revision_fk" FOREIGN KEY ("source_assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_resolution_records_evaluation_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_resolution_records_period_fk" FOREIGN KEY ("scheduled_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "available_followups" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "source_evaluation_id" UUID NOT NULL,
    "source_assessment_revision_id" UUID NOT NULL,
    "scheduled_period_id" UUID NOT NULL,
    "intervention_class" "PatientInterventionClass" NOT NULL,
    "resource_id" UUID,
    "resource_version_id" UUID,
    "available_from" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "superseded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "available_followups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "available_followups_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "available_followups_evaluation_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "available_followups_revision_fk" FOREIGN KEY ("source_assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "available_followups_period_fk" FOREIGN KEY ("scheduled_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "available_followups_expiry_order" CHECK ("expires_at" > "available_from")
);

CREATE TABLE "content_delivery_audits" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "source_assessment_id" UUID NOT NULL,
    "source_evaluation_id" UUID NOT NULL,
    "resolution_id" UUID NOT NULL,
    "intent_id" UUID,
    "intervention_class" "PatientInterventionClass" NOT NULL,
    "resource_id" UUID NOT NULL,
    "resource_version_id" UUID NOT NULL,
    "selection_reasons" JSONB NOT NULL,
    "preference_filters" JSONB NOT NULL,
    "contraindication_result" JSONB NOT NULL,
    "cooldown_result" JSONB NOT NULL,
    "delivered_at" TIMESTAMPTZ(6) NOT NULL,
    "channel" VARCHAR(32) NOT NULL,
    "interaction_outcome" VARCHAR(64),
    CONSTRAINT "content_delivery_audits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_delivery_audits_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_delivery_audits_assessment_fk" FOREIGN KEY ("source_assessment_id") REFERENCES "weekly_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_delivery_audits_evaluation_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "assessment_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_delivery_audits_resolution_fk" FOREIGN KEY ("resolution_id") REFERENCES "content_resolution_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_delivery_audits_resource_fk" FOREIGN KEY ("resource_id") REFERENCES "content_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "content_delivery_audits_version_fk" FOREIGN KEY ("resource_version_id") REFERENCES "content_resource_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "content_resource_versions_resource_version_key"
  ON "content_resource_versions"("resource_id", "version");
CREATE INDEX "content_resources_class_created_idx"
  ON "content_resources"("intervention_class", "created_at");
CREATE INDEX "content_resource_versions_eligibility_idx"
  ON "content_resource_versions"("intervention_class", "locale", "review_status", "enabled");
CREATE INDEX "content_feedback_patient_recorded_idx"
  ON "content_feedback"("patient_id", "recorded_at");
CREATE INDEX "content_feedback_patient_resource_idx"
  ON "content_feedback"("patient_id", "resource_id", "recorded_at");
CREATE INDEX "content_suppressions_active_idx"
  ON "content_suppressions"("patient_id", "scope", "ended_at", "expires_at");
CREATE INDEX "content_suppressions_class_idx"
  ON "content_suppressions"("patient_id", "intervention_class", "ended_at");
CREATE INDEX "content_suppressions_resource_idx"
  ON "content_suppressions"("patient_id", "resource_id", "ended_at");
CREATE UNIQUE INDEX "content_resolution_records_source_evaluation_key"
  ON "content_resolution_records"("source_evaluation_id");
CREATE INDEX "content_resolution_records_patient_resolved_idx"
  ON "content_resolution_records"("patient_id", "resolved_at");
CREATE INDEX "content_resolution_records_patient_period_idx"
  ON "content_resolution_records"("patient_id", "scheduled_period_id");
CREATE UNIQUE INDEX "available_followups_evaluation_class_key"
  ON "available_followups"("source_evaluation_id", "intervention_class");
CREATE INDEX "available_followups_patient_active_idx"
  ON "available_followups"("patient_id", "expires_at", "superseded_at");
CREATE UNIQUE INDEX "content_delivery_audits_resolution_resource_key"
  ON "content_delivery_audits"("resolution_id", "resource_id");
CREATE INDEX "content_delivery_audits_patient_resource_idx"
  ON "content_delivery_audits"("patient_id", "resource_id", "delivered_at");

CREATE OR REPLACE FUNCTION prevent_phase5_content_version_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'approved content resource versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_resource_versions_append_only
  BEFORE UPDATE OR DELETE ON "content_resource_versions"
  FOR EACH ROW EXECUTE FUNCTION prevent_phase5_content_version_change();
