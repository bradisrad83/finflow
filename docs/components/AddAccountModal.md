# AddAccountModal — createPortal and the Modal Pattern

## What Was Built
A modal dialog triggered from the Accounts heading that lets the user create a new account, rendered via `createPortal` directly onto `document.body` so it escapes any stacking context or overflow clipping from the app's DOM hierarchy.

## File Location
`src/components/AddAccountModal.tsx`, `src/components/AccountsOverview.tsx`

---

## Concepts Introduced

### createPortal

**Plain English**
Normally, whatever JSX a component returns gets rendered inside that component's place in the DOM tree. `createPortal` breaks that rule: you still write the JSX inside your component (so it has access to all your state, props, and hooks), but the actual DOM nodes get placed somewhere else entirely — in this case, directly on `<body>`.

The reason this matters for modals is physical: your app's root `<div>` might have `overflow: hidden` set (to contain scrollable regions), or it might be inside a CSS stacking context with a `z-index`. A modal rendered inside that subtree would be clipped or hidden behind other layers no matter how high you set its `z-index` — because `z-index` is only evaluated within a stacking context, not across the whole page. Portaling to `<body>` puts the modal outside any of those constraints. It floats above everything.

Crucially, the *logic* of the modal stays inside `AccountsOverview`. `modalOpen`, `setModalOpen`, the dispatch call — all of that lives in the parent, and the portal just affects where the pixels land, not where the code lives.

**Technically Speaking**
`createPortal(children: ReactNode, container: Element): ReactPortal`

The returned `ReactPortal` is a valid React node — you return it from `render`/the component function like any other JSX. React renders its children into `container` rather than the component's normal DOM parent. Event bubbling still follows the *React tree* (not the DOM tree), which is the non-obvious part: a click inside the portaled modal will bubble up through `AccountsOverview` in React's event system, even though the DOM node is on `<body>`. React's synthetic event system is tree-aware, not DOM-aware.

The `container` argument must be a real DOM node. `document.body` is the standard choice for full-screen modals. You can also portal into a specific `<div id="modal-root">` if you want more control over CSS inheritance.

**Vue / Laravel Analogy**
Vue 3's `<Teleport>` is the direct equivalent:

```html
<Teleport to="body">
  <div class="modal-backdrop" @click="close">
    <div class="modal" @click.stop>...</div>
  </div>
</Teleport>
```

Same semantics: component logic stays in the parent component's `<script setup>`, DOM output lands on `body`. Vue named it "teleport" (moving something from one place to another); React named it "portal" (a doorway to another location). The concept is identical.

In Laravel's Blade, `@stack` / `@push` is a distant analogy — pushing content from a child view into a named stack in the layout. But it's compile-time, not runtime, and doesn't involve stacking contexts.

**Common Mistakes**
- **Not using a portal and then fighting z-index.** The symptom is a modal that appears behind other content or gets clipped. The root cause is always a stacking context on an ancestor. Portaling to `body` fixes it; adding higher `z-index` values doesn't.
- **Forgetting that events still bubble through the React tree.** A `stopPropagation` on a portaled element stops bubbling through React's virtual tree — which means it can stop handlers on React ancestors even though the DOM parent is `body`. This is usually what you want, but it surprises people who expect portal DOM position to equal React tree position.
- **Accessing the container before the DOM is ready.** `document.body` is always available in a browser. But if you create a custom container element (`document.getElementById('modal-root')`), make sure it exists in `index.html` before the React app loads — otherwise the portal call gets `null` and throws.

---

### The Backdrop Click Pattern

**Plain English**
The modal has two layers: a full-screen backdrop (the dark overlay) and the modal card on top. Clicking the backdrop should close the modal; clicking anywhere inside the card should not. This is done by putting `onClick={onClose}` on the backdrop and `onClick={(e) => e.stopPropagation()}` on the card. `stopPropagation` prevents the click from traveling up from the card to the backdrop. Without it, clicking a button inside the modal would close it — because the click bubbles up through every ancestor until it hits the backdrop's handler.

**Technically Speaking**
DOM events bubble upward through the tree by default: a click on a child fires the child's handler, then the parent's, then the grandparent's, all the way to `document`. `stopPropagation()` cuts the bubble at the element it's called on — the event fires there, and goes no further up.

In React this is `e.stopPropagation()` on the synthetic event — React's normalized wrapper around the native event. It calls `nativeEvent.stopPropagation()` under the hood. Because React delegates all events to the root (`document` or the React root container in React 18), the call actually stops propagation in the native event system at the root, not at each individual element — but the effect is the same from the component's perspective.

The two-div structure is the canonical pattern:
```tsx
<div onClick={onClose}>           {/* backdrop: click anywhere closes */}
  <div onClick={e => e.stopPropagation()}>  {/* card: click doesn't reach backdrop */}
    ...
  </div>
</div>
```

**Vue / Laravel Analogy**
In Vue this is `@click.stop` on the modal card:

```html
<div @click="close">
  <div @click.stop>
    <!-- clicks here don't close the modal -->
  </div>
</div>
```

Vue's `.stop` modifier calls `event.stopPropagation()` — syntactic sugar for the exact same thing. React has no equivalent shorthand; you write the arrow function yourself.

**Common Mistakes**
- **Putting `onClick={onClose}` on the modal card instead of the backdrop.** This closes the modal whenever you click anything inside it. The close handler belongs on the outermost backdrop layer, not the content layer.
- **Using `e.preventDefault()` instead of `e.stopPropagation()`.** `preventDefault` stops the browser's default action (like form submission or link navigation). It has nothing to do with event bubbling. They're different things and often confused.

