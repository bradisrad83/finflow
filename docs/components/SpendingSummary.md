# SpendingSummary — Memoized Aggregation Component

## What Was Built
A `SpendingSummary` component on the Dashboard that reads all transactions from the store, aggregates them by category into Spending and Income panels, and is wrapped in `React.memo` so it skips re-renders caused by unrelated parent state changes (theme toggle, loading flags).

## File Location
`src/components/SpendingSummary.tsx`, `src/pages/Dashboard.tsx`

---

## Concepts Introduced

### React.memo

**Plain English**
By default, whenever a parent component re-renders, every child component re-renders too — even if nothing the child cares about actually changed. `React.memo` is a wrapper you put around a component that says: "before re-rendering, check whether my props changed. If they didn't, skip the whole render." It's an opt-in optimization — React doesn't do this automatically because the prop comparison itself has a small cost, and for most components the render is cheap enough that comparing first would be slower. You reach for `memo` when a component is expensive to render and its parent re-renders frequently for reasons unrelated to that component.

Here, `SpendingSummary` is wrapped in `memo` because the Dashboard's parent (`App`) re-renders every time the theme changes — which happens whenever the user clicks the toggle. Without `memo`, every theme toggle would re-run the aggregation calculation. With `memo`, React checks "did SpendingSummary's props change?" — it takes no props, so the answer is always no for a theme change — and skips the render entirely.

**Technically Speaking**
`React.memo(Component)` returns a new component that wraps the original. Before React renders the wrapped component, it compares the previous and next props using shallow equality (`Object.is` on each prop value). If every prop is the same reference (or primitive value), the render is skipped and the previous JSX output is reused. If any prop changes, the component re-renders normally.

Important: `memo` only prevents re-renders triggered by the *parent*. A memoized component still re-renders when:
- Its own `useState` or `useReducer` state changes.
- A `useSelector` subscription fires (the store changed a value the selector reads).
- A context it consumes changes.

So `memo` is not a "never re-render" guarantee — it's specifically "don't re-render just because my parent did."

The default comparison is shallow — it compares each prop by reference. For object or array props, a new object literal `{ x: 1 }` fails the check even if contents are identical. You can pass a custom comparator as the second argument: `memo(Component, (prev, next) => deepEqual(prev, next))`, but shallow equality is almost always right; if you need deep equality, restructure your props.

**Vue / Laravel Analogy**
Vue's reactivity system is fine-grained: a component only re-renders when a reactive value it *actually read during its last render* changes. React's model is coarser — "parent re-renders, children re-render" — and `memo` is the escape hatch to opt out of that cascade.

The closest Vue 3 equivalent is `v-memo` on a template block, which skips diffing the block until listed dependencies change:

```html
<SpendingSummary v-memo="[transactions]" />
```

Or structurally: if `SpendingSummary` were a Pinia-connected component that only calls `useTransactionsStore()`, Vue would naturally not re-render it when the theme ref changes because it never read the theme ref. React doesn't track reads automatically, so you have to declare the optimization manually with `memo`.

In Laravel there's no equivalent — server-rendered views are stateless per request. The concept only exists in stateful UI frameworks.

**Common Mistakes**
- **Wrapping everything in `memo` "just in case."** `memo` adds a props comparison on every potential re-render. For cheap components that rarely get skipped, this costs more than it saves. Profile first; memo second.
- **Passing unstable props into a memoized component.** `<Memo component prop={computedArray} />` where `computedArray` is recreated on every render defeats memo entirely — the reference always differs. Stabilize props with `useMemo` or `useCallback` before passing them down.
- **Expecting `memo` to block re-renders from `useSelector`.** It won't. `memo` only responds to prop changes. Store subscription re-renders happen through a separate mechanism and bypass memo.

---

### useMemo for Derived Aggregation

**Plain English**
`useMemo` caches the result of a computation across renders. You give it a function and a list of dependencies; it runs the function once, caches the result, and on every subsequent render it checks whether any dependency changed. If nothing changed, it hands back the cached result without running the function again.

