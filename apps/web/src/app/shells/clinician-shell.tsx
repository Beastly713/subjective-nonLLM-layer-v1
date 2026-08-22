import {
  Activity,
  ClipboardList,
  HeartHandshake,
  ShieldAlert,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

import { AccountControl } from '@/components/patterns/account-control';

const navigation = [
  { href: '/clinician/overview', label: 'Overview', icon: Activity },
  { href: '/clinician/patients', label: 'Patients', icon: UsersRound },
  {
    href: '/clinician/review-queue',
    label: 'Review Queue',
    icon: ClipboardList,
  },
  { href: '/clinician/engagement', label: 'Engagement', icon: HeartHandshake },
  { href: '/clinician/safety', label: 'Safety', icon: ShieldAlert },
] as const;

function navClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'flex items-center gap-3 rounded-lg bg-primary px-3 py-3 text-sm font-semibold text-inverse-foreground'
    : 'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-surface-interactive hover:text-foreground';
}

export function ClinicianShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="border-b border-border-strong bg-surface px-[var(--page-gutter)] py-4 lg:hidden">
        <div className="mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Stethoscope className="text-primary" />
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Clinician workspace
              </p>
              <p className="m-0 font-semibold">Assigned care</p>
            </div>
          </div>
          <AccountControl workspace="Clinician" />
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl lg:grid-cols-[15rem_1fr]">
        <aside className="hidden min-h-screen border-r border-border-strong bg-surface px-4 py-6 lg:block">
          <div className="mb-8 flex items-center gap-3 px-3">
            <Stethoscope className="text-primary" />
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Clinician workspace
              </p>
              <p className="m-0 font-semibold">Assigned care</p>
            </div>
          </div>
          <nav className="grid gap-1" aria-label="Clinician navigation">
            {navigation.map(({ href, label, icon: Icon }) => (
              <NavLink
                className={navClass}
                key={href}
                to={href}
                end={href === '/clinician/overview'}
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-8 border-t pt-5">
            <AccountControl workspace="Clinician" />
          </div>
        </aside>
        <main className="min-w-0 px-[var(--page-gutter)] py-8">
          <nav
            className="mb-6 flex gap-1 overflow-x-auto rounded-xl border bg-surface p-1 lg:hidden"
            aria-label="Clinician navigation"
          >
            {navigation.map(({ href, label, icon: Icon }) => (
              <NavLink
                className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-primary aria-[current=page]:text-inverse-foreground"
                key={href}
                to={href}
                end={href === '/clinician/overview'}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          {children}
        </main>
      </div>
    </div>
  );
}
