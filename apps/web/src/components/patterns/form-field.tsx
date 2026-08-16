import { useId, type InputHTMLAttributes } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  helpText?: string;
  error?: string;
};

export function FormField({
  label,
  helpText,
  error,
  className,
  ...inputProps
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = `field-${generatedId}`;
  const helpId = helpText ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        {...inputProps}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      />
      {helpText ? (
        <p className="m-0 text-sm text-muted-foreground" id={helpId}>
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p
          className="m-0 flex items-center gap-1.5 text-sm font-medium text-danger"
          id={errorId}
          role="alert"
        >
          <span aria-hidden="true">●</span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
