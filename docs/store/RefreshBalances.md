# Refresh Balances — Synchronous Computation Thunk

## What Was Built
`refreshBalances` was rewritten from a mock API call to a synchronous `getState`-based computation that derives correct account balances from the transactions already in the Redux store, with no network request.

## File Location
`src/store/accountsSlice.ts`

---

## Concepts Introduced

### Synchronous computation thunk — getState as the entire implementation

**Plain English**
Every `createAsyncThunk` you've seen so far has made a network call. But "async thunk" doesn't mean "must hit the network" — it just means "runs outside the reducer with access to dispatch and getState, fires pending/fulfilled/rejected actions." You can write a thunk whose entire job is to read the current store state, compute a value, and return it. No `await`, no `fetch`, no external dependency. The machinery (loading state, error handling, fulfilled update) still works exactly the same. The caller — the button in `AccountsOverview` — has no idea the work was local.

**Technically Speaking**
`createAsyncThunk<ReturnType, ArgType, ThunkApiConfig>` accepts a payload creator whose return value can be either a `Promise<ReturnType>` or a plain `ReturnType`. When you return a plain value, RTK wraps it in `Promise.resolve()` automatically. The `pending` action still dispatches (momentarily setting `loading = true`), and `fulfilled` fires with the computed payload when the microtask queue drains. For a synchronous computation, `isPending` is true for one event loop tick — imperceptibly fast. The entire `refreshBalances.pending/.fulfilled/.rejected` reducer chain is reused without modification.

The third type argument `{ state: RootState }` types `getState()` — identical to how `updateTransactionThunk` used it to read the old transaction before updating. Here it's the entire implementation instead of just a pre-fetch lookup.

**Vue / Laravel Analogy**
In Vuex, a synchronous action:
```ts
refreshBalances({ state, commit }) {
  const balances = state.accounts.accounts.map(account => ({
    id: account.id,
    balance: state.transactions.transactions
      .filter(t => t.accountId === account.id)
      .reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0)
  }))
  commit('SET_BALANCES', balances)
}
```
No `async`, no `await` — Vuex actions don't require returning a Promise. Redux Toolkit requires you to use `createAsyncThunk` for side effects, but the payload creator itself doesn't need to be async. In Laravel, a controller method that queries a local in-memory collection rather than hitting the database serves the same purpose — same interface, no external I/O.

**Common Mistakes**
1. **Assuming `createAsyncThunk` always makes a network call.** The "async" in the name refers to how the action lifecycle works (pending/fulfilled/rejected), not whether a network request is involved.
2. **Using `dispatch` inside the component instead.** You could write this logic directly in the `onClick` handler — but then you'd need `useSelector` for both accounts and transactions in `AccountsOverview`, compute the balances in the component, and dispatch a custom action. Using a thunk keeps the logic in the store where it belongs and keeps the component thin.
3. **Forgetting `void` as the arg type.** `createAsyncThunk<ReturnType>` (one type arg) defaults `ArgType` to `unknown`, causing TypeScript to complain when you call `dispatch(refreshBalances())` without an argument. The explicit `void` second arg makes it clear the thunk takes no argument.

---

### Derived balance calculation — ground truth from transactions

**Plain English**
An account's balance isn't a number you store — it's a number you calculate. The correct balance is: start at zero, add every credit transaction, subtract every debit transaction. Whatever the result is, that's the balance. Before this change, the database held whatever balance was set at account creation, and the Redux store held that number plus all the in-memory transaction adjustments. This computation derives the balance purely from the transaction record, making it the ground truth regardless of what the database says.

**Technically Speaking**
```ts
balance: transactions
  .filter((t) => t.accountId === account.id)
  .reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0),
```
`filter` is O(n) over all transactions; `reduce` is O(m) over the filtered set. For the typical transaction count in a personal finance app, this is negligible. The result is a `number` typed as `{ id: string; balance: number }` — matching the existing `refreshBalances.fulfilled` reducer's expected payload shape, which is why no reducer changes were needed.

**Vue / Laravel Analogy**
In Laravel, this is the difference between a stored `balance` column and a computed `balance` accessor:
```php
public function getBalanceAttribute() {
    return $this->transactions->reduce(fn($sum, $t) =>
        $sum + ($t->type === 'credit' ? $t->amount : -$t->amount), 0
    );
}
```
Computed from source data rather than stored and maintained separately. The same principle applies in both React Redux and Laravel Eloquent: derived values should be computed from their source, not maintained in parallel.

**Common Mistakes**
1. **Including `accountId` in the returned object.** The existing `refreshBalances.fulfilled` reducer matches by `id` from `state.accounts.find(a => a.id === update.id)` — it expects `{ id, balance }`, not `{ id, accountId, balance }`. Matching the existing payload shape is what makes this a drop-in replacement.

---

## Code Walkthrough

### The rewritten thunk
```ts
export const refreshBalances = createAsyncThunk<
  { id: string; balance: number }[],
  void,
  { state: RootState }
>(
  'accounts/refreshBalances',
  (_, { getState }) => {
    const { accounts } = getState().accounts;
    const { transactions } = getState().transactions;
    return accounts.map((account) => ({
      id: account.id,
      balance: transactions
        .filter((t) => t.accountId === account.id)
        .reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0),
    }));
  },
);
```
Three type parameters: what the thunk returns (`{ id, balance }[]`), what argument it takes (`void` — none), and the store type config (`{ state: RootState }`). `_` is the unused arg parameter. `getState()` is called twice — once for accounts, once for transactions — both are synchronous. The returned array maps each account to its computed balance. No `async`, no `await`, no network dependency. The existing `pending/fulfilled/rejected` reducer cases handle this identically to a real API call.

### Why no reducer changes were needed
```ts
.addCase(refreshBalances.fulfilled, (state, action) => {
  state.loading = false;
  action.payload.forEach((update) => {
    const account = state.accounts.find((a) => a.id === update.id);
    if (account) {
      account.balance = update.balance;
    }
  });
})
```
This reducer case was already written to handle `{ id: string; balance: number }[]`. The payload shape is identical — the thunk is a drop-in replacement. The button, the loading state, the fulfilled update, the error handling: all unchanged. The only thing that changed is the source of the data.

---

## What to Remember

- `createAsyncThunk` doesn't require a network call — a synchronous computation that returns a plain value works identically; RTK wraps it in `Promise.resolve()`.
- The "pending/fulfilled/rejected" lifecycle fires regardless of whether the payload creator is async — use this to get loading state for free even on local computations.
- `void` as the second type argument to `createAsyncThunk` is required when the thunk takes no argument — without it, TypeScript infers `unknown` and flags `dispatch(refreshBalances())` as an error.
- Derived values (like account balance) should be computed from source data rather than maintained in parallel — this eliminates the possibility of the stored value drifting from reality.
- `getState` typed via `{ state: RootState }` as the third type argument is the same pattern as `updateTransactionThunk` — reused here as the complete implementation rather than a pre-fetch lookup.
