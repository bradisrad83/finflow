import { useState } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { addTransaction } from '../store/transactionsSlice';

interface AddTransactionFormProps {
  accountId: string;
}

function AddTransactionForm({ accountId }: AddTransactionFormProps) {
  const dispatch = useDispatch<AppDispatch>();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('debit');

  const parsedAmount = parseFloat(amount);
  const isValid =
    description.trim() !== '' &&
    category.trim() !== '' &&
    !isNaN(parsedAmount) &&
    parsedAmount > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    dispatch(addTransaction({
      id: crypto.randomUUID(),
      accountId,
      description: description.trim(),
      amount: parsedAmount,
      category: category.trim(),
      type,
      date: new Date().toISOString().split('T')[0],
    }));

    setDescription('');
    setAmount('');
    setCategory('');
    setType('debit');
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Add Transaction</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="col-span-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          min="0.01"
          step="0.01"
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        />
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'credit' | 'debit')}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        >
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>
        <button
          type="submit"
          disabled={!isValid}
          className={`sm:col-start-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 ${
            isValid
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Add
        </button>
      </div>
    </form>
  );
}

export default AddTransactionForm;
