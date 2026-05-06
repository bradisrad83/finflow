# useRef (autofocus-search)

## What Was Built
A `useRef` attached to the search input in `AccountDetail` that automatically focuses the input once transactions finish loading, so users can start typing immediately without clicking.

## File Location
`src/pages/AccountDetail.tsx`

---

## Concepts Introduced

### useRef — a persistent box that doesn't cause re-renders

**Plain English**
React normally works declaratively: you describe what the UI should look like, and React handles the DOM. But sometimes you need to reach past that and touch a real DOM element directly — like telling an input to grab keyboard focus. `useRef` gives you a box you can attach to any DOM node. Once attached, `ref.current` is the actual HTML element, and you can call any native browser method on it: `.focus()`, `.blur()`, `.select()`, `.scrollIntoView()`, etc.

The box itself persists across renders — it's the same object every time the component re-renders. But unlike `useState`, changing what's inside the box doesn't trigger a re-render. That's the key distinction: refs are for values you need to *hold* but not *react to*.

**Technically Speaking**
`useRef<T>(initialValue)` returns a `MutableRefObject<T>` — an object with a single `.current` property typed as `T`. React treats the `ref` prop specially: after the DOM node mounts, React assigns the element to `ref.current`. After it unmounts, React sets `ref.current` back to `null`. This assignment happens outside of React's render cycle, so it never triggers a re-render. The TypeScript generic constrains what `.current` can hold — `useRef<HTMLInputElement>(null)` means `.current` is `HTMLInputElement | null`, giving you full autocomplete and type safety on DOM methods.

Under the hood, `useRef` is essentially `useState` with no setter — the same persistent slot in the fiber, just without the dispatch machinery. This is why it's stable across renders: it's tied to the component instance, not the render call.

**Vue / Laravel Analogy**
In Vue 3, this is `templateRef`:
```ts
// Vue 3
const searchRef = ref<HTMLInputElement | null>(null)
// template: <input :ref="searchRef" />
onMounted(() => searchRef.value?.focus())
```
The mental model is identical — a reactive reference to a DOM node, attached via a special attribute. The difference is naming: Vue calls it `ref`, React calls it `useRef`, and React attaches it via `ref={searchRef}` as a JSX prop. Vue's `.value` accessor is React's `.current`.

There's no Laravel equivalent — this is a browser/DOM concept with no server-side analogue.

**Common Mistakes**
1. **Reading `ref.current` during render.** On the first render, the DOM doesn't exist yet, so `ref.current` is `null`. Only access it inside `useEffect` (after mount) or in event handlers (after the user has interacted).
2. **Using `useRef` when you mean `useState`.** If you find yourself writing `ref.current = newValue` and expecting the UI to update — that's `useState`. Refs don't trigger re-renders. Use a ref only when you need to hold a value *without* the UI reflecting that change.
3. **Forgetting `?.` when calling methods.** `searchRef.current.focus()` will throw if the ref isn't attached yet. `searchRef.current?.focus()` is safe — it's a no-op when `current` is null.

---

### The ref prop — attaching a ref to a DOM node

**Plain English**
React's `ref` prop is special — it's not passed to the component like other props. React intercepts it and, after painting the DOM, writes the real HTML element into `ref.current`. You just put `ref={searchRef}` on any DOM element and React handles the wiring.

**Technically Speaking**
`ref` is a reserved prop in React (like `key`) — it's never forwarded to the underlying DOM node as an attribute. During the commit phase (after rendering), React calls `ref.current = domNode` for `useRef` objects, or calls the function if you pass a callback ref. For class components, refs point to the instance; for DOM elements, they point to the actual `HTMLElement`. If you need to attach a ref to a custom component, that component must explicitly forward it using `React.forwardRef`.

**Vue / Laravel Analogy**
Vue's `:ref="searchRef"` or `ref="searchRef"` (in template syntax) is the direct equivalent. The attachment mechanism is the same: the framework writes the DOM node into the ref after mounting.

