# createAsyncThunk — Async Redux Lifecycle

## What Was Built
A `refreshBalances` async thunk that simulates a 1-second bank API call and updates each account's balance, with the accounts slice tracking `loading` and `error` state via three lifecycle reducers (`pending` / `fulfilled` / `rejected`) — surfaced in the UI as a "Refresh balances" button on the Dashboard.

## File Location
`src/store/accountsSlice.ts`, `src/components/AccountsOverview.tsx`

---

## Concepts Introduced

### createAsyncThunk

**Plain English**
`createAsyncThunk` is a factory for async work in Redux. You give it a name and an async function; it returns an action creator that, when dispatched, runs your async work and automatically dispatches three other actions along the way: one when the work starts, one when it succeeds, one when it fails. Your slices listen to those actions to flip loading flags, save results, or record errors. You never write `dispatch({ type: 'pending' })` yourself — the thunk wraps the entire lifecycle.

**Technically Speaking**
`createAsyncThunk(typePrefix, payloadCreator)` returns a special action creator that, when called and dispatched, triggers the following sequence:

1. Dispatches `{ type: '<prefix>/pending', meta: { requestId, arg } }` immediately.
2. Awaits `payloadCreator(arg, thunkAPI)`.
3. On success: dispatches `{ type: '<prefix>/fulfilled', payload: <return value>, meta }`.
4. On failure: dispatches `{ type: '<prefix>/rejected', error: <serialized error>, meta }`.

The returned action creator has three properties: `.pending`, `.fulfilled`, and `.rejected` — each is a typed action matcher you can pass to `builder.addCase` in `extraReducers`. Generic types let you specify the return type (`<Returned>`), the argument type (`<Returned, ThunkArg>`), and a `ThunkApiConfig` for things like custom dispatch typing or rejection values.

The thunk returns a Promise from `dispatch`, so you can `await` it in components if you need to chain logic — but it's usually better to react to state changes via selectors rather than awaiting.

**Vue / Laravel Analogy**
In Pinia, the equivalent is an async action method on a store:

```ts
const useAccountsStore = defineStore('accounts', () => {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const refreshBalances = async () => {
    loading.value = true;
    try {
      const data = await api.fetch();
      // apply data
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  };
  return { loading, error, refreshBalances };
});
```

The Pinia version writes the lifecycle by hand. RTK's thunk auto-emits the lifecycle as actions, which gives you a uniform pattern across every async operation in the app — every thunk has `.pending` / `.fulfilled` / `.rejected`, every slice listens the same way. More boilerplate per thunk in the slice, less custom plumbing per action.

In Laravel, this is closer to a queued job that fires events at each stage (`JobStarted`, `JobCompleted`, `JobFailed`) — listeners then react to those events. The "lifecycle as broadcast events" mental model carries over directly.

**Common Mistakes**
- **Forgetting that the thunk returns a Promise.** `dispatch(refreshBalances())` returns a Promise that resolves to a fulfilled or rejected action. If you `.then()` on it expecting your raw payload, you'll get the action object instead. Use `.unwrap()` to get the payload (or throw on rejection).
- **Throwing inside `payloadCreator` and expecting the slice to crash.** It won't — the error is caught by RTK, serialized, and dispatched as `rejected.error`. The reducer keeps running; the error must be handled in `extraReducers` or it's silently lost.
- **Putting unrelated state mutations in the thunk.** The thunk's job is the async work — fetching, parsing, returning data. Side effects on the store happen via the `pending`/`fulfilled`/`rejected` reducers, not by dispatching other actions from inside the thunk.

---

### The data + loading + error Triplet

**Plain English**
Any state that comes from an async operation needs three fields together: the **data** itself, a **loading** flag for "is the request in flight?", and an **error** for "did it fail and why?" Without all three, the UI can't show the right thing at the right time. Loading without data → spinner. Error without data → error message. Data with no loading or error → normal display. This pattern shows up in literally every Redux app, every Pinia store, every Vuex module — it's the universal shape of async state.

**Technically Speaking**
The triplet enables a small state machine:

| loading | error | data | UI shows                       |
|---------|-------|------|--------------------------------|
| true    | null  | any  | spinner / disabled controls    |
| false   | null  | yes  | normal display                 |
| false   | str   | any  | error message (+ stale data)   |