Here, the aggregation — iterating all transactions, building category maps, sorting — runs inside `useMemo`. It only re-runs when `transactions` changes. Clicking the theme toggle, triggering a balance refresh, or anything else that causes a re-render won't redo the aggregation.

**Technically Speaking**
`useMemo<T>(factory: () => T, deps: DependencyList): T` stores one previous `[deps, result]` pair. On each render, it compares each dep using `Object.is`. If all match, it returns the stored result (the same object reference as before). If any differ, it calls `factory()`, stores the new result, and returns it.

The same reference guarantee matters downstream: if `useMemo` returns the same array reference when deps haven't changed, and that array is a dep of another `useMemo` or a prop to a `memo`-wrapped child, the chain of memoization holds. If you returned a new array every render (even with identical contents), downstream `memo` comparisons would fail.

Here the dep is `transactions` — the reference returned by `useSelector`. RTK reducers use Immer, which only produces a new array reference when the array actually changed. So the dep comparison is meaningful: same reference → same aggregation result, no recomputation.

**Vue / Laravel Analogy**
In Vue 3, `computed()` is the direct equivalent:

```ts
const { spending, income } = computed(() => aggregate(transactions.value));
```

Vue's `computed` also caches, only re-evaluates when reactive dependencies change, and returns the same reference when the result hasn't changed. The mental model is identical; the syntax differs slightly (Vue tracks deps automatically via the reactivity system; React requires the explicit `[deps]` array).

In Laravel, this is closest to a query scope or an accessor that computes and caches a value per-request — but without cross-request persistence, it's just method memoization within a request lifecycle.

**Common Mistakes**
- **Empty deps array `[]` with a computation that uses changing data.** `useMemo(() => expensive(transactions), [])` computes once and never updates — the aggregation will be stale after the first transaction is added. Every value read inside the factory must appear in deps.
- **Using `useMemo` for trivial computations.** Filtering a 5-element array doesn't need memoization. The hook overhead (dep comparison, cache storage) costs more than just recomputing. Reserve it for loops over large collections or transformations with non-trivial algorithmic complexity.
- **Treating `useMemo` as a guarantee of reference stability.** React may discard cached memo values in the future (e.g., during concurrent rendering). Don't rely on memo for correctness — only for performance. If the computation produces a different result each time (random, Date.now()), memo will hide bugs.

---

### Extracting Pure Functions from Components

**Plain English**
The `aggregate` function lives outside the component — it's a plain TypeScript function that takes data and returns data, with no React hooks, no state, no side effects. This is a deliberate choice. Pure functions are easier to read, easier to test (you can call them in isolation with mock data), and give `useMemo` a clean boundary: the hook handles "when to call it," the function handles "what to compute."

The alternative — writing the aggregation inline inside `useMemo` — works but buries logic in the middle of the component and makes it untestable without rendering the component.

**Technically Speaking**
A pure function is one that: (a) given the same input, always returns the same output, and (b) has no side effects. `aggregate` satisfies both: it reads only its argument, uses a `Map` allocated locally each call, and returns a new object. It can be tested directly:

```ts
import { aggregate } from './SpendingSummary'; // if exported
expect(aggregate(mockTransactions).spending).toHaveLength(3);
```

The TypeScript type for the parameter uses `RootState['transactions']['transactions']` — an indexed access type that pulls the transaction array type directly from the store's state shape. This avoids re-importing `Transaction[]` separately and stays automatically in sync if the slice changes its shape.

**Vue / Laravel Analogy**
In Vue, this is the equivalent of writing a composable utility function outside `setup()` — a plain `function computeSummary(transactions)` that a composable calls. In Laravel, it's a static method on a service class or a standalone helper function in `app/Support/`. The principle is the same across all frameworks: push pure computation out of the reactive/component layer so it's independently testable.

