ALTER TABLE "longitudinal_feature_records"
ADD COLUMN "recurrent_use_observed_periods" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "longitudinal_feature_records"
ADD CONSTRAINT "longitudinal_feature_records_recurrent_observed_check"
CHECK ("recurrent_use_observed_periods" BETWEEN 0 AND 4);
