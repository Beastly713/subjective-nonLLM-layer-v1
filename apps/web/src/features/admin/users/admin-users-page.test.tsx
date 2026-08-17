import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sessionPermissions } = vi.hoisted(() => ({
  sessionPermissions: { value: [] as string[] },
}));

vi.mock('@/features/auth/use-auth-data', () => ({
  useCurrentSession: () => ({
    isLoading: false,
    isError: false,
    data: {
      authenticated: true,
      session: {
        access: {
          permissions: sessionPermissions.value,
          allowedDestinations: [
            {
              workspace: 'ADMIN',
              path: '/admin/users',
              label: 'Users & Access',
            },
          ],
        },
      },
    },
    refetch: vi.fn(),
  }),
}));

import { AdminUsersPage } from './admin-users-page';

const clinicianId = '00000000-0000-4000-8000-000000000201';
const patientId = '00000000-0000-4000-8000-000000000202';
const roleId = '00000000-0000-4000-8000-000000000203';
const assignmentId = '00000000-0000-4000-8000-000000000204';
const clinician = {
  userId: clinicianId,
  name: 'Synthetic Clinician',
  email: 'clinician@example.test',
  emailVerified: true,
  mfaEnabled: false,
  accountState: 'ACTIVE',
  accountVersion: 1,
  privilegedIdentityStatus: 'PENDING',
  roles: [
    {
      id: roleId,
      workspace: 'CLINICIAN',
      role: 'CLINICIAN',
      version: 1,
      grantedAt: '2026-08-17T00:00:00.000Z',
    },
  ],
  activePatientAssignments: 1,
};
const patient = {
  userId: patientId,
  name: 'Synthetic Patient',
  email: 'patient@example.test',
  emailVerified: true,
  mfaEnabled: false,
  accountState: 'ACTIVE',
  accountVersion: 1,
  privilegedIdentityStatus: 'NOT_REQUIRED',
  roles: [
    {
      id: '00000000-0000-4000-8000-000000000205',
      workspace: 'PATIENT',
      role: 'PATIENT',
      version: 1,
      grantedAt: '2026-08-17T00:00:00.000Z',
    },
  ],
  activePatientAssignments: 0,
};

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'admin-ui-test',
    },
  });
}

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  sessionPermissions.value = [];
  vi.restoreAllMocks();
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    if (path === `/api/v1/admin/users/${clinicianId}`) {
      return Promise.resolve(
        response({
          ...clinician,
          directAssignments: [
            {
              id: assignmentId,
              version: 1,
              assignedAt: '2026-08-17T00:00:00.000Z',
              clinician: {
                userId: clinicianId,
                name: clinician.name,
                email: clinician.email,
              },
              patient: {
                userId: patientId,
                name: patient.name,
                email: patient.email,
              },
            },
          ],
        }),
      );
    }
    return Promise.resolve(
      response({
        items: [clinician, patient],
        page: 1,
        pageSize: 100,
        total: 2,
      }),
    );
  });
});

describe('Admin Users & Access actions', () => {
  it('keeps OPERATIONS read-only according to backend-projected permissions', async () => {
    sessionPermissions.value = ['USER_ACCESS_READ'];
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('button', { name: 'View access' });
    await user.click(
      screen.getAllByRole('button', { name: 'View access' })[0]!,
    );
    expect(
      await screen.findByRole('heading', { name: clinician.name }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Provision account' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Disable' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Grant role' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Revoke' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Record verification' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assign patient' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'End assignment' }),
    ).not.toBeInTheDocument();
  });

  it('exposes the compact real action panel when the projected permissions allow it', async () => {
    sessionPermissions.value = [
      'USER_ACCESS_READ',
      'USER_PROVISION',
      'USER_STATE_MANAGE',
      'ROLE_MANAGE',
      'PATIENT_ASSIGNMENT_MANAGE',
      'PRIVILEGED_IDENTITY_VERIFY',
    ];
    const user = userEvent.setup();
    renderPage();
    expect(
      await screen.findByRole('button', { name: 'Provision account' }),
    ).toBeVisible();
    await screen.findAllByRole('button', { name: 'View access' });
    expect(screen.getAllByRole('button', { name: 'Disable' })).toHaveLength(2);
    await user.click(
      screen.getAllByRole('button', { name: 'View access' })[0]!,
    );
    expect(
      await screen.findByRole('button', { name: 'Grant role' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Record verification' }),
    ).toBeDisabled();
    await user.type(
      screen.getByLabelText('Verification reference'),
      'registry-42',
    );
    expect(
      screen.getByRole('button', { name: 'Record verification' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Assign patient' }),
    ).toBeDisabled();
    await user.selectOptions(
      screen.getByLabelText('Assign patient'),
      patientId,
    );
    expect(
      screen.getByRole('button', { name: 'Assign patient' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'End assignment' }),
    ).toBeVisible();
  });
});
