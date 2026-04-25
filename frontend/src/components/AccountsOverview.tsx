import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import AccountCard from './AccountCard';
import TransactionList from './TransactionList';

function AccountsOverview() {
  const accounts = useSelector((state: RootState) => state.accounts.accounts);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalBalance);

  return (
    <section className="px-8 py-10">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">Accounts</h2>
        <p className="text-sm text-gray-400 mt-1">
          {accounts.length} account{accounts.length !== 1 ? 's' : ''} &middot; {formattedTotal} total
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            isSelected={selectedAccountId === account.id}
            onSelect={setSelectedAccountId}
          />
        ))}
      </div>
      {selectedAccountId && (
        <TransactionList accountId={selectedAccountId} />
      )}
    </section>
  );
}

export default AccountsOverview;
