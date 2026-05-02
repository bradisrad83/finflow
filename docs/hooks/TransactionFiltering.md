# Transaction Filtering with useMemo

## What Was Built
A type-and-search filter bar on the `AccountDetail` page, powered by an extended `useTransactions` hook that uses `useMemo` to compute a filtered transaction list only when its inputs actually change.

## File Location
`src/hooks/useTransactions.ts`, `src/pages/AccountDetail.tsx`, `src/components/TransactionList.tsx`

---

## Concepts Introduced

### useMemo

**Plain English**
`useMemo` caches the result of a calculation between renders. You give it two things: a function that returns some derived value, and a list of dependencies. React runs the function once, stores the result, and on every subsequent render it checks the dependency list — if nothing in the list changed, React just hands back the cached value without running the function again. It's how you avoid redoing expensive work when nothing relevant has changed.

**Technically Speaking**
`useMemo<T>(factory: () => T, deps: DependencyList): T` is a hook that memoizes the return value of `factory`. After the first render, React stores `[factory's result, deps]` in the component's hook slot. On each subsequent render, React compares the new `deps` against the saved ones using `Object.is` (referential equality, item by item). If all dependencies match, React returns the cached value and skips calling `factory` entirely. If any dependency differs, `factory` runs again and the new result is cached.

`useMemo` is a *performance hint*, not a correctness guarantee — React reserves the right to throw away the cache (e.g., during memory pressure). Don't put logic with side effects inside `useMemo`. The function should be pure: same deps → same result.

**Vue / Laravel Analogy**
This is essentially `computed()` from Vue 3. The function inside `useMemo(() => {...}, deps)` is the getter, and `deps` is what Vue's reactivity system would track automatically. The two big differences:

1. **Vue tracks dependencies for you.** `computed(() => transactions.value.filter(...))` — Vue sees that `transactions` was accessed and rebuilds when it changes. React makes you list deps explicitly.
2. **Vue's `computed` is always reactive.** React's `useMemo` only re-runs when deps change *and* the component re-renders. If nothing triggers a re-render, the memo doesn't re-evaluate.

In Laravel, the closest analog is a Blade `@once` directive or a cached attribute accessor (`Cache::remember(...)`). But neither is component-scoped — Laravel's caching is request-scoped or app-scoped.

**Common Mistakes**
- **Depending on objects, arrays, or functions created inline.** `useMemo(..., [filters])` where `filters = { type, query }` is a new object every render — the memo invalidates every time. Always destructure to primitives in the deps array.
- **Using `useMemo` for cheap calculations.** It has its own overhead (storing the cache, comparing deps). For trivial work like `a + b`, the memo is slower than just recomputing.
- **Putting side effects inside `useMemo`.** No `console.log` for tracking, no `dispatch` calls, no API requests. That's `useEffect`'s job. `useMemo` may be skipped, deferred, or called extra times — never rely on it firing.

---

### Lifting State Up

**Plain English**
"Lifting state up" means moving a piece of state from a deeper component up to an ancestor that can share it with multiple children. In this feature, the filter state (filter type + search query) was lifted to the `AccountDetail` page, even though only `TransactionList` consumes it. Why? Because the filter UI lives in `AccountDetail`, and the filter consumer is its child. They both need the same data, so the closest common ancestor owns it.

**Technically Speaking**
React state is local to the component that calls `useState`. If two components need to read or update the same state, that state must live in their lowest common ancestor and be passed down via props (or context). This is a deliberate part of React's design — there's no two-way binding, no global reactive store, just one-way data flow from owner to consumer.

In our case, the filter bar (a button group + input) lives in `AccountDetail`. The filtered output renders inside `TransactionList`. The state must therefore be in `AccountDetail`, with the filter values flowing down to `TransactionList` as props.

**Vue / Laravel Analogy**
In Vue 3, this is the same pattern: define `ref()` in the parent component, pass values down via props, emit events back up to mutate. Vue's `v-model` is syntactic sugar over this exact pattern. React doesn't have `v-model` — you wire up `value` and `onChange` manually for every controlled input, which makes the data flow more explicit (and more verbose).

In Laravel, the closest equivalent is when a Blade view receives data from a controller and passes it to multiple partials — the controller is the "owner" of the data, the partials are consumers.

**Common Mistakes**
- **Lifting state too high.** State should live at the *lowest* common ancestor. Putting filter state in `App.tsx` would force every page to re-render when the filter changes.
- **Lifting state too low.** If two siblings both need the state, lifting it to one of them and passing it via a prop to the other doesn't work — siblings can't pass props to each other.
- **Reaching for global state too early.** Not every shared state belongs in Redux. Local UI state like a filter bar belongs in `useState`, not the store.

