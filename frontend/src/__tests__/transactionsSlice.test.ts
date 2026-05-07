import { describe, it, expect } from 'vitest';
import transactionsReducer, {
  createTransactionThunk,
  deleteTransactionThunk,
  updateTransactionThunk,
  fetchTransactions,
  removeTransactionsByAccount,
} from '../store/transactionsSlice';
import type { TransactionsState } from '../store/transactionsSlice';
import type { Transaction } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function emptyState(): TransactionsState {
  return { transactions: [], loading: false, error: null };
}

function stateWith(transactions: Transaction[]): TransactionsState {
  return { transactions, loading: false, error: null };
}

let nextId = 1;
function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: String(nextId++),
    accountId: '1',
    description: 'Test',
    amount: 100,
    type: 'debit',
    date: '2026-05-01',
    category: 'Misc',
    ...overrides,
  };
}

const req = '';

// ---------------------------------------------------------------------------
// Optimistic add — pending inserts, fulfilled is no-op, rejected rolls back
// ---------------------------------------------------------------------------

describe('createTransactionThunk — optimistic add', () => {
  it('pending: inserts the transaction immediately', () => {
    const t = txn();
    const next = transactionsReducer(
      emptyState(),
      createTransactionThunk.pending(req, t),
    );
    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0]).toEqual(t);
  });

  it('fulfilled: is a no-op (transaction already present from pending)', () => {
    const t = txn();
    const afterPending = transactionsReducer(
      emptyState(),
      createTransactionThunk.pending(req, t),
    );
    const afterFulfilled = transactionsReducer(
      afterPending,
      createTransactionThunk.fulfilled(t, req, t),
    );
    // same length — fulfilled did not add a second copy
    expect(afterFulfilled.transactions).toHaveLength(1);
    expect(afterFulfilled.transactions[0]).toEqual(t);
  });

  it('rejected: removes the optimistically-added transaction', () => {
    const t = txn();
    const afterPending = transactionsReducer(
      emptyState(),
      createTransactionThunk.pending(req, t),
    );
    const afterRejected = transactionsReducer(
      afterPending,
      createTransactionThunk.rejected(new Error('API error'), req, t),
    );
    expect(afterRejected.transactions).toHaveLength(0);
  });

  it('rejected: removes only the failed transaction, leaving others intact', () => {
    const existing = txn({ id: 'existing' });
    const failed = txn({ id: 'failed' });
    const afterPending = transactionsReducer(
      stateWith([existing]),
      createTransactionThunk.pending(req, failed),
    );
    const afterRejected = transactionsReducer(
      afterPending,
      createTransactionThunk.rejected(new Error('fail'), req, failed),
    );
    expect(afterRejected.transactions).toHaveLength(1);
    expect(afterRejected.transactions[0].id).toBe('existing');
  });
});

// ---------------------------------------------------------------------------
// deleteTransactionThunk.fulfilled — removes by ID
// ---------------------------------------------------------------------------

describe('deleteTransactionThunk.fulfilled', () => {
  it('removes the deleted transaction', () => {
    const t = txn();
    const next = transactionsReducer(
      stateWith([t]),
      deleteTransactionThunk.fulfilled(t, req, t),
    );
    expect(next.transactions).toHaveLength(0);
  });

  it('leaves other transactions intact', () => {
    const a = txn({ id: 'a' });
    const b = txn({ id: 'b' });
    const next = transactionsReducer(
      stateWith([a, b]),
      deleteTransactionThunk.fulfilled(a, req, a),
    );
    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0].id).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// updateTransactionThunk.fulfilled — replaces by ID
// ---------------------------------------------------------------------------

describe('updateTransactionThunk.fulfilled', () => {
  it('replaces the updated transaction in place', () => {
    const original = txn({ id: 'tx1', amount: 100, type: 'debit' });
    const updated = { ...original, amount: 250 };
    const next = transactionsReducer(
      stateWith([original]),
      updateTransactionThunk.fulfilled({ updated, previous: original }, req, updated),
    );
    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0].amount).toBe(250);
  });

  it('preserves list order after update', () => {
    const a = txn({ id: 'a' });
    const b = txn({ id: 'b' });
    const c = txn({ id: 'c' });
    const updatedB = { ...b, amount: 999 };
    const next = transactionsReducer(
      stateWith([a, b, c]),
      updateTransactionThunk.fulfilled({ updated: updatedB, previous: b }, req, updatedB),
    );
    expect(next.transactions.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(next.transactions[1].amount).toBe(999);
  });
});

// ---------------------------------------------------------------------------
// fetchTransactions.fulfilled — per-account merge
// ---------------------------------------------------------------------------

describe('fetchTransactions.fulfilled', () => {
  it('adds transactions for a new account', () => {
    const t = txn({ accountId: '2' });
    const next = transactionsReducer(
      emptyState(),
      fetchTransactions.fulfilled([t], req, '2'),
    );
    expect(next.transactions).toHaveLength(1);
  });

  it('replaces transactions for the same account on refetch', () => {
    const old = txn({ id: 'old', accountId: '1' });
    const fresh = txn({ id: 'fresh', accountId: '1' });
    const next = transactionsReducer(
      stateWith([old]),
      fetchTransactions.fulfilled([fresh], req, '1'),
    );
    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0].id).toBe('fresh');
  });

  it('does not affect transactions from other accounts', () => {
    const acct2txn = txn({ id: 'acct2', accountId: '2' });
    const freshForAcct1 = txn({ id: 'acct1', accountId: '1' });
    const next = transactionsReducer(
      stateWith([acct2txn]),
      fetchTransactions.fulfilled([freshForAcct1], req, '1'),
    );
    expect(next.transactions).toHaveLength(2);
    expect(next.transactions.some((t) => t.id === 'acct2')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// removeTransactionsByAccount — bulk delete for account teardown
// ---------------------------------------------------------------------------

describe('removeTransactionsByAccount', () => {
  it('removes all transactions for the given account', () => {
    const a1 = txn({ accountId: '1' });
    const a2 = txn({ accountId: '1' });
    const other = txn({ accountId: '2' });
    const next = transactionsReducer(
      stateWith([a1, a2, other]),
      removeTransactionsByAccount('1'),
    );
    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0].accountId).toBe('2');
  });

  it('is a no-op for an account with no transactions', () => {
    const t = txn({ accountId: '2' });
    const next = transactionsReducer(stateWith([t]), removeTransactionsByAccount('1'));
    expect(next.transactions).toHaveLength(1);
  });
});
