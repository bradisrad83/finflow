import { useId, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../store';
import { createTransactionThunk } from '../store/transactionsSlice';
import { selectUniqueCategories } from '../store/selectors';

interface AddTransactionFormProps {
  accountId: string;
}

function AddTransactionForm({ accountId }: AddTransactionFormProps) {
  const dispatch = useDispatch<AppDispatch>();
  const categories = useSelector(selectUniqueCategories);
  const formId = useId();

  const descriptionId = `${formId}-description`;
  const amountId = `${formId}-amount`;
  const categoryId = `${formId}-category`;
  const typeId = `${formId}-type`;
  const datalistId = `${formId}-categories`;

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('debit');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parsedAmount = parseFloat(amount);
  const isValid =
    description.trim() !== '' &&
    category.trim() !== '' &&
    !isNaN(parsedAmount) &&
    parsedAmount > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await dispatch(
        createTransactionThunk({
          id: crypto.randomUUID(),
          accountId,
          description: description.trim(),
          amount: parsedAmount,
          category: category.trim(),
          type,
          date: new Date().toISOString().split('T')[0],
        }),
      ).unwrap();
      setDescription('');
      setAmount('');
      setCategory('');
      setType('debit');
    } catch {
      setSubmitError('Failed to add transaction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const labelClass = 'text-xs font-medium text-gray-500 dark:text-gray-400';
  const inputClass = 'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-300 dark:focus:border-blue-400';

  return (
    <form onSubmit={handleSubmit} className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Add Transaction</h3>
      {submitError && (
        <p className="text-xs text-red-500 dark:text-red-400 mb-3">{submitError}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-full flex flex-col gap-1">
          <label htmlFor={descriptionId} className={labelClass}>Description</label>
          <input
            id={descriptionId}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={amountId} className={labelClass}>Amount</label>
          <input
            id={amountId}
            type="number"
            value={amount}
            min="0.01"
            step="0.01"
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={categoryId} className={labelClass}>Category</label>
          <input
            id={categoryId}
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list={datalistId}
            className={inputClass}
          />
          <datalist id={datalistId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={typeId} className={labelClass}>Type</label>
          <select
            id={typeId}
            value={type}
            onChange={(e) => setType(e.target.value as 'credit' | 'debit')}
            className={inputClass}
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={!isValid || submitting}
          className={`sm:col-start-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 ${
            isValid && !submitting
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
          }`}
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  );
}

export default AddTransactionForm;
