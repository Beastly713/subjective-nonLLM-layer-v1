import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface-subtle text-muted-foreground',
        success: 'border-success-border bg-success-surface text-success',
        information:
          'border-information-border bg-information-surface text-information',
        warning: 'border-warning-border bg-warning-surface text-warning',
        danger: 'border-danger-border bg-danger-surface text-danger',
        stale: 'border-stale-border bg-stale-surface text-stale',
        restricted:
          'border-restricted-border bg-restricted-surface text-restricted',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
