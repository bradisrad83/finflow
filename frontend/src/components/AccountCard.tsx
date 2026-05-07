import { Link } from 'react-router-dom';
import type { Account } from '../types';

interface AccountCardProps {
  account: Account;
}

function AccountCard({ account }: AccountCardProps) {
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(account.balance);

  return (
    <Link
      to={`/accounts/${account.id}`}
      className="block bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-all duration-200 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500"
    >
      <div className="flex items-start justify-between mb-5">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest font-medium">
          {account.type}
        </p>
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
            account.type === 'checking'
              ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/15 dark:text-blue-300'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
          }`}
        >
          {account.type === 'checking' ? 'Checking' : 'Savings'}
        </span>
      </div>
      <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mb-3">{account.name}</h3>
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50 tracking-tight">
        {formattedBalance}
      </p>
    </Link>
  );
}

export default AccountCard;
