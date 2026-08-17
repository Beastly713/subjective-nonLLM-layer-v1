CREATE TYPE "ApplicationAccountState" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');
CREATE TYPE "ApplicationWorkspace" AS ENUM ('PATIENT', 'CLINICIAN', 'ADMIN');
CREATE TYPE "ApplicationRole" AS ENUM ('PATIENT', 'CLINICIAN', 'ADMIN', 'OPERATIONS');
CREATE TYPE "MutualHelpPreference" AS ENUM ('NONE', 'AA_12_STEP', 'ALTERNATIVE', 'UNSURE', 'PREFER_NOT_TO_SAY');
CREATE TYPE "SpiritualContentPreference" AS ENUM ('ALLOW', 'DO_NOT_ALLOW', 'UNSURE');

CREATE TABLE "application_accounts" (
    "user_id" UUID NOT NULL,
    "state" "ApplicationAccountState" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "disabled_at" TIMESTAMPTZ(6),
    "disabled_by_user_id" UUID,
    "disable_reason" TEXT,
    "privileged_identity_verified_at" TIMESTAMPTZ(6),
    "privileged_identity_verified_by_user_id" UUID,
    "privileged_identity_verification_reference" VARCHAR(255),
    CONSTRAINT "application_accounts_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "application_accounts_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "user_role_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workspace" "ApplicationWorkspace" NOT NULL,
    "role" "ApplicationRole" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by_user_id" UUID NOT NULL,
    "grant_reason" TEXT NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by_user_id" UUID,
    "revoke_reason" TEXT,
    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_role_assignments_version_positive" CHECK ("version" > 0),
    CONSTRAINT "user_role_assignments_role_workspace_pair" CHECK (
        ("role" = 'PATIENT' AND "workspace" = 'PATIENT') OR
        ("role" = 'CLINICIAN' AND "workspace" = 'CLINICIAN') OR
        ("role" IN ('ADMIN', 'OPERATIONS') AND "workspace" = 'ADMIN')
    )
);

CREATE TABLE "patient_profiles" (
    "patient_id" UUID NOT NULL,
    "monitoring_timezone" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("patient_id"),
    CONSTRAINT "patient_profiles_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "profile_preference_versions" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "mutual_help_preference" "MutualHelpPreference",
    "spiritual_content_preference" "SpiritualContentPreference",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    CONSTRAINT "profile_preference_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "profile_preference_versions_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "clinician_patient_assignments" (
    "id" UUID NOT NULL,
    "clinician_user_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_user_id" UUID NOT NULL,
    "assignment_reason" TEXT NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "ended_by_user_id" UUID,
    "end_reason" TEXT,
    CONSTRAINT "clinician_patient_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "clinician_patient_assignments_version_positive" CHECK ("version" > 0),
    CONSTRAINT "clinician_patient_assignments_distinct_users" CHECK ("clinician_user_id" <> "patient_id")
);

CREATE INDEX "user_role_assignments_user_active_idx" ON "user_role_assignments"("user_id", "revoked_at");
CREATE UNIQUE INDEX "user_role_assignments_active_unique" ON "user_role_assignments"("user_id", "workspace", "role") WHERE "revoked_at" IS NULL;
CREATE UNIQUE INDEX "profile_preference_versions_patient_version_key" ON "profile_preference_versions"("patient_id", "version");
CREATE INDEX "profile_preference_versions_latest_idx" ON "profile_preference_versions"("patient_id", "version" DESC);
CREATE INDEX "clinician_patient_assignments_clinician_active_idx" ON "clinician_patient_assignments"("clinician_user_id", "ended_at");
CREATE INDEX "clinician_patient_assignments_patient_active_idx" ON "clinician_patient_assignments"("patient_id", "ended_at");
CREATE UNIQUE INDEX "clinician_patient_assignments_active_unique" ON "clinician_patient_assignments"("clinician_user_id", "patient_id") WHERE "ended_at" IS NULL;

ALTER TABLE "application_accounts" ADD CONSTRAINT "application_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "profile_preference_versions" ADD CONSTRAINT "profile_preference_versions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinician_patient_assignments" ADD CONSTRAINT "clinician_patient_assignments_clinician_user_id_fkey" FOREIGN KEY ("clinician_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinician_patient_assignments" ADD CONSTRAINT "clinician_patient_assignments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_processing_locks" ADD CONSTRAINT "patient_processing_locks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;
