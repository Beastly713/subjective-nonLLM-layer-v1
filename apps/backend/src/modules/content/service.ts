import {
  ContentInterventionClassSchema,
  type ContentFeedbackOutcome,
  type ContentInterventionClass,
  type PatientSupportResponse,
} from '@aud-subjective/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { loadPatientSafetyProjection } from '../safety/projections.js';
import type { Clock } from '../../shared/clock/clock.js';
import {
  CONTENT_INTERVENTION_CLASSES,
  CONTENT_LANGUAGE,
  CONTENT_LOCALE,
  CONTENT_RESOLVER_VERSION,
  HIGH_FREQUENCY_CLASSES,
  NOT_HELPFUL_SUPPRESSION_DAYS,
  RESOURCE_COOLDOWN_DAYS,
  SUPPORT_TYPE_LABELS,
  SUPPORT_TYPE_OPTIONS,
  type ContentPreferenceContext,
  type ContentSafetyContext,
} from './types.js';

type Tx = Prisma.TransactionClient;
type JsonInput = Prisma.InputJsonValue;

const json = (value: unknown) => value as JsonInput;

function stringArray(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function objectValue(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function plusDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1_000);
}

function currentSafetyGate(safety: ContentSafetyContext) {
  return safety.safetyState === 'REVIEW_REQUIRED'
    ? 'ALLOW_WITH_HANDOFF'
    : 'ALLOW_MONITORING';
}

function minimumResourceVolume(interventionClass: ContentInterventionClass) {
  return HIGH_FREQUENCY_CLASSES.has(interventionClass) ? 3 : 2;
}

function preferenceCompatible(
  version: {
    mutualHelpRequirement: string;
    spiritualRequirement: string;
  },
  preferences: ContentPreferenceContext,
) {
  if (
    version.mutualHelpRequirement !== 'ANY' &&
    version.mutualHelpRequirement !== preferences.mutualHelpPreference
  ) {
    return false;
  }

  if (
    version.spiritualRequirement === 'ALLOW_ONLY' &&
    preferences.spiritualContentPreference !== 'ALLOW'
  ) {
    return false;
  }

  if (
    version.spiritualRequirement === 'DO_NOT_ALLOW' &&
    preferences.spiritualContentPreference === 'DO_NOT_ALLOW'
  ) {
    return false;
  }

  return true;
}

function safetyCompatible(
  version: {
    safetyGateCompatibility: Prisma.JsonValue;
    contraindications: Prisma.JsonValue;
  },
  interventionClass: ContentInterventionClass,
  safety: ContentSafetyContext,
) {
  if (safety.requiresSafetyShell || safety.monitoringPromptPolicy === 'PAUSE') {
    return false;
  }

  if (
    safety.allowedSubjectiveInterventions.length > 0 &&
    !safety.allowedSubjectiveInterventions.includes(interventionClass)
  ) {
    return false;
  }

  const compatibleGates = stringArray(version.safetyGateCompatibility);
  if (
    compatibleGates.length > 0 &&
    !compatibleGates.includes(currentSafetyGate(safety))
  ) {
    return false;
  }

  const contraindications = stringArray(version.contraindications);
  if (
    contraindications.includes('ACTIVE_SAFETY_CASE') &&
    safety.safetyState !== 'MONITORING_AVAILABLE'
  ) {
    return false;
  }

  return true;
}

function goalCompatible(
  version: { recoveryGoalsAllowed: Prisma.JsonValue },
  goal: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE',
) {
  const allowed = stringArray(version.recoveryGoalsAllowed);
  return allowed.includes('ANY') || allowed.includes(goal);
}

function channelCompatible(version: { deliveryChannels: Prisma.JsonValue }) {
  const channels = stringArray(version.deliveryChannels);
  return channels.includes('IN_APP');
}

type Selection = {
  resourceId: string;
  resourceVersionId: string;
  interventionClass: ContentInterventionClass;
  title: string;
  markdownBody: string;
  estimatedDurationSeconds: number;
  selectionReasons: string[];
  filterSummary: Record<string, number>;
  cooldownResult: {
    override: 'USER_REQUEST' | null;
    lastShownAt: string | null;
  };
};

