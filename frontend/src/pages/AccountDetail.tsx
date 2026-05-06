import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { fetchTransactions } from '../store/transactionsSlice';
import TransactionList from '../components/TransactionList';

type FilterType = 'all' | 'credit' | 'debit';

function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const account = useSelector((state: RootState) =>
    state.accounts.accounts.find((a) => a.id === id)
  );

  const dispatch = useDispatch<AppDispatch>();
  const txLoading = useSelector((state: RootState) => state.transactions.loading);
  const txError = useSelector((state: RootState) => state.transactions.error);

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (id) dispatch(fetchTransactions(id));
  }, [id, dispatch]);

  if (!account) {
    return (
      <section className="px-8 py-10">
        <Link to="/" className="text-sm text-blue-500 dark:text-blue-400 hover:underline">
          &larr; Back to dashboard
        </Link>
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Account not found.</p>
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
      <Link to="/" className="text-sm text-blue-500 dark:text-blue-400 hover:underline">
        &larr; Back to dashboard
      </Link>
      <div className="mt-6 mb-2">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest font-medium">
          {account.type}
        </p>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mt-1">{account.name}</h2>
        <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50 tracking-tight mt-2">
          {formattedBalance}
        </p>
      </div>
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-sm">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilterType(option.value)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-150 ${
                filterType === option.value
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50'
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
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-300 dark:focus:border-blue-400"
        />
      </div>
      {txError && (
        <p className="mt-6 text-sm text-red-500 dark:text-red-400">{txError}</p>
      )}
      {txLoading ? (
        <p className="mt-8 text-sm text-gray-400 dark:text-gray-500">Loading transactions…</p>
      ) : (
        <TransactionList accountId={account.id} filters={{ type: filterType, query }} />
      )}
    </section>
  );
}

export default AccountDetail;
