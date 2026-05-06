import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { Transaction } from '../types';
import { selectUniqueCategories } from '../store/selectors';
import Input from './Input';

const fmtDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtAmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const datalistId = 'txn-edit-categories';

interface TransactionRowProps {
  transaction: Transaction;
  onDelete: (transaction: Transaction) => void;
  onUpdate: (transaction: Transaction) => void;
}

function TransactionRow({ transaction, onDelete, onUpdate }: TransactionRowProps) {
  const categories = useSelector(selectUniqueCategories);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(transaction);
  const descriptionRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (editing) {
      descriptionRef.current?.focus();
      descriptionRef.current?.select();
    }
  }, [editing]);

  const handleDelete = useCallback(() => {
    onDelete(transaction);
  }, [onDelete, transaction]);

  const startEdit = useCallback(() => {
    setDraft(transaction);
    setEditing(true);
  }, [transaction]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.description.trim();
    if (!trimmed || draft.amount <= 0) return;
    try {
      await onUpdate({ ...draft, description: trimmed });
    } finally {
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
        className="flex flex-col gap-2 p-4 bg-blue-50/40 dark:bg-blue-500/5"
      >
        <Input
          ref={descriptionRef}
          aria-label="Description"
          type="text"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="py-1.5"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            aria-label="Amount"
            type="number"
            min="0.01"
            step="0.01"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })}
            className="py-1.5"
          />
          <Input
            aria-label="Category"
            type="text"
            list={datalistId}
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className="py-1.5"
          />
          <datalist id={datalistId}>
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
          <select
            aria-label="Type"
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value as 'credit' | 'debit' })}
            className="col-span-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-300 dark:focus:border-blue-400"
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="text-xs font-semibold text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors duration-150"
          >
            Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <div
      className="group flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 cursor-pointer"
      onClick={startEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startEdit(); }}
      aria-label={`Edit ${transaction.description}`}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {transaction.description}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {transaction.category} &middot; {fmtDate.format(new Date(transaction.date + 'T00:00:00'))}
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
          {fmtAmt.format(transaction.amount)}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
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
