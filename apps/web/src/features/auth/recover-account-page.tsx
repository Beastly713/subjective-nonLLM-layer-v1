import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { FormField } from '@/components/patterns/form-field';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/auth-client';
import { AuthShell } from './auth-shell';
import { useAuthCapabilities } from './use-auth-data';

export function RecoverAccountPage() {
  const capabilities = useAuthCapabilities();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();
  const { register, handleSubmit, formState } = useForm<{ email: string }>();

  const submit = handleSubmit(async ({ email }) => {
    if (!capabilities.data?.passwordRecoveryAvailable) return;
    setError(undefined);
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (result.error) {
      setError(
        'Recovery could not be started. Please wait and try again, or contact your administrator.',
      );
      return;
    }
    setSubmitted(true);
  });

  return (
    <AuthShell
      title="Recover account"
      description="Recovery does not disclose whether an address belongs to an account."
    >
      {capabilities.isLoading ? (
        <p role="status">Checking recovery availability…</p>
      ) : null}
      {capabilities.isError ? (
        <p className="text-danger" role="alert">
          Recovery availability could not be checked. Try again later.
        </p>
      ) : null}
      {capabilities.data && !capabilities.data.passwordRecoveryAvailable ? (
        <div role="status">
          <p>
            Account recovery is unavailable in the current environment. Contact
            your administrator.
          </p>
          <Link className="font-semibold text-primary underline" to="/login">
            Return to sign in
          </Link>
        </div>
      ) : submitted ? (
        <div role="status">
          <p>
            If an account can be recovered for that address, recovery
            instructions will be sent.
          </p>
          <Link className="font-semibold text-primary underline" to="/login">
            Return to sign in
          </Link>
        </div>
      ) : capabilities.data?.passwordRecoveryAvailable ? (
        <form className="grid gap-5" onSubmit={submit}>
          <FormField
            label="Email address"
            type="email"
            autoComplete="email"
            required
            {...register('email', { required: true })}
          />
          {error ? (
            <p className="m-0 text-sm font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting
              ? 'Requesting…'
              : 'Send recovery instructions'}
          </Button>
        </form>
      ) : null}
    </AuthShell>
  );
}
