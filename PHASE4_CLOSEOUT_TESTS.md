# Phase 4 Closeout Test Bundle

This ZIP contains **only test/validation artifacts**. It does not overwrite the Phase 4 implementation corrections.

## Files

```text
apps/backend/test/domain/weekly-monitoring-evaluator.test.ts
apps/backend/test/domain/weekly-consumption.test.ts
apps/backend/test/integration/weekly-monitoring-phase4.test.ts
apps/web/src/features/patient/check-in/weekly-scale.test.tsx
tests/e2e/check-in.spec.ts
validation/phase4_invariants.sql
```

The evaluator tests intentionally expect the Phase 4 closeout corrections already discussed, including:

- `recurrentUseObservedPeriods` in `LongitudinalFeatures`;
- recurrence where unknown/missing/non-abstinence prior weeks do not count positive or negative;
- recurrence reactivation while clearance is pending;
- previous period must itself be ABSTINENCE-positive for `CONSECUTIVE_USE`;
- staff correction suppresses patient support but preserves current clinician-reason eligibility;
- historical effect scope remains historical-only.

The web/E2E tests intentionally expect:

- backend-supplied `weeklyConsumptionDates` in the assessment-detail contract;
- accessible `WeeklyScale`/`BooleanChoice` usage on the correction/backfill action page;
- stable idempotency keys across retry for correction and backfill submission.

## 1. Extract into the repository root

From the repository root:

```bash
unzip -o /path/to/phase4-closeout-tests.zip -d .
```

Check what was added:

```bash
git status --short
git diff --check
```

## 2. Environment and isolated PostgreSQL

```bash
corepack enable
pnpm install --frozen-lockfile

[ -f .env ] || cp .env.example .env

set -a
source .env
set +a

docker compose up -d postgres
```

Refuse destructive reset unless the URL is visibly the isolated test DB:

```bash
case "$TEST_DATABASE_URL" in
  *aud_subjective_test*) ;;
  *)
    echo "REFUSING: TEST_DATABASE_URL is not the isolated aud_subjective_test database"
    exit 1
    ;;
esac
```

Reset only the isolated test database:

```bash
docker compose exec postgres dropdb \
  --if-exists -U aud_subjective aud_subjective_test

docker compose exec postgres createdb \
  -U aud_subjective aud_subjective_test

DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate:deploy
pnpm db:generate
```

## 3. Prisma/static gates

```bash
pnpm --filter @aud-subjective/backend exec \
  prisma validate --config prisma.config.ts

DATABASE_URL="$TEST_DATABASE_URL" \
pnpm --filter @aud-subjective/backend exec \
  prisma migrate status --config prisma.config.ts

pnpm format:check
pnpm lint
pnpm typecheck
```

If `format:check` fails only on the newly extracted tests, format them once:

```bash
pnpm exec prettier --write \
  apps/backend/test/domain/weekly-monitoring-evaluator.test.ts \
  apps/backend/test/domain/weekly-consumption.test.ts \
  apps/backend/test/integration/weekly-monitoring-phase4.test.ts \
  apps/web/src/features/patient/check-in/weekly-scale.test.tsx \
  tests/e2e/check-in.spec.ts
```

Then rerun:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
```

## 4. Focused Phase 4 domain tests

```bash
pnpm exec vitest run \
  apps/backend/test/domain/weekly-monitoring-evaluator.test.ts \
  apps/backend/test/domain/weekly-consumption.test.ts
```

Do not continue to the integration suite until these are green. A failure here normally means a deterministic Phase 4 rule is still wrong.

## 5. Focused Phase 4 PostgreSQL integration test

```bash
pnpm exec vitest run \
  apps/backend/test/integration/weekly-monitoring-phase4.test.ts
```

This validates:

- one logical draft;
- optimistic draft version;
- immutable submit;
- idempotent replay/no duplicates;
- idempotency-key reuse conflict;
- historical backfill;
- forward recomputation;
- superseded/revoked evaluation history;
- patient correction N+1;
- assigned-clinician staff correction;
- patient-intent suppression for staff correction;
- clinician-reason eligibility preservation;
- patient-safe history projection.

## 6. Focused web component test

```bash
pnpm --filter @aud-subjective/web exec vitest run \
  src/features/patient/check-in/weekly-scale.test.tsx \
  --config vitest.config.ts
```

## 7. Build before browser validation

```bash
pnpm build
```

Install Chromium once if your machine does not already have Playwright's browser:

```bash
pnpm exec playwright install chromium
```

Run only the new Phase 4 browser suite first:

```bash
pnpm exec playwright test tests/e2e/check-in.spec.ts
```

This specifically tests backend dates, accessible correction controls, retry-safe correction/backfill idempotency, no internal state leakage, and a narrow viewport.

## 8. Database invariant pass

Run against the isolated test DB after the integration suite:

```bash
docker compose exec -T postgres \
  psql -U aud_subjective -d aud_subjective_test \
  -v ON_ERROR_STOP=1 \
  < validation/phase4_invariants.sql
```

Expected final line includes:

```text
phase4_invariants_passed
```

## 9. Full repository regression

Only after all focused Phase 4 gates are green:

```bash
pnpm test
pnpm build
docker build -t aud-subjective-platform:phase4-closeout .
git diff --check
git status --short
```

## 10. Manual smoke pass

Run:

```bash
pnpm dev
```

Manually check:

```text
1. Current weekly Check-in opens for the backend-provided recall period.
2. Save and exit, reload, and resume the same draft.
3. PARTIAL submission keeps unanswered items unknown.
4. COMPLETE submission shows neutral "recorded" state.
5. Late current remains the same recall week.
6. History distinguishes current/late/past/corrected records.
7. Backfill is visually historical and uses backend dates.
8. Patient correction creates a revision, not an in-place edit.
9. REDUCTION calendar distinguishes UNKNOWN from 0 drinks.
10. U1/calendar contradiction is blocked without rewriting either source.
11. Retry a failed correction/backfill final submit and confirm no duplicate revision.
12. Safety-paused/reassessment-required states block mutation.
13. Patient UI exposes no internal scores, flag keys, tier labels, or clinician reason codes.
14. Keyboard-only operation works for every 0..7 scale.
15. 390px-wide layout remains usable without horizontal loss of core actions.
```

## 11. Closeout commit

After every gate is green:

```bash
git add -- \
  apps/backend/test/domain/weekly-monitoring-evaluator.test.ts \
  apps/backend/test/domain/weekly-consumption.test.ts \
  apps/backend/test/integration/weekly-monitoring-phase4.test.ts \
  apps/web/src/features/patient/check-in/weekly-scale.test.tsx \
  tests/e2e/check-in.spec.ts \
  validation/phase4_invariants.sql

git commit -m "test: close phase 4 weekly monitoring coverage"
```

If your implementation corrections are still uncommitted, include them in the appropriate preceding fix commit rather than hiding implementation fixes inside the test-only commit.

## Stop conditions

Do **not** mark Phase 4 complete if any of these remain:

- domain test failure;
- PostgreSQL integration failure;
- Prisma migration drift;
- invariant SQL exception;
- same retry producing another revision/evaluation/ledger row;
- unknown data becoming zero/clear/non-use;
- recurrence bridging or reinterpreting non-abstinence periods;
- staff correction leaving automatic patient support eligible;
- patient UI exposing internal deterministic state;
- full `pnpm test` or `pnpm build` failure.
