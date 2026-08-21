import {
  createBrowserRouter,
  isRouteErrorResponse,
  useRouteError,
} from 'react-router';

import { ErrorState } from '@/components/patterns/system-state';
import { FoundationPage } from '@/features/foundation/foundation-page';
import { AdminUsersPage } from '@/features/admin/users/admin-users-page';
import { RegionalRoutingPage } from '@/features/admin/routing/regional-routing-page';
import { AdminSafetyPage } from '@/features/admin/safety/admin-safety-page';
import { ClinicianPatientsPage } from '@/features/clinician/patients/clinician-patients-page';
import { ClinicianSafetyPage } from '@/features/clinician/safety/clinician-safety-page';
import { PatientProfilePage } from '@/features/patient/profile/patient-profile-page';
import { PatientOnboardingPage } from '@/features/patient/onboarding/patient-onboarding-page';
import { PatientReductionSetupPage } from '@/features/patient/reduction/reduction-setup-page';
import { PatientCheckInPage } from '@/features/patient/check-in/check-in-page';
import { LoginPage } from '@/features/auth/login-page';
import { RecoverAccountPage } from '@/features/auth/recover-account-page';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';
import { RootSessionPage } from '@/features/auth/root-session-page';
import { SessionExpiredPage } from '@/features/auth/session-expired-page';
import { TwoFactorPage } from '@/features/auth/two-factor-page';

function RouteErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'The application could not render this route.';

  return (
    <main className="grid min-h-screen place-items-center px-[var(--page-gutter)] py-12">
      <div className="w-full max-w-lg">
        <ErrorState />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {message}
        </p>
      </div>
    </main>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootSessionPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/two-factor',
    element: <TwoFactorPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/recover-account',
    element: <RecoverAccountPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/session-expired',
    element: <SessionExpiredPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/patient/profile',
    element: <PatientProfilePage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/patient/onboarding',
    element: <PatientOnboardingPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/patient/reduction-setup',
    element: <PatientReductionSetupPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/patient/check-in',
    element: <PatientCheckInPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/clinician/patients',
    element: <ClinicianPatientsPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/clinician/safety',
    element: <ClinicianSafetyPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/admin/users',
    element: <AdminUsersPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/admin/configuration/regional-routing',
    element: <RegionalRoutingPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/admin/safety',
    element: <AdminSafetyPage />,
    errorElement: <RouteErrorBoundary />,
  },
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/foundation',
          element: <FoundationPage />,
          errorElement: <RouteErrorBoundary />,
        },
      ]
    : []),
]);
