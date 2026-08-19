CREATE TABLE "patient_onboarding_states" (
  "patient_id" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "current_step" VARCHAR(64) NOT NULL,
  "draft_responses" JSONB NOT NULL, "authoritative_revision_id" UUID, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_user_id" UUID NOT NULL, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_by_user_id" UUID NOT NULL,
  CONSTRAINT "patient_onboarding_states_pkey" PRIMARY KEY ("patient_id"), CONSTRAINT "patient_onboarding_states_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT
);
CREATE TABLE "onboarding_revisions" (
  "id" UUID NOT NULL, "patient_id" UUID NOT NULL, "revision" INTEGER NOT NULL, "source_draft_version" INTEGER NOT NULL, "response_snapshot" JSONB NOT NULL,
  "audit_c_instrument" VARCHAR(128) NOT NULL, "audit_c_version" VARCHAR(64) NOT NULL, "audit_c_source" TEXT NOT NULL, "schema_version" VARCHAR(64) NOT NULL,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "submitting_actor_id" UUID NOT NULL, "provenance" JSONB,
  CONSTRAINT "onboarding_revisions_pkey" PRIMARY KEY ("id"), CONSTRAINT "onboarding_revisions_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT,
  CONSTRAINT "onboarding_revisions_patient_revision_key" UNIQUE ("patient_id", "revision")
);
ALTER TABLE "patient_onboarding_states" ADD CONSTRAINT "patient_onboarding_states_revision_fk" FOREIGN KEY ("authoritative_revision_id") REFERENCES "onboarding_revisions"("id") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "patient_onboarding_states_authoritative_revision_key" ON "patient_onboarding_states"("authoritative_revision_id");
CREATE TABLE "safety_input_revisions" (
  "id" UUID NOT NULL, "patient_id" UUID NOT NULL, "revision" INTEGER NOT NULL, "source_onboarding_revision_id" UUID, "input_snapshot" JSONB NOT NULL,
  "instrument" VARCHAR(128) NOT NULL, "instrument_version" VARCHAR(64) NOT NULL, "instrument_source" TEXT NOT NULL, "schema_version" VARCHAR(64) NOT NULL,
  "trigger" VARCHAR(64) NOT NULL, "actor_id" UUID NOT NULL, "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "safety_input_revisions_pkey" PRIMARY KEY ("id"), CONSTRAINT "safety_input_revisions_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT,
  CONSTRAINT "safety_input_revisions_onboarding_fk" FOREIGN KEY ("source_onboarding_revision_id") REFERENCES "onboarding_revisions"("id") ON DELETE RESTRICT,
  CONSTRAINT "safety_input_revisions_patient_revision_key" UNIQUE ("patient_id", "revision")
);
CREATE TABLE "safety_evaluation_results" (
  "id" UUID NOT NULL, "patient_id" UUID NOT NULL, "safety_input_revision_id" UUID NOT NULL, "severity" VARCHAR(32) NOT NULL, "gate_status" VARCHAR(32) NOT NULL,
  "reason_codes" JSONB NOT NULL, "safety_domain" VARCHAR(64), "owner_role" VARCHAR(64), "clinician_context" BOOLEAN NOT NULL,
  "allowed_subjective_interventions" JSONB NOT NULL, "monitoring_prompt_policy" VARCHAR(32) NOT NULL, "goal_change_allowed" BOOLEAN NOT NULL,
  "reassessment_due_at" TIMESTAMPTZ(6), "evaluator_version" VARCHAR(64) NOT NULL, "configuration_version" VARCHAR(64) NOT NULL,
  "evaluated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "result_snapshot" JSONB,
  CONSTRAINT "safety_evaluation_results_pkey" PRIMARY KEY ("id"), CONSTRAINT "safety_evaluation_results_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT,
  CONSTRAINT "safety_evaluation_results_input_fk" FOREIGN KEY ("safety_input_revision_id") REFERENCES "safety_input_revisions"("id") ON DELETE RESTRICT
);
CREATE OR REPLACE FUNCTION prevent_phase3_history_change() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'phase 3 historical records are immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER onboarding_revisions_append_only BEFORE UPDATE OR DELETE ON "onboarding_revisions" FOR EACH ROW EXECUTE FUNCTION prevent_phase3_history_change();
CREATE TRIGGER safety_input_revisions_append_only BEFORE UPDATE OR DELETE ON "safety_input_revisions" FOR EACH ROW EXECUTE FUNCTION prevent_phase3_history_change();
CREATE TRIGGER safety_evaluation_results_append_only BEFORE UPDATE OR DELETE ON "safety_evaluation_results" FOR EACH ROW EXECUTE FUNCTION prevent_phase3_history_change();
