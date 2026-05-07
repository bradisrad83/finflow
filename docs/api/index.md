# API Layer — Transport Boundary

## What Was Built
A `src/api/index.ts` module that centralizes every network operation behind typed async functions — currently mocked — so that wiring the Haskell backend means replacing function bodies in one file, with no changes to slices or components.

## File Location
`src/api/index.ts`, `src/store/accountsSlice.ts`, `src/store/transactionsSlice.ts`

---

## Concepts Introduced

### The Repository / Transport Boundary Pattern

**Plain English**
Right now, "fetching data" means `setTimeout` mocks scattered inside thunks. In a real app, it means `fetch('/api/...')`, parsing JSON, checking for errors, attaching auth headers. If that logic lives directly in a thunk, then when the backend URL changes, or the auth scheme changes, or you switch from REST to GraphQL, you're hunting through every slice to find every `fetch` call. The API layer is the fix: one file owns all transport concerns. Slices just call `api.fetchBalances()` and get back a typed Promise. They don't know or care whether that came from a real server, a mock, or a cache.

This is a separation of concerns, not a React or Redux concept. It's an architectural pattern that shows up in every mature codebase regardless of stack.

**Technically Speaking**
The module exports:
- A private `request<T>(path, init?)` function — the single `fetch` chokepoint. All specific functions call through it. It sets default headers, checks `res.ok`, throws a typed `ApiError` on failure, and returns `res.json() as Promise<T>`.
- One `async function` per backend operation, typed with exact return types matching the app's `types/index.ts` interfaces.
- An `ApiError` class that extends `Error` with a `status: number` field.

Each exported function currently has a mock body (a `sleep()` call returning hardcoded data). The real `request<T>(...)` call sits commented out directly above the mock. To go live: delete the mock lines, uncomment the request line. The signature doesn't change.

`import.meta.env.VITE_API_URL` is Vite's typed env var system. Only variables prefixed `VITE_` are bundled into the client; the rest are server-only. Set `VITE_API_URL=http://localhost:8080` in `.env.local` when the Haskell server is running.

**Vue / Laravel Analogy**
This is the **Repository pattern** from Laravel. A controller never calls `DB::table('accounts')->get()` directly — it calls `$this->accountRepository->all()`. The repository owns the data-access contract; the controller owns the HTTP response logic. If you swap MySQL for an API call, only the repository changes.

In a Vue/Pinia app, this is typically an `src/services/api.ts` or `src/repositories/AccountRepository.ts` that wraps `axios` or `fetch`. Pinia stores call the service; components call the store. The layering is identical. React/Redux just spells it differently: components dispatch thunks, thunks call the API module, the API module calls the network.

In Haskell (relevant for Phase 2), this maps to a typeclass or record-of-functions that abstracts over the data source — often called a "capability" or "effect" interface. The servant client library generates exactly this pattern from an API type definition.

**Common Mistakes**
- **Putting `fetch` calls directly in thunks.** Works fine until you have ten thunks and the auth token format changes — then it's a ten-file edit. One `request()` function, one edit.
- **Exporting the `request` function itself.** It's an implementation detail. If callers use `request` directly, you lose the ability to change the internal transport mechanism without breaking callers. Keep it private; export only named, typed operations.
- **Using `any` at the JSON parse boundary.** `res.json()` returns `Promise<any>` — TypeScript can't know the shape of network data. The cast `as Promise<T>` is the correct pattern at this boundary. It's a deliberate assertion ("I know what this endpoint returns") rather than an accidental `any`. Always pair it with a validation step (Zod, manual checks) in production — the backend can lie.

---

### ApiError — Typed Errors Across the Boundary

**Plain English**
When `fetch` gets a non-2xx response (a 404, 500, etc.), `res.ok` is false but no exception is thrown — JavaScript's `fetch` only rejects on network failure, not on HTTP error codes. Without explicit handling, a 500 response would silently pass as "success" with an error body. `ApiError` is the fix: a custom error class that wraps both the HTTP status code and the message, thrown when `res.ok` is false. Callers (thunks) don't need to check status codes — they just catch `ApiError` and get a typed object with everything they need.

