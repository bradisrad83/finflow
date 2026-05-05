# Delete Transaction — useReducer State Machine

## What Was Built
A delete button on each transaction row that removes the transaction from the store and shows a 4-second "Undo" toast, with the toast's `hidden → visible → fading → hidden` lifecycle managed by a `useReducer` state machine in `TransactionList`.

## File Location
`src/components/TransactionList.tsx`, `src/components/TransactionRow.tsx`, `src/store/transactionsSlice.ts`, `src/store/accountsSlice.ts`

---

## Concepts Introduced

### useReducer

**Plain English**
`useReducer` is `useState` with a rulebook. Instead of calling `setValue(newValue)` directly, you describe *what happened* by dispatching a named action — `{ type: 'show', transaction }`, `{ type: 'fade' }`, `{ type: 'hide' }` — and a pure function called a reducer decides what the new state looks like based on the current state and the action. The reducer is the single place where all legal state transitions live. Nothing else in the component can invent a new state; it can only dispatch one of the defined actions.

This matters when state has multiple fields that must move together, or when only certain transitions should be allowed. A boolean `isVisible` flag can't prevent "fade before show." A reducer can: the `'fade'` case explicitly returns early if `state.status === 'hidden'`. You can read the entire state machine at a glance by reading the reducer — something that's hard to achieve with three separate `useState` calls.

**Technically Speaking**
`useReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S): [S, Dispatch<A>]`

- `S` is the state type. Here it's a discriminated union: `{ status: 'hidden' } | { status: 'visible'; transaction: Transaction } | { status: 'fading'; transaction: Transaction }`. The union shape means TypeScript knows that `toast.transaction` only exists when `toast.status !== 'hidden'` — no runtime checks needed.
- `A` is the action type. Another discriminated union: `{ type: 'show'; transaction: Transaction } | { type: 'fade' } | { type: 'hide' }`. Each `type` literal is its own branch; TypeScript narrows the action inside each `case` so you can safely access `action.transaction` only in the `'show'` branch.
- `Dispatch<A>` is the dispatch function. Its type is `(action: A) => void`. You call it `toastDispatch(...)` to trigger a transition.
- The reducer must be a pure function: same inputs → same output, no side effects. That's why timers live in `useEffect`, not in the reducer. The reducer's only job is computing the next state shape.

React compares the returned state with `Object.is`. If the reducer returns the exact same state reference (like the early-return in `'fade'`), React skips the re-render.

**Vue / Laravel Analogy**
`useReducer` is a local Pinia store in spirit. In Pinia:

```ts
const useToastStore = defineStore('toast', () => {
  const status = ref<'hidden' | 'visible' | 'fading'>('hidden');
  const transaction = ref<Transaction | null>(null);
  const show = (t: Transaction) => { status.value = 'visible'; transaction.value = t; };
  const fade = () => { if (status.value !== 'hidden') status.value = 'fading'; };
  const hide = () => { status.value = 'hidden'; transaction.value = null; };
  return { status, transaction, show, fade, hide };
});
```

The difference: Pinia stores are globally registered singletons; `useReducer` is scoped to one component instance and thrown away when the component unmounts. Use Pinia when multiple unrelated components need the state. Use `useReducer` when the state is private to one component and its children.

In Laravel, this is closest to a state machine on a model using a package like `laravel-model-states`. The model transitions through named states with allowed-transition rules — same idea, different layer.

**Common Mistakes**
- **Dispatching from inside the reducer.** The reducer is pure — there's no `dispatch` available, and calling side effects inside it breaks React's guarantees. Timers, fetch calls, and further dispatches belong in `useEffect` or event handlers.
- **Using `useReducer` for simple state.** A single boolean or a string with two values doesn't need a reducer. `useState` is right until state has meaningful transition rules or multiple values that must change together. Don't reach for `useReducer` by default — reach for it when you notice your `useState` logic is getting tangled.
- **Forgetting to handle every action in every state.** If `'fade'` doesn't guard against `state.status === 'hidden'`, rapid clicks can send the toast into an inconsistent state. Each case should explicitly handle what happens when an action fires in an unexpected state.

