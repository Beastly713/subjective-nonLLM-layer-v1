import {
  createBrowserRouter,
  isRouteErrorResponse,
  useRouteError,
} from 'react-router';

import { ErrorState } from '@/components/patterns/system-state';
import { FoundationPage } from '@/features/foundation/foundation-page';

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
    element: <FoundationPage />,
    errorElement: <RouteErrorBoundary />,
  },
]);