The `pending` reducer flips `loading` true and clears `error` (so a previous error doesn't linger across retries). The `fulfilled` reducer flips `loading` false and writes the new data. The `rejected` reducer flips `loading` false and writes the error message — leaving the previous data in place so the UI doesn't blank out on a transient failure.

In TypeScript strict mode, `error: string | null` is the standard shape — `null` means "no error currently." Some apps store the entire serialized error object instead, but a string message is enough for most UI needs.

**Vue / Laravel Analogy**
Pinia stores typically have the same triplet (`loading`, `error`, `data`), often as separate refs. Vue Query / TanStack Query bakes the pattern in directly (`isLoading`, `isError`, `data`). In Laravel, this is the request lifecycle: a controller action's response *is* the data on success, the exception handler produces the error response, and "loading" only exists client-side.

**Common Mistakes**
- **Skipping the loading flag.** If you only have `data` and `error`, you can't distinguish "haven't loaded yet" from "loaded but empty." Loading is a separate dimension from both.
- **Wiping data on rejection.** Failures should preserve the last-known-good data so the UI can keep functioning. Only clear data when starting fresh (e.g., switching accounts).
- **Forgetting to clear the error on retry.** If `pending` doesn't reset `error`, a successful retry leaves a stale error message in state, contradicting the success.

---

### Dispatching a Thunk from a Component

**Plain English**
Dispatching an async thunk from a component looks identical to dispatching a regular action — you call `dispatch(refreshBalances())`. The difference is invisible at the call site: the thunk middleware (built into `configureStore` by default) sees that the dispatched value is actually a function, runs it, and the function manages the async lifecycle internally. Your component code stays free of `await`s, try/catch, and Promise plumbing.

**Technically Speaking**
`refreshBalances()` (calling the thunk creator) returns a thunk action — actually a function that takes `(dispatch, getState, extra)` as arguments. The Redux thunk middleware intercepts dispatched values that are functions and calls them with those args, instead of forwarding them to reducers. Inside that function, RTK dispatches the lifecycle actions and runs your `payloadCreator`.

From the component's perspective: `useDispatch<AppDispatch>()` gives you a properly-typed dispatch function. Calling `dispatch(refreshBalances())` returns the lifecycle Promise, but you can ignore the return value and just react to state via selectors. The button's `disabled` and label come from `useSelector(state.accounts.loading)` — that's how the UI stays in sync without component-local async state.

**Vue / Laravel Analogy**
In Pinia: `accountsStore.refreshBalances()` — same simplicity, slightly different mental model (calling a method directly versus dispatching an action). The two-step "create action then dispatch" feels weirder than a method call, but it's what enables the middleware-based architecture: the same call could be intercepted by logging, retry, or batching middleware without changing the dispatch site.

In Laravel, this is closer to dispatching a queued job: `RefreshBalances::dispatch()` — fire-and-forget at the call site, lifecycle handled elsewhere.

**Common Mistakes**
- **`dispatch(refreshBalances)` (forgetting the parens).** Without the parens, you're dispatching the thunk creator itself, not a thunk action. Redux will reject it.
- **Tracking loading in component state instead of the slice.** A `useState` flag that toggles around the dispatch duplicates state and goes stale on remounts. The slice's `loading` is the single source of truth.
- **Using `await` to gate UI updates.** If you `await dispatch(...)` and then call `setSomething(...)`, you've created a parallel state path. Drive UI off slice state via selectors instead — the component re-renders automatically when the slice updates.

---

## Code Walkthrough

### `accountsSlice.ts` — the thunk

```ts
export const refreshBalances = createAsyncThunk<{ id: string; balance: number }[]>(
  'accounts/refreshBalances',
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return [
      { id: '1', balance: Math.round((10000 + Math.random() * 5000) * 100) / 100 },
      // ...
    ];
  },
);
```

The generic `<{ id: string; balance: number }[]>` declares what `fulfilled.payload` will look like — TypeScript uses this to type the `action.payload` parameter when you handle `refreshBalances.fulfilled`. The string `'accounts/refreshBalances'` is the action type prefix. RTK appends `/pending`, `/fulfilled`, `/rejected` to it, giving you three uniquely-named lifecycle actions.

The body is a regular async function. In a real app this would be `await fetch('/api/balances').then(r => r.json())`. The `setTimeout` simulates network latency so you can see the loading state.

### `accountsSlice.ts` — the lifecycle reducers

```ts
.addCase(refreshBalances.pending, (state) => {
  state.loading = true;
  state.error = null;
})
.addCase(refreshBalances.fulfilled, (state, action) => {
  state.loading = false;
  action.payload.forEach((update) => {
    const account = state.accounts.find((a) => a.id === update.id);
    if (account) {
      account.balance = update.balance;
    }
  });
})
.addCase(refreshBalances.rejected, (state, action) => {
  state.loading = false;
  state.error = action.error.message ?? 'Failed to refresh balances';
});
```

Three reducers, one per lifecycle stage. Notice the chaining: `builder.addCase(...).addCase(...)` — the builder is fluent. The `pending` case clears `error` so a stale message doesn't linger across retries. The `fulfilled` case applies updates in place (Immer makes the apparent mutation immutable). The `rejected` case has `?? 'Failed to refresh balances'` because `action.error.message` can be undefined for non-Error throws.

### `AccountsOverview.tsx` — the dispatch

```tsx
<button
  type="button"
  onClick={() => dispatch(refreshBalances())}
  disabled={loading}
  className={`... ${loading ? 'bg-gray-200 ...' : 'bg-white ...'}`}
>
  {loading ? 'Refreshing…' : 'Refresh balances'}
</button>
```

Three pieces driven by one slice field: the click dispatches the thunk, `disabled={loading}` blocks rapid double-clicks, the className and label both swap based on the same `loading` boolean. No component-local state, no duplicate truth — the button is a pure projection of `state.accounts.loading`.

---

## What to Remember

- `createAsyncThunk(typePrefix, asyncFn)` auto-dispatches `pending` / `fulfilled` / `rejected`. You react via `extraReducers`, not by dispatching them yourself.
- Async state needs three fields together: data, loading, error. Loading without error means "in progress"; error without loading means "last attempt failed."
- Clear `error` on `pending` so stale messages don't linger across retries; preserve `data` on `rejected` so the UI keeps functioning.
- Drive UI from slice state via selectors. Don't track loading in component state — that's parallel truth.
- Calling `dispatch(thunk())` returns a Promise. You can `await` it for chaining, but reacting to state via selectors is usually cleaner.