**Technically Speaking**
```ts
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
```

`extends Error` gives the class a proper stack trace and makes it pass `instanceof Error` checks. `public readonly status` is a TypeScript constructor shorthand — it declares and assigns the field in one expression. `this.name = 'ApiError'` overrides the default `"Error"` name so stack traces and `error.name` checks are identifiable.

When `createAsyncThunk` catches a thrown error, it serializes it into `action.error` (a `SerializedError` with `message`, `name`, `code` fields). So `action.error.message` in a `rejected` handler carries `ApiError.message`. The `status` field is lost in serialization — if you need it in the reducer, use `rejectWithValue` instead of throwing.

**Vue / Laravel Analogy**
In Laravel, this is a custom exception class: `class ApiException extends RuntimeException { public int $status; ... }`. Laravel's exception handler catches it and returns the appropriate HTTP response. The shape is identical — typed exception with a status field, thrown at the transport boundary, caught at the business-logic layer.

In Vue/Axios apps, the equivalent is Axios's `AxiosError` which carries `response.status` and `response.data` — same concept, built into the library. With bare `fetch`, you build it yourself.

**Common Mistakes**
- **Not setting `this.name`.** Without it, `instanceof ApiError` still works, but `error.name` reads `"Error"` — unhelpful in logs. Always set `this.name` to the class name in custom Error subclasses.
- **Assuming thunk `action.error` carries custom fields.** RTK serializes thrown errors to a plain `SerializedError` object — only `message`, `name`, `code`, and `stack` survive. If you need `status` in a reducer, use `return rejectWithValue({ status, message })` in the thunk's payload creator and handle it in the `rejected` case via `action.payload` instead of `action.error`.

---

### Thunk as a One-Line Delegate

**Plain English**
Before the API layer, `refreshBalances` had 8 lines of mock logic inside the thunk body. After:

```ts
export const refreshBalances = createAsyncThunk<{ id: string; balance: number }[]>(
  'accounts/refreshBalances',
  () => api.fetchBalances(),
);
```

One line. The thunk's only job is to call the API function and return the result. The async lifecycle (pending/fulfilled/rejected), the state transitions, and the network contract are all handled in their respective layers. This is what "separation of concerns" looks like at the Redux level: the thunk is a bridge, not a logic container.

**Technically Speaking**
`createAsyncThunk`'s payload creator can return a Promise directly — it doesn't need to `await` it. `() => api.fetchBalances()` returns the Promise that `api.fetchBalances()` returns. RTK awaits that Promise internally and dispatches the lifecycle actions based on whether it resolves or rejects. There's no functional difference between `async () => { return await api.fetchBalances() }` and `() => api.fetchBalances()` — the latter is just shorter.

`fetchTransactions` demonstrates the two-generic form:
```ts
createAsyncThunk<Transaction[], string>(
  'transactions/fetchTransactions',
  (accountId) => api.fetchTransactions(accountId),
)
```
`<Transaction[], string>` declares the return type and the argument type. TypeScript uses these to type `action.payload` in `fulfilled` and the argument passed to the thunk creator at the call site.

**Vue / Laravel Analogy**
In Pinia, the equivalent is a store action that calls a service:
```ts
const fetchTransactions = async (accountId: string) => {
  loading.value = true;
  try {
    transactions.value = await transactionService.fetch(accountId);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};
```
The Pinia version writes the lifecycle by hand. RTK's thunk with a one-line delegate gets the same result: the lifecycle is automatic, the API call is in the service layer.

