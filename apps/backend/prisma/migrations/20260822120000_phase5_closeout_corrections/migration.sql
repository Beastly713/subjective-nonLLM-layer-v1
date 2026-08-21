ALTER TYPE "ClinicalCaseTier" ADD VALUE IF NOT EXISTS 'NONE';
ALTER TYPE "ClinicianTaskCaseType" ADD VALUE IF NOT EXISTS 'CLINICAL';

ALTER TABLE "clinician_tasks"
  ADD COLUMN "eligibility_recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "next_attempt_at" TIMESTAMPTZ(6),
  ADD COLUMN "operational_incident_id" UUID;

ALTER TABLE "clinician_tasks"
  ADD CONSTRAINT "clinician_tasks_attempt_count_nonnegative"
  CHECK ("attempt_count" >= 0);

ALTER TABLE "clinician_tasks"
  ADD CONSTRAINT "clinician_tasks_recipient_shape"
  CHECK (
    ("recipient_type" = 'PRIMARY_CLINICIAN' AND "recipient_id" IS NOT NULL)
    OR ("recipient_type" = 'SYSTEM_UNROUTED_QUEUE' AND "recipient_id" IS NULL)
  );

ALTER TABLE "clinician_tasks"
  ADD CONSTRAINT "clinician_tasks_incident_fk"
  FOREIGN KEY ("operational_incident_id") REFERENCES "operational_incidents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "clinician_tasks_operational_incident_idx"
  ON "clinician_tasks"("operational_incident_id");

CREATE UNIQUE INDEX "clinical_review_cases_id_patient_key"
  ON "clinical_review_cases"("id", "patient_id");

ALTER TABLE "clinician_tasks"
  ADD CONSTRAINT "clinician_tasks_case_patient_fk"
  FOREIGN KEY ("case_id", "patient_id")
  REFERENCES "clinical_review_cases"("id", "patient_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clinical_case_events"
  ADD CONSTRAINT "clinical_case_events_case_patient_fk"
  FOREIGN KEY ("case_id", "patient_id")
  REFERENCES "clinical_review_cases"("id", "patient_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_phase5_content_version_change() RETURNS trigger AS $$
BEGIN
  IF OLD."review_status" = 'APPROVED' THEN
    RAISE EXCEPTION 'approved content resource versions are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
