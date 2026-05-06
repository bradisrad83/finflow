import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../store';
import { fetchAccounts } from '../store/accountsSlice';
import { fetchAllTransactions } from '../store/transactionsSlice';
import { selectAccounts } from '../store/selectors';
import NetWorthCard from '../components/NetWorthCard';
import AccountsOverview from '../components/AccountsOverview';
import SpendingSummary from '../components/SpendingSummary';

function Dashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const accounts = useSelector(selectAccounts);

  useEffect(() => {
    dispatch(fetchAccounts());
  }, [dispatch]);

  useEffect(() => {
    if (accounts.length === 0) return;
    dispatch(fetchAllTransactions(accounts.map((a) => a.id)));
  }, [accounts, dispatch]);

  return (
    <>
      <NetWorthCard />
      <AccountsOverview />
      <SpendingSummary />
    </>
  );
}

export default Dashboard;
