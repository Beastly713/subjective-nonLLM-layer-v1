import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ConfirmActionDialogProps = {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  intent?: 'normal' | 'destructive';
  pending?: boolean;
  disabled?: boolean;
  onConfirm?: () => void | Promise<void>;
};

export function ConfirmActionDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  intent = 'normal',
  pending = false,
  disabled = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [internalPending, setInternalPending] = useState(false);
  const [error, setError] = useState<string>();
  const isPending = pending || internalPending;

  const confirm = async () => {
    setInternalPending(true);
    setError(undefined);
    try {
      await onConfirm?.();
      setOpen(false);
    } catch {
      setError(
        'The action could not be completed. Review the current state and try again.',
      );
    } finally {
      setInternalPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !isPending && setOpen(nextOpen)}
    >
      <DialogTrigger
        className={buttonVariants({
          variant: intent === 'destructive' ? 'destructive' : 'primary',
        })}
        disabled={disabled}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <div className="pr-10">
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
            {title}
          </DialogTitle>
          <DialogDescription className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </DialogDescription>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <DialogClose
            className={buttonVariants({ variant: 'outline' })}
            disabled={isPending}
          >
            {cancelLabel}
          </DialogClose>
          <button
            className={cn(
              buttonVariants({
                variant: intent === 'destructive' ? 'destructive' : 'primary',
              }),
              'min-w-28',
            )}
            disabled={isPending}
            onClick={() => void confirm()}
            type="button"
          >
            {isPending ? (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                Pending
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
        {error ? (
          <p className="m-0 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
