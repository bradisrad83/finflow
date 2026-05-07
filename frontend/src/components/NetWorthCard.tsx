import { memo } from 'react';
import { useSelector } from 'react-redux';
import { selectAccounts, selectNetWorth, selectMonthlyNet } from '../store/selectors';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmtMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

function NetWorthCard() {
  const accounts = useSelector(selectAccounts);
  const netWorth = useSelector(selectNetWorth);
  const monthlyNet = useSelector(selectMonthlyNet);
  const monthLabel = fmtMonth.format(new Date());

  if (accounts.length === 0) {
    return (
      <section className="px-8 pt-10 pb-2">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm px-8 py-6">
          <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-700 animate-pulse mb-3" />
          <div className="h-10 w-48 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
        </div>
      </section>
    );
  }

  const isPositive = monthlyNet >= 0;

  return (
    <section className="px-8 pt-10 pb-2">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm px-8 py-6">
        <div className="flex items-start justify-between gap-8">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest font-medium">
              Net worth
            </p>
            <p className="text-4xl font-semibold text-gray-900 dark:text-gray-50 tracking-tight mt-2 tabular-nums">
              {fmt.format(netWorth)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest font-medium">
              {monthLabel}
            </p>
            <p
              className={`text-xl font-semibold mt-2 tabular-nums ${
                isPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500 dark:text-red-400'
              }`}
            >
              {isPositive ? '+' : ''}{fmt.format(monthlyNet)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">month to date</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(NetWorthCard);
