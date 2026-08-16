import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormField } from '@/components/patterns/form-field';

describe('FormField', () => {
  it('associates its label, help, and validation error with the control', () => {
    render(
      <FormField
        error="Use a supported reference value."
        helpText="This text explains the expected format."
        label="Reference value"
      />,
    );

    const input = screen.getByLabelText('Reference value');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'This text explains the expected format. Use a supported reference value.',
    );
    expect(screen.getByText('Use a supported reference value.')).toBeVisible();
  });
});
