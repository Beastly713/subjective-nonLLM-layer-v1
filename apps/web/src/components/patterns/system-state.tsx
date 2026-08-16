import { AlertCircle, Archive, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type StateFrameProps = {
  icon: ReactNode;
  title: string;
  description: string;
  tone?: 'neutral' | 'danger' | 'restricted';
  role?: 'status' | 'alert';
  actionLabel?: string;
};

function StateFrame({
  icon,
  title,
  description,
  tone = 'neutral',
  role = 'status',
  actionLabel,
}: StateFrameProps) {
  return (
    <div
      className={cn(
        'flex min-h-52 flex-col items-start justify-between gap-6 rounded-lg border bg-surface p-5',
        tone === 'danger' && 'border-danger-border bg-danger-surface/40',
        tone === 'restricted' &&
          'border-restricted-border bg-restricted-surface/50',
      )}
      role={role}
    >
      <div>
        <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-surface-interactive text-primary">
          {icon}
        </div>
        <h3 className="m-0 text-base font-semibold">{title}</h3>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {actionLabel ? (
        <Button size="compact" variant="outline">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingState() {
  return (
    <div
      className="flex min-h-52 flex-col justify-center gap-4 rounded-lg border bg-surface p-5"
      role="status"
    >
      <span className="sr-only">Loading reference content</span>
      <Skeleton className="h-10 w-10" />
      <div className="grid gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <StateFrame
      actionLabel="Optional action"
      description="The space is ready for content when an authoritative source provides it."
      icon={<Archive aria-hidden="true" className="size-5" />}
      title="Nothing to show yet"
    />
  );
}

export function ErrorState() {
  return (
    <StateFrame
      actionLabel="Try again"
      description="The content could not be loaded. No internal details are shown here."
      icon={<AlertCircle aria-hidden="true" className="size-5" />}
      role="alert"
      title="Something needs attention"
      tone="danger"
    />
  );
}

export function RestrictedState() {
  return (
    <StateFrame
      description="This area is unavailable in the current context."
      icon={<LockKeyhole aria-hidden="true" className="size-5" />}
      title="Access restricted"
      tone="restricted"
    />
  );
}

export function SafetyControlledState() {
  return (
    <StateFrame
      description="Safety-controlled state — reference treatment. No guidance or routing is active."
      icon={<ShieldCheck aria-hidden="true" className="size-5" />}
      title="Controlled presentation"
      tone="restricted"
    />
  );
}