type ResourceFilterSummary = {
  approved: number;
  goal: number;
  preference: number;
  safety: number;
  channel: number;
  suppressed: number;
  volume: number;
  cooldown: number;
};

async function activeSuppression(
  tx: Tx,
  patientId: string,
  interventionClass: ContentInterventionClass,
  resourceId: string,
  now: Date,
) {
  return tx.contentSuppression.findFirst({
    where: {
      patientId,
      startsAt: { lte: now },
      endedAt: null,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        {
          OR: [
            { scope: 'INTERVENTION_CLASS', interventionClass },
            { scope: 'RESOURCE', resourceId },
          ],
        },
      ],
    },
  });
}

async function chooseResourceForClass(input: {
  tx: Tx;
  patientId: string;
  interventionClass: ContentInterventionClass;
  goal: 'ABSTINENCE' | 'REDUCTION' | 'UNSURE';
  preferences: ContentPreferenceContext;
  safety: ContentSafetyContext;
  now: Date;
  userRequest?: boolean;
  excludedResourceIds?: ReadonlySet<string>;
}) {
  const {
    tx,
    patientId,
    interventionClass,
    goal,
    preferences,
    safety,
    now,
    userRequest = false,
    excludedResourceIds = new Set<string>(),
  } = input;

  const versions = await tx.contentResourceVersion.findMany({
    where: {
      interventionClass,
      locale: CONTENT_LOCALE,
      language: CONTENT_LANGUAGE,
      reviewStatus: 'APPROVED',
      enabled: true,
      effectiveFrom: { lte: now },
      OR: [{ retiredAt: null }, { retiredAt: { gt: now } }],
    },
    orderBy: [{ resourceId: 'asc' }, { version: 'desc' }],
  });

  const filterSummary: ResourceFilterSummary = {
    approved: versions.length,
    goal: 0,
    preference: 0,
    safety: 0,
    channel: 0,
    suppressed: 0,
    volume: 0,
    cooldown: 0,
  };

  const base = [] as typeof versions;
  for (const version of versions) {
    if (!goalCompatible(version, goal)) continue;
    filterSummary.goal += 1;
    if (!preferenceCompatible(version, preferences)) continue;
    filterSummary.preference += 1;
    if (!safetyCompatible(version, interventionClass, safety)) continue;
    filterSummary.safety += 1;
    if (!channelCompatible(version)) continue;
    filterSummary.channel += 1;
    if (excludedResourceIds.has(version.resourceId)) continue;
    if (
      await activeSuppression(
        tx,
        patientId,
        interventionClass,
        version.resourceId,
        now,
      )
    ) {
      filterSummary.suppressed += 1;
      continue;
    }
    base.push(version);
  }

  if (base.length < minimumResourceVolume(interventionClass)) {
    filterSummary.volume = base.length;
    return null;
  }

  const resourceIds = base.map((version) => version.resourceId);
  const [audits, helpful] = await Promise.all([
    tx.contentDeliveryAudit.findMany({
      where: { patientId, resourceId: { in: resourceIds } },
      select: { resourceId: true, deliveredAt: true },
      orderBy: { deliveredAt: 'desc' },
    }),
    tx.contentFeedback.findMany({
      where: {
        patientId,
        resourceId: { in: resourceIds },
        outcome: 'HELPFUL',
      },
      select: { resourceId: true },
    }),
  ]);

  const lastShown = new Map<string, Date>();
  const exposureCount = new Map<string, number>();
  for (const audit of audits) {
    if (!lastShown.has(audit.resourceId)) {
      lastShown.set(audit.resourceId, audit.deliveredAt);
    }
    exposureCount.set(
      audit.resourceId,
      (exposureCount.get(audit.resourceId) ?? 0) + 1,
    );
  }
  const helpfulIds = new Set(helpful.map((item) => item.resourceId));
  const cooldownBoundary = plusDays(
    now,
    -RESOURCE_COOLDOWN_DAYS,
  ).getTime();
  const outsideCooldown = base.filter((version) => {
    const shown = lastShown.get(version.resourceId);
    const available = !shown || shown.getTime() <= cooldownBoundary;
    if (!available) filterSummary.cooldown += 1;
    return available;
  });
  const pool = outsideCooldown.length > 0 ? outsideCooldown : userRequest ? base : [];

  if (pool.length === 0) return null;

  pool.sort((left, right) => {
    const helpfulDifference =
      Number(helpfulIds.has(right.resourceId)) -
      Number(helpfulIds.has(left.resourceId));
    if (helpfulDifference !== 0) return helpfulDifference;

    const leftNeverShown = lastShown.has(left.resourceId) ? 0 : 1;
    const rightNeverShown = lastShown.has(right.resourceId) ? 0 : 1;
    if (leftNeverShown !== rightNeverShown) return rightNeverShown - leftNeverShown;

    const leftShown = lastShown.get(left.resourceId)?.getTime() ?? 0;
    const rightShown = lastShown.get(right.resourceId)?.getTime() ?? 0;
    if (leftShown !== rightShown) return leftShown - rightShown;

    const exposureDifference =
      (exposureCount.get(left.resourceId) ?? 0) -
      (exposureCount.get(right.resourceId) ?? 0);
    if (exposureDifference !== 0) return exposureDifference;
    return left.resourceId.localeCompare(right.resourceId);
  });

  const selected = pool[0];
  if (!selected) return null;
  return {
    resourceId: selected.resourceId,
    resourceVersionId: selected.id,
    interventionClass,
    title: selected.title,
    markdownBody: selected.markdownBody,
    estimatedDurationSeconds: selected.estimatedDurationSeconds,
    selectionReasons: [
      helpfulIds.has(selected.resourceId)
        ? 'EXPLICITLY_HELPFUL'
        : !lastShown.has(selected.resourceId)
          ? 'NEVER_SHOWN'
          : 'ROTATION_ORDER',
    ],
    filterSummary,
    cooldownResult: {
      override:
        outsideCooldown.length === 0 && userRequest ? 'USER_REQUEST' : null,
      lastShownAt: lastShown.get(selected.resourceId)?.toISOString() ?? null,
    },
  } satisfies Selection;
}

