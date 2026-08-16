import type { InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-[var(--control-height)] w-full rounded-md border bg-surface px-3 text-base text-foreground shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-[var(--motion-short)] placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-subtle-foreground aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/15 sm:text-sm',
        className,
      )}
      {...props}
    />
  );
}
