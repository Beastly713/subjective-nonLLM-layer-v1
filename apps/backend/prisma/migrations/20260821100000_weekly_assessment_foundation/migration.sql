CREATE TYPE "AssessmentCompletionStatus" AS ENUM ('DRAFT', 'PARTIAL', 'COMPLETE');
CREATE TYPE "AssessmentRevisionCompletionStatus" AS ENUM ('PARTIAL', 'COMPLETE');
CREATE TYPE "AssessmentActorType" AS ENUM ('PATIENT', 'CLINICIAN', 'STAFF', 'IMPORT');

CREATE TABLE "weekly_assessments" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "scheduled_period_id" UUID NOT NULL,
    "instrument_id" VARCHAR(128) NOT NULL,
    "instrument_version" VARCHAR(64) NOT NULL,
    "draft_version" INTEGER NOT NULL DEFAULT 0,
    "draft_current_step" VARCHAR(64) NOT NULL,
    "draft_answer_snapshot" JSONB NOT NULL,
    "draft_consumption_snapshot" JSONB,
    "completion_status" "AssessmentCompletionStatus" NOT NULL DEFAULT 'DRAFT',
    "authoritative_revision_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_user_id" UUID NOT NULL,
    CONSTRAINT "weekly_assessments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "weekly_assessments_draft_version_nonnegative" CHECK ("draft_version" >= 0),
    CONSTRAINT "weekly_assessments_patient_period_instrument_key" UNIQUE ("patient_id", "scheduled_period_id", "instrument_id", "instrument_version")
);

CREATE TABLE "assessment_revisions" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "completion_status" "AssessmentRevisionCompletionStatus" NOT NULL,
    "source_draft_version" INTEGER NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_by" "AssessmentActorType" NOT NULL,
    "submitted_by_user_id" UUID NOT NULL,
    "supersedes_revision_id" UUID,
    "submission_classification" VARCHAR(64) NOT NULL,
    "instrument_version" VARCHAR(64) NOT NULL,
    "wording_version" VARCHAR(64) NOT NULL,
    "rule_set_version" VARCHAR(128) NOT NULL,
    "configuration_version" VARCHAR(128) NOT NULL,
    "provenance" JSONB,
    CONSTRAINT "assessment_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_revisions_revision_positive" CHECK ("revision_number" > 0),
    CONSTRAINT "assessment_revisions_source_draft_version_nonnegative" CHECK ("source_draft_version" >= 0),
    CONSTRAINT "assessment_revisions_assessment_revision_key" UNIQUE ("assessment_id", "revision_number")
);

CREATE TABLE "assessment_item_responses" (
    "id" UUID NOT NULL,
    "assessment_revision_id" UUID NOT NULL,
    "item_id" VARCHAR(64) NOT NULL,
    "item_key" VARCHAR(128) NOT NULL,
    "boolean_value" BOOLEAN,
    "integer_value" INTEGER,
    "instrument_version" VARCHAR(64) NOT NULL,
    "wording_version" VARCHAR(64) NOT NULL,
    "scale_version" VARCHAR(64) NOT NULL,
    CONSTRAINT "assessment_item_responses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_item_responses_one_typed_value" CHECK (
      (CASE WHEN "boolean_value" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "integer_value" IS NOT NULL THEN 1 ELSE 0 END) = 1
    ),
    CONSTRAINT "assessment_item_responses_integer_range" CHECK (
      "integer_value" IS NULL OR "integer_value" BETWEEN 0 AND 7
    ),
    CONSTRAINT "assessment_item_responses_revision_item_key" UNIQUE ("assessment_revision_id", "item_id")
);

CREATE UNIQUE INDEX "weekly_assessments_authoritative_revision_key"
ON "weekly_assessments"("authoritative_revision_id");
CREATE INDEX "weekly_assessments_patient_period_idx"
ON "weekly_assessments"("patient_id", "scheduled_period_id");
CREATE INDEX "assessment_revisions_assessment_submitted_idx"
ON "assessment_revisions"("assessment_id", "submitted_at");

ALTER TABLE "weekly_assessments"
  ADD CONSTRAINT "weekly_assessments_patient_fk"
  FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "weekly_assessments"
  ADD CONSTRAINT "weekly_assessments_period_fk"
  FOREIGN KEY ("scheduled_period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "weekly_assessments"
  ADD CONSTRAINT "weekly_assessments_authoritative_revision_fk"
  FOREIGN KEY ("authoritative_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_revisions"
  ADD CONSTRAINT "assessment_revisions_assessment_fk"
  FOREIGN KEY ("assessment_id") REFERENCES "weekly_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_revisions"
  ADD CONSTRAINT "assessment_revisions_supersedes_fk"
  FOREIGN KEY ("supersedes_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_item_responses"
  ADD CONSTRAINT "assessment_item_responses_revision_fk"
  FOREIGN KEY ("assessment_revision_id") REFERENCES "assessment_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