export function safetyContextFromProjection(
  safety: Awaited<ReturnType<typeof loadPatientSafetyProjection>>,
): ContentSafetyContext {
  return {
    safetyState: safety.safetyState,
    requiresSafetyShell: safety.requiresSafetyShell,
    monitoringPromptPolicy: safety.monitoringPromptPolicy,
    allowedSubjectiveInterventions: safety.allowedSubjectiveInterventions,
  };
}

function preferenceContext(
  preference: {
    mutualHelpPreference: string | null;
    spiritualContentPreference: string | null;
  } | null,
): ContentPreferenceContext {
  return {
    mutualHelpPreference:
      (preference?.mutualHelpPreference as ContentPreferenceContext['mutualHelpPreference']) ??
      null,
    spiritualContentPreference:
      (preference?.spiritualContentPreference as ContentPreferenceContext['spiritualContentPreference']) ??
      null,
  };
}

function effectPlanSnapshot(value: Prisma.JsonValue) {
  const record = objectValue(value);
  const effectPlan = objectValue(record.effectPlan ?? value);
  const proactive = Array.isArray(effectPlan.candidatePatientInterventions)
    ? effectPlan.candidatePatientInterventions
    : [];
  const followUp = Array.isArray(effectPlan.followUpCandidates)
    ? effectPlan.followUpCandidates
    : [];
  return {
    proactive: proactive.filter((item): item is Record<string, Prisma.JsonValue> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item)),
    ),
    followUp: followUp.filter((item): item is Record<string, Prisma.JsonValue> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item)),
    ),
  };
}

function interventionClass(value: Prisma.JsonValue | undefined) {
  return ContentInterventionClassSchema.safeParse(value).success
    ? (value as ContentInterventionClass)
    : null;
}

