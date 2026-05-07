# Reducer Tests — accountsSlice

## What Was Built
31 passing unit tests for the five balance-affecting `extraReducers` cases in `accountsSlice`, calling the reducer directly with mock state and constructed action objects — no store, no dispatch, no network.

## File Location
`src/__tests__/accountsSlice.test.ts`

---

## Concepts Introduced

### Calling a reducer directly — the pure function pattern

**Plain English**
A Redux reducer is a function: it takes the current state and an action, and returns the new state. Just like a selector, it's pure — no side effects, no network, no clock. This means you can test it the same way: call it with input you control, assert the output. `accountsReducer(currentState, someAction)` returns the state that would exist after that action fires. No store, no component, no React — just the function itself.

**Technically Speaking**
RTK slices export their reducer via `export default slice.reducer`. This is a plain function `(state: State | undefined, action: AnyAction) => State`. During tests, you call it directly: `accountsReducer(state, action)` returns a new immutable state object produced by Immer's structural sharing. The original state is never mutated — Immer creates a draft, applies the reducer logic to the draft, and returns a frozen new object. This means you can safely reuse `baseState()` across multiple tests without defensive copying.

**Vue / Laravel Analogy**
In Laravel, testing an Eloquent model method directly:
```php
public function test_balance_decreases_on_debit() {
    $account = new Account(['balance' => 1000]);
    $account->applyTransaction(type: 'debit', amount: 200);
    $this->assertEquals(800, $account->balance);
}
```
You're not testing a controller or a database transaction — you're testing the logic method in isolation. RTK reducers are the same: the business logic lives in a pure function, and you test that function directly. In Vuex, a Pinia store's action or mutation is tested the same way — call the function with a controlled store state object, assert the result.

**Common Mistakes**
1. **Creating a real Redux store to test reducers.** `configureStore` + `dispatch` + `getState()` works but adds unnecessary overhead and couples the test to store initialization. Reducers are pure functions — call them directly.
2. **Mutating the test state between calls.** If you write `state.accounts[0].balance = 900` before passing to the reducer, you've already mutated what should be the pre-action baseline. Always call `baseState()` fresh in each test.
3. **Testing that the reducer calls a specific method internally.** Don't assert that `.reduce()` or `.find()` was called — assert that the output is correct. Implementation tests break every refactor; behavior tests survive them.

---

### ThunkCreator.fulfilled — constructing action objects for tests

**Plain English**
When you dispatch an async thunk in production code, Redux Toolkit automatically constructs the action objects (`pending`, `fulfilled`, `rejected`) and dispatches them as the async operation progresses. In tests, you want to test what the reducer does when it receives a `fulfilled` action — without actually running the async operation. RTK provides this: every `createAsyncThunk` result has `.fulfilled`, `.pending`, and `.rejected` static methods that construct the action objects directly, with no async work.

**Technically Speaking**
`createAsyncThunk<ReturnType, ArgType>('type/name', payloadCreator)` returns an object with:
- The thunk dispatch function itself
- `.fulfilled: ActionCreatorWithPreparedPayload` — static that creates `{ type: 'type/name/fulfilled', payload, meta: { arg, requestId, ... } }`
- `.pending` and `.rejected` — analogous statics

`ThunkCreator.fulfilled(payload, requestId, arg)` signature:
- `payload` — what the async function returned (stored as `action.payload`)
- `requestId` — unique ID for this dispatch (use `''` in tests — irrelevant for reducers)
- `arg` — the original argument passed to `dispatch(thunk(arg))` (stored as `action.meta.arg`)

TypeScript infers all three from the thunk's type parameters, so passing the wrong shape is a compile error.

**Vue / Laravel Analogy**
In Vuex, you'd manually construct the mutation payload:
```ts
store.commit('accounts/createTransactionFulfilled', { id: 't1', accountId: '1', ... })
```
RTK's `.fulfilled()` static is more structured — it enforces the correct payload shape via TypeScript and includes the `meta` object (requestId, arg) automatically. There's no direct analogy in Laravel because server-side mutations happen synchronously and don't have a "pending/fulfilled/rejected" lifecycle.

**Common Mistakes**
1. **Confusing `.fulfilled` (the action creator) with the action type string.** `createTransactionThunk.fulfilled` is a function. `createTransactionThunk.fulfilled.type` is the string `'transactions/create/fulfilled'`. Calling `.fulfilled(...)` creates an action object; it's not the action itself.
2. **Passing the wrong argument order.** `ThunkCreator.fulfilled(payload, requestId, arg)` — payload first, then request ID, then the original arg. Swapping payload and arg is a common mistake, especially when both are the same type (like `Transaction`).
3. **Forgetting the arg when the reducer uses `action.meta.arg`.** If your reducer reads `action.meta.arg` (as `updateTransactionThunk.fulfilled` does), the third argument to `.fulfilled(...)` must be correct — not `undefined`.

