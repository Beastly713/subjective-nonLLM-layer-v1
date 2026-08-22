import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCurrentSession } from '@/features/auth/use-auth-data';
import { authClient } from '@/lib/auth/auth-client';

export function AccountControl({
  workspace,
  inverse = false,
}: {
  workspace: string;
  inverse?: boolean;
}) {
  const session = useCurrentSession();
  const user = session.data?.authenticated ? session.data.session.user : null;

  const signOut = async () => {
    await authClient.signOut();
    window.location.assign('/login');
  };

  if (!user) return null;
  return (
    <div
      className={
        inverse
          ? 'flex items-center gap-3 text-inverse-foreground'
          : 'flex items-center gap-3'
      }
    >
      <div className="hidden text-right sm:block">
        <p className="m-0 text-sm font-semibold">{user.name}</p>
        <p
          className={
            inverse
              ? 'm-0 text-xs opacity-75'
              : 'm-0 text-xs text-muted-foreground'
          }
        >
          {workspace} · {user.email}
        </p>
      </div>
      <Button
        className={
          inverse
            ? 'text-inverse-foreground hover:bg-white/10 hover:text-inverse-foreground'
            : ''
        }
        onClick={() => void signOut()}
        size="compact"
        variant={inverse ? 'ghost' : 'outline'}
      >
        <LogOut aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}
