import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AdminShell } from './admin-shell';
import { ClinicianShell } from './clinician-shell';
import { PatientShell } from './patient-shell';

const forbiddenNavigation = [
  'Home',
  'Check-in',
  'Progress',
  'Review Queue',
  'Safety',
  'Content',
  'Configuration',
  'Operations',
  'Audit',
];

describe('workspace shells', () => {
  it.each([
    [PatientShell, 'Patient space', 'Profile'],
    [ClinicianShell, 'Clinician workspace', 'Patients'],
    [AdminShell, 'Administrative console', 'Users & Access'],
  ] as const)(
    'renders a distinct implemented destination for %s',
    (Shell, identity, destination) => {
      render(
        <MemoryRouter>
          <Shell>
            <h1>Workspace content</h1>
          </Shell>
        </MemoryRouter>,
      );
      expect(screen.getByText(identity)).toBeVisible();
      expect(screen.getByRole('link', { name: destination })).toBeVisible();
      for (const label of forbiddenNavigation) {
        expect(
          screen.queryByRole('link', { name: label }),
        ).not.toBeInTheDocument();
      }
    },
  );
});
