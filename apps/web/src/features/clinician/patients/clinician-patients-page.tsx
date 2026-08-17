import {
  ClinicianPatientListResponseSchema,
  type ClinicianPatientListResponse,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';

import { ClinicianShell } from '@/app/shells/clinician-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/patterns/system-state';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiGet } from '@/lib/api/client';

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
    <WorkspaceBoundary destination="/clinician/patients">
      <ClinicianShell>
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="m-0 text-sm font-semibold text-primary">
              Direct assignments only
            </p>
            <h1 className="mb-0 mt-1 text-3xl font-semibold">Patients</h1>
            <p className="mb-0 mt-2 text-sm text-muted-foreground">
              Only active clinician-to-patient assignments appear here.
            </p>
          </div>
          <label className="relative block sm:w-80">
            <span className="sr-only">Search assigned patients</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name or patient ID"
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
                    </tr>
                  </thead>
                  <tbody>
                    {patients.data?.items.map((patient) => (
                      <tr className="border-t" key={patient.patientId}>
                        <td className="px-4 py-4">
                          <p className="m-0 font-semibold">{patient.name}</p>
                          <p className="m-0 font-mono text-xs text-muted-foreground">
                            {patient.patientId}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {patient.monitoringTimezone}
                        </td>
                        <td className="px-4 py-4">Incomplete</td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {patient.preferences.mutualHelpPreference ??
                            'Not supplied'}{' '}
                          ·{' '}
                          {patient.preferences.spiritualContentPreference ??
                            'Not supplied'}
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
