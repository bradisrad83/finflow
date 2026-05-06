# useSearchParams (url-search-state)

## What Was Built
The `filterType` and `query` state in `AccountDetail` were migrated from `useState` to `useSearchParams`, so the active search term and transaction filter are serialized into the URL (`?q=netflix&type=debit`) and survive page refreshes, back-button navigation, and sharing.

## File Location
`src/pages/AccountDetail.tsx`

---

## Concepts Introduced

### useSearchParams — the URL as state

**Plain English**
Normally when you store something in `useState`, it exists only in the component's memory. The moment you refresh the page, it's gone. `useSearchParams` is a drop-in replacement where the value lives in the browser's address bar instead. Type `?q=netflix` into the URL and the search input fills itself. Refresh the page — still filtered. Copy the URL and send it to someone — they see exactly the same view. The URL becomes a persistent, shareable snapshot of UI state.

**Technically Speaking**
`useSearchParams()` is a React Router hook that returns a tuple: `[URLSearchParams, SetURLSearchParams]`. The `URLSearchParams` object is a browser-native API for reading query strings — `.get('q')` returns the value of `?q=netflix` or `null` if absent. The setter accepts either a new `URLSearchParams` / plain object, or a **functional update** `(prev) => next` — identical in shape to the functional form of `useState`'s setter. Under the hood, calling the setter calls React Router's `navigate` with the updated search string, which pushes a new history entry and triggers a re-render with the new params. Because `searchParams` is derived from the URL (which is external state), React re-renders whenever the URL changes — including browser back/forward navigation.

**Vue / Laravel Analogy**
In Vue Router (Composition API):
```js
// read
const route = useRoute()
const query = route.query.q ?? ''

// write
const router = useRouter()
router.push({ query: { ...route.query, q: 'netflix' } })
```
React's `useSearchParams` compresses this into one hook and handles the spread-to-preserve-other-params concern automatically when you use the functional update form. In Laravel, the equivalent is reading from `request()->query('q')` — the URL is the source of truth, not session or component memory.

**Common Mistakes**
1. **Overwriting other params.** Calling `setSearchParams({ type: 'debit' })` directly replaces the entire query string — `?q=netflix` disappears. Always use the functional form and mutate a copy of `prev` to preserve params you're not changing.
2. **Setting empty strings instead of deleting.** `next.set('q', '')` produces `?q=` in the URL — noise with no meaning. Use `next.delete('q')` when the value is empty so the URL stays clean.
3. **Forgetting `.get()` returns `null`, not `undefined`.** The `??` nullish-coalescing operator handles both, but if you write `|| 'all'` instead, an empty string `''` would also fall through to the default — which is usually wrong for text inputs.

---

### Functional update form of setSearchParams

**Plain English**
When two separate pieces of state live in the same URL (`?q=netflix&type=debit`), updating one without destroying the other requires reading the current URL first. The functional update form — passing a function instead of a value — guarantees you always start from the most current snapshot, not a stale copy captured in a closure.

**Technically Speaking**
`setSearchParams((prev) => next)` is analogous to `setState(prev => ({ ...prev, key: value }))` in React. `prev` is the current `URLSearchParams` instance at the time the update runs. Constructing `new URLSearchParams(prev)` creates a mutable copy, then `.set()` / `.delete()` modifies only the target key. Returning the new instance triggers React Router's navigation. This pattern is equivalent to Redux Toolkit's Immer-based reducers: copy, mutate the copy, return it.

**Vue / Laravel Analogy**
In Vue Router you'd write:
```js
router.push({ query: { ...route.query, type: 'debit' } })
```
The spread `...route.query` is the manual version of what `new URLSearchParams(prev)` does automatically. React's functional form is safer because `route.query` in a closure could be stale; `prev` in the functional setter is always fresh.

**Common Mistakes**
1. **Mutating `prev` directly.** `prev.set('q', value); return prev;` — you're mutating the live object and returning the same reference. React may not detect the change. Always copy: `new URLSearchParams(prev)`.
2. **Using the non-functional form when multiple params coexist.** `setSearchParams({ q: value })` is fine if `q` is the only param you'll ever have. The moment a second param exists, use the functional form.

---

## Code Walkthrough

### Replacing useState with useSearchParams
```ts
// before
const [filterType, setFilterType] = useState<FilterType>('all');
const [query, setQuery] = useState('');

// after
const [searchParams, setSearchParams] = useSearchParams();
const filterType = (searchParams.get('type') as FilterType) ?? 'all';
const query = searchParams.get('q') ?? '';
```
The destructuring shape is identical to `useState`. The difference is that `searchParams` isn't a scalar value — it's a `URLSearchParams` object you call `.get()` on. The `?? 'all'` and `?? ''` defaults handle the case where the param isn't present in the URL at all (e.g. on a clean page load with no query string).

The `as FilterType` cast on line 2 is safe because the only code that writes to `?type=` is the filter buttons, which are constrained to valid `FilterType` values by TypeScript at the call site.

### Writing the filter type
```ts
onClick={() => setSearchParams((prev) => {
  const next = new URLSearchParams(prev);
  if (option.value === 'all') next.delete('type');
  else next.set('type', option.value);
  return next;
})}
```
`'all'` is the default — there's no reason to put `?type=all` in the URL when that's what you get with no param. Deleting it when "All" is selected keeps URLs minimal: `/accounts/1?q=netflix` rather than `/accounts/1?q=netflix&type=all`.

### Writing the search query
```ts
onChange={(e) => setSearchParams((prev) => {
  const next = new URLSearchParams(prev);
  if (e.target.value) next.set('q', e.target.value);
  else next.delete('q');
  return next;
})}
```
Same pattern: delete the param when the value is empty rather than writing `?q=`. The `if (e.target.value)` check is truthy — an empty string is falsy in JavaScript, so clearing the input removes the param entirely.

---

## What to Remember

- `useSearchParams` returns `[URLSearchParams, setter]` — same shape as `useState`, but the value lives in the URL.
- Always use the functional setter form `(prev) => next` when multiple params share the same URL, to avoid overwriting unrelated params.
- Copy `prev` with `new URLSearchParams(prev)` before mutating — never mutate the live object directly.
- Delete params instead of setting them to empty strings: `next.delete('q')` not `next.set('q', '')`.
- `.get()` returns `null` (not `undefined`) when a param is absent — use `??` for defaults, not `||`.
