import { memo, useCallback } from 'react';
import type { Transaction } from '../types';

interface TransactionRowProps {
  transaction: Transaction;
  onDelete: (transaction: Transaction) => void;
}

function TransactionRow({ transaction, onDelete }: TransactionRowProps) {
  const handleDelete = useCallback(() => {
    onDelete(transaction);
  }, [onDelete, transaction]);

  return (
    <div className="group flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {transaction.description}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {transaction.category} &middot; {transaction.date}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-sm font-semibold tabular-nums ${
            transaction.type === 'credit'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {transaction.type === 'credit' ? '+' : '-'}
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
            transaction.amount,
          )}
        </span>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={`Delete ${transaction.description}`}
          className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all duration-150"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default memo(TransactionRow);
