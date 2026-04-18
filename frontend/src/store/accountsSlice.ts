import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Account } from '../types';

interface AccountsState {
  accounts: Account[];
}

const initialState: AccountsState = {
  accounts: [
    { id: '1', name: 'Primary Checking', type: 'checking', balance: 12450.00 },
    { id: '2', name: 'Emergency Savings', type: 'savings', balance: 8200.50 },
    { id: '3', name: 'Travel Fund', type: 'savings', balance: 3100.75 },
  ],
};

const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    addAccount: (state, action: PayloadAction<Account>) => {
      state.accounts.push(action.payload);
    },
  },
});

export const { addAccount } = accountsSlice.actions;
export default accountsSlice.reducer;
