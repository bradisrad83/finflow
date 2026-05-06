# fetchAllTransactions

## What Was Built
`fetchAllTransactions` — an async thunk that fetches every account's transactions simultaneously using `Promise.all`, dispatched from a dependent `useEffect` in `Dashboard` so `SpendingSummary` has real data on page load.

## File Location
`src/store/transactionsSlice.ts`, `src/pages/Dashboard.tsx`

---

## Concepts Introduced

### Promise.all inside a thunk

**Plain English**
Fetching transactions one account at a time would work, but it's slow — you'd wait for account 1 to finish before starting account 2. `Promise.all` fires all the requests at the same moment, then waits for the slowest one. Three accounts? Three simultaneous HTTP requests instead of three sequential ones. The total wait time is the duration of the single slowest request, not the sum of all three.

**Technically Speaking**
`Promise.all(promises: Promise<T>[])` returns a `Promise<T[]>` that resolves when every input Promise resolves, or rejects immediately if any one of them rejects. The input array is constructed by mapping account IDs to `api.fetchTransactions(id)` calls — each call starts a fetch immediately when `map` runs it, so all requests are in-flight before `Promise.all` even starts waiting. The `.then((batches) => batches.flat())` step receives a `Transaction[][]` (one array per account) and collapses it into a single `Transaction[]` using the native `Array.prototype.flat()` method. `createAsyncThunk` wraps the whole thing: if any individual fetch rejects, `Promise.all` rejects, and the `rejected` case fires.

**Vue / Laravel Analogy**
In a Vue store action you'd write the same thing:
```ts
async fetchAll({ commit }, accountIds: string[]) {
  const batches = await Promise.all(accountIds.map(id => api.fetchTransactions(id)))
  commit('SET_TRANSACTIONS', batches.flat())
}
```
In Laravel, the closest equivalent is running multiple queued jobs in parallel via `Bus::batch()` or using `Http::pool()` to make concurrent HTTP requests. The concept is universal — parallel async work, wait for all results.

**Common Mistakes**
1. **Using `Promise.allSettled` when you mean `Promise.all`.** `allSettled` never rejects — it resolves with a mix of fulfilled and rejected results. If one account fetch fails silently, you'll end up with partial data and no error in the UI. Use `Promise.all` so a single failure surfaces to the `rejected` case.
2. **Awaiting inside the map instead of outside.** `accountIds.map(async id => await api.fetchTransactions(id))` still runs in parallel (the `async` wrapper doesn't serialize them), but it's misleading and produces `Promise<Transaction[]>[]` instead of `Transaction[][]`. Just pass the Promise directly: `accountIds.map(id => api.fetchTransactions(id))`.
3. **Forgetting `.flat()`.** `Promise.all` returns an array of arrays — `Transaction[][]`. Passing that directly to the reducer means `action.payload` is the wrong shape and TypeScript will catch it, but the error message isn't always obvious.

---

### Dependent useEffect — chaining effects through Redux state

**Plain English**
The dashboard needs two things in sequence: first the list of accounts (so we know which IDs to fetch), then the transactions for those accounts. You can't fetch transactions until you know the account IDs. Rather than chaining `.then()` calls or nesting logic inside one big effect, you write two separate effects: one that fetches accounts on mount, and one that watches the accounts array and fires when it's populated. The second effect depends on the result of the first — mediated through the Redux store.

**Technically Speaking**
A `useEffect` re-runs whenever a value in its dependency array changes by reference. `accounts` is `state.accounts.accounts` from the Redux store — on first render it's `[]` (empty array, from `initialState`). After `fetchAccounts` resolves and the reducer runs, a new array reference is written to the store. React detects the changed reference in the second effect's dep array and re-runs the effect. The `if (accounts.length === 0) return` guard prevents the effect from dispatching on the initial empty-array render. The result: the second effect is effectively triggered by the *completion* of the first, without any direct coupling between them.

**Vue / Laravel Analogy**
In Vue 3, this is a `watch` on a computed or reactive value:
```ts
const accounts = computed(() => store.state.accounts.accounts)

watch(accounts, (newAccounts) => {
  if (newAccounts.length === 0) return
  store.dispatch('transactions/fetchAll', newAccounts.map(a => a.id))
})
```
The `watch` fires when the store updates — same as React's `useEffect` re-running when a selector value changes. In Laravel, there's no direct equivalent because server requests are stateless — there's no "watch this value and re-run when it changes" paradigm.

**Common Mistakes**
1. **Omitting the guard.** Without `if (accounts.length === 0) return`, the effect fires on the initial render with an empty array — `fetchAllTransactions([])` is dispatched, which makes a no-op API call and sets `loading = true` unnecessarily.
2. **Putting both fetches in one effect.** It's tempting to write one effect that calls `fetchAccounts()` then immediately calls `fetchAllTransactions()` — but `fetchAccounts()` is async and the accounts won't be in the store yet when `fetchAllTransactions` runs. You'd be passing an empty array. Separate effects with the second watching the store value is the correct pattern.
3. **Adding `accounts` to the first effect's dep array.** The first effect only needs `dispatch`. Adding `accounts` would cause it to re-run every time an account is added, re-fetching the account list on every mutation.

---

## Code Walkthrough

### The thunk
```ts
export const fetchAllTransactions = createAsyncThunk<Transaction[], string[]>(
  'transactions/fetchAll',
  (accountIds) =>
    Promise.all(accountIds.map((id) => api.fetchTransactions(id))).then((batches) =>
      batches.flat()
    ),
);
```
The type parameters say: this thunk returns `Transaction[]` and receives `string[]` as its argument. The body fires one `api.fetchTransactions` call per ID simultaneously, waits for all of them, then flattens the array of arrays into a single flat array. The thunk creator handles the `pending/fulfilled/rejected` action dispatch automatically.

### The fulfilled reducer
```ts
.addCase(fetchAllTransactions.fulfilled, (state, action) => {
  state.loading = false;
  state.transactions = action.payload;
})
```
Unlike `fetchTransactions.fulfilled` (which merges by account ID to preserve other accounts' data), this is a full replacement. On the dashboard, we're loading everything at once, so overwriting the whole array is correct and simpler. `action.payload` is the flat `Transaction[]` returned by the thunk.

### The dependent effect in Dashboard
```ts
const accounts = useSelector((state: RootState) => state.accounts.accounts);

useEffect(() => {
  dispatch(fetchAccounts());
}, [dispatch]);

useEffect(() => {
  if (accounts.length === 0) return;
  dispatch(fetchAllTransactions(accounts.map((a) => a.id)));
}, [accounts, dispatch]);
```
Two effects, clearly separated by responsibility. The first owns bootstrapping accounts. The second owns bootstrapping transactions — but it can only run once accounts exist, so it watches `accounts` and guards on `length === 0`. The store is the communication channel between them: the first effect writes to it, the second reads from it.

---

## What to Remember

- `Promise.all` fires all Promises simultaneously — total wait time equals the slowest request, not the sum of all requests.
- `.flat()` is required after `Promise.all` because the result is `T[][]` — an array of arrays, one per resolved Promise.
- The dependent `useEffect` pattern: put the upstream data (accounts) in the dep array of the downstream effect, and guard on empty to skip the initial render.
- Never put both `fetchAccounts` and `fetchAllTransactions` in the same effect — the first is async and the store won't be updated yet when the second dispatch runs.
- `fetchAllTransactions.fulfilled` uses full replacement (`state.transactions = action.payload`) because it loads everything at once — unlike per-account fetches which merge to preserve unrelated data.
