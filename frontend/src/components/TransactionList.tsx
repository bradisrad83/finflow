import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { createTransactionThunk, deleteTransactionThunk } from '../store/transactionsSlice';
import type { Transaction } from '../types';
import AddTransactionForm from './AddTransactionForm';
import TransactionRow from './TransactionRow';
import useTransactions from '../hooks/useTransactions';
import type { TransactionFilters } from '../hooks/useTransactions';

interface TransactionListProps {
  accountId: string;
  filters?: TransactionFilters;
}

// --- undo toast state machine ---

type ToastState =
  | { status: 'hidden' }
  | { status: 'visible'; transaction: Transaction }
  | { status: 'fading'; transaction: Transaction };

type ToastAction =
  | { type: 'show'; transaction: Transaction }
  | { type: 'fade' }
  | { type: 'hide' };

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'show':
      return { status: 'visible', transaction: action.transaction };
    case 'fade':
      if (state.status === 'hidden') return state;
      return { status: 'fading', transaction: state.transaction };
    case 'hide':
      return { status: 'hidden' };
  }
}

// --- date grouping ---

function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const fmtGroupLabel = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

function dateLabel(isoDate: string, today: string, yesterday: string): string {
  if (isoDate === today) return 'Today';
  if (isoDate === yesterday) return 'Yesterday';
  return fmtGroupLabel.format(new Date(isoDate + 'T00:00:00'));
}

interface TransactionGroup {
  label: string;
  transactions: Transaction[];
}

// --- component ---

function TransactionList({ accountId, filters }: TransactionListProps) {
  const dispatch = useDispatch<AppDispatch>();
  const transactions = useTransactions(accountId, filters);
  const [toast, toastDispatch] = useReducer(toastReducer, { status: 'hidden' });

  const grouped = useMemo((): TransactionGroup[] => {
    const now = new Date();
    const prev = new Date(now);
    prev.setDate(now.getDate() - 1);
    const today = toLocalISO(now);
    const yesterday = toLocalISO(prev);

    const map = transactions.reduce<Map<string, Transaction[]>>((acc, t) => {
      acc.set(t.date, [...(acc.get(t.date) ?? []), t]);
      return acc;
    }, new Map());

    return Array.from(map.entries()).map(([date, txns]) => ({
      label: dateLabel(date, today, yesterday),
      transactions: txns,
    }));
  }, [transactions]);

  const handleDelete = useCallback(
    async (transaction: Transaction) => {
      try {
        await dispatch(deleteTransactionThunk(transaction)).unwrap();
        toastDispatch({ type: 'show', transaction });
      } catch {
        // transaction not deleted — no toast
      }
    },
    [dispatch],
  );

  const handleUndo = useCallback(async () => {
    if (toast.status === 'hidden') return;
    toastDispatch({ type: 'hide' });
    try {
      await dispatch(createTransactionThunk(toast.transaction)).unwrap();
    } catch {
      // undo failed silently — toast already dismissed
    }
  }, [dispatch, toast]);

  useEffect(() => {
    if (toast.status !== 'visible') return;
    const timer = setTimeout(() => toastDispatch({ type: 'fade' }), 3500);
    return () => clearTimeout(timer);
  }, [toast.status]);

  useEffect(() => {
    if (toast.status !== 'fading') return;
    const timer = setTimeout(() => toastDispatch({ type: 'hide' }), 300);
    return () => clearTimeout(timer);
  }, [toast.status]);

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Transactions</h2>
      {grouped.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No transactions for this account.</p>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2 px-1">
                {group.label}
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm divide-y divide-gray-50 dark:divide-gray-700">
                {group.transactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <AddTransactionForm accountId={accountId} />

      {/* undo toast */}
      {toast.status !== 'hidden' && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl bg-gray-900 dark:bg-gray-700 px-4 py-3 shadow-lg transition-opacity duration-300 ${
            toast.status === 'fading' ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <span className="text-sm text-white">Transaction deleted</span>
          <button
            type="button"
            onClick={handleUndo}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-150"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

export default TransactionList;
