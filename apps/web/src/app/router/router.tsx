import {
  createBrowserRouter,
  isRouteErrorResponse,
  useRouteError,
} from 'react-router';

function FoundationScreen() {
  return (
    <main className="foundation-shell">
      <section className="foundation-panel" aria-labelledby="foundation-title">
        <p className="foundation-eyebrow">V1 foundation</p>
        <h1 id="foundation-title">Application shell is running</h1>
        <p>
          The web, backend, and shared-contract workspace boundaries are ready
          for the next implementation stage.
        </p>
      </section>
    </main>
  );
}

function RouteErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'The application could not render this route.';

  return (
    <main className="foundation-shell">
      <section className="foundation-panel" role="alert">
        <p className="foundation-eyebrow">Route error</p>
        <h1>Something went wrong</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <FoundationScreen />,
    errorElement: <RouteErrorBoundary />,
  },
]);
