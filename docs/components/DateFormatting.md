# Date Formatting and Sort Order

## What Was Built
Transaction dates are now formatted from raw ISO strings (`2026-04-18`) into human-readable labels (`Apr 18, 2026`) using `Intl.DateTimeFormat`, and transactions are sorted newest-first in `useTransactions`.

## File Location
`src/components/TransactionRow.tsx`, `src/hooks/useTransactions.ts`

---

## Concepts Introduced

### Intl.DateTimeFormat — browser-native date formatting

**Plain English**
You've already used `Intl.NumberFormat` to format currency throughout the app — `Intl.DateTimeFormat` is the same idea for dates. Pass it a locale string and a set of options describing which parts of the date you want (`month`, `day`, `year`), and it gives you a `.format()` method that converts a JavaScript `Date` object into a human-readable string. No library needed — it's built into every modern browser, it's locale-aware, and it handles the formatting rules for different countries automatically.

**Technically Speaking**
`Intl.DateTimeFormat` is part of the ECMAScript Internationalization API. The constructor signature is `new Intl.DateTimeFormat(locale, options)`. `locale` is a BCP 47 language tag (`'en-US'`, `'de-DE'`, `'ja-JP'`). `options` is a `Intl.DateTimeFormatOptions` object with keys like `month` (`'short' | 'long' | 'numeric' | '2-digit'`), `day`, `year`, `weekday`, `hour`, `minute`, `second`. `.format(date: Date)` returns a locale-appropriate string. Constructing an `Intl.DateTimeFormat` instance is moderately expensive (locale data lookup), so it should be defined at module level or memoized — not created inside a render function.

**Vue / Laravel Analogy**
In Vue 3 you'd typically use a computed or a filter-style utility:
```ts
const fmtDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const formattedDate = computed(() => fmtDate.format(new Date(transaction.date)))
```
In Laravel, the equivalent is Carbon's formatting methods:
```php
Carbon::parse($transaction->date)->format('M j, Y') // "Apr 18, 2026"
```
Same intent — a locale-aware or explicit format string that produces human-readable output. The difference is Laravel/Carbon does this server-side; `Intl.DateTimeFormat` does it in the browser with the user's actual locale.

**Common Mistakes**
1. **Creating the formatter inside the component or render loop.** `new Intl.DateTimeFormat(...)` inside a component function creates a new instance on every render and for every row. Define it at module level once and reuse it.
2. **Passing a bare ISO date string directly.** `new Date('2026-04-18')` is parsed as UTC midnight, which rolls back to the previous day in negative-offset timezones (all US timezones). Always append `'T00:00:00'` to force local-time parsing.
3. **Hardcoding a locale.** `'en-US'` is fine for a personal project, but in a real product you'd use `undefined` or `navigator.language` to pick up the user's browser locale automatically.

---

### ISO date strings and the UTC-local timezone trap

**Plain English**
JavaScript's `Date` constructor has a quirky rule: if you give it a date-only string like `"2026-04-18"`, it assumes you mean midnight UTC. If your computer's timezone is behind UTC (like any US timezone), UTC midnight becomes 7–8pm the previous day locally. So `new Date("2026-04-18")` displayed in New York shows `"Apr 17"`. This is a well-known JavaScript gotcha that trips up almost everyone the first time. The fix is to tell JavaScript you mean local midnight by appending `T00:00:00` (no timezone suffix), which switches the parsing to local time.

**Technically Speaking**
Per the ECMAScript spec, date-only ISO 8601 strings (`YYYY-MM-DD`) are treated as UTC, while date-time strings (`YYYY-MM-DDTHH:mm:ss`) without a timezone suffix are treated as local time. This asymmetry is intentional (ISO 8601 says date-only implies UTC) but frequently surprising. Appending `'T00:00:00'` converts the format to a date-time string without a timezone offset, triggering local-time interpretation. The result: `new Date('2026-04-18T00:00:00')` is midnight in the user's local timezone regardless of where they are.

**Vue / Laravel Analogy**
In Laravel, `Carbon::parse('2026-04-18')` respects your `app.timezone` config — if set to `'UTC'`, it's midnight UTC; if set to `'America/New_York'`, it's midnight New York time. The underlying problem is the same: a date-only string has no inherent timezone, so the framework makes an assumption. The fix in both worlds is to be explicit: either include a timezone in the string, or document that your dates are always local.