async function createDeliveryAudit(input: {
  tx: Tx;
  patientId: string;
  resolution: {
    id: string;
    sourceAssessmentId: string;
    sourceEvaluationId: string;
  };
  selection: Selection;
  intentId?: string | null;
  now: Date;
}) {
  await input.tx.contentDeliveryAudit.upsert({
    where: {
      resolutionId_resourceId: {
        resolutionId: input.resolution.id,
        resourceId: input.selection.resourceId,
      },
    },
    create: {
      patientId: input.patientId,
      sourceAssessmentId: input.resolution.sourceAssessmentId,
      sourceEvaluationId: input.resolution.sourceEvaluationId,
      resolutionId: input.resolution.id,
      intentId: input.intentId ?? null,
      interventionClass: input.selection.interventionClass,
      resourceId: input.selection.resourceId,
      resourceVersionId: input.selection.resourceVersionId,
      selectionReasons: json(input.selection.selectionReasons),
      preferenceFilters: json({ locale: CONTENT_LOCALE }),
      contraindicationResult: json({ passed: true }),
      cooldownResult: json(input.selection.cooldownResult),
      deliveredAt: input.now,
      channel: 'IN_APP',
    },
    update: {},
  });
}

export async function resolveContentForEvaluation(input: {
  tx: Tx;
  evaluationId: string;
  safety: ContentSafetyContext;
  now: Date;
}) {
  const existing = await input.tx.contentResolutionRecord.findUnique({
    where: { sourceEvaluationId: input.evaluationId },
  });
  if (existing) return existing;

  const evaluation = await input.tx.assessmentEvaluation.findUnique({
    where: { id: input.evaluationId },
    select: {
      id: true,
      patientId: true,
      assessmentId: true,
      assessmentRevisionId: true,
      scheduledPeriodId: true,
      resultSnapshot: true,
      effectPlanSnapshot: true,
      recoveryGoalVersionId: true,
      preferenceVersionId: true,
    },
  });
  if (!evaluation) return null;

  const [goalVersion, preference, intents] = await Promise.all([
    evaluation.recoveryGoalVersionId
      ? input.tx.recoveryGoalVersion.findUnique({
          where: { id: evaluation.recoveryGoalVersionId },
          select: { goal: true },
        })
      : null,
    evaluation.preferenceVersionId
      ? input.tx.profilePreferenceVersion.findUnique({
          where: { id: evaluation.preferenceVersionId },
          select: {
            mutualHelpPreference: true,
            spiritualContentPreference: true,
          },
        })
      : null,
    input.tx.patientInterventionIntent.findMany({
      where: { evaluationId: input.evaluationId },
      select: { id: true, interventionClass: true, effect: true },
    }),
  ]);

  await input.tx.availableFollowup.updateMany({
    where: {
      patientId: evaluation.patientId,
      scheduledPeriodId: evaluation.scheduledPeriodId,
      supersededAt: null,
      sourceEvaluationId: { not: evaluation.id },
    },
    data: { supersededAt: input.now },
  });

  const snapshot = effectPlanSnapshot(
    evaluation.effectPlanSnapshot ?? evaluation.resultSnapshot,
  );
  const intentByClass = new Map(
    intents.map((intent) => [intent.interventionClass, intent]),
  );
  const selected: Selection[] = [];
  const filterSummary: Record<string, Prisma.JsonValue> = {};
  const cooldownResult: Record<string, Prisma.JsonValue> = {};
  const goal = goalVersion?.goal ?? 'UNSURE';
  const preferences = preferenceContext(preference);

  for (const candidate of snapshot.proactive) {
    const className = interventionClass(candidate.interventionClass);
    const intent = className ? intentByClass.get(className) : undefined;
    if (!className || !intent || intent.effect !== 'ELIGIBLE') continue;
    const selection = await chooseResourceForClass({
      tx: input.tx,
      patientId: evaluation.patientId,
      interventionClass: className,
      goal,
      preferences,
      safety: input.safety,
      now: input.now,
      excludedResourceIds: new Set(selected.map((item) => item.resourceId)),
    });
    if (!selection) continue;
    selected.push(selection);
    filterSummary[className] = selection.filterSummary;
    cooldownResult[className] = selection.cooldownResult;
  }

  const resolution = await input.tx.contentResolutionRecord.create({
    data: {
      patientId: evaluation.patientId,
      sourceAssessmentId: evaluation.assessmentId,
      sourceAssessmentRevisionId: evaluation.assessmentRevisionId,
      sourceEvaluationId: evaluation.id,
      scheduledPeriodId: evaluation.scheduledPeriodId,
      resolverInputVersion: CONTENT_RESOLVER_VERSION,
      contentResult: selected.length > 0 ? 'SELECTED' : 'CONTENT_UNAVAILABLE',
      selectedResourceIds: json(selected.map((item) => item.resourceId)),
      selectedResourceVersionIds: json(
        selected.map((item) => item.resourceVersionId),
      ),
      selectedInterventionClasses: json(
        selected.map((item) => item.interventionClass),
      ),
      selectionReasons: json(
        Object.fromEntries(
          selected.map((item) => [item.interventionClass, item.selectionReasons]),
        ),
      ),
      filterSummary: json(filterSummary),
      cooldownResult: json(cooldownResult),
      effectResult: json({
        proactive: snapshot.proactive,
        followUp: snapshot.followUp,
      }),
      resolvedAt: input.now,
    },
  });

  const followupExpiry = await input.tx.scheduledPeriod.findUnique({
    where: { id: evaluation.scheduledPeriodId },
    select: { periodEndAt: true },
  });

  if (followupExpiry) {
    for (const candidate of snapshot.followUp) {
      const className = interventionClass(candidate.interventionClass);
      if (
        !className ||
        candidate.effect !== 'ELIGIBLE' ||
        selected.some((item) => item.interventionClass === className)
      ) {
        continue;
      }
      const selection = await chooseResourceForClass({
        tx: input.tx,
        patientId: evaluation.patientId,
        interventionClass: className,
        goal,
        preferences,
        safety: input.safety,
        now: input.now,
      });
      if (!selection) continue;
      await input.tx.availableFollowup.create({
        data: {
          patientId: evaluation.patientId,
          sourceEvaluationId: evaluation.id,
          sourceAssessmentRevisionId: evaluation.assessmentRevisionId,
          scheduledPeriodId: evaluation.scheduledPeriodId,
          interventionClass: className,
          resourceId: selection.resourceId,
          resourceVersionId: selection.resourceVersionId,
          availableFrom: input.now,
          expiresAt: followupExpiry.periodEndAt,
        },
      });
    }
  }

  return resolution;
}

