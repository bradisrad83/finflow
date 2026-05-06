# Write Operations — Pessimistic Updates

## What Was Built
Three async thunks (`createTransactionThunk`, `deleteTransactionThunk`, `createAccountThunk`) that call the Haskell backend before updating the Redux store, replacing the previous sync actions that updated the store immediately without server confirmation.

## File Location
`src/store/transactionsSlice.ts`, `src/store/accountsSlice.ts`, `src/components/AddTransactionForm.tsx`, `src/components/TransactionList.tsx`, `src/components/AddAccountModal.tsx`

---

## Concepts Introduced

### Pessimistic vs. Optimistic Updates

**Plain English**
When a user adds a transaction, there are two strategies for updating the UI:

**Optimistic** (old behavior): Update the store immediately, assume the server will agree. If the server fails, roll back. Fast and snappy, but complex error handling.

**Pessimistic** (new behavior): Wait for the server to confirm before updating the store. If the server fails, the store never changes and you show an error. Slightly slower (user sees a brief loading state), but simpler and safer — the store only ever contains data the server has confirmed.

For financial data, pessimistic is the right default. If the server is down and you optimistically add a transaction, the user thinks it worked — but it didn't, and their balance is wrong. With pessimistic updates, the form stays visible and shows an error. Nothing in the UI changes until the server says it worked.

**Technically Speaking**
The distinction lives in when `dispatch` updates the store relative to the API call:

- **Optimistic**: `dispatch(syncAction(data))` first, then `api.create(data)` — store changes before the network. Rollback on failure requires a compensating action.
- **Pessimistic**: `await api.create(data)` first, then the `fulfilled` reducer fires — store only changes after the network confirms.

RTK's `createAsyncThunk` is naturally pessimistic: the `fulfilled` action only dispatches when the `payloadCreator` Promise resolves. A rejection dispatches `rejected` and leaves the store unchanged. There's no built-in optimistic support — optimistic patterns require manual state management (tracking a "pending" version of the data separately from the "confirmed" version).

**Vue / Laravel Analogy**
In a Vue/Pinia store:
```ts
// Pessimistic (what we now do):
const create = async (data) => {
  const result = await api.createTransaction(data); // wait for server
  transactions.value.push(result);                  // then update state
};

// Optimistic (what we had before):
const create = async (data) => {
  transactions.value.push(data);    // update state immediately
  try {
    await api.createTransaction(data);
  } catch {
    transactions.value.pop();       // rollback on failure
  }
};
```

In Laravel, this isn't a relevant distinction — the server IS the state. A failed DB insert just returns a 422 and the client re-renders. The optimistic/pessimistic tradeoff only exists in stateful UIs that maintain their own copy of server data.

**Common Mistakes**
- **Using pessimistic updates for actions that must feel instant.** Toggling a "liked" state, moving a drag-and-drop item, or switching tabs should be optimistic — the latency of a network round trip is perceptible and breaks the UX. Reserve pessimistic updates for durable writes (financial transactions, account creation, deletion) where accuracy matters more than speed.
- **Not disabling the submit button during the pending state.** Without a `submitting` flag, rapid clicks send multiple requests. The server might succeed twice, creating duplicate entries.

---

### `.unwrap()` — Per-Component Error Handling for Thunks

**Plain English**
`dispatch(someThunk())` returns a Promise, but it's a peculiar one: it always resolves, even when the thunk's API call fails. RTK catches any error thrown inside the `payloadCreator`, dispatches a `rejected` action, and resolves the dispatch Promise with that rejected action — no throw. This means a bare `try/catch` around `dispatch(...)` would never catch a thunk failure.

`.unwrap()` opts out of that behavior. `dispatch(someThunk()).unwrap()` returns a new Promise that resolves with the payload on success and *throws* on rejection — the standard JavaScript behavior you'd expect. With `.unwrap()`, `try/catch` works correctly and you can show error state, reset form state, or block navigation on failure.

**Technically Speaking**
`dispatch(createAsyncThunk(...))` returns a `Promise<PayloadAction<Fulfilled> | PayloadAction<Rejected>>`. The RTK dispatch wrapper catches errors in the `payloadCreator` and calls `rejectWithValue` or serializes the error — it never re-throws. The dispatched action is always the resolved value.

`.unwrap()` is defined on the returned action object: if `action.meta.requestStatus === 'fulfilled'`, it returns `action.payload`; if `'rejected'`, it throws `action.payload ?? action.error`. The TypeScript return type of `dispatch(thunk()).unwrap()` is `Promise<Returned>` — typed to the thunk's return type, not `void`.

