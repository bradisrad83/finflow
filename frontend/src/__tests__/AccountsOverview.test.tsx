import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import AccountsOverview from '../components/AccountsOverview';
import type { Account } from '../types';

// ---------------------------------------------------------------------------
// Empty state interactions
// ---------------------------------------------------------------------------

describe('AccountsOverview — empty state', () => {
  it('clicking "Add your first account" opens the modal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountsOverview />);

    await user.click(screen.getByText('Add your first account'));

    expect(screen.getByText('Account name')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Header button interactions
// ---------------------------------------------------------------------------

describe('AccountsOverview — header buttons', () => {
  it('clicking "Add account" header button opens the modal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountsOverview />);

    await user.click(screen.getByText('Add account'));

    expect(screen.getByText('Account name')).toBeTruthy();
  });

  it('"Refresh balances" is enabled when not loading', () => {
    renderWithProviders(<AccountsOverview />);
    const button = screen.getByText('Refresh balances') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('"Refresh balances" is disabled while loading', () => {
    renderWithProviders(<AccountsOverview />, {
      preloadedState: { accounts: { loading: true } },
    });
    const button = screen.getByText('Refreshing…') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
