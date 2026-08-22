import {
  Activity,
  BookOpen,
  FileSearch,
  KeyRound,
  Settings,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

import { AccountControl } from '@/components/patterns/account-control';

const navigation = [
  {
    href: '/admin/overview',
    label: 'Overview',
    icon: Activity,
    permission: 'ADMIN_OVERVIEW_READ',
  },
  {
    href: '/admin/users',
    label: 'Users & Access',
    icon: KeyRound,
    permission: 'USER_ACCESS_READ',
  },
  {
    href: '/admin/content',
    label: 'Content',
    icon: BookOpen,
    permission: 'CONTENT_RESOURCE_READ',
  },
  {
    href: '/admin/configuration/regional-routing',
    label: 'Configuration',
    icon: Settings,
    permission: 'ROUTING_CONFIG_READ',
  },
  {
    href: '/admin/operations',
    label: 'Operations',
    icon: Wrench,
    permission: 'TECHNICAL_FAILURE_READ',
  },
  {
    href: '/admin/audit',
    label: 'Audit',
    icon: FileSearch,
    permission: 'AUDIT_READ',
  },
] as const;

function navClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'flex items-center gap-3 rounded-lg bg-primary px-3 py-3 text-sm font-semibold text-inverse-foreground'
    : 'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-surface-interactive hover:text-foreground';
}

export function AdminShell({
  children,
  permissions = [],
}: {
  children: ReactNode;
  permissions?: readonly string[];
}) {
  const visibleNavigation = navigation.filter((item) =>
    permissions.includes(item.permission),
  );
  const canReadSafety = permissions.includes('SAFETY_CASE_READ');
  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="bg-foreground px-[var(--page-gutter)] py-4 text-inverse-foreground lg:hidden">
        <div className="mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck aria-hidden="true" />
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-wider opacity-70">
                Administrative console
              </p>
              <p className="m-0 font-semibold">Product governance</p>
            </div>
          </div>
          <AccountControl inverse workspace="Admin" />
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl lg:grid-cols-[16rem_1fr]">
        <aside className="hidden min-h-screen border-r border-border-strong bg-surface px-4 py-6 lg:block">
          <div className="mb-8 flex items-center gap-3 px-3">
            <span className="grid size-10 place-items-center rounded-xl bg-foreground text-inverse-foreground">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Administrative console
              </p>
              <p className="m-0 font-semibold">Product governance</p>
            </div>
          </div>
          <nav className="grid gap-1" aria-label="Administrative navigation">
            {visibleNavigation.map(({ href, label, icon: Icon }) => (
              <NavLink
                className={navClass}
                key={href}
                to={href}
                end={href === '/admin/overview'}
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          {canReadSafety ? (
            <div className="mt-6 border-t pt-5">
              <NavLink className={navClass} to="/admin/safety">
                <Activity className="size-4" />
                Safety administration
              </NavLink>
            </div>
          ) : null}
          <div className="mt-8 border-t pt-5">
            <AccountControl workspace="Admin" />
          </div>
        </aside>
        <main className="min-w-0 px-[var(--page-gutter)] py-8">
          <nav
            className="mb-6 flex gap-1 overflow-x-auto rounded-xl border bg-surface p-1 lg:hidden"
            aria-label="Administrative navigation"
          >
            {visibleNavigation.map(({ href, label, icon: Icon }) => (
              <NavLink
                className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-primary aria-[current=page]:text-inverse-foreground"
                key={href}
                to={href}
                end={href === '/admin/overview'}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </NavLink>
            ))}
            {canReadSafety ? (
              <NavLink
                className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-primary aria-[current=page]:text-inverse-foreground"
                to="/admin/safety"
              >
                <Activity className="size-4" />
                Safety
              </NavLink>
            ) : null}
          </nav>
          {children}
        </main>
      </div>
    </div>
  );
}