---

### baseState() as a function — preventing test pollution

**Plain English**
Each test needs a clean starting point — the same known accounts with the same known balances. If you defined this as a `const` object and tests could mutate it (even accidentally), later tests would start from wrong data. Defining `baseState` as a function means every test that calls `baseState()` gets a brand-new object. There's no shared reference to accidentally corrupt.

**Technically Speaking**
Immer (used by RTK reducers) never mutates the state you pass in — it creates a draft, applies mutations to the draft, and returns a new frozen object. So `baseState` could technically be a `const` without causing mutation issues. However, the function form is defensive documentation: it signals to future readers that each test gets fresh state and that assumptions about freshness are safe. The function form also costs nothing — object literal creation is O(1).

**Vue / Laravel Analogy**
In Laravel Pest/PHPUnit:
```php
function baseState(): array {
    return ['accounts' => [['id' => '1', 'balance' => 1000]]];
}
```
Or using `setUp()` to reset state before each test. The same principle: don't let tests share mutable state. In Vue Testing Library, `beforeEach(() => { store = createTestStore() })` resets the store before each test for the same reason.

**Common Mistakes**
1. **Using `beforeEach` for test state when a local factory function is simpler.** `beforeEach(() => { state = baseState() })` and calling `baseState()` directly inside each test are equivalent — the local call is slightly clearer because the state origin is visible at the point of use.

---

## Code Walkthrough

### The updateTransactionThunk test — documenting the math
```ts
it('adjusts balance when type flips from debit to credit', () => {
  // previous: debit 100 → balance was -100
  // updated: credit 100 → balance should be +100
  // net change from 1000: reverse -100 (+100) + apply +100 = 1200
  const state = baseState();
  const previous = txn({ accountId: '1', type: 'debit', amount: 100 });
  const updated = txn({ accountId: '1', type: 'credit', amount: 100 });
  const next = accountsReducer(
    state,
    updateTransactionThunk.fulfilled({ updated, previous }, req, updated),
  );
  expect(next.accounts.find((a) => a.id === '1')!.balance).toBe(1200);
});
```
The comments explain the arithmetic that proves `1200` is correct. This is the most complex balance case — two operations (reverse old, apply new) with a sign flip. Without the comments, a reader can't quickly verify that `1200` is right. With them, it takes 5 seconds. `updateTransactionThunk.fulfilled({ updated, previous }, req, updated)` — note that the third arg is the original dispatch arg (the `updated` transaction), which matches the thunk signature `createAsyncThunk<..., Transaction>`.

### The "no-op when nothing changes" test
```ts
it('is a no-op when nothing changes', () => {
  const state = baseState();
  const t = txn({ accountId: '1', type: 'debit', amount: 100 });
  const next = accountsReducer(
    state,
    updateTransactionThunk.fulfilled({ updated: t, previous: t }, req, t),
  );
  expect(next.accounts.find((a) => a.id === '1')!.balance).toBe(1000);
});
```
Passing the same transaction as both `updated` and `previous` verifies that the two-step delta (reverse old, apply new) cancels out to zero when nothing actually changed. This tests an important invariant: an edit that doesn't change anything shouldn't affect the balance.

### The fetchAllTransactions "ignores unknown accounts" test
```ts
it('ignores transactions for unknown accounts', () => {
  const state = baseState();
  const orphan = txn({ accountId: 'unknown', type: 'credit', amount: 9999 });
  const next = accountsReducer(
    state,
    fetchAllTransactions.fulfilled([orphan], req, ['1', '2']),
  );
  expect(next.accounts.map((a) => a.balance)).toEqual([0, 0]);
});
```
Two things are verified: the orphan transaction doesn't corrupt any account balance, and both accounts show `0` (because no transactions for their IDs exist in the list). `toEqual([0, 0])` asserts both accounts simultaneously — more concise than two separate `toBe(0)` assertions.

### The const req = '' pattern
```ts
const req = '';  // request ID — irrelevant for reducer tests
```
Named `req` to make the call sites readable: `fulfilled(payload, req, arg)` reads clearly as "payload, request (ignored), arg." A bare `''` at every call site works but loses the intent. The comment on the `const` documents the decision once rather than at each usage.

---

## What to Remember

- Reducers are pure functions — test them with `reducer(state, action)` directly, no store required.
- `ThunkCreator.fulfilled(payload, requestId, arg)` constructs the action object without running the async thunk — use `''` for requestId in tests.
- `baseState()` as a function ensures each test gets a fresh, unshared starting point.
- Comment the arithmetic in balance-delta tests — the expected value is only obviously correct when the math is shown.
- Test the "no-op" case (no change to input) — it verifies that reverse + apply cancels correctly and that the invariant holds.
