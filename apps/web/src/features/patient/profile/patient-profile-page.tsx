import {
  PatientMonitoringResponseSchema,
  PatientProfileResponseSchema,
  ScheduleReadResponseSchema,
  type ScheduleReadResponse,
  type PatientProfileResponse,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { PatientShell } from '@/app/shells/patient-shell';
import { ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmActionDialog } from '@/components/patterns/confirm-action-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiMutate } from '@/lib/api/client';
import { Link } from 'react-router';
import {
  PatientSafetyBoundary,
  usePatientSafetyProjection,
} from '@/features/patient/safety/patient-safety-boundary';
import { PatientSafetyStatus } from '@/features/patient/safety/patient-safety-status';

const onboardingStatusLabels: Record<
  PatientProfileResponse['onboardingStatus'],
  string
> = {
  INCOMPLETE: 'Setup incomplete',
  PENDING_SAFETY_REVIEW: 'Safety review pending',
  SAFETY_HANDOFF: 'Safety handoff active',
  COMPLETE: 'Setup complete',
};

export function PatientProfilePage() {
  return (
    <PatientSafetyBoundary>
      <PatientProfileContent />
    </PatientSafetyBoundary>
  );
}

function PatientProfileContent() {
  const safetyProjection = usePatientSafetyProjection();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ['patient', 'profile'],
    queryFn: ({ signal }) =>
      apiGet<PatientProfileResponse>('/api/v1/patient/profile', {
        schema: PatientProfileResponseSchema,
        signal,
      }),
  });
  const schedule = useQuery({
    queryKey: ['patient', 'schedule'],
    queryFn: ({ signal }) =>
      apiGet<ScheduleReadResponse>('/api/v1/patient/schedule', {
        schema: ScheduleReadResponseSchema,
        signal,
      }),
  });
  const monitoring = useQuery({
    queryKey: ['patient', 'monitoring'],
    queryFn: ({ signal }) =>
      apiGet('/api/v1/patient/monitoring', {
        schema: PatientMonitoringResponseSchema,
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
  const monitoringData = monitoring.data;
  const updateMonitoring = async (action: 'opt-out' | 're-enable') => {
    if (!monitoringData) return;
    await apiMutate(
      `/api/v1/patient/monitoring/${action}`,
      'POST',
      { expectedVersion: monitoringData.version },
      {
        schema: PatientMonitoringResponseSchema,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      },
    );
    await Promise.all([
      monitoring.refetch(),
      queryClient.invalidateQueries({ queryKey: ['patient', 'home'] }),
    ]);
  };
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
      await schedule.refetch();
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
    <PatientShell>
      <div className="mb-8">
        <p className="m-0 text-sm font-semibold text-success">
          {onboardingStatusLabels[data.onboardingStatus]}
        </p>
        <h1 className="mb-0 mt-2 text-3xl font-semibold">
          Profile preferences
        </h1>
        <p className="text-muted-foreground">
          Review the account details and preferences used by future monitoring
          setup.
        </p>
      </div>
      <div className="mb-6">
        <PatientSafetyStatus projection={safetyProjection} />
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
              <p className="m-0 font-medium">
                {onboardingStatusLabels[data.onboardingStatus]}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="m-0 text-lg font-semibold">Monitoring</h2>
            <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
              Your check-in history stays preserved. You control whether weekly
              monitoring reminders remain active.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="m-0 font-medium">
                {monitoring.isLoading
                  ? 'Loading monitoring status…'
                  : monitoring.isError || !monitoringData
                    ? 'Monitoring status unavailable'
                    : monitoringData.state === 'OPTED_OUT'
                      ? 'Monitoring is paused'
                      : monitoringData.state === 'TECHNICAL_FAILURE'
                        ? 'Timing is paused while an access issue is reviewed'
                        : 'Monitoring is active'}
              </p>
              <p className="mb-0 mt-1 text-sm text-muted-foreground">
                Opting out stops future reminders; it does not delete previous
                assessments.
              </p>
            </div>
            {monitoringData?.state === 'OPTED_OUT' ? (
              <ConfirmActionDialog
                triggerLabel="Re-enable monitoring"
                title="Re-enable weekly monitoring?"
                description="Your current monitoring cycle will restart from the next authoritative schedule boundary. Previous check-ins remain unchanged, and old reminder slots will not be replayed."
                confirmLabel="Re-enable monitoring"
                onConfirm={() => updateMonitoring('re-enable')}
              />
            ) : (
              <ConfirmActionDialog
                triggerLabel="Pause monitoring"
                title="Pause monitoring reminders?"
                description="Weekly monitoring reminders will stop, while your historical check-ins remain available. You can explicitly re-enable monitoring later; this action does not delete any record."
                confirmLabel="Pause monitoring"
                intent="destructive"
                disabled={!monitoringData}
                onConfirm={() => updateMonitoring('opt-out')}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="m-0 text-lg font-semibold">Continue setup</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Complete the guided onboarding screens when you are ready.
            </p>
            <Link to="/patient/onboarding">
              <Button>Continue setup</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="m-0 text-lg font-semibold">Weekly Schedule</h2>
          </CardHeader>
          <CardContent>
            <WeeklySchedule
              data={schedule.data}
              isError={schedule.isError}
              isLoading={schedule.isLoading}
            />
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
  );
}

export function WeeklySchedule({
  data,
  isError,
  isLoading,
}: {
  data: ScheduleReadResponse | undefined;
  isError: boolean;
  isLoading: boolean;
}) {
  if (isLoading)
    return (
      <p className="m-0 text-sm text-muted-foreground">Loading schedule…</p>
    );
  if (isError)
    return (
      <p className="m-0 text-sm text-danger">
        The weekly schedule could not be loaded.
      </p>
    );
  if (data?.state === 'ACTIVATED')
    return (
      <div className="grid gap-2 text-sm">
        <p className="m-0 font-medium">
          Timezone: {data.schedule.monitoringTimezone}
        </p>
        {data.periods.map((period) => (
          <p className="m-0 text-muted-foreground" key={period.periodId}>
            {formatPeriodTime(period.periodStartAt, period.monitoringTimezone)}
            {' – '}
            {formatPeriodTime(period.periodEndAt, period.monitoringTimezone)}
          </p>
        ))}
      </div>
    );
  return (
    <p className="m-0 text-sm text-muted-foreground">
      Weekly monitoring is not yet activated. Your schedule will appear here
      after setup is completed.
    </p>
  );
}

function formatPeriodTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}