**Common Mistakes**
- **Putting business logic in the thunk payload creator.** The payload creator should be thin — call the API, return the result. Any transformation of the data belongs in the `fulfilled` reducer (which has access to the current state) or in the API function itself.
- **Not adding `loading` / `error` to the slice when adding a new thunk.** `fetchTransactions` needed `loading` and `error` added to `TransactionsState`. Forgetting this means the UI has no way to show a spinner or surface errors from the new async operation.

---

## Code Walkthrough

### `src/api/index.ts` — the `request` chokepoint

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  return res.json() as Promise<T>;
}
```

`RequestInit` is the TypeScript type for `fetch`'s second argument — method, headers, body, credentials, etc. Spreading `...init` after the explicit `headers` merge means callers can override anything, but the Content-Type default is always present unless explicitly removed.

`!res.ok` covers every non-2xx status (400, 404, 500, etc.). `await res.text()` reads the body as plain text — safe for any error format the backend might return (JSON, HTML error page, empty body). The `ApiError` gets the status code and body text.

`res.json() as Promise<T>` — `res.json()` returns `Promise<any>`. The `as Promise<T>` cast is the trust boundary: we're asserting the backend returns what we declared. This is the one intentional type assertion in the codebase.

### The mock-to-real swap pattern

```ts
export async function fetchBalances(): Promise<{ id: string; balance: number }[]> {
  // return request<{ id: string; balance: number }[]>('/accounts/balances');
  await sleep(1000);
  return [
    { id: '1', balance: round(10000 + Math.random() * 5000) },
    ...
  ];
}
```

The commented-out line is the real implementation. The mock below it is temporary. When the Haskell `/accounts/balances` endpoint exists: delete lines 3–7, uncomment line 1. The function's return type, the thunk that calls it, the reducer that handles the result — none of that changes.

### `void accountId` in unused mock parameters

```ts
export async function fetchTransactions(accountId: string): Promise<Transaction[]> {
  // return request<Transaction[]>(`/accounts/${accountId}/transactions`);
  await sleep(300);
  void accountId;
  return [];
}
```

The mock doesn't use `accountId`, but TypeScript in strict mode flags unused parameters. `void expr` evaluates and discards an expression — it's the standard way to silence the "unused variable" warning without prefixing with `_`. It's explicit: "yes, I know this parameter exists, I'm intentionally not using it in the mock."

### `transactionsSlice.ts` — the new thunk

```ts
export const fetchTransactions = createAsyncThunk<Transaction[], string>(
  'transactions/fetchTransactions',
  (accountId) => api.fetchTransactions(accountId),
);
```

`<Transaction[], string>` — two type arguments. First is what `fulfilled.payload` will be typed as. Second is the type of the argument passed to the thunk creator: `dispatch(fetchTransactions('1'))` — TypeScript enforces that `'1'` is a string.

The `fulfilled` reducer replaces the entire transactions array:
```ts
.addCase(fetchTransactions.fulfilled, (state, action) => {
  state.loading = false;
  state.transactions = action.payload;
})
```

This is the correct backend-integration behavior: the server is the source of truth, so its response replaces whatever was in the store. The seed data in `initialState` remains until this thunk is dispatched — which happens when the backend is live and a component adds the `useEffect` call.

---

## What to Remember

- One API module, one `request()` function, every `fetch` call goes through it. Auth headers, error handling, base URL — one place to change, nothing else breaks.
- Each exported function has the real `request<T>(...)` call commented out above the mock. Going live = uncomment + delete mock. Signatures and return types stay the same; nothing else in the app changes.
- `fetch` only rejects on network failure, not HTTP errors. Always check `res.ok` and throw on non-2xx responses. `ApiError` with a `status` field is the typed way to carry that information.
- Thunks should be one-line delegates: `() => api.fetchSomething()`. Logic belongs in the API function (transport) or the reducer (state transition), not in the thunk body.
- `fetchTransactions` exists in the slice but nothing dispatches it yet — intentionally. The `useEffect` call in `AccountDetail` to dispatch it on mount is the first Haskell-wiring step.
