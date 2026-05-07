# Balance Sync on Load (balance-sync)

## What Was Built
A `fetchAllTransactions.fulfilled` case in `accountsSlice.extraReducers` that recalculates every account's balance from the loaded transaction data on page load, replacing whatever potentially stale value the database returned.

## File Location
`src/store/accountsSlice.ts`

---

## Concepts Introduced

### The initial-sync extraReducers pattern

**Plain English**
Redux slices maintain derived state (like account balances) incrementally as individual operations happen: create a transaction → update balance, delete a transaction → update balance. This works well for mutations that happen in a live session. But when the app first loads, it fetches raw data from two separate sources — accounts from the database, transactions from the database — and the database balance column may be stale. The fix is an `extraReducers` case that listens for the bulk transaction fetch to complete and recalculates all balances from the complete transaction set. It's the "initial sync" case: the load that reconciles state after a restart or cold start.

**Technically Speaking**
`accountsSlice` already had `addCase` entries for `createTransactionThunk.fulfilled`, `deleteTransactionThunk.fulfilled`, and `updateTransactionThunk.fulfilled` — each handling an incremental balance delta. Adding `addCase(fetchAllTransactions.fulfilled, ...)` follows the identical pattern, but the payload is `Transaction[]` (all transactions) rather than a single transaction. The reducer iterates over `state.accounts`, filters `action.payload` by `accountId`, and reduces to a net balance with `=` (full replacement) rather than `+=` or `-=` (incremental delta). The accounts are guaranteed to be in the store when this fires because `Dashboard`'s second `useEffect` guards on `accounts.length > 0` before dispatching `fetchAllTransactions`.

**Vue / Laravel Analogy**
In Vuex with modules, a mutation in the `accounts` module reacting to an action from the `transactions` module:
```ts
// accounts store module
mutations: {
  [transactionTypes.FETCH_ALL_FULFILLED](state, { payload: transactions }) {
    state.accounts.forEach(account => {
      account.balance = transactions
        .filter(t => t.accountId === account.id)
        .reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0)
    })
  }
}
```
RTK's `extraReducers.addCase` is the cleaner version of this cross-module reaction pattern. In Laravel, a similar pattern is the `booted` model event: when a collection of related records is loaded, trigger a recalculation on the parent. The concept — derived state being reconciled after a bulk load — is universal.

**Common Mistakes**
1. **Using `+=` instead of `=` in the initial sync.** An incremental delta is wrong here — we're replacing the value entirely with the correct calculation, not adjusting from a potentially stale base. `account.balance = ...` is a full replacement.
2. **Adding this case without the `accounts.length` guard in the component.** If `fetchAllTransactions` were dispatched before accounts loaded, `state.accounts.forEach` would iterate over an empty array and do nothing. The guard in `Dashboard` (`if (accounts.length === 0) return`) ensures accounts are in the store first.
3. **Expecting this to keep balances in sync during the session.** This case only fires when `fetchAllTransactions` dispatches — on initial load or a full refresh. Individual transaction mutations are still handled by the separate `createTransactionThunk`, `deleteTransactionThunk`, and `updateTransactionThunk` cases.

---

### Complete balance maintenance — the full picture

**Plain English**
Account balance isn't stored in one place — it's computed from events. `accountsSlice` now handles every scenario that can change a balance:

| Scenario | Case | How |
|--|--|--|
| App first loads | `fetchAllTransactions.fulfilled` | Full recalculate from all transactions |
| User adds a transaction | `createTransactionThunk.fulfilled` | Apply single delta |
| User deletes a transaction | `deleteTransactionThunk.fulfilled` | Reverse single delta |
| User edits a transaction | `updateTransactionThunk.fulfilled` | Reverse old, apply new |
| User clicks Refresh | `refreshBalances.fulfilled` | Full recalculate from Redux state |

Every path is covered. The database balance column is now irrelevant for correctness — it's overwritten on every load.

**Technically Speaking**
This is the **event sourcing** pattern applied at the Redux layer. Account balances are not authoritative stored values — they're projections computed from the transaction log. The database balance column is technically a stale cache that gets corrected on every app load. A more complete implementation would update the column in the Haskell database whenever transactions change, but since the Redux store maintains the correct value in memory and recalculates it on every load, the in-memory state is always correct for any active session.

**Vue / Laravel Analogy**
In Laravel Eloquent, this is the equivalent of a `totalAmount` attribute that's recalculated from `hasManyThrough` relationships instead of stored in a column:
```php
public function getBalanceAttribute() {
    return $this->transactions->sum(fn($t) =>
        $t->type === 'credit' ? $t->amount : -$t->amount
    );
}
```
The balance is computed from its source — transactions — rather than maintained separately. The React+Redux version does this at the in-memory state layer rather than at the model layer.

**Common Mistakes**
1. **Relying on the database balance column as a source of truth.** The Haskell `accounts` table `balance` column is not updated when transactions are created or deleted — it holds the initial seed value. Treating `fetchAccounts` as the authoritative balance source will show wrong numbers.
2. **Removing the incremental delta cases in favor of always recalculating.** Full recalculation on every transaction mutation would work but is expensive for large datasets. The incremental cases handle the hot path; the full recalculation handles load/restart.

---

## Code Walkthrough

### The new case
```ts
.addCase(fetchAllTransactions.fulfilled, (state, action) => {
  const transactions = action.payload;
  state.accounts.forEach((account) => {
    account.balance = transactions
      .filter((t) => t.accountId === account.id)
      .reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0);
  });
})
```
`action.payload` is the `Transaction[]` returned by `fetchAllTransactions`. The `forEach` mutates each account via Immer (RTK's mutable-style reducer syntax). The `filter` + `reduce` pattern is identical to `refreshBalances` and `selectMonthlyNet` — the same two-step derivation that appears throughout the codebase. `=` is full replacement, not delta.

### Where it fits in the builder chain
The case is placed just before `refreshBalances.pending` — grouped with the other balance-affecting cases (`createTransactionThunk`, `deleteTransactionThunk`, `updateTransactionThunk`) rather than near the transaction fetch cases. The conceptual grouping is "things that affect account balance," not "things from the transactions slice."

### The import addition
```ts
import { addTransaction, removeTransaction, removeTransactionsByAccount,
  createTransactionThunk, deleteTransactionThunk, updateTransactionThunk,
  fetchAllTransactions } from './transactionsSlice';
```
`fetchAllTransactions` is exported from `transactionsSlice` and imported into `accountsSlice`. This is the cross-slice dependency that enables the reaction pattern — `accountsSlice` now listens to a thunk owned by `transactionsSlice`. RTK's action type strings are unique (`'transactions/fetchAll/fulfilled'`), so there's no collision risk.

---

## What to Remember

- The "initial sync" `extraReducers` case handles the load scenario; incremental delta cases handle the mutation scenario — both are needed.
- Use `=` (full replacement) in a recalculation case, not `+=` (delta) — you're computing the correct value from scratch, not adjusting from a potentially wrong base.
- Cross-slice `addCase` dependencies are fine in RTK — import the thunk from the other slice and add a case in your slice's `extraReducers`.
- The Haskell `accounts.balance` column is now a stale cache — correct values come from transaction recalculation on load, not from the database column.
- `state.accounts.forEach` in an Immer-powered reducer mutates in place — no need to return anything or spread.
