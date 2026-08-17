import { expect, test, type Page } from '@playwright/test';

const userId = '00000000-0000-4000-8000-000000000101';

function sessionFor(destination?: {
  workspace: 'PATIENT' | 'CLINICIAN' | 'ADMIN';
  path: '/patient/profile' | '/clinician/patients' | '/admin/users';
  label: string;
}) {
  const permissions =
    destination?.workspace === 'ADMIN'
      ? [
          'USER_ACCESS_READ',
          'USER_PROVISION',
          'USER_STATE_MANAGE',
          'ROLE_MANAGE',
          'PATIENT_ASSIGNMENT_MANAGE',
          'PRIVILEGED_IDENTITY_VERIFY',
        ]
      : destination?.workspace === 'PATIENT'
        ? ['PATIENT_PROFILE_READ', 'PATIENT_PROFILE_UPDATE']
        : destination?.workspace === 'CLINICIAN'
          ? ['PATIENT_PROFILE_READ']
          : [];
  return {
    authenticated: true,
    session: {
      user: {
        id: userId,
        email: 'synthetic.actor@example.test',
        emailVerified: true,
        name: 'Synthetic Actor',
        twoFactorEnabled: false,
      },
      createdAt: '2026-08-17T00:00:00.000Z',
      expiresAt: '2026-08-18T00:00:00.000Z',
      absoluteExpiresAt: '2026-08-24T00:00:00.000Z',
      fresh: true,
      access: {
        accountState: destination ? 'ACTIVE' : 'PENDING',
        accountVersion: 1,
        roles: [],
        permissions,
        scopeKinds: [],
        privilegedIdentity: { required: false, status: 'NOT_REQUIRED' },
        mfaEnabled: false,
        allowedDestinations: destination ? [destination] : [],
        ...(destination ? {} : { restrictionReason: 'ACCOUNT_PENDING' }),
      },
    },
  };
}

async function mockAccessApi(
  page: Page,
  destination: Parameters<typeof sessionFor>[0],
  data: unknown,
) {
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(
        pathname === '/api/v1/auth/session' ? sessionFor(destination) : data,
      ),
    });
  });
}

test('renders the patient profile and explicit unknown preferences', async ({
  page,
}) => {
  await mockAccessApi(
    page,
    { workspace: 'PATIENT', path: '/patient/profile', label: 'Profile' },
    {
      patientId: userId,
      name: 'Synthetic Patient',
      email: 'patient@example.test',
      accountState: 'ACTIVE',
      onboardingStatus: 'INCOMPLETE',
      monitoringTimezone: 'UTC',
      version: 1,
      preferences: {
        version: 1,
        mutualHelpPreference: null,
        spiritualContentPreference: null,
      },
    },
  );
  await page.goto('/patient/profile');
  await expect(
    page.getByRole('heading', { name: 'Profile preferences' }),
  ).toBeVisible();
  await expect(page.getByLabel('Mutual-help preference')).toHaveValue('');
  await expect(page.getByText('Setup incomplete')).toBeVisible();
});

test('renders only assigned clinician patients, including an empty unassigned path', async ({
  page,
}) => {
  await mockAccessApi(
    page,
    { workspace: 'CLINICIAN', path: '/clinician/patients', label: 'Patients' },
    { items: [], page: 1, pageSize: 25, total: 0 },
  );
  await page.goto('/clinician/patients');
  await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
  await expect(page.getByText('Direct assignments only')).toBeVisible();
  await expect(page.getByText(/Nothing to show yet/i)).toBeVisible();
});

test('renders the administrative users and access console', async ({
  page,
}) => {
  await mockAccessApi(
    page,
    { workspace: 'ADMIN', path: '/admin/users', label: 'Users & Access' },
    {
      items: [
        {
          userId,
          name: 'Synthetic Patient',
          email: 'patient@example.test',
          emailVerified: true,
          mfaEnabled: false,
          accountState: 'ACTIVE',
          accountVersion: 1,
          privilegedIdentityStatus: 'NOT_REQUIRED',
          roles: [],
          activePatientAssignments: 0,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    },
  );
  await page.goto('/admin/users');
  await expect(
    page.getByRole('heading', { name: 'Users & Access' }),
  ).toBeVisible();
  await expect(page.getByText('Synthetic Patient')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disable' })).toBeVisible();
});

test('renders a backend-restricted account without guessing a workspace', async ({
  page,
}) => {
  await mockAccessApi(page, undefined, {});
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Account activation pending' }),
  ).toBeVisible();
  await expect(page.getByText(/reason: account pending/i)).toBeVisible();
});
