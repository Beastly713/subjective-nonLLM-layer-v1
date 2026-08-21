import {
  CheckInAssessmentDetailSchema,
  CheckInHistoryResponseSchema,
  WeeklyAssessmentDraftAnswersSchema,
  WeeklyConsumptionDraftDaysSchema,
  type CheckInAssessmentDetail,
  type CheckInHistoryResponse,
  type CheckInStateResponse,
} from '@aud-subjective/contracts';
import { Prisma } from '../../generated/prisma/client.js';
import {
  AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
  AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
} from '../../policy/instruments/aud-weekly-checkin-v1.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { reconcileCurrentStateProjection } from '../monitoring/service.js';
import {
  resolvePreferencesForPeriod,
  resolveRecoveryGoalForPeriod,
} from '../profiles/period-context.js';
import { ensureRelevantPeriodsInTransaction } from '../scheduling/service.js';
import { loadPatientSafetyProjection } from '../safety/projections.js';
import {
  periodLocalDates,
  projectCheckInState,
  projectGoalContext,
  projectInstrument,
  projectPeriod,
  projectPreferenceContext,
  safetyAvailability,
} from './projections.js';
import { hasNewerAuthoritativeAssessment } from './service.js';
import type { AssessmentPeriodRecord } from './types.js';

type Tx = Prisma.TransactionClient;

function notFound(): never {
  throw new DomainError(
    404,
    'NOT_FOUND',
    'The requested resource was not found.',
  );
}

function periodRecord(period: {
  id: string;
  scheduleVersionId: string;
  monitoringTimezone: string;
  periodStartAt: Date;
  periodEndAt: Date;
  openAt: Date;
  originalDueAt: Date;
  effectiveDueAt: Date;
  version: number;
  scheduleVersion: { version: number };
}): AssessmentPeriodRecord {
  return period as AssessmentPeriodRecord;
}

function enforcePatientHistorySafety(
  safety: Awaited<ReturnType<typeof loadPatientSafetyProjection>>,
  now: Date,
) {
  const availability = safetyAvailability(safety, now);

  if (availability === 'SAFETY_PAUSED') {
    throw new DomainError(
      409,
      'SAFETY_PAUSED',
      'Weekly check-ins are paused while the safety handoff is active.',
    );
  }

  if (availability === 'SAFETY_REASSESSMENT_REQUIRED') {
    throw new DomainError(
      409,
      'SAFETY_REASSESSMENT_REQUIRED',
      'Complete the required safety reassessment before continuing.',
    );
  }
}

function revisionProjection(
  revision: {
    id: string;
    revisionNumber: number;
    submittedAt: Date;
    submittedBy: 'PATIENT' | 'CLINICIAN' | 'STAFF' | 'IMPORT';
    submissionClassification: string;
    completionStatus: 'PARTIAL' | 'COMPLETE';
  },
  isAuthoritative: boolean,
) {
  return {
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    submittedAt: revision.submittedAt.toISOString(),
    submittedBy: revision.submittedBy,
    submissionClassification: revision.submissionClassification as
      | 'CURRENT'
      | 'LATE_CURRENT'
      | 'HISTORICAL_BACKFILL'
      | 'PATIENT_CORRECTION'
      | 'STAFF_CORRECTION',
    completionStatus: revision.completionStatus,
    isAuthoritative,
  };
}

