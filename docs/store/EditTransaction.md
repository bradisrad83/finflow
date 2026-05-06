# Edit Transaction

## What Was Built
Full inline transaction editing: clicking a transaction row expands it into a pre-filled edit form, with an `updateTransactionThunk` that uses `thunkAPI.getState()` to retrieve the previous transaction values so the account balance can be adjusted precisely.

## File Location
`src/store/transactionsSlice.ts`, `src/components/TransactionRow.tsx`, `src/store/accountsSlice.ts`

---

## Concepts Introduced

### thunkAPI.getState — reading current Redux state from inside a thunk

**Plain English**
A thunk normally receives its argument (the new data you're sending) and does its work. But sometimes the thunk needs to know what was there *before* the change. When you edit a transaction's amount from $100 to $200, the account balance needs to decrease by the difference — which means the thunk needs to know the old $100 value. `thunkAPI.getState()` reads a snapshot of the entire Redux store at the moment the thunk runs, before the API call happens. It's like reading the database before writing to it.

**Technically Speaking**
`getState` is the third key utility on `ThunkAPI` alongside `dispatch` and `signal`. It returns `RootState` — the full current store snapshot typed according to the store's configured reducers. To get the return type right, you pass a third type argument to `createAsyncThunk`:
```ts
createAsyncThunk<ReturnType, ArgType, { state: RootState }>(
  'action/type',
  async (arg, { getState }) => { ... }
)
```
The `{ state: RootState }` in the third slot tells TypeScript that `getState()` returns `RootState`. Without this, `getState()` returns `unknown`. Calling `getState()` is a synchronous snapshot — it reflects the state at the moment of the call, before `await api.updateTransaction(...)` runs.

**Vue / Laravel Analogy**
In a Vuex action, you access the store state via `state` in the context object:
```ts
async updateTransaction({ state, commit }, newTransaction) {
  const previous = state.transactions.find(t => t.id === newTransaction.id)
  await api.updateTransaction(newTransaction)
  commit('UPDATE_TRANSACTION', { updated: newTransaction, previous })
}
```
Vuex passes state directly to every action; Redux Toolkit exposes it via `getState()`. Same concept — read current store state inside an async action before or during the API call. In Laravel, a controller accessing `$model->getOriginal()` before applying changes is the closest analogy.

**Common Mistakes**
1. **Calling `getState()` after the `await`.** Once you `await` an async operation, time has passed and other dispatches may have updated the store. Always capture the previous state *before* the first `await`.
2. **Forgetting the third type argument.** Without `{ state: RootState }`, `getState()` returns `unknown` and TypeScript will error when you try to access `.transactions.transactions`. The generic type must be explicit.
3. **Using `getState` when `action.meta.arg` is enough.** For the optimistic delete rollback, `action.meta.arg` (the original argument) was sufficient. `getState` is only needed when you require state that wasn't passed as an argument.

---

### Component-as-form toggle — list row that becomes an edit form

**Plain English**
`TransactionRow` has two modes: display (the normal row) and edit (a form). A boolean `editing` decides which renders. In display mode, clicking the row sets `editing = true`, resets `draft` to the current transaction values, and the `useLayoutEffect` focuses the first input. In edit mode, the row expands into a form with four controlled inputs. Submitting calls `onUpdate`, Escape or Cancel collapses back to display mode. The same component, same position in the list, two visual states.

**Technically Speaking**
The pattern is a controlled toggle with three state variables: `editing: boolean`, `draft: Transaction` (the working copy), and `descriptionRef: RefObject<HTMLInputElement>` (for `useLayoutEffect` focus). `draft` is initialized to `transaction` on each `startEdit` call — this ensures stale previous edits are discarded. The form's submit handler calls `onUpdate` (a callback prop) rather than dispatching directly, keeping Redux coupling in `TransactionList` and `TransactionRow` presentational. `memo(TransactionRow)` still applies — the component only re-renders when `transaction`, `onDelete`, or `onUpdate` change by reference, which is controlled by `useCallback` in `TransactionList`.

**Vue / Laravel Analogy**
In Vue 3:
```html
<template>
  <form v-if="editing" @submit.prevent="save" @keydown.escape="editing = false">
    <input v-model="draft.description" ref="descriptionRef" />
    <!-- ...more fields... -->
  </form>
  <div v-else @click="startEdit">
    {{ transaction.description }}
  </div>
</template>
```
`v-if`/`v-else` and React's ternary conditional are identical in concept. Vue's `ref` + `onMounted` for focus is the equivalent of `useRef` + `useLayoutEffect`.

**Common Mistakes**
1. **Not resetting `draft` to `transaction` when entering edit mode.** If `draft` keeps its state between edit sessions, cancelled edits reappear the next time the user clicks the row.
2. **Forgetting `e.stopPropagation()` on the delete button.** The display row has an `onClick` that opens edit mode. Without stopping propagation on the delete button, clicking delete also triggers edit mode simultaneously.
3. **Binding the delete button's `onClick` without `e.stopPropagation()`.** This is a common click-inside-clickable-container bug — child buttons must stop event propagation to avoid triggering the parent container's handler.

---

### Balance delta on update — reversing old effects, applying new ones

**Plain English**
When a transaction changes, the account balance needs to update. But unlike adding or deleting (where you just add or subtract once), an edit requires two steps: undo what the old transaction did, then apply what the new transaction does. If you changed a $100 debit to a $200 credit, the balance must go up by $100 (undo the debit) and then up by $200 (apply the credit) — a total change of +$300. The `previous` transaction from `getState` is what enables this two-step adjustment.

**Technically Speaking**
```ts
account.balance -= previous.type === 'credit' ? previous.amount : -previous.amount;
account.balance += updated.type === 'credit' ? updated.amount : -updated.amount;
```
Line 1 reverses the old transaction's effect: if it was a credit, subtract its amount (un-crediting); if a debit, add its amount back (un-debiting). Line 2 applies the new transaction's effect using the same sign logic. This is equivalent to: `newBalance = currentBalance - oldEffect + newEffect`. The two-line pattern handles all four cases: same type with different amount, credit→debit, debit→credit, and no-op (identical edit).

**Vue / Laravel Analogy**
In Laravel Eloquent:
```php
$account = Account::find($transaction->account_id);
$account->balance -= $transaction->getOriginal('type') === 'credit' ? $transaction->getOriginal('amount') : -$transaction->getOriginal('amount');
$account->balance += $transaction->type === 'credit' ? $transaction->amount : -$transaction->amount;
$account->save();
```
`$model->getOriginal('field')` is Laravel's equivalent of what `getState()` provides — the pre-update value. The math is identical.

**Common Mistakes**
1. **Only applying the new effect without reversing the old one.** `account.balance += updated.amount` (for a debit) double-counts the transaction — the old amount is still reflected in the balance.
2. **Using the wrong sign for credit reversal.** To undo a credit, you subtract. To undo a debit, you add. Getting the reversal sign wrong corrupts the balance in the same amount as the edited transaction.

---

## Code Walkthrough

### The updateTransactionThunk with getState
```ts
export const updateTransactionThunk = createAsyncThunk<
  { updated: Transaction; previous: Transaction },
  Transaction,
  { state: RootState }
>(
  'transactions/update',
  async (transaction, { getState }) => {
    const previous =
      getState().transactions.transactions.find((t) => t.id === transaction.id) ?? transaction;
    const updated = await api.updateTransaction(transaction);
    return { updated, previous };
  },
);
```
Three type parameters: what the thunk returns, what it takes as argument, and the `{ state: RootState }` that unlocks `getState`. `getState()` is called before `await` to guarantee a pre-update snapshot. The `?? transaction` fallback handles the edge case where the transaction isn't in the store (e.g. a race condition during `fetchAllTransactions`). Returning both `updated` and `previous` makes both available in any slice's `extraReducers`.

### The balance sync in accountsSlice
```ts
.addCase(updateTransactionThunk.fulfilled, (state, action) => {
  const { updated, previous } = action.payload;
  const account = state.accounts.find((a) => a.id === updated.accountId);
  if (!account) return;
  account.balance -= previous.type === 'credit' ? previous.amount : -previous.amount;
  account.balance += updated.type === 'credit' ? updated.amount : -updated.amount;
})
```
The payload from the thunk carries both transactions. Two lines handle the delta: reverse the old, apply the new. Immer's mutable-style syntax (`account.balance -=`) is correct inside RTK reducers.

### startEdit resets draft
```ts
const startEdit = useCallback(() => {
  setDraft(transaction);
  setEditing(true);
}, [transaction]);
```
`setDraft(transaction)` is the critical line — it ensures every edit session starts from the current saved values, discarding any abandoned edits from a previous session. Without this, cancelled edits would reappear the next time the row is clicked.

### Preventing click event bubbling to the row
```tsx
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
  ...
>
```
The display row's `<div>` has `onClick={startEdit}`. Without `e.stopPropagation()`, clicking the delete button propagates to the parent div and simultaneously opens edit mode while deleting. `stopPropagation()` is required any time a clickable element is nested inside another clickable container.

---

## What to Remember

- `thunkAPI.getState()` returns the current store snapshot — always call it *before* the first `await` to capture pre-update state.
- The third type parameter `{ state: RootState }` is required to make `getState()` typed; without it, TypeScript returns `unknown`.
- Balance updates require two operations: reverse the old effect, apply the new effect — one-line deltas only work for add/delete.
- Reset `draft` to the current `transaction` every time edit mode opens — stale draft state causes confusing UX.
- `e.stopPropagation()` is mandatory when a delete button is nested inside a clickable row container.
