import {
  SaveWeeklyAssessmentDraftRequestSchema,
  WeeklyAlcoholDayInputSetSchema,
  type CheckInStateResponse,
  type SaveWeeklyAssessmentDraftRequest,
} from '@aud-subjective/contracts';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import { AUD_WEEKLY_CHECKIN_INSTRUMENT_ID, AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION } from '../../policy/instruments/aud-weekly-checkin-v1.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import type { Clock } from '../../shared/clock/clock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { resolvePreferencesForPeriod, resolveRecoveryGoalForPeriod } from '../profiles/period-context.js';
import { loadPatientSafetyProjection } from '../safety/projections.js';
import { ensureRelevantPeriodsInTransaction } from '../scheduling/service.js';
import {
  periodAvailability,
  periodLocalDates,
  projectCheckInState,
  safetyAvailability,
} from './projections.js';
import type { AssessmentContext, AssessmentDatabase, AssessmentPeriodRecord } from './types.js';

type Tx = Prisma.TransactionClient;

const DraftWriteEnvelopeSchema = z.object({
  expectedDraftVersion: z.number().int().nonnegative(),
  currentStep: z.string(),
  answers: z.unknown(),
  weeklyConsumptionDays: z.unknown().optional(),
});

function notFound() {
  throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
}

function periodInclude() {
  return { scheduleVersion: { select: { version: true } } } as const;
}

async function activeSchedule(db: AssessmentDatabase, patientId: string) {
  return db.monitoringScheduleVersion.findFirst({
    where: { patientId, lifecycle: 'ACTIVE' },
    select: { id: true },
  });
}

async function targetPeriod(
  db: AssessmentDatabase,
  patientId: string,
  now: Date,
) {
  const open = await db.scheduledPeriod.findFirst({
    where: { patientId, openAt: { lte: now } },
    orderBy: { periodStartAt: 'desc' },
    include: periodInclude(),
  });
  if (open) return open as AssessmentPeriodRecord;

  const upcoming = await db.scheduledPeriod.findFirst({
    where: { patientId },
    orderBy: { periodStartAt: 'asc' },
    include: periodInclude(),
  });
  return (upcoming as AssessmentPeriodRecord | null) ?? null;
}

async function contextForPeriod(
  db: AssessmentDatabase,
  patientId: string,
  period: AssessmentPeriodRecord,
): Promise<AssessmentContext> {
  const [goal, preference] = await Promise.all([
    resolveRecoveryGoalForPeriod(db, patientId, period),
    resolvePreferencesForPeriod(db, patientId, period),
  ]);
  return { period, goal, preference };
}

