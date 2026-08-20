-- Repair any safety-case row whose lifecycle column was left behind its
-- append-only lifecycle history by the earlier recovery implementation.
-- Historical events are not rewritten. When two events share the same
-- transaction timestamp, prefer the farther lifecycle state rather than a
-- random UUID ordering.
WITH latest_event AS (
  SELECT DISTINCT ON ("case_id")
    "case_id",
    "to_state",
    "occurred_at"
  FROM "safety_case_lifecycle_events"
  ORDER BY
    "case_id",
    "occurred_at" DESC,
    CASE "to_state"
      WHEN 'RESOLVED' THEN 7
      WHEN 'RESOLVED_EXTERNAL_HANDOFF' THEN 7
      WHEN 'ESCALATED_TO_EMERGENCY' THEN 6
      WHEN 'PLAN_ESTABLISHED' THEN 5
      WHEN 'CLINICAL_REVIEW_IN_PROGRESS' THEN 4
      WHEN 'ACKNOWLEDGED' THEN 3
      WHEN 'HANDOFF_INITIATED' THEN 2
      WHEN 'DETECTED' THEN 1
      ELSE 0
    END DESC,
    "id" DESC
)
UPDATE "safety_cases" AS safety_case
SET
  "lifecycle" = latest_event."to_state",
  "version" = safety_case."version" + 1,
  "updated_at" = GREATEST(safety_case."updated_at", latest_event."occurred_at")
FROM latest_event
WHERE
  safety_case."id" = latest_event."case_id"
  AND safety_case."lifecycle" IS DISTINCT FROM latest_event."to_state";
