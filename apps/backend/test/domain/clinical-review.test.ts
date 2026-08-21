import { describe, expect, it } from 'vitest';

import {
  deriveOpenCaseLifecycle,
  materiallyNewReasonFamilies,
} from '../../src/modules/clinical/lifecycle.js';
import { CLINICAL_REASON_FAMILIES } from '../../src/modules/clinical/types.js';

describe('Phase 5 clinical review lifecycle policy', () => {
  it('keeps the Level-3 whitelist exact', () => {
    expect(CLINICAL_REASON_FAMILIES).toEqual([
      'CRAVING_LOW_CONFIDENCE',
      'MOOD_CRAVING',
      'PERSISTENT_HIGH_CRAVING',
      'PERSISTENT_HIGH_NEGATIVE_MOOD',
      'CONSECUTIVE_USE',
      'RECURRENT_USE',
    ]);
  });

  it('keeps active cases active and returns from clearance to active', () => {
    expect(
      deriveOpenCaseLifecycle({
        activeReasonCount: 1,
        clearancePendingReasonCount: 0,
        previousLifecycle: 'NEW',
      }),
    ).toBe('NEW');
    expect(
      deriveOpenCaseLifecycle({
        activeReasonCount: 1,
        clearancePendingReasonCount: 1,
        previousLifecycle: 'CLEARANCE_PENDING',
      }),
    ).toBe('ACTIVE');
  });

  it('projects clearance pending without creating a new active tier', () => {
    expect(
      deriveOpenCaseLifecycle({
        activeReasonCount: 0,
        clearancePendingReasonCount: 1,
        previousLifecycle: 'ACTIVE',
      }),
    ).toBe('CLEARANCE_PENDING');
  });

  it('does not treat unchanged reasons as materially new', () => {
    expect(
      materiallyNewReasonFamilies({
        current: ['CRAVING_LOW_CONFIDENCE', 'MOOD_CRAVING'] as const,
        previouslyKnown: new Set(['CRAVING_LOW_CONFIDENCE']),
      }),
    ).toEqual(['MOOD_CRAVING']);
  });

  it('represents simultaneous reasons independently for task creation', () => {
    expect(
      materiallyNewReasonFamilies({
        current: [
          'CRAVING_LOW_CONFIDENCE',
          'MOOD_CRAVING',
          'RECURRENT_USE',
        ] as const,
        previouslyKnown: new Set<string>(),
      }),
    ).toHaveLength(3);
  });
});
