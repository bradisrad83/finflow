# Delete Account

## What Was Built
A full-stack delete-account feature: a Haskell endpoint that cascade-deletes transactions, a `deleteAccountThunk` using `thunkAPI.dispatch` to clean up the frontend store, and an inline two-step confirmation UI on `AccountDetail` that navigates to the dashboard on success.

## File Location
`api/src/Main.hs`, `api/src/DB.hs`, `src/api/index.ts`, `src/store/accountsSlice.ts`, `src/store/transactionsSlice.ts`, `src/pages/AccountDetail.tsx`

---

## Concepts Introduced

### thunkAPI.dispatch — dispatching actions from inside a thunk

**Plain English**
Normally, `dispatch` lives in a component — you call `useDispatch()` to get it. But sometimes a thunk needs to dispatch a *different* action as part of its work. After deleting an account from the API, the thunk also needs to remove that account's transactions from the frontend store. It can't dispatch from a reducer (reducers are pure functions), but it can dispatch from the thunk body — using `dispatch` from the `thunkAPI` object that Redux Toolkit passes as the second argument to every thunk.

**Technically Speaking**
`createAsyncThunk<ReturnType, ArgType>` passes a `ThunkAPI` object as the second argument to the async function. Its type is:
```ts
{
  dispatch: AppDispatch
  getState: () => RootState
  rejectWithValue: (value: unknown) => RejectWithValue
  // ...and more
}
```
Destructuring `{ dispatch }` from it gives you a fully typed dispatch function, identical to the one from `useDispatch()` in components. You can dispatch synchronous actions, other thunks, or any action creator. This is the canonical way to coordinate across slices from within a thunk, avoiding circular slice imports.

**Vue / Laravel Analogy**
In a Vuex action:
```ts
async deleteAccount({ dispatch, commit }, accountId) {
  await api.deleteAccount(accountId)
  dispatch('transactions/removeByAccount', accountId)  // cross-module dispatch
  commit('REMOVE_ACCOUNT', accountId)
}
```
`thunkAPI.dispatch` is identical to Vuex's `dispatch` inside an action — both give you access to the global store dispatcher from within an async operation. In Laravel, a controller method calling another service or firing an event (`event(new AccountDeleted($id))`) is the closest analogy.

**Common Mistakes**
1. **Trying to dispatch from a reducer.** Reducers are pure functions — calling `dispatch` inside a reducer would cause side effects and is blocked by Redux. The thunk body is the right place.
2. **Using `thunkAPI.dispatch` when the component can dispatch instead.** If the cleanup action can be dispatched from the component after `.unwrap()`, that's simpler. `thunkAPI.dispatch` is most useful when the cleanup is an implementation detail of the thunk itself — not something the caller should have to remember.
3. **Forgetting that `thunkAPI.dispatch` returns an action, not a value.** `dispatch(someThunk())` returns a `Promise<ActionResult>`. If you need to await it, call `.unwrap()` on the result.

---

### Cascade delete — coordinating server and client cleanup

**Plain English**
When you delete an account, its transactions become orphaned — they reference an account ID that no longer exists. On the server, the Haskell handler deletes transactions first (by `account_id`), then the account row. On the frontend, the thunk cleans up the transactions slice via `removeTransactionsByAccount` after the API confirms the delete. Two layers, both cleaning up the same foreign-key relationship.

**Technically Speaking**
SQLite doesn't enforce foreign key constraints by default (`PRAGMA foreign_keys = OFF`). Without explicit cleanup, deleting an account would leave transaction rows with a dangling `account_id`. The Haskell `removeAccount` function executes two SQL statements in order — transactions first, then the account — using the same `Connection` (single thread, no transaction isolation needed for this simple case). On the frontend, `removeTransactionsByAccount` filters by `accountId` in one O(n) pass over the transactions array, via Immer's structural sharing so unchanged transactions aren't reallocated.

**Vue / Laravel Analogy**
In Laravel with Eloquent:
```php
// Model with cascade
class Account extends Model {
    protected static function booted() {
        static::deleting(function ($account) {
            $account->transactions()->delete();
        });
    }
}
```
Or via a foreign key constraint with `ON DELETE CASCADE` in the migration. The principle is the same: when a parent is deleted, its children must be cleaned up. React/Redux has no built-in cascade mechanism, so the cleanup is explicit code.

**Common Mistakes**
1. **Forgetting frontend cleanup after server delete.** The server deletes the rows, but the Redux store still holds the orphaned transactions. The `SpendingSummary` would show spending for a deleted account until the next page refresh.
2. **Deleting the account row before its transactions.** SQLite without foreign key enforcement won't error, but if another request reads transactions for that account_id in the brief window between deletes, it'll find orphaned data.

---

### Inline confirmation — two-step destructive action without a modal

