# Reducer Tests — transactionsSlice

## What Was Built
44 passing unit tests for `transactionsSlice`, covering the optimistic add lifecycle (pending → fulfilled no-op → rejected rollback), delete, update, per-account fetch merge, and bulk account removal.

## File Location
`src/__tests__/transactionsSlice.test.ts`

---

## Concepts Introduced

### Chained reducer calls — testing a sequence of actions

**Plain English**
Some reducer logic only makes sense as a sequence: `pending` inserts a transaction, then `rejected` removes it. Testing them in isolation misses the point — `pending` alone proves the insert works, but it doesn't verify the rollback. `rejected` alone with empty state would find nothing to remove and still pass. You need to apply both actions in order, using the output of the first call as the input to the second. This "chain" tests the complete optimistic round-trip.

**Technically Speaking**
```ts
const afterPending = reducer(emptyState(), createTransactionThunk.pending(req, t));
const afterRejected = reducer(afterPending, createTransactionThunk.rejected(error, req, t));
```
Each reducer call returns a new immutable state (Immer's structural sharing). The output is a plain object — identical in shape to what you'd see in the real store. Passing it as input to the next call is syntactically identical to passing `baseState()`. This is the pure function property: the reducer doesn't care whether the state came from a factory function or from another reducer call; it just reads and transforms.

**Vue / Laravel Analogy**
In Laravel, chained model mutations:
```php
$account = Account::factory()->create(['balance' => 1000]);
$account->applyCredit(500);  // balance: 1500
$account->reverseCredit(500); // balance: 1000
$this->assertEquals(1000, $account->balance);
```
Each operation takes the result of the previous. The Redux chain is equivalent — the "state object" flows through successive transformations. In PHPUnit, testing a two-step workflow by calling methods sequentially on the same object is the same pattern.

**Common Mistakes**
1. **Testing pending and rejected in isolation.** `rejected` with empty state returns empty state — it passes trivially without proving anything. The test must show that `rejected` removes what `pending` added.
2. **Reusing the same state variable.** Writing `transactionsReducer(state, pending)` then `transactionsReducer(state, rejected)` — using `state` (not `afterPending`) for the second call — tests rejection against the pre-pending state, not the post-pending state. The chain must be: `reducer(reducer(state, a1), a2)`.

---

### ThunkCreator.rejected — constructing a rejection action with an error

**Plain English**
When an async thunk fails in production, RTK dispatches a `rejected` action with the error attached. In tests, you construct this action with `ThunkCreator.rejected(error, requestId, arg)`. The first argument is an `Error` object — the reducer reads `action.error.name` or `action.error.message` from it. For the optimistic rollback case, the error is irrelevant (the reducer only uses `action.meta.arg.id`), but it must be an `Error` to satisfy TypeScript.

**Technically Speaking**
`ThunkCreator.rejected(error: Error | null, requestId: string, arg: ArgType, meta?: Record<string, unknown>)` — four arguments. RTK serializes the `Error` into `action.error: SerializedError` (a plain object with `name`, `message`, `code`, `stack`). The reducer accesses `action.error.name` to detect `'AbortError'` (in `fetchTransactions.rejected`) or `action.meta.arg.id` for the rollback (in `createTransactionThunk.rejected`). TypeScript infers all types from the thunk's generic parameters — passing the wrong arg type is a compile error.

**Vue / Laravel Analogy**
In Vuex, a failed action dispatches an error commit:
```ts
async createTransaction({ commit }, transaction) {
  commit('ADD_TRANSACTION', transaction)  // optimistic
  try { await api.create(transaction) }
  catch (error) {
    commit('REMOVE_TRANSACTION', transaction.id)  // rollback
    throw error
  }
}
```
RTK's `rejected` action is the formalized version of this catch block — you test it by constructing the action directly rather than triggering an actual API failure.

**Common Mistakes**
1. **Passing `null` instead of `new Error(...)`.** TypeScript accepts `null` for the error, but some reducers read `action.error.name` — if the error is null, `.name` will throw. Use `new Error('message')` to be safe.
2. **Forgetting the arg.** For optimistic rollback, the `arg` (third argument) contains the original transaction with its `id`. Without it, `action.meta.arg` is undefined and the reducer can't find which transaction to remove.

---

### fetchTransactions per-account merge — testing the arg as context

**Plain English**
`fetchTransactions.fulfilled([transactions], requestId, accountId)` — the third argument is the account ID that was fetched. The reducer uses it to know which account's transactions to replace: it removes all existing transactions for that account and adds the fresh ones. Without the third argument, the reducer gets `undefined` for `action.meta.arg` and can't do the merge correctly. Testing this requires verifying both sides: the target account's transactions are replaced, and other accounts' transactions are left alone.

**Technically Speaking**
```ts
fetchTransactions.fulfilled([freshForAcct1], req, '1')
```
`action.meta.arg === '1'` in the reducer. The reducer filters `state.transactions.filter(t => t.accountId !== '1')` then appends the new payload. This is a "replace slice by key" pattern — not a full state replacement, not an append, but a targeted swap. The test with two accounts verifies the selectivity: account 2's transactions must survive a fetch of account 1's transactions.

**Vue / Laravel Analogy**
In Laravel, this is similar to `$collection->reject(fn($t) => $t->account_id === $id)->merge($freshTransactions)`. Targeted collection mutation where the key filters which slice to replace. Testing it requires data in the "other" slot to verify it wasn't touched.

**Common Mistakes**
1. **Only testing the replacement, not the preservation.** Testing that account 1's old transactions disappear is necessary but not sufficient — you also need to verify account 2's transactions weren't affected.
2. **Forgetting the arg in `fulfilled`.** Calling `fetchTransactions.fulfilled([t], req)` without the third argument makes `action.meta.arg` undefined, and the reducer skips the merge (it filters nothing, then appends). The test would pass but wouldn't match production behavior.

---

## Code Walkthrough

### The full optimistic round-trip
```ts
it('fulfilled: is a no-op (transaction already present from pending)', () => {
  const t = txn();
  const afterPending = transactionsReducer(emptyState(), createTransactionThunk.pending(req, t));
  const afterFulfilled = transactionsReducer(afterPending, createTransactionThunk.fulfilled(t, req, t));
  expect(afterFulfilled.transactions).toHaveLength(1);
  expect(afterFulfilled.transactions[0]).toEqual(t);
});
```
Three reducer calls chain together: empty → pending (1 transaction) → fulfilled (still 1 transaction). The `fulfilled` no-op is verified by asserting the same count and same data before and after. This proves the comment in the slice — "transaction already in store from pending — nothing to do" — is actually true.

### Rejected: isolating the failed transaction
```ts
it('rejected: removes only the failed transaction, leaving others intact', () => {
  const existing = txn({ id: 'existing' });
  const failed = txn({ id: 'failed' });
  const afterPending = transactionsReducer(
    stateWith([existing]),
    createTransactionThunk.pending(req, failed),
  );
  const afterRejected = transactionsReducer(
    afterPending,
    createTransactionThunk.rejected(new Error('fail'), req, failed),
  );
  expect(afterRejected.transactions).toHaveLength(1);
  expect(afterRejected.transactions[0].id).toBe('existing');
});
```
This test verifies that the ID-based filter (`t.id !== action.meta.arg.id`) is precise — it removes only the failed transaction, not everything in the list. Starting with `[existing]`, applying `pending(failed)` gives `[existing, failed]`, then `rejected(failed)` gives `[existing]`. The existing transaction's survival is the key assertion.

### The list-order preservation test
```ts
it('preserves list order after update', () => {
  const a = txn({ id: 'a' });
  const b = txn({ id: 'b' });
  const c = txn({ id: 'c' });
  const updatedB = { ...b, amount: 999 };
  const next = transactionsReducer(
    stateWith([a, b, c]),
    updateTransactionThunk.fulfilled({ updated: updatedB, previous: b }, req, updatedB),
  );
  expect(next.transactions.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  expect(next.transactions[1].amount).toBe(999);
});
```
The `updateTransactionThunk.fulfilled` reducer uses `findIndex` + direct index assignment — an in-place replacement rather than filter + append. The list order test verifies this: `b` stays at index 1, not moved to the end. `.map(t => t.id)` extracts just the IDs for a clean order assertion.

---

## What to Remember

- Chain reducer calls (`reducer(reducer(state, a1), a2)`) to test two-step sequences like optimistic add — testing them in isolation misses the interaction.
- `ThunkCreator.rejected(new Error('msg'), requestId, arg)` — the arg must be the original transaction so `action.meta.arg.id` resolves correctly for rollback.
- For `fetchTransactions.fulfilled`, the third arg is the account ID used by the merge logic — omitting it makes the test diverge from production behavior.
- Test both sides of any filter: verify what was replaced AND verify what wasn't touched.
- `stateWith([...transactions])` paired with `emptyState()` provides targeted, readable starting points — name them for what they set up, not for when they're used.
