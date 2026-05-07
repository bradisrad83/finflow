# useTransactions — Bug Fix & Concept Doc

## What Was Built
A bug fix for `useTransactions.ts` — a custom hook that was accidentally overwriting account balances in the Redux store every time a user clicked an account card.

## File Location
`src/hooks/useTransactions.ts`

---

## Concepts Introduced

### Custom Hooks

**Plain English**
A custom hook is just a regular JavaScript function that starts with `use` and calls other React hooks inside it. It's a way to pull logic out of a component so you can reuse it and keep components clean. Think of it like an extracted composable in Vue 3 — same idea, different name.

**Technically Speaking**
Custom hooks are plain functions that follow the Rules of Hooks (only called at the top level of a component or another hook, never inside conditionals or loops). React doesn't enforce this by name, but the `use` prefix signals to linters (via `eslint-plugin-react-hooks`) that hook rules apply. They can call `useState`, `useEffect`, `useSelector`, etc., and return whatever data the calling component needs. They don't create their own component instance — they share the calling component's render cycle.

**Vue / Laravel Analogy**
In Vue 3, this is a composable — a function you'd put in `src/composables/useTransactions.ts` that calls `ref`, `computed`, or `watch` inside it. The mental model is identical: extract stateful logic into a function, call it inside a component. The difference is that Vue composables are reactive by default via the reactivity system, whereas React hooks are tied to the render cycle and cause re-renders when state/selectors change.

**Common Mistakes**
- Calling a hook conditionally (`if (x) useTransactions(id)`) — this breaks React's hook order guarantee and will throw a runtime error.
- Thinking the hook is "its own component" — it isn't; it runs inside the component that calls it.
- Returning stale data by forgetting that `useSelector` re-runs on every relevant store change, not just on mount.

---

### useEffect and Unintended Side Effects

**Plain English**
`useEffect` runs a block of code *after* the component renders, and re-runs it whenever the values in its dependency array change. It's designed for side effects — things like fetching data, setting up subscriptions, or syncing with an external system. The bug here was that we used `useEffect` to dispatch to the Redux store, which caused it to overwrite the account's balance every single time the account card was clicked (because clicking mounted the `TransactionList` component, which called `useTransactions`, which fired the effect).

**Technically Speaking**
`useEffect(() => { ... }, [dep1, dep2])` schedules the callback to run after the browser paints the DOM. React compares the dependency array between renders using `Object.is` (referential equality). When `TransactionList` mounted, the hook ran for the first time, the effect fired, and `dispatch(updateBalance(...))` replaced the authoritative seed balance in the store with a value computed solely from the filtered transaction list. This was a destructive write with no rollback.

**Vue / Laravel Analogy**
In Vue 3, `useEffect` is analogous to `watch` or `watchEffect`. The bug would look like this in Vue:

```ts
watchEffect(() => {
  const balance = transactions.value.reduce(...)
  store.commit('updateBalance', { accountId, balance }) // overwrites every time
})
```

You'd never put a Vuex `commit` inside a `watch` that fires on mount unless you were deliberately syncing state. Same principle applies in React — `useEffect` + `dispatch` is powerful but should be intentional.

**Common Mistakes**
- Running `useEffect` without understanding *when* it fires — it runs after every render where the deps changed, including the very first mount.
- Using `useEffect` to sync derived data back into the store (the exact bug here) — if data can be derived from existing state, derive it at read time, not write time.
- Forgetting that `useEffect` cleanup is needed for subscriptions or timers, even if it's not needed for simple dispatches.

---

### Authoritative State vs. Derived State

**Plain English**
There are two kinds of data in a store. *Authoritative state* is data that comes from an external source — a bank API, a database, a user action. *Derived state* is data you compute from authoritative state. The bug was treating the account balance as derived (computed from transactions) when it's actually authoritative (set by the bank and seeded in `initialState`). Overwriting authoritative state with a derived calculation every time a component mounts is almost always wrong.

**Technically Speaking**
In Redux, the single source of truth for `account.balance` is `accountsSlice.initialState` (and eventually an API response). `transactionsSlice` holds a separate list of activity records. These two slices are independent — the transactions don't "own" the balance. Recomputing the balance from a filtered transaction subset and writing it back to the accounts slice creates a hidden dependency between slices that bypasses the intended data flow. The correct pattern is to derive balance summaries at read time using a selector, not to mutate the store as a side effect of rendering.

**Vue / Laravel Analogy**
In Laravel, this is the difference between a column value (`accounts.balance` from the database) and a computed attribute (`$account->computed_balance` derived from a `transactions` relationship). You'd never `UPDATE accounts SET balance = SUM(transactions.amount)` inside a view controller just because someone loaded the page. The balance column is authoritative — you only update it intentionally (e.g., after a successful transfer API call).

In Vue/Pinia, the equivalent is: use a `getter` (computed property) to derive a sum from transactions. Do not `$patch` the balance store from inside a composable that fires on component mount.

**Common Mistakes**
- Conflating "what the balance is" with "what the transactions add up to" — these can legitimately differ (opening balances, fees, interest).
- Writing derived values back into the store when a selector or `useMemo` is the right tool.
- Assuming transactions are a complete ledger — in real banking, balance comes from the institution, not from summing visible transactions.

---

## Code Walkthrough

### Before (the bug)

```ts
useEffect(() => {
  const balance = transactions.reduce((sum, t) => {
    return t.type === 'credit' ? sum + t.amount : sum - t.amount;
  }, 0);
  dispatch(updateBalance({ accountId, balance }));
}, [transactions, accountId, dispatch]);
```

This ran every time `transactions` or `accountId` changed — which includes the initial mount of `TransactionList`. It took the filtered transaction list (e.g., 4 transactions for Primary Checking) and computed their net sum ($4,074.08), then dispatched `updateBalance` to overwrite the store's seed balance ($12,450). The component had no idea it was destroying data.

### After (the fix)

```ts
function useTransactions(accountId: string): Transaction[] {
  const transactions = useSelector((state: RootState) =>
    state.transactions.transactions.filter((t) => t.accountId === accountId)
  );

  return transactions;
}
```

All the hook does now is read from the store and filter. No writes, no effects, no side effects. `useSelector` is reactive — it will re-run automatically if the transactions slice changes. The account balances in `accountsSlice` are untouched.

---

## What to Remember

- `useEffect` that dispatches to the store is not inherently wrong, but it must be intentional — ask yourself: "am I mutating authoritative state, or syncing with something external?"
- If data can be *derived* from the store, use a selector or compute it inline — don't write it back into the store.
- Account balance and transaction history are two separate concerns in a finance app — don't let one silently overwrite the other.
- The bug was invisible at first load because the components weren't mounted yet — it only surfaced on interaction. This is a common class of React bug: effects that fire on mount and corrupt state.
- When a number changes unexpectedly in the UI, trace it to the store first — check what's dispatching and when.
