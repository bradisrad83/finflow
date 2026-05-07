# NotificationContext (toast-notifications)

## What Was Built
A `NotificationProvider` using `createContext` + `useReducer` that manages a list of auto-dismissing toast notifications, rendered into `document.body` via `createPortal`, exposable to any component in the tree through a `useNotification` hook.

## File Location
`src/context/NotificationContext.tsx`

---

## Concepts Introduced

### Building Context from scratch — createContext + useReducer as a mini event bus

**Plain English**
`ThemeContext` already existed, but it was inherited. This is the first time we build context from scratch. The purpose: let any component — no matter how deep in the tree — fire a notification without passing a function down through props. The `NotificationProvider` sits near the top of the app. It owns the state (the list of active toasts) and exposes one function: `addNotification`. Any component that needs to fire a toast just calls `useNotification()` and gets that function directly, bypassing every intermediate component.

This is the Context API's canonical use case: cross-cutting concerns that would require absurd prop drilling to solve any other way. You don't put toast state in Redux because it's ephemeral UI state, not application data. You don't thread the function through props because it would touch every component in between. Context is the right tool.

**Technically Speaking**
`createContext<T>(defaultValue)` creates a `Context<T>` object with a `.Provider` and `.Consumer`. The `defaultValue` is used only when a component calls `useContext` without a matching `Provider` ancestor — we pass `undefined` and throw in the custom hook instead to make missing-provider bugs obvious. `useReducer(reducer, [])` manages the notifications array inside the Provider — the reducer handles `add` and `remove` actions, giving us a named, testable state machine rather than scattered `setState` calls. The `value` prop of `Context.Provider` is what all consumers receive — here, `{ addNotification }` with a stable reference via `useCallback`.

**Vue / Laravel Analogy**
In Vue 3, this is `provide` / `inject`:
```ts
// Provider (parent component)
const addNotification = (message: string) => { /* ... */ }
provide('addNotification', addNotification)

// Consumer (any descendant)
const addNotification = inject<(msg: string) => void>('addNotification')
```
React's `createContext` / `useContext` is identical in intent — a parent publishes a value, descendants subscribe. The difference is that React's approach is type-safe by default (no string keys), and the context is a first-class object rather than a string identifier. In Laravel, flash messages via `session()->flash('status', 'Done')` serve a similar purpose — cross-cutting notification state that doesn't belong on a model — but they're server-side and don't survive a single request.

**Common Mistakes**
1. **Putting toast state in Redux.** Notifications are transient UI state — they don't need to be persisted, replayed, or synced. Redux adds overhead (action types, reducers, selectors) for state that's irrelevant to the rest of the app. Context is the correct tool for ephemeral UI concerns shared across the component tree.
2. **Passing a new function reference as context value on every render.** Without `useCallback`, `addNotification` would be a new function every render, causing every consumer to re-render. `useCallback` with an empty dep array gives a stable reference.
3. **Not throwing in the custom hook.** `useContext(NotificationContext)` returns `undefined` if called outside the provider. Without the throw, consumers silently get `undefined` and the error appears at the call site (`addNotification is not a function`) rather than the actual problem. Always throw a descriptive error in the hook.

---

### Auto-dismiss via setTimeout inside addNotification

**Plain English**
Rather than using a `useEffect` that watches the notifications array to schedule dismissals, the dismiss is scheduled directly inside `addNotification`. The moment a notification is added, a `setTimeout` is queued that will dispatch `remove` with the same ID 3.5 seconds later. The notification's ID — generated with `crypto.randomUUID()` — is the shared key between the add and the scheduled remove. No external state needed.

**Technically Speaking**
`addNotification` is a `useCallback`-memoized function that captures `dispatch` in its closure. It dispatches `{ type: 'add', payload: { id, message, type } }` synchronously, then schedules `() => dispatch({ type: 'remove', payload: id })` with `setTimeout(..., 3500)`. The `id` is captured in the closure — the timeout callback closes over the specific ID created during this call. If three notifications fire in rapid succession, each gets its own `id` and its own independent timeout. No cleanup is needed because dispatching `remove` for an already-removed ID is a no-op (the filter simply finds nothing to remove).

