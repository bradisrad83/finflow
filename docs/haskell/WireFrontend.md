# Wire Frontend — Full Stack Integration

## What Was Built
The React frontend was connected to the Haskell backend by replacing every API mock with a real `fetch` call, clearing seed data from the Redux store, and dispatching `fetchTransactions` on mount in `AccountDetail` so transaction data loads live from the server.

## File Location
`src/api/index.ts`, `src/store/transactionsSlice.ts`, `src/pages/AccountDetail.tsx`

---

## Concepts Introduced

### The Full-Stack Contract

**Plain English**
When the frontend and backend are both running, they communicate through a shared contract: the URL paths, HTTP methods, and JSON field names must match exactly on both sides. The TypeScript interfaces in `src/types/index.ts` and the Haskell `ToJSON`/`FromJSON` instances in `Types.hs` describe the same shapes in two different languages. If they drift — a field renamed in Haskell, a type changed in TypeScript — something breaks, but where it breaks depends on which direction:

- Haskell sends a field TypeScript doesn't expect → TypeScript ignores the unknown field (silent)
- TypeScript sends a field Haskell's `FromJSON` requires → Haskell returns 400 (loud)
- Haskell renames a field TypeScript expects → TypeScript gets `undefined` (silent, may crash later)
- TypeScript sends the wrong type → Haskell returns 400 (loud)

The API layer (`src/api/index.ts`) is the single file where all of this is made explicit. The `request<T>` generic is the assertion: "I trust this endpoint returns a value of type `T`." The TypeScript compiler can't verify that claim at compile time — it's your responsibility to keep the Haskell types and TypeScript interfaces in sync.

**Technically Speaking**
`res.json() as Promise<T>` is a type assertion, not a type check. TypeScript accepts it without verification — at runtime, `res.json()` returns `Promise<any>`. If the Haskell server returns `{ "accountId": "1" }` but your TypeScript interface says `{ id: string }`, the cast succeeds at compile time and you get `undefined` for `account.id` at runtime. This is the fundamental limitation of TypeScript at API boundaries: the type system can't reach across the network.

The correct production approach is runtime validation with a library like Zod: `AccountSchema.parse(await res.json())` throws a typed error if the shape doesn't match, regardless of what the server sent. For FinFlow session three, the `as Promise<T>` cast is sufficient because we control both ends of the wire.

`action.meta.arg` in the `fulfilled` reducer is an RTK-specific feature. Every action created by `createAsyncThunk` has a `meta` property with `requestId`, `requestStatus`, and `arg` (the original argument passed to the thunk creator). Accessing `action.meta.arg` inside `extraReducers` gives you the `accountId` string without needing to encode it in the payload, which keeps the API function signature clean.

**Vue / Laravel Analogy**
In Laravel, the equivalent of this wiring is replacing a fake repository implementation with a real database-backed one:

```php
// Before:
app()->bind(TransactionRepository::class, FakeTransactionRepository::class);
// After:
app()->bind(TransactionRepository::class, EloquentTransactionRepository::class);
```

The controller doesn't change — it still calls `$this->repo->forAccount($id)`. The binding changes. In the frontend, `AccountDetail` doesn't change its logic — it still dispatches `fetchTransactions(id)`. The `api.fetchTransactions` implementation changes from a mock to a real `fetch`. The layering is identical.

In Vue/Pinia, this session is equivalent to replacing a store action's hardcoded return value with an `axios.get(...)` call — the store interface stays the same, the data source changes.

**Common Mistakes**
- **Not clearing localStorage after removing seed data.** The Redux store is persisted to localStorage via `usePersistStore`. If old seed data is cached there, it loads on startup and masks the empty `initialState`. Always clear `finflow:state` in DevTools when changing `initialState` shape or removing seed data.
- **Forgetting CORS when connecting the two servers.** Without `simpleCors` in the Haskell server, the browser blocks every request from `localhost:5173` to `localhost:8080` at the network level. The error appears in the browser console as a CORS policy violation, not as a failed fetch — it never reaches your `ApiError` handler.
- **Expecting TypeScript to catch API shape mismatches.** The `as Promise<T>` cast is a promise to the compiler, not a check. If Haskell's response shape drifts from the TypeScript interface, the runtime error will be `undefined` values or downstream crashes, not a compile error.

---

### action.meta.arg — Reading Thunk Arguments in Reducers

