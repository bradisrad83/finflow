import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Account } from '../types';
import { addTransaction, removeTransaction, createTransactionThunk, deleteTransactionThunk } from './transactionsSlice';
import * as api from '../api';

export interface AccountsState {
  accounts: Account[];
  loading: boolean;
  error: string | null;
}

const initialState: AccountsState = {
  accounts: [
    { id: '1', name: 'Primary Checking', type: 'checking', balance: 12450.00 },
    { id: '2', name: 'Emergency Savings', type: 'savings', balance: 8200.50 },
    { id: '3', name: 'Travel Fund', type: 'savings', balance: 3100.75 },
  ],
  loading: false,
  error: null,
};

export const createAccountThunk = createAsyncThunk<Account, Account>(
  'accounts/create',
  (account) => api.createAccount(account),
);

export const refreshBalances = createAsyncThunk<{ id: string; balance: number }[]>(
  'accounts/refreshBalances',
  () => api.fetchBalances(),
);

const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    addAccount: (state, action: PayloadAction<Account>) => {
      state.accounts.push(action.payload);
    },
    updateBalance: (state, action: PayloadAction<{ accountId: string; balance: number }>) => {
      const account = state.accounts.find((a) => a.id === action.payload.accountId);
      if (account) {
        account.balance = action.payload.balance;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addTransaction, (state, action) => {
        const { accountId, amount, type } = action.payload;
        const account = state.accounts.find((a) => a.id === accountId);
        if (account) {
          account.balance += type === 'credit' ? amount : -amount;
        }
      })
      .addCase(removeTransaction, (state, action) => {
        const { accountId, amount, type } = action.payload;
        const account = state.accounts.find((a) => a.id === accountId);
        if (account) {
          account.balance -= type === 'credit' ? amount : -amount;
        }
      })
      .addCase(createTransactionThunk.fulfilled, (state, action) => {
        const { accountId, amount, type } = action.payload;
        const account = state.accounts.find((a) => a.id === accountId);
        if (account) {
          account.balance += type === 'credit' ? amount : -amount;
        }
      })
      .addCase(deleteTransactionThunk.fulfilled, (state, action) => {
        const { accountId, amount, type } = action.payload;
        const account = state.accounts.find((a) => a.id === accountId);
        if (account) {
          account.balance -= type === 'credit' ? amount : -amount;
        }
      })
      .addCase(createAccountThunk.fulfilled, (state, action) => {
        state.accounts.push(action.payload);
      })
      .addCase(refreshBalances.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refreshBalances.fulfilled, (state, action) => {
        state.loading = false;
        action.payload.forEach((update) => {
          const account = state.accounts.find((a) => a.id === update.id);
          if (account) {
            account.balance = update.balance;
          }
        });
      })
      .addCase(refreshBalances.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to refresh balances';
      });
  },
});

export const { addAccount, updateBalance } = accountsSlice.actions;
export default accountsSlice.reducer;
