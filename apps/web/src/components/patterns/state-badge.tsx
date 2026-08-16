import {
  AlertTriangle,
  Check,
  CircleDashed,
  Clock3,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export type StateTone =
  | 'current'
  | 'information'
  | 'warning'
  | 'danger'
  | 'stale'
  | 'restricted'
  | 'partial'
  | 'safety';

const stateAppearance = {
  current: { variant: 'success', icon: Check },
  information: { variant: 'information', icon: CircleDashed },
  warning: { variant: 'warning', icon: AlertTriangle },
  danger: { variant: 'danger', icon: AlertTriangle },
  stale: { variant: 'stale', icon: Clock3 },
  restricted: { variant: 'restricted', icon: LockKeyhole },
  partial: { variant: 'warning', icon: CircleDashed },
  safety: { variant: 'restricted', icon: ShieldCheck },
} as const;

type StateBadgeProps = {
  state: StateTone;
  label: string;
};

export function StateBadge({ state, label }: StateBadgeProps) {
  const { variant, icon: Icon } = stateAppearance[state];

  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </Badge>
  );
}

type FreshnessBadgeProps = {
  freshness: 'current' | 'stale';
  label?: string;
};

export function FreshnessBadge({ freshness, label }: FreshnessBadgeProps) {
  return (
    <StateBadge
      label={label ?? (freshness === 'current' ? 'Current' : 'Stale')}
      state={freshness}
    />
  );
}
