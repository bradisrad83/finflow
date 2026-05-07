import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { Transaction } from '../types';
import { selectAllTransactions } from '../store/selectors';

export interface TransactionFilters {
  type?: 'all' | 'credit' | 'debit';
  query?: string;
}

function useTransactions(accountId: string, filters?: TransactionFilters): Transaction[] {
  const allTransactions = useSelector(selectAllTransactions);

  return useMemo(() => {
    let result = allTransactions.filter((t) => t.accountId === accountId);

    if (filters?.type && filters.type !== 'all') {
      result = result.filter((t) => t.type === filters.type);
    }

    if (filters?.query) {
      const q = filters.query.toLowerCase();
      result = result.filter((t) => t.description.toLowerCase().includes(q));
    }

    return result.slice().sort((a, b) => b.date.localeCompare(a.date));
  }, [allTransactions, accountId, filters?.type, filters?.query]);
}

export default useTransactions;