**Common Mistakes**
1. **Assuming `new Date('2026-04-18')` is safe.** It works correctly only in UTC or positive-offset timezones. In every US timezone it shows the wrong day.
2. **Using `+ 'T00:00:00Z'`** (with the Z suffix). `Z` means UTC, which has the same problem as the bare date — UTC midnight. The fix is `T00:00:00` with no suffix.
3. **Storing dates as `Date` objects in Redux state.** Redux state must be serializable. Store dates as ISO strings and convert to `Date` only at the point of display.

---

### Sorting with .slice() to avoid mutating Redux state

**Plain English**
JavaScript's `Array.sort()` sorts the array in place — it changes the original array, not a copy. Inside a `useMemo`, `result` might be (or might share a reference with) the array stored in Redux. Calling `.sort()` on it directly would mutate store state without going through a reducer — a silent bug that corrupts the single source of truth. `.slice()` with no arguments creates a shallow copy of the array, so the sort operates on the copy and the store is untouched.

**Technically Speaking**
`Array.prototype.sort` is a mutating operation returning the same array reference. In strict mode and inside Redux (which uses Immer for reducers but not for reads), mutating state outside a reducer causes subtle bugs: selectors that previously returned the same reference will now show mutations, breaking memoization assumptions. `.slice()` returns a new `Array` instance containing the same element references — a shallow copy sufficient to make sort safe. In TypeScript, both `result` and `result.slice()` are typed identically (`Transaction[]`), so there's no type change.

**Vue / Laravel Analogy**
In Vue 3, you'd use a computed that spreads the array before sorting:
```ts
const sorted = computed(() => [...transactions.value].sort(...))
```
`[...arr]` and `arr.slice()` are equivalent for this purpose — both create shallow copies. In Laravel, collections are value objects that return new instances from sorting methods (`->sortByDesc('date')` returns a new Collection), so this problem doesn't arise.

**Common Mistakes**
1. **Sorting without `.slice()`.** Works in most cases but silently mutates the Redux store array, causing hard-to-reproduce bugs when selectors cache stale sorted references.
2. **Using `new Date()` in the sort comparator.** `return new Date(b.date) - new Date(a.date)` creates two `Date` objects per comparison call — O(n log n) comparisons means many allocations. ISO 8601 strings sort correctly as strings, so `localeCompare` is faster and allocation-free.

---

## Code Walkthrough

### Module-level formatter in TransactionRow
```ts
const fmtDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
```
Defined outside the component function so it's created once per module load, not once per render per row. With potentially dozens of rows, this matters. The options produce `"Apr 18, 2026"` — enough context to understand the date without the verbosity of `"April 18, 2026"`.

### The date formatting call
```ts
{fmtDate.format(new Date(transaction.date + 'T00:00:00'))}
```
`transaction.date` is `"2026-04-18"`. Appending `'T00:00:00'` before constructing `new Date()` forces local-time interpretation, preventing the off-by-one-day bug in negative-offset timezones. `.format()` then converts the `Date` to `"Apr 18, 2026"`.

### Sort in useTransactions
```ts
return result.slice().sort((a, b) => b.date.localeCompare(a.date));
```
`.slice()` copies before sorting. `.localeCompare` on ISO 8601 strings works because `"2026-04-18"` > `"2026-04-15"` lexicographically — the format is designed so alphabetic order matches chronological order. `b` before `a` reverses to newest-first. This line is the last thing in the `useMemo`, so it applies after all filtering — the sorted order reflects whatever subset the filters produce.

---

## What to Remember

- Create `Intl.DateTimeFormat` at module level, not inside components — constructor cost makes per-render creation wasteful.
- `new Date('2026-04-18')` is UTC midnight — always append `'T00:00:00'` (no Z) to get local midnight.
- Use `localeCompare` to sort ISO 8601 date strings — they sort correctly as strings, no `Date` object needed.
- Always `.slice()` before `.sort()` when the source might be (or reference) Redux state — `sort` mutates in place.
- `Intl.DateTimeFormat` and `Intl.NumberFormat` are the same API family — locale, options, `.format()`. Learn one, you know both.
