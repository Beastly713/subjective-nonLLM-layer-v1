import {
  CompleteOnboardingRequestSchema,
  OnboardingDraftSchema,
  OnboardingStateResponseSchema,
  RecoveryGoalProjectionSchema,
  SaveOnboardingDraftRequestSchema,
  SaveOnboardingDraftResponseSchema,
  SafetyInputSchema,
  SubmitOnboardingRequestSchema,
  SubmitOnboardingResponseSchema,
  auditCScore,
} from '@aud-subjective/contracts';
import type { FastifyInstance } from 'fastify';

import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { AppAuth } from '../../infrastructure/auth/auth.js';
import type { AppConfig } from '../../infrastructure/config/config.js';
import type { Clock } from '../../shared/clock/clock.js';
import { requirePermission } from '../../shared/authz/authorize.js';
import {
  executeIdempotently,
  requireIdempotencyKey,
} from '../../shared/authz/idempotency.js';
import { lockPatientForProcessing } from '../../shared/authz/patient-processing-lock.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import { loadPatientSafetyProjection } from '../safety/projections.js';
import { evaluatePatientSafety } from '../safety/service.js';
import { AUDIT_C_PROVENANCE } from './instrument-provenance.js';
import { completePatientOnboarding } from './activation-service.js';

function completeDraft(draft: ReturnType<typeof OnboardingDraftSchema.parse>) {
  const values = [
    draft.auditC.frequency,
    draft.auditC.quantity,
    draft.auditC.heavy,
    draft.drinkingDaysPerWeek,
    draft.drinksPerDrinkingDay,
    draft.heavyDrinkingDaysRecent,
    draft.recoveryDirection,
    draft.mutualHelpPreference,
    draft.spiritualContentPreference,
  ];
  if (values.some((value) => value.state === 'NOT_YET_ANSWERED')) {
    throw new DomainError(
      409,
      'ONBOARDING_INCOMPLETE',
      'Complete the required onboarding responses before submitting.',
    );
  }
  if (draft.lastDrink.state === 'KNOWN' && !draft.lastDrink.date) {
    throw new DomainError(
      409,
      'ONBOARDING_INCOMPLETE',
      'Complete the required onboarding responses before submitting.',
    );
  }
}

function baseOnboardingSnapshot(
  draft: ReturnType<typeof OnboardingDraftSchema.parse>,
) {
  const base = { ...draft };
  delete base.safetyDraft;
  return base;
}

