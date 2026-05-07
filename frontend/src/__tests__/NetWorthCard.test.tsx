import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import NetWorthCard from '../components/NetWorthCard';
import type { Account, Transaction } from '../types';


// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function account(balance: number): Account {
  return { id: '1', name: 'Checking', type: 'checking', balance };
}

function creditThisMonth(amount: number): Transaction {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
  return { id: 't1', accountId: '1', description: 'Test', amount, type: 'credit', date, category: 'Income' };
}

// ---------------------------------------------------------------------------
// Skeleton state — no accounts loaded yet
// ---------------------------------------------------------------------------

describe('NetWorthCard — skeleton state', () => {
  it('does not show "Net worth" label while loading', () => {
    renderWithProviders(<NetWorthCard />);
    expect(screen.queryByText(/net worth/i)).toBeNull();
  });

  it('does not show "month to date" while loading', () => {
    renderWithProviders(<NetWorthCard />);
    expect(screen.queryByText(/month to date/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Loaded state — accounts present
// ---------------------------------------------------------------------------

describe('NetWorthCard — loaded state', () => {
  it('shows "Net worth" label once accounts load', () => {
    renderWithProviders(<NetWorthCard />, {
      preloadedState: { accounts: { accounts: [account(1000)] } },
    });
    expect(screen.getByText(/net worth/i)).toBeTruthy();
  });

  it('shows the formatted total balance', () => {
    renderWithProviders(<NetWorthCard />, {
      preloadedState: { accounts: { accounts: [account(1500)] } },
    });
    expect(screen.getByText('$1,500.00')).toBeTruthy();
  });

  it('shows "month to date" label', () => {
    renderWithProviders(<NetWorthCard />, {
      preloadedState: { accounts: { accounts: [account(0)] } },
    });
    expect(screen.getByText('month to date')).toBeTruthy();
  });

  it('shows + prefix for a positive monthly net', () => {
    renderWithProviders(<NetWorthCard />, {
      preloadedState: {
        accounts: { accounts: [account(500)] },
        transactions: { transactions: [creditThisMonth(500)] },
      },
    });
    expect(screen.getByText('+$500.00')).toBeTruthy();
  });

  it('shows +$0.00 when there are no transactions this month (zero is treated as positive)', () => {
    renderWithProviders(<NetWorthCard />, {
      preloadedState: { accounts: { accounts: [account(1000)] } },
    });
    expect(screen.getByText('+$0.00')).toBeTruthy();
  });
});
