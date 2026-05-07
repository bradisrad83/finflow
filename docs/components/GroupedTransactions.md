# Grouped Transactions

## What Was Built
The flat transaction list in `TransactionList` is now grouped under date headers — "Today", "Yesterday", or a formatted date — using `Array.reduce` inside a `useMemo` to transform the sorted flat array into a nested group structure before rendering.

## File Location
`src/components/TransactionList.tsx`

---

## Concepts Introduced

### Array.reduce for grouping — transforming flat data into structure

**Plain English**
`Array.reduce` walks an array and builds up a single accumulated result as it goes. It's the most flexible array method: where `.map()` transforms one item to one item, and `.filter()` removes items, `.reduce()` can produce *any* shape — an object, a Map, a number, another array, anything. The classic use case is grouping: walk a flat list of transactions, and for each one, add it to the right bucket based on its date. When you're done walking, you have a Map of `date → transactions[]`.

**Technically Speaking**
`Array.prototype.reduce<Acc>(fn: (acc: Acc, item: T) => Acc, initial: Acc): Acc` takes a typed accumulator — here `Map<string, Transaction[]>`. For each transaction, the callback reads the existing array for that date (`acc.get(t.date) ?? []`), appends the transaction, and writes it back. The spread `[...(acc.get(t.date) ?? []), t]` creates a new array on each insertion rather than mutating the existing one — important for correctness inside a `useMemo` where mutating the accumulator mid-computation could cause subtle bugs. After `reduce` completes, `Array.from(map.entries())` converts the Map's entries to `[date, transactions][]`, which is then mapped to `TransactionGroup[]`.

**Vue / Laravel Analogy**
In Laravel:
```php
$grouped = collect($transactions)->groupBy('date');
```
In Vue 3:
```ts
const grouped = computed(() =>
  transactions.value.reduce((acc, t) => {
    acc[t.date] = [...(acc[t.date] ?? []), t]
    return acc
  }, {} as Record<string, Transaction[]>)
)
```
Same algorithm, different syntax. Laravel's `groupBy` is a convenience wrapper around this exact `reduce` pattern.

**Common Mistakes**
1. **Using `acc[key].push(t)` and mutating the accumulator array in place.** This works in most cases but creates shared references that can cause issues when the memoized result is reused. Spread `[...existing, t]` creates a new array each time.
2. **Using a plain object `{}` instead of `Map`.** Plain objects in JavaScript don't guarantee key insertion order in all engines. `Map` preserves insertion order reliably, which matters when the groups must appear newest-first.
3. **Forgetting the initial value argument.** `reduce` without an initial value uses the first element as the accumulator, which is a `Transaction` — not a `Map`. Always pass the initial accumulator as the second argument.

---

### Heterogeneous lists — rendering two levels of structure

**Plain English**
A uniform list has one kind of item: `transactions.map(t => <Row />)`. A heterogeneous list has two kinds: section headers and rows. The pattern is two nested `.map()` calls — the outer loop iterates over groups, the inner loop iterates over each group's items. Each level of the structure gets its own `key`.

**Technically Speaking**
React requires a stable `key` on every element in a `.map()`. For the outer `.map()`, `group.label` is used as the key — it's unique ("Today", "Yesterday", "April 18, 2026") and meaningful in React DevTools. For the inner `.map()`, `transaction.id` is used as before. Two-level rendering doesn't require `Fragment` here because each group has a wrapping `<div>`, but if the header and card were siblings with no wrapper, `<Fragment key={group.label}>` would be the correct pattern.

**Vue / Laravel Analogy**
In Vue 3 with `v-for`:
```html
<div v-for="group in grouped" :key="group.label">
  <p>{{ group.label }}</p>
  <div v-for="transaction in group.transactions" :key="transaction.id">
    <TransactionRow :transaction="transaction" />
  </div>
</div>
```
Identical two-level iteration. Laravel Blade with `@foreach` nested inside `@foreach` is the same pattern on the server side.

**Common Mistakes**
1. **Keying the outer loop on index.** `key={i}` for groups means React can't efficiently reconcile when groups are added or removed. Use a stable identifier — here `group.label`.
2. **Forgetting `divide-y` belongs inside each group's card, not on the outer container.** Moving `divide-y` to the outer `space-y-5` wrapper would add dividers between groups (wrong) instead of between rows within a group (right).

