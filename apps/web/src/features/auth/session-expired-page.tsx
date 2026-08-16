import { Link } from 'react-router';
import { AuthShell } from './auth-shell';

export function SessionExpiredPage() {
  return (
    <AuthShell
      title="Session ended"
      description="Your secure session expired or was revoked. Sign in again to continue."
    >
      <Link
        className="inline-flex min-h-[var(--control-height)] w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-inverse-foreground"
        to="/login"
      >
        Return to sign in
      </Link>
    </AuthShell>
  );
}