**Plain English**
Deleting an account is irreversible. The standard UX for irreversible actions is a confirmation step — but a modal adds visual overhead and implies the action is recoverable or complex. The inline pattern uses one boolean (`confirming`) to flip between two UI states: a quiet "Delete account" link and an inline question ("Delete this account and all its transactions?") with "Confirm delete" and "Cancel" buttons. The destructive action only fires on the second click. No modal, no interruption, but no accidental deletes.

**Technically Speaking**
```ts
const [confirming, setConfirming] = useState(false);
```
A single boolean controls the entire confirmation state machine: `false` = default state (delete link visible), `true` = confirmation state (confirm/cancel visible). The delete `handleDelete` function is only reachable when `confirming` is true — the "Delete account" button only sets `confirming`, never dispatches. React's conditional rendering (`{!confirming ? A : B}`) swaps the two UI states atomically on the next render.

**Vue / Laravel Analogy**
In Vue 3:
```html
<template>
  <button v-if="!confirming" @click="confirming = true">Delete account</button>
  <template v-else>
    <span>Delete this account?</span>
    <button @click="handleDelete">Confirm</button>
    <button @click="confirming = false">Cancel</button>
  </template>
</template>
```
Identical pattern — `v-if`/`v-else` on a boolean is exactly React's `{condition ? A : B}` ternary. In Laravel, a server-rendered form would typically use a JavaScript `confirm()` dialog or a separate confirmation page at a different URL.

**Common Mistakes**
1. **Resetting `confirming` in the `finally` block.** If you reset it on both success and failure, the confirm state disappears before the user sees any error. Reset `confirming` only in the catch block (or on cancel), not on success — on success you're navigating away anyway.
2. **Using a modal for simple destructive actions.** Modals are appropriate for actions that require significant input or explanation. For "delete this thing?" with a two-word confirmation, inline is cleaner and less disruptive.

---

## Code Walkthrough

### The Haskell cascade delete
```haskell
removeAccount :: Connection -> Text -> IO ()
removeAccount conn aid = do
  execute conn "DELETE FROM transactions WHERE account_id = ?" (Only aid)
  execute conn "DELETE FROM accounts WHERE id = ?" (Only aid)
```
Two sequential SQL statements. Transactions deleted first so no orphaned rows exist even momentarily. The `do` block sequences IO actions — Haskell's equivalent of `await a; await b` in JS.

### The thunk with cross-slice cleanup
```ts
export const deleteAccountThunk = createAsyncThunk<string, string>(
  'accounts/delete',
  async (accountId, { dispatch }) => {
    await api.deleteAccount(accountId);
    dispatch(removeTransactionsByAccount(accountId));
    return accountId;
  },
);
```
`<string, string>` means: returns `string` (the account ID), takes `string` (the account ID). `{ dispatch }` is destructured from `thunkAPI`. After the API call succeeds, `removeTransactionsByAccount` cleans up the transactions slice synchronously. Returning `accountId` lets the `fulfilled` reducer know which account to remove from `state.accounts`.

### The fulfilled reducer
```ts
.addCase(deleteAccountThunk.fulfilled, (state, action) => {
  state.accounts = state.accounts.filter((a) => a.id !== action.payload);
})
```
`action.payload` is the `accountId` string returned by the thunk. Simple filter removes the deleted account. By this point the transactions are already cleaned up (dispatched synchronously in the thunk before `return`).

### The confirmation state machine
```tsx
const [confirming, setConfirming] = useState(false);
const [deleting, setDeleting] = useState(false);

{!confirming ? (
  <button onClick={() => setConfirming(true)}>Delete account</button>
) : (
  <>
    <span>Delete this account and all its transactions?</span>
    <button onClick={handleDelete} disabled={deleting}>
      {deleting ? 'Deleting…' : 'Confirm delete'}
    </button>
    <button onClick={() => { setConfirming(false); setDeleteError(null); }}>
      Cancel
    </button>
  </>
)}
```
Two state variables, two responsibilities. `confirming` controls which UI is shown. `deleting` disables the confirm button during the async operation. They're separate because both can independently be true (confirming is showing, and the delete is in flight).

---

## What to Remember

- `thunkAPI.dispatch` is the store's dispatch function, available inside any `createAsyncThunk` body — use it when a thunk needs to update a different slice as part of its work.
- Always delete child rows before parent rows — even without enforced foreign keys, deleting parents first leaves orphaned children visible to concurrent reads.
- The inline confirmation pattern: one boolean (`confirming`) flips between "show delete button" and "show confirm/cancel" — no modal needed for simple destructive actions.
- Return the deleted ID from the thunk (not `void`) so the `fulfilled` reducer has the information it needs to remove the item from state.
- Reset `confirming` only on failure or cancel, not on success — on success you're navigating away before React re-renders the confirmation state.