function enforceSafety(
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

function emptyContext(): AssessmentContext | null {
  return null;
}

export async function startOrResumeWeeklyCheckIn(
  tx: Tx,
  clock: Clock,
  patientId: string,
): Promise<CheckInStateResponse> {
  await lockPatientForProcessing(tx, patientId);
  const now = clock.now();
  const safety = await loadPatientSafetyProjection(tx, patientId);
  const safetyState = safetyAvailability(safety, now);

  if (safetyState) {
    const period = (await activeSchedule(tx, patientId))
      ? await targetPeriod(tx, patientId, now)
      : null;
    const context = period
      ? await contextForPeriod(tx, patientId, period)
      : emptyContext();
    return projectCheckInState({
      availability: safetyState,
      period,
      assessment: null,
      context,
      safety,
      now,
    });
  }

  if (!(await activeSchedule(tx, patientId))) {
    return projectCheckInState({
      availability: 'NOT_ACTIVATED',
      period: null,
      assessment: null,
      context: emptyContext(),
      safety,
      now,
    });
  }

  await ensureRelevantPeriodsInTransaction(tx, clock, patientId);
  const period = await targetPeriod(tx, patientId, now);
  if (!period) {
    throw new DomainError(
      409,
      'SCHEDULE_NOT_READY',
      'A persisted monitoring period is not available yet.',
    );
  }

  const availability = periodAvailability(period, now);
  const context = await contextForPeriod(tx, patientId, period);
  if (availability === 'UPCOMING') {
    return projectCheckInState({
      availability,
      period,
      assessment: null,
      context,
      safety,
      now,
    });
  }

  let assessment = await tx.weeklyAssessment.findFirst({
    where: {
      patientId,
      scheduledPeriodId: period.id,
      instrumentId: AUD_WEEKLY_CHECKIN_INSTRUMENT_ID,
      instrumentVersion: AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION,
    },
  });

  if (!assessment) {
    assessment = await tx.weeklyAssessment.create({
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
    });
  }

  if (assessment.completionStatus !== 'DRAFT') {
    throw new DomainError(
      409,
      'ASSESSMENT_STATE_INVALID',
      'The weekly assessment is not an editable draft.',
    );
  }

  return projectCheckInState({
    availability,
    period,
    assessment,
    context,
    safety,
    now,
  });
}

function validateWeeklyConsumption(
  body: SaveWeeklyAssessmentDraftRequest,
  context: AssessmentContext,
) {
  const days = WeeklyAlcoholDayInputSetSchema.parse(
    body.weeklyConsumptionDays ?? [],
  );
  const required = context.goal?.goal === 'REDUCTION';
  if (!required && days.length > 0) {
    throw new DomainError(
      400,
      'VALIDATION_ERROR',
      'Weekly consumption days are only available for an effective reduction goal.',
    );
  }
  if (!required) return null;

  const expectedDates = new Set(periodLocalDates(context.period));
  if (days.some((day) => !expectedDates.has(day.localDate))) {
    throw new DomainError(
      400,
      'VALIDATION_ERROR',
      'Every weekly consumption day must belong to the persisted assessment period.',
    );
  }
  return days.length > 0 ? days : null;
}

export async function saveWeeklyAssessmentDraft(
  tx: Tx,
  clock: Clock,
  patientId: string,
  assessmentId: string,
  rawBody: unknown,
): Promise<CheckInStateResponse> {
  const envelope = DraftWriteEnvelopeSchema.parse(rawBody);
  await lockPatientForProcessing(tx, patientId);
  const assessment = await tx.weeklyAssessment.findUnique({
    where: { id: assessmentId },
    include: { scheduledPeriod: { include: periodInclude() } },
  });
  if (!assessment) notFound();
  if (assessment.patientId !== patientId) notFound();
  if (assessment.instrumentId !== AUD_WEEKLY_CHECKIN_INSTRUMENT_ID || assessment.instrumentVersion !== AUD_WEEKLY_CHECKIN_INSTRUMENT_VERSION) {
    throw new DomainError(409, 'ASSESSMENT_STATE_INVALID', 'The assessment policy is not supported.');
  }
  if (assessment.completionStatus !== 'DRAFT') {
    throw new DomainError(409, 'ASSESSMENT_STATE_INVALID', 'The weekly assessment is not an editable draft.');
  }

  const period = assessment.scheduledPeriod as AssessmentPeriodRecord;
  const now = clock.now();
  const currentTarget = await targetPeriod(tx, patientId, now);
  if (!currentTarget || currentTarget.id !== period.id || now < period.openAt) {
    throw new DomainError(
      409,
      'ASSESSMENT_PERIOD_NOT_CURRENT',
      'This draft is not the currently actionable monitoring period.',
    );
  }
  const context = await contextForPeriod(tx, patientId, period);
  const safety = await loadPatientSafetyProjection(tx, patientId);
  enforceSafety(safety, now);

  if (assessment.draftVersion !== envelope.expectedDraftVersion) {
    throw new DomainError(
      409,
      'VERSION_CONFLICT',
      'The weekly check-in draft changed before this update.',
    );
  }

  const body = SaveWeeklyAssessmentDraftRequestSchema.parse(rawBody);
  const weeklyConsumptionDays = validateWeeklyConsumption(body, context);
  const updated = await tx.weeklyAssessment.update({
    where: { id: assessment.id },
    data: {
      draftCurrentStep: body.currentStep,
      draftAnswerSnapshot: body.answers as Prisma.InputJsonValue,
      draftConsumptionSnapshot:
        weeklyConsumptionDays === null
          ? Prisma.DbNull
          : (weeklyConsumptionDays as Prisma.InputJsonValue),
      draftVersion: { increment: 1 },
      updatedByUserId: patientId,
    },
  });

  return projectCheckInState({
    availability: periodAvailability(period, now),
    period,
    assessment: updated,
    context,
    safety,
    now,
  });
}
