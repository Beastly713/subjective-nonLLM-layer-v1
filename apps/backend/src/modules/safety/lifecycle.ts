import type { SafetyCaseLifecycle } from '../../generated/prisma/client.js';
import { DomainError } from '../../shared/errors/domain-error.js';

const ALLOWED: Record<SafetyCaseLifecycle, SafetyCaseLifecycle[]> = {
  DETECTED: ['HANDOFF_INITIATED', 'ESCALATED_TO_EMERGENCY'],
  HANDOFF_INITIATED: ['ACKNOWLEDGED', 'ESCALATED_TO_EMERGENCY'],
  ACKNOWLEDGED: ['CLINICAL_REVIEW_IN_PROGRESS', 'ESCALATED_TO_EMERGENCY'],
  CLINICAL_REVIEW_IN_PROGRESS: ['PLAN_ESTABLISHED', 'ESCALATED_TO_EMERGENCY'],
  PLAN_ESTABLISHED: ['RESOLVED', 'ESCALATED_TO_EMERGENCY'],
  RESOLVED: [],
  ESCALATED_TO_EMERGENCY: ['RESOLVED_EXTERNAL_HANDOFF'],
  RESOLVED_EXTERNAL_HANDOFF: [],
};

export function assertSafetyTransition(
  from: SafetyCaseLifecycle,
  to: SafetyCaseLifecycle,
) {
  if (!ALLOWED[from].includes(to)) {
    throw new DomainError(
      409,
      'SAFETY_CASE_TRANSITION_INVALID',
      'The requested safety case transition is not valid.',
    );
  }
}
