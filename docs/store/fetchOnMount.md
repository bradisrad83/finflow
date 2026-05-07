# fetchOnMount (connect-api)

## What Was Built
`fetchAccounts` — an async thunk that loads accounts from the Haskell API on app mount — wired into `Dashboard.tsx` via `useEffect` so the store is populated with real data instead of a hardcoded `initialState`.

## File Location
`src/store/accountsSlice.ts`, `src/pages/Dashboard.tsx`, `src/components/AccountsOverview.tsx`

---

## Concepts Introduced

### useEffect as a dispatch trigger

**Plain English**
React components have one job: take data and return JSX. They're supposed to be pure — same input, same output, no side effects. But real apps need to do things like fetch data when a page loads. `useEffect` is the designated "side effects go here" zone. It runs *after* the component renders, not during. So when `Dashboard` mounts, React first paints the page (empty accounts grid), then runs the `useEffect`, which dispatches `fetchAccounts()`, which eventually fills the store, which triggers a re-render with real data.

**Technically Speaking**
`useEffect(fn, deps)` schedules `fn` to run after the browser has painted. The `deps` array controls when it re-runs: if a value in the array changes between renders, the effect fires again. An empty array `[]` means "run once on mount, never again." Including `dispatch` in the array is technically correct because ESLint's `react-hooks/exhaustive-deps` rule requires all values used inside the effect to be listed as dependencies — even stable ones like `dispatch`. In practice `dispatch` never changes identity (Redux Toolkit guarantees this), so the effect still only runs once.

**Vue / Laravel Analogy**
This is `onMounted` in Vue 3:
```js
// Vue 3
onMounted(() => store.dispatch('accounts/fetchAll'))

// React
useEffect(() => { dispatch(fetchAccounts()); }, [dispatch]);
```
The key difference: Vue's `onMounted` is a lifecycle hook you call inside `setup()`. React's `useEffect` is a hook you call inside the component function body — React decides when to run it based on the dependency array. Same concept, different mechanism.

**Common Mistakes**
1. **Omitting the dependency array entirely.** `useEffect(() => { dispatch(fetchAccounts()) })` with no second argument runs on *every* render — every state change, every re-render, infinite fetch loop.
2. **Using an async function directly.** `useEffect(async () => { ... })` — React doesn't await the return value and will log a warning. If you need `await` inside an effect, define an async function inside it and call it immediately.
3. **Fetching in every component instead of a parent.** If both `AccountsOverview` and `Dashboard` dispatched `fetchAccounts`, you'd get two API calls on mount. Fetch once in the highest-level component that needs the data (`Dashboard`), and let children just `useSelector`.

---

### loading skeleton (conditional render on first load vs. refresh)

**Plain English**
There are two moments when `loading` is `true` in the store: the very first page load (accounts array is empty) and when the user clicks "Refresh balances" (accounts array already has data). Showing skeleton cards on a refresh would be jarring — the real cards would vanish and flash back. The condition `loading && accounts.length === 0` targets only the first case.

**Technically Speaking**
`Array.from({ length: 3 })` creates a sparse array of 3 `undefined` slots. Mapping over it with `(_, i)` uses the index `i` as the React `key` — acceptable here because the list is static and never reordered. Tailwind's `animate-pulse` applies a CSS `animation: pulse` that fades opacity up and down, creating the shimmer effect with zero JavaScript and no external library.

**Vue / Laravel Analogy**
In Vue 3 you'd write `v-if="loading && accounts.length === 0"` on the skeleton wrapper and `v-else` on the real grid. React uses inline conditional expressions instead of directives — same logic, different syntax.

**Common Mistakes**
1. **Keying skeletons with `Math.random()`.** Random keys cause React to remount every render. Always use stable keys — index is fine for static placeholder lists.
2. **Showing skeletons on every `loading = true`.** If you write `{loading ? <Skeleton /> : <Cards />}`, the user sees skeletons every time they refresh. Gate on `accounts.length === 0` to show skeletons only on initial load.

---

## Code Walkthrough

### accountsSlice.ts — empty initialState
```ts
const initialState: AccountsState = {
  accounts: [],
  loading: false,
  error: null,
};
```
The hardcoded seed accounts are gone. The store starts empty and waits for the API. This is the moment the app becomes real — it can no longer work without the backend.

### accountsSlice.ts — the thunk
```ts
export const fetchAccounts = createAsyncThunk<Account[]>(
  'accounts/fetchAll',
  () => api.fetchAccounts(),
);
```
`createAsyncThunk<Account[]>` — the type parameter is what the Promise resolves to. The string `'accounts/fetchAll'` becomes the action type prefix: Redux Toolkit auto-generates `accounts/fetchAll/pending`, `accounts/fetchAll/fulfilled`, and `accounts/fetchAll/rejected` from it.

### accountsSlice.ts — extraReducers for fetchAccounts
```ts
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
```
Three cases, three state transitions. `action.payload` in `fulfilled` is the `Account[]` array returned by `api.fetchAccounts()`. In `rejected`, `action.error.message` is the error message from the thrown exception — the `??` provides a fallback if it's `undefined`.

### Dashboard.tsx — useEffect dispatch on mount
```ts
const dispatch = useDispatch<AppDispatch>();

useEffect(() => {
  dispatch(fetchAccounts());
}, [dispatch]);
```
`useDispatch<AppDispatch>()` gives us a typed dispatch that knows about our async thunks. The `useEffect` runs once after mount. `dispatch` is in the dep array because we use it inside the effect — even though it's stable, ESLint requires you to declare it.

### AccountsOverview.tsx — skeleton conditional
```ts
{loading && accounts.length === 0
  ? Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="h-36 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
    ))
  : accounts.map((account) => (
      <AccountCard key={account.id} account={account} />
    ))}
```
The ternary lives inside the grid `div`. The left side shows 3 pulse skeletons sized to match `AccountCard`. The right side is the normal render. Both branches produce the same grid layout — no layout shift when data arrives.

---

## What to Remember

- `useEffect` with a dep array of `[dispatch]` runs once on mount — it's the React equivalent of `onMounted`.
- Gate loading skeletons on `loading && accounts.length === 0`, not just `loading`, so refreshes don't wipe the UI.
- The `initialState` for any slice that fetches from an API should start empty — seed data in `initialState` is only appropriate for fully offline/mock mode.
- `createAsyncThunk`'s type parameter (`<Account[]>`) is the resolved type of the Promise — TypeScript uses it to type `action.payload` in the `fulfilled` case automatically.
- The `dispatch` function is referentially stable across renders — including it in a `useEffect` dep array is correct practice but will not cause the effect to re-run.
