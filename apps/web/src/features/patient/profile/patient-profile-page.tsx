import {
  PatientProfileResponseSchema,
  type PatientProfileResponse,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { PatientShell } from '@/app/shells/patient-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiMutate } from '@/lib/api/client';

export function PatientProfilePage() {
  const profile = useQuery({
    queryKey: ['patient', 'profile'],
    queryFn: ({ signal }) =>
      apiGet<PatientProfileResponse>('/api/v1/patient/profile', {
        schema: PatientProfileResponseSchema,
        signal,
      }),
  });
  const [pending, setPending] = useState(false);
  if (profile.isLoading)
    return (
      <PatientShell>
        <LoadingState />
      </PatientShell>
    );
  if (!profile.data || profile.isError)
    return (
      <PatientShell>
        <ErrorState />
      </PatientShell>
    );
  const data = profile.data;
  const updateTimezone = async (form: FormData) => {
    setPending(true);
    try {
      await apiMutate(
        '/api/v1/patient/profile',
        'PATCH',
        {
          monitoringTimezone: String(form.get('monitoringTimezone')),
          expectedVersion: data.version,
        },
        { schema: PatientProfileResponseSchema },
      );
      await profile.refetch();
    } finally {
      setPending(false);
    }
  };
  const updatePreferences = async (form: FormData) => {
    setPending(true);
    try {
      await apiMutate(
        '/api/v1/patient/profile/preferences',
        'POST',
        {
          mutualHelpPreference: form.get('mutualHelpPreference') || null,
          spiritualContentPreference:
            form.get('spiritualContentPreference') || null,
          expectedVersion: data.preferences.version,
        },
        { schema: PatientProfileResponseSchema },
      );
      await profile.refetch();
    } finally {
      setPending(false);
    }
  };
  return (
    <WorkspaceBoundary destination="/patient/profile">
      <PatientShell>
        <div className="mb-8">
          <p className="m-0 text-sm font-semibold text-success">
            Setup incomplete
          </p>
          <h1 className="mb-0 mt-2 text-3xl font-semibold">
            Profile preferences
          </h1>
          <p className="text-muted-foreground">
            Review the account details and preferences used by future monitoring
            setup.
          </p>
        </div>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <h2 className="m-0 text-lg font-semibold">Identity</h2>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="m-0 text-xs text-muted-foreground">Name</p>
                <p className="m-0 font-medium">{data.name}</p>
              </div>
              <div>
                <p className="m-0 text-xs text-muted-foreground">Email</p>
                <p className="m-0 font-medium">{data.email}</p>
              </div>
              <div>
                <p className="m-0 text-xs text-muted-foreground">Account</p>
                <p className="m-0 font-medium">{data.accountState}</p>
              </div>
              <div>
                <p className="m-0 text-xs text-muted-foreground">Onboarding</p>
                <p className="m-0 font-medium">Incomplete</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="m-0 text-lg font-semibold">Monitoring timezone</h2>
            </CardHeader>
            <CardContent>
              <form
                action={(form) => void updateTimezone(form)}
                className="grid gap-3"
              >
                <Label htmlFor="monitoringTimezone">IANA timezone</Label>
                <Input
                  id="monitoringTimezone"
                  name="monitoringTimezone"
                  defaultValue={data.monitoringTimezone}
                  required
                />
                <Button className="sm:w-fit" type="submit" disabled={pending}>
                  Save timezone
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="m-0 text-lg font-semibold">Content preferences</h2>
            </CardHeader>
            <CardContent>
              <form
                action={(form) => void updatePreferences(form)}
                className="grid gap-4"
              >
                <label className="grid gap-2 text-sm font-medium">
                  Mutual-help preference
                  <select
                    className="h-11 rounded-md border bg-surface px-3"
                    name="mutualHelpPreference"
                    defaultValue={data.preferences.mutualHelpPreference ?? ''}
                  >
                    <option value="">Not supplied</option>
                    <option value="NONE">None</option>
                    <option value="AA_12_STEP">AA / 12-step</option>
                    <option value="ALTERNATIVE">Alternative</option>
                    <option value="UNSURE">Unsure</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Spiritual content
                  <select
                    className="h-11 rounded-md border bg-surface px-3"
                    name="spiritualContentPreference"
                    defaultValue={
                      data.preferences.spiritualContentPreference ?? ''
                    }
                  >
                    <option value="">Not supplied</option>
                    <option value="ALLOW">Allow</option>
                    <option value="DO_NOT_ALLOW">Do not allow</option>
                    <option value="UNSURE">Unsure</option>
                  </select>
                </label>
                <Button className="sm:w-fit" type="submit" disabled={pending}>
                  Save preferences
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </PatientShell>
    </WorkspaceBoundary>
  );
}
