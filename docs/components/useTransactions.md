# useTransactions

## What Was Built
A custom hook that encapsulates transaction-fetching, filtering, and balance-syncing logic so `TransactionList` only has to think about rendering.

## File Location
`src/hooks/useTransactions.ts`

---

## Concepts Introduced

### Custom Hooks

**Plain English**
Until now, components handled both "get the data" and "show the data" in one place. A custom hook lets you pull the "get the data" part into its own function — a function that lives outside the component but can still use React hooks like `useSelector` and `useEffect`. The component calls it and gets back what it needs. That's the whole idea.

**Technically Speaking**
A custom hook is any function whose name starts with `use` and that calls one or more React hooks internally. The `use` prefix isn't decoration — it's a contract React's linter (`eslint-plugin-react-hooks`) enforces to ensure hooks are only called in valid positions (top level of a component or another hook, never inside conditionals or loops). The hook runs as part of the component's render cycle: every time `TransactionList` re-renders, `useTransactions` is called inline, its `useSelector` runs, its `useEffect` schedules, and the return value is available to the component synchronously. There's no magic — it's just function composition with the rules-of-hooks constraint applied to the call chain.

**Vue / Laravel Analogy**
This is a Vue 3 composable, one-to-one. In Vue you'd write:

```ts
// composables/useTransactions.ts
export function useTransactions(accountId: Ref<string>) {
  const store = useStore();
  const transactions = computed(() =>
    store.state.transactions.filter(t => t.accountId === accountId.value)
  );
  return { transactions };
}
```

Same pattern: a `use`-prefixed function, called inside `setup()`, returning reactive data. React custom hooks and Vue composables solve the exact same problem with nearly identical structure.

**Common Mistakes**
1. **Forgetting the `use` prefix.** Naming it `getTransactions` means React won't enforce hook rules inside it — you'll get subtle bugs when hooks are called conditionally.
2. **Putting the hook call inside a condition or loop.** `useTransactions` must be called unconditionally at the top of the component, same as any hook. If you need conditional data, handle the condition *inside* the hook.
3. **Returning too much.** It's tempting to return the dispatch function or other internals. Return only what the component needs — here, just the `Transaction[]` array.

---

## Code Walkthrough

```ts
function useTransactions(accountId: string): Transaction[] {
```
The function signature is typed end-to-end: it takes a `string` and returns `Transaction[]`. TypeScript enforces this at the call site — if `TransactionList` passes the wrong type, it's a compile error, not a runtime surprise.

```ts
  const dispatch = useDispatch<AppDispatch>();
  const transactions = useSelector((state: RootState) =>
    state.transactions.transactions.filter((t) => t.accountId === accountId)
  );
```
These are the same hook calls that used to live in `TransactionList`. Moving them here doesn't change how they work — `useSelector` still subscribes to the Redux store and triggers a re-render when the filtered result changes. The component just no longer needs to know that.

```ts
  useEffect(() => {
    const balance = transactions.reduce((sum, t) => {
      return t.type === 'credit' ? sum + t.amount : sum - t.amount;
    }, 0);
    dispatch(updateBalance({ accountId, balance }));
  }, [transactions, accountId, dispatch]);
```
The `useEffect` runs after render whenever `transactions` or `accountId` changes. It derives the correct balance from the transaction list and dispatches it back to the accounts slice. This is the cross-slice sync: the transactions slice is the source of truth, and this effect keeps the accounts slice in agreement. All of this logic is now invisible to `TransactionList`.

```ts
  return transactions;
}
```
The hook returns only what the component needs. `dispatch`, `updateBalance`, and the balance calculation are all implementation details — they stay inside the hook.

---

## What to Remember

- A custom hook is just a function that starts with `use` and calls other hooks — nothing more.
- The `use` prefix is enforced by the linter so hook rules apply inside the function; without it, you lose that guarantee.
- Hooks in a custom hook run as part of the calling component's render cycle — they're not deferred or isolated.
- Return only the data the component needs; keep implementation details (dispatch, derived values) inside the hook.
- The Vue mental model maps directly: a custom hook is a composable, with the same motivation and nearly the same structure.
