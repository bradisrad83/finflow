import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createWrapper } from '../test-utils/renderWithProviders';
import useTransactions from '../hooks/useTransactions';
import type { Transaction } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let nextId = 1;
function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: String(nextId++),
    accountId: '1',
    description: 'Test transaction',
    amount: 100,
    type: 'debit',
    date: '2026-05-10',
    category: 'Misc',
    ...overrides,
  };
}

function hookWrapper(transactions: Transaction[]) {
  return createWrapper({ preloadedState: { transactions: { transactions } } }).wrapper;
}

// ---------------------------------------------------------------------------
// accountId filter
// ---------------------------------------------------------------------------

describe('useTransactions — accountId filter', () => {
  it('returns only transactions for the given account', () => {
    const t1 = txn({ accountId: '1' });
    const t2 = txn({ accountId: '2' });
    const { result } = renderHook(() => useTransactions('1'), {
      wrapper: hookWrapper([t1, t2]),
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe(t1.id);
  });

  it('returns empty array when account has no transactions', () => {
    const t = txn({ accountId: '2' });
    const { result } = renderHook(() => useTransactions('1'), {
      wrapper: hookWrapper([t]),
    });
    expect(result.current).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// type filter
// ---------------------------------------------------------------------------

describe('useTransactions — type filter', () => {
  const credit = txn({ id: 'c1', type: 'credit' });
  const debit = txn({ id: 'd1', type: 'debit' });

  it('returns all transactions when type is "all"', () => {
    const { result } = renderHook(() => useTransactions('1', { type: 'all' }), {
      wrapper: hookWrapper([credit, debit]),
    });
    expect(result.current).toHaveLength(2);
  });

  it('returns only credits when type is "credit"', () => {
    const { result } = renderHook(() => useTransactions('1', { type: 'credit' }), {
      wrapper: hookWrapper([credit, debit]),
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].type).toBe('credit');
  });

  it('returns only debits when type is "debit"', () => {
    const { result } = renderHook(() => useTransactions('1', { type: 'debit' }), {
      wrapper: hookWrapper([credit, debit]),
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].type).toBe('debit');
  });
});

// ---------------------------------------------------------------------------
// query filter
// ---------------------------------------------------------------------------

describe('useTransactions — query filter', () => {
  it('filters by description substring', () => {
    const netflix = txn({ description: 'Netflix subscription' });
    const salary = txn({ description: 'Direct Deposit - Salary' });
    const { result } = renderHook(() => useTransactions('1', { query: 'netflix' }), {
      wrapper: hookWrapper([netflix, salary]),
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].description).toBe('Netflix subscription');
  });

  it('is case-insensitive', () => {
    const t = txn({ description: 'Whole Foods Market' });
    const { result } = renderHook(() => useTransactions('1', { query: 'WHOLE FOODS' }), {
      wrapper: hookWrapper([t]),
    });
    expect(result.current).toHaveLength(1);
  });

  it('returns empty array when no description matches', () => {
    const t = txn({ description: 'Netflix' });
    const { result } = renderHook(() => useTransactions('1', { query: 'spotify' }), {
      wrapper: hookWrapper([t]),
    });
    expect(result.current).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// sort order
// ---------------------------------------------------------------------------

describe('useTransactions — sort order', () => {
  it('returns transactions sorted newest-first', () => {
    const jan = txn({ date: '2026-01-15' });
    const may = txn({ date: '2026-05-01' });
    const mar = txn({ date: '2026-03-20' });
    const { result } = renderHook(() => useTransactions('1'), {
      wrapper: hookWrapper([jan, may, mar]),
    });
    const dates = result.current.map((t) => t.date);
    expect(dates).toEqual(['2026-05-01', '2026-03-20', '2026-01-15']);
  });
});

// ---------------------------------------------------------------------------
// combined filters
// ---------------------------------------------------------------------------

describe('useTransactions — combined filters', () => {
  it('applies type and query filters together', () => {
    const creditNetflix = txn({ type: 'credit', description: 'Netflix refund' });
    const debitNetflix = txn({ type: 'debit', description: 'Netflix' });
    const debitOther = txn({ type: 'debit', description: 'Spotify' });
    const { result } = renderHook(
      () => useTransactions('1', { type: 'debit', query: 'netflix' }),
      { wrapper: hookWrapper([creditNetflix, debitNetflix, debitOther]) },
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].description).toBe('Netflix');
    expect(result.current[0].type).toBe('debit');
  });
});