**Plain English**
When you dispatch `fetchTransactions("1")`, the string `"1"` is the argument. RTK stores that argument on the generated action objects — `pending`, `fulfilled`, and `rejected` all carry `meta.arg = "1"`. Inside the `fulfilled` reducer, you can read `action.meta.arg` to know which `accountId` this response is for, without having to smuggle it inside the payload itself.

This matters for the merge strategy: when transactions arrive for account `"1"`, you need to filter out account `"1"`'s old transactions before inserting the new ones — but keep account `"2"` and `"3"`'s transactions untouched. `action.meta.arg` is how you know which account was fetched.

**Technically Speaking**
`createAsyncThunk` generates three action creators. Each dispatched action has a `meta` object with:
- `requestId` — a unique UUID for the request (useful for cancellation)
- `requestStatus` — `'pending'` | `'fulfilled'` | `'rejected'`
- `arg` — the exact value passed to the thunk creator at the call site

The TypeScript type of `action.meta.arg` is inferred from the second generic parameter of `createAsyncThunk<Returned, ThunkArg>`. Here `createAsyncThunk<Transaction[], string>` means `action.meta.arg` is typed as `string`. No manual typing needed.

The alternative — encoding the `accountId` in the payload — works but pollutes the API function's return type. `api.fetchTransactions` correctly returns `Promise<Transaction[]>` (just the data), not `Promise<{ accountId: string; transactions: Transaction[] }>`. Using `meta.arg` keeps the API layer clean and the reducer well-informed.

**Vue / Laravel Analogy**
In Pinia, an async action has access to its own arguments naturally — the function parameters are in scope inside the action body. There's no equivalent of `meta.arg` because Pinia doesn't separate the "dispatch" step from the "handle response" step the way Redux does. In Redux, the reducer that handles `fulfilled` is in a different function from where the thunk was dispatched — `meta.arg` bridges that gap.

In Laravel, this is like accessing the queued job's original payload inside a `JobProcessed` event listener — the listener isn't the job itself, but it needs to know what the job was processing.

**Common Mistakes**
- **Confusing `action.meta.arg` with `action.payload`.** `payload` is what the thunk's async function returned (the data). `meta.arg` is what was passed *to* the thunk creator (the input). For `fetchTransactions("1")`, `payload` is `Transaction[]` and `meta.arg` is `"1"`.
- **Using `meta.arg` in the `pending` reducer to show a per-account loading state.** This works, but then you need a more complex loading state shape (e.g., `loadingAccountId: string | null` instead of `loading: boolean`). For simple cases, a single boolean is sufficient.

---

### Lazy Loading with useEffect + Dispatch

**Plain English**
`AccountDetail` now fetches transactions when it mounts — not at app startup, not in a global loader. The data loads exactly when it's needed: when the user navigates to a specific account. This is lazy loading: defer fetching until the user actually needs the data, then fetch it once and cache it in the Redux store.

The `useEffect` fires after the component renders for the first time and whenever `id` changes (the user navigated to a different account). The Redux store accumulates transactions account by account as the user navigates — by the time they visit all three accounts, `SpendingSummary` has the full picture.

**Technically Speaking**
```ts
useEffect(() => {
  if (id) dispatch(fetchTransactions(id));
}, [id, dispatch]);
```

`id` comes from `useParams` and changes when the route changes. Including `id` in the dep array means the effect re-fires when the user navigates from `/accounts/1` to `/accounts/2` — a new fetch for the new account's transactions. `dispatch` is stable (Redux guarantees it never changes reference), but including it satisfies the `react-hooks/exhaustive-deps` lint rule.

The `if (id)` guard handles the case where `useParams` returns `undefined` for `id` — unlikely given the route definition, but TypeScript types it as `string | undefined` so the guard is required. Without it, you'd dispatch `fetchTransactions(undefined)` which TypeScript would reject anyway, but the guard is clearer.

**Vue / Laravel Analogy**
In Vue 3, this is `watchEffect` or `watch` on the route param:

```ts
const route = useRoute();
const { data, pending } = useFetch(() => `/api/accounts/${route.params.id}/transactions`);
```

Or with Pinia:
```ts
watch(() => route.params.id, (id) => {
  if (id) transactionStore.fetch(id as string);
}, { immediate: true });
```

The pattern is identical: react to a route param change, trigger a data fetch, cache the result. React's `useEffect` with `[id]` deps is the `watch` with `immediate: true` equivalent — fires on mount and on every subsequent change.

