\set ON_ERROR_STOP on

DO $$
BEGIN
  IF EXISTS (
    SELECT patient_id
    FROM clinical_review_cases
    WHERE lifecycle IN ('NEW', 'ACKNOWLEDGED', 'ACTIVE', 'CLEARANCE_PENDING')
    GROUP BY patient_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: more than one open clinical case exists for a patient';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM clinician_tasks task
    JOIN clinical_review_cases case_row ON case_row.id = task.case_id
    WHERE task.patient_id <> case_row.patient_id
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: clinician task points to another patient''s case';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM clinical_case_events event
    JOIN clinical_review_cases case_row ON case_row.id = event.case_id
    WHERE event.patient_id <> case_row.patient_id
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: case event points to another patient''s case';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM content_suppressions
    WHERE (scope = 'INTERVENTION_CLASS'
           AND (intervention_class IS NULL OR resource_id IS NOT NULL))
       OR (scope = 'RESOURCE'
           AND (resource_id IS NULL OR intervention_class IS NOT NULL))
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: content suppression scope has invalid identity columns';
  END IF;

  IF EXISTS (
    SELECT source_evaluation_id
    FROM content_resolution_records
    GROUP BY source_evaluation_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: duplicate content resolution per source evaluation';
  END IF;

  IF EXISTS (
    SELECT source_evaluation_id, intervention_class
    FROM available_followups
    GROUP BY source_evaluation_id, intervention_class
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: duplicate follow-up per evaluation and class';
  END IF;

  IF EXISTS (
    SELECT resolution_id, resource_id
    FROM content_delivery_audits
    GROUP BY resolution_id, resource_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: duplicate delivery audit per resolution and resource';
  END IF;

  IF EXISTS (
    SELECT patient_id, reason_family
    FROM clinical_reason_states
    GROUP BY patient_id, reason_family
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: duplicate current clinical reason state';
  END IF;

  IF EXISTS (
    SELECT case_id, created_reason
    FROM clinician_tasks
    GROUP BY case_id, created_reason
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: duplicate durable task for case and reason';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM content_resolution_records resolution
    JOIN assessment_evaluations evaluation
      ON evaluation.id = resolution.source_evaluation_id
    WHERE resolution.patient_id <> evaluation.patient_id
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: content resolution source patient mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM available_followups followup
    JOIN assessment_evaluations evaluation
      ON evaluation.id = followup.source_evaluation_id
    WHERE followup.patient_id <> evaluation.patient_id
       OR followup.expires_at <= followup.available_from
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: follow-up provenance or expiry is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM clinician_tasks
    WHERE (recipient_type = 'PRIMARY_CLINICIAN' AND recipient_id IS NULL)
       OR (recipient_type = 'SYSTEM_UNROUTED_QUEUE' AND recipient_id IS NOT NULL)
       OR (attempt_count < 0)
       OR (delivery_status = 'UNROUTED' AND operational_incident_id IS NULL)
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: durable clinician task recipient or delivery shape is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM clinical_review_cases
    WHERE (lifecycle IN ('NEW', 'ACKNOWLEDGED', 'ACTIVE', 'CLEARANCE_PENDING')
           AND resolved_at IS NOT NULL)
       OR (lifecycle IN ('RESOLVED', 'RESOLVED_CORRECTION')
           AND resolved_at IS NULL)
       OR (lifecycle = 'CLEARANCE_PENDING' AND tier <> 'NONE')
       OR (lifecycle = 'ACTIVE' AND tier <> 'LEVEL_3')
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: clinical case lifecycle/tier/timestamp combination is invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'content_resource_versions_append_only'
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: immutable content-version trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'clinical_reason_history_append_only'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'clinical_case_events_append_only'
  ) THEN
    RAISE EXCEPTION
      'Phase 5 invariant failed: immutable clinical-history trigger is missing';
  END IF;
END $$;

SELECT
  'phase5_invariants_passed' AS validation,
  (SELECT count(*) FROM content_resolution_records) AS content_resolutions,
  (SELECT count(*) FROM clinical_review_cases) AS clinical_cases,
  (SELECT count(*) FROM clinician_tasks) AS clinician_tasks;
