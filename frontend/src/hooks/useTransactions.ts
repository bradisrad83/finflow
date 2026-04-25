import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import type { Transaction } from '../types';
import { updateBalance } from '../store/accountsSlice';

function useTransactions(accountId: string): Transaction[] {
  const dispatch = useDispatch<AppDispatch>();
  const transactions = useSelector((state: RootState) =>
    state.transactions.transactions.filter((t) => t.accountId === accountId)
  );

  useEffect(() => {
    const balance = transactions.reduce((sum, t) => {
      return t.type === 'credit' ? sum + t.amount : sum - t.amount;
    }, 0);
    dispatch(updateBalance({ accountId, balance }));
  }, [transactions, accountId, dispatch]);

  return transactions;
}

export default useTransactions;
