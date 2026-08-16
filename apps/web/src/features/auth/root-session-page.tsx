import { Navigate } from 'react-router';

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

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-[var(--page-gutter)] py-16">
      <Card>
        <CardHeader>
          <p className="m-0 text-sm font-semibold text-primary">
            Authenticated account
          </p>
          <h1 className="mb-0 mt-2 text-2xl font-semibold">
            Account setup and access pending
          </h1>
        </CardHeader>
        <CardContent>
          <p className="mt-0 text-muted-foreground">
            Your identity has been verified as {session.data.session.user.email}
            . Application access will appear after an administrator completes
            setup.
          </p>
          <p className="text-sm text-muted-foreground">
            No role or workspace has been inferred for this account.
          </p>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
