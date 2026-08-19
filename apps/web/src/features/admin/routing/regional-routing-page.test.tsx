import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RoutingDetail } from './regional-routing-page';

const id = (suffix: string) =>
  `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;
const kinds = [
  'EMERGENCY_SERVICE',
  'CRISIS_SERVICE',
  'URGENT_MEDICAL_SERVICE',
  'ON_CALL_CLINICIAN_QUEUE',
] as const;

describe('regional routing lifecycle presentation', () => {
  it('shows exact draft state but hides unauthorized lifecycle controls', () => {
    render(
      <RoutingDetail
        canActivate={false}
        canEdit={false}
        canTest={false}
        mutate={vi.fn()}
        profile={{
          id: id('1'),
          countryCode: 'XZ',
          regionCode: 'TEST',
          logicalVersion: 1,
          rowVersion: 1,
          configurationRevision: 1,
          lifecycle: 'DRAFT',
          effectiveAt: null,
          supersededAt: null,
          createdAt: '2026-08-17T00:00:00.000Z',
          targets: kinds.map((kind, index) => ({
            id: id(String(index + 2)),
            kind,
            representation:
              kind === 'ON_CALL_CLINICIAN_QUEUE'
                ? 'INTERNAL_QUEUE'
                : 'TELEPHONE',
            targetValue: `synthetic-${kind}`,
            label: `Synthetic ${kind}`,
          })),
          testEvidence: [],
        }}
      />,
    );
    expect(screen.getByText('DRAFT')).toBeVisible();
    expect(
      screen.getAllByText(/not tested for this configuration revision/i),
    ).toHaveLength(4);
    expect(
      screen.queryByRole('button', {
        name: /record pass|activate|save exact targets/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('textbox')
        .every((field) => field.hasAttribute('disabled')),
    ).toBe(true);
  });
});