---

### Mount/Unmount for Modal Lifecycle

**Plain English**
The modal is conditionally rendered: `{modalOpen && <AddAccountModal onClose={...} />}`. When `modalOpen` is `false`, the component doesn't exist in the React tree at all — no DOM nodes, no event listeners, no state. When `modalOpen` becomes `true`, the component mounts fresh: `useState` initializes the form fields to empty strings, and the `useEffect` registers the ESC key listener. When `modalOpen` goes back to `false`, the component unmounts: React discards the state, and the effect's cleanup removes the event listener.

This means you get automatic form reset for free — you never have to manually clear the name field or reset the type select back to "checking." Unmounting is the reset.

**Technically Speaking**
When React removes a component from the tree (either by a conditional render evaluating to `false` or by a parent unmounting), it:
1. Runs all of the component's `useEffect` cleanup functions, in reverse order of registration.
2. Removes the component's DOM nodes.
3. Discards all `useState` and `useReducer` state.

On the next mount (when `modalOpen` becomes `true` again), the component starts completely fresh — `useState('')` produces an empty string, not the value from the last session.

The alternative is "always render, toggle visibility with CSS" (`display: none` or `opacity-0 pointer-events-none`). That approach preserves state across opens, which is occasionally useful (if the user partially fills a form and you want it still there when they reopen). But it keeps all effects running and state allocated even when invisible, which is wasteful for a form that should always start clean.

**Vue / Laravel Analogy**
In Vue, `v-if` is the equivalent — it mounts and unmounts the component. `v-show` toggles CSS display without unmounting, preserving state. The React `&&` operator maps to `v-if`; there's no built-in equivalent to `v-show` (you'd manage it manually with a CSS class). The tradeoff is the same in both frameworks: `v-if` / `&&` = clean state, lower memory when hidden; `v-show` / always-render = preserved state, always in memory.

**Common Mistakes**
- **Using always-render when the form should reset.** If you render `<AddAccountModal isOpen={modalOpen} />` and hide it with a CSS class, the name field retains whatever the user typed last time. Usually not what you want for a creation form.
- **Trying to animate a component that's been unmounted.** Unmounting removes DOM nodes immediately — there's no time for a CSS fade-out. To animate the close, you need to keep the component mounted during the animation (either with a `'fading'` state like the undo toast, or with a library like `framer-motion`).

---

## Code Walkthrough

### `createPortal` call

```tsx
return createPortal(
  <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
    <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
    <div className="relative w-full max-w-md ..." onClick={(e) => e.stopPropagation()}>
      ...
    </div>
  </div>,
  document.body,
);
```

`createPortal` takes two arguments: the JSX tree to render, and the DOM node to render it into. The entire return value of the component is a portal — there's no other JSX outside it. The outermost `div` uses `fixed inset-0` (covers the full viewport, position fixed) with `z-50` (above everything). Inside are two children: the purely visual backdrop div (black semi-transparent overlay), and the actual modal card that stops click propagation.

### ESC key handler

```ts
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [onClose]);
```

Global `keydown` listener registered on mount, removed on unmount. The dep array `[onClose]` means: if the `onClose` function reference changes between renders, remove the old listener and add a new one pointing to the latest reference. In practice `onClose` is `() => setModalOpen(false)` defined inline in `AccountsOverview` — a new reference on every render. This works correctly but means the listener re-registers often. Stabilizing `onClose` with `useCallback` in the parent would prevent that, but it's an invisible optimization here since it happens off-screen.

The cleanup `return () => document.removeEventListener(...)` is not optional — without it, every time the modal opens it adds another listener that never gets removed. After five opens you have five simultaneous ESC handlers, all firing on the same keypress.

### `autoFocus` on the name input

```tsx
<input
  type="text"
  placeholder="Account name"
  autoFocus
  ...
/>
```

`autoFocus` tells the browser to focus this input immediately when the component mounts. Because the modal mounts on button click, focus jumps into the form automatically — the user can start typing the account name without clicking the input. This is a small but meaningful UX detail: modals should trap focus on open, not leave it on the button that triggered them.

### Conditional render in `AccountsOverview`

```tsx
{modalOpen && <AddAccountModal onClose={() => setModalOpen(false)} />}
```

One line at the bottom of the section's JSX. The modal renders into `document.body` via the portal, so its visual position (centered, full-screen overlay) has nothing to do with where this line appears in the JSX. It could be anywhere in the return — the portal destination is what matters, not the JSX position.

---

## What to Remember

- `createPortal(jsx, domNode)` renders JSX output to a different DOM location while keeping component logic (state, hooks, event handlers) in the React tree where it's written. Use it for modals, tooltips, and dropdowns that need to escape stacking contexts.
- Events bubble through the React tree, not the DOM tree. A click inside a portaled modal still bubbles to React ancestors of the component that called `createPortal`.
- The backdrop/card click pattern: `onClick={onClose}` on the backdrop, `onClick={e => e.stopPropagation()}` on the card. Without `stopPropagation`, any click inside the modal closes it.
- Conditionally mount modals with `&&` rather than always rendering them hidden. Unmounting gives you free form reset and cleans up all effects and listeners automatically.
- `autoFocus` on the first input moves keyboard focus into the modal on open — a one-prop UX improvement that makes the modal keyboard-navigable without extra code.
