import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors duration-[var(--motion-short)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-inverse-foreground shadow-[var(--shadow-sm)] hover:bg-primary-hover',
        secondary: 'bg-secondary text-foreground hover:bg-surface-interactive',
        outline:
          'border border-border-strong bg-surface text-foreground hover:bg-surface-subtle',
        ghost:
          'text-muted-foreground hover:bg-surface-subtle hover:text-foreground',
        destructive: 'bg-danger text-inverse-foreground hover:bg-danger/90',
      },
      size: {
        default: 'h-[var(--control-height)]',
        compact: 'h-9 min-h-9 px-3',
        icon: 'size-11 px-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      type={type}
      {...props}
    />
  );
}
