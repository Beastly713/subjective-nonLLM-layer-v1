import type { PatientSafetyProjection } from '@aud-subjective/contracts';
import { createContext, useContext, type ReactNode } from 'react';

import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { usePatientSafety } from './use-patient-safety';
import { PatientSafetyShell } from './patient-safety-shell';

const PatientSafetyContext = createContext<PatientSafetyProjection | null>(
  null,
);

export function usePatientSafetyProjection() {
  const value = useContext(PatientSafetyContext);
  if (!value) {
    throw new Error(
      'usePatientSafetyProjection must be used inside PatientSafetyBoundary.',
    );
  }
  return value;
}

export function PatientSafetyBoundary({ children }: { children: ReactNode }) {
  return (
    <WorkspaceBoundary workspace="PATIENT">
      <PatientSafetyGate>{children}</PatientSafetyGate>
    </WorkspaceBoundary>
  );
}

function PatientSafetyGate({ children }: { children: ReactNode }) {
  const query = usePatientSafety();

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-[var(--page-gutter)] py-10">
        <LoadingState />
      </main>
    );
  }
  if (query.isError || !query.data) {
    return (
      <main className="mx-auto max-w-xl px-[var(--page-gutter)] py-10">
        <ErrorState
          action={
            <Button onClick={() => void query.refetch()}>Try again</Button>
          }
        />
      </main>
    );
  }

  return (
    <PatientSafetyContext.Provider value={query.data}>
      {query.data.requiresSafetyShell ||
      query.data.routeAvailability === 'UNAVAILABLE' ||
      query.data.routeAvailability === 'PARTIAL' ? (
        <PatientSafetyShell projection={query.data} />
      ) : (
        children
      )}
    </PatientSafetyContext.Provider>
  );
}