export async function startWeeklyAssessmentBackfill(
  tx: Tx,
  clock: Clock,
  patientId: string,
  periodId: string,
): Promise<CheckInStateResponse> {
  await lockPatientForProcessing(tx, patientId);
  await ensureRelevantPeriodsInTransaction(tx, clock, patientId);

  const now = clock.now();

  const period = await tx.scheduledPeriod.findFirst({
    where: { id: periodId, patientId },
    include: {
      scheduleVersion: {
        select: { version: true },
      },
    },
  });

  if (!period) notFound();

  if (now < period.openAt) {
    throw new DomainError(
      409,
      'ASSESSMENT_PERIOD_NOT_OPEN',
      'This historical check-in cannot be started before its scheduled opening.',
    );
  }

  const existing = await tx.weeklyAssessment.findUnique({
    where: {
      patientId_scheduledPeriodId_instrumentId_instrumentVersion: {
        patientId,
        scheduledPeriodId: period.id,
        instrumentId: AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
        instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
      },
    },
    include: {
      authoritativeRevision: {
        select: {
          id: true,
          revisionNumber: true,
          completionStatus: true,
          submissionClassification: true,
          submittedAt: true,
          sourceDraftVersion: true,
        },
      },
    },
  });

  if (existing?.authoritativeRevision) {
    const [goal, preference, safety] = await Promise.all([
      resolveRecoveryGoalForPeriod(tx, patientId, period),
      resolvePreferencesForPeriod(tx, patientId, period),
      loadPatientSafetyProjection(tx, patientId),
    ]);

    return projectCheckInState({
      availability: 'HISTORICAL',
      period: periodRecord(period),
      assessment: existing,
      context: {
        period: periodRecord(period),
        goal,
        preference,
      },
      safety,
      now,
    });
  }

  if (
    !(await hasNewerAuthoritativeAssessment(
      tx,
      patientId,
      periodRecord(period),
    ))
  ) {
    throw new DomainError(
      409,
      'BACKFILL_NOT_AVAILABLE',
      'A past check-in can be completed only after a newer weekly submission is authoritative.',
    );
  }

  const [goal, preference, safety] = await Promise.all([
    resolveRecoveryGoalForPeriod(tx, patientId, period),
    resolvePreferencesForPeriod(tx, patientId, period),
    loadPatientSafetyProjection(tx, patientId),
  ]);

  enforcePatientHistorySafety(safety, now);

  const assessment =
    existing ??
    (await tx.weeklyAssessment.create({
      data: {
        patientId,
        scheduledPeriodId: period.id,
        instrumentId: AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
        instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
        draftVersion: 0,
        draftCurrentStep: 'ALCOHOL_USE',
        draftAnswerSnapshot: {},
        draftConsumptionSnapshot: Prisma.DbNull,
        completionStatus: 'DRAFT',
        createdByUserId: patientId,
        updatedByUserId: patientId,
      },
      include: {
        authoritativeRevision: {
          select: {
            id: true,
            revisionNumber: true,
            completionStatus: true,
            submissionClassification: true,
            submittedAt: true,
            sourceDraftVersion: true,
          },
        },
      },
    }));

  return projectCheckInState({
    availability: 'HISTORICAL',
    period: periodRecord(period),
    assessment,
    context: {
      period: periodRecord(period),
      goal,
      preference,
    },
    safety,
    now,
  });
}

export async function readCheckInHistory(
  tx: Tx,
  clock: Clock,
  patientId: string,
): Promise<CheckInHistoryResponse> {
  await lockPatientForProcessing(tx, patientId);

  const now = clock.now();

  await reconcileCurrentStateProjection(tx, patientId, now);

  const safety = await loadPatientSafetyProjection(tx, patientId);
  const patientMutationAvailable = safetyAvailability(safety, now) === null;

  const periods = await tx.scheduledPeriod.findMany({
    where: { patientId },
    orderBy: { periodStartAt: 'desc' },
    include: {
      scheduleVersion: {
        select: { version: true },
      },
    },
  });

  const assessments = await tx.weeklyAssessment.findMany({
    where: {
      patientId,
      scheduledPeriodId: {
        in: periods.map((period) => period.id),
      },
      instrumentId: AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
      instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
    },
    include: {
      revisions: {
        orderBy: { revisionNumber: 'desc' },
      },
      authoritativeRevision: true,
    },
  });

  const assessmentByPeriod = new Map(
    assessments.map((assessment) => [assessment.scheduledPeriodId, assessment]),
  );

  const items = await Promise.all(
    periods.map(async (rawPeriod) => {
      const period = periodRecord(rawPeriod);
      const assessment = assessmentByPeriod.get(period.id);
      const authoritative = assessment?.authoritativeRevision ?? null;

      return {
        assessmentId: assessment?.id ?? null,
        period: projectPeriod(period, now),
        completionStatus: assessment?.completionStatus ?? null,
        submissionClassification: authoritative
          ? (authoritative.submissionClassification as
              | 'CURRENT'
              | 'LATE_CURRENT'
              | 'HISTORICAL_BACKFILL'
              | 'PATIENT_CORRECTION'
              | 'STAFF_CORRECTION')
          : null,
        authoritativeRevisionId: authoritative?.id ?? null,
        authoritativeRevisionNumber: authoritative?.revisionNumber ?? null,
        submittedAt: authoritative?.submittedAt.toISOString() ?? null,
        hasDraft: assessment?.completionStatus === 'DRAFT',
        correctionAvailable: Boolean(authoritative) && patientMutationAvailable,
        backfillAvailable:
          !authoritative &&
          now >= period.openAt &&
          patientMutationAvailable &&
          (await hasNewerAuthoritativeAssessment(tx, patientId, period)),
        revisions: assessment
          ? assessment.revisions.map((revision) =>
              revisionProjection(revision, revision.id === authoritative?.id),
            )
          : [],
      };
    }),
  );

  return CheckInHistoryResponseSchema.parse({
    items,
  });
}

