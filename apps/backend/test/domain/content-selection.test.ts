import { describe, expect, it } from 'vitest';

import {
  latestVersionPerResource,
  selectDeterministicResource,
} from '../../src/modules/content/deterministic-selection.js';
import { CONTENT_INTERVENTION_CLASSES } from '../../src/modules/content/types.js';

const now = new Date('2026-08-22T12:00:00.000Z');
const days = (value: number) => new Date(now.getTime() - value * 86_400_000);

function candidate(resourceId: string, resourceVersionId = `${resourceId}-v1`) {
  return { resourceId, resourceVersionId };
}

describe('Phase 5 deterministic content selection', () => {
  it('keeps the intervention class vocabulary limited to the ten locked classes', () => {
    expect(CONTENT_INTERVENTION_CLASSES).toHaveLength(10);
    expect(CONTENT_INTERVENTION_CLASSES).toEqual([
      'CRAVING_COPING_SUPPORT',
      'SELF_EFFICACY_SUPPORT',
      'MOOD_COPING_SUPPORT',
      'TRIGGER_MANAGEMENT_SUPPORT',
      'RELATIONSHIP_COPING_SUPPORT',
      'SOCIAL_SUPPORT_ACTIVATION',
      'USE_EVENT_RECOVERY_SUPPORT',
      'RECURRENT_USE_RECOVERY_SUPPORT',
      'RECOVERY_PLAN_REVIEW',
      'POSITIVE_REINFORCEMENT',
    ]);
  });

  it('uses one current version per logical resource', () => {
    const current = latestVersionPerResource([
      { resourceId: 'resource-a', version: 1, body: 'old' },
      { resourceId: 'resource-a', version: 2, body: 'current' },
      { resourceId: 'resource-b', version: 1, body: 'other' },
    ]);

    expect(current).toEqual([
      { resourceId: 'resource-a', version: 2, body: 'current' },
      { resourceId: 'resource-b', version: 1, body: 'other' },
    ]);
  });

  it('prefers explicitly helpful resources, then never-shown resources', () => {
    const result = selectDeterministicResource({
      candidates: [candidate('shown'), candidate('helpful'), candidate('new')],
      exposures: [{ resourceId: 'shown', deliveredAt: days(20) }],
      helpfulResourceIds: new Set(['helpful']),
      now,
      userRequest: false,
    });

    expect(result.selected?.resourceId).toBe('helpful');
  });

  it('uses least recent exposure, then exposure count, then resource ID', () => {
    const result = selectDeterministicResource({
      candidates: [candidate('resource-b'), candidate('resource-a')],
      exposures: [
        { resourceId: 'resource-a', deliveredAt: days(10) },
        { resourceId: 'resource-b', deliveredAt: days(10) },
      ],
      helpfulResourceIds: new Set(),
      now,
      userRequest: false,
    });

    expect(result.selected?.resourceId).toBe('resource-a');
  });

  it('does not proactively repeat a resource inside the seven-day cooldown', () => {
    const result = selectDeterministicResource({
      candidates: [candidate('resource-a')],
      exposures: [{ resourceId: 'resource-a', deliveredAt: days(6) }],
      helpfulResourceIds: new Set(),
      now,
      userRequest: false,
    });

    expect(result.selected).toBeNull();
    expect(result.cooldownOverride).toBeNull();
  });

  it('allows another same-class resource while the first is cooling down', () => {
    const result = selectDeterministicResource({
      candidates: [candidate('resource-a'), candidate('resource-b')],
      exposures: [{ resourceId: 'resource-a', deliveredAt: days(6) }],
      helpfulResourceIds: new Set(),
      now,
      userRequest: false,
    });

    expect(result.selected?.resourceId).toBe('resource-b');
  });

  it('permits USER_REQUEST cooldown override only when explicitly requested', () => {
    const result = selectDeterministicResource({
      candidates: [candidate('resource-a')],
      exposures: [{ resourceId: 'resource-a', deliveredAt: days(1) }],
      helpfulResourceIds: new Set(),
      now,
      userRequest: true,
    });

    expect(result.selected?.resourceId).toBe('resource-a');
    expect(result.cooldownOverride).toBe('USER_REQUEST');
  });

  it('keeps a resource outside cooldown deterministic at the seven-day boundary', () => {
    const result = selectDeterministicResource({
      candidates: [candidate('resource-a')],
      exposures: [{ resourceId: 'resource-a', deliveredAt: days(7) }],
      helpfulResourceIds: new Set(),
      now,
      userRequest: false,
    });

    expect(result.selected?.resourceId).toBe('resource-a');
  });
});
