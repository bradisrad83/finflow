import AddTransactionForm from './AddTransactionForm';
import useTransactions from '../hooks/useTransactions';

interface TransactionListProps {
  accountId: string;
}

function TransactionList({ accountId }: TransactionListProps) {
  const transactions = useTransactions(accountId);

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Transactions</h2>
      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400">No transactions for this account.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-150">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-800">{transaction.description}</span>
                <span className="text-xs text-gray-400 mt-0.5">{transaction.category} &middot; {transaction.date}</span>
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  transaction.type === 'credit' ? 'text-emerald-600' : 'text-gray-700'
                }`}
              >
                {transaction.type === 'credit' ? '+' : '-'}
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(transaction.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
      <AddTransactionForm accountId={accountId} />
    </div>
  );
}

export default TransactionList;
