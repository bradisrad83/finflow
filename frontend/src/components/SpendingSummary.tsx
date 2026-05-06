import React, { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectAllTransactions } from '../store/selectors';
import type { Transaction } from '../types';

interface CategoryRow {
  category: string;
  total: number;
  count: number;
}

interface CategoryGroup {
  spending: CategoryRow[];
  income: CategoryRow[];
}

function aggregate(transactions: Transaction[]): CategoryGroup {
  const spendingMap = new Map<string, { total: number; count: number }>();
  const incomeMap = new Map<string, { total: number; count: number }>();

  for (const t of transactions) {
    const map = t.type === 'debit' ? spendingMap : incomeMap;
    const prev = map.get(t.category) ?? { total: 0, count: 0 };
    map.set(t.category, { total: prev.total + t.amount, count: prev.count + 1 });
  }

  const toRows = (map: Map<string, { total: number; count: number }>): CategoryRow[] =>
    Array.from(map.entries())
      .map(([category, { total, count }]) => ({ category, total, count }))
      .sort((a, b) => b.total - a.total);

  return { spending: toRows(spendingMap), income: toRows(incomeMap) };
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function SpendingSummary() {
  const transactions = useSelector(selectAllTransactions);

  const { spending, income } = useMemo(() => aggregate(transactions), [transactions]);

  const totalSpending = spending.reduce((s, r) => s + r.total, 0);
  const totalIncome = income.reduce((s, r) => s + r.total, 0);

  if (spending.length === 0 && income.length === 0) return null;

  return (
    <section className="px-8 pb-10">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-6">Spending summary</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Spending</span>
            <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-50">{fmt(totalSpending)}</span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {spending.map((row) => (
              <div key={row.category} className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-800 dark:text-gray-100">{row.category}</span>
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                      {row.count} txn{row.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-gray-700 dark:text-gray-300">
                    {fmt(row.total)}
                  </span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-1 rounded-full bg-blue-400 dark:bg-blue-500 w-[var(--bar-w)]"
                    style={{ '--bar-w': `${((row.total / totalSpending) * 100).toFixed(1)}%` } as React.CSSProperties}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Income</span>
            <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(totalIncome)}</span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {income.map((row) => (
              <div key={row.category} className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-800 dark:text-gray-100">{row.category}</span>
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                      {row.count} txn{row.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                    {fmt(row.total)}
                  </span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-1 rounded-full bg-emerald-400 dark:bg-emerald-500 w-[var(--bar-w)]"
                    style={{ '--bar-w': `${((row.total / totalIncome) * 100).toFixed(1)}%` } as React.CSSProperties}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(SpendingSummary);
