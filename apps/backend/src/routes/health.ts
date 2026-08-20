import {
  LivenessResponseSchema,
  ReadinessResponseSchema,
} from '@aud-subjective/contracts';
import type { FastifyInstance } from 'fastify';

import type { PrismaClient } from '../generated/prisma/client.js';
import type { AppConfig } from '../infrastructure/config/config.js';
import { AUDIT_C_PROVENANCE } from '../modules/onboarding/instrument-provenance.js';
import { CSSRS_RECENT_PROVENANCE } from '../modules/safety/instrument-provenance.js';

export function registerHealthRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  config: AppConfig,
) {
  app.get('/health/live', () =>
    LivenessResponseSchema.parse({ status: 'live' }),
  );

  app.get('/health/ready', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      request.log.warn(
        { errorCode: 'DATABASE_UNAVAILABLE' },
        'Readiness check failed',
      );
      return reply.status(503).send(
        ReadinessResponseSchema.parse({
          status: 'not_ready',
          checks: {
            configuration: 'ready',
            prisma: 'ready',
            postgres: 'not_ready',
            authentication: 'not_ready',
            authorization: 'not_ready',
            regionalRoutingSchema: 'not_ready',
            onboardingSafetySchema: 'not_ready',
            safetyCaseSchema: 'not_ready',
            safetyRoutingContext: config.safetyRoutingCountryCode
              ? 'configured'
              : 'unconfigured',
            onboardingInstrumentConfiguration:
              AUDIT_C_PROVENANCE.configurationAvailable
                ? 'available'
                : 'unavailable',
            safetyInstrumentConfiguration:
              CSSRS_RECENT_PROVENANCE.configurationAvailable
                ? 'available'
                : 'unavailable',
            regionalRoutingConfiguration: 'unknown',
            realPatientOperation: 'not_ready',
            authEmailDelivery: config.authEmailDeliveryAvailable
              ? 'available'
              : 'unavailable',
          },
        }),
      );
    }

    let authSchemaReady = true;
    try {
      await prisma.user.findFirst({ select: { id: true } });
    } catch {
      authSchemaReady = false;
      request.log.warn(
        { errorCode: 'AUTH_SCHEMA_UNAVAILABLE' },
        'Authentication readiness check failed',
      );
    }

    const emailRequiredButUnavailable =
      config.appMode === 'real_patient' && !config.authEmailDeliveryAvailable;
    const authentication =
      authSchemaReady && !emailRequiredButUnavailable ? 'ready' : 'not_ready';

    let authorization: 'ready' | 'not_ready' = 'ready';
    try {
      await prisma.applicationAccount.findFirst({ select: { userId: true } });
    } catch {
      authorization = 'not_ready';
      request.log.warn(
        { errorCode: 'AUTHORIZATION_SCHEMA_UNAVAILABLE' },
        'Authorization readiness check failed',
      );
    }

    let regionalRoutingSchema: 'ready' | 'not_ready' = 'ready';
    let regionalRoutingConfiguration:
      | 'active_present'
      | 'none_active'
      | 'unknown' = 'none_active';
    try {
      const active = await prisma.regionalRoutingProfileVersion.findFirst({
        where: { lifecycle: 'ACTIVE' },
        select: { id: true },
      });
      regionalRoutingConfiguration = active ? 'active_present' : 'none_active';
    } catch {
      regionalRoutingSchema = 'not_ready';
      regionalRoutingConfiguration = 'unknown';
      request.log.warn(
        { errorCode: 'REGIONAL_ROUTING_SCHEMA_UNAVAILABLE' },
        'Regional routing readiness check failed',
      );
    }

    let onboardingSafetySchema: 'ready' | 'not_ready' = 'ready';
    try {
      await prisma.patientOnboardingState.findFirst({
        select: { patientId: true },
      });
      await prisma.safetyEvaluationResult.findFirst({ select: { id: true } });
    } catch {
      onboardingSafetySchema = 'not_ready';
      request.log.warn(
        { errorCode: 'ONBOARDING_SAFETY_SCHEMA_UNAVAILABLE' },
        'Onboarding safety readiness check failed',
      );
    }

    let safetyCaseSchema: 'ready' | 'not_ready' = 'ready';
    try {
      await prisma.safetyCase.findFirst({ select: { id: true } });
      await prisma.safetyCaseRestrictionVersion.findFirst({
        select: { id: true },
      });
      await prisma.safetyCaseDisposition.findFirst({ select: { id: true } });
      await prisma.safetyCaseLifecycleEvent.findFirst({ select: { id: true } });
    } catch {
      safetyCaseSchema = 'not_ready';
      request.log.warn(
        { errorCode: 'SAFETY_CASE_SCHEMA_UNAVAILABLE' },
        'Safety case readiness check failed',
      );
    }

    const platformFoundationReady =
      authentication === 'ready' &&
      authorization === 'ready' &&
      regionalRoutingSchema === 'ready' &&
      onboardingSafetySchema === 'ready' &&
      safetyCaseSchema === 'ready';

    const response = ReadinessResponseSchema.parse({
      status:
        config.appMode === 'real_patient' || !platformFoundationReady
          ? 'not_ready'
          : 'ready',
      checks: {
        configuration: 'ready',
        prisma: 'ready',
        postgres: 'ready',
        authentication,
        authorization,
        regionalRoutingSchema,
        onboardingSafetySchema,
        safetyCaseSchema,
        safetyRoutingContext: config.safetyRoutingCountryCode
          ? 'configured'
          : 'unconfigured',
        onboardingInstrumentConfiguration:
          AUDIT_C_PROVENANCE.configurationAvailable ? 'available' : 'unavailable',
        safetyInstrumentConfiguration:
          CSSRS_RECENT_PROVENANCE.configurationAvailable
            ? 'available'
            : 'unavailable',
        regionalRoutingConfiguration,
        realPatientOperation: 'not_ready',
        authEmailDelivery: config.authEmailDeliveryAvailable
          ? 'available'
          : 'unavailable',
      },
    });

    return response.status === 'not_ready'
      ? reply.status(503).send(response)
      : response;
  });
}
