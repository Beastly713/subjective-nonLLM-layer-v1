import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { FormField } from '@/components/patterns/form-field';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/auth-client';

import { AuthShell } from './auth-shell';
import { useAuthCapabilities } from './use-auth-data';

type LoginFields = { email: string; password: string };

export function LoginPage() {
  const navigate = useNavigate();
  const capabilities = useAuthCapabilities();
  const [error, setError] = useState<string>();
  const { register, handleSubmit, formState } = useForm<LoginFields>();

  const submit = handleSubmit(async (values) => {
    setError(undefined);
    const result = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });

    if (result.error) {
      setError(
        result.error.code === 'EMAIL_NOT_VERIFIED'
          ? 'This account must be verified before sign in. Contact your administrator if you need help.'
          : 'The email or password was not accepted.',
      );
      return;
    }

    if (result.data && 'twoFactorRedirect' in result.data) {
      await navigate('/two-factor');
      return;
    }

    await navigate('/');
  });

  return (
    <AuthShell
      title="Sign in"
      description="Use the account credentials provided by your administrator."
    >
      <form className="grid gap-5" onSubmit={submit} noValidate>
        <FormField
          label="Email address"
          type="email"
          autoComplete="email"
          required
          {...register('email', { required: true })}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          {...register('password', { required: true })}
        />
        {error ? (
          <p className="m-0 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Signing in…' : 'Sign in securely'}
        </Button>
      </form>
      {capabilities.data?.passwordRecoveryAvailable ? (
        <p className="mb-0 mt-5 text-center text-sm">
          <Link
            className="font-semibold text-primary underline"
            to="/recover-account"
          >
            Recover your account
          </Link>
        </p>
      ) : (
        <p className="mb-0 mt-5 text-center text-sm text-muted-foreground">
          Account recovery is unavailable in this environment.
        </p>
      )}
    </AuthShell>
  );
}
