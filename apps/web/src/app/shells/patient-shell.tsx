import {
  ClipboardCheck,
  HeartHandshake,
  House,
  LifeBuoy,
  UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

export function PatientShell({
  children,
  navigation = true,
}: {
  children: ReactNode;
  navigation?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface px-[var(--page-gutter)] py-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-success-surface text-success">
              <HeartHandshake aria-hidden="true" />
            </span>
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Patient space
              </p>
              <p className="m-0 font-semibold">Your account</p>
            </div>
          </div>
          {navigation ? (
            <nav className="flex max-w-[70vw] flex-wrap justify-end gap-2">
              <NavLink
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-inverse-foreground"
                to="/patient/home"
              >
                <House className="size-4" />
                Home
              </NavLink>
              <NavLink
                className="flex items-center gap-2 rounded-lg bg-surface-interactive px-4 py-2 text-sm font-semibold"
                to="/patient/onboarding"
              >
                Setup
              </NavLink>
              <NavLink
                className="flex items-center gap-2 rounded-lg bg-surface-interactive px-4 py-2 text-sm font-semibold"
                to="/patient/check-in"
              >
                <ClipboardCheck className="size-4" />
                Check-in
              </NavLink>
              <NavLink
                className="rounded-lg bg-surface-interactive px-4 py-2 text-sm font-semibold"
                to="/patient/check-in/history"
              >
                History
              </NavLink>
              <NavLink
                className="flex items-center gap-2 rounded-lg bg-surface-interactive px-4 py-2 text-sm font-semibold"
                to="/patient/support"
              >
                <LifeBuoy className="size-4" />
                Support
              </NavLink>
              <NavLink
                className="flex items-center gap-2 rounded-lg bg-surface-interactive px-4 py-2 text-sm font-semibold"
                to="/patient/profile"
              >
                <UserRound className="size-4" />
                Profile
              </NavLink>
            </nav>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-[var(--page-gutter)] py-10 sm:py-16">
        {children}
      </main>
    </div>
  );
}
