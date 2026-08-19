import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WeeklySchedule } from './patient-profile-page';

describe('patient weekly schedule presentation', () => {
  it('presents the authoritative not-activated state without invented period data', () => {
    render(
      <WeeklySchedule
        data={{ state: 'NOT_ACTIVATED' }}
        isError={false}
        isLoading={false}
      />,
    );
    expect(
      screen.getByText(/weekly monitoring is not yet activated/i),
    ).toBeVisible();
    expect(
      screen.queryByText(/next check-in|assessment status|recovery goal/i),
    ).not.toBeInTheDocument();
  });
});
