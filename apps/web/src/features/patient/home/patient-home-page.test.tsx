import type {
  PatientHomeResponse,
  PatientSafetyProjection,
} from '@aud-subjective/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { safetyProjection } = vi.hoisted(() => ({
  safetyProjection: {
    value: null as PatientSafetyProjection | null,
  },
}));

vi.mock('@/features/auth/use-auth-data', () => ({
  useCurrentSession: () => ({
    isLoading: false,
    isError: false,
    data: {
      authenticated: true,
      session: {
        access: {
          allowedDestinations: [
            {
              workspace: 'PATIENT',
              path: '/patient/profile',
              label: 'Profile',
            },
          ],
        },
      },
    },
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/patient/safety/use-patient-safety', () => ({
  usePatientSafety: () => ({
    isLoading: false,
    isError: false,
    data: safetyProjection.value,
    refetch: vi.fn(),
  }),
}));

import { PatientHomePage, selectCurrentReminder } from './patient-home-page';

const patientId = '00000000-0000-4000-8000-000000000601';
const periodId = '00000000-0000-4000-8000-000000000602';
const firstReminderId = '00000000-0000-4000-8000-000000000603';
const finalReminderId = '00000000-0000-4000-8000-000000000604';
const dueAt = '2026-08-10T00:00:00.000Z';

function reminder(
  number: 1 | 2,
  status: 'ELIGIBLE' | 'PRESENTED' | 'UPCOMING',
): PatientHomeResponse['engagement']['reminders'][number] {
  return {
    id: number === 1 ? firstReminderId : finalReminderId,
    reminderNumber: number,
    eligibleAt:
      number === 1 ? '2026-08-17T00:00:00.000Z' : '2026-08-24T00:00:00.000Z',
    presentedAt: status === 'PRESENTED' ? '2026-08-24T12:00:00.000Z' : null,
    cancelledAt: null,
    cancellationReason: null,
    presentationStatus: status,
  };
}

function homeData(
  state: PatientHomeResponse['engagement']['state'] = 'AT_RISK_OF_DISENGAGEMENT',
): PatientHomeResponse {
  const timingPaused = state === 'TECHNICAL_FAILURE';
  return {
    patientId,
    patientName: 'Synthetic Patient',
    presentationMode: 'ORDINARY',
    safety: safetyProjection.value!,
    primaryAction: {
      kind: 'START_CHECK_IN',
      label: 'Start check-in',
      href: '/patient/check-in/action',
      supportingText:
        'Complete the current weekly check-in when you are ready.',
    },
    checkIn: {
      availability: 'LATE',
      period: {
        periodId,
        periodStartAt: '2026-08-03T00:00:00.000Z',
        periodEndAt: '2026-08-09T00:00:00.000Z',
        openAt: '2026-08-09T00:00:00.000Z',
        originalDueAt: dueAt,
        effectiveDueAt: dueAt,
      },
      assessmentId: null,
      completionStatus: null,
      submittedAt: null,
    },
    engagement: {
      state,
      timingPaused,
      pauseReason: timingPaused ? 'TECHNICAL' : null,
      missedCycle: {
        periodId,
        periodStartAt: '2026-08-03T00:00:00.000Z',
        periodEndAt: '2026-08-09T00:00:00.000Z',
        effectiveDueAt: dueAt,
      },
      overdueDays: timingPaused ? 0 : 14,
      reminders: timingPaused
        ? []
        : [reminder(1, 'ELIGIBLE'), reminder(2, 'PRESENTED')],
      notice: timingPaused
        ? {
            kind: 'TECHNICAL_FAILURE',
            title: 'Check-in timing is paused',
            message:
              'We are reviewing an access issue. Your monitoring timing will resume when the issue is resolved.',
          }
        : {
            kind: 'FINAL_REMINDER',
            title: 'Your check-in is ready',
            message:
              'A current check-in is available. Completing it helps keep your monitoring record up to date.',
          },
    },
    monitoring: { state, version: 1, optedOutAt: null },
    goalSummary: { goal: null, label: 'Your monitoring plan' },
    supportSummary: {
      available: false,
      label: 'Support is available from your Support space.',
      href: '/patient/support',
    },
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
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
        <PatientHomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  safetyProjection.value = {
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
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(homeData()));
});

describe('Patient Home Phase 6 presentation', () => {
  it('shows one patient-safe current reminder when both thresholds are present', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', {
        name: 'Welcome back, Synthetic Patient',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Current reminder' }),
    ).toBeVisible();
    expect(screen.getByText('Final reminder')).toBeVisible();
    expect(screen.queryByText('First reminder')).not.toBeInTheDocument();
    expect(
      screen.queryByText('AT_RISK_OF_DISENGAGEMENT'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/no external message is being sent/i),
    ).toBeVisible();
  });

  it('renders technical timing as a calm pause without exposing an internal severity label', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(homeData('TECHNICAL_FAILURE')),
    );
    renderPage();
    expect(await screen.findByText('Check-in timing is paused')).toBeVisible();
    expect(screen.getAllByText('Timing paused')).toHaveLength(2);
    expect(screen.queryByText('TECHNICAL_FAILURE')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Current reminder' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the safety-controlled shell ahead of ordinary Home content', async () => {
    safetyProjection.value = {
      safetyState: 'HANDOFF_REQUIRED',
      requiresSafetyShell: true,
      handoffStatus: 'PENDING',
      allowedSubjectiveInterventions: [],
      monitoringPromptPolicy: 'PAUSE',
      goalChangeAllowed: false,
      reassessmentDueAt: null,
      routeAvailability: 'UNAVAILABLE',
      patientRouteActions: [],
    };
    renderPage();
    expect(
      await screen.findByRole('heading', {
        name: 'A clinician needs to review your next steps',
      }),
    ).toBeVisible();
    expect(screen.queryByText('Current reminder')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Welcome back, Synthetic Patient'),
    ).not.toBeInTheDocument();
  });
});

describe('current reminder selection', () => {
  it('selects the highest eligible slot and otherwise the earliest upcoming slot', () => {
    expect(
      selectCurrentReminder([
        reminder(1, 'ELIGIBLE'),
        reminder(2, 'PRESENTED'),
      ]),
    ).toEqual([reminder(2, 'PRESENTED')]);
    expect(
      selectCurrentReminder([reminder(1, 'UPCOMING'), reminder(2, 'UPCOMING')]),
    ).toEqual([reminder(1, 'UPCOMING')]);
  });
});
