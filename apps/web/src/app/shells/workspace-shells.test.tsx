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
  it('shows routing only when the backend projects its read permission', () => {
    const { rerender } = render(
      <MemoryRouter>
        <AdminShell permissions={[]}>
          <span>Content</span>
        </AdminShell>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole('link', { name: 'Regional Routing' }),
    ).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <AdminShell permissions={['ROUTING_CONFIG_READ']}>
          <span>Content</span>
        </AdminShell>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('link', { name: 'Regional Routing' }),
    ).toBeVisible();
  });

  it.each([
    [PatientShell, 'Patient space', ['Profile']],
    [ClinicianShell, 'Clinician workspace', ['Patients', 'Safety']],
    [AdminShell, 'Administrative console', ['Users & Access']],
  ] as const)(
    'renders distinct implemented destinations for %s',
    (Shell, identity, destinations) => {
      render(
        <MemoryRouter>
          <Shell>
            <h1>Workspace content</h1>
          </Shell>
        </MemoryRouter>,
      );

      expect(screen.getByText(identity)).toBeVisible();

      for (const destination of destinations) {
        expect(
          screen.getByRole('link', { name: destination }),
        ).toBeVisible();
      }

      const implementedDestinations = new Set<string>(destinations);

      for (const label of forbiddenNavigation) {
        if (implementedDestinations.has(label)) {
          continue;
        }

        expect(
          screen.queryByRole('link', { name: label }),
        ).not.toBeInTheDocument();
      }
    },
  );
});