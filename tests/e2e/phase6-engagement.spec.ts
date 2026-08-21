import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const patientId = '00000000-0000-4000-8000-000000000701';
const periodId = '00000000-0000-4000-8000-000000000702';
const caseId = '00000000-0000-4000-8000-000000000703';
const taskId = '00000000-0000-4000-8000-000000000704';
const reminderOneId = '00000000-0000-4000-8000-000000000705';
const reminderTwoId = '00000000-0000-4000-8000-000000000706';
const technicalFailureId = '00000000-0000-4000-8000-000000000707';
const actorId = '00000000-0000-4000-8000-000000000708';
const timestamp = '2026-08-24T12:00:00.000Z';

type DemoMode = 'PATIENT' | 'CLINICIAN' | 'ADMIN';

function sessionFor(mode: DemoMode) {
  const access =
    mode === 'PATIENT'
      ? {
          permissions: [
            'PATIENT_HOME_READ',
            'PATIENT_MONITORING_READ',
            'PATIENT_MONITORING_MANAGE',
            'PATIENT_SAFETY_READ',
          ],
          scopeKinds: ['OWN_PATIENT'],
          destination: {
            workspace: 'PATIENT',
            path: '/patient/profile',
            label: 'Profile',
          },
        }
      : mode === 'CLINICIAN'
        ? {
            permissions: [
              'ENGAGEMENT_READ',
              'ENGAGEMENT_CASE_ACKNOWLEDGE',
              'ENGAGEMENT_CASE_OUTREACH',
            ],
            scopeKinds: ['ASSIGNED_PATIENTS'],
            destination: {
              workspace: 'CLINICIAN',
              path: '/clinician/patients',
              label: 'Patients',
            },
          }
        : {
            permissions: [
              'TECHNICAL_FAILURE_READ',
              'ENGAGEMENT_TECHNICAL_OVERRIDE',
            ],
            scopeKinds: ['ADMIN_OPERATIONAL'],
            destination: {
              workspace: 'ADMIN',
              path: '/admin/users',
              label: 'Users & Access',
            },
          };
  return {
    authenticated: true,
    session: {
      user: {
        id: actorId,
        email: 'phase6-demo@example.test',
        emailVerified: true,
        name: 'Phase 6 Demo Actor',
        twoFactorEnabled: false,
      },
      createdAt: timestamp,
      expiresAt: '2026-08-25T12:00:00.000Z',
      absoluteExpiresAt: '2026-08-31T12:00:00.000Z',
      fresh: true,
      access: {
        accountState: 'ACTIVE',
        accountVersion: 1,
        roles: [],
        permissions: access.permissions,
        scopeKinds: access.scopeKinds,
        privilegedIdentity: { required: false, status: 'NOT_REQUIRED' },
        mfaEnabled: false,
        allowedDestinations: [access.destination],
      },
    },
  };
}

const safeProjection = {
  safetyState: 'MONITORING_AVAILABLE',
  requiresSafetyShell: false,
  handoffStatus: 'NONE',
  allowedSubjectiveInterventions: [],
  monitoringPromptPolicy: 'CONTINUE',
  goalChangeAllowed: true,
  reassessmentDueAt: null,
  routeAvailability: 'NOT_REQUIRED',
  patientRouteActions: [],
};

