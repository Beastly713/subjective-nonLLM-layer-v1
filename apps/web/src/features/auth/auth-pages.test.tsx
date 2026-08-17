import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signInEmail } = vi.hoisted(() => ({ signInEmail: vi.fn() }));

vi.mock('@/lib/auth/auth-client', () => ({
  authClient: {
    signIn: { email: signInEmail },
    signOut: vi.fn(),
    twoFactor: { verifyTotp: vi.fn() },
  },
}));

import { LoginPage } from './login-page';
import { RootSessionPage } from './root-session-page';
import { SessionExpiredPage } from './session-expired-page';

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'web-test-1',
    },
  });
}

function authenticatedSession(
  allowedDestinations: Array<{
    workspace: 'PATIENT' | 'CLINICIAN' | 'ADMIN';
    path: '/patient/profile' | '/clinician/patients' | '/admin/users';
    label: string;
  }>,
  restrictionReason?: 'ACCOUNT_PENDING' | 'ACCOUNT_DISABLED',
) {
  return {
    authenticated: true,
    session: {
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'actor@example.test',
        emailVerified: true,
        name: 'Test Actor',
        twoFactorEnabled: false,
      },
      createdAt: '2026-08-17T00:00:00.000Z',
      expiresAt: '2026-08-18T00:00:00.000Z',
      absoluteExpiresAt: '2026-08-24T00:00:00.000Z',
      fresh: true,
      access: {
        accountState:
          restrictionReason === 'ACCOUNT_DISABLED'
            ? 'DISABLED'
            : restrictionReason === 'ACCOUNT_PENDING'
              ? 'PENDING'
              : 'ACTIVE',
        accountVersion: 1,
        roles: [],
        permissions: [],
        scopeKinds: [],
        privilegedIdentity: { required: false, status: 'NOT_REQUIRED' },
        mfaEnabled: false,
        allowedDestinations,
        ...(restrictionReason ? { restrictionReason } : {}),
      },
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  signInEmail.mockReset();
});

describe('authentication pages', () => {
  it('labels the login fields and truthfully hides unavailable recovery', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        appMode: 'prototype',
        passwordRecoveryAvailable: false,
        emailVerificationDeliveryAvailable: false,
        twoFactorSupported: true,
      }),
    );
    render(<LoginPage />, { wrapper: Providers });

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(screen.getByLabelText('Email address')).toHaveAttribute(
      'autocomplete',
      'email',
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/recovery is unavailable/i)).toBeVisible();
  });

  it('shows a generic invalid-credential error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        appMode: 'prototype',
        passwordRecoveryAvailable: false,
        emailVerificationDeliveryAvailable: false,
        twoFactorSupported: true,
      }),
    );
    signInEmail.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    });
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper: Providers });

    await user.type(
      screen.getByLabelText('Email address'),
      'person@example.test',
    );
    await user.type(screen.getByLabelText('Password'), 'incorrect password');
    await user.click(screen.getByRole('button', { name: 'Sign in securely' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The email or password was not accepted.',
    );
  });

  it('renders an accessible session-expired recovery path', () => {
    render(<SessionExpiredPage />, { wrapper: Providers });
    expect(
      screen.getByRole('heading', { name: 'Session ended' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Return to sign in' }),
    ).toHaveAttribute('href', '/login');
  });

  it('redirects an unauthenticated root session to login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ authenticated: false }),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<RootSessionPage />} />
            <Route path="/login" element={<h1>Login destination</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Login destination' }),
      ).toBeVisible(),
    );
  });

  it('uses the backend-provided destination instead of deriving routing from roles', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        authenticatedSession([
          {
            workspace: 'CLINICIAN',
            path: '/clinician/patients',
            label: 'Patients',
          },
        ]),
      ),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<RootSessionPage />} />
            <Route
              path="/clinician/patients"
              element={<h1>Clinician destination</h1>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Clinician destination' }),
    ).toBeVisible();
  });

  it('shows a chooser when the backend provides multiple workspaces', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        authenticatedSession([
          { workspace: 'PATIENT', path: '/patient/profile', label: 'Profile' },
          { workspace: 'ADMIN', path: '/admin/users', label: 'Users & Access' },
        ]),
      ),
    );
    render(<RootSessionPage />, { wrapper: Providers });
    expect(
      await screen.findByRole('heading', { name: 'Choose a workspace' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/patient/profile',
    );
    expect(
      screen.getByRole('link', { name: 'Users & Access' }),
    ).toHaveAttribute('href', '/admin/users');
  });

  it.each([
    ['ACCOUNT_PENDING', 'Account activation pending'],
    ['ACCOUNT_DISABLED', 'Account disabled'],
  ] as const)(
    'renders the backend restriction state %s',
    async (reason, heading) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse(authenticatedSession([], reason)),
      );
      render(<RootSessionPage />, { wrapper: Providers });
      expect(
        await screen.findByRole('heading', { name: heading }),
      ).toBeVisible();
    },
  );
});
