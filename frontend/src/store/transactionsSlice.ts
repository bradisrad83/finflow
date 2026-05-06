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
  transactions: [],
  loading: false,
  error: null,
};

// --- read ---

export const fetchTransactions = createAsyncThunk<Transaction[], string>(
  'transactions/fetchTransactions',
  (accountId) => api.fetchTransactions(accountId),
);

// --- write ---

export const createTransactionThunk = createAsyncThunk<Transaction, Transaction>(
  'transactions/create',
  (transaction) => api.createTransaction(transaction),
);

export const deleteTransactionThunk = createAsyncThunk<Transaction, Transaction>(
  'transactions/delete',
  async (transaction) => {
    await api.deleteTransaction(transaction.id);
    return transaction;
  },
);

// --- slice ---

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
        const accountId = action.meta.arg;
        state.transactions = [
          ...state.transactions.filter((t) => t.accountId !== accountId),
          ...action.payload,
        ];
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load transactions';
      })
      .addCase(createTransactionThunk.fulfilled, (state, action) => {
        state.transactions.push(action.payload);
      })
      .addCase(deleteTransactionThunk.fulfilled, (state, action) => {
        state.transactions = state.transactions.filter((t) => t.id !== action.payload.id);
      });
  },
});

export const { addTransaction, removeTransaction } = transactionsSlice.actions;
export default transactionsSlice.reducer;