const patientHome = {
  patientId,
  patientName: 'Demo Patient',
  presentationMode: 'ORDINARY',
  safety: safeProjection,
  primaryAction: {
    kind: 'START_CHECK_IN',
    label: 'Start check-in',
    href: '/patient/check-in/action',
    supportingText: 'Complete the current weekly check-in when you are ready.',
  },
  checkIn: {
    availability: 'LATE',
    period: {
      periodId,
      periodStartAt: '2026-08-03T00:00:00.000Z',
      periodEndAt: '2026-08-09T00:00:00.000Z',
      openAt: '2026-08-09T00:00:00.000Z',
      originalDueAt: '2026-08-10T00:00:00.000Z',
      effectiveDueAt: '2026-08-10T00:00:00.000Z',
    },
    assessmentId: null,
    completionStatus: null,
    submittedAt: null,
  },
  engagement: {
    state: 'AT_RISK_OF_DISENGAGEMENT',
    timingPaused: false,
    pauseReason: null,
    missedCycle: {
      periodId,
      periodStartAt: '2026-08-03T00:00:00.000Z',
      periodEndAt: '2026-08-09T00:00:00.000Z',
      effectiveDueAt: '2026-08-10T00:00:00.000Z',
    },
    overdueDays: 14,
    reminders: [
      {
        id: reminderOneId,
        reminderNumber: 1,
        eligibleAt: '2026-08-17T00:00:00.000Z',
        presentedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        presentationStatus: 'ELIGIBLE',
      },
      {
        id: reminderTwoId,
        reminderNumber: 2,
        eligibleAt: timestamp,
        presentedAt: timestamp,
        cancelledAt: null,
        cancellationReason: null,
        presentationStatus: 'PRESENTED',
      },
    ],
    notice: {
      kind: 'FINAL_REMINDER',
      title: 'Your check-in is ready',
      message:
        'A current check-in is available. Completing it helps keep your monitoring record up to date.',
    },
  },
  monitoring: {
    state: 'AT_RISK_OF_DISENGAGEMENT',
    version: 1,
    optedOutAt: null,
  },
  goalSummary: { goal: null, label: 'Your monitoring plan' },
  supportSummary: {
    available: false,
    label: 'Support is available from your Support space.',
    href: '/patient/support',
  },
};

const task = {
  id: taskId,
  caseId,
  caseType: 'ENGAGEMENT',
  taskIdentity: 'DISENGAGEMENT_REVIEW',
  createdReason: null,
  recipientType: 'PRIMARY_CLINICIAN',
  deliveryStatus: 'DELIVERED',
  title: 'Missed check-in engagement review required',
  alertUpdateRequired: false,
  createdAt: timestamp,
  acknowledgedAt: null,
};

function engagementItem(
  lifecycle: 'NEW' | 'ACKNOWLEDGED' | 'OUTREACH_IN_PROGRESS',
) {
  return {
    patientId,
    patientName: 'Demo Patient',
    engagementState: 'DISENGAGED',
    missedCycle: {
      periodId,
      periodStartAt: '2026-08-03T00:00:00.000Z',
      periodEndAt: '2026-08-09T00:00:00.000Z',
      effectiveDueAt: '2026-08-10T00:00:00.000Z',
    },
    effectiveDueAt: '2026-08-10T00:00:00.000Z',
    daysOverdue: 14,
    reminders: patientHome.engagement.reminders,
    pause: { timingPaused: false, reason: null },
    engagementCase: {
      id: caseId,
      lifecycle,
      caseVersion:
        lifecycle === 'NEW' ? 1 : lifecycle === 'ACKNOWLEDGED' ? 2 : 3,
      openedAt: timestamp,
      acknowledgedAt: lifecycle === 'NEW' ? null : timestamp,
      outreachStartedAt:
        lifecycle === 'OUTREACH_IN_PROGRESS' ? timestamp : null,
      resolvedAt: null,
      resolutionReason: null,
    },
    task,
    lastCompletedCheckIn: null,
  };
}

const technicalFailure = {
  id: technicalFailureId,
  patientId,
  patientName: 'Demo Patient',
  failureType: 'ASSESSMENT_ACCESS_UNAVAILABLE',
  status: 'CONFIRMED',
  startedAt: '2026-08-24T09:00:00.000Z',
  evidenceSummary:
    'The local assessment surface was unavailable to the patient.',
  version: 2,
  confirmedBy: actorId,
  confirmedAt: '2026-08-24T10:00:00.000Z',
  resolvedBy: null,
  resolvedAt: null,
  correctedBy: null,
  correctedAt: null,
  reason: 'Confirmed during local demonstration',
  sourcePeriodId: periodId,
  previousEffectiveDueAt: '2026-08-10T00:00:00.000Z',
  recalculatedEffectiveDueAt: null,
  timingImpact: 'PAUSED',
};

