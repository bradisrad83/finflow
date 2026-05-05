import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Transaction } from '../types';
import * as api from '../api';

export interface TransactionsState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
}

const initialState: TransactionsState = {
  transactions: [
    { id: 't1', accountId: '1', description: 'Whole Foods Market', amount: 87.43, type: 'debit', date: '2026-04-18', category: 'Groceries' },
    { id: 't2', accountId: '1', description: 'Direct Deposit - Salary', amount: 4200.00, type: 'credit', date: '2026-04-15', category: 'Income' },
    { id: 't3', accountId: '1', description: 'Netflix', amount: 15.99, type: 'debit', date: '2026-04-14', category: 'Subscriptions' },
    { id: 't4', accountId: '1', description: 'Uber', amount: 22.50, type: 'debit', date: '2026-04-13', category: 'Transport' },
    { id: 't5', accountId: '2', description: 'Transfer from Checking', amount: 500.00, type: 'credit', date: '2026-04-15', category: 'Transfer' },
    { id: 't6', accountId: '2', description: 'Interest Earned', amount: 12.34, type: 'credit', date: '2026-04-01', category: 'Interest' },
    { id: 't7', accountId: '3', description: 'Transfer from Checking', amount: 200.00, type: 'credit', date: '2026-04-10', category: 'Transfer' },
    { id: 't8', accountId: '3', description: 'Flight - JFK to LAX', amount: 310.00, type: 'debit', date: '2026-04-08', category: 'Travel' },
  ],
  loading: false,
  error: null,
};

export const fetchTransactions = createAsyncThunk<Transaction[], string>(
  'transactions/fetchTransactions',
  (accountId) => api.fetchTransactions(accountId),
);

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    addTransaction: (state, action: PayloadAction<Transaction>) => {
      state.transactions.push(action.payload);
    },
    removeTransaction: (state, action: PayloadAction<Transaction>) => {
      state.transactions = state.transactions.filter((t) => t.id !== action.payload.id);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load transactions';
      });
  },
});

export const { addTransaction, removeTransaction } = transactionsSlice.actions;
export default transactionsSlice.reducer;
