ALTER TABLE "content_resource_versions"
  ADD COLUMN "row_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "content_resource_versions"
  ADD CONSTRAINT "content_resource_versions_row_version_positive"
  CHECK ("row_version" > 0);

DROP TRIGGER IF EXISTS content_resource_versions_append_only ON "content_resource_versions";
DROP FUNCTION IF EXISTS prevent_phase5_content_version_change();

CREATE OR REPLACE FUNCTION enforce_phase7_content_version_lifecycle() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'content resource versions cannot be deleted';
  END IF;

  IF NEW."resource_id" IS DISTINCT FROM OLD."resource_id"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR NEW."row_version" <> OLD."row_version" + 1
  THEN
    RAISE EXCEPTION 'content resource identity or row version is invalid';
  END IF;

  IF OLD."review_status" = 'DRAFT'::"ContentReviewStatus" THEN
    IF NEW."review_status" NOT IN ('DRAFT'::"ContentReviewStatus", 'UNDER_REVIEW'::"ContentReviewStatus") THEN
      RAISE EXCEPTION 'draft content may only remain draft or enter review';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."review_status" = 'UNDER_REVIEW'::"ContentReviewStatus" THEN
    IF NEW."review_status" NOT IN ('UNDER_REVIEW'::"ContentReviewStatus", 'APPROVED'::"ContentReviewStatus", 'REJECTED'::"ContentReviewStatus") THEN
      RAISE EXCEPTION 'content under review has an invalid lifecycle transition';
    END IF;
  ELSIF OLD."review_status" = 'APPROVED'::"ContentReviewStatus" THEN
    IF NEW."review_status" <> 'RETIRED'::"ContentReviewStatus" THEN
      RAISE EXCEPTION 'approved content may only be retired';
    END IF;
  ELSE
    RAISE EXCEPTION 'rejected and retired content is immutable';
  END IF;

  IF NEW."intervention_class" IS DISTINCT FROM OLD."intervention_class"
    OR NEW."locale" IS DISTINCT FROM OLD."locale"
    OR NEW."language" IS DISTINCT FROM OLD."language"
    OR NEW."recovery_goals_allowed" IS DISTINCT FROM OLD."recovery_goals_allowed"
    OR NEW."delivery_channels" IS DISTINCT FROM OLD."delivery_channels"
    OR NEW."mutual_help_requirement" IS DISTINCT FROM OLD."mutual_help_requirement"
    OR NEW."spiritual_requirement" IS DISTINCT FROM OLD."spiritual_requirement"
    OR NEW."contraindications" IS DISTINCT FROM OLD."contraindications"
    OR NEW."safety_gate_compatibility" IS DISTINCT FROM OLD."safety_gate_compatibility"
    OR NEW."estimated_duration_seconds" IS DISTINCT FROM OLD."estimated_duration_seconds"
    OR NEW."title" IS DISTINCT FROM OLD."title"
    OR NEW."markdown_body" IS DISTINCT FROM OLD."markdown_body"
    OR NEW."effective_from" IS DISTINCT FROM OLD."effective_from"
    OR NEW."provenance" IS DISTINCT FROM OLD."provenance"
  THEN
    RAISE EXCEPTION 'reviewed content is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_resource_versions_append_only
  BEFORE UPDATE OR DELETE ON "content_resource_versions"
  FOR EACH ROW EXECUTE FUNCTION enforce_phase7_content_version_lifecycle();

CREATE INDEX "content_resource_versions_status_updated_idx"
  ON "content_resource_versions"("review_status", "updated_at", "id");

CREATE UNIQUE INDEX "content_resource_versions_one_approved_per_resource"
  ON "content_resource_versions"("resource_id")
  WHERE "review_status" = 'APPROVED'::"ContentReviewStatus";
