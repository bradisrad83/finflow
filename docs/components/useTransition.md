# useTransition (filter-transition)

## What Was Built
The filter tabs (All / Credits / Debits) in `AccountDetail` now use `useTransition` so the button click is marked as non-urgent, with `isPending` dimming the active tab while the transaction list re-renders.

## File Location
`src/pages/AccountDetail.tsx`

---

## Concepts Introduced

### useTransition — marking state updates as non-urgent

**Plain English**
Normally when a state update fires, React treats it as urgent — it pauses everything and processes it immediately. For expensive re-renders like filtering a large list, this can make the UI feel sluggish if a faster user action (another click, a keystroke) arrives while React is busy. `useTransition` lets you say "this update is non-urgent — if something more important comes in, handle that first." The list update stays in the queue and React gets to it when it can. `isPending` is a boolean that stays `true` the whole time React is working on the transition, letting you show a subtle loading indicator.

**Technically Speaking**
`useTransition()` returns `[isPending: boolean, startTransition: TransitionStartFunction]`. Calling `startTransition(() => setState(value))` schedules the state update at lower priority in React's concurrent scheduler. React may yield to higher-priority work (user events, animations) while the transition is being rendered. `isPending` becomes `true` synchronously when `startTransition` is called and becomes `false` when React commits the transition render. Unlike `useDeferredValue` (which defers a value and shows the old state during the transition), `useTransition` defers the rendering work itself — the state updates eagerly and `isPending` tracks whether React has finished re-rendering for that update.

**Vue / Laravel Analogy**
Vue 3 has no direct equivalent. The closest pattern is a debounced watcher:
```ts
watch(filterType, debounce(() => {
  // expensive derived list computation
}, 100))
```
But debouncing introduces a fixed time delay regardless of whether React is actually busy. `useTransition` is adaptive — it only defers under real rendering pressure. If the browser is idle, the transition commits immediately with no visible lag. There is no server-side analogy in Laravel because server requests are synchronous and have no rendering priority system.

**Common Mistakes**
1. **Using `useTransition` for async operations.** In React 18, `startTransition` is synchronous-only — passing an `async` function may not produce the expected behavior. React 19 added async transitions, but in React 18, `startTransition` wraps synchronous state setter calls, not awaited operations.
2. **Confusing `useTransition` with `useDeferredValue`.** `useTransition` requires owning the state setter — you wrap the setter call. `useDeferredValue` wraps the value itself, useful when you receive a value from outside (props, URL state) and can't control the setter. The choice between them depends on whether you own the state.
3. **Applying `isPending` to the wrong element.** `isPending` means "a transition is in progress." It makes sense to dim the element that triggered the transition (the clicked button). Applying it to the list itself would fight with `useDeferredValue`'s `isStale` — they serve different visual roles.

---

### startTransition vs setState — the difference in practice

**Plain English**
When you call `setState(value)` directly, React treats the resulting re-render as urgent and processes it before rendering anything else. This is the right behavior for input fields (you want characters to appear immediately) but overkill for filtering a list (a few milliseconds of lag is imperceptible). `startTransition(() => setState(value))` gives React permission to yield if something more important arrives. The state update still happens — it's not cancelled or ignored — it just doesn't block the browser from handling other events while React is processing it.

**Technically Speaking**
React's concurrent renderer maintains a queue of pending work with priority levels. `setState` without a transition schedules work at `DefaultLane` (high priority). `startTransition` schedules at `TransitionLane` (low priority). When a high-priority update arrives (e.g. a user keypress) while a transition is being rendered, React interrupts the transition render, handles the keypress, and resumes the transition. The end result is the same — the transition commits eventually — but the UI stays responsive during the process. `isPending` stays `true` throughout this entire window, including any interruptions.

**Vue / Laravel Analogy**
There's no precise Vue equivalent. The closest conceptual match is Vue's `nextTick` for deferring work to the next microtask, but that doesn't have a priority system. The concept of render interruption and priority-based scheduling is specific to React 18's concurrent rendering model and doesn't exist in Vue 3's reactivity system or Laravel's request cycle.

**Common Mistakes**
1. **Expecting `startTransition` to make the transition "invisible".** `isPending` exists because there IS a visible window where the transition is in progress. If the list re-render takes 0ms, `isPending` is true for an imperceptible moment. If it takes 200ms, `isPending` is true for 200ms — long enough to show the dimmed button.
2. **Using `startTransition` for urgent updates.** Tab switching, button clicks that change visible state, and any update the user expects to see immediately are reasonable transition candidates. But if the user is typing into an input and the input's own state is wrapped in `startTransition`, the input will feel laggy.

---

## Code Walkthrough

### Declaring the transition
```ts
const [filterType, setFilterType] = useState<FilterType>('all');
const [isPending, startTransition] = useTransition();
```
`filterType` moves from `useSearchParams` to `useState`. This is required — `useTransition` only works when you own the setter. `isPending` and `startTransition` destructure from the hook return value, analogous to how `useState` returns `[value, setter]`.

### Why filterType left the URL
`query` stays in `useSearchParams` because a search result is worth bookmarking or sharing. `filterType` (All/Credits/Debits) is a quick session toggle — not something you'd want to persist in the URL. The trade-off is intentional: `useTransition` requires owning the setter, and `useSearchParams`'s setter can't be wrapped in `startTransition` as meaningfully.

### The button handler
```tsx
onClick={() => startTransition(() => setFilterType(option.value))}
```
`startTransition` takes a callback that contains the state update. The wrapping is necessary — if you called `startTransition(setFilterType(option.value))`, you'd be calling `setFilterType` immediately (outside the transition) and passing its return value to `startTransition`. The callback form ensures the state update runs inside the transition scheduler.

### The isPending visual
```tsx
className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-150 ${
  filterType === option.value
    ? `bg-blue-500 text-white ${isPending ? 'opacity-60' : 'opacity-100'}`
    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50'
}`}
```
`isPending` is only applied to the active button (`filterType === option.value`). The moment the user clicks "Credits", `filterType` updates to `'credit'`, the button turns blue, and `isPending = true` dims it to 60% — communicating "I registered the click, the list is updating." When React commits, `isPending = false` and the button returns to full opacity. `transition-all` (instead of `transition-colors`) ensures the opacity change also animates smoothly.

---

## What to Remember

- `useTransition` returns `[isPending, startTransition]` — wrap the state setter call inside `startTransition(() => setter(value))`.
- `useTransition` requires owning the state setter — use `useDeferredValue` when you receive a value from outside (props, URL params) and can't control how it's set.
- In React 18, `startTransition` is synchronous-only — don't pass async functions to it.
- `isPending` is `true` from the moment `startTransition` is called until React finishes committing the transition render — use it for a visual "in-progress" indicator on the element that triggered the transition.
- Moving `filterType` from URL state to component state was the prerequisite — `useTransition` can only wrap state setters you own.
