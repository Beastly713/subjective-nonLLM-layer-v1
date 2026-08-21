\set ON_ERROR_STOP on

DO $$
BEGIN
  IF EXISTS (
    SELECT patient_id
    FROM engagement_cases
    WHERE lifecycle IN ('NEW', 'ACKNOWLEDGED', 'OUTREACH_IN_PROGRESS')
    GROUP BY patient_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: more than one open engagement case exists for a patient';
  END IF;

  IF EXISTS (
    SELECT patient_id, missed_cycle_period_id, reminder_number
    FROM missed_checkin_reminders
    GROUP BY patient_id, missed_cycle_period_id, reminder_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: duplicate reminder slot exists for a patient and missed cycle';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM missed_checkin_reminders
    WHERE reminder_number NOT IN (1, 2)
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: reminder number is outside the locked 1/2 slots';
  END IF;

  IF EXISTS (
    SELECT patient_id, missed_cycle_period_id
    FROM missed_checkin_reminders
    GROUP BY patient_id, missed_cycle_period_id
    HAVING count(*) > 2
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: more than two reminder rows exist for one missed cycle';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM missed_checkin_reminders reminder
    JOIN scheduled_periods period
      ON period.period_id = reminder.missed_cycle_period_id
    WHERE reminder.patient_id <> period.patient_id
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: reminder patient differs from its missed cycle patient';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM engagement_cases case_row
    JOIN scheduled_periods period
      ON period.period_id = case_row.source_missed_period_id
    WHERE case_row.patient_id <> period.patient_id
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: engagement case source period belongs to another patient';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM engagement_case_events event
    JOIN engagement_cases case_row ON case_row.id = event.case_id
    WHERE event.patient_id <> case_row.patient_id
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: engagement case event patient differs from its case';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM engagement_case_events
    WHERE (event_type = 'CASE_CREATED' AND to_lifecycle <> 'NEW')
       OR (event_type = 'CASE_ACKNOWLEDGED' AND to_lifecycle <> 'ACKNOWLEDGED')
       OR (event_type = 'OUTREACH_STARTED' AND to_lifecycle <> 'OUTREACH_IN_PROGRESS')
       OR (event_type = 'CASE_RESOLVED_RETURNED' AND to_lifecycle <> 'RESOLVED_RETURNED')
       OR (event_type = 'CASE_RESOLVED_OPT_OUT' AND to_lifecycle <> 'RESOLVED_OPT_OUT')
       OR (event_type = 'CASE_RESOLVED_PROGRAM_CLOSED' AND to_lifecycle <> 'RESOLVED_PROGRAM_CLOSED')
       OR (event_type = 'CASE_RESOLVED_TECHNICAL_CORRECTION'
           AND to_lifecycle <> 'RESOLVED_TECHNICAL_CORRECTION')
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: engagement event type and lifecycle transition disagree';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM engagement_cases
    WHERE (lifecycle IN ('NEW', 'ACKNOWLEDGED', 'OUTREACH_IN_PROGRESS')
           AND resolved_at IS NOT NULL)
       OR (lifecycle IN ('RESOLVED_RETURNED', 'RESOLVED_OPT_OUT',
                         'RESOLVED_PROGRAM_CLOSED', 'RESOLVED_TECHNICAL_CORRECTION')
           AND resolved_at IS NULL)
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: engagement case lifecycle and resolved_at disagree';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM engagement_cases case_row
    JOIN engagement_states state_row ON state_row.patient_id = case_row.patient_id
    WHERE case_row.lifecycle IN ('NEW', 'ACKNOWLEDGED', 'OUTREACH_IN_PROGRESS')
      AND state_row.state = 'OPTED_OUT'
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: opted-out patient has an open engagement case';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM engagement_states state_row
    LEFT JOIN technical_failures failure
      ON failure.id = state_row.source_technical_failure_id
    WHERE state_row.state = 'OPTED_OUT'
      AND state_row.opted_out_at IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM engagement_states state_row
    WHERE state_row.state <> 'OPTED_OUT'
      AND state_row.opted_out_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: opted-out state timestamp is inconsistent';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM engagement_states state_row
    LEFT JOIN technical_failures failure
      ON failure.id = state_row.source_technical_failure_id
    WHERE state_row.state = 'TECHNICAL_FAILURE'
      AND (
        failure.id IS NULL
        OR failure.patient_id <> state_row.patient_id
        OR failure.status <> 'CONFIRMED'
      )
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: technical engagement state lacks its confirmed source failure';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM clinician_tasks task
    LEFT JOIN engagement_cases engagement_case
      ON task.case_type = 'ENGAGEMENT'
     AND engagement_case.id = task.case_id
    WHERE task.case_type = 'ENGAGEMENT'
      AND (
        engagement_case.id IS NULL
        OR engagement_case.patient_id <> task.patient_id
        OR task.task_identity <> 'DISENGAGEMENT_REVIEW'
        OR task.created_reason IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: engagement task identity, reason, or patient linkage is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM clinician_tasks task
    LEFT JOIN clinical_review_cases clinical_case
      ON task.case_type IN ('CLINICAL', 'SUBJECTIVE_LEVEL_3_REVIEW')
     AND clinical_case.id = task.case_id
    WHERE task.case_type IN ('CLINICAL', 'SUBJECTIVE_LEVEL_3_REVIEW')
      AND (
        clinical_case.id IS NULL
        OR clinical_case.patient_id <> task.patient_id
        OR task.created_reason IS NULL
      )
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: clinical task no longer references a clinical case with a reason';
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
      'Phase 6 invariant failed: durable task recipient or delivery shape is invalid';
  END IF;

  IF EXISTS (
    SELECT case_type, case_id, task_identity
    FROM clinician_tasks
    GROUP BY case_type, case_id, task_identity
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: duplicate durable task identity exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM technical_failures
    WHERE (status = 'CONFIRMED'
           AND (confirmed_at IS NULL OR confirmed_by IS NULL))
       OR (status = 'RESOLVED'
           AND (resolved_at IS NULL OR resolved_by IS NULL))
       OR (status = 'CORRECTED_FALSE_POSITIVE'
           AND (corrected_at IS NULL OR corrected_by IS NULL OR reason IS NULL))
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: technical-failure status lacks required provenance';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM technical_failures failure
    JOIN scheduled_periods period ON period.period_id = failure.source_period_id
    WHERE failure.patient_id <> period.patient_id
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: technical-failure source period belongs to another patient';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM technical_failures failure
    JOIN scheduled_periods period ON period.period_id = failure.source_period_id
    WHERE failure.status = 'RESOLVED'
      AND (
        failure.recalculated_effective_due_at IS NULL
        OR failure.resolved_at IS NULL
        OR failure.recalculated_effective_due_at <> GREATEST(
          period.original_due_at + (failure.resolved_at - failure.started_at),
          failure.resolved_at + interval '24 hours'
        )
      )
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: resolved technical-failure due time does not match the locked formula';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM scheduled_periods
    WHERE original_due_at <= open_at
       OR effective_due_at <= open_at
       OR period_start_at >= period_end_at
       OR period_end_at <> open_at
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: scheduled-period timing geometry is invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'engagement_case_events_append_only'
  ) THEN
    RAISE EXCEPTION
      'Phase 6 invariant failed: immutable engagement-case event trigger is missing';
  END IF;
END $$;

SELECT
  'phase6_invariants_passed' AS validation,
  (SELECT count(*) FROM engagement_states) AS engagement_states,
  (SELECT count(*) FROM engagement_cases) AS engagement_cases,
  (SELECT count(*) FROM missed_checkin_reminders) AS reminders,
  (SELECT count(*) FROM technical_failures) AS technical_failures,
  (SELECT count(*) FROM clinician_tasks WHERE case_type = 'ENGAGEMENT') AS engagement_tasks;
