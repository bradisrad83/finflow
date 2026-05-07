# NetWorthCard

## What Was Built
A summary card at the top of the dashboard showing total net worth across all accounts and the current month's net income/spending, backed by two new `createSelector` selectors that compose on existing input selectors.

## File Location
`src/components/NetWorthCard.tsx`, `src/store/selectors.ts`

---

## Concepts Introduced

### Selector composition — using one selector as another's input

**Plain English**
Every `createSelector` call so far has taken raw state slices as inputs (`state.accounts.accounts`, `state.transactions.transactions`). But selectors can take other selectors as inputs too. `selectNetWorth` uses `selectAccounts` — an already-named, already-memoized selector — as its input. This means: if `selectAccounts` hasn't changed since last render, `selectNetWorth` won't re-run its sum. The cache is layered. This is "selector composition" — building derived data pipelines where each step is independently memoized.

**Technically Speaking**
`createSelector(inputSelector, resultFn)` accepts any function with the signature `(state: RootState) => T` as an input selector — including other `createSelector` results. When React calls `useSelector(selectNetWorth)`, Reselect (the library behind `createSelector`) calls `selectAccounts(state)` first. If the reference is unchanged from the last call, `selectNetWorth` returns its cached result without running the `reduce`. If `selectAccounts` returns a new reference (e.g. an account balance changed), `selectNetWorth` recomputes. The memoization chain is: `selectAccounts` → `selectNetWorth`. Both caches are active simultaneously.

**Vue / Laravel Analogy**
In Vuex, a getter that depends on another getter:
```ts
getters: {
  accounts: (state) => state.accounts.list,
  netWorth: (state, getters) => getters.accounts.reduce((sum, a) => sum + a.balance, 0)
}
```
Vue getters receive both `state` and `getters` as arguments, enabling composition. Pinia's `computed` inside a store composes the same way. In Laravel, Eloquent accessor methods that call other accessors are the server-side equivalent — `$model->net_worth` depending on `$model->accounts`.

**Common Mistakes**
1. **Using raw state in the input instead of an existing selector.** `createSelector((state: RootState) => state.accounts.accounts, ...)` works, but it duplicates the same selector that `selectAccounts` already provides. Reuse existing selectors as inputs — it's DRY and allows cache sharing.
2. **Assuming composition gives deeper memoization.** `selectNetWorth` is still memoized with cache size 1 — one input+output pair. If two components use `selectNetWorth`, they share the single cache slot. This is usually fine, but for parameterized selectors used simultaneously with different args, you'd need a factory (like `selectAccountById`).

---

### Month prefix filtering — computing current-month totals without Date parsing

**Plain English**
To sum only this month's transactions, you need to know which ones fall in the current month. The naive approach is to parse every transaction's ISO date string into a `Date` object and compare year+month. But there's a cheaper way: since ISO 8601 dates start with `YYYY-MM-`, you can build the current month's prefix (`"2026-05"`) and check if each date string *starts with* that prefix. String prefix matching is faster than `Date` parsing and avoids the timezone pitfalls of `new Date(dateString)`.

**Technically Speaking**
```ts
const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
return transactions.filter((t) => t.date.startsWith(prefix))
```
`String.prototype.startsWith` is O(k) where k is the prefix length (7 characters). Constructing a `Date` from an ISO string is O(1) in V8 but involves locale/timezone parsing. For a large transaction list, prefix matching is meaningfully faster. The `.padStart(2, '0')` ensures single-digit months (`5` → `"05"`) match the stored format (`"2026-05-01"`). The `reduce` then computes net: credits add, debits subtract.

**Vue / Laravel Analogy**
In Laravel:
```php
$prefix = now()->format('Y-m');
$transactions->filter(fn($t) => str_starts_with($t->date, $prefix));
```
`str_starts_with` is the PHP equivalent. Carbon's `isCurrentMonth()` is more expressive but constructs a `Carbon` object per record — the prefix approach is similarly faster at scale. In Vue 3, `computed(() => transactions.value.filter(t => t.date.startsWith(prefix)))` is the direct equivalent.

**Common Mistakes**
1. **Using `new Date(t.date)` and checking `.getMonth()`.** Bare ISO date strings parsed as UTC can show as the previous day in negative-offset timezones. The prefix approach avoids date parsing entirely since both the stored string and the prefix are in local calendar format.
2. **Building the prefix outside the selector.** If the prefix is computed at module load time (`const prefix = '2026-05'`), it becomes stale the following month without a page refresh. Building it inside the result function ensures it's always current when the selector runs.

---

## Code Walkthrough

### selectNetWorth — composition in one line
```ts
export const selectNetWorth = createSelector(
  selectAccounts,
  (accounts) => accounts.reduce((sum, a) => sum + a.balance, 0),
);
```
`selectAccounts` is the input selector — not raw state. The result function receives the already-extracted array. If `selectAccounts` returns a cached reference, this `reduce` never runs. The output is a number — no object, no array — so equality checking is trivial (same number = no re-render).

### selectMonthlyNet — date filtering inside a result function
```ts
export const selectMonthlyNet = createSelector(
  selectAllTransactions,
  (transactions) => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return transactions
      .filter((t) => t.date.startsWith(prefix))
      .reduce((net, t) => net + (t.type === 'credit' ? t.amount : -t.amount), 0);
  },
);
```
`new Date()` is inside the result function, not at the top of the file. This is intentional — if it were at module scope, the month would be frozen at startup time and would show the wrong month after midnight on the last day of a month. The selector re-runs when `selectAllTransactions` returns a new reference, which recomputes `new Date()` at that moment.

### The skeleton guard
```tsx
if (accounts.length === 0) {
  return (
    <section className="px-8 pt-10 pb-2">
      <div className="bg-white dark:bg-gray-800 rounded-2xl ... shadow-sm px-8 py-6">
        <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-700 animate-pulse mb-3" />
        <div className="h-10 w-48 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
      </div>
    </section>
  );
}
```
`netWorth` is `0` while accounts are loading — showing "$0.00" briefly would look like a bug. The skeleton renders the card's shape (same outer div, same sizing) so the layout doesn't shift when real data arrives. `accounts.length === 0` is the guard rather than `selectAccountsLoading` because it correctly handles both "not yet loaded" and "genuinely no accounts."

### The monthly net display
```tsx
<p className={`text-xl font-semibold mt-2 tabular-nums ${
  isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-500 dark:text-red-400'
}`}>
  {isPositive ? '+' : ''}{fmt.format(monthlyNet)}
</p>
```
`Intl.NumberFormat` adds a minus sign for negatives automatically. It does NOT add a plus sign for positives — that's manual via `isPositive ? '+' : ''`. `tabular-nums` uses monospaced digit glyphs so the number doesn't shift horizontally when values change. `monthlyNet` can be exactly `0` — the `>=` check treats break-even as positive, which renders in green.

---

## What to Remember

- Selectors can take other selectors as inputs — use `selectAccounts` as an input to `selectNetWorth` rather than duplicating the raw state path.
- Compute `new Date()` inside the selector's result function, not at module scope — otherwise the month freezes at app startup.
- ISO date prefix matching (`t.date.startsWith('2026-05')`) is faster and timezone-safe compared to parsing each date into a `Date` object.
- Guard on `accounts.length === 0` rather than a loading flag — it correctly handles both the loading state and the genuinely-empty state.
- `Intl.NumberFormat` adds `-` for negatives automatically but never adds `+` for positives — prepend it manually when you want a signed display.
