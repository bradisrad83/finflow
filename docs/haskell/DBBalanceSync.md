# Database Balance Sync

## What Was Built
Two Haskell functions — `syncAccountBalance` (per-account balance recalculation) and `recalculateAllBalances` (startup sync) — wired into every transaction mutation so the SQLite `accounts.balance` column is always consistent with the transaction history.

## File Location
`api/src/DB.hs`

---

## Concepts Introduced

### Derived vs stored data — when the database is the source of truth

**Plain English**
An account balance isn't a number you decide — it's a number you calculate. Every credit adds to it, every debit subtracts. If your database stores a `balance` column that you update manually on each transaction, that column can drift from reality: a crashed server, a network timeout, a bug in the update logic, and suddenly the stored balance is wrong. The alternative is to compute it on demand from the transaction history — the transaction records ARE the source of truth, and the balance is a derived value.

FinFlow takes the middle path: store a balance column (useful for fast reads), but recalculate it from transactions on every write. The stored value is a cache, always overwritten with the correct computed value. It can never drift.

**Technically Speaking**
The SQL for balance recalculation is a correlated subquery:
```sql
UPDATE accounts
SET balance = (
  SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0.0)
  FROM transactions WHERE account_id = accounts.id
)
```
`accounts.id` in the subquery refers to the outer query's current row — this is what makes it correlated. For each account row being updated, the subquery runs independently using that account's ID. `COALESCE` handles the zero-transaction case: `SUM` returns `NULL` for an empty set, `COALESCE` converts it to `0.0`. The `CASE WHEN` is SQL's conditional: credits contribute `+amount`, debits contribute `-amount`.

**Vue / Laravel Analogy**
In Laravel with Eloquent, this is the choice between a stored `balance` column and a computed accessor:
```php
// Stored — can drift
public function getBalanceAttribute() { return $this->balance; }

// Computed — always correct
public function getBalanceAttribute() {
    return $this->transactions->sum(fn($t) =>
        $t->type === 'credit' ? $t->amount : -$t->amount
    );
}
```
FinFlow's approach is a hybrid: store the value, but overwrite it with the computed value on every write. The stored value is only trusted as a cache between mutations. In Redis terms: the transaction table is the canonical store, the balance column is a materialized view.

**Common Mistakes**
1. **Updating the balance incrementally instead of recalculating.** `balance = balance + amount` looks efficient but accumulates errors — a missed update leaves the balance permanently wrong. Full recalculation is idempotent: wrong inputs give the same wrong result, but correct inputs always give the correct result.
2. **Not handling the NULL case from SUM.** `SUM()` on an empty table returns `NULL`, not `0`. Without `COALESCE`, an account with no transactions would have `balance = NULL`, causing type errors or silent failures.

---

### recalculateAllBalances — idempotent startup migration

**Plain English**
When the server starts, it doesn't know whether the stored balances are accurate. A previous session might have crashed mid-write, a transaction might have been added directly to the database, or this is the first run with the new sync logic. Running `recalculateAllBalances` on every startup resolves all of these: regardless of the state the server finds the database in, balances are correct within the first query after startup. It's idempotent — running it twice gives the same result as running it once.

**Technically Speaking**
```haskell
recalculateAllBalances :: Connection -> IO ()
recalculateAllBalances conn =
  execute_ conn
    "UPDATE accounts \
    \SET balance = (\
    \  SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0.0) \
    \  FROM transactions WHERE account_id = accounts.id\
    \)"
```
`execute_` (with underscore) takes no parameters — the SQL has no `?` placeholders. The correlated subquery uses `accounts.id` to join across tables without an explicit JOIN syntax. SQLite executes this as one statement, updating all rows in a single pass. The `IO ()` return type signals that this function performs a side effect (modifying the database) and returns nothing.

This function is called at the end of `initDB`, after `seedIfEmpty` — ensuring that even a fresh seed produces correct balances. The existing `finflow.db` gets corrected on the first server start after this change.

**Vue / Laravel Analogy**
In Laravel, this is equivalent to a database seeder or migration that runs at application boot:
```php
// In AppServiceProvider::boot()
Account::all()->each(function ($account) {
    $account->update(['balance' => $account->transactions()->sum(...)])
});
```
Or, more efficiently, a raw SQL migration with the same correlated subquery. The principle — run corrective logic at startup so the application starts in a known-good state — applies to any persistence layer.

