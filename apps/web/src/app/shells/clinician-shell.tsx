import {
  ClipboardList,
  ShieldAlert,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

export function ClinicianShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="border-b border-border-strong bg-surface px-[var(--page-gutter)] py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Stethoscope className="text-primary" />
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Clinician workspace
              </p>
              <p className="m-0 font-semibold">Assigned care directory</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <NavLink
              className="flex items-center gap-2 rounded-md border border-border-strong px-4 py-2 text-sm font-semibold"
              to="/clinician/patients"
            >
              <UsersRound className="size-4" />
              Patients
            </NavLink>
            <NavLink
              className="flex items-center gap-2 rounded-md border border-border-strong px-4 py-2 text-sm font-semibold"
              to="/clinician/review-queue"
            >
              <ClipboardList className="size-4" />
              Review Queue
            </NavLink>
            <NavLink
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-inverse-foreground"
              to="/clinician/safety"
            >
              <ShieldAlert className="size-4" />
              Safety
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-[var(--page-gutter)] py-8">
        {children}
      </main>
    </div>
  );
}