function sourceProjection(input: {
  periodId: string;
  revisionId: string;
  completionStatus: 'PARTIAL' | 'COMPLETE';
  submittedAt: Date;
}) {
  return {
    periodId: input.periodId,
    revisionId: input.revisionId,
    completionStatus: input.completionStatus,
    submittedAt: input.submittedAt.toISOString(),
  };
}

function safeResourceView(input: {
  resource: {
    resourceId: string;
    resourceVersionId: string;
    title: string;
    markdownBody: string;
    estimatedDurationSeconds: number;
  };
  resolutionId: string;
  isFollowup: boolean;
}) {
  return {
    resourceId: input.resource.resourceId,
    resourceVersionId: input.resource.resourceVersionId,
    resolutionId: input.resolutionId,
    title: input.resource.title,
    bodyMarkdown: input.resource.markdownBody,
    estimatedDurationSeconds: input.resource.estimatedDurationSeconds,
    isFollowup: input.isFollowup,
    feedbackActions: [
      'DISMISS',
      'NOT_HELPFUL',
      'DONT_SHOW_THIS_TYPE',
    ] as ContentFeedbackOutcome[],
  };
}

async function currentSource(tx: Tx, patientId: string) {
  return tx.weeklyAssessment.findFirst({
    where: { patientId, authoritativeRevisionId: { not: null } },
    orderBy: { scheduledPeriod: { periodStartAt: 'desc' } },
    include: {
      scheduledPeriod: true,
      authoritativeRevision: { select: { id: true, completionStatus: true, submittedAt: true } },
    },
  });
}

