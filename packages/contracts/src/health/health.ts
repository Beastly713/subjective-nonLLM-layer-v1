import { z } from 'zod';

export const LivenessResponseSchema = z.object({
  status: z.literal('live'),
});

export const ReadinessCheckStatusSchema = z.enum(['ready', 'not_ready']);

export const ReadinessResponseSchema = z.object({
  status: ReadinessCheckStatusSchema,
  checks: z.object({
    configuration: z.literal('ready'),
    prisma: z.literal('ready'),
    postgres: ReadinessCheckStatusSchema,
    authentication: ReadinessCheckStatusSchema,
    authorization: ReadinessCheckStatusSchema,
    regionalRoutingSchema: ReadinessCheckStatusSchema,
    onboardingSafetySchema: ReadinessCheckStatusSchema,
    safetyRoutingContext: z.enum(['configured', 'unconfigured']),
    safetyInstrumentConfiguration: z.enum(['available', 'unavailable']),
    regionalRoutingConfiguration: z.enum([
      'active_present',
      'none_active',
      'unknown',
    ]),
    realPatientOperation: z.literal('not_ready'),
    authEmailDelivery: z.enum(['available', 'unavailable']),
  }),
});

export type LivenessResponse = z.infer<typeof LivenessResponseSchema>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
