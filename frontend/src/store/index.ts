import { configureStore } from '@reduxjs/toolkit';
import accountsReducer, { type AccountsState } from './accountsSlice';
import transactionsReducer, { type TransactionsState } from './transactionsSlice';

const STORAGE_KEY = 'finflow:state';

interface PersistedState {
  accounts: AccountsState;
  transactions: TransactionsState;
}

function loadPersistedState(): PersistedState | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return undefined;
  }
}

export const store = configureStore({
  reducer: {
    accounts: accountsReducer,
    transactions: transactionsReducer,
  },
  preloadedState: loadPersistedState(),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export { STORAGE_KEY };
