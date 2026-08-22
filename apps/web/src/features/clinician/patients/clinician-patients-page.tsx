import {
  ClinicianPatientListResponseSchema,
  type ClinicianPatientListResponse,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { ClinicianShell } from '@/app/shells/clinician-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/patterns/system-state';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiGet } from '@/lib/api/client';

const onboardingStatusLabels = {
  INCOMPLETE: 'Setup incomplete',
  PENDING_SAFETY_REVIEW: 'Safety review pending',
  SAFETY_HANDOFF: 'Safety handoff active',
  COMPLETE: 'Setup complete',
} as const;

export function ClinicianPatientsPage() {
  const [search, setSearch] = useState('');
  const patients = useQuery({
    queryKey: ['clinician', 'patients', search],
    queryFn: ({ signal }) =>
      apiGet<ClinicianPatientListResponse>(
        `/api/v1/clinician/patients?search=${encodeURIComponent(search)}`,
        { schema: ClinicianPatientListResponseSchema, signal },
      ),
  });
  return (
    <WorkspaceBoundary workspace="CLINICIAN">
      <ClinicianShell>
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <PageHeader
            eyebrow="Assigned care directory"
            title="Patients"
            description="Only active clinician-to-patient assignments appear here."
          />
          <label className="relative block sm:w-80">
            <span className="sr-only">Search assigned patients</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search patient name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {patients.isLoading ? (
          <LoadingState />
        ) : patients.isError ? (
          <ErrorState />
        ) : patients.data?.items.length === 0 ? (
          <EmptyState />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-surface-interactive text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Timezone</th>
                      <th className="px-4 py-3">Setup</th>
                      <th className="px-4 py-3">Preferences</th>
                      <th className="px-4 py-3">Monitoring</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.data?.items.map((patient) => (
                      <tr className="border-t" key={patient.patientId}>
                        <td className="px-4 py-4">
                          <p className="m-0 font-semibold">{patient.name}</p>
                          <p
                            className="m-0 text-xs text-muted-foreground"
                            title={patient.patientId}
                          >
                            Profile reference {patient.patientId.slice(0, 8)}…
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {patient.monitoringTimezone}
                        </td>
                        <td className="px-4 py-4">
                          {onboardingStatusLabels[patient.onboardingStatus]}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {patient.preferences.mutualHelpPreference ??
                            'Not supplied'}{' '}
                          ·{' '}
                          {patient.preferences.spiritualContentPreference ??
                            'Not supplied'}
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            className="font-semibold text-primary underline underline-offset-2"
                            to={`/clinician/patients/${patient.patientId}`}
                          >
                            Open detail
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </ClinicianShell>
    </WorkspaceBoundary>
  );
}
