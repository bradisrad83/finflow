import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import TransactionList from '../components/TransactionList';

type FilterType = 'all' | 'credit' | 'debit';

function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const account = useSelector((state: RootState) =>
    state.accounts.accounts.find((a) => a.id === id)
  );

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [query, setQuery] = useState('');

  if (!account) {
    return (
      <section className="px-8 py-10">
        <Link to="/" className="text-sm text-blue-500 hover:underline">
          &larr; Back to dashboard
        </Link>
        <p className="mt-6 text-sm text-gray-500">Account not found.</p>
      </section>
    );
  }

  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(account.balance);

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'credit', label: 'Credits' },
    { value: 'debit', label: 'Debits' },
  ];

  return (
    <section className="px-8 py-10">
      <Link to="/" className="text-sm text-blue-500 hover:underline">
        &larr; Back to dashboard
      </Link>
      <div className="mt-6 mb-2">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
          {account.type}
        </p>
        <h2 className="text-2xl font-semibold text-gray-900 mt-1">{account.name}</h2>
        <p className="text-3xl font-semibold text-gray-900 tracking-tight mt-2">
          {formattedBalance}
        </p>
      </div>
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilterType(option.value)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-150 ${
                filterType === option.value
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search description"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        />
      </div>
      <TransactionList accountId={account.id} filters={{ type: filterType, query }} />
    </section>
  );
}

export default AccountDetail;
