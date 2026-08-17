import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmActionDialog } from '@/components/patterns/confirm-action-dialog';

describe('ConfirmActionDialog', () => {
  it('opens from the keyboard, exposes its controls, and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmActionDialog
        cancelLabel="Keep open"
        confirmLabel="Confirm example"
        description="No live action is performed."
        title="Confirm this example?"
        triggerLabel="Open example"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Open example' });
    trigger.focus();
    await user.keyboard('{Enter}');

    const dialog = screen.getByRole('dialog', {
      name: 'Confirm this example?',
    });
    expect(dialog).toBeVisible();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Confirm example' }),
    ).toBeEnabled();
    const cancel = screen.getByRole('button', { name: 'Keep open' });
    await user.click(cancel);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('calls the provided confirmation handler', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmActionDialog
        confirmLabel="Confirm example"
        description="No live action is performed."
        onConfirm={onConfirm}
        title="Confirm this example?"
        triggerLabel="Open example"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open example' }));
    await user.click(screen.getByRole('button', { name: 'Confirm example' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('stays open while pending and reports a failed async action', async () => {
    const user = userEvent.setup();
    let rejectAction: ((error: Error) => void) | undefined;
    const action = new Promise<void>((_resolve, reject) => {
      rejectAction = reject;
    });
    render(
      <ConfirmActionDialog
        confirmLabel="Disable account"
        description="This is a consequential action."
        onConfirm={() => action}
        title="Disable this account?"
        triggerLabel="Disable"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    await user.click(screen.getByRole('button', { name: 'Disable account' }));
    expect(screen.getByRole('button', { name: 'Pending' })).toBeDisabled();
    expect(screen.getByRole('dialog')).toBeVisible();

    rejectAction?.(new Error('fixture failure'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The action could not be completed.',
    );
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Disable account' }),
    ).toBeEnabled();
  });
});
