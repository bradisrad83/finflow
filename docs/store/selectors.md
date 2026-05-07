# selectors.ts

## What Was Built
A central `selectors.ts` file containing all named Redux selectors — simple field accessors for direct state reads, and a `createSelector`-powered `selectAccountById` factory for memoized derived data.

## File Location
`src/store/selectors.ts`

---

## Concepts Introduced

### Named input selectors — extracting inline arrows into functions

**Plain English**
Every time you write `useSelector((state) => state.accounts.accounts)` inline, you're creating a new anonymous function. It works, but it's not reusable — if three components need the accounts array, that same arrow gets copy-pasted three times. Named selectors solve this: define the function once in a central file, import it wherever needed. If the state shape ever changes, you fix it in one place.

**Technically Speaking**
An input selector is just a plain function with the signature `(state: RootState) => T`. Redux uses referential equality to decide whether to re-render: if the selector returns the same reference as last time, the component doesn't re-render. Simple field access selectors (`state.accounts.accounts`) are already efficient — they return the stored reference directly. The value of naming them is reuse and maintainability, not performance.

**Vue / Laravel Analogy**
In Vuex, these are getters with no computation:
```ts
getters: {
  accounts: (state) => state.accounts.list
}
```
In Laravel, think of a read-only accessor on a model: `public function getAccountsAttribute() { return $this->accounts; }`. Same idea — a named, reusable way to read a value.

**Common Mistakes**
1. **Defining selectors inside components.** `const mySelector = (state) => state.x` inside a component function body creates a new function reference on every render, defeating memoization for any `createSelector` selector that uses it as an input.
2. **Scattering selectors across slice files.** Keeping them in one `selectors.ts` makes them easy to find, import, and maintain. If they live in the slice files, you end up hunting across files to find what's available.

---

### createSelector — memoized derived data

**Plain English**
Sometimes you need to derive something from the store — find one item in a list, filter a collection, compute a total. You could do this computation inside the component on every render. But if the component re-renders for a reason unrelated to that data (a parent re-renders, something else in the store changes), you're re-running the work for nothing. `createSelector` is a memoization wrapper: it caches the last result and only re-runs the computation when its inputs actually change.

**Technically Speaking**
`createSelector(...inputSelectors, resultFn)` is provided by Reselect (bundled in Redux Toolkit). It runs `resultFn` with the outputs of each input selector. Between calls, it checks whether any input selector returned a different value (by reference, using `===`). If all inputs are identical to last time, it returns the cached result without running `resultFn` again. This is useful when `resultFn` does non-trivial work — array filtering, `.find()`, aggregation — that would be wasteful to repeat on every render. The return type of the selector is inferred from `resultFn`'s return type.

**Vue / Laravel Analogy**
This is Vue 3's `computed`:
```ts
// Vue 3
const account = computed(() => accounts.value.find(a => a.id === props.id))
```
`computed` only re-evaluates when its reactive dependencies change. `createSelector` only re-runs when its input selectors return new values. Same contract, same caching behavior, different framework. In Laravel, there's no direct equivalent — server requests are stateless, so there's no "cache this derived value across renders" concept.

**Common Mistakes**
1. **Using `createSelector` for simple field access.** `createSelector((state) => state.accounts, (accounts) => accounts)` adds overhead with no benefit. Use `createSelector` only when `resultFn` does actual computation.
2. **Expecting per-instance memoization from a module-level selector.** A single `createSelector` instance caches exactly one result — the last call's inputs and output. If two components simultaneously call `selectAccountById('1')` and `selectAccountById('2')`, they share one cache slot and thrash each other. The factory pattern creates a separate selector instance per call site.

---

### Selector factory — parameterized selectors

**Plain English**
`createSelector` defines its inputs at build time. But sometimes you need a runtime parameter — like "find the account with this specific ID, where the ID comes from the URL." You can't pass a variable into `createSelector` directly. The solution is a factory: a plain function that takes the parameter and *returns* a configured selector. Each call to the factory produces its own memoized selector with the parameter baked in.

