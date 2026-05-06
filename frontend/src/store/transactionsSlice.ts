import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Transaction } from '../types';
import type { RootState } from '.';
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
  (accountId, { signal }) => api.fetchTransactions(accountId, signal),
);

export const fetchAllTransactions = createAsyncThunk<Transaction[], string[]>(
  'transactions/fetchAll',
  (accountIds) =>
    Promise.all(accountIds.map((id) => api.fetchTransactions(id))).then((batches) =>
      batches.flat()
    ),
);

// --- write ---

export const createTransactionThunk = createAsyncThunk<Transaction, Transaction>(
  'transactions/create',
  (transaction) => api.createTransaction(transaction),
);

export const updateTransactionThunk = createAsyncThunk<
  { updated: Transaction; previous: Transaction },
  Transaction,
  { state: RootState }
>(
  'transactions/update',
  async (transaction, { getState }) => {
    const previous =
      getState().transactions.transactions.find((t) => t.id === transaction.id) ?? transaction;
    const updated = await api.updateTransaction(transaction);
    return { updated, previous };
  },
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
    removeTransactionsByAccount: (state, action: PayloadAction<string>) => {
      state.transactions = state.transactions.filter((t) => t.accountId !== action.payload);
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
        if (action.error.name !== 'AbortError') {
          state.error = action.error.message ?? 'Failed to load transactions';
        }
      })
      .addCase(fetchAllTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchAllTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load transactions';
      })
      .addCase(createTransactionThunk.pending, (state, action) => {
        state.transactions.push(action.meta.arg);
      })
      .addCase(createTransactionThunk.fulfilled, () => {
        // transaction already in store from pending — nothing to do
      })
      .addCase(createTransactionThunk.rejected, (state, action) => {
        state.transactions = state.transactions.filter((t) => t.id !== action.meta.arg.id);
      })
      .addCase(updateTransactionThunk.fulfilled, (state, action) => {
        const idx = state.transactions.findIndex((t) => t.id === action.payload.updated.id);
        if (idx !== -1) state.transactions[idx] = action.payload.updated;
      })
      .addCase(deleteTransactionThunk.fulfilled, (state, action) => {
        state.transactions = state.transactions.filter((t) => t.id !== action.payload.id);
      });
  },
});

export const { addTransaction, removeTransaction, removeTransactionsByAccount } = transactionsSlice.actions;
export default transactionsSlice.reducer;
