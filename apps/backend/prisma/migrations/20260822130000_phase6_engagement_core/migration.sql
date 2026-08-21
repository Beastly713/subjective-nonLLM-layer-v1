CREATE TYPE "EngagementStateValue" AS ENUM (
  'ENGAGED',
  'OVERDUE',
  'AT_RISK_OF_DISENGAGEMENT',
  'DISENGAGED',
  'RETURNED_AFTER_GAP',
  'OPTED_OUT',
  'TECHNICAL_FAILURE'
);

CREATE TABLE "engagement_states" (
  "patient_id" UUID NOT NULL,
  "state" "EngagementStateValue" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "missed_cycle_period_id" UUID,
  "cycle_tracking_from_at" TIMESTAMPTZ(6),
  "source_effective_due_at" TIMESTAMPTZ(6),
  "last_valid_assessment_revision_id" UUID,
  "last_valid_period_id" UUID,
  "opted_out_at" TIMESTAMPTZ(6),
  "returned_after_gap_at" TIMESTAMPTZ(6),
  "last_transition_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "engagement_states_pkey" PRIMARY KEY ("patient_id"),
  CONSTRAINT "engagement_states_patient_fk"
    FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "engagement_states_missed_period_fk"
    FOREIGN KEY ("missed_cycle_period_id") REFERENCES "scheduled_periods"("period_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "engagement_states_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "missed_checkin_reminders" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "missed_cycle_period_id" UUID NOT NULL,
  "reminder_number" INTEGER NOT NULL,
  "eligible_at" TIMESTAMPTZ(6) NOT NULL,
  "presented_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "cancellation_reason" VARCHAR(128),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "missed_checkin_reminders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "missed_checkin_reminders_patient_fk"
    FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "missed_checkin_reminders_period_fk"
    FOREIGN KEY ("missed_cycle_period_id") REFERENCES "scheduled_periods"("period_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "missed_checkin_reminders_number_check"
    CHECK ("reminder_number" IN (1, 2)),
  CONSTRAINT "missed_checkin_reminders_cancel_order_check"
    CHECK ("cancelled_at" IS NULL OR "cancellation_reason" IS NOT NULL)
);

CREATE UNIQUE INDEX "missed_checkin_reminders_patient_cycle_number_key"
  ON "missed_checkin_reminders"("patient_id", "missed_cycle_period_id", "reminder_number");
CREATE INDEX "engagement_states_state_updated_idx"
  ON "engagement_states"("state", "updated_at");
CREATE INDEX "engagement_states_missed_period_idx"
  ON "engagement_states"("missed_cycle_period_id");
CREATE INDEX "missed_checkin_reminders_patient_eligible_idx"
  ON "missed_checkin_reminders"("patient_id", "eligible_at");
CREATE INDEX "missed_checkin_reminders_patient_cancelled_idx"
  ON "missed_checkin_reminders"("patient_id", "cancelled_at");