In Laravel, the closest concept is a controller action that only queries the transactions it needs: `Transaction::where('account_id', $id)->get()`. The server-side equivalent of lazy loading — fetch what the current request needs, nothing more.

**Common Mistakes**
- **Dispatching in the render function instead of `useEffect`.** If you write `dispatch(fetchTransactions(id))` directly in the component body (not inside `useEffect`), it dispatches on every render — including renders triggered by the fetch itself (loading state change → re-render → dispatch → fetch → loading state change...). Always put dispatch calls with side effects inside `useEffect`.
- **Missing `id` in the dependency array.** Without `[id, dispatch]`, the effect only runs on mount. Navigating from account 1 to account 2 won't trigger a new fetch — you'll see account 1's data on account 2's page. Always include every value the effect reads in the dep array.

---

## Code Walkthrough

### `api/index.ts` — before and after

Before:
```ts
export async function fetchTransactions(accountId: string): Promise<Transaction[]> {
  // return request<Transaction[]>(`/accounts/${accountId}/transactions`);
  await sleep(300);
  void accountId;
  return [];
}
```

After:
```ts
export async function fetchTransactions(accountId: string): Promise<Transaction[]> {
  return request<Transaction[]>(`/accounts/${accountId}/transactions`);
}
```

Three lines become one. The `void accountId` and `sleep` scaffolding disappears. The function signature and return type don't change — the rest of the app (the thunk, the tests, the components) never knew about the mock and don't know about the real implementation either. That's the point of the API layer.

### `transactionsSlice.ts` — the merge reducer

```ts
.addCase(fetchTransactions.fulfilled, (state, action) => {
  state.loading = false;
  const accountId = action.meta.arg;
  state.transactions = [
    ...state.transactions.filter((t) => t.accountId !== accountId),
    ...action.payload,
  ];
})
```

`action.meta.arg` is the `accountId` string that was passed to `dispatch(fetchTransactions(id))`. The merge: keep all transactions that belong to OTHER accounts, then append the freshly fetched ones for THIS account. This pattern means:

- Visit account 1: store has account 1's transactions
- Visit account 2: store has account 1 + account 2's transactions
- Refresh account 1: store replaces account 1's old data with fresh data, keeps account 2's

Without this merge, every navigation would wipe the entire transaction store — `SpendingSummary` would only ever see the last-visited account.

### `AccountDetail.tsx` — the useEffect

```ts
useEffect(() => {
  if (id) dispatch(fetchTransactions(id));
}, [id, dispatch]);
```

Fires on mount and every time `id` changes. `id` is `string | undefined` from `useParams` — the guard handles the theoretical undefined case. `dispatch` is stable, included for lint compliance. The fetch kicks off, `loading` flips to `true`, the component re-renders showing "Loading transactions…", the data arrives, `loading` flips back, `TransactionList` renders with real data.

### `AccountDetail.tsx` — conditional render

```tsx
{txError && (
  <p className="mt-6 text-sm text-red-500 dark:text-red-400">{txError}</p>
)}
{txLoading ? (
  <p className="mt-8 text-sm text-gray-400 dark:text-gray-500">Loading transactions…</p>
) : (
  <TransactionList accountId={account.id} filters={{ type: filterType, query }} />
)}
```

Error and loading are independent. The error shows above the list (it could persist even if loading is false, to preserve the last error for visibility). The loading state gates the entire `TransactionList` — showing a placeholder while data is in flight rather than an empty list that suddenly fills in.

---

## What to Remember

- The API layer (`src/api/index.ts`) is the only file that changes when swapping mocks for real endpoints. Signatures and return types stay the same; only the function bodies change.
- `res.json() as Promise<T>` is a trust assertion, not a type check. TypeScript can't verify the server's response shape — keep Haskell's `ToJSON` and TypeScript's interfaces manually in sync, or add Zod validation at the boundary.
- `action.meta.arg` gives you the thunk's original input argument inside `fulfilled`/`rejected` reducers. Use it to scope partial updates — replace only the slice of state that belongs to this request's argument.
- Clear localStorage (`finflow:state`) after removing seed data from `initialState`. The persistence layer will serve stale cached data otherwise, masking the empty initial state.
- Dispatch `fetchTransactions` inside `useEffect` with `[id]` as a dep, not in the render body. The dep array ensures re-fetching when navigating between accounts; `useEffect` prevents the fetch-render loop that direct dispatch would cause.
