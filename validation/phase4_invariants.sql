\set ON_ERROR_STOP on

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM weekly_assessments wa
    JOIN assessment_revisions ar
      ON ar.id = wa.authoritative_revision_id
    WHERE ar.assessment_id <> wa.id
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: authoritative revision belongs to another logical assessment';
  END IF;

  IF EXISTS (
    SELECT assessment_revision_id
    FROM assessment_evaluations
    WHERE lifecycle = 'ACTIVE'
    GROUP BY assessment_revision_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: multiple ACTIVE evaluations exist for one assessment revision';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM assessment_evaluations ae
    JOIN assessment_revisions ar
      ON ar.id = ae.assessment_revision_id
    JOIN weekly_assessments wa
      ON wa.id = ar.assessment_id
    WHERE ae.lifecycle = 'ACTIVE'
      AND wa.authoritative_revision_id <> ar.id
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: ACTIVE evaluation belongs to a non-authoritative revision';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM longitudinal_feature_records
    WHERE recurrent_use_observed_periods NOT BETWEEN 0 AND 4
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: recurrent_use_observed_periods is outside 0..4';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weekly_consumption_summaries
    WHERE observed_day_count + unknown_day_count <> 7
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: weekly observed + unknown day count does not equal seven';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weekly_consumption_summaries
    WHERE observed_day_count < 7
      AND (
        complete_week_total_standard_drinks IS NOT NULL
        OR complete_week_ethanol_grams IS NOT NULL
        OR alcohol_free_days IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: incomplete weekly coverage contains complete-week claims';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM assessment_revisions
    WHERE revision_number > 1
      AND supersedes_revision_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: correction revision has no superseded predecessor';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM assessment_revisions child
    JOIN assessment_revisions parent
      ON parent.id = child.supersedes_revision_id
    WHERE child.assessment_id <> parent.assessment_id
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: correction supersedes a revision from a different logical assessment';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM patient_intervention_intents
    WHERE trigger = 'STAFF_CORRECTION'
      AND effect = 'ELIGIBLE'
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: STAFF_CORRECTION left automatic patient support eligible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM patient_intervention_intents pii
    JOIN assessment_evaluations ae
      ON ae.id = pii.evaluation_id
    WHERE ae.lifecycle <> 'ACTIVE'
      AND pii.effect = 'ELIGIBLE'
      AND ae.trigger IN ('CURRENT_PATIENT_SUBMISSION', 'CURRENT_PATIENT_CORRECTION')
      AND EXISTS (
        SELECT 1
        FROM assessment_evaluations active_ae
        WHERE active_ae.assessment_revision_id = ae.assessment_revision_id
          AND active_ae.lifecycle = 'ACTIVE'
      )
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: an obsolete evaluation still carries an eligible patient intent';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM current_state_flags csf
    JOIN assessment_revisions ar
      ON ar.id = csf.source_revision_id
    JOIN weekly_assessments wa
      ON wa.id = ar.assessment_id
    WHERE wa.authoritative_revision_id <> ar.id
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: current flag points to a non-authoritative revision';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM alcohol_consumption_days acd
    JOIN assessment_revisions ar
      ON ar.id = acd.assessment_revision_id
    JOIN weekly_assessments wa
      ON wa.id = ar.assessment_id
    WHERE acd.scheduled_period_id <> wa.scheduled_period_id
  ) THEN
    RAISE EXCEPTION
      'Phase 4 invariant failed: alcohol-consumption day period differs from its logical assessment period';
  END IF;

  IF to_regclass('public.clinical_reason_states') IS NOT NULL
     OR to_regclass('public.clinical_reason_history') IS NOT NULL
     OR to_regclass('public.clinical_review_cases') IS NOT NULL
     OR to_regclass('public.content_resources') IS NOT NULL
     OR to_regclass('public.clinician_tasks') IS NOT NULL
     OR to_regclass('public.engagement_cases') IS NOT NULL THEN
    RAISE EXCEPTION
      'Phase 4 boundary failed: a later-phase clinical/content/engagement table exists';
  END IF;
END $$;

SELECT
  'phase4_invariants_passed' AS validation,
  count(*) AS weekly_assessments
FROM weekly_assessments;
