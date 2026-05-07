import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '.';

// ---------------------------------------------------------------------------
// Input selectors — direct field access, no computation
// ---------------------------------------------------------------------------

export const selectAccounts = (state: RootState) => state.accounts.accounts;
export const selectAccountsLoading = (state: RootState) => state.accounts.loading;
export const selectAccountsError = (state: RootState) => state.accounts.error;

export const selectAllTransactions = (state: RootState) => state.transactions.transactions;
export const selectTransactionsLoading = (state: RootState) => state.transactions.loading;
export const selectTransactionsError = (state: RootState) => state.transactions.error;

// ---------------------------------------------------------------------------
// Derived selectors — built with createSelector
// ---------------------------------------------------------------------------

export const selectAccountById = (id: string) =>
  createSelector(selectAccounts, (accounts) => accounts.find((a) => a.id === id) ?? null);

export const selectUniqueCategories = createSelector(
  selectAllTransactions,
  (transactions) =>
    [...new Set(transactions.map((t) => t.category))].sort((a, b) => a.localeCompare(b)),
);

export const selectNetWorth = createSelector(
  selectAccounts,
  (accounts) => accounts.reduce((sum, a) => sum + a.balance, 0),
);

export const selectMonthlyNet = createSelector(
  selectAllTransactions,
  (transactions) => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return transactions
      .filter((t) => t.date.startsWith(prefix))
      .reduce((net, t) => net + (t.type === 'credit' ? t.amount : -t.amount), 0);
  },
);
