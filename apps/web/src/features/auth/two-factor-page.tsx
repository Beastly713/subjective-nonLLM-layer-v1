import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { FormField } from '@/components/patterns/form-field';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/auth-client';
import { AuthShell } from './auth-shell';

export function TwoFactorPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const { register, handleSubmit, formState } = useForm<{ code: string }>();
  const submit = handleSubmit(async ({ code }) => {
    setError(undefined);
    const result = await authClient.twoFactor.verifyTotp({
      code,
      trustDevice: false,
    });
    if (result.error) {
      setError(
        'The verification code was not accepted. Try the current code from your authenticator.',
      );
      return;
    }
    await navigate('/');
  });

  return (
    <AuthShell
      title="Two-step verification"
      description="Enter the current code from your authenticator app to finish signing in."
    >
      <form className="grid gap-5" onSubmit={submit}>
        <FormField
          label="Authentication code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={8}
          required
          {...register('code', { required: true })}
        />
        {error ? (
          <p className="m-0 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Verifying…' : 'Verify and continue'}
        </Button>
      </form>
    </AuthShell>
  );
}
