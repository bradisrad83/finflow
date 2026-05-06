# Optimistic Updates (optimistic-add)

## What Was Built
`createTransactionThunk` now writes the transaction to the store immediately in its `pending` case, skips the `fulfilled` case (already present), and removes it in `rejected` — so new transactions appear in the list instantly and disappear only if the API fails.

## File Location
`src/store/transactionsSlice.ts`, `src/components/AddTransactionForm.tsx`

---

## Concepts Introduced

### Optimistic updates — write first, confirm later

**Plain English**
The default async flow is: wait for the server → if it succeeds, update the UI. Optimistic updates flip this: update the UI immediately as if the operation already succeeded, make the API call in the background, and only undo the UI change if the server reports a failure. The name comes from the assumption that the operation will *probably* succeed — you're "optimistic" that it will work. For a local app connected to a local backend, this assumption is almost always correct, and the result is a UI that feels instant instead of showing a spinner on every user action.

**Technically Speaking**
`createAsyncThunk` fires three actions in sequence: `pending` (before the Promise starts), `fulfilled` (on resolve), `rejected` (on reject). The `pending` action carries `action.meta.arg` — the original argument passed to the thunk, typed as the second type parameter of `createAsyncThunk<ReturnType, ArgType>`. For `createAsyncThunk<Transaction, Transaction>`, `action.meta.arg` is typed as `Transaction` in both `pending` and `rejected`. This allows the reducer to insert the provisional item in `pending` and remove it by ID in `rejected` without any additional state. The `fulfilled` case becomes a no-op in the transactions slice since the item is already present — though other slices (e.g. `accountsSlice`) can still react to `fulfilled` to update derived state like account balances.

**Vue / Laravel Analogy**
In a Vuex action, you'd implement this pattern manually:
```ts
async createTransaction({ commit }, transaction) {
  commit('ADD_TRANSACTION', transaction)   // optimistic write
  try {
    await api.createTransaction(transaction)
    // success — nothing to do, already in store
  } catch {
    commit('REMOVE_TRANSACTION', transaction.id)  // rollback
  }
}
```
Redux Toolkit's `pending`/`rejected` lifecycle formalizes this pattern into the reducer layer, removing the rollback logic from the action creator. In Laravel, optimistic updates don't exist at the server level — every controller action either succeeds or fails, and the client observes the result. The concept is purely a client-side UX pattern.

**Common Mistakes**
1. **Forgetting to change `fulfilled` to a no-op.** If `pending` inserts the item and `fulfilled` also inserts it (the old behavior), you get a duplicate in the list. The `fulfilled` case must either be removed or explicitly skip the insert when the item is already present.
2. **Using `action.payload` in `rejected` instead of `action.meta.arg`.** In a rejected case, `action.payload` is the serialized error (or undefined). The original argument is in `action.meta.arg`.
3. **Optimistically updating derived state you can't easily roll back.** Optimistic balance updates require careful rollback logic. For FinFlow we left the balance update in `fulfilled` — the transaction appears instantly, the balance updates when confirmed. This is a deliberate tradeoff, not an oversight.

---

### action.meta.arg — accessing the original thunk argument in reducers

**Plain English**
When you call `dispatch(createTransactionThunk(transaction))`, the `transaction` object is the argument. Redux Toolkit makes that argument available on every action the thunk fires — `pending`, `fulfilled`, and `rejected` — as `action.meta.arg`. This is what makes rollback possible: in the `rejected` case, you need to know *which* transaction failed so you can remove it. You don't need to store it separately; the framework hands it back to you.

**Technically Speaking**
`createAsyncThunk` attaches the thunk argument to every dispatched action under `meta.arg`. TypeScript infers this from the second type parameter: `createAsyncThunk<ReturnType, ArgType>` means `action.meta.arg` is typed as `ArgType` in all three action cases. In the `pending` and `rejected` cases, `action.meta.arg` is the only way to access the original argument — `action.payload` in `pending` is `undefined`, and in `rejected` it's the serialized error. The `fulfilled` case also has `action.meta.arg`, but there `action.payload` (the server's response) is also available.

**Vue / Laravel Analogy**
There's no direct equivalent in Vue or Laravel because this is a framework-level mechanism for passing data between lifecycle phases of a single async operation. The closest analogy is capturing a closure variable in a Vuex action:
```ts
async addThing({ commit }, item) {
  const captured = item  // "meta.arg" equivalent — captured before the await
  commit('ADD', captured)
  try { await api.add(captured) }
  catch { commit('REMOVE', captured.id) }
}
```
Redux Toolkit formalizes what Vuex achieves through closure.

**Common Mistakes**
1. **Accessing `action.meta.arg` in `fulfilled` when you meant `action.payload`.** In `fulfilled`, both exist: `meta.arg` is what you sent, `payload` is what the server returned. For a rollback you want `meta.arg`; for displaying the server-confirmed version you want `payload`.
2. **Not knowing `meta.arg` exists and implementing a separate loading-state workaround.** A common beginner pattern is storing the pending item in a separate `pendingTransaction` state field. `meta.arg` makes this unnecessary.

---

## Code Walkthrough

### The three new reducer cases
```ts
.addCase(createTransactionThunk.pending, (state, action) => {
  state.transactions.push(action.meta.arg);
})
.addCase(createTransactionThunk.fulfilled, () => {
  // transaction already in store from pending — nothing to do
})
.addCase(createTransactionThunk.rejected, (state, action) => {
  state.transactions = state.transactions.filter((t) => t.id !== action.meta.arg.id);
})
```
Three cases, one pattern. `pending` inserts using `action.meta.arg` (the original Transaction). `fulfilled` is a no-op — the `() =>` with no parameters signals intentionally empty. `rejected` filters by `action.meta.arg.id` — the same ID that was inserted in `pending`. Because `id` was generated with `crypto.randomUUID()` before dispatch, it's guaranteed unique and stable across all three lifecycle events.

### Building the transaction object before resetting the form
```ts
const transaction = {
  id: crypto.randomUUID(),
  accountId,
  description: description.trim(),
  amount: parsedAmount,
  category: category.trim(),
  type,
  date: new Date().toISOString().split('T')[0],
};

setDescription('');
setAmount('');
setCategory('');
setType('debit');

try {
  await dispatch(createTransactionThunk(transaction)).unwrap();
} catch {
  setSubmitError('Transaction failed — please try again.');
}
```
The transaction object is captured in a const before the state resets. This is necessary because `description.trim()`, `parsedAmount`, etc. are derived from state that's about to be cleared. After the resets, `dispatch` is called — `pending` fires synchronously, the transaction appears in the list, the form is already empty. The `await` is still present so the `catch` can show an error if the API rejects.

### Why the button no longer shows "Adding…"
```tsx
<button type="submit" disabled={!isValid}>
  Add
</button>
```
The `submitting` state is gone. The button goes disabled immediately after submit because the form fields clear (making `isValid` false) — double-submission is prevented without a separate loading flag. There's no spinner because there's nothing to wait for from the user's perspective: the transaction is already in the list.

---

## What to Remember

- Optimistic updates use `pending` to insert and `rejected` to remove — `fulfilled` becomes a no-op in the same slice.
- `action.meta.arg` carries the original thunk argument in all three lifecycle cases — it's how `rejected` knows which item to roll back.
- Build the transaction object in a `const` before resetting form state — the resets will invalidate `description`, `amount`, etc. before dispatch runs.
- Other slices can still react to `fulfilled` normally — `accountsSlice` updates the balance on success without any change.
- The tradeoff: optimistic UI is snappy but shows stale data briefly if the API fails. For local apps, this failure case is rare enough to accept.
