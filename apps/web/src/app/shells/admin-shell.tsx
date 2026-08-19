import { KeyRound, Settings, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

export function AdminShell({
  children,
  permissions = [],
}: {
  children: ReactNode;
  permissions?: readonly string[];
}) {
  const canReadRouting = permissions.includes('ROUTING_CONFIG_READ');
  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="bg-foreground px-[var(--page-gutter)] py-4 text-inverse-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck />
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-wider opacity-70">
                Administrative console
              </p>
              <p className="m-0 font-semibold">Identity operations</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <NavLink
              className="flex items-center gap-2 rounded-md border border-white/30 px-4 py-2 text-sm font-semibold"
              to="/admin/users"
            >
              <KeyRound className="size-4" />
              Users &amp; Access
            </NavLink>
            {canReadRouting ? (
              <NavLink
                className="flex items-center gap-2 rounded-md border border-white/30 px-4 py-2 text-sm font-semibold"
                to="/admin/configuration/regional-routing"
              >
                <Settings className="size-4" />
                Regional Routing
              </NavLink>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-[var(--page-gutter)] py-8">
        {children}
      </main>
    </div>
  );
}
