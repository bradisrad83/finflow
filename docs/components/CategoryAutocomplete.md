# Category Autocomplete (category-autocomplete)

## What Was Built
A native `<datalist>` autocomplete on the category field in `AddTransactionForm` that suggests the user's existing categories as they type, backed by a `selectUniqueCategories` memoized selector that derives a sorted, deduplicated list from the transactions store.

## File Location
`src/components/AddTransactionForm.tsx`, `src/store/selectors.ts`

---

## Concepts Introduced

### HTML datalist — native browser autocomplete

**Plain English**
`<datalist>` is a built-in HTML element that turns any text input into an autocomplete. You give the input a `list="some-id"` attribute and create a `<datalist id="some-id">` with `<option>` children. The browser wires them up automatically — when the user focuses the input or starts typing, a dropdown of matching suggestions appears. The user can still type anything (it's not a `<select>`), but the suggestions steer them toward valid options. No library, no custom component, no JavaScript event handling required.

**Technically Speaking**
`<datalist>` is a standard HTML5 element. The `list` IDL attribute on `<input>` accepts a string that must match the `id` of a `<datalist>` in the same document. The browser filters the `<option>` elements based on what's been typed — the filtering algorithm is browser-defined (typically substring match on `value`). The `<datalist>` element itself renders nothing visible; it's metadata consumed by the browser's form machinery. In React, the `<option>` children are rendered normally via `.map()` — React reconciles the list as transactions are added or removed, keeping the suggestions current. The `value` prop on `<option>` (without a text child) sets both the suggestion label and the value that fills the input when selected.

**Vue / Laravel Analogy**
Vue has no built-in equivalent — you'd typically reach for a third-party autocomplete library (`vue-select`, Headless UI combobox, etc.) or build a custom dropdown with `v-show`, `@keydown`, and `ref` position tracking. `<datalist>` is a browser-native shortcut that skips all of that. In Laravel Blade, the HTML is identical:
```html
<input type="text" list="category-options" name="category">
<datalist id="category-options">
  @foreach($categories as $category)
    <option value="{{ $category }}">
  @endforeach
</datalist>
```
The browser-side behavior is the same in all frameworks — React, Vue, Blade, or plain HTML.

**Common Mistakes**
1. **Using `<select>` when you want free text.** `<select>` forces a choice from the list. `<datalist>` suggests but never blocks — the user can type a brand new category. Use `<datalist>` when suggestions are helpful but the full set of valid values isn't known in advance.
2. **Forgetting the `id` / `list` link.** The `list` attribute on `<input>` must exactly match the `id` on `<datalist>`. If they don't match, the browser silently shows no suggestions — no error, just nothing.
3. **Putting `<datalist>` inside the grid layout.** `<datalist>` renders nothing visible, so its position in the DOM doesn't affect layout. But placing it inside a `display: grid` container can confuse some browsers. Keeping it as a sibling to the grid (inside the `<form>`, outside the grid `<div>`) is the safe pattern.

---

### selectUniqueCategories — shaping store data for a UI control

**Plain English**
The transactions store holds raw transaction objects — each has a `category` string. But the `<datalist>` needs a flat, deduplicated, alphabetically sorted list of category names. `selectUniqueCategories` is a `createSelector` that derives exactly that shape from the raw data. This is the "selector as view model" pattern: the store holds normalized data, the selector transforms it into whatever shape the UI needs, and `createSelector` ensures the transformation only runs when the source data changes.

**Technically Speaking**
```ts
export const selectUniqueCategories = createSelector(
  selectAllTransactions,
  (transactions) =>
    [...new Set(transactions.map((t) => t.category))].sort((a, b) => a.localeCompare(b)),
);
```
`transactions.map((t) => t.category)` produces `string[]` with duplicates. `new Set(...)` constructs a `Set<string>` — a collection that only stores unique values; duplicates are silently dropped. `[...new Set(...)]` spreads back to `string[]`. `.sort((a, b) => a.localeCompare(b))` sorts locale-aware alphabetically. `createSelector` memoizes the result: if `selectAllTransactions` returns the same array reference as last time, the computation is skipped and the cached array is returned. The return type is `string[]`, inferred from the result function.

**Vue / Laravel Analogy**
In Vuex, this would be a getter:
```ts
getters: {
  uniqueCategories: (state): string[] =>
    [...new Set(state.transactions.map(t => t.category))].sort()
}
```
In Laravel, you'd use a Collection:
```php
Transaction::pluck('category')->unique()->sort()->values()->toArray()
```
Same transformation: extract one field, deduplicate, sort, return as a flat list. The difference is when the computation runs: in Laravel it runs on every request; in React+Redux it runs only when the transactions array changes, with the result cached between renders.

**Common Mistakes**
1. **Forgetting `.sort()` is in-place on arrays but `new Set` doesn't have `.sort()`.** You must spread the Set back to an array first: `[...new Set(...)]`. Calling `.sort()` directly on a `Set` doesn't exist.
2. **Using `Array.from(new Set(...))` vs `[...new Set(...)]`.** Both are valid and equivalent — the spread syntax is more concise. Pick one and be consistent.
3. **Case sensitivity.** `"Groceries"` and `"groceries"` are treated as different values by `Set`. If you want case-insensitive deduplication, normalize before deduplicating: `transactions.map(t => t.category.trim().toLowerCase())`. For FinFlow we preserve the original casing since it's what users typed.

---

## Code Walkthrough

### The selector
```ts
export const selectUniqueCategories = createSelector(
  selectAllTransactions,
  (transactions) =>
    [...new Set(transactions.map((t) => t.category))].sort((a, b) => a.localeCompare(b)),
);
```
This is a non-parameterized `createSelector` (unlike `selectAccountById` which is a factory). It takes one input selector and one result function. The result function receives the transactions array and returns `string[]`. Every component that calls `useSelector(selectUniqueCategories)` shares the same memoized instance — they all get the same cached result until transactions change.

### Connecting the selector in the component
```ts
const categories = useSelector(selectUniqueCategories);
```
One line. No inline computation, no `useMemo` needed — the memoization lives in the selector. If `SpendingSummary` or another component also needed unique categories, they'd import the same selector and share the cache.

### The datalist wiring
```tsx
<input
  type="text"
  list="category-options"
  value={category}
  onChange={(e) => setCategory(e.target.value)}
  ...
/>
<datalist id="category-options">
  {categories.map((c) => (
    <option key={c} value={c} />
  ))}
</datalist>
```
The `list="category-options"` on the input and `id="category-options"` on the datalist are the only wiring. The input remains a fully controlled React input — `value` and `onChange` still manage the state exactly as before. The `<datalist>` is purely additive: it enhances the input with suggestions without changing how the input's value flows through React.

The `<option>` elements have no text children — just `value={c}`. When a `value` is provided without inner text, the browser uses the value as both the label in the dropdown and the text filled into the input on selection. Adding inner text would show a different label vs. fill value, which isn't what we want here.

---

## What to Remember

- Wire `<datalist>` to an `<input>` via matching `list` and `id` attributes — that's the entire API, no JavaScript needed.
- `<datalist>` is additive — a controlled React input stays fully controlled; the datalist just adds suggestion behavior.
- `new Set(array)` deduplicates; `[...new Set(array)]` gives you a plain array back.
- `selectUniqueCategories` is a module-level selector (not a factory) — all components share one memoized instance and one cache slot.
- The selector transforms raw store data into the exact shape the UI needs — this is the "selector as view model" pattern.
