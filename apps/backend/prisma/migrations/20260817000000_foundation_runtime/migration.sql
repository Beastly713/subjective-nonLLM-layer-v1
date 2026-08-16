-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(128) NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "request_payload_hash" VARCHAR(128) NOT NULL,
    "response_status" INTEGER,
    "response_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_processing_locks" (
    "patient_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_processing_locks_pkey" PRIMARY KEY ("patient_id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "event_id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_role" VARCHAR(64),
    "actor_context" JSONB,
    "action" VARCHAR(128) NOT NULL,
    "entity_type" VARCHAR(128) NOT NULL,
    "entity_id" VARCHAR(255),
    "patient_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "rule_set_version" VARCHAR(128),
    "instrument_version" VARCHAR(64),
    "configuration_version" VARCHAR(128),
    "source_revision_reference" VARCHAR(255),
    "metadata" JSONB,
    "request_id" VARCHAR(128),

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "operational_incidents" (
    "id" UUID NOT NULL,
    "incident_type" VARCHAR(128) NOT NULL,
    "code" VARCHAR(128) NOT NULL,
    "status" VARCHAR(64) NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "request_id" VARCHAR(128),
    "provenance_reference" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "operational_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_action_key_key"
ON "idempotency_records"("actor_id", "action", "idempotency_key");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx"
ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE INDEX "audit_events_patient_id_occurred_at_idx"
ON "audit_events"("patient_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_entity_occurred_at_idx"
ON "audit_events"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_occurred_at_idx"
ON "audit_events"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "operational_incidents_status_created_at_idx"
ON "operational_incidents"("status", "created_at");

-- Enforce append-only audit history at the database boundary.
CREATE FUNCTION prevent_audit_events_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_events are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_events_mutation();
