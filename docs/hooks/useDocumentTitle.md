# useDocumentTitle

## What Was Built
A `useDocumentTitle(title)` custom hook that sets `document.title` on mount and whenever `title` changes, and restores the previous title when the component unmounts — used in `Dashboard` and `AccountDetail` to keep the browser tab in sync with the current page.

## File Location
`src/hooks/useDocumentTitle.ts`

---

## Concepts Introduced

### Custom hooks as reusable side-effect packages

**Plain English**
A custom hook is a plain JavaScript function whose name starts with `use`. That prefix is the only rule — React's lint tools use it to enforce the rules of hooks (no conditional calls, always called at the top level). There's no registration, no provider, no class. You write the function, export it, and call it from any component. Whatever `useEffect`, `useState`, or other hooks you put inside it run in that component's context.

The value isn't sharing state (the state is local to each component that calls the hook). The value is sharing *behavior* — the same effect logic doesn't need to be copied into every component that needs it. `useDocumentTitle` is the simplest possible example: one `useEffect`, one imperative DOM write, one cleanup.

**Technically Speaking**
When a component calls `useDocumentTitle('Primary Checking')`, React runs that function during the render phase. Any `useEffect` calls inside it are registered in the component's fiber — they're indistinguishable from effects written directly in the component. The hook has no identity of its own; it contributes hooks to the calling component's hook list. This is why the rules of hooks apply to custom hooks: calling a custom hook conditionally is calling its inner hooks conditionally, which corrupts the hook list order React uses to track state across renders.

Return type `void` is explicit — the hook manages its own state internally and exposes nothing to the caller. If the hook needed to expose values (like a loading state or the current title), it would return them.

**Vue / Laravel Analogy**
In Vue 3, this is a composable:
```ts
export function useDocumentTitle(title: string | Ref<string>) {
  const previous = document.title
  watchEffect(() => { document.title = unref(title) })
  onUnmounted(() => { document.title = previous })
}
```
Called directly inside `setup()` or `<script setup>`, no registration needed. The pattern is identical: a function that uses reactive primitives to produce a side effect, called by composing it into a component. In Laravel, there's no equivalent — server-side rendering doesn't have browser tabs or DOM APIs. This pattern is purely a client-side component system concept.

**Common Mistakes**
1. **Calling the hook conditionally.** `if (showTitle) useDocumentTitle(title)` violates the rules of hooks and causes React to throw. The `account?.name ?? 'FinFlow'` fallback handles the "no value yet" case without conditionally calling the hook.
2. **Forgetting the cleanup function.** Without `return () => { document.title = previous }`, navigating away leaves the previous page's title in the tab. If `AccountDetail` sets the title to "Primary Checking" and the user navigates to `Dashboard`, the tab still shows "Primary Checking" until Dashboard's own effect runs (and then only if it also calls `useDocumentTitle`).
3. **Thinking custom hooks share state across components.** Two components calling `useDocumentTitle` each get their own independent effect. There's no shared variable between them — each hook call is isolated in its calling component's fiber.

---

### useEffect cleanup for imperative DOM state

**Plain English**
`useEffect` cleanup — returning a function from the effect — runs when the component unmounts or when the dependency array changes before the next effect runs. You've already seen cleanup for event listeners (`document.removeEventListener`) and for aborting fetch requests (`promise.abort()`). `document.title` is a third case: a piece of browser state that your component changed and should restore when it leaves. Without cleanup, side effects accumulate — every page navigation leaves a permanent mark on global browser state.

**Technically Speaking**
React calls the cleanup function synchronously before unmounting the component from the DOM. It also calls the previous cleanup before re-running the effect when deps change. In `useDocumentTitle`, this means: when `title` changes from "Primary Checking" to "Emergency Savings" (because the user renamed the account), React calls `() => { document.title = previous }` with `previous = "Primary Checking"`, then immediately runs the new effect which sets `document.title = "Emergency Savings"`. The `previous` variable is captured at the time each effect runs — it's a new closure on each invocation.

**Vue / Laravel Analogy**
Vue's `onUnmounted` hook:
```ts
const previous = document.title
onUnmounted(() => { document.title = previous })
```
This is the unmount-only cleanup. Vue's `watchEffect` with the `onInvalidate` callback is the closer equivalent to React's full cleanup (runs both on change and unmount):
```ts
watchEffect((onInvalidate) => {
  document.title = title
  onInvalidate(() => { document.title = previous })
})
```
React's approach — returning a cleanup function from the effect itself — is more concise because the cleanup is co-located with the work it undoes.

**Common Mistakes**
1. **Not capturing `previous` at the start of the effect.** If you read `document.title` in the cleanup function instead of in the effect setup, you'll read the title that's current at cleanup time — which might already be something else. Capture it at the top of the effect body.
2. **Assuming cleanup only runs on unmount.** Cleanup runs before every re-run of the effect, not just unmount. If `title` changes, the cleanup fires (restoring the old title) before the new effect fires (setting the new title). For `useDocumentTitle` this is actually correct behavior — it ensures no intermediate stale title persists.

---

## Code Walkthrough

### The entire hook
```ts
import { useEffect } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);
}
```
Seven lines. `previous` is captured inside the effect closure — it's the title that was set *before this component changed it*. `document.title = title` is the imperative write. The cleanup function restores `previous`. `[title]` means: re-run when `title` changes, and run cleanup first. The return type `void` is explicit — this hook produces behavior, not values.

### Calling it before the early return in AccountDetail
```ts
useDocumentTitle(account?.name ?? 'FinFlow');
// ...
if (!account) {
  return <section>...</section>;
}
```
`useDocumentTitle` is called unconditionally at the top of the component, before the `if (!account)` early return. This is required by the rules of hooks — React tracks hooks by call order, and an early return before a hook call would make the call count unpredictable. `account?.name ?? 'FinFlow'` handles the null case without any conditional logic.

### Reactive title update on rename
When the user renames an account, `renameAccountThunk` updates the store → `account.name` changes → `account?.name ?? 'FinFlow'` produces a new string → `useDocumentTitle` receives a new `title` argument → the `[title]` dependency triggers the effect → `document.title` updates to the new name. The tab stays in sync with the store automatically, with no extra wiring.

---

## What to Remember

- Custom hooks are functions starting with `use` — React enforces the rules of hooks on them, but they're just functions. No registration, no provider.
- Custom hooks share *behavior*, not state — two components calling the same hook each get their own independent effect instance.
- Always call hooks at the top level — before early returns — and handle null/undefined with fallbacks like `account?.name ?? 'FinFlow'`.
- Capture imperative state (`const previous = document.title`) at the top of the effect body, not inside the cleanup function — cleanup runs after other effects may have changed the value.
- `useEffect` cleanup runs before every re-run (when deps change) AND on unmount — not just unmount.
