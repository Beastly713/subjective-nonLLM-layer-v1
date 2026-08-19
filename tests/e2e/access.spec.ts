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
          'ROUTING_CONFIG_READ',
          'ROUTING_CONFIG_EDIT',
          'ROUTING_TEST_RECORD',
          'ROUTING_CONFIG_ACTIVATE',
        ]
      : destination?.workspace === 'PATIENT'
        ? [
            'PATIENT_PROFILE_READ',
            'PATIENT_PROFILE_UPDATE',
            'PATIENT_SCHEDULE_READ',
          ]
        : destination?.workspace === 'CLINICIAN'
          ? ['PATIENT_PROFILE_READ', 'PATIENT_SCHEDULE_READ']
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
  data: unknown | ((pathname: string) => unknown),
) {
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(
        pathname === '/api/v1/auth/session'
          ? sessionFor(destination)
          : typeof data === 'function'
            ? data(pathname)
            : data,
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
    (pathname) =>
      pathname === '/api/v1/patient/schedule'
        ? { state: 'NOT_ACTIVATED' }
        : ({
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
          } as const),
  );
  await page.goto('/patient/profile');
  await expect(
    page.getByRole('heading', { name: 'Profile preferences' }),
  ).toBeVisible();
  await expect(page.getByLabel('Mutual-help preference')).toHaveValue('');
  await expect(page.getByText('Setup incomplete')).toBeVisible();
  await expect(
    page.getByText(/weekly monitoring is not yet activated/i),
  ).toBeVisible();
});

test('drives the regional routing draft, evidence, and activation lifecycle', async ({
  page,
}) => {
  const profileId = '00000000-0000-4000-8000-000000000111';

  const profile: Record<string, unknown> = {
    id: profileId,
    countryCode: 'XZ',
    regionCode: 'TEST',
    logicalVersion: 1,
    rowVersion: 1,
    configurationRevision: 1,
    lifecycle: 'DRAFT',
    effectiveAt: null,
    supersededAt: null,
    createdAt: '2026-08-17T00:00:00.000Z',
    targets: [],
    testEvidence: [],
  };
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (pathname === '/api/v1/auth/session')
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(
          sessionFor({
            workspace: 'ADMIN',
            path: '/admin/users',
            label: 'Users & Access',
          }),
        ),
      });
    if (method === 'GET' && pathname.endsWith('regional-routing'))
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          items: profile.lifecycle
            ? [{ ...profile, targets: undefined, testEvidence: undefined }]
            : [],
        }),
      });
    if (method === 'GET')
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(profile),
      });
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (pathname.endsWith('/drafts'))
      Object.assign(profile, {
        countryCode: body.countryCode,
        regionCode: body.regionCode,
        lifecycle: 'DRAFT',
      });
    if (pathname.endsWith('/edit'))
      Object.assign(profile, {
        targets: (body.targets as Array<Record<string, unknown>>).map(
          (target, index) => ({
            ...target,
            id: `00000000-0000-4000-8000-${String(index + 300).padStart(12, '0')}`,
          }),
        ),
        rowVersion: Number(profile.rowVersion) + 1,
        configurationRevision: Number(profile.configurationRevision) + 1,
      });
    if (pathname.endsWith('/test-evidence')) {
      const evidence = profile.testEvidence as Array<Record<string, unknown>>;
      evidence.push({
        id: `00000000-0000-4000-8000-${String(evidence.length + 200).padStart(12, '0')}`,
        targetKind: body.targetKind,
        configurationRevision: profile.configurationRevision,
        result: body.result,
        provenance: body.provenance,
        testedAt: '2026-08-17T00:00:00.000Z',
        testedByUserId: userId,
      });
      profile.rowVersion = Number(profile.rowVersion) + 1;
    }
    if (pathname.endsWith('/activate'))
      Object.assign(profile, {
        lifecycle: 'ACTIVE',
        effectiveAt: '2026-08-17T00:00:00.000Z',
        rowVersion: Number(profile.rowVersion) + 1,
      });
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(profile),
    });
  });
  await page.goto('/admin/configuration/regional-routing');
  await expect(
    page.getByRole('heading', { name: 'Regional Routing' }),
  ).toBeVisible();
  await page.getByLabel('Country code').fill('XZ');
  await page.getByLabel('Region code (optional)').fill('TEST');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await page
    .getByRole('button', { name: 'Create draft', exact: true })
    .last()
    .click();
  const values = [
    '+9990001',
    'https://routing.invalid/crisis',
    'urn:test:urgent',
    'queue:test-on-call',
  ];
  for (let index = 0; index < 4; index += 1) {
    await page
      .getByLabel('Label')
      .nth(index)
      .fill(`Target ${index + 1}`);
    await page.getByLabel('Deployment target').nth(index).fill(values[index]!);
  }
  await page.getByRole('button', { name: 'Save exact targets' }).click();
  await page.getByRole('button', { name: 'Save targets' }).click();
  const targetGroupNames = [
    'EMERGENCY SERVICE',
    'CRISIS SERVICE',
    'URGENT MEDICAL SERVICE',
    'ON CALL CLINICIAN QUEUE',
  ] as const;
  for (let index = 0; index < targetGroupNames.length; index += 1) {
    const reference = `deployment-test-${index + 1}`;
    const group = page.getByRole('group', {
      name: targetGroupNames[index],
    });
    await group
      .getByLabel('Deployment test reference / evidence')
      .fill(reference);
    await group.getByRole('button', { name: 'Record PASS' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Record PASS' })
      .click();
    await expect(
      group.getByText(new RegExp(`PASS.*${reference}`)),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: 'Activate tested version' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Activate version' })
    .click();
  await expect(page.getByText('ACTIVE', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/active and read-only.*new draft version/i),
  ).toBeVisible();
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
