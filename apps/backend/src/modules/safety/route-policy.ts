import type { SafetyDomain } from './domain/reasons.js';

export type RoutingTargetKind =
  | 'EMERGENCY_SERVICE'
  | 'CRISIS_SERVICE'
  | 'URGENT_MEDICAL_SERVICE'
  | 'ON_CALL_CLINICIAN_QUEUE';

export const SAFETY_ROUTE_POLICY_VERSION = 'safety_route_policy_v1';

export function selectSafetyRouteTargets(
  severity: string,
  domain: SafetyDomain,
): { primary: RoutingTargetKind | null; fallback: RoutingTargetKind | null } {
  if (severity === 'S3_ROUTINE') return { primary: null, fallback: null };
  if (severity === 'S0_EMERGENCY') {
    return domain === 'SUICIDE_OR_SELF_HARM'
      ? { primary: 'EMERGENCY_SERVICE', fallback: 'CRISIS_SERVICE' }
      : { primary: 'EMERGENCY_SERVICE', fallback: 'URGENT_MEDICAL_SERVICE' };
  }
  if (severity === 'S1_URGENT') {
    return domain === 'SUICIDE_OR_SELF_HARM'
      ? { primary: 'CRISIS_SERVICE', fallback: 'ON_CALL_CLINICIAN_QUEUE' }
      : { primary: 'URGENT_MEDICAL_SERVICE', fallback: 'ON_CALL_CLINICIAN_QUEUE' };
  }
  return domain === 'SUICIDE_OR_SELF_HARM'
    ? { primary: 'ON_CALL_CLINICIAN_QUEUE', fallback: 'CRISIS_SERVICE' }
    : { primary: 'ON_CALL_CLINICIAN_QUEUE', fallback: 'URGENT_MEDICAL_SERVICE' };
}