---

### Discriminated Union State Shape

**Plain English**
The toast state is typed as three possible shapes, not one shape with optional fields. `{ status: 'hidden' }` has no `transaction`. `{ status: 'visible'; transaction: Transaction }` has one. TypeScript enforces this: if you try to read `toast.transaction` without first checking `toast.status !== 'hidden'`, you get a compile error. The type system prevents you from rendering a deleted transaction's description in a case where no transaction should exist.

This is different from the "data + loading + error triplet" pattern (three fields that always coexist). Here, the fields themselves change depending on the state — the `transaction` field doesn't exist in `'hidden'` at all.

**Technically Speaking**
A discriminated union (also called a tagged union or sum type) is a union type where every member has a common literal property — the discriminant — that TypeScript uses to narrow. Here `status` is the discriminant:

```ts
type ToastState =
  | { status: 'hidden' }
  | { status: 'visible'; transaction: Transaction }
  | { status: 'fading'; transaction: Transaction };
```

After a check like `if (toast.status === 'hidden') return`, TypeScript's control flow analysis removes `{ status: 'hidden' }` from the type of `toast` in the remaining code. `toast.transaction` is now valid without a `!` assertion. This is structural narrowing — no runtime type guards needed, just a property check.

The switch inside the reducer uses the same mechanism:

```ts
switch (action.type) {
  case 'show':
    // action is narrowed to { type: 'show'; transaction: Transaction }
    // action.transaction is valid here
    return { status: 'visible', transaction: action.transaction };
```

**Vue / Laravel Analogy**
Vue 3's Composition API doesn't enforce discriminated unions out of the box — you'd write `const status = ref<'hidden' | 'visible' | 'fading'>('hidden')` and `const transaction = ref<Transaction | null>(null)` separately, which allows invalid combinations (e.g., `status === 'visible'` with `transaction === null`). TypeScript discriminated unions close that gap.

In Haskell (relevant for the planned Phase 2 backend), this is an algebraic data type:
```haskell
data ToastState
  = Hidden
  | Visible Transaction
  | Fading Transaction
```
Exactly the same concept — a type with named constructors that carry different data. React's discriminated unions are TypeScript's approximation of this pattern.

**Common Mistakes**
- **Using optional fields instead of a union.** `{ status: string; transaction?: Transaction }` allows `status: 'visible'` with `transaction: undefined`, which defeats the point. The union makes impossible states unrepresentable.
- **Checking `!= null` instead of the discriminant.** `if (toast.transaction)` works at runtime but doesn't narrow the full type. Always check the discriminant property (`toast.status`) to get full TypeScript narrowing.

---

### useEffect Cleanup for Timers

**Plain English**
Each `useEffect` that starts a timer also returns a cleanup function that cancels it. This matters in two scenarios: (1) if the user clicks "Undo" mid-timer, the component dispatches `'hide'` which changes `toast.status`, which re-runs the effect, which calls the cleanup first — cancelling the pending timer before a new one starts. (2) If the user navigates away and the component unmounts, React calls the cleanup to prevent a timer from firing against a dead component and trying to update state that no longer exists.

Without cleanup, clicking "Undo" and then immediately adding a transaction could trigger a stale fade timer from the previous deletion — a ghost toast appearing mid-session for no reason.

**Technically Speaking**
When `useEffect`'s dependency array changes, React runs the cleanup from the previous effect before running the new one. The execution order per cycle is:

1. Render completes.
2. Previous effect's cleanup runs (if any).
3. New effect runs.

For the timer effects: when `toast.status` changes from `'visible'` to `'fading'` (because `'fade'` was dispatched), the first effect's cleanup runs — `clearTimeout(timer)` — cancelling the 3.5-second fade timer. Then the second effect runs, registering the 0.3-second hide timer. No overlap, no ghost timers.

The reason `toast.status` is the dep (not the full `toast` object): `toast` is a new object reference every time the reducer runs, even if `status` didn't change. Using `toast` would restart both timers on every dispatch. The primitive string `toast.status` only changes on actual status transitions, so the timers only restart when meaningful.

