import type { Account } from '../types';

interface AccountCardProps {
  account: Account;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
}

function AccountCard({ account, isSelected, onSelect }: AccountCardProps) {
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(account.balance);

  return (
    <div
      onClick={() => onSelect(isSelected ? null : account.id)}
      className={`bg-white rounded-2xl p-6 shadow-sm border transition-all duration-200 cursor-pointer hover:shadow-md ${
        isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between mb-5">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
          {account.type}
        </p>
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
            account.type === 'checking'
              ? 'bg-blue-50 text-blue-500'
              : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {account.type === 'checking' ? 'Checking' : 'Savings'}
        </span>
      </div>
      <h3 className="text-base font-medium text-gray-800 mb-3">{account.name}</h3>
      <p className="text-2xl font-semibold text-gray-900 tracking-tight">
        {formattedBalance}
      </p>
    </div>
  );
}

export default AccountCard;