async function hiddenClasses(tx: Tx, patientId: string, now: Date) {
  const rows = await tx.contentSuppression.findMany({
    where: {
      patientId,
      scope: 'INTERVENTION_CLASS',
      interventionClass: { not: null },
      endedAt: null,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { interventionClass: true },
  });
  const hidden = new Set(
    rows.flatMap((row) => (row.interventionClass ? [row.interventionClass] : [])),
  );
  return SUPPORT_TYPE_OPTIONS.filter((item) => hidden.has(item.key));
}

export async function readPatientSupport(
  tx: Tx,
  clock: Clock,
  patientId: string,
): Promise<PatientSupportResponse> {
  const now = clock.now();
  const [safety, source, hidden] = await Promise.all([
    loadPatientSafetyProjection(tx, patientId),
    currentSource(tx, patientId),
    hiddenClasses(tx, patientId, now),
  ]);
  const safetyContext = safetyContextFromProjection(safety);
  const base = {
    primary: null,
    secondary: null,
    availableFollowup: [],
    exploreOptions: SUPPORT_TYPE_OPTIONS,
    hiddenInterventionClasses: hidden,
    source: source?.authoritativeRevision
      ? sourceProjection({
          periodId: source.scheduledPeriodId,
          revisionId: source.authoritativeRevision.id,
          completionStatus: source.authoritativeRevision.completionStatus,
          submittedAt: source.authoritativeRevision.submittedAt,
        })
      : null,
  } satisfies Omit<PatientSupportResponse, 'status'>;

  if (safetyContext.requiresSafetyShell || safetyContext.monitoringPromptPolicy === 'PAUSE') {
    return { ...base, status: 'SAFETY_CONTROLLED' };
  }
  if (!source?.authoritativeRevision) {
    return { ...base, status: 'NO_CURRENT_SUPPORT' };
  }

  const evaluation = await tx.assessmentEvaluation.findFirst({
    where: {
      assessmentRevisionId: source.authoritativeRevision.id,
      lifecycle: 'ACTIVE',
    },
    orderBy: { evaluatedAt: 'desc' },
  });
  if (!evaluation) return { ...base, status: 'NO_CURRENT_SUPPORT' };

  const resolution = await tx.contentResolutionRecord.findUnique({
    where: { sourceEvaluationId: evaluation.id },
  });
  if (!resolution) return { ...base, status: 'NO_CURRENT_SUPPORT' };

  const selectedResourceIds = stringArray(resolution.selectedResourceIds);
  const selectedVersionIds = stringArray(resolution.selectedResourceVersionIds);
  const selectedVersions = await tx.contentResourceVersion.findMany({
    where: {
      id: {
        in: selectedVersionIds.length
          ? selectedVersionIds
          : ['00000000-0000-0000-0000-000000000000'],
      },
    },
  });
  const selectedByResource = new Map(
    selectedVersions.map((version) => [version.resourceId, version]),
  );
  const selectedResources: Array<ReturnType<typeof safeResourceView>> = [];
  for (const resourceId of selectedResourceIds) {
    const version = selectedByResource.get(resourceId);
    if (!version) continue;
    if (
      await activeSuppression(
        tx,
        patientId,
        version.interventionClass,
        version.resourceId,
        now,
      )
    ) {
      continue;
    }
    selectedResources.push(
      safeResourceView({
        resource: {
          resourceId: version.resourceId,
          resourceVersionId: version.id,
          title: version.title,
          markdownBody: version.markdownBody,
          estimatedDurationSeconds: version.estimatedDurationSeconds,
        },
        resolutionId: resolution.id,
        isFollowup: false,
      }),
    );
  }

  const followups = await tx.availableFollowup.findMany({
    where: {
      patientId,
      sourceEvaluationId: evaluation.id,
      supersededAt: null,
      availableFrom: { lte: now },
      expiresAt: { gt: now },
      resourceVersionId: { not: null },
    },
    orderBy: [{ interventionClass: 'asc' }, { id: 'asc' }],
  });
  const followupVersionIds = followups.flatMap((item) =>
    item.resourceVersionId ? [item.resourceVersionId] : [],
  );
  const followupVersions = await tx.contentResourceVersion.findMany({
    where: { id: { in: followupVersionIds.length ? followupVersionIds : ['00000000-0000-0000-0000-000000000000'] } },
  });
  const followupByVersion = new Map(
    followupVersions.map((version) => [version.id, version]),
  );
  const availableFollowup: Array<ReturnType<typeof safeResourceView>> = [];
  for (const followup of followups) {
    const version = followup.resourceVersionId
      ? followupByVersion.get(followup.resourceVersionId)
      : undefined;
    if (!version) continue;
    if (
      await activeSuppression(
        tx,
        patientId,
        version.interventionClass,
        version.resourceId,
        now,
      )
    ) {
      continue;
    }
    availableFollowup.push(
      safeResourceView({
        resource: {
          resourceId: version.resourceId,
          resourceVersionId: version.id,
          title: version.title,
          markdownBody: version.markdownBody,
          estimatedDurationSeconds: version.estimatedDurationSeconds,
        },
        resolutionId: resolution.id,
        isFollowup: true,
      }),
    );
  }

  const intentClasses = objectValue(resolution.selectionReasons);
  const selectionByResource = new Map<string, Selection>();
  for (const item of selectedVersions) {
    selectionByResource.set(item.resourceId, {
      resourceId: item.resourceId,
      resourceVersionId: item.id,
      interventionClass: item.interventionClass,
      title: item.title,
      markdownBody: item.markdownBody,
      estimatedDurationSeconds: item.estimatedDurationSeconds,
      selectionReasons: stringArray(intentClasses[item.interventionClass]),
      filterSummary: {},
      cooldownResult: { override: null, lastShownAt: null },
    });
  }
  const deliverable = [...selectedResources, ...availableFollowup];
  for (const item of deliverable) {
    const selected = selectionByResource.get(item.resourceId);
    if (selected) {
      await createDeliveryAudit({
        tx,
        patientId,
        resolution,
        selection: selected,
        intentId: null,
        now,
      });
    }
  }

  const hasContent = selectedResources.length > 0 || availableFollowup.length > 0;
  return {
    ...base,
    status:
      hasContent && resolution.contentResult === 'SELECTED'
        ? 'AVAILABLE'
        : 'CONTENT_UNAVAILABLE',
    primary: selectedResources[0] ?? null,
    secondary: selectedResources[1] ?? null,
    availableFollowup,
  };
}

export async function explorePatientSupport(input: {
  tx: Tx;
  clock: Clock;
  patientId: string;
  interventionClass: ContentInterventionClass;
}) {
  const now = input.clock.now();
  const [source, preference, safety, hidden] = await Promise.all([
    currentSource(input.tx, input.patientId),
    currentSource(input.tx, input.patientId).then((current) =>
      current?.scheduledPeriod
        ? input.tx.profilePreferenceVersion.findFirst({
            where: {
              patientId: input.patientId,
              createdAt: { lte: current.scheduledPeriod.periodStartAt },
            },
            orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
          })
        : null,
    ),
    loadPatientSafetyProjection(input.tx, input.patientId),
    hiddenClasses(input.tx, input.patientId, now),
  ]);
  const base = await readPatientSupport(input.tx, input.clock, input.patientId);
  if (!source?.authoritativeRevision || base.status === 'SAFETY_CONTROLLED') {
    return base;
  }
  if (hidden.some((item) => item.key === input.interventionClass)) return base;
  const evaluation = await input.tx.assessmentEvaluation.findFirst({
    where: {
      assessmentRevisionId: source.authoritativeRevision.id,
      lifecycle: 'ACTIVE',
    },
    orderBy: { evaluatedAt: 'desc' },
  });
  if (!evaluation) return base;
  const resolution = await input.tx.contentResolutionRecord.findUnique({
    where: { sourceEvaluationId: evaluation.id },
  });
  if (!resolution) return base;
  const goalVersion = evaluation.recoveryGoalVersionId
    ? await input.tx.recoveryGoalVersion.findUnique({
        where: { id: evaluation.recoveryGoalVersionId },
        select: { goal: true },
      })
    : null;
  const selection = await chooseResourceForClass({
    tx: input.tx,
    patientId: input.patientId,
    interventionClass: input.interventionClass,
    goal: goalVersion?.goal ?? 'UNSURE',
    preferences: preferenceContext(preference),
    safety: safetyContextFromProjection(safety),
    now,
    userRequest: true,
  });
  if (!selection) return base;
  await createDeliveryAudit({
    tx: input.tx,
    patientId: input.patientId,
    resolution,
    selection,
    now,
  });
  return {
    ...base,
    status: 'AVAILABLE' as const,
    primary: safeResourceView({
      resource: selection,
      resolutionId: resolution.id,
      isFollowup: true,
    }),
    secondary: null,
    availableFollowup: [],
  };
}

export async function recordContentFeedback(input: {
  tx: Tx;
  clock: Clock;
  patientId: string;
  resourceId: string;
  resourceVersionId: string;
  resolutionId: string;
  outcome: ContentFeedbackOutcome;
  requestId: string;
}) {
  const now = input.clock.now();
  const audit = await input.tx.contentDeliveryAudit.findFirst({
    where: {
      patientId: input.patientId,
      resourceId: input.resourceId,
      resourceVersionId: input.resourceVersionId,
      resolutionId: input.resolutionId,
    },
  });
  if (!audit) return null;
  const version = await input.tx.contentResourceVersion.findUnique({
    where: { id: input.resourceVersionId },
    select: { interventionClass: true },
  });
  if (!version) return null;
  const feedback = await input.tx.contentFeedback.create({
    data: {
      patientId: input.patientId,
      resourceId: input.resourceId,
      resourceVersionId: input.resourceVersionId,
      resolutionId: input.resolutionId,
      outcome: input.outcome,
      recordedAt: now,
    },
  });
  if (input.outcome === 'NOT_HELPFUL') {
    await input.tx.contentSuppression.create({
      data: {
        patientId: input.patientId,
        scope: 'RESOURCE',
        resourceId: input.resourceId,
        interventionClass: null,
        startsAt: now,
        expiresAt: plusDays(now, NOT_HELPFUL_SUPPRESSION_DAYS),
        sourceFeedbackId: feedback.id,
        reason: 'RESOURCE_NOT_HELPFUL',
      },
    });
  }
  if (input.outcome === 'DONT_SHOW_THIS_TYPE') {
    await input.tx.contentSuppression.create({
      data: {
        patientId: input.patientId,
        scope: 'INTERVENTION_CLASS',
        resourceId: null,
        interventionClass: version.interventionClass,
        startsAt: now,
        expiresAt: null,
        sourceFeedbackId: feedback.id,
        reason: 'INTERVENTION_CLASS_DONT_SHOW',
      },
    });
  }
  await input.tx.contentDeliveryAudit.update({
    where: { id: audit.id },
    data: { interactionOutcome: input.outcome },
  });
  await input.tx.auditEvent.create({
    data: {
      actorId: input.patientId,
      action:
        input.outcome === 'DONT_SHOW_THIS_TYPE'
          ? 'CONTENT_CLASS_SUPPRESSED'
          : input.outcome === 'NOT_HELPFUL'
            ? 'CONTENT_FEEDBACK_NOT_HELPFUL'
            : 'CONTENT_FEEDBACK_DISMISSED',
      entityType: 'CONTENT_RESOURCE',
      entityId: input.resourceId,
      patientId: input.patientId,
      requestId: input.requestId,
      metadata: {
        resourceVersionId: input.resourceVersionId,
        resolutionId: input.resolutionId,
        interventionClass: version.interventionClass,
      },
    },
  });
  return feedback;
}

export async function restoreContentClass(input: {
  tx: Tx;
  clock: Clock;
  patientId: string;
  interventionClass: ContentInterventionClass;
  requestId: string;
}) {
  const now = input.clock.now();
  await input.tx.contentSuppression.updateMany({
    where: {
      patientId: input.patientId,
      scope: 'INTERVENTION_CLASS',
      interventionClass: input.interventionClass,
      endedAt: null,
    },
    data: { endedAt: now },
  });
  await input.tx.auditEvent.create({
    data: {
      actorId: input.patientId,
      action: 'CONTENT_CLASS_RESTORED',
      entityType: 'CONTENT_INTERVENTION_CLASS',
      entityId: input.interventionClass,
      patientId: input.patientId,
      requestId: input.requestId,
    },
  });
}

export { CONTENT_INTERVENTION_CLASSES, SUPPORT_TYPE_LABELS };