**Vue / Laravel Analogy**
In Vue 3:

```ts
watch(() => toast.status, (status, _, onCleanup) => {
  if (status !== 'visible') return;
  const timer = setTimeout(() => toastDispatch('fade'), 3500);
  onCleanup(() => clearTimeout(timer));
});
```

Vue's `watch` has a built-in `onCleanup` callback for the same purpose. The mental model is identical: register side effects, clean them up when deps change or the watcher stops. React's `useEffect` return value is the equivalent of Vue's `onCleanup`.

In Laravel, a queued job with a delay (`->delay(now()->addSeconds(3.5))`) is the backend analogue — but cancelling a queued job requires explicit tracking and deletion, which is why this kind of ephemeral timer logic stays on the frontend.

**Common Mistakes**
- **Forgetting to return the cleanup function.** The effect runs, starts a timer, and if the status changes before it fires, a stale timeout runs against unmounted state. Always `return () => clearTimeout(timer)` from any effect that starts a timer.
- **Watching the whole state object instead of the relevant primitive.** `[toast]` as a dep restarts the timer on every dispatch; `[toast.status]` only restarts it when the status transitions. Always pick the smallest dep that captures the meaningful change.
- **Putting the timer inside the reducer.** `setTimeout` inside a reducer is a side effect — it runs during React's render phase, which must be pure. React may call reducers multiple times in strict mode (dev), which would start multiple timers for one transition.

---

### Tailwind `group` / `group-hover` for Hover Visibility

**Plain English**
The delete button is invisible by default (`opacity-0`) and fades in when the user hovers the row. Instead of using React state (`const [isHovered, setIsHovered] = useState(false)`), this is done entirely in CSS using Tailwind's `group` pattern. The row div gets the class `group`. The button gets `opacity-0 group-hover:opacity-100`. When the mouse enters the `group` element, Tailwind activates all `group-hover:` classes on any descendant. No JavaScript, no re-renders.

**Technically Speaking**
`group` adds no styles itself — it's a marker class. Tailwind compiles `group-hover:opacity-100` to:

```css
.group:hover .group-hover\:opacity-100 { opacity: 1; }
```

The CSS `:hover` pseudo-class on the ancestor, combined with the descendant selector, handles the visibility toggle entirely in the browser's style engine. React never knows the hover happened. This means no state update, no re-render, no event handler — just a CSS rule.

The transition `transition-all duration-150` on the button makes the opacity change animate smoothly.

**Vue / Laravel Analogy**
In Vue, the naive approach is `@mouseenter` / `@mouseleave` with a reactive boolean. The Tailwind `group` approach doesn't exist in Vue natively because it's a CSS utility pattern, not a framework feature. But you can use `group` / `group-hover` in a Vue template just as in JSX — it's Tailwind, not React-specific. The lesson is: before reaching for reactive state, ask whether the browser's CSS can handle it.

**Common Mistakes**
- **Using `useState` for hover effects that CSS can handle.** Hover state in React triggers a re-render on every `mouseenter` / `mouseleave`. For simple show/hide, `group-hover` is faster and produces less code.
- **Nesting `group` elements without `group/{name}`.** If you have a `group` inside a `group`, `group-hover:` applies when *any* ancestor group is hovered, not necessarily the direct parent. Tailwind supports named groups (`group/row`, `group-hover/row:opacity-100`) to scope the hover correctly.

---

## Code Walkthrough

### `toastReducer` — the state machine

```ts
type ToastState =
  | { status: 'hidden' }
  | { status: 'visible'; transaction: Transaction }
  | { status: 'fading'; transaction: Transaction };

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'show':
      return { status: 'visible', transaction: action.transaction };
    case 'fade':
      if (state.status === 'hidden') return state;
      return { status: 'fading', transaction: state.transaction };
    case 'hide':
      return { status: 'hidden' };
  }
}
```

The `'fade'` guard — `if (state.status === 'hidden') return state` — returns the exact same state reference. React sees `Object.is(prev, next) === true` and skips the re-render. This is a defensive guard against dispatching `'fade'` after an `'undo'` already hid the toast. Returning `state` (not a new `{ status: 'hidden' }`) is deliberate: a new object with identical contents would still cause a re-render.

