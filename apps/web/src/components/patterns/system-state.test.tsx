import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StateBadge } from '@/components/patterns/state-badge';
import {
  RestrictedState,
  SafetyControlledState,
} from '@/components/patterns/system-state';

describe('state presentation', () => {
  it('keeps important state meaning in text', () => {
    render(
      <>
        <StateBadge label="Stale" state="stale" />
        <StateBadge label="Partial" state="partial" />
        <RestrictedState />
        <SafetyControlledState />
      </>,
    );

    expect(screen.getByText('Stale')).toBeVisible();
    expect(screen.getByText('Partial')).toBeVisible();
    expect(screen.getByText('Access restricted')).toBeVisible();
    expect(
      screen.getByText(/Safety-controlled state — reference treatment/),
    ).toBeVisible();
  });
});