export async function readCheckInAssessmentDetail(
  tx: Tx,
  clock: Clock,
  patientId: string,
  assessmentId: string,
): Promise<CheckInAssessmentDetail> {
  const assessment = await tx.weeklyAssessment.findFirst({
    where: {
      id: assessmentId,
      patientId,
    },
    include: {
      scheduledPeriod: {
        include: {
          scheduleVersion: {
            select: { version: true },
          },
        },
      },
      revisions: {
        orderBy: {
          revisionNumber: 'desc',
        },
        include: {
          itemResponses: true,
          alcoholConsumptionDays: {
            orderBy: {
              localDate: 'asc',
            },
          },
        },
      },
    },
  });

  if (!assessment) notFound();

  const period = periodRecord(assessment.scheduledPeriod);

  const [goal, preference] = await Promise.all([
    resolveRecoveryGoalForPeriod(tx, patientId, period),
    resolvePreferencesForPeriod(tx, patientId, period),
  ]);

  const projectRevision = (
    revision: (typeof assessment.revisions)[number],
    isAuthoritative: boolean,
  ) => {
    const answers: Record<string, boolean | number> = {};

    for (const response of revision.itemResponses) {
      if (response.itemId === 'U1' && response.booleanValue !== null) {
        answers.U1 = response.booleanValue;
      }

      if (response.itemId !== 'U1' && response.integerValue !== null) {
        answers[response.itemId] = response.integerValue;
      }
    }

    return {
      ...revisionProjection(revision, isAuthoritative),
      answers: WeeklyAssessmentDraftAnswersSchema.parse(answers),
      weeklyConsumptionDays: WeeklyConsumptionDraftDaysSchema.parse(
        revision.alcoholConsumptionDays.map((day) => ({
          localDate: day.localDate.toISOString().slice(0, 10),
          status: day.status,
          standardDrinks:
            day.standardDrinks === null ? null : Number(day.standardDrinks),
        })),
      ),
    };
  };

  const authoritative =
    assessment.revisions.find(
      (revision) => revision.id === assessment.authoritativeRevisionId,
    ) ?? null;

  return CheckInAssessmentDetailSchema.parse({
    assessmentId: assessment.id,
    period: projectPeriod(period, clock.now()),
    instrument: projectInstrument(goal?.goal ?? 'UNSURE'),
    goalContext: projectGoalContext(goal),
    preferenceContext: projectPreferenceContext(preference),
    weeklyConsumptionDates:
      goal?.goal === 'REDUCTION' ? periodLocalDates(period) : [],
    authoritativeRevision: authoritative
      ? projectRevision(authoritative, true)
      : null,
    priorRevisions: assessment.revisions
      .filter((revision) => revision.id !== authoritative?.id)
      .map((revision) => revisionProjection(revision, false)),
  });
}
