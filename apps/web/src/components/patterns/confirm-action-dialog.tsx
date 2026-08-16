import { LoaderCircle } from 'lucide-react';

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
  onConfirm?: () => void;
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
  return (
    <Dialog>
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
            disabled={pending}
          >
            {cancelLabel}
          </DialogClose>
          <DialogClose
            className={cn(
              buttonVariants({
                variant: intent === 'destructive' ? 'destructive' : 'primary',
              }),
              'min-w-28',
            )}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? (
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
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
