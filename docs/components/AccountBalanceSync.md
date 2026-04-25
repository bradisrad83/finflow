# AccountBalanceSync

## What Was Built
A `useEffect` in `TransactionList` (later moved to `useTransactions`) that recalculates an account's balance from its transactions on every change and syncs it back to the accounts slice via a new `updateBalance` reducer.

## File Location
`src/hooks/useTransactions.ts` (the effect lives here after the custom hook refactor)
`src/store/accountsSlice.ts` (the `updateBalance` reducer)

---

## Concepts Introduced

### useEffect

**Plain English**
`useEffect` lets you run code *after* React has rendered the component — and re-run it whenever specific values change. Here the question is: "whenever the list of transactions for this account changes, recalculate the balance and push it to the store." You can't do that calculation during render (you'd be dispatching while React is still painting), so `useEffect` gives you a safe place to do it after the fact.

**Technically Speaking**
`useEffect(fn, deps)` schedules `fn` to run asynchronously after the browser has painted. React compares each value in the `deps` array to its previous value using `Object.is`. If any value changed, the effect re-runs. If `deps` is omitted, the effect runs after every render. If `deps` is `[]`, it runs once on mount only. The effect here depends on `[transactions, accountId, dispatch]` — `transactions` is a new array reference every time the Redux store updates (because `useSelector` re-derives it), so the effect fires reliably on every add.

**Vue / Laravel Analogy**
`useEffect` with a dependency array maps directly to Vue 3's `watch`:

```ts
// Vue equivalent
watch(transactions, (newList) => {
  const balance = newList.reduce(...);
  store.commit('accounts/updateBalance', { accountId, balance });
});
```

The dependency array in React and the watched source in Vue serve the same purpose: "run this when that changes." Laravel's equivalent is an Eloquent `Observer` — a hook that fires after a model event (`saved`, `deleted`) to keep derived state in sync.

**Common Mistakes**
1. **Omitting the dependency array entirely.** Without `deps`, the effect runs after *every* render — including the one the effect itself triggered — creating an infinite loop.
2. **Passing `[]` when you need reactive deps.** An empty array means "run once on mount." If `accountId` changes (switching accounts), the effect won't re-run and you'll see stale data.
3. **Dispatching during render instead of inside `useEffect`.** Calling `dispatch` at the top level of a component (outside `useEffect`) fires during render, which React forbids — you'll get a warning about state updates during render.

---

### Cross-Slice State Sync

**Plain English**
The app has two Redux slices — `accounts` and `transactions` — and they need to stay in agreement: the balance on an account card should reflect what the transactions actually add up to. One approach would be to always *calculate* the balance from transactions when rendering. The approach taken here is different: transactions are the source of truth, and an effect writes the derived balance back into the accounts slice so components can just read it directly.

**Technically Speaking**
This is a deliberate denormalization: `balance` is redundant data (it can always be derived from `transactions`), but storing it in the accounts slice means `AccountCard` can read one value rather than filtering and reducing all transactions on every render. The `useEffect` is the synchronization boundary — it fires after the transaction list changes and dispatches `updateBalance` to keep the accounts slice consistent. The trade-off: you have two sources of data that must be kept in sync, which adds a moving part. The payoff: simpler selectors in `AccountCard`.

**Vue / Laravel Analogy**
In Laravel this is a stored computed column — you could always `SUM()` transactions in a query, but sometimes you denormalize the balance onto the `accounts` table and update it via an Observer for read performance. Same trade-off, same pattern.

**Common Mistakes**
1. **Letting the two slices drift.** If you add a way to delete transactions without updating the balance, the slices go out of sync. The effect must cover all mutation paths.
2. **Computing balance in the reducer instead.** It's tempting to update the balance inside `addTransaction` in the transactions slice, but reducers shouldn't reach across slice boundaries. The effect is the right coordination point.

---

## Code Walkthrough

```ts
// accountsSlice.ts
updateBalance: (state, action: PayloadAction<{ accountId: string; balance: number }>) => {
  const account = state.accounts.find((a) => a.id === action.payload.accountId);
  if (account) {
    account.balance = action.payload.balance;
  }
},
```
The reducer finds the account by ID and directly mutates `account.balance`. This looks like a plain mutation but is safe because Redux Toolkit wraps reducers in Immer — direct mutations are intercepted and turned into a new immutable state. The `if (account)` guard handles the case where an unknown `accountId` is dispatched, keeping the reducer safe without throwing.

```ts
// useTransactions.ts
useEffect(() => {
  const balance = transactions.reduce((sum, t) => {
    return t.type === 'credit' ? sum + t.amount : sum - t.amount;
  }, 0);
  dispatch(updateBalance({ accountId, balance }));
}, [transactions, accountId, dispatch]);
```
`reduce` starts at `0` and walks every transaction: credits add to the sum, debits subtract. The result is dispatched as the new balance. This runs on first render too — so even if the seed `initialState` balance in `accountsSlice` is wrong, this effect overwrites it immediately with the correct derived value. Transactions are always the authority.

---

## What to Remember

- `useEffect(fn, deps)` runs *after* render, not during — use it for anything that shouldn't block painting (store sync, subscriptions, timers).
- The dependency array controls when the effect re-runs: omit it and it loops forever; pass `[]` and it runs once; list your values and it runs when they change.
- Redux Toolkit's Immer lets you write direct mutations inside reducers — it's not a bug, it's the intended API.
- Reducers should not reach across slices; use effects (or middleware) as the coordination layer between slices.
- Deriving balance from transactions on first render means seed data in `accountsSlice.initialState` is immediately overwritten — transactions are the source of truth, not the hardcoded balance.
