import {
  ClipboardCheck,
  HeartHandshake,
  House,
  LifeBuoy,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

import { AccountControl } from '@/components/patterns/account-control';

function navClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-inverse-foreground shadow-[var(--shadow-sm)]'
    : 'flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-surface-interactive hover:text-foreground';
}

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
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            {navigation ? (
              <nav
                className="grid min-w-0 flex-1 grid-cols-5 gap-1 sm:flex sm:flex-none sm:gap-2"
                aria-label="Patient navigation"
              >
                <NavLink className={navClass} to="/patient/home">
                  <House className="size-4" />
                  <span className="hidden sm:inline">Home</span>
                </NavLink>
                <NavLink className={navClass} to="/patient/check-in">
                  <ClipboardCheck className="size-4" />
                  <span className="hidden sm:inline">Check-in</span>
                </NavLink>
                <NavLink className={navClass} to="/patient/progress">
                  <TrendingUp className="size-4" />
                  <span className="hidden sm:inline">Progress</span>
                </NavLink>
                <NavLink className={navClass} to="/patient/support">
                  <LifeBuoy className="size-4" />
                  <span className="hidden sm:inline">Support</span>
                </NavLink>
                <NavLink className={navClass} to="/patient/profile">
                  <UserRound className="size-4" />
                  <span className="hidden sm:inline">Profile</span>
                </NavLink>
              </nav>
            ) : null}
            <AccountControl workspace="Patient" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-[var(--page-gutter)] py-10 sm:py-16">
        {children}
      </main>
    </div>
  );
}
