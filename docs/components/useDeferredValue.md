# useDeferredValue (deferred-search)

## What Was Built
`useDeferredValue` wraps the search `query` in `AccountDetail` so the input updates immediately on every keystroke while React defers the transaction list re-render, with a subtle opacity fade signalling when the list is catching up.

## File Location
`src/pages/AccountDetail.tsx`

---

## Concepts Introduced

### useDeferredValue — decoupling a value from its consumer

**Plain English**
When you type in the search box, two things need to update: the input field itself (must feel instant) and the filtered transaction list (can wait a moment). Normally both update in the same render — the input doesn't paint until the list is also done filtering. For a small list this is fine, but for a long one, a slow list blocks a fast input.

`useDeferredValue` splits these: the input always renders with the live value, and React gives the list a "stale" copy until it has spare time to catch up. You're not adding a delay — you're giving React permission to prioritize. If React is idle, the list updates immediately. Only under rendering pressure does it stay behind.

**Technically Speaking**
`useDeferredValue<T>(value: T): T` accepts any reactive value and returns a version of it that React may hold at a previous snapshot. React schedules the deferred re-render at lower priority using its concurrent scheduling system (the same scheduler behind `useTransition`). The returned deferred value is always type-identical to the input — there's no wrapper or special type. When React eventually commits the deferred render, it uses the latest value at that point, skipping intermediate states if multiple updates have accumulated (similar to how `useState` batching works).

The `isStale` pattern — `const isStale = query !== deferredQuery` — is a manual derived boolean. Unlike `useTransition` which exposes `isPending` directly, `useDeferredValue` has no built-in pending flag. You compare the live value to the deferred value to detect staleness.

**Vue / Laravel Analogy**
Vue doesn't have a direct equivalent. The common pattern is a debounced ref:
```ts
const debouncedQuery = ref(query.value)
watch(query, (val) => {
  setTimeout(() => { debouncedQuery.value = val }, 150)
})
```
But this is fundamentally different: debouncing introduces a *fixed delay* even when React is idle. `useDeferredValue` introduces *zero delay* when React is idle — it only defers under actual rendering pressure. It's an adaptive optimization, not a time-based one.

In Laravel, there's no rendering analogy — server responses are synchronous and don't have the concept of deferred vs. urgent renders.

**Common Mistakes**
1. **Confusing `useDeferredValue` with debouncing.** Debouncing delays updates by a fixed millisecond count. `useDeferredValue` defers only when React is busy — if the browser is idle, the update happens in the same frame. You can't predict the delay.
2. **Using `useDeferredValue` when you own the state setter.** If you control the setter (a `useState` value), use `useTransition` instead — it gives you an `isPending` flag and wraps the update directly. `useDeferredValue` is for values you receive but don't control (like URL params from `useSearchParams`).
3. **Passing the deferred value to the wrong place.** The input must use the live `query` (so it stays responsive), and the expensive consumer must use `deferredQuery`. Swapping them defeats the purpose.

---

### isStale pattern — detecting deferred lag without isPending

**Plain English**
`useTransition` gives you an `isPending` boolean for free. `useDeferredValue` doesn't — you have to detect staleness yourself. The pattern is: if the live value and the deferred value differ, the list is behind. `const isStale = query !== deferredQuery` is always either `true` (deferred is behind) or `false` (they've caught up). This boolean drives the UI — a dimmed list signals that what you see isn't the final result yet.

**Technically Speaking**
The comparison `query !== deferredQuery` uses JavaScript's `!==` on strings. Because both are derived from `useSearchParams` (URL state), they're always primitive strings — reference equality and value equality are identical. When React commits the deferred render and `deferredQuery` catches up to `query`, the component re-renders with `isStale = false`, removing the opacity class. Tailwind's `transition-opacity duration-200` makes this a smooth fade rather than an abrupt jump.

**Vue / Laravel Analogy**
In Vue 3, you'd track this manually with a watcher:
```ts
const isStale = ref(false)
watch(query, () => { isStale.value = true })
watch(debouncedQuery, () => { isStale.value = false })
```
The React `isStale` derived from a single expression is simpler — no watcher needed, no state variable, just a comparison that React recalculates on every render.

**Common Mistakes**
1. **Using `isStale` for logic instead of just visuals.** `isStale` is a UI hint — "the list might be stale." It should only affect presentation (opacity, skeleton overlay), never filtering logic. The list itself must always render what `deferredQuery` says, not skip rendering based on `isStale`.
2. **Overusing the visual indicator.** For a local app with a small dataset, `isStale` is almost never true. Don't make the opacity change jarring (`opacity-0` or a full skeleton) — a subtle `opacity-50` is enough to hint without being disruptive.

---

## Code Walkthrough

### The deferred value and staleness flag
```ts
const query = searchParams.get('q') ?? '';
const deferredQuery = useDeferredValue(query);
const isStale = query !== deferredQuery;
```
Three lines that capture the full pattern. `query` is the live URL value — updates instantly on every keystroke. `deferredQuery` is React's copy — may lag behind. `isStale` is true during any lag. All three are plain strings or booleans; no wrappers, no effects.

### Passing the deferred value to the expensive child
```tsx
<div className={`transition-opacity duration-200 ${isStale ? 'opacity-50' : 'opacity-100'}`}>
  <TransactionList accountId={account.id} filters={{ type: filterType, query: deferredQuery }} />
</div>
```
The outer `div` handles the visual feedback — `opacity-50` when stale, smoothly back to `opacity-100` when caught up. `TransactionList` receives `deferredQuery`, not `query` — this is the key wiring. If it received `query`, React would never get a chance to defer anything.

`filterType` is not deferred — it comes from filter buttons (discrete clicks, not continuous typing), so there's no streaming-input performance concern.

### The input still uses the live value
```tsx
value={query}
onChange={(e) => setSearchParams(...)}
```
The input itself uses `query` (live), not `deferredQuery`. This is intentional and required: the input must always show what the user typed. If it showed `deferredQuery`, there would be a visible lag in the input itself — the opposite of what we want.

---

## What to Remember

- `useDeferredValue` gives React permission to defer expensive re-renders, but introduces zero delay when React is idle — it's adaptive, not time-based.
- Use `useDeferredValue` when you receive a value from outside (props, URL params); use `useTransition` when you own the state setter.
- Derive `isStale` manually: `const isStale = liveValue !== deferredValue`.
- The input must use the live value; the expensive consumer must use the deferred value — never swap them.
- Pair `isStale` with a subtle visual (opacity, muted color) so users know results are updating without being disruptive.
