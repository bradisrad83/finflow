import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Account } from '../types';
import { addTransaction, removeTransaction, removeTransactionsByAccount, createTransactionThunk, deleteTransactionThunk, updateTransactionThunk } from './transactionsSlice';
import * as api from '../api';

export interface AccountsState {
  accounts: Account[];
  loading: boolean;
  error: string | null;
}

const initialState: AccountsState = {
  accounts: [],
  loading: false,
  error: null,
};

export const fetchAccounts = createAsyncThunk<Account[]>(
  'accounts/fetchAll',
  () => api.fetchAccounts(),
);

export const createAccountThunk = createAsyncThunk<Account, Account>(
  'accounts/create',
  (account) => api.createAccount(account),
);

export const renameAccountThunk = createAsyncThunk<Account, Account>(
  'accounts/rename',
  (account) => api.updateAccount(account),
);

export const deleteAccountThunk = createAsyncThunk<string, string>(
  'accounts/delete',
  async (accountId, { dispatch }) => {
    await api.deleteAccount(accountId);
    dispatch(removeTransactionsByAccount(accountId));
    return accountId;
  },
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
      .addCase(fetchAccounts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts = action.payload;
      })
      .addCase(fetchAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load accounts';
      })
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
      .addCase(updateTransactionThunk.fulfilled, (state, action) => {
        const { updated, previous } = action.payload;
        const account = state.accounts.find((a) => a.id === updated.accountId);
        if (!account) return;
        account.balance -= previous.type === 'credit' ? previous.amount : -previous.amount;
        account.balance += updated.type === 'credit' ? updated.amount : -updated.amount;
      })
      .addCase(renameAccountThunk.fulfilled, (state, action) => {
        const account = state.accounts.find((a) => a.id === action.payload.id);
        if (account) account.name = action.payload.name;
      })
      .addCase(deleteAccountThunk.fulfilled, (state, action) => {
        state.accounts = state.accounts.filter((a) => a.id !== action.payload);
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
