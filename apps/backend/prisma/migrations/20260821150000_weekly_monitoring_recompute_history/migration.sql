ALTER TABLE "assessment_revisions"
  ALTER COLUMN "source_draft_version" DROP NOT NULL;

ALTER TABLE "assessment_evaluations"
  DROP CONSTRAINT "assessment_evaluations_revision_trigger_key";

ALTER TABLE "assessment_evaluations"
  ADD COLUMN "derivation_fingerprint" VARCHAR(64),
  ADD COLUMN "superseded_by_evaluation_id" UUID,
  ADD COLUMN "superseded_at" TIMESTAMPTZ(6);

UPDATE "assessment_evaluations"
SET "derivation_fingerprint" = md5(
  "assessment_revision_id"::text || ':' || "trigger"::text || ':' || "evaluated_at"::text
)
WHERE "derivation_fingerprint" IS NULL;

ALTER TABLE "assessment_evaluations"
  ALTER COLUMN "derivation_fingerprint" SET NOT NULL;

ALTER TABLE "assessment_evaluations"
  ADD CONSTRAINT "assessment_evaluations_superseded_by_fk"
  FOREIGN KEY ("superseded_by_evaluation_id")
  REFERENCES "assessment_evaluations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "assessment_evaluations_revision_derivation_key"
  ON "assessment_evaluations" ("assessment_revision_id", "derivation_fingerprint");

ALTER TABLE "alcohol_consumption_days"
  DROP CONSTRAINT "alcohol_consumption_days_values_check";

ALTER TABLE "alcohol_consumption_days"
  ADD CONSTRAINT "alcohol_consumption_days_values_check" CHECK (
    ("status" = 'UNKNOWN' AND "standard_drinks" IS NULL AND "ethanol_grams" IS NULL)
    OR ("status" = 'KNOWN_ZERO' AND "standard_drinks" = 0 AND "ethanol_grams" = 0)
    OR ("status" = 'KNOWN_QUANTITY' AND "standard_drinks" > 0 AND "ethanol_grams" > 0)
  );
