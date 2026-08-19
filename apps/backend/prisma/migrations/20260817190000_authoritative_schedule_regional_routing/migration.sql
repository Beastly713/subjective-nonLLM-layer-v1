CREATE TYPE "RoutingLifecycle" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');
CREATE TYPE "ScheduleLifecycle" AS ENUM ('ACTIVE', 'PENDING', 'SUPERSEDED');
CREATE TYPE "RoutingTargetKind" AS ENUM ('EMERGENCY_SERVICE', 'CRISIS_SERVICE', 'URGENT_MEDICAL_SERVICE', 'ON_CALL_CLINICIAN_QUEUE');
CREATE TYPE "RoutingTargetRepresentation" AS ENUM ('TELEPHONE', 'DEEP_LINK', 'INTERNAL_QUEUE', 'EXTERNAL_SERVICE');
CREATE TYPE "RoutingTestResult" AS ENUM ('PASS', 'FAIL');

CREATE TABLE "monitoring_schedule_versions" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "monitoring_timezone" VARCHAR(255) NOT NULL,
    "effective_boundary" TIMESTAMPTZ(6) NOT NULL,
    "lifecycle" "ScheduleLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "superseded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "provenance" TEXT,
    CONSTRAINT "monitoring_schedule_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "monitoring_schedule_versions_version_positive" CHECK ("version" > 0)
    ,CONSTRAINT "monitoring_schedule_versions_lifecycle_dates" CHECK (
      ("lifecycle" = 'ACTIVE' AND "superseded_at" IS NULL) OR
      ("lifecycle" = 'PENDING' AND "superseded_at" IS NULL) OR
      ("lifecycle" = 'SUPERSEDED' AND "superseded_at" IS NOT NULL)
    )
);

CREATE TABLE "scheduled_periods" (
    "period_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "schedule_version_id" UUID NOT NULL,
    "monitoring_timezone" VARCHAR(255) NOT NULL,
    "period_start_at" TIMESTAMPTZ(6) NOT NULL,
    "period_end_at" TIMESTAMPTZ(6) NOT NULL,
    "open_at" TIMESTAMPTZ(6) NOT NULL,
    "original_due_at" TIMESTAMPTZ(6) NOT NULL,
    "effective_due_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scheduled_periods_pkey" PRIMARY KEY ("period_id"),
    CONSTRAINT "scheduled_periods_version_positive" CHECK ("version" > 0),
    CONSTRAINT "scheduled_periods_ordered" CHECK ("period_end_at" > "period_start_at"),
    CONSTRAINT "scheduled_periods_open_at_end" CHECK ("open_at" = "period_end_at"),
    CONSTRAINT "scheduled_periods_original_due" CHECK ("original_due_at" = "open_at" + INTERVAL '24 hours'),
    CONSTRAINT "scheduled_periods_effective_due" CHECK ("effective_due_at" > "open_at")
);