**Common Mistakes**
- **Putting functions that use hooks outside the component.** Hooks (`useState`, `useSelector`, etc.) can only be called inside components or custom hooks. An extracted function that calls a hook will crash. Only move hook-free computation outside.
- **Memoizing the function itself unnecessarily.** `aggregate` is called inside `useMemo` — there's no need to also wrap it in `useCallback`. `useCallback` stabilizes function *references* passed as props or deps; `aggregate` is never passed as a prop or dep, so stabilizing it gains nothing.

---

## Code Walkthrough

### The aggregation function

```ts
function aggregate(transactions: RootState['transactions']['transactions']): CategoryGroup {
  const spendingMap = new Map<string, { total: number; count: number }>();
  const incomeMap = new Map<string, { total: number; count: number }>();

  for (const t of transactions) {
    const map = t.type === 'debit' ? spendingMap : incomeMap;
    const prev = map.get(t.category) ?? { total: 0, count: 0 };
    map.set(t.category, { total: prev.total + t.amount, count: prev.count + 1 });
  }
  // ...
}
```

`Map<string, ...>` instead of a plain object — Maps are the right choice when keys are dynamic strings (category names) and you're doing lots of `.get()` / `.set()`. The `?? { total: 0, count: 0 }` is the null coalescing default for the first time a category appears. The whole loop is one pass — O(n) — accumulating both maps simultaneously.

`RootState['transactions']['transactions']` is an indexed access type. It reads: "give me the TypeScript type of the `transactions` property on the `transactions` property of `RootState`." No separate import of `Transaction[]` needed; if the slice adds a field to the transaction interface, this type picks it up automatically.

### The memoized call

```ts
const { spending, income } = useMemo(() => aggregate(transactions), [transactions]);
```

The factory `() => aggregate(transactions)` closes over `transactions`. The dep array `[transactions]` tells React "if this reference changes, recompute." Since RTK/Immer only produces a new array reference when the array actually mutated, this dep comparison is exact — no false positives, no stale caches.

Destructuring `{ spending, income }` directly from `useMemo` keeps the call sites clean. The return type of `useMemo` is inferred from `aggregate`'s return type — no manual annotation needed.

### The memo export

```ts
export default memo(SpendingSummary);
```

The function is defined as `function SpendingSummary()` (named, not anonymous) and wrapped at the export. This means React DevTools and error stack traces show "SpendingSummary", not "memo(Component)" or an anonymous function. If you wrote `export default memo(function() {...})` you'd lose the name. Named function + wrap-at-export is the right pattern.

### Re-render behavior summary

```
Theme toggle → App re-renders → Dashboard re-renders
  → memo checks: SpendingSummary props changed? No props → NO RENDER ✓

Add transaction → transactions state changes → useSelector fires
  → SpendingSummary re-renders → useMemo dep changed → aggregate() runs ✓

Refresh balances → accounts state changes, transactions unchanged
  → useSelector for transactions returns same reference → NO RENDER ✓
```

`memo` and `useMemo` each block a different layer of unnecessary work. Together they mean: the only thing that causes `SpendingSummary` to do real work is an actual change to transaction data.

---

## What to Remember

- `React.memo(Component)` skips re-renders triggered by parent state changes when props haven't changed. It does not block re-renders from `useSelector`, `useState`, or context changes — those happen regardless.
- Default prop comparison is shallow (`Object.is` per prop). Passing new object/array literals as props every render defeats memo — stabilize those with `useMemo` or `useCallback` at the call site.
- Extract pure aggregation logic into standalone functions outside the component. They're easier to test, and `useMemo` gets a clean boundary: it handles *when* to run, the function handles *what* to compute.
- `useMemo` dep comparison uses `Object.is`. RTK/Immer only produces a new array reference when data actually changed — so `[transactions]` as a dep is exact: no false reruns, no stale caches.
- Name your component function before passing it to `memo`: `function Foo() {}; export default memo(Foo)`. Anonymous components show up as "memo(Component)" in DevTools and stack traces.