### `useReducer` initialization and the two effects

```ts
const [toast, toastDispatch] = useReducer(toastReducer, { status: 'hidden' });

useEffect(() => {
  if (toast.status !== 'visible') return;
  const timer = setTimeout(() => toastDispatch({ type: 'fade' }), 3500);
  return () => clearTimeout(timer);
}, [toast.status]);

useEffect(() => {
  if (toast.status !== 'fading') return;
  const timer = setTimeout(() => toastDispatch({ type: 'hide' }), 300);
  return () => clearTimeout(timer);
}, [toast.status]);
```

Two effects, same dep `[toast.status]`. Each effect early-returns if it's not responsible for the current status. When `toast.status` transitions:
- `'hidden' → 'visible'`: effect 1 fires, starts 3.5s timer
- `'visible' → 'fading'`: effect 1 cleanup cancels the 3.5s timer; effect 2 fires, starts 0.3s timer
- `'fading' → 'hidden'`: effect 2 cleanup cancels the 0.3s timer; both effects early-return

The 0.3s for `'fading'` matches the CSS `transition-opacity duration-300` on the toast — the state machine stays in sync with the animation.

### `handleDelete` and `handleUndo`

```ts
const handleDelete = useCallback(
  (transaction: Transaction) => {
    dispatch(removeTransaction(transaction));
    toastDispatch({ type: 'show', transaction });
  },
  [dispatch],
);

const handleUndo = useCallback(() => {
  if (toast.status === 'hidden') return;
  dispatch(addTransaction(toast.transaction));
  toastDispatch({ type: 'hide' });
}, [dispatch, toast]);
```

`handleDelete` only depends on `[dispatch]` — `dispatch` is stable (Redux guarantees it), so this function is created once for the lifetime of the component. That's what lets `memo(TransactionRow)` skip re-renders: `onDelete={handleDelete}` is the same reference every render.

`handleUndo` depends on `[dispatch, toast]` — it needs to read `toast.transaction`, which changes on every deletion. That's fine: `handleUndo` is only passed to the toast UI (one element), not to every row, so recreating it on toast state changes doesn't cascade to any memoized children.

### The toast render

```tsx
{toast.status !== 'hidden' && (
  <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 ... transition-opacity duration-300 ${
    toast.status === 'fading' ? 'opacity-0' : 'opacity-100'
  }`}>
    <span>Transaction deleted</span>
    <button onClick={handleUndo}>Undo</button>
  </div>
)}
```

`toast.status !== 'hidden'` gates the render — the toast element doesn't exist in the DOM when hidden, so there's nothing to animate *in*. The fade *out* is handled by the `'fading'` class swap before `'hidden'` removes the element. The 300ms between `'fading'` and `'hidden'` (the second `useEffect`) gives the CSS transition time to complete before React removes the DOM node.

`fixed bottom-6 left-1/2 -translate-x-1/2` is the standard Tailwind pattern to horizontally center a fixed-position element: `left-1/2` places its left edge at the viewport's midpoint; `-translate-x-1/2` shifts it left by half its own width.

---

## What to Remember

- `useReducer(reducer, initialState)` returns `[state, dispatch]`. Dispatch named action objects; the reducer computes the next state. All legal transitions live in one place — the reducer — not scattered across event handlers.
- Model state as a discriminated union when different states carry different data. `{ status: 'visible'; transaction: Transaction }` makes `transaction` inaccessible in `'hidden'` state at the type level — impossible states become unrepresentable.
- `useEffect` cleanup runs before the next effect fires and on unmount. Always `return () => clearTimeout(timer)` from effects that start timers — prevents stale timeouts from firing against dead state.
- Use `toast.status` (a primitive) as the `useEffect` dep, not `toast` (an object). The object reference changes on every `useReducer` dispatch; the primitive string only changes on real status transitions.
- Tailwind's `group` / `group-hover:` pattern handles hover-triggered visibility in pure CSS — no `useState`, no event handlers, no re-renders. Reach for it before writing hover state.
