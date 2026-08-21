import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BooleanChoice, WeeklyScale } from './weekly-scale';

const scaleItem = {
  itemId: 'R3',
  key: 'craving',
  type: 'INTEGER_0_7',
  direction: 'HIGHER_IS_WORSE',
  prompt: 'How strong were urges or cravings to drink?',
  anchors: {
    zero: 'Not at all',
    seven: 'Extremely',
  },
} as const;

describe('WeeklyScale', () => {
  it('renders exactly the eight 0..7 radio values', () => {
    render(
      <WeeklyScale item={scaleItem} onChange={() => {}} value={undefined} />,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(8);
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ]);
  });

  it('uses descriptive text only for endpoint anchors and neutral Score n labels internally', () => {
    render(
      <WeeklyScale item={scaleItem} onChange={() => {}} value={undefined} />,
    );

    expect(screen.getAllByText('Not at all').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Extremely').length).toBeGreaterThan(0);
    expect(screen.getByText('Score 1')).toBeInTheDocument();
    expect(screen.getByText('Score 6')).toBeInTheDocument();
  });

  it('returns the exact selected numeric value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <WeeklyScale item={scaleItem} onChange={onChange} value={undefined} />,
    );

    await user.click(
      screen.getByText('5', { selector: 'span[aria-hidden="true"]' }),
    );
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('exposes radiogroup semantics and supports keyboard movement through native radio controls', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WeeklyScale item={scaleItem} onChange={onChange} value={0} />);

    const zero = screen.getByRole('radio', { name: /not at all/i });
    zero.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith(1);
  });
});

describe('BooleanChoice', () => {
  it('preserves explicit Boolean false and true values', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <BooleanChoice
        labels={{ false: 'No', true: 'Yes' }}
        onChange={onChange}
        prompt="Did you drink alcohol?"
        value={undefined}
      />,
    );

    await user.click(screen.getByRole('radio', { name: /no/i }));
    await user.click(screen.getByRole('radio', { name: /yes/i }));

    expect(onChange.mock.calls).toEqual([[false], [true]]);
  });
});