**Vue / Laravel Analogy**
In a Vue composable:
```ts
function useNotifications() {
  const notifications = ref<Notification[]>([])

  function add(message: string) {
    const id = crypto.randomUUID()
    notifications.value.push({ id, message })
    setTimeout(() => {
      notifications.value = notifications.value.filter(n => n.id !== id)
    }, 3500)
  }

  return { notifications, add }
}
```
The pattern is identical: generate an ID, add to the list, schedule a removal using that ID as the key. The difference is that Vue uses a composable (scoped to wherever it's called) while React's context + `useReducer` version is shared across the entire tree.

**Common Mistakes**
1. **Using an array index instead of a UUID for the notification ID.** If multiple notifications are added and one is dismissed early, the indices shift. UUIDs are stable and unique regardless of list mutations.
2. **Clearing timeouts on unmount.** In this implementation, if `NotificationProvider` unmounts while a timeout is pending, the timeout fires and dispatches to a reducer that no longer exists. For a provider that lives for the app's lifetime this is fine — but in tests or hot-reloading scenarios, storing timeout IDs and clearing them in a `useEffect` cleanup is safer.

---

### createPortal for UI that must escape the DOM hierarchy

**Plain English**
The `NotificationProvider` renders its children (the entire app) plus the toast overlay. Without `createPortal`, the toast `<div>` would be nested inside whatever parent elements wrap the provider in the DOM — which might have `overflow: hidden`, `z-index` stacking, or `position: relative` that clips the fixed-position toasts. `createPortal` renders the toasts directly into `document.body`, completely outside the React tree's DOM position, so they appear on top of everything with no CSS interference.

**Technically Speaking**
`createPortal(children, domNode)` renders `children` into `domNode` as if they were mounted there, while keeping them in the React tree at the call site for context and event bubbling purposes. The component that calls `createPortal` can still provide context values to the portaled content, and React events still bubble normally. However, native DOM events (outside React's synthetic event system) do not bubble through portals. The toasts are rendered at `document.body` as React's last DOM child, ensuring they sit above all other `z-index` contexts. `pointer-events-none` on the container prevents the invisible overlay from intercepting clicks outside the toasts themselves.

**Vue / Laravel Analogy**
Vue has `<Teleport to="body">`:
```html
<Teleport to="body">
  <div class="toast-overlay">...</div>
</Teleport>
```
Identical concept: render in the React/Vue tree logically, but mount to a different DOM node physically. In Laravel Blade, a `@stack('modals')` + `@push('modals', ...)` pattern serves a similar purpose — injecting content into a different part of the layout from a child template.

**Common Mistakes**
1. **Not using `pointer-events-none` on the container.** A full-screen `position: fixed` container without `pointer-events-none` intercepts all clicks across the entire viewport, even in the empty space between toasts.
2. **Forgetting that `createPortal` content stays in the React tree.** Context values provided above the portal are still accessible inside it. A common mistake is wrapping the portaled content in an extra provider it doesn't need.

---

## Code Walkthrough

### The reducer
```ts
function reducer(state: Notification[], action: Action): Notification[] {
  switch (action.type) {
    case 'add':    return [...state, action.payload];
    case 'remove': return state.filter((n) => n.id !== action.payload);
  }
}
```
Pure function — takes the current list, returns a new list. `add` appends; `remove` filters. The `Action` union type (`add | remove`) ensures TypeScript knows `action.payload` is a `Notification` in the `add` case and a `string` (the id) in the `remove` case.

### addNotification — the stable exposed function
```ts
const addNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
  const id = crypto.randomUUID();
  dispatch({ type: 'add', payload: { id, message, type } });
  setTimeout(() => dispatch({ type: 'remove', payload: id }), 3500);
}, []);
```
`type` defaults to `'success'` — most calls just pass a message string. `crypto.randomUUID()` is stable across browsers and produces a unique ID per notification. The `setTimeout` captures `id` in its closure — when it fires, it removes exactly the notification that was just added. `useCallback` with `[]` deps means this function is created once and never recreated.

### The portal render
```tsx
{createPortal(
  <div className="fixed bottom-6 right-6 flex flex-col-reverse gap-2 z-50 pointer-events-none">
    {notifications.map((n) => (
      <div key={n.id} className={`pointer-events-auto ... ${n.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'}`}>
        {n.message}
      </div>
    ))}
  </div>,
  document.body,
)}
```
`flex-col-reverse` is the key layout detail — new toasts are appended to the end of the array but appear at the bottom visually, pushing older toasts up. The `z-50` ensures toasts appear above modals and other fixed elements. `pointer-events-none` on the container, `pointer-events-auto` on each toast.

### The consuming hook
```ts
export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used inside <NotificationProvider>');
  return ctx;
}
```
The throw converts a silent `undefined` bug into an immediate descriptive error. Any component that accidentally calls `useNotification` outside the provider tree gets a clear message rather than a cryptic `TypeError`.

---

## What to Remember

- Context is for cross-cutting UI state that would require prop drilling — not for application data (that belongs in Redux).
- `useCallback` with `[]` on the exposed function is required — otherwise every consumer re-renders on every Provider render.
- Always throw in the custom hook when context is `undefined` — it surfaces missing-provider bugs immediately.
- `createPortal` escapes the DOM hierarchy while staying in the React tree — context values and React events still work inside portals.
- Auto-dismiss via `setTimeout` inside `addNotification` is simpler than a `useEffect` watcher — generate the ID, add, and schedule the remove in one function.
