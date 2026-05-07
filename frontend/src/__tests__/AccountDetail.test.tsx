import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import AccountDetail from '../pages/AccountDetail';
import type { Account } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const checking: Account = {
  id: '1',
  name: 'Primary Checking',
  type: 'checking',
  balance: 12450,
};

const routePath = '/accounts/:id';

// ---------------------------------------------------------------------------
// Account found — renders with the correct data
// ---------------------------------------------------------------------------

describe('AccountDetail — account found', () => {
  it('renders the account name', () => {
    renderWithProviders(<AccountDetail />, {
      initialPath: `/accounts/${checking.id}`,
      routePath,
      preloadedState: { accounts: { accounts: [checking] } },
    });
    expect(screen.getByText('Primary Checking')).toBeTruthy();
  });

  it('renders the formatted account balance', () => {
    renderWithProviders(<AccountDetail />, {
      initialPath: `/accounts/${checking.id}`,
      routePath,
      preloadedState: { accounts: { accounts: [checking] } },
    });
    expect(screen.getByText('$12,450.00')).toBeTruthy();
  });

  it('renders the account type label', () => {
    renderWithProviders(<AccountDetail />, {
      initialPath: `/accounts/${checking.id}`,
      routePath,
      preloadedState: { accounts: { accounts: [checking] } },
    });
    // exact match finds only the type <p>, not the name which contains "Checking"
    expect(screen.getByText('checking')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Account not found — unknown ID in the URL
// ---------------------------------------------------------------------------

describe('AccountDetail — account not found', () => {
  it('shows "Account not found" for an unknown ID', () => {
    renderWithProviders(<AccountDetail />, {
      initialPath: '/accounts/unknown-id',
      routePath,
    });
    expect(screen.getByText('Account not found.')).toBeTruthy();
  });

  it('still shows the back link when account is not found', () => {
    renderWithProviders(<AccountDetail />, {
      initialPath: '/accounts/unknown-id',
      routePath,
    });
    expect(screen.getByText(/back to dashboard/i)).toBeTruthy();
  });
});
