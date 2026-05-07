# Abort Inflight Requests

## What Was Built
`fetchTransactions` now receives an `AbortSignal` from `thunkAPI` and forwards it to `fetch`, and `AccountDetail` returns a cleanup from its `useEffect` that calls `.abort()` on the dispatched thunk — cancelling the network request when the user navigates away.

## File Location
`src/store/transactionsSlice.ts`, `src/pages/AccountDetail.tsx`, `src/api/index.ts`

---

## Concepts Introduced

### thunkAPI.signal — RTK's built-in AbortSignal

**Plain English**
When you dispatch a thunk, Redux Toolkit internally creates an `AbortController` for that specific dispatch. It exposes the controller's signal as `thunkAPI.signal` in the thunk body. You can forward this signal to `fetch`, which knows how to listen to it — when the signal fires, the network request is cancelled mid-flight. This is the RTK-native way to add request cancellation without creating your own `AbortController` manually.

**Technically Speaking**
`createAsyncThunk`'s second argument (the thunk function) receives a `ThunkAPI` object with a `signal: AbortSignal` property. When `dispatch(fetchTransactions(id)).abort()` is called, RTK's internal `AbortController` calls `controller.abort()`. This fires the signal, which is already attached to the in-flight `fetch` via `RequestInit.signal`. The browser then rejects the fetch Promise with a `DOMException` where `name === 'AbortError'`. RTK catches this rejection and dispatches the `rejected` action with `action.error.name === 'AbortError'` so reducers can distinguish intentional cancellation from real failures.

TypeScript: `signal` is typed as `AbortSignal` in `ThunkAPI`, and `RequestInit.signal` accepts `AbortSignal | null`. No additional imports needed — both are browser globals.

**Vue / Laravel Analogy**
In a Vuex action, you'd manage this manually:
```ts
let controller: AbortController | null = null

async fetchTransactions({ commit }, accountId: string) {
  controller = new AbortController()
  const data = await api.fetchTransactions(accountId, controller.signal)
  commit('SET_TRANSACTIONS', data)
}

// in onUnmounted:
controller?.abort()
```
RTK's `thunkAPI.signal` eliminates the manual `AbortController` creation and cleanup — the framework owns the controller, you just forward the signal. In Laravel, HTTP requests are synchronous and server-initiated, so request cancellation is not applicable.

**Common Mistakes**
1. **Forgetting to forward the signal to `fetch`.** Destructuring `{ signal }` from `ThunkAPI` does nothing if you don't pass it to the underlying request. The signal must reach `fetch` to actually cancel the network call.
2. **Not handling `AbortError` in the `rejected` case.** Without the guard, every intentional cancellation writes an error message to the store and potentially shows it to the user — for something that was deliberate.
3. **Aborting thunks that shouldn't be aborted.** Mutations (POST, DELETE) shouldn't be aborted — if a delete is in flight and you abort it, the server may still complete it while the client thinks it was cancelled. Only abort read operations (`GET` fetches).

---

### useEffect cleanup for async operations

**Plain English**
A `useEffect` cleanup function runs when the component unmounts or when the effect's dependencies change before the next run. You've already seen this with event listener cleanup (`document.removeEventListener`). The same pattern applies to async operations: the dispatched action is returned and stored in `promise`, and the cleanup function calls `promise.abort()`. This means "if this component leaves the screen before the fetch finishes, cancel it."

**Technically Speaking**
`dispatch(fetchTransactions(id))` returns an `AsyncThunkAction` — a thenable (Promise-like) object that also has an `.abort(method: string?) => void` method injected by RTK. Storing this return value and returning `() => { promise.abort(); }` from the `useEffect` satisfies React's cleanup contract: the function returned from `useEffect` is called synchronously when the component unmounts or when the effect re-runs due to a dependency change.

The dependency array `[id, dispatch]` means the effect fires and cleans up in two situations: when the component unmounts (user navigates away), and when `id` changes (user navigates from account 1 to account 2 without unmounting `AccountDetail`). Both cases correctly abort the previous request and start a fresh one.

