import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { refreshBalances } from '../store/accountsSlice';
import { selectAccounts, selectAccountsLoading, selectAccountsError } from '../store/selectors';
import AccountCard from './AccountCard';
import AddAccountModal from './AddAccountModal';

function AccountsOverview() {
  const dispatch = useDispatch<AppDispatch>();
  const accounts = useSelector(selectAccounts);
  const loading = useSelector(selectAccountsLoading);
  const error = useSelector(selectAccountsError);
  const [modalOpen, setModalOpen] = useState(false);

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalBalance);

  return (
    <section className="px-8 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Accounts</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''} &middot; {formattedTotal} total
          </p>
          {error && (
            <p className="text-sm text-red-500 dark:text-red-400 mt-2">{error}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors duration-150 shadow-sm"
          >
            Add account
          </button>
          <button
            type="button"
            onClick={() => dispatch(refreshBalances())}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 ${
              loading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-500 shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:border-blue-400 dark:hover:text-blue-400'
            }`}
          >
            {loading ? 'Refreshing…' : 'Refresh balances'}
          </button>
        </div>
      </div>
      {modalOpen && <AddAccountModal onClose={() => setModalOpen(false)} />}
      {loading && accounts.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-base font-medium text-gray-400 dark:text-gray-500 mb-1">
            No accounts yet
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
            Add an account to start tracking your finances.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg px-5 py-2.5 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors duration-150 shadow-sm"
          >
            Add your first account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </section>
  );
}

export default AccountsOverview;
