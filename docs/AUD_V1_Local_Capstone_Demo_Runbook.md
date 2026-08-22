# AUD Subjective Monitoring V1 — Local Capstone Demo Runbook

**Status:** Phase 7 implementation present; final project audit/validation/closeout pending.

This runbook is for the repeatable local demonstration. It describes the
implemented capstone runtime, not production readiness.

## Start the demo

From the repository root:

```sh
pnpm install
cp .env.example .env
```

Set `BETTER_AUTH_SECRET` in `.env` to a local secret, then start PostgreSQL and
prepare the database:

```sh
docker compose up -d postgres
pnpm db:migrate:dev
pnpm db:generate
pnpm db:seed
pnpm dev
```

Open <http://localhost:5173>. The backend is available at
<http://localhost:3000>.

## Seeded evaluator accounts

| Workspace | Email | Password |
| --- | --- | --- |
| Patient | `patient.demo@example.test` | `DemoPatient!2026` |
| Clinician | `clinician.demo@example.test` | `DemoClinician!2026` |
| Admin | `admin.demo@example.test` | `DemoAdmin!2026` |

The patient seed includes eight scheduled periods with complete, partial, and
missing states, a historical backfill, and a patient correction. This gives the
Progress and clinician detail views meaningful longitudinal data without manual
database edits.

## Suggested walkthrough

1. **Patient** — open `/patient/home`, review the current check-in state, then
   visit `/patient/check-in`, `/patient/progress`, `/patient/support`, and
   `/patient/profile`.
2. **Clinician** — sign in with the clinician account and open
   `/clinician/overview`. Continue to `/clinician/patients`, open the seeded
   patient detail, then show `/clinician/review-queue`,
   `/clinician/engagement`, and `/clinician/safety`.
3. **Admin** — sign in with the admin account and show `/admin/overview`,
   `/admin/users`, `/admin/content`, `/admin/configuration/regional-routing`,
   `/admin/operations`, `/admin/safety`, and `/admin/audit`.

The backend remains authoritative for scheduled periods, revisions, missingness,
corrections, safety, content lifecycle, authorization, audit records, and
engagement reconciliation. The local demo does not claim unattended state
transitions while the application is idle.

## Explicit production deferrals

The local capstone intentionally defers unattended worker scheduling and
pg-boss, external email/push/SMS delivery, provider callbacks and retries,
automatic outage detection, production care-team routing, backup/restore and
retention execution, RPO/RTO enforcement, high availability, production
scaling/secret infrastructure, vendor/compliance activation, and real-patient
activation. These are production-deferred capabilities, not hidden product
claims or changes to the locked clinical and monitoring semantics.

Final project audit, full validation, and closeout remain pending after this
implementation sweep.