**Common Mistakes**
1. **Trying to put `ref` on a custom React component without `forwardRef`.** `<MyInput ref={inputRef} />` will not work unless `MyInput` is wrapped with `React.forwardRef`. It works on native DOM elements (`<input>`, `<div>`, etc.) without any special handling.

---

### Timing a focus call with useEffect and a loading flag

**Plain English**
You could try to call `.focus()` right when the component mounts, but that would focus the input before the transaction list even loads — the page is still blank at that point. By watching `txLoading` in a `useEffect`, the focus fires at the exact moment that's useful: when the data arrives and the user is ready to search.

**Technically Speaking**
`useEffect(() => { ... }, [txLoading])` runs after every render where `txLoading` has changed. When `txLoading` transitions from `true` → `false` (the `fetchTransactions` thunk resolves), the effect fires and `searchRef.current?.focus()` runs. Because `useEffect` always runs after the browser has painted, the DOM is guaranteed to be present and visible when the focus call happens. This is exactly why you can't call `.focus()` during render — the DOM isn't there yet.

**Vue / Laravel Analogy**
In Vue 3 you'd `watch` the loading state:
```ts
watch(txLoading, (loading) => {
  if (!loading) searchRef.value?.focus()
})
```
Same trigger, same outcome. React's `useEffect` with a dependency array is the functional equivalent of Vue's `watch` — run this side effect when this value changes.

**Common Mistakes**
1. **Calling `.focus()` directly in the component body.** The component body runs during render, before React commits to the DOM. The ref isn't populated yet and the call is a no-op at best, a crash at worst.
2. **Using an empty dep array `[]` instead of `[txLoading]`.** An empty array means "run once on mount" — which fires before transactions load. The focus would trigger immediately, before the data arrives, and the loading state transition would never re-trigger it.

---

## Code Walkthrough

### Creating the ref
```ts
const searchRef = useRef<HTMLInputElement>(null);
```
The generic `<HTMLInputElement>` tells TypeScript what type of DOM node this ref will hold. `null` is the initial value — honest, because the element doesn't exist in the DOM until React mounts it. From this point on, `searchRef` is a stable object whose `.current` property React will manage.

### Attaching to the DOM node
```tsx
<input ref={searchRef} ... />
```
This is the wiring step. React sees the special `ref` prop and, after painting the DOM, writes the real `<input>` element into `searchRef.current`. No extra code needed — React handles it automatically during the commit phase.

### The focus effect
```ts
useEffect(() => {
  if (!txLoading) searchRef.current?.focus();
}, [txLoading]);
```
Two things worth noting. First: the `if (!txLoading)` guard — this effect fires on both the `true → false` transition (loading finished, focus the input) and the `false → true` transition (a new fetch started, don't do anything). The guard filters to the useful case. Second: `?.` optional chaining — defensive, not hypothetical. In theory `searchRef.current` is always populated by the time this effect runs after mount, but `?.` costs nothing and prevents any edge case where the ref is transiently null.

### Why not just use the HTML `autofocus` attribute?
```tsx
<input autoFocus ... />
```
`autoFocus` fires on mount — before transactions load — so the user gets focus on an empty list. Tying focus to `txLoading` means it fires when the data is actually ready to be searched, which is the useful moment.

---

## What to Remember

- `useRef` gives you a stable box tied to the component instance — `ref.current` persists across renders but changing it never triggers a re-render.
- Attach a ref to a DOM node with `ref={myRef}` — React populates `myRef.current` after mount and clears it on unmount.
- Always access `ref.current` inside `useEffect` or event handlers, never during render — the DOM doesn't exist yet during render.
- Use `?.` when calling methods on `ref.current` — it's `HTMLInputElement | null` by type, and the optional chain makes the null case a safe no-op.
- Prefer tying focus (and similar imperative DOM calls) to a meaningful state transition rather than bare mount — it fires at the moment that's actually useful to the user.