CREATE TABLE "period_reschedule_audits" (
    "id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "previous_effective_due" TIMESTAMPTZ(6) NOT NULL,
    "new_effective_due" TIMESTAMPTZ(6) NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "period_reschedule_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monitoring_schedule_versions_patient_version_key" ON "monitoring_schedule_versions"("patient_id", "version");
CREATE INDEX "monitoring_schedule_versions_effective_idx" ON "monitoring_schedule_versions"("patient_id", "effective_boundary", "version");
CREATE UNIQUE INDEX "monitoring_schedule_versions_one_active" ON "monitoring_schedule_versions"("patient_id") WHERE "lifecycle" = 'ACTIVE';
CREATE UNIQUE INDEX "monitoring_schedule_versions_one_pending" ON "monitoring_schedule_versions"("patient_id") WHERE "lifecycle" = 'PENDING';
CREATE UNIQUE INDEX "scheduled_periods_patient_start_key" ON "scheduled_periods"("patient_id", "period_start_at");
CREATE INDEX "scheduled_periods_patient_end_idx" ON "scheduled_periods"("patient_id", "period_end_at");
CREATE INDEX "period_reschedule_audits_period_idx" ON "period_reschedule_audits"("period_id", "occurred_at");

ALTER TABLE "monitoring_schedule_versions" ADD CONSTRAINT "monitoring_schedule_versions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scheduled_periods" ADD CONSTRAINT "scheduled_periods_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scheduled_periods" ADD CONSTRAINT "scheduled_periods_schedule_version_id_fkey" FOREIGN KEY ("schedule_version_id") REFERENCES "monitoring_schedule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "period_reschedule_audits" ADD CONSTRAINT "period_reschedule_audits_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "scheduled_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_scheduled_period_history_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'scheduled periods are historical and cannot be deleted';
  END IF;
  IF NEW."patient_id" IS DISTINCT FROM OLD."patient_id"
     OR NEW."schedule_version_id" IS DISTINCT FROM OLD."schedule_version_id"
     OR NEW."monitoring_timezone" IS DISTINCT FROM OLD."monitoring_timezone"
     OR NEW."period_start_at" IS DISTINCT FROM OLD."period_start_at"
     OR NEW."period_end_at" IS DISTINCT FROM OLD."period_end_at"
     OR NEW."open_at" IS DISTINCT FROM OLD."open_at"
     OR NEW."original_due_at" IS DISTINCT FROM OLD."original_due_at"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'scheduled period historical fields are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "scheduled_period_history_immutable"
BEFORE UPDATE OR DELETE ON "scheduled_periods"
FOR EACH ROW EXECUTE FUNCTION prevent_scheduled_period_history_change();

CREATE FUNCTION protect_monitoring_schedule_version_history() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'schedule versions are historical and cannot be deleted';
  END IF;
  IF OLD."lifecycle" = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'superseded schedule versions are immutable';
  END IF;
  IF NEW."patient_id" IS DISTINCT FROM OLD."patient_id"
     OR NEW."version" IS DISTINCT FROM OLD."version"
     OR NEW."monitoring_timezone" IS DISTINCT FROM OLD."monitoring_timezone"
     OR NEW."effective_boundary" IS DISTINCT FROM OLD."effective_boundary"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
     OR NEW."created_by_user_id" IS DISTINCT FROM OLD."created_by_user_id"
     OR NEW."provenance" IS DISTINCT FROM OLD."provenance" THEN
    RAISE EXCEPTION 'schedule version facts are immutable';
  END IF;
  IF OLD."lifecycle" = 'PENDING' AND NEW."lifecycle" NOT IN ('PENDING', 'ACTIVE', 'SUPERSEDED') THEN
    RAISE EXCEPTION 'pending schedule versions may only remain pending, activate, or be superseded';
  END IF;
  IF OLD."lifecycle" = 'ACTIVE' AND NEW."lifecycle" NOT IN ('ACTIVE', 'SUPERSEDED') THEN
    RAISE EXCEPTION 'active schedule versions may only remain active or be superseded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "monitoring_schedule_version_history_immutable"
BEFORE UPDATE OR DELETE ON "monitoring_schedule_versions"
FOR EACH ROW EXECUTE FUNCTION protect_monitoring_schedule_version_history();

CREATE FUNCTION prevent_period_reschedule_audit_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'period reschedule audits are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "period_reschedule_audits_append_only"
BEFORE UPDATE OR DELETE ON "period_reschedule_audits"
FOR EACH ROW EXECUTE FUNCTION prevent_period_reschedule_audit_change();

CREATE TABLE "regional_routing_profile_versions" (
    "id" UUID NOT NULL,
    "country_code" VARCHAR(2) NOT NULL,
    "region_code" VARCHAR(64),
    "region_key" VARCHAR(128) NOT NULL,
    "logical_version" INTEGER NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "configuration_revision" INTEGER NOT NULL DEFAULT 1,
    "lifecycle" "RoutingLifecycle" NOT NULL DEFAULT 'DRAFT',
    "effective_at" TIMESTAMPTZ(6),
    "superseded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "provenance" TEXT,
    CONSTRAINT "regional_routing_profile_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "regional_routing_profiles_versions_positive" CHECK ("logical_version" > 0 AND "row_version" > 0 AND "configuration_revision" > 0),
    CONSTRAINT "regional_routing_profiles_country_normalized" CHECK ("country_code" = upper("country_code")),
    CONSTRAINT "regional_routing_profiles_lifecycle_dates" CHECK (
      ("lifecycle" = 'DRAFT' AND "effective_at" IS NULL AND "superseded_at" IS NULL) OR
      ("lifecycle" = 'ACTIVE' AND "effective_at" IS NOT NULL AND "superseded_at" IS NULL) OR
      ("lifecycle" = 'SUPERSEDED' AND "effective_at" IS NOT NULL AND "superseded_at" IS NOT NULL)
    )
);

CREATE TABLE "regional_routing_targets" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "kind" "RoutingTargetKind" NOT NULL,
    "representation" "RoutingTargetRepresentation" NOT NULL,
    "target_value" TEXT NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    CONSTRAINT "regional_routing_targets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "regional_routing_test_evidence" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "target_kind" "RoutingTargetKind" NOT NULL,
    "configuration_revision" INTEGER NOT NULL,
    "result" "RoutingTestResult" NOT NULL,
    "provenance" TEXT NOT NULL,
    "tested_at" TIMESTAMPTZ(6) NOT NULL,
    "tested_by_user_id" UUID NOT NULL,
    CONSTRAINT "regional_routing_test_evidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "regional_routing_evidence_revision_positive" CHECK ("configuration_revision" > 0)
);