This pattern keeps error handling at the call site (the component) rather than in the slice. The slice's `rejected` reducer is still for global state (e.g., setting a `error` field for persistent display); `.unwrap()` is for transient component-local error UI (form validation messages, modal error states).

**Vue / Laravel Analogy**
In a Vue/Pinia store action, the async function throws naturally:
```ts
// Pinia — throws on failure, no special unwrapping needed
const create = async (data) => {
  const result = await api.createTransaction(data); // throws on 4xx/5xx
  transactions.value.push(result);
};

// Component:
try {
  await transactionStore.create(data);
  resetForm();
} catch (e) {
  showError(e.message);
}
```

Pinia actions are plain async functions — errors propagate normally. RTK adds a layer of error interception for the `rejected` action lifecycle, which is why `.unwrap()` is needed to restore normal throw behavior at the call site. This is the price of Redux's architectural separation between "async work" (thunks) and "state changes" (reducers).

In Laravel: a controller's `store()` method throws a `ValidationException` which the framework catches and returns as a 422. The client's `try/catch` around `axios.post(...)` catches it. Same pattern, different layer.

**Common Mistakes**
- **Using `dispatch(thunk()).then(action => { if (action.rejected...) })`.** This works but is verbose. `.unwrap()` + `try/catch` is cleaner and more idiomatic.
- **Expecting `.unwrap()` to change slice behavior.** The `rejected` extraReducers case still fires when a thunk fails, even when `.unwrap()` is used. `.unwrap()` only changes what happens at the call site — it doesn't prevent the reducer from running.
- **Not calling `.unwrap()` when you need to reset form state on success.** Without it, the `.then()` or `await` after `dispatch(thunk())` always runs — even on failure. You'd reset the form even after a failed API call. `.unwrap()` ensures the success path only runs on actual success.

---

### Thunk Returning Its Input — The Delete Pattern

**Plain English**
`deleteTransactionThunk` takes a full `Transaction`, calls `api.deleteTransaction(transaction.id)`, and then returns the original transaction. The API returns nothing (204), but the `extraReducers` in both slices need the transaction data: `transactionsSlice` needs the `id` to filter it out; `accountsSlice` needs `accountId`, `amount`, and `type` to reverse the balance delta. By returning the input transaction as the payload, both slice reducers get the data they need from `action.payload`.

This is a common pattern for delete thunks: the API only needs an id, but the store needs more context to clean up correctly.

**Technically Speaking**
```ts
export const deleteTransactionThunk = createAsyncThunk<Transaction, Transaction>(
  'transactions/delete',
  async (transaction) => {
    await api.deleteTransaction(transaction.id);
    return transaction;
  },
);
```

`<Transaction, Transaction>` — the first generic is `Returned` (what `fulfilled.payload` will be typed as), the second is `ThunkArg` (what the thunk creator accepts). The `payloadCreator` awaits the void API call, then returns the original `transaction`. RTK dispatches `{ type: 'transactions/delete/fulfilled', payload: transaction }`. Both `transactionsSlice` and `accountsSlice` handle `deleteTransactionThunk.fulfilled` and read `action.payload` for the data they need.

The alternative — encoding context in the API call's response — would require the Haskell DELETE endpoint to return the deleted transaction body. That's non-standard (DELETE typically returns 204 with no body) and would couple the API design to Redux's needs.

**Vue / Laravel Analogy**
In a Pinia store, you'd hold the transaction in local scope and use it after the API call:
```ts
const remove = async (transaction: Transaction) => {
  await api.deleteTransaction(transaction.id);
  // transaction is still in scope — use it to update state
  transactions.value = transactions.value.filter(t => t.id !== transaction.id);
  account.balance -= transaction.type === 'credit' ? transaction.amount : -transaction.amount;
};
```

Pinia keeps it in local function scope. Redux separates the thunk from the reducer, so the data has to travel through the action's payload. Same logic, different plumbing.

**Common Mistakes**
- **Returning just the `id` from the delete thunk.** `action.payload = "t1"` is enough for `transactionsSlice` to filter, but `accountsSlice` can't reverse the balance without `amount`, `type`, and `accountId`. Return the full object.
- **Assuming `action.meta.arg` is equivalent.** `action.meta.arg` holds the original thunk argument and is available in `fulfilled` reducers — you could read `action.meta.arg.id` instead of `action.payload.id`. But `meta.arg` is always the raw input; `payload` is the canonical return. Use `payload` for what the thunk "produced" and `meta.arg` only when you need the original input for scoping (like the `accountId` in `fetchTransactions`).

---

## Code Walkthrough

### `transactionsSlice.ts` — write thunks

