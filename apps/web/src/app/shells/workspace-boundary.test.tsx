import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const { refetch } = vi.hoisted(() => ({ refetch: vi.fn() }));

vi.mock('@/features/auth/use-auth-data', () => ({
  useCurrentSession: () => ({
    isLoading: false,
    isError: true,
    data: undefined,
    refetch,
  }),
}));

import { WorkspaceBoundary } from './workspace-boundary';

describe('WorkspaceBoundary', () => {
  it('renders the designed retry state when session loading fails', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WorkspaceBoundary destination="/admin/users">
          <h1>Protected content</h1>
        </WorkspaceBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Something needs attention',
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