**Technically Speaking**
```ts
export const selectAccountById = (id: string) =>
  createSelector(selectAccounts, (accounts) => accounts.find((a) => a.id === id) ?? null);
```
`selectAccountById` is a higher-order function — it returns a `(state: RootState) => Account | null` selector. The `id` is captured in the closure. `useSelector(selectAccountById(id ?? ''))` creates a new selector instance on every render, but because `createSelector` memoizes by input value, the `.find()` only re-runs when `selectAccounts` returns a new array reference. The `?? null` converts `undefined` (what `Array.find` returns on miss) to `null`, giving the return type `Account | null` instead of `Account | undefined` — a cleaner type to guard against.

**Vue / Laravel Analogy**
In Vue 3, a computed that takes a parameter is modeled as a function returning a computed:
```ts
const selectAccountById = (id: string) => computed(() =>
  accounts.value.find(a => a.id === id) ?? null
)
```
Same factory pattern — a function that returns a reactive, memoized value. In Laravel, this is similar to a scope on a model: `Account::findById($id)` — parameterized, but not memoized on the server side.

**Common Mistakes**
1. **Calling the factory inside a loop or conditional.** `selectAccountById(id)` in a conditional branch violates React's rules of hooks (if `useSelector` is called conditionally). Always call it at the top level of the component.
2. **Expecting the factory itself to be memoized.** `selectAccountById('1')` creates a *new* selector object on every render. This is fine for small apps, but in performance-critical scenarios you'd memoize the selector instance with `useMemo`: `const selector = useMemo(() => selectAccountById(id), [id])`.

---

## Code Walkthrough

### The input selectors
```ts
export const selectAccounts = (state: RootState) => state.accounts.accounts;
export const selectAccountsLoading = (state: RootState) => state.accounts.loading;
export const selectAccountsError = (state: RootState) => state.accounts.error;

export const selectAllTransactions = (state: RootState) => state.transactions.transactions;
export const selectTransactionsLoading = (state: RootState) => state.transactions.loading;
export const selectTransactionsError = (state: RootState) => state.transactions.error;
```
Plain functions, no memoization. Their value is naming and centralization. Every consumer now imports `selectAccounts` instead of writing the same arrow function — and if the state shape ever changes (e.g. `accounts` gets nested deeper), this is the one place to update.

### The derived selector
```ts
export const selectAccountById = (id: string) =>
  createSelector(selectAccounts, (accounts) => accounts.find((a) => a.id === id) ?? null);
```
`createSelector` takes `selectAccounts` as its input — so it only re-runs when the accounts array changes. The result function does the `.find()`. The `?? null` ensures a clean `Account | null` return type rather than `Account | undefined`. The whole thing is wrapped in a factory so `id` can be a runtime value from the URL.

### Usage in AccountDetail
```ts
const account = useSelector(selectAccountById(id ?? ''));
```
Before: `useSelector((state: RootState) => state.accounts.accounts.find((a) => a.id === id))` — inline, not memoized, re-runs `.find()` on every render. After: one import, one call, memoized. The `id ?? ''` handles the case where `useParams` returns `undefined` (e.g. during a route transition).

### Dropping RootState from consumers
```ts
// before
import type { RootState } from '../store';
const accounts = useSelector((state: RootState) => state.accounts.accounts);

// after
import { selectAccounts } from '../store/selectors';
const accounts = useSelector(selectAccounts);
```
Components no longer need to import `RootState` just to write a selector inline. The type information lives in `selectors.ts` where it belongs. Leaner imports, shorter component files.

---

## What to Remember

- Input selectors (plain field access) don't need `createSelector` — name them for reuse, not memoization.
- Use `createSelector` when `resultFn` does real computation (`.find()`, `.filter()`, aggregation) that's wasteful to repeat on every render.
- When a selector needs a runtime parameter, wrap it in a factory function: `const selectById = (id: string) => createSelector(...)`.
- A single `createSelector` instance caches exactly one result — the factory pattern gives each call site its own cache slot.
- The `?? null` convention converts `Array.find`'s `T | undefined` to `T | null`, giving cleaner types to guard against in components.
