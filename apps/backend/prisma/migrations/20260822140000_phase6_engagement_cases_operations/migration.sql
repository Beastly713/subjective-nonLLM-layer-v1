ALTER TYPE "ClinicianTaskCaseType" ADD VALUE IF NOT EXISTS 'ENGAGEMENT';

ALTER TABLE "engagement_states"
  ADD COLUMN "source_technical_failure_id" UUID;

CREATE TYPE "EngagementCaseLifecycle" AS ENUM (
  'NEW',
  'ACKNOWLEDGED',
  'OUTREACH_IN_PROGRESS',
  'RESOLVED_RETURNED',
  'RESOLVED_OPT_OUT',
  'RESOLVED_PROGRAM_CLOSED',
  'RESOLVED_TECHNICAL_CORRECTION'
);
CREATE TYPE "EngagementCaseEventType" AS ENUM (
  'CASE_CREATED',
  'CASE_ACKNOWLEDGED',
  'OUTREACH_STARTED',
  'CASE_RESOLVED_RETURNED',
  'CASE_RESOLVED_OPT_OUT',
  'CASE_RESOLVED_PROGRAM_CLOSED',
  'CASE_RESOLVED_TECHNICAL_CORRECTION'
);
CREATE TYPE "TechnicalFailureStatus" AS ENUM (
  'SUSPECTED',
  'CONFIRMED',
  'RESOLVED',
  'CORRECTED_FALSE_POSITIVE'
);

CREATE TABLE "engagement_cases" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "lifecycle" "EngagementCaseLifecycle" NOT NULL,
  "case_version" INTEGER NOT NULL DEFAULT 1,
  "source_missed_period_id" UUID NOT NULL,
  "source_effective_due_at" TIMESTAMPTZ(6) NOT NULL,
  "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_at" TIMESTAMPTZ(6),
  "outreach_started_at" TIMESTAMPTZ(6),
  "resolved_at" TIMESTAMPTZ(6),
  "resolution_reason" VARCHAR(128),
  "source_technical_failure_id" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "engagement_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "engagement_cases_patient_fk"
    FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "engagement_cases_period_fk"
    FOREIGN KEY ("source_missed_period_id") REFERENCES "scheduled_periods"("period_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "engagement_cases_version_positive" CHECK ("case_version" > 0)
);

CREATE TABLE "engagement_case_events" (
  "id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "event_type" "EngagementCaseEventType" NOT NULL,
  "from_lifecycle" "EngagementCaseLifecycle",
  "to_lifecycle" "EngagementCaseLifecycle",
  "actor_id" UUID,
  "metadata" JSONB,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "engagement_case_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "engagement_case_events_case_fk"
    FOREIGN KEY ("case_id") REFERENCES "engagement_cases"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "engagement_case_events_patient_fk"
    FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "engagement_case_events_actor_fk"
    FOREIGN KEY ("actor_id") REFERENCES "user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "technical_failures" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "failure_type" VARCHAR(128) NOT NULL,
  "affected_scope" JSONB NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL,
  "evidence" JSONB NOT NULL,
  "status" "TechnicalFailureStatus" NOT NULL,
  "confirmed_by" UUID,
  "confirmed_at" TIMESTAMPTZ(6),
  "resolved_by" UUID,
  "resolved_at" TIMESTAMPTZ(6),
  "corrected_by" UUID,
  "corrected_at" TIMESTAMPTZ(6),
  "reason" TEXT,
  "source_period_id" UUID,
  "previous_effective_due_at" TIMESTAMPTZ(6),
  "recalculated_effective_due_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "technical_failures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "technical_failures_patient_fk"
    FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "technical_failures_period_fk"
    FOREIGN KEY ("source_period_id") REFERENCES "scheduled_periods"("period_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "technical_failures_version_positive" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "engagement_cases_one_open_per_patient"
  ON "engagement_cases"("patient_id")
  WHERE "lifecycle" IN ('NEW', 'ACKNOWLEDGED', 'OUTREACH_IN_PROGRESS');
CREATE INDEX "engagement_cases_patient_lifecycle_idx"
  ON "engagement_cases"("patient_id", "lifecycle");
CREATE INDEX "engagement_cases_patient_updated_idx"
  ON "engagement_cases"("patient_id", "updated_at");
CREATE INDEX "engagement_case_events_case_occurred_idx"
  ON "engagement_case_events"("case_id", "occurred_at");
CREATE INDEX "engagement_case_events_patient_occurred_idx"
  ON "engagement_case_events"("patient_id", "occurred_at");
CREATE UNIQUE INDEX "technical_failures_one_active_per_patient"
  ON "technical_failures"("patient_id")
  WHERE "status" IN ('SUSPECTED', 'CONFIRMED');
CREATE INDEX "technical_failures_patient_status_started_idx"
  ON "technical_failures"("patient_id", "status", "started_at");
CREATE INDEX "technical_failures_source_period_idx"
  ON "technical_failures"("source_period_id");

ALTER TABLE "clinician_tasks"
  DROP CONSTRAINT IF EXISTS "clinician_tasks_case_patient_fk",
  DROP CONSTRAINT IF EXISTS "clinician_tasks_case_fk";
DROP INDEX IF EXISTS "clinician_tasks_case_reason_key";

ALTER TABLE "clinician_tasks"
  ADD COLUMN "task_identity" VARCHAR(128);
UPDATE "clinician_tasks"
SET "task_identity" = "created_reason"::text
WHERE "task_identity" IS NULL;
ALTER TABLE "clinician_tasks"
  ALTER COLUMN "task_identity" SET NOT NULL,
  ALTER COLUMN "created_reason" DROP NOT NULL;

ALTER TABLE "clinician_tasks"
  ADD CONSTRAINT "clinician_tasks_task_identity_nonempty"
  CHECK (length(trim("task_identity")) > 0);

CREATE UNIQUE INDEX "clinician_tasks_case_type_identity_key"
  ON "clinician_tasks"("case_type", "case_id", "task_identity");

CREATE OR REPLACE FUNCTION prevent_phase6_engagement_history_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'engagement case history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER engagement_case_events_append_only
  BEFORE UPDATE OR DELETE ON "engagement_case_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_phase6_engagement_history_change();