export function registerOnboardingRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  auth: AppAuth,
  config: AppConfig,
  clock: Clock,
) {
  app.get('/api/v1/patient/onboarding', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ONBOARDING_READ',
    );
    if (!actor.access.scopeKinds.includes('OWN_PATIENT')) {
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    }
    const [state, safety, reductionSetup, currentGoal] = await Promise.all([
      prisma.patientOnboardingState.findUnique({
        where: { patientId: actor.userId },
        include: {
          authoritativeRevision: {
            select: { id: true, revision: true, submittedAt: true },
          },
        },
      }),
      loadPatientSafetyProjection(prisma, actor.userId),
      prisma.reductionSetupState.findUnique({
        where: { patientId: actor.userId },
        include: { authoritativeBaselineRevision: true },
      }),
      prisma.recoveryGoalVersion.findFirst({
        where: {
          patientId: actor.userId,
          status: {
            in: [
              'PENDING_CLINICAL_SAFETY_REVIEW',
              'ACTIVE',
              'SUSPENDED_SAFETY_HANDOFF',
            ],
          },
        },
        orderBy: { goalVersion: 'desc' },
      }),
    ]);
    const draft = state
      ? OnboardingDraftSchema.parse(state.draftResponses)
      : null;
    const recoveryDirection =
      draft?.recoveryDirection.state === 'ANSWERED'
        ? draft.recoveryDirection.value
        : 'UNSURE';
    const reductionSetupComplete = Boolean(
      reductionSetup?.authoritativeBaselineRevision &&
      reductionSetup.authoritativeBaselineRevision.lifecycle === 'CONFIRMED' &&
      reductionSetup.proposalKind &&
      reductionSetup.targetWeeklyStandardDrinks !== null &&
      reductionSetup.proposalBaselineRevisionId ===
        reductionSetup.authoritativeBaselineRevisionId,
    );
    const dependencyState =
      state?.completionStatus === 'COMPLETE'
        ? 'SETUP_COMPLETE'
        : safety.safetyState === 'HANDOFF_REQUIRED' ||
            (safety.safetyState === 'REVIEW_REQUIRED' &&
              !safety.goalChangeAllowed)
          ? 'SAFETY_REVIEW_REQUIRED'
          : !state?.authoritativeRevisionId
            ? 'SETUP_INCOMPLETE'
            : recoveryDirection === 'REDUCTION' && !reductionSetupComplete
              ? 'REDUCTION_SETUP_REQUIRED'
              : 'READY_TO_COMPLETE';

    const recoveryGoal = currentGoal
      ? RecoveryGoalProjectionSchema.parse({
          id: currentGoal.id,
          goalVersion: currentGoal.goalVersion,
          goal: currentGoal.goal,
          status: currentGoal.status,
          baselineRevisionId: currentGoal.baselineRevisionId,
          targetWeeklyStandardDrinks:
            currentGoal.targetWeeklyStandardDrinks === null
              ? null
              : Number(currentGoal.targetWeeklyStandardDrinks),
          effectiveFromPeriodId: currentGoal.effectiveFromPeriodId,
          setBy: currentGoal.setBy,
          createdAt: currentGoal.createdAt.toISOString(),
        })
      : null;

    return OnboardingStateResponseSchema.parse({
      draft,
      currentStep: state?.currentStep ?? 'ACCOUNT',
      version: state?.version ?? 0,
      authoritativeRevision: state?.authoritativeRevision
        ? {
            ...state.authoritativeRevision,
            submittedAt: state.authoritativeRevision.submittedAt.toISOString(),
          }
        : null,
      completionStatus: state?.completionStatus ?? 'INCOMPLETE',
      recoveryGoal,
      safety,
      dependencyState,
    });
  });

  app.put('/api/v1/patient/onboarding/draft', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ONBOARDING_UPDATE',
    );
    if (!actor.access.scopeKinds.includes('OWN_PATIENT')) {
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    }
    const body = SaveOnboardingDraftRequestSchema.parse(request.body);
    const savedAt = clock.now();
    const draftResponses = {
      ...body.draftResponses,
      ...(body.draftResponses.safetyDraft
        ? {
            safetyDraft: {
              ...body.draftResponses.safetyDraft,
              updatedAt: savedAt.toISOString(),
            },
          }
        : {}),
    };
    const score = auditCScore(draftResponses.auditC);

    return prisma.$transaction(async (tx) => {
      await lockPatientForProcessing(tx, actor.userId);
      const existing = await tx.patientOnboardingState.findUnique({
        where: { patientId: actor.userId },
      });
      if (existing?.completionStatus === 'COMPLETE') {
        throw new DomainError(
          409,
          'ONBOARDING_ALREADY_COMPLETE',
          'Completed onboarding cannot be resubmitted as initial setup.',
        );
      }
      if (
        (!existing && body.expectedVersion !== 0) ||
        (existing && existing.version !== body.expectedVersion)
      ) {
        throw new DomainError(
          409,
          'VERSION_CONFLICT',
          'The onboarding draft changed before this update.',
        );
      }

      const persistedDraft = {
        ...draftResponses,
        auditCScore: score,
      } as unknown as Prisma.InputJsonValue;
      const state = existing
        ? await tx.patientOnboardingState.update({
            where: { patientId: actor.userId },
            data: {
              currentStep: body.currentStep,
              draftResponses: persistedDraft,
              updatedByUserId: actor.userId,
              version: { increment: 1 },
            },
          })
        : await tx.patientOnboardingState.create({
            data: {
              patientId: actor.userId,
              version: 1,
              currentStep: body.currentStep,
              draftResponses: persistedDraft,
              createdByUserId: actor.userId,
              updatedByUserId: actor.userId,
            },
          });

      return SaveOnboardingDraftResponseSchema.parse({
        version: state.version,
        currentStep: state.currentStep,
        draft: OnboardingDraftSchema.parse(state.draftResponses),
      });
    });
  });

  app.post('/api/v1/patient/onboarding/submit', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ONBOARDING_UPDATE',
    );
    if (!actor.access.scopeKinds.includes('OWN_PATIENT')) {
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    }
    const body = SubmitOnboardingRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'PATIENT_ONBOARDING_SUBMIT',
      key,
      body,
      async (tx) => {
        await lockPatientForProcessing(tx, actor.userId);
        const state = await tx.patientOnboardingState.findUnique({
          where: { patientId: actor.userId },
        });
        if (state?.completionStatus === 'COMPLETE') {
          throw new DomainError(
            409,
            'ONBOARDING_ALREADY_COMPLETE',
            'Completed onboarding cannot be resubmitted as initial setup.',
          );
        }
        if (!state || state.version !== body.expectedVersion) {
          throw new DomainError(
            409,
            'VERSION_CONFLICT',
            'The onboarding draft changed before submission.',
          );
        }

        const draft = OnboardingDraftSchema.parse(state.draftResponses);
        completeDraft(draft);
        const latestRevision = await tx.onboardingRevision.findFirst({
          where: { patientId: actor.userId },
          orderBy: { revision: 'desc' },
          select: { revision: true },
        });
        const revision = await tx.onboardingRevision.create({
          data: {
            patientId: actor.userId,
            revision: (latestRevision?.revision ?? 0) + 1,
            sourceDraftVersion: state.version,
            responseSnapshot: baseOnboardingSnapshot(
              draft,
            ) as unknown as Prisma.InputJsonValue,
            auditCInstrument: AUDIT_C_PROVENANCE.instrument,
            auditCVersion: AUDIT_C_PROVENANCE.version,
            auditCSource: AUDIT_C_PROVENANCE.source,
            schemaVersion: 'onboarding_v1',
            submittingActorId: actor.userId,
            submittedAt: clock.now(),
          },
        });

        const previousAuthoritativeRevisionId = state.authoritativeRevisionId;
        await tx.patientOnboardingState.update({
          where: { patientId: actor.userId },
          data: {
            authoritativeRevisionId: revision.id,
            updatedByUserId: actor.userId,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorId: actor.userId,
            action: 'ONBOARDING_SUBMITTED',
            entityType: 'ONBOARDING_REVISION',
            entityId: revision.id,
            patientId: actor.userId,
            requestId: request.id,
          },
        });
        if (
          previousAuthoritativeRevisionId &&
          previousAuthoritativeRevisionId !== revision.id
        ) {
          await tx.auditEvent.create({
            data: {
              actorId: actor.userId,
              action: 'ONBOARDING_AUTHORITATIVE_REVISION_CHANGED',
              entityType: 'PATIENT_ONBOARDING_STATE',
              entityId: actor.userId,
              patientId: actor.userId,
              requestId: request.id,
              metadata: {
                previousAuthoritativeRevisionId,
                authoritativeRevisionId: revision.id,
              },
            },
          });
        }
        return SubmitOnboardingResponseSchema.parse({
          revisionId: revision.id,
          revision: revision.revision,
          setupState: 'INCOMPLETE',
        });
      },
    );
    return result.value;
  });

  app.post('/api/v1/patient/onboarding/complete', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ONBOARDING_UPDATE',
    );
    if (!actor.access.scopeKinds.includes('OWN_PATIENT')) {
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    }
    const body = CompleteOnboardingRequestSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'PATIENT_ONBOARDING_COMPLETE',
      key,
      body,
      (tx) =>
        completePatientOnboarding({
          tx,
          config,
          clock,
          patientId: actor.userId,
          actorId: actor.userId,
          requestId: request.id,
          authoritativeOnboardingRevisionId:
            body.authoritativeOnboardingRevisionId,
          ...(body.expectedReductionSetupVersion !== undefined
            ? {
                expectedReductionSetupVersion:
                  body.expectedReductionSetupVersion,
              }
            : {}),
        }),
    );
    return result.value;
  });

  app.post('/api/v1/patient/onboarding/safety-evaluations', async (request) => {
    const actor = await requirePermission(
      request,
      auth,
      prisma,
      config,
      'PATIENT_ONBOARDING_UPDATE',
    );
    if (!actor.access.scopeKinds.includes('OWN_PATIENT')) {
      throw new DomainError(
        403,
        'PERMISSION_DENIED',
        'The action is not permitted.',
      );
    }
    const input = SafetyInputSchema.parse(request.body);
    const key = requireIdempotencyKey(request.headers['idempotency-key']);
    const result = await executeIdempotently(
      prisma,
      actor.userId,
      'PATIENT_SAFETY_EVALUATE',
      key,
      input,
      (tx) =>
        evaluatePatientSafety({
          tx,
          config,
          clock,
          patientId: actor.userId,
          actorId: actor.userId,
          requestId: request.id,
          input,
        }),
    );
    return result.value;
  });
}
