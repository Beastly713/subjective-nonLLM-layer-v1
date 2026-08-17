import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { useCurrentSession } from '@/features/auth/use-auth-data';

export function WorkspaceBoundary({
  destination,
  children,
}: {
  destination: string;
  children: ReactNode;
}) {
  const session = useCurrentSession();
  if (session.isLoading)
    return (
      <main className="p-8">
        <LoadingState />
      </main>
    );
  if (session.isError)
    return (
      <main className="mx-auto max-w-xl p-8">
        <ErrorState
          action={
            <Button onClick={() => void session.refetch()}>Try again</Button>
          }
        />
      </main>
    );
  if (!session.data?.authenticated) return <Navigate to="/login" replace />;
  if (
    !session.data.session.access.allowedDestinations.some(
      ({ path }) => path === destination,
    )
  )
    return <Navigate to="/" replace />;
  return children;
}
