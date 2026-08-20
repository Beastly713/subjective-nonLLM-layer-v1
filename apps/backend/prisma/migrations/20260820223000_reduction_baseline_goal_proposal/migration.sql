CREATE TYPE "AlcoholDayStatus" AS ENUM ('KNOWN_ZERO','KNOWN_QUANTITY','UNKNOWN');
CREATE TYPE "AlcoholThresholdProfile" AS ENUM ('LOWER_THRESHOLD','HIGHER_THRESHOLD');
CREATE TYPE "ReductionBaselineLifecycle" AS ENUM ('DRAFT','CONFIRMED');
CREATE TYPE "ReductionProposalKind" AS ENUM ('REDUCTION','ABSTINENCE');

CREATE TABLE "reduction_baseline_revisions" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "lifecycle" "ReductionBaselineLifecycle" NOT NULL DEFAULT 'DRAFT',
    "baseline_start" DATE NOT NULL,
    "baseline_end" DATE NOT NULL,
    "monitoring_timezone" VARCHAR(255) NOT NULL,
    "threshold_profile" "AlcoholThresholdProfile" NOT NULL,
    "threshold_profile_source" VARCHAR(128) NOT NULL,
    "unit_policy_version" VARCHAR(64) NOT NULL,
    "baseline_total_standard_drinks_28d" DECIMAL(12,4),
    "baseline_total_ethanol_grams_28d" DECIMAL(12,4),
    "baseline_drinking_days_28d" INTEGER,
    "baseline_heavy_drinking_days_28d" INTEGER,
    "baseline_max_standard_drinks_day" DECIMAL(12,4),
    "baseline_average_drinks_per_drinking_day" DECIMAL(12,4),
    "baseline_average_weekly_drinks" DECIMAL(12,4),
    "correction_of_revision_id" UUID,
    "correction_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6),
    "confirmed_by_user_id" UUID,
    "provenance" JSONB,
    CONSTRAINT "reduction_baseline_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reduction_baseline_revisions_revision_positive" CHECK ("revision" > 0),
    CONSTRAINT "reduction_baseline_revisions_28_day_window" CHECK ("baseline_end" = "baseline_start" + 27),
    CONSTRAINT "reduction_baseline_revisions_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT,
    CONSTRAINT "reduction_baseline_revisions_correction_fk" FOREIGN KEY ("correction_of_revision_id") REFERENCES "reduction_baseline_revisions"("id") ON DELETE RESTRICT,
    CONSTRAINT "reduction_baseline_revisions_patient_revision_key" UNIQUE ("patient_id", "revision")
);

CREATE UNIQUE INDEX "reduction_baseline_revisions_one_draft_per_patient"
ON "reduction_baseline_revisions"("patient_id")
WHERE "lifecycle" = 'DRAFT';

CREATE TABLE "reduction_setup_states" (
    "patient_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "draft_baseline_revision_id" UUID,
    "authoritative_baseline_revision_id" UUID,
    "proposal_kind" "ReductionProposalKind",
    "target_weekly_standard_drinks" DECIMAL(12,4),
    "proposal_baseline_revision_id" UUID,
    "proposal_updated_at" TIMESTAMPTZ(6),
    "proposal_updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_user_id" UUID NOT NULL,
    CONSTRAINT "reduction_setup_states_pkey" PRIMARY KEY ("patient_id"),
    CONSTRAINT "reduction_setup_states_patient_fk" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT,
    CONSTRAINT "reduction_setup_states_draft_baseline_fk" FOREIGN KEY ("draft_baseline_revision_id") REFERENCES "reduction_baseline_revisions"("id") ON DELETE RESTRICT,
    CONSTRAINT "reduction_setup_states_authoritative_baseline_fk" FOREIGN KEY ("authoritative_baseline_revision_id") REFERENCES "reduction_baseline_revisions"("id") ON DELETE RESTRICT,
    CONSTRAINT "reduction_setup_states_proposal_baseline_fk" FOREIGN KEY ("proposal_baseline_revision_id") REFERENCES "reduction_baseline_revisions"("id") ON DELETE RESTRICT
);

CREATE TABLE "reduction_baseline_days" (
    "id" UUID NOT NULL,
    "baseline_revision_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "status" "AlcoholDayStatus" NOT NULL,
    "standard_drinks" DECIMAL(12,4),
    "ethanol_grams" DECIMAL(12,4),
    "source" VARCHAR(64) NOT NULL,
    "unit_policy_version" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_user_id" UUID NOT NULL,
    CONSTRAINT "reduction_baseline_days_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reduction_baseline_days_revision_fk" FOREIGN KEY ("baseline_revision_id") REFERENCES "reduction_baseline_revisions"("id") ON DELETE RESTRICT,
    CONSTRAINT "reduction_baseline_days_revision_date_key" UNIQUE ("baseline_revision_id", "local_date"),
    CONSTRAINT "reduction_baseline_days_values_check" CHECK (
      ("status" = 'UNKNOWN' AND "standard_drinks" IS NULL AND "ethanol_grams" IS NULL)
      OR ("status" = 'KNOWN_ZERO' AND "standard_drinks" = 0 AND "ethanol_grams" = 0)
      OR ("status" = 'KNOWN_QUANTITY' AND "standard_drinks" > 0 AND "ethanol_grams" > 0 AND "ethanol_grams" = "standard_drinks" * 14)
    )
);

CREATE FUNCTION prevent_confirmed_reduction_baseline_change() RETURNS trigger AS $$
BEGIN
  IF OLD."lifecycle" = 'CONFIRMED' THEN
    RAISE EXCEPTION 'confirmed reduction baseline revisions are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reduction_baseline_revisions_confirmed_immutable"
BEFORE UPDATE OR DELETE ON "reduction_baseline_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_confirmed_reduction_baseline_change();

CREATE FUNCTION prevent_confirmed_reduction_baseline_day_change() RETURNS trigger AS $$
DECLARE
  parent_lifecycle "ReductionBaselineLifecycle";
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT "lifecycle" INTO parent_lifecycle
    FROM "reduction_baseline_revisions"
    WHERE "id" = OLD."baseline_revision_id";
  ELSE
    SELECT "lifecycle" INTO parent_lifecycle
    FROM "reduction_baseline_revisions"
    WHERE "id" = NEW."baseline_revision_id";
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD."baseline_revision_id" IS DISTINCT FROM NEW."baseline_revision_id" THEN
    IF EXISTS (
      SELECT 1
      FROM "reduction_baseline_revisions"
      WHERE "id" = OLD."baseline_revision_id"
        AND "lifecycle" = 'CONFIRMED'
    ) THEN
      RAISE EXCEPTION 'days belonging to a confirmed reduction baseline are immutable';
    END IF;
  END IF;
  IF parent_lifecycle = 'CONFIRMED' THEN
    RAISE EXCEPTION 'days belonging to a confirmed reduction baseline are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reduction_baseline_days_confirmed_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "reduction_baseline_days"
FOR EACH ROW EXECUTE FUNCTION prevent_confirmed_reduction_baseline_day_change();