```ts
export const createTransactionThunk = createAsyncThunk<Transaction, Transaction>(
  'transactions/create',
  (transaction) => api.createTransaction(transaction),
);

export const deleteTransactionThunk = createAsyncThunk<Transaction, Transaction>(
  'transactions/delete',
  async (transaction) => {
    await api.deleteTransaction(transaction.id);
    return transaction;
  },
);
```

Both are `<Transaction, Transaction>` — they receive a `Transaction` and their `fulfilled` payload is also a `Transaction`. `createTransactionThunk` returns whatever the server echoes back (the created record). `deleteTransactionThunk` returns the input unchanged since the server returns nothing. The payloadCreator for `create` is a one-liner (just delegate to the API function); `delete` needs two lines because it must discard the void response and explicitly return the transaction.

### `transactionsSlice.ts` — fulfilled reducers

```ts
.addCase(createTransactionThunk.fulfilled, (state, action) => {
  state.transactions.push(action.payload);
})
.addCase(deleteTransactionThunk.fulfilled, (state, action) => {
  state.transactions = state.transactions.filter((t) => t.id !== action.payload.id);
})
```

These mirror what `addTransaction` and `removeTransaction` sync reducers do — they're the pessimistic versions. The sync actions (`addTransaction`, `removeTransaction`) remain exported because `accountsSlice.extraReducers` still uses them to react to optimistic balance adjustments in other contexts (like the undo flow). The thunk fulfilled cases handle the server-confirmed path.

### `accountsSlice.ts` — cross-slice balance wiring

```ts
.addCase(createTransactionThunk.fulfilled, (state, action) => {
  const { accountId, amount, type } = action.payload;
  const account = state.accounts.find((a) => a.id === accountId);
  if (account) {
    account.balance += type === 'credit' ? amount : -amount;
  }
})
.addCase(deleteTransactionThunk.fulfilled, (state, action) => {
  const { accountId, amount, type } = action.payload;
  const account = state.accounts.find((a) => a.id === accountId);
  if (account) {
    account.balance -= type === 'credit' ? amount : -amount;
  }
})
```

Same cross-slice reactivity pattern as before — `accountsSlice` listens to actions it doesn't own. Now it listens to the thunk fulfilled actions instead of the sync actions. Both slices update simultaneously when a single action fires. The balance math is identical to the sync action handlers.

### `AddTransactionForm.tsx` — `.unwrap()` pattern

```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!isValid || submitting) return;
  setSubmitting(true);
  setSubmitError(null);
  try {
    await dispatch(createTransactionThunk({ ... })).unwrap();
    setDescription('');
    setAmount('');
    // ... reset
  } catch {
    setSubmitError('Failed to add transaction. Please try again.');
  } finally {
    setSubmitting(false);
  }
}
```

`setSubmitting(true)` before the dispatch, `setSubmitting(false)` in `finally` — the `finally` block runs whether the Promise resolves or rejects, so the button always re-enables. The form reset only happens on success (inside `try`, after `.unwrap()`). The error only shows on failure (inside `catch`). Without `.unwrap()`, the `catch` would never fire — the dispatch always resolves.

### `TransactionList.tsx` — async delete with toast

```ts
const handleDelete = useCallback(
  async (transaction: Transaction) => {
    try {
      await dispatch(deleteTransactionThunk(transaction)).unwrap();
      toastDispatch({ type: 'show', transaction });
    } catch {
      // transaction not deleted — no toast
    }
  },
  [dispatch],
);
```

The toast only appears if the delete succeeded. Previously it appeared instantly (optimistic). Now: delete button clicked → API call → success → toast appears. Failure is silent from the user's perspective — the transaction stays in the list, no error message. This is acceptable for a delete failure; in production you'd add error feedback.

---

## What to Remember

- Pessimistic updates: await the API, then the `fulfilled` reducer updates the store. The store only ever contains server-confirmed data. Use this for durable writes (financial data, deletion); use optimistic for latency-sensitive UI interactions.
- `.unwrap()` is required to use `try/catch` with thunk dispatches. Without it, the dispatch Promise always resolves (RTK catches all errors internally). `.unwrap()` re-throws on rejection so normal error handling works.
- Delete thunks should return their input (`return transaction`) even though the API returns nothing. The `fulfilled` reducers in both slices need the full transaction data — `transactionsSlice` for filtering, `accountsSlice` for balance reversal.
- Cross-slice balance wiring: `accountsSlice.extraReducers` now listens to `createTransactionThunk.fulfilled` and `deleteTransactionThunk.fulfilled` in addition to the sync `addTransaction`/`removeTransaction` actions. Same pattern, new trigger.
- Always pair `setSubmitting(true)` with `setSubmitting(false)` in a `finally` block — never in just `try` or `catch`. If the API call throws and you're only resetting in `try`, the button stays disabled forever.
