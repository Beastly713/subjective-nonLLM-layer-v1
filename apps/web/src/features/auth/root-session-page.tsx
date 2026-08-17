import { Link, Navigate } from 'react-router';

import { ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { authClient } from '@/lib/auth/auth-client';
import { useCurrentSession } from './use-auth-data';

export function RootSessionPage() {
  const session = useCurrentSession();

  if (session.isLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-[var(--page-gutter)] py-16">
        <LoadingState />
      </main>
    );
  }
  if (session.isError) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-[var(--page-gutter)] py-16">
        <ErrorState
          action={
            <Button onClick={() => void session.refetch()}>Try again</Button>
          }
        />
      </main>
    );
  }
  if (!session.data?.authenticated) {
    return (
      <Navigate
        to={
          session.data?.reason === 'expired_or_revoked'
            ? '/session-expired'
            : '/login'
        }
        replace
      />
    );
  }

  const signOut = async () => {
    await authClient.signOut();
    window.location.assign('/login');
  };

  const { access } = session.data.session;
  if (access.allowedDestinations.length === 1) {
    return <Navigate to={access.allowedDestinations[0]!.path} replace />;
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-[var(--page-gutter)] py-16">
      <Card>
        <CardHeader>
          <p className="m-0 text-sm font-semibold text-primary">
            Authenticated account
          </p>
          <h1 className="mb-0 mt-2 text-2xl font-semibold">
            {access.allowedDestinations.length > 1
              ? 'Choose a workspace'
              : access.accountState === 'DISABLED'
                ? 'Account disabled'
                : access.accountState === 'PENDING'
                  ? 'Account activation pending'
                  : 'Access is restricted'}
          </h1>
        </CardHeader>
        <CardContent>
          <p className="mt-0 text-muted-foreground">
            Signed in as {session.data.session.user.email}.
          </p>
          {access.allowedDestinations.length > 1 ? (
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {access.allowedDestinations.map((destination) => (
                <Link
                  className="rounded-lg border bg-surface-interactive p-4 font-semibold text-primary"
                  key={destination.path}
                  to={destination.path}
                >
                  {destination.label}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Reason:{' '}
              {access.restrictionReason?.replaceAll('_', ' ').toLowerCase() ??
                'No active workspace is available.'}
            </p>
          )}
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