**Vue / Laravel Analogy**
In Vue 3:
```ts
let promise: ReturnType<typeof dispatch> | null = null

onMounted(() => {
  promise = dispatch('transactions/fetch', id.value)
})

onUnmounted(() => {
  promise?.abort()
})

watch(id, (newId) => {
  promise?.abort()
  promise = dispatch('transactions/fetch', newId)
})
```
React's `useEffect` with cleanup compresses all three lifecycle hooks (`onMounted`, `onUnmounted`, `watch`) into one function. The return value of the effect IS the `onUnmounted` equivalent, and the dependency array drives the `watch` equivalent.

**Common Mistakes**
1. **Not storing the dispatch return value.** `dispatch(fetchTransactions(id)); return () => {}` — the cleanup can't call `.abort()` if the reference isn't stored. Always store `const promise = dispatch(...)`.
2. **Calling `await dispatch(...)` before returning the cleanup.** `await` unwraps the Promise before the cleanup can be registered. Don't await; let the cleanup be the abort mechanism instead.
3. **Aborting in the wrong place.** Calling `.abort()` inside the effect body (not in the cleanup) aborts immediately — before the fetch has a chance to complete. The abort must be in the returned cleanup function.

---

## Code Walkthrough

### Forwarding the signal through the API layer
```ts
// transactionsSlice.ts
export const fetchTransactions = createAsyncThunk<Transaction[], string>(
  'transactions/fetchTransactions',
  (accountId, { signal }) => api.fetchTransactions(accountId, signal),
);

// api/index.ts
export async function fetchTransactions(accountId: string, signal?: AbortSignal): Promise<Transaction[]> {
  return request<Transaction[]>(`/accounts/${accountId}/transactions`, { signal });
}
```
The signal travels through two layers: from `ThunkAPI` → `api.fetchTransactions` → `request()` → `fetch`. The `request` helper spreads `init` into `fetch`'s options, so `signal` reaches the browser's native fetch machinery automatically. The `?` makes `signal` optional — `fetchAllTransactions` still calls `api.fetchTransactions` without a signal, and that continues to work unchanged.

### Guarding against AbortError in the reducer
```ts
.addCase(fetchTransactions.rejected, (state, action) => {
  state.loading = false;
  if (action.error.name !== 'AbortError') {
    state.error = action.error.message ?? 'Failed to load transactions';
  }
})
```
`loading` is always set to false — the operation is complete (even if cancelled). The error is only set for genuine failures. Without this guard, navigating away from an account page would leave `state.error = 'The user aborted a request'` in the store, which would display as an error message on the next visit to any account page.

### The effect with cleanup
```ts
useEffect(() => {
  if (!id) return;
  const promise = dispatch(fetchTransactions(id));
  return () => { promise.abort(); };
}, [id, dispatch]);
```
Three lines doing significant work. `const promise` captures the `AsyncThunkAction`. The returned arrow function is React's cleanup contract. When React calls the cleanup (on unmount or when `id` changes), `promise.abort()` fires RTK's internal controller, which fires the signal, which cancels the fetch. The `if (!id) return` guard handles the edge case where `useParams` returns `undefined` — returning `undefined` from the effect (no cleanup needed) rather than dispatching with an empty string.

---

## What to Remember

- `thunkAPI.signal` is an `AbortSignal` RTK creates per-dispatch — forward it to `fetch` via `RequestInit.signal` to get cancellation for free.
- Always guard `rejected` against `'AbortError'` — intentional cancellations should be silent, not treated as errors.
- Store `const promise = dispatch(thunk())` and return `() => promise.abort()` from the `useEffect` — this is the complete abort-on-unmount pattern.
- Only abort read operations (GET fetches). Never abort mutations — the server may complete a DELETE or POST even after the client aborts, leaving the UI out of sync.
- `useEffect` cleanup fires on unmount AND when deps change before re-run — this naturally handles both "navigate away" and "navigate to a different account" cases.