**Common Mistakes**
1. **Making startup recalculation conditional.** "Only run if balances look wrong" requires defining "looks wrong" — which you can't always know. Unconditional recalculation is cheaper than a partial check and guarantees correctness.
2. **Running recalculation in a transaction for large datasets.** For a personal finance app with thousands of rows, the single-statement approach is fine. For millions of rows, wrapping in a transaction with batching would be appropriate. The current implementation is correct for the scale FinFlow operates at.

---

### Capturing the account_id before deleting

**Plain English**
To sync a balance after deleting a transaction, you need to know which account's balance to update. But if you delete the row first, the account_id is gone — you can't query what you just deleted. The fix: read the account_id before the delete, then delete, then sync. This is the "read before delete" pattern: grab whatever context you'll need for cleanup before the cleanup target disappears.

**Technically Speaking**
```haskell
removeTransaction :: Connection -> Text -> IO ()
removeTransaction conn tid = do
  rows <- query conn "SELECT account_id FROM transactions WHERE id = ?" (Only tid)
            :: IO [Only Text]
  execute conn "DELETE FROM transactions WHERE id = ?" (Only tid)
  case rows of
    [Only aid] -> syncAccountBalance conn aid
    _          -> return ()
```
`query` returns `IO [Only Text]` — a list of single-column rows. `Only` is `sqlite-simple`'s wrapper for single-value rows. The `case` match handles both the found case (`[Only aid]`) and the not-found case (empty list, for idempotent deletes of already-deleted rows). The `_` catch-all with `return ()` is a no-op — if the transaction didn't exist, there's nothing to sync.

**Vue / Laravel Analogy**
In Laravel with Eloquent model observers:
```php
public function deleting(Transaction $transaction) {
    // $transaction is still available before the delete
    $this->accountId = $transaction->account_id;
}
public function deleted(Transaction $transaction) {
    Account::find($this->accountId)->recalculateBalance();
}
```
Or more directly: a `beforeDelete` hook captures the context before the row is gone. The Haskell approach is sequential IO — `do` notation enforces the read-first order just as naturally as an observer hook.

**Common Mistakes**
1. **Deleting first, then trying to find the account.** If you delete the transaction and then try `SELECT account_id FROM transactions WHERE id = tid`, you get an empty result. Order matters.
2. **Not handling the not-found case.** `removeTransaction` may be called with an ID that doesn't exist (e.g., idempotent API calls). The `_` → `return ()` branch makes it safe.

---

## Code Walkthrough

### syncAccountBalance
```haskell
syncAccountBalance :: Connection -> Text -> IO ()
syncAccountBalance conn aid =
  execute conn
    "UPDATE accounts \
    \SET balance = (\
    \  SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0.0) \
    \  FROM transactions WHERE account_id = ?\
    \) \
    \WHERE id = ?"
    (aid, aid)
```
`aid` appears twice in the tuple `(aid, aid)` — once for the subquery's `account_id = ?` and once for the outer `WHERE id = ?`. The inner select calculates the balance; the outer update writes it. This function is the hot path — called after every transaction mutation.

### The three wired-up mutations
```haskell
-- After insert:
syncAccountBalance conn (transactionAccountId txn)

-- After delete (with pre-read):
rows <- query conn "SELECT account_id FROM transactions WHERE id = ?" (Only tid)
execute conn "DELETE FROM transactions WHERE id = ?" (Only tid)
case rows of { [Only aid] -> syncAccountBalance conn aid; _ -> return () }

-- After update:
syncAccountBalance conn (transactionAccountId txn)
```
Three different patterns: insert and update have the account ID in the struct; delete must read it first. All three converge on the same `syncAccountBalance` call.

### Also fixed: updateTransaction was missing the date field
The previous `updateTransaction` SQL:
```sql
UPDATE transactions SET description = ?, amount = ?, type = ?, category = ? WHERE id = ?
```
Changed to include `date = ?`:
```sql
UPDATE transactions SET description = ?, amount = ?, type = ?, category = ?, date = ? WHERE id = ?
```
A silent data loss bug: editing a transaction's date was accepted by the API (no error) but the date change was discarded. Fixed as part of this build.

---

## What to Remember

- Recalculate balance from transactions on every write — don't try to keep it in sync incrementally with `balance + amount`.
- `COALESCE(SUM(...), 0.0)` is the correct SQL for summing an account with no transactions — SUM returns NULL for empty sets.
- Run `recalculateAllBalances` at startup so the database corrects itself regardless of what state it was left in.
- Read the account_id BEFORE deleting a transaction row — once it's deleted, the foreign key data is gone.
- `Only` in `sqlite-simple` wraps single-column query results; `(a, b)` tuples supply two parameters to SQL `?` placeholders in order.
