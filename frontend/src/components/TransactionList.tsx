import { useCallback, useEffect, useReducer } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { addTransaction, removeTransaction } from '../store/transactionsSlice';
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

// --- component ---

function TransactionList({ accountId, filters }: TransactionListProps) {
  const dispatch = useDispatch<AppDispatch>();
  const transactions = useTransactions(accountId, filters);
  const [toast, toastDispatch] = useReducer(toastReducer, { status: 'hidden' });

  const handleDelete = useCallback(
    (transaction: Transaction) => {
      dispatch(removeTransaction(transaction));
      toastDispatch({ type: 'show', transaction });
    },
    [dispatch],
  );

  const handleUndo = useCallback(() => {
    if (toast.status === 'hidden') return;
    dispatch(addTransaction(toast.transaction));
    toastDispatch({ type: 'hide' });
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
      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No transactions for this account.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm divide-y divide-gray-50 dark:divide-gray-700">
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onDelete={handleDelete}
            />
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
