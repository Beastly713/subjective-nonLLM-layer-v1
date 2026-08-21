import { z } from 'zod';

export const SubjectiveMonitoringPolicyProvenanceSchema = z.object({
  ruleSetVersion: z.string().min(1),
  configurationVersion: z.string().min(1),
});

export type SubjectiveMonitoringPolicyProvenance = z.infer<
  typeof SubjectiveMonitoringPolicyProvenanceSchema
>;