---

### toLocalISO — correct local date strings for "Today" / "Yesterday"

**Plain English**
To detect "Today", you need to compare a transaction's ISO date string (`"2026-04-18"`) against today's date. The obvious approach is `new Date().toISOString().split('T')[0]` — but that returns a UTC date. If it's 11pm in New York, UTC is already the next day, so nothing would ever match as "Today". The fix is to construct the ISO string from the local date parts — year, month, day — using the browser's local timezone.

**Technically Speaking**
`Date.prototype.toISOString()` always returns a UTC timestamp. `Date.prototype.getFullYear()`, `.getMonth()`, and `.getDate()` return the date in the local timezone. The `toLocalISO` helper:
```ts
function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```
produces the same `YYYY-MM-DD` format as the transaction's stored date field but using local time, making the comparison accurate regardless of the user's timezone offset.

**Vue / Laravel Analogy**
In Laravel, `Carbon::today()->toDateString()` respects `config('app.timezone')` and returns the correct local date. The JavaScript version has no such helper — you build it manually from the local date parts. Same problem, no built-in solution on the frontend.

**Common Mistakes**
1. **Using `.toISOString().split('T')[0]` for "today".** Correct output in UTC+0 or positive offset timezones, wrong in all US timezones after 7–8pm.
2. **Not padding month and day.** `getMonth() + 1` returns `4` for April, but the transaction date is stored as `"2026-04-18"`. Without `.padStart(2, '0')`, April becomes `"2026-4-18"`, which doesn't match and nothing labels as "Today".

---

## Code Walkthrough

### The reduce
```ts
const map = transactions.reduce<Map<string, Transaction[]>>((acc, t) => {
  acc.set(t.date, [...(acc.get(t.date) ?? []), t]);
  return acc;
}, new Map());
```
The generic `<Map<string, Transaction[]>>` types the accumulator explicitly — TypeScript can't infer it from `new Map()` alone. Each iteration: get the existing array for this date (or `[]` if first time), append the current transaction, write it back. The accumulator is the same `Map` instance throughout, but each inner array is a new spread — no mutation of existing arrays.

### Map insertion order as sort preservation
```ts
return Array.from(map.entries()).map(([date, txns]) => ({
  label: dateLabel(date, today, yesterday),
  transactions: txns,
}));
```
`transactions` is already sorted newest-first by `useTransactions`. Because `Map` preserves insertion order, the first date encountered (`reduce` walks left-to-right) is the most recent date. `Array.from(map.entries())` preserves that order. The groups come out newest-first automatically — no second sort needed.

### The dateLabel function
```ts
function dateLabel(isoDate: string, today: string, yesterday: string): string {
  if (isoDate === today) return 'Today';
  if (isoDate === yesterday) return 'Yesterday';
  return fmtGroupLabel.format(new Date(isoDate + 'T00:00:00'));
}
```
Two string comparisons before falling back to the formatter. `today` and `yesterday` are computed once in `useMemo` and passed in — the function itself is pure and doesn't depend on `new Date()` directly, making it easy to test. The `T00:00:00` suffix on the fallback `new Date()` call is the same timezone fix from the date formatting feature.

### The grouped render
```tsx
<div className="space-y-5">
  {grouped.map((group) => (
    <div key={group.label}>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2 px-1">
        {group.label}
      </p>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border ... divide-y ...">
        {group.transactions.map((transaction) => (
          <TransactionRow key={transaction.id} ... />
        ))}
      </div>
    </div>
  ))}
</div>
```
`space-y-5` adds vertical space between groups. Each group has its own card — the header label sits above it, visually separating the groups. `divide-y` moves inside each group's card so dividers appear between rows within a group, not between groups.

---

## What to Remember

- `Array.reduce` builds any shape from a flat array — the classic use case is grouping by key into a `Map` or object.
- Use `Map` (not `{}`) for grouping when insertion order matters — `Map` preserves the order items were first encountered.
- `new Date().toISOString().split('T')[0]` gives a UTC date — use local date parts (`getFullYear`, `getMonth`, `getDate`) when comparing against local transaction dates.
- Two-level `.map()` is the React pattern for sectioned lists — outer loop over groups, inner loop over items, each level with its own `key`.
- `useMemo` dependency is `[transactions]` — the grouping re-runs only when the array reference changes (new transaction added/deleted), not on every render.
