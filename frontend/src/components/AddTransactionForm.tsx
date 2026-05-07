import { useId, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../store';
import { createTransactionThunk } from '../store/transactionsSlice';
import { selectUniqueCategories } from '../store/selectors';
import Input from './Input';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const dateId = `${formId}-date`;

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('debit');
  const [date, setDate] = useState(todayISO);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parsedAmount = parseFloat(amount);
  const isValid =
    description.trim() !== '' &&
    category.trim() !== '' &&
    date !== '' &&
    !isNaN(parsedAmount) &&
    parsedAmount > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSubmitError(null);

    const transaction = {
      id: crypto.randomUUID(),
      accountId,
      description: description.trim(),
      amount: parsedAmount,
      category: category.trim(),
      type,
      date,
    };

    setDescription('');
    setAmount('');
    setCategory('');
    setType('debit');
    setDate(todayISO());

    try {
      await dispatch(createTransactionThunk(transaction)).unwrap();
    } catch {
      setSubmitError('Transaction failed — please try again.');
    }
  }

  const labelClass = 'text-xs font-medium text-gray-500 dark:text-gray-400';

  return (
    <form onSubmit={handleSubmit} className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Add Transaction</h3>
      {submitError && (
        <p className="text-xs text-red-500 dark:text-red-400 mb-3">{submitError}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-full flex flex-col gap-1">
          <label htmlFor={descriptionId} className={labelClass}>Description</label>
          <Input
            id={descriptionId}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={amountId} className={labelClass}>Amount</label>
          <Input
            id={amountId}
            type="number"
            value={amount}
            min="0.01"
            step="0.01"
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={categoryId} className={labelClass}>Category</label>
          <Input
            id={categoryId}
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list={datalistId}
          />
          <datalist id={datalistId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={dateId} className={labelClass}>Date</label>
          <Input
            id={dateId}
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={typeId} className={labelClass}>Type</label>
          <select
            id={typeId}
            value={type}
            onChange={(e) => setType(e.target.value as 'credit' | 'debit')}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-300 dark:focus:border-blue-400"
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={!isValid}
          className={`sm:col-start-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 ${
            isValid
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
          }`}
        >
          Add
        </button>
      </div>
    </form>
  );
}

export default AddTransactionForm;
