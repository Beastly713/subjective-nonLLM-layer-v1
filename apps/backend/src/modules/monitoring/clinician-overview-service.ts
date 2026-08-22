import {
  ClinicianOverviewResponseSchema,
  ClinicianPatientDetailResponseSchema,
  type ClinicianPatientDetailResponse,
  type ClinicianTimelineItem,
} from '@aud-subjective/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Clock } from '../../shared/clock/clock.js';
import { readClinicianPatientMonitoring } from '../clinical/service.js';
import { readClinicianEngagementDetail } from '../engagement/service.js';
import { readPatientProgress } from './progress-service.js';
import { DomainError } from '../../shared/errors/domain-error.js';

type Tx = Prisma.TransactionClient;

const ATTENTION_STATES = [
  'OVERDUE',
  'AT_RISK_OF_DISENGAGEMENT',
  'DISENGAGED',
  'TECHNICAL_FAILURE',
] as const;

function stringArray(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function periodLabel(start: Date, end: Date) {
  return `${start.toISOString().slice(0, 10)} – ${end
    .toISOString()
    .slice(0, 10)}`;
}

function daysOverdue(dueAt: Date | null, now: Date) {
  if (!dueAt || dueAt >= now) return 0;
  return Math.floor((now.getTime() - dueAt.getTime()) / 86_400_000);
}

function severityRank(value: string) {
  return {
    S0_EMERGENCY: 0,
    S1_URGENT: 1,
    S2_PRIORITY: 2,
    S3_ROUTINE: 3,
  }[value] ?? 99;
}

function safeSeverity(value: string) {
  return value === 'S0_EMERGENCY' ||
    value === 'S1_URGENT' ||
    value === 'S2_PRIORITY' ||
    value === 'S3_ROUTINE'
    ? value
    : null;
}

async function assignedPatients(tx: Tx, clinicianId: string) {
  const assignments = await tx.clinicianPatientAssignment.findMany({
    where: { clinicianUserId: clinicianId, endedAt: null },
    select: { patientId: true },
    orderBy: [{ patientId: 'asc' }, { id: 'asc' }],
  });
  return [...new Set(assignments.map((assignment) => assignment.patientId))];
}

export async function readClinicianOverview(
  tx: Tx,
  clock: Clock,
  clinicianId: string,
) {
  const patientIds = await assignedPatients(tx, clinicianId);
  if (patientIds.length === 0) {
    return ClinicianOverviewResponseSchema.parse({
      assignedPatients: 0,
      openClinicalReviewWork: 0,
      engagementAttention: 0,
      activeSafetyWork: 0,
      monitoring: { current: 0, stale: 0, unavailable: 0 },
      clinicalReview: [],
      engagement: [],
      safety: [],
    });
  }

  const now = clock.now();
  const [patients, cases, states, safetyCases, periods, assessments] =
    await Promise.all([
      tx.user.findMany({
        where: { id: { in: patientIds } },
        select: { id: true, name: true },
      }),
      tx.clinicalReviewCase.findMany({
        where: {
          patientId: { in: patientIds },
          lifecycle: {
            in: ['NEW', 'ACKNOWLEDGED', 'ACTIVE', 'CLEARANCE_PENDING'],
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
      tx.engagementState.findMany({
        where: { patientId: { in: patientIds } },
        include: { missedCyclePeriod: true },
      }),
      tx.safetyCase.findMany({
        where: { patientId: { in: patientIds }, resolvedAt: null },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
      tx.scheduledPeriod.findMany({
        where: { patientId: { in: patientIds } },
        orderBy: [{ periodStartAt: 'desc' }, { id: 'desc' }],
      }),
      tx.weeklyAssessment.findMany({
        where: { patientId: { in: patientIds }, authoritativeRevisionId: { not: null } },
        include: {
          scheduledPeriod: true,
          authoritativeRevision: {
            select: { id: true, submittedAt: true },
          },
        },
      }),
    ]);

  const names = new Map(patients.map((patient) => [patient.id, patient.name]));
  const latestPeriodByPatient = new Map<string, (typeof periods)[number]>();
  for (const period of periods) {
    if (!latestPeriodByPatient.has(period.patientId)) {
      latestPeriodByPatient.set(period.patientId, period);
    }
  }
  const latestAssessmentByPatient = new Map<
    string,
    (typeof assessments)[number]
  >();
  for (const assessment of assessments) {
    const current = latestAssessmentByPatient.get(assessment.patientId);
    if (
      !current ||
      assessment.scheduledPeriod.periodStartAt > current.scheduledPeriod.periodStartAt
    ) {
      latestAssessmentByPatient.set(assessment.patientId, assessment);
    }
  }

  let current = 0;
  let stale = 0;
  let unavailable = 0;
  for (const patientId of patientIds) {
    const latestAssessment = latestAssessmentByPatient.get(patientId);
    const latestPeriod = latestPeriodByPatient.get(patientId);
    if (!latestAssessment) {
      unavailable += 1;
    } else if (
      latestPeriod &&
      latestPeriod.id !== latestAssessment.scheduledPeriodId &&
      latestPeriod.effectiveDueAt <= now
    ) {
      stale += 1;
    } else {
      current += 1;
    }
  }

  const clinicalReview = cases.slice(0, 8).map((row) => ({
    patientId: row.patientId,
    patientName: names.get(row.patientId) ?? 'Assigned patient',
    lifecycle: row.lifecycle,
    reasons: stringArray(row.activeReasonFamilies),
    updatedAt: row.updatedAt.toISOString(),
  }));

  const attentionStates = states
    .filter((state) => ATTENTION_STATES.includes(state.state as (typeof ATTENTION_STATES)[number]))
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const engagement = attentionStates.slice(0, 8).map((state) => ({
    patientId: state.patientId,
    patientName: names.get(state.patientId) ?? 'Assigned patient',
    state: state.state,
    daysOverdue: daysOverdue(state.missedCyclePeriod?.effectiveDueAt ?? null, now),
  }));

  const safety = safetyCases.slice(0, 8).map((row) => ({
    patientId: row.patientId,
    patientName: names.get(row.patientId) ?? 'Assigned patient',
    severity: safeSeverity(row.severity) ?? 'S3_ROUTINE',
    domain: row.domain,
    lifecycle: row.lifecycle,
  }));

  return ClinicianOverviewResponseSchema.parse({
    assignedPatients: patientIds.length,
    openClinicalReviewWork: cases.length,
    engagementAttention: attentionStates.length,
    activeSafetyWork: safetyCases.length,
    monitoring: { current, stale, unavailable },
    clinicalReview,
    engagement,
    safety,
  });
}

function timelineItem(
  input: Omit<ClinicianTimelineItem, 'id'> & { id: string },
): ClinicianTimelineItem {
  return input;
}

export async function readClinicianPatientDetail(input: {
  tx: Tx;
  clock: Clock;
  clinicianId: string;
  patientId: string;
}): Promise<ClinicianPatientDetailResponse> {
  const assignment = await input.tx.clinicianPatientAssignment.findFirst({
    where: {
      clinicianUserId: input.clinicianId,
      patientId: input.patientId,
      endedAt: null,
    },
    select: { id: true },
  });
  if (!assignment) {
    throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
  }

  const [monitoring, engagement, progress, patient, safetyCases, assessments, clinicalEvents, engagementEvents, safetyEvents, supportAudits, goals] =
    await Promise.all([
      readClinicianPatientMonitoring({
        tx: input.tx,
        clock: input.clock,
        clinicianId: input.clinicianId,
        patientId: input.patientId,
      }),
      readClinicianEngagementDetail({
        tx: input.tx,
        clock: input.clock,
        clinicianId: input.clinicianId,
        patientId: input.patientId,
      }),
      readPatientProgress(input.tx, input.clock, input.patientId),
      input.tx.user.findUnique({
        where: { id: input.patientId },
        select: { name: true },
      }),
      input.tx.safetyCase.findMany({
        where: { patientId: input.patientId, resolvedAt: null },
        select: { id: true, severity: true },
      }),
      input.tx.weeklyAssessment.findMany({
        where: { patientId: input.patientId, authoritativeRevisionId: { not: null } },
        include: {
          scheduledPeriod: true,
          authoritativeRevision: {
            select: {
              id: true,
              revisionNumber: true,
              completionStatus: true,
              submissionClassification: true,
              submittedAt: true,
            },
          },
        },
      }),
      input.tx.clinicalCaseEvent.findMany({
        where: { patientId: input.patientId },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 20,
      }),
      input.tx.engagementCaseEvent.findMany({
        where: { patientId: input.patientId },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 20,
      }),
      input.tx.safetyCaseLifecycleEvent.findMany({
        where: { safetyCase: { patientId: input.patientId } },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 20,
      }),
      input.tx.contentDeliveryAudit.findMany({
        where: { patientId: input.patientId },
        orderBy: [{ deliveredAt: 'desc' }, { id: 'desc' }],
        take: 20,
      }),
      input.tx.recoveryGoalVersion.findMany({
        where: { patientId: input.patientId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
      }),
    ]);

  if (!patient) {
    throw new DomainError(404, 'NOT_FOUND', 'The requested resource was not found.');
  }

  const timeline: ClinicianTimelineItem[] = [];
  for (const assessment of assessments) {
    const revision = assessment.authoritativeRevision;
    if (!revision) continue;
    const type =
      revision.submissionClassification === 'HISTORICAL_BACKFILL'
        ? 'BACKFILL'
        : revision.submissionClassification === 'PATIENT_CORRECTION' ||
            revision.submissionClassification === 'STAFF_CORRECTION'
          ? 'CORRECTION'
          : 'ASSESSMENT';
    const title =
      type === 'BACKFILL'
        ? 'Historical check-in added'
        : type === 'CORRECTION'
          ? 'Check-in corrected'
          : 'Weekly check-in recorded';
    timeline.push(
      timelineItem({
        id: `assessment:${revision.id}`,
        type,
        title,
        description: `${periodLabel(
          assessment.scheduledPeriod.periodStartAt,
          assessment.scheduledPeriod.periodEndAt,
        )} · ${revision.completionStatus.toLowerCase()} · revision ${revision.revisionNumber}`,
        occurredAt: revision.submittedAt.toISOString(),
        periodId: assessment.scheduledPeriodId,
        status: revision.completionStatus,
      }),
    );
  }

  for (const event of clinicalEvents) {
    timeline.push(
      timelineItem({
        id: `clinical:${event.id}`,
        type: 'CLINICAL_CASE',
        title: 'Clinical review updated',
        description: event.reasonFamily
          ? `Reason context: ${event.reasonFamily.toLowerCase().replaceAll('_', ' ')}`
          : 'The assigned clinical review state changed.',
        occurredAt: event.occurredAt.toISOString(),
        periodId: event.sourcePeriodId,
        status: event.toLifecycle ?? event.eventType,
      }),
    );
  }
  for (const event of engagementEvents) {
    timeline.push(
      timelineItem({
        id: `engagement:${event.id}`,
        type: 'ENGAGEMENT',
        title: 'Engagement state updated',
        description: 'Missed check-in follow-up state changed.',
        occurredAt: event.occurredAt.toISOString(),
        periodId: null,
        status: event.toLifecycle ?? event.eventType,
      }),
    );
  }
  for (const event of safetyEvents) {
    timeline.push(
      timelineItem({
        id: `safety:${event.id}`,
        type: 'SAFETY',
        title: 'Safety handoff updated',
        description: 'A safety case lifecycle event was recorded.',
        occurredAt: event.occurredAt.toISOString(),
        periodId: null,
        status: event.toState,
      }),
    );
  }
  for (const audit of supportAudits) {
    timeline.push(
      timelineItem({
        id: `support:${audit.id}`,
        type: 'SUPPORT',
        title: 'Support made available',
        description: 'Governed in-app support was recorded for this patient.',
        occurredAt: audit.deliveredAt.toISOString(),
        periodId: null,
        status: audit.channel,
      }),
    );
  }
  for (const goal of goals) {
    timeline.push(
      timelineItem({
        id: `goal:${goal.id}`,
        type: 'GOAL',
        title: 'Recovery goal recorded',
        description: `${goal.goal.toLowerCase()} · goal version ${goal.goalVersion}`,
        occurredAt: goal.createdAt.toISOString(),
        periodId: goal.effectiveFromPeriodId,
        status: goal.status,
      }),
    );
  }

  timeline.sort((left, right) => {
    const dateDifference =
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
    return dateDifference || right.id.localeCompare(left.id);
  });

  const rankedSafety = safetyCases
    .map((row) => safeSeverity(row.severity))
    .filter((value): value is NonNullable<ReturnType<typeof safeSeverity>> => value !== null)
    .sort((left, right) => severityRank(left) - severityRank(right));

  return ClinicianPatientDetailResponseSchema.parse({
    patientId: input.patientId,
    patientName: patient.name,
    monitoring,
    engagement,
    safety: {
      activeCaseCount: safetyCases.length,
      highestSeverity: rankedSafety[0] ?? null,
    },
    trajectories: progress.points,
    timeline: timeline.slice(0, 40),
  });
}