CREATE UNIQUE INDEX "regional_routing_profiles_region_version_key" ON "regional_routing_profile_versions"("region_key", "logical_version");
CREATE UNIQUE INDEX "regional_routing_profiles_one_active" ON "regional_routing_profile_versions"("region_key") WHERE "lifecycle" = 'ACTIVE';
CREATE INDEX "regional_routing_profiles_lookup_idx" ON "regional_routing_profile_versions"("region_key", "lifecycle", "effective_at");
CREATE UNIQUE INDEX "regional_routing_targets_profile_kind_key" ON "regional_routing_targets"("profile_id", "kind");
CREATE INDEX "regional_routing_evidence_current_idx" ON "regional_routing_test_evidence"("profile_id", "configuration_revision", "target_kind", "tested_at");

ALTER TABLE "regional_routing_targets" ADD CONSTRAINT "regional_routing_targets_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "regional_routing_profile_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "regional_routing_test_evidence" ADD CONSTRAINT "regional_routing_evidence_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "regional_routing_profile_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "regional_routing_test_evidence" ADD CONSTRAINT "regional_routing_evidence_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "regional_routing_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION protect_regional_routing_history() RETURNS trigger AS $$
BEGIN
  IF OLD."lifecycle" = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'superseded routing profiles are immutable';
  END IF;
  IF OLD."lifecycle" = 'ACTIVE' THEN
    IF NEW."lifecycle" <> 'SUPERSEDED'
       OR NEW."country_code" IS DISTINCT FROM OLD."country_code"
       OR NEW."region_code" IS DISTINCT FROM OLD."region_code"
       OR NEW."region_key" IS DISTINCT FROM OLD."region_key"
       OR NEW."logical_version" IS DISTINCT FROM OLD."logical_version"
       OR NEW."configuration_revision" IS DISTINCT FROM OLD."configuration_revision"
       OR NEW."effective_at" IS DISTINCT FROM OLD."effective_at"
       OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
       OR NEW."created_by_user_id" IS DISTINCT FROM OLD."created_by_user_id" THEN
      RAISE EXCEPTION 'active routing profile content is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "regional_routing_profile_history_immutable"
BEFORE UPDATE ON "regional_routing_profile_versions"
FOR EACH ROW EXECUTE FUNCTION protect_regional_routing_history();

CREATE FUNCTION protect_regional_routing_targets() RETURNS trigger AS $$
DECLARE profile_state "RoutingLifecycle";
DECLARE profile_uuid UUID;
BEGIN
  profile_uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD."profile_id" ELSE NEW."profile_id" END;
  SELECT "lifecycle" INTO profile_state
  FROM "regional_routing_profile_versions"
  WHERE "id" = profile_uuid;
  IF profile_state <> 'DRAFT' THEN
    RAISE EXCEPTION 'active or superseded routing targets are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "regional_routing_targets_draft_only"
BEFORE INSERT OR UPDATE OR DELETE ON "regional_routing_targets"
FOR EACH ROW EXECUTE FUNCTION protect_regional_routing_targets();

CREATE FUNCTION prevent_regional_routing_evidence_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'regional routing test evidence is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "regional_routing_test_evidence_append_only"
BEFORE UPDATE OR DELETE ON "regional_routing_test_evidence"
FOR EACH ROW EXECUTE FUNCTION prevent_regional_routing_evidence_change();
