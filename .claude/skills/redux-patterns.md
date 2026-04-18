# Redux Toolkit Patterns Reference

Claude should consult this file when building Redux slices or wiring store logic in FinFlow.

---

## Slice Structure

One slice per domain concept. Each slice owns its own file in `src/store/slices/`.

Standard structure:

```ts
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Account } from '../../types';

// 1. State shape interface
interface AccountsState {
  accounts: Account[];
}

// 2. Initial state (seed data lives here, not in components)
const initialState: AccountsState = {
  accounts: [],
};

// 3. Slice
const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    addAccount: (state, action: PayloadAction<Account>) => {
      state.accounts.push(action.payload);  // Immer handles immutability
    },
    removeAccount: (state, action: PayloadAction<string>) => {
      state.accounts = state.accounts.filter(a => a.id !== action.payload);
    },
  },
});

// 4. Export actions and reducer
export const { addAccount, removeAccount } = accountsSlice.actions;
export default accountsSlice.reducer;
```

---

## Local State vs Redux

Use **local `useState`** when:
- The state is only relevant to one component (e.g. a dropdown open/closed)
- The state is ephemeral UI state that nothing else cares about
- The state doesn't need to persist across navigation

Use **Redux** when:
- Multiple components need the same data
- The data persists across route changes
- The data comes from (or will come from) an API
- You need a predictable history of changes for debugging

FinFlow rule: all financial data (accounts, transactions) lives in Redux. All UI state (modals open, active filters, input values) lives in local `useState`.

---

## Selector Patterns

Always write selectors inline in `useSelector` for simple cases:

```ts
const accounts = useSelector((state: RootState) => state.accounts.accounts);
```

For reused or derived selections, extract the selector function. Place it at the bottom of the slice file and export it:

```ts
// In accountsSlice.ts
export const selectAccounts = (state: RootState) => state.accounts.accounts;
export const selectAccountById = (id: string) => (state: RootState) =>
  state.accounts.accounts.find(a => a.id === id);
```

```ts
// In component
const accounts = useSelector(selectAccounts);
const account = useSelector(selectAccountById('1'));
```

Extracting selectors makes them testable and reusable. Add them as the slice grows.

---

## Dispatch Patterns

Always use the typed `AppDispatch`:

```ts
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';

const dispatch = useDispatch<AppDispatch>();
```

Dispatch is synchronous for regular actions:

```ts
dispatch(addAccount({ id: '5', name: 'New', type: 'checking', balance: 0 }));
```

---

## The `RootState` and `AppDispatch` Types

Both are derived automatically from the store and must never be written by hand:

```ts
// src/store/index.ts
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

`ReturnType<typeof store.getState>` means: "whatever shape `getState()` returns, that's the type." Adding a new slice automatically updates `RootState`. You never maintain this type manually.

---

## Immer: Why You Can "Mutate" in Reducers

Redux Toolkit wraps all reducers in Immer. Immer uses a JavaScript `Proxy` to intercept property writes. When you write:

```ts
state.accounts.push(action.payload);
```

Immer records the mutation as a patch and produces a **new immutable object**. The original state is never changed. This is safe to write, and correct — it's not actually mutating state.

Outside of reducers (in components), never mutate Redux state. There is no Immer protection there.

---

## Async Actions with `createAsyncThunk` (Future)

When we introduce API calls, use `createAsyncThunk`:

```ts
export const fetchAccounts = createAsyncThunk(
  'accounts/fetchAll',
  async () => {
    const response = await fetch('/api/accounts');
    return response.json() as Promise<Account[]>;
  }
);
```

Handle loading/error states by adding them to the slice:

```ts
interface AccountsState {
  accounts: Account[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}
```

Handle the thunk lifecycle in `extraReducers`. This is for Phase 1 future — document when we get here.

---

## What Belongs in `initialState`

All seed/mock data lives in `initialState` inside the slice. Components should never hardcode data. This means:
- If you're building a UI for accounts, there should already be accounts in `initialState`
- When we switch to a real API, we replace `initialState` data with an async fetch, not component logic

---

## Common Mistakes

1. **Mutating state outside a reducer** — only Immer-wrapped reducers are safe for mutation-style writes.
2. **Selecting the entire state** — `state` instead of `state.accounts.accounts`. Always be specific.
3. **Defining selectors as arrow functions inside the component** — they get recreated every render. Extract them.
4. **Dispatching inside `useSelector`** — selectors are for reading, not writing. Dispatch separately.
5. **Storing derived data in Redux** — if `totalBalance` can be computed from `accounts`, compute it in the component with `reduce`. Don't store it in the slice.
6. **Not typing `PayloadAction`** — always type the action payload so TypeScript can validate dispatch calls.