---

### Stable Selectors and Reference Equality

**Plain English**
React Redux's `useSelector` re-runs your selector function on every state change and compares the result to the previous one to decide whether to re-render. The comparison is by **reference equality** — meaning two arrays with the same contents are still considered different if they're different array instances. If your selector returns a new array every time (because it filters or maps inline), you'll re-render constantly even when nothing meaningful has changed. This also breaks `useMemo` downstream, because the input dep keeps changing.

**Technically Speaking**
`useSelector(selector, equalityFn?)` defaults to `Object.is` for the equality check. Each time the Redux store dispatches an action, all subscribed selectors re-run. If the new return value is `!Object.is` to the old one, the component re-renders. A selector like `state.transactions.transactions.filter(...)` *always* returns a new array reference — so the equality check always fails — so the component always re-renders.

Two solutions: (a) select the stable underlying data and derive the filtered version inside `useMemo`, or (b) use a memoized selector like `createSelector` from Reselect / RTK. We used (a) here because it's simpler and fits the hook structure.

**Vue / Laravel Analogy**
Vue 3 doesn't have this problem — its reactivity system tracks dependencies at the property level, not by reference equality of returned objects. If you write `computed(() => transactions.value.filter(...))`, Vue caches the result and only recomputes when `transactions.value` actually changes. React's explicit, reference-based model trades Vue's "automatic" reactivity for predictability and explicitness — at the cost of having to think about reference identity.

**Common Mistakes**
- **Doing transformations inline in selectors.** `state.x.filter(...)` or `state.x.map(...)` returns a new array every call. Do these inside `useMemo` or in a memoized selector.
- **Selecting whole objects unnecessarily.** Selecting `state.accounts` when you only need `state.accounts.accounts.length` causes re-renders any time anything in `accounts` changes.
- **Assuming `useSelector` does deep equality.** It doesn't, by default. You can pass `shallowEqual` as the second argument, but the better fix is usually to write a more focused selector.

---

## Code Walkthrough

### `useTransactions.ts` — the memoized filter

```ts
const allTransactions = useSelector((state: RootState) => state.transactions.transactions);

return useMemo(() => {
  let result = allTransactions.filter((t) => t.accountId === accountId);

  if (filters?.type && filters.type !== 'all') {
    result = result.filter((t) => t.type === filters.type);
  }

  if (filters?.query) {
    const q = filters.query.toLowerCase();
    result = result.filter((t) => t.description.toLowerCase().includes(q));
  }

  return result;
}, [allTransactions, accountId, filters?.type, filters?.query]);
```

The selector returns the **whole** transactions array — that's a stable reference (it only changes when the slice mutates). All filtering happens inside `useMemo`. The dependency array contains the array reference plus three primitives. Because the deps are mostly primitives, the memo only invalidates when the data or filter values genuinely change — not on every parent re-render.

If we'd kept the original inline `.filter(...)` in the selector, the array reference would change every render, and the memo would invalidate every render — defeating the entire purpose of `useMemo`.

### `AccountDetail.tsx` — lifted filter state

```tsx
const [filterType, setFilterType] = useState<FilterType>('all');
const [query, setQuery] = useState('');
// ...
<TransactionList accountId={account.id} filters={{ type: filterType, query }} />
```

Two `useState` hooks own the filter state. `FilterType = 'all' | 'credit' | 'debit'` is a string literal union — TypeScript ensures only those three values can be assigned. The filter object is created inline and passed to `TransactionList`. It's a new object every render, but that's fine because the consuming `useMemo` reads the primitives, not the object reference.

### `TransactionList.tsx` — pass-through

```tsx
function TransactionList({ accountId, filters }: TransactionListProps) {
  const transactions = useTransactions(accountId, filters);
  // ...
}
```

`TransactionList` doesn't care about filtering logic. It accepts `filters` as an opaque prop and forwards it to the hook. This is the "presentational component" pattern — it knows how to render transactions, not how to compute them.

---

## What to Remember

- `useMemo` is React's `computed()` — but you must list dependencies explicitly, and the function must be pure.
- The dependency array should be primitives, not freshly-created objects/arrays. `[filters]` is a bug; `[filters?.type, filters?.query]` is correct.
- Selectors that filter or map inline return new arrays every render — they break referential equality and undermine `useMemo` downstream.
- State belongs in the lowest common ancestor of the components that need it. Local UI state (like a filter bar) does not need to live in Redux.
- `useMemo` is a performance hint, not a guarantee. Never put side effects inside it.
