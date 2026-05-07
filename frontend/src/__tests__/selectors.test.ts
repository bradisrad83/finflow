import { describe, it, expect } from 'vitest';
import type { Account, Transaction } from '../types';
import {
  selectNetWorth,
  selectUniqueCategories,
  selectMonthlyNet,
  selectAccountById,
} from '../store/selectors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(
  accounts: Account[] = [],
  transactions: Transaction[] = [],
) {
  return {
    accounts: { accounts, loading: false, error: null },
    transactions: { transactions, loading: false, error: null },
  } as const;
}

const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, '0');
const thisMonth = (dd: number) => `${yyyy}-${mm}-${String(dd).padStart(2, '0')}`;

let nextId = 1;
function account(balance: number, type: 'checking' | 'savings' = 'checking'): Account {
  return { id: String(nextId++), name: `Account ${nextId}`, type, balance };
}

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: String(nextId++),
    accountId: '1',
    description: 'Test',
    amount: 100,
    type: 'debit',
    date: thisMonth(15),
    category: 'Misc',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// selectNetWorth
// ---------------------------------------------------------------------------

describe('selectNetWorth', () => {
  it('returns 0 for empty accounts', () => {
    expect(selectNetWorth(makeState())).toBe(0);
  });

  it('returns the single account balance', () => {
    expect(selectNetWorth(makeState([account(1500)]))).toBe(1500);
  });

  it('sums all account balances', () => {
    expect(selectNetWorth(makeState([account(1000), account(2500), account(500)]))).toBe(4000);
  });

  it('handles negative balances', () => {
    expect(selectNetWorth(makeState([account(1000), account(-200)]))).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// selectUniqueCategories
// ---------------------------------------------------------------------------

describe('selectUniqueCategories', () => {
  it('returns empty array for no transactions', () => {
    expect(selectUniqueCategories(makeState())).toEqual([]);
  });

  it('deduplicates categories', () => {
    const transactions = [
      txn({ category: 'Groceries' }),
      txn({ category: 'Transport' }),
      txn({ category: 'Groceries' }),
    ];
    expect(selectUniqueCategories(makeState([], transactions))).toEqual(['Groceries', 'Transport']);
  });

  it('returns categories sorted alphabetically', () => {
    const transactions = [
      txn({ category: 'Transport' }),
      txn({ category: 'Groceries' }),
      txn({ category: 'Income' }),
    ];
    expect(selectUniqueCategories(makeState([], transactions))).toEqual([
      'Groceries',
      'Income',
      'Transport',
    ]);
  });
});

// ---------------------------------------------------------------------------
// selectMonthlyNet
// ---------------------------------------------------------------------------

describe('selectMonthlyNet', () => {
  it('returns 0 for no transactions', () => {
    expect(selectMonthlyNet(makeState())).toBe(0);
  });

  it('ignores transactions from past months', () => {
    const transactions = [txn({ date: '2020-01-15', type: 'credit', amount: 500 })];
    expect(selectMonthlyNet(makeState([], transactions))).toBe(0);
  });

  it('sums credits in the current month', () => {
    const transactions = [
      txn({ date: thisMonth(1), type: 'credit', amount: 1000 }),
      txn({ date: thisMonth(10), type: 'credit', amount: 500 }),
    ];
    expect(selectMonthlyNet(makeState([], transactions))).toBe(1500);
  });

  it('subtracts debits from the current month', () => {
    const transactions = [
      txn({ date: thisMonth(5), type: 'debit', amount: 200 }),
      txn({ date: thisMonth(12), type: 'debit', amount: 100 }),
    ];
    expect(selectMonthlyNet(makeState([], transactions))).toBe(-300);
  });

  it('computes net across mixed credits and debits', () => {
    const transactions = [
      txn({ date: thisMonth(1), type: 'credit', amount: 4200 }),
      txn({ date: thisMonth(5), type: 'debit', amount: 87 }),
      txn({ date: thisMonth(8), type: 'debit', amount: 22.50 }),
      txn({ date: '2020-06-01', type: 'credit', amount: 9999 }), // past — excluded
    ];
    expect(selectMonthlyNet(makeState([], transactions))).toBeCloseTo(4090.5);
  });
});

// ---------------------------------------------------------------------------
// selectAccountById
// ---------------------------------------------------------------------------

describe('selectAccountById', () => {
  it('returns null when no accounts exist', () => {
    expect(selectAccountById('1')(makeState())).toBeNull();
  });

  it('returns the matching account', () => {
    const acc = account(1000);
    expect(selectAccountById(acc.id)(makeState([acc]))).toEqual(acc);
  });

  it('returns null for a non-existent id', () => {
    expect(selectAccountById('999')(makeState([account(1000)]))).toBeNull();
  });

  it('returns the correct account when multiple exist', () => {
    const a1 = account(100);
    const a2 = account(200);
    const a3 = account(300);
    expect(selectAccountById(a2.id)(makeState([a1, a2, a3]))).toEqual(a2);
  });
});
