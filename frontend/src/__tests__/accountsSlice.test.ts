import { describe, it, expect } from 'vitest';
import accountsReducer from '../store/accountsSlice';
import type { AccountsState } from '../store/accountsSlice';
import { deleteAccountThunk } from '../store/accountsSlice';
import {
  createTransactionThunk,
  deleteTransactionThunk,
  updateTransactionThunk,
  fetchAllTransactions,
} from '../store/transactionsSlice';
import type { Transaction } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function baseState(): AccountsState {
  return {
    accounts: [
      { id: '1', name: 'Checking', type: 'checking', balance: 1000 },
      { id: '2', name: 'Savings', type: 'savings', balance: 500 },
    ],
    loading: false,
    error: null,
  };
}

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    accountId: '1',
    description: 'Test',
    amount: 100,
    type: 'debit',
    date: '2026-05-01',
    category: 'Misc',
    ...overrides,
  };
}

const req = '';  // request ID — irrelevant for reducer tests

// ---------------------------------------------------------------------------
// createTransactionThunk.fulfilled — adds delta to account balance
// ---------------------------------------------------------------------------

describe('createTransactionThunk.fulfilled', () => {
  it('decreases balance for a debit', () => {
    const state = baseState();
    const t = txn({ accountId: '1', type: 'debit', amount: 200 });
    const next = accountsReducer(state, createTransactionThunk.fulfilled(t, req, t));
    expect(next.accounts.find((a) => a.id === '1')!.balance).toBe(800);
  });

  it('increases balance for a credit', () => {
    const state = baseState();
    const t = txn({ accountId: '1', type: 'credit', amount: 300 });
    const next = accountsReducer(state, createTransactionThunk.fulfilled(t, req, t));
    expect(next.accounts.find((a) => a.id === '1')!.balance).toBe(1300);
  });

  it('does not affect other accounts', () => {
    const state = baseState();
    const t = txn({ accountId: '1', type: 'debit', amount: 100 });
    const next = accountsReducer(state, createTransactionThunk.fulfilled(t, req, t));
    expect(next.accounts.find((a) => a.id === '2')!.balance).toBe(500);
  });

  it('ignores unknown account IDs', () => {
    const state = baseState();
    const t = txn({ accountId: 'unknown', type: 'debit', amount: 100 });
    const next = accountsReducer(state, createTransactionThunk.fulfilled(t, req, t));
    expect(next.accounts.map((a) => a.balance)).toEqual([1000, 500]);
  });
});

// ---------------------------------------------------------------------------
// deleteTransactionThunk.fulfilled — reverses the delta
// ---------------------------------------------------------------------------

describe('deleteTransactionThunk.fulfilled', () => {
  it('restores balance when a debit is deleted', () => {
    const state = baseState();
    const t = txn({ accountId: '1', type: 'debit', amount: 200 });
    const next = accountsReducer(state, deleteTransactionThunk.fulfilled(t, req, t));
    expect(next.accounts.find((a) => a.id === '1')!.balance).toBe(1200);
  });

  it('reduces balance when a credit is deleted', () => {
    const state = baseState();
    const t = txn({ accountId: '1', type: 'credit', amount: 300 });
    const next = accountsReducer(state, deleteTransactionThunk.fulfilled(t, req, t));
    expect(next.accounts.find((a) => a.id === '1')!.balance).toBe(700);
  });
});

// ---------------------------------------------------------------------------
// updateTransactionThunk.fulfilled — reverse old, apply new
// ---------------------------------------------------------------------------

describe('updateTransactionThunk.fulfilled', () => {
  it('adjusts balance when amount changes', () => {
    // previous: debit 100 → balance was reduced by 100
    // updated:  debit 250 → balance should be reduced by 250
    // net change: -150 from starting balance of 1000
    const state = baseState();
    const previous = txn({ accountId: '1', type: 'debit', amount: 100 });
    const updated = txn({ accountId: '1', type: 'debit', amount: 250 });
    const next = accountsReducer(
      state,
      updateTransactionThunk.fulfilled({ updated, previous }, req, updated),
    );
    expect(next.accounts.find((a) => a.id === '1')!.balance).toBe(850);
  });

  it('adjusts balance when type flips from debit to credit', () => {
    // previous: debit 100 → balance was -100
    // updated: credit 100 → balance should be +100
    // net change from 1000: reverse -100 (+100) + apply +100 = 1200
    const state = baseState();
    const previous = txn({ accountId: '1', type: 'debit', amount: 100 });
    const updated = txn({ accountId: '1', type: 'credit', amount: 100 });
    const next = accountsReducer(
      state,
      updateTransactionThunk.fulfilled({ updated, previous }, req, updated),
    );
    expect(next.accounts.find((a) => a.id === '1')!.balance).toBe(1200);
  });

  it('is a no-op when nothing changes', () => {
    const state = baseState();
    const t = txn({ accountId: '1', type: 'debit', amount: 100 });
    const next = accountsReducer(
      state,
      updateTransactionThunk.fulfilled({ updated: t, previous: t }, req, t),
    );
    expect(next.accounts.find((a) => a.id === '1')!.balance).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// fetchAllTransactions.fulfilled — full recalculation from transaction list
// ---------------------------------------------------------------------------

describe('fetchAllTransactions.fulfilled', () => {
  it('sets balance to 0 when no transactions exist for an account', () => {
    const state = baseState();
    const next = accountsReducer(state, fetchAllTransactions.fulfilled([], req, ['1', '2']));
    expect(next.accounts.find((a) => a.id === '1')!.balance).toBe(0);
    expect(next.accounts.find((a) => a.id === '2')!.balance).toBe(0);
  });

  it('calculates balance from all transactions for an account', () => {
    const state = baseState();
    const transactions = [
      txn({ accountId: '1', type: 'credit', amount: 4200 }),
      txn({ accountId: '1', type: 'debit', amount: 87.43 }),
      txn({ accountId: '2', type: 'credit', amount: 500 }),
    ];
    const next = accountsReducer(
      state,
      fetchAllTransactions.fulfilled(transactions, req, ['1', '2']),
    );
    expect(next.accounts.find((a) => a.id === '1')!.balance).toBeCloseTo(4112.57);
    expect(next.accounts.find((a) => a.id === '2')!.balance).toBe(500);
  });

  it('ignores transactions for unknown accounts', () => {
    const state = baseState();
    const orphan = txn({ accountId: 'unknown', type: 'credit', amount: 9999 });
    const next = accountsReducer(
      state,
      fetchAllTransactions.fulfilled([orphan], req, ['1', '2']),
    );
    expect(next.accounts.map((a) => a.balance)).toEqual([0, 0]);
  });
});

// ---------------------------------------------------------------------------
// deleteAccountThunk.fulfilled — removes the account
// ---------------------------------------------------------------------------

describe('deleteAccountThunk.fulfilled', () => {
  it('removes the deleted account', () => {
    const state = baseState();
    const next = accountsReducer(state, deleteAccountThunk.fulfilled('1', req, '1'));
    expect(next.accounts.find((a) => a.id === '1')).toBeUndefined();
  });

  it('leaves other accounts intact', () => {
    const state = baseState();
    const next = accountsReducer(state, deleteAccountThunk.fulfilled('1', req, '1'));
    expect(next.accounts).toHaveLength(1);
    expect(next.accounts[0].id).toBe('2');
  });

  it('is a no-op for unknown account IDs', () => {
    const state = baseState();
    const next = accountsReducer(state, deleteAccountThunk.fulfilled('unknown', req, 'unknown'));
    expect(next.accounts).toHaveLength(2);
  });
});
