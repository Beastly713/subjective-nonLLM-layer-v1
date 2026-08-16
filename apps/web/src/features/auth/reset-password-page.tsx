import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';

import { FormField } from '@/components/patterns/form-field';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/auth-client';
import { AuthShell } from './auth-shell';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  const { register, handleSubmit, formState } = useForm<{ password: string }>();
  const submit = handleSubmit(async ({ password }) => {
    if (!token) return;
    setError(undefined);
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    if (result.error) {
      setError(
        'This reset link is invalid or has expired. Request a new recovery email.',
      );
      return;
    }
    setComplete(true);
  });

  return (
    <AuthShell
      title="Set a new password"
      description="Completing a reset signs out existing sessions for this account."
    >
      {!token ? (
        <p role="alert" className="text-danger">
          This reset link is incomplete.
        </p>
      ) : complete ? (
        <p role="status">
          Your password was updated.{' '}
          <Link className="font-semibold text-primary underline" to="/login">
            Sign in again
          </Link>
          .
        </p>
      ) : (
        <form className="grid gap-5" onSubmit={submit}>
          <FormField
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            {...register('password', { required: true, minLength: 8 })}
          />
          {error ? (
            <p className="m-0 text-sm font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
