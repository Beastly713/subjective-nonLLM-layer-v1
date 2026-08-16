import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;
export const DialogClose = BaseDialog.Close;

type DialogContentProps = Omit<
  ComponentProps<typeof BaseDialog.Popup>,
  'className'
> & {
  className?: string;
};

export function DialogContent({
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-foreground/35 backdrop-blur-[2px] transition-opacity duration-[var(--motion-short)] data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <BaseDialog.Popup
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-xl border bg-surface-elevated p-5 text-foreground shadow-[var(--shadow-lg)] transition-[scale,opacity] duration-[var(--motion-short)] data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 sm:p-6',
          className,
        )}
        {...props}
      >
        {children}
        <BaseDialog.Close
          aria-label="Close dialog"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon' }),
            'absolute right-3 top-3',
          )}
        >
          <X aria-hidden="true" className="size-5" />
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}