async function mockPhase6Api(page: Page) {
  let mode: DemoMode = 'PATIENT';
  let lifecycle: 'NEW' | 'ACKNOWLEDGED' | 'OUTREACH_IN_PROGRESS' = 'NEW';
  let failureStatus: 'CONFIRMED' | 'CORRECTED_FALSE_POSITIVE' = 'CONFIRMED';

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();
    let body: unknown;

    if (pathname === '/api/v1/auth/session') {
      body = sessionFor(mode);
    } else if (mode === 'PATIENT' && pathname === '/api/v1/patient/safety') {
      body = safeProjection;
    } else if (mode === 'PATIENT' && pathname === '/api/v1/patient/home') {
      body = patientHome;
    } else if (
      mode === 'CLINICIAN' &&
      pathname === '/api/v1/clinician/engagement' &&
      method === 'GET'
    ) {
      body = { items: [engagementItem(lifecycle)] };
    } else if (
      mode === 'CLINICIAN' &&
      pathname.includes(`/api/v1/clinician/engagement-cases/${caseId}/`)
    ) {
      if (pathname.endsWith('/acknowledge')) lifecycle = 'ACKNOWLEDGED';
      if (pathname.endsWith('/start-outreach'))
        lifecycle = 'OUTREACH_IN_PROGRESS';
      body = engagementItem(lifecycle);
    } else if (
      mode === 'ADMIN' &&
      pathname === '/api/v1/admin/operations/technical-failures' &&
      method === 'GET'
    ) {
      body = {
        items: [
          {
            ...technicalFailure,
            status: failureStatus,
            timingImpact:
              failureStatus === 'CONFIRMED' ? 'PAUSED' : 'CORRECTED',
          },
        ],
      };
    } else if (
      mode === 'ADMIN' &&
      pathname.endsWith(`/technical-failures/${technicalFailureId}/correct`)
    ) {
      failureStatus = 'CORRECTED_FALSE_POSITIVE';
      body = {
        ...technicalFailure,
        status: failureStatus,
        timingImpact: 'CORRECTED',
        correctedBy: actorId,
        correctedAt: timestamp,
      };
    } else {
      throw new Error(`Unexpected Phase 6 E2E request: ${method} ${pathname}`);
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  return {
    setMode(next: DemoMode) {
      mode = next;
    },
  };
}

test('demonstrates the patient, clinician, and operations Phase 6 surfaces', async ({
  page,
}) => {
  const demo = await mockPhase6Api(page);

  await page.goto('/patient/home');
  await expect(
    page.getByRole('heading', { name: 'Welcome back, Demo Patient' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Current reminder' }),
  ).toBeVisible();
  await expect(page.getByText('Final reminder')).toBeVisible();
  await expect(page.getByText('First reminder')).not.toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Start check-in' }),
  ).toHaveAttribute('href', '/patient/check-in/action');
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  demo.setMode('CLINICIAN');
  await page.goto('/clinician/engagement');
  await expect(
    page.getByRole('heading', { name: 'Engagement queue' }),
  ).toBeVisible();
  await expect(page.getByText('Demo Patient')).toBeVisible();
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await page.getByRole('button', { name: 'Acknowledge case' }).click();
  await expect(
    page.getByRole('button', { name: 'Start outreach' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start outreach' }).click();
  await page.getByRole('button', { name: 'Start outreach' }).last().click();
  await expect(page.getByText('Outreach In Progress')).toBeVisible();

  demo.setMode('ADMIN');
  await page.goto('/admin/operations');
  await expect(
    page.getByRole('heading', { name: 'Technical access failures' }),
  ).toBeVisible();
  await expect(page.getByText('Engagement timing paused')).toBeVisible();
  await page
    .getByLabel('Action reason')
    .fill('Corrected during demonstration review');
  await page.getByRole('button', { name: 'Correct false positive' }).click();
  await page.getByRole('button', { name: 'Correct record' }).click();
  await expect(page.getByText('Timing correction recorded')).toBeVisible();
});
