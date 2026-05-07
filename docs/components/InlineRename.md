# Inline Account Rename

## What Was Built
Clicking the account name on `AccountDetail` replaces it with an editable input that focuses instantly via `useLayoutEffect`, saves on Enter or blur, and cancels on Escape.

## File Location
`src/pages/AccountDetail.tsx`, `src/store/accountsSlice.ts`

---

## Concepts Introduced

### useLayoutEffect — DOM work before the browser paints

**Plain English**
`useLayoutEffect` is almost identical to `useEffect` — same API, same dependency array. The difference is timing. `useEffect` runs *after* the browser has painted the screen. `useLayoutEffect` runs *after* React updates the DOM but *before* the browser paints. This one-frame window is rarely needed, but when you need to do something to the DOM before the user sees it — like focusing an input that just appeared — `useLayoutEffect` is the right tool. With `useEffect`, the user would briefly see the unfocused input before it gains focus. With `useLayoutEffect`, focus happens before any pixel is drawn.

**Technically Speaking**
React's render cycle has three phases: render (computing the new virtual DOM), commit (applying mutations to the real DOM), and paint (the browser drawing pixels). `useEffect` schedules its callback after paint, asynchronously via the browser's `requestAnimationFrame` or a similar mechanism. `useLayoutEffect` schedules its callback synchronously at the end of the commit phase, before the browser gets a chance to paint.

This means `useLayoutEffect` can measure DOM layout (element dimensions, scroll positions) and make synchronous DOM mutations that affect what the user sees — without causing a flicker. The tradeoff: `useLayoutEffect` blocks painting, so expensive work inside it delays when the user sees the update. It should be reserved for DOM reads/writes that must be synchronous with the commit.

TypeScript type: `useLayoutEffect(effect: () => void | (() => void), deps?: DependencyList): void` — identical to `useEffect`.

**Vue / Laravel Analogy**
Vue's equivalent is `nextTick()` combined with a synchronous DOM access:
```ts
watch(editing, async (val) => {
  if (val) {
    await nextTick()  // waits for Vue's DOM update
    inputRef.value?.focus()
  }
})
```
`nextTick` is closer to `useEffect` — it waits for Vue to flush the DOM, but doesn't guarantee pre-paint execution. Vue doesn't have a direct `useLayoutEffect` equivalent; focusing an element before paint relies on Vue's microtask timing being faster than the browser's paint, which is usually true but not guaranteed.

In Laravel (server-rendered), focus behavior is impossible — the DOM doesn't exist on the server.

**Common Mistakes**
1. **Using `useLayoutEffect` by default instead of `useEffect`.** `useLayoutEffect` blocks painting and causes a React warning during server-side rendering (because there's no DOM). Only use it when you specifically need pre-paint DOM access. For data fetching, timers, subscriptions, and most side effects, `useEffect` is correct.
2. **Using `useLayoutEffect` for non-DOM work.** If you're not reading or writing the DOM (measuring dimensions, focusing elements, setting scroll position), `useEffect` is the right choice. `useLayoutEffect` for a Redux dispatch or a `console.log` adds risk with no benefit.
3. **Forgetting that `useLayoutEffect` doesn't run during SSR.** React logs a warning if `useLayoutEffect` is called in a server-rendered component. Use `useEffect` instead, or conditionally apply `useLayoutEffect` only in the browser.

---

### Inline editing pattern — controlled input as replacement for static text

**Plain English**
Inline editing swaps a display element for an input element based on a boolean flag. When `editing` is false, the user sees the account name as a heading. When they click it, `editing` becomes true, the heading is replaced by an input pre-filled with the current name, and the user can type a new name. On blur or Enter, the input submits the change and `editing` returns to false. The swap is instant and happens in the same render pass.

**Technically Speaking**
```ts
const [editing, setEditing] = useState(false);
const [draft, setDraft] = useState('');
```
Two state variables: `editing` (a boolean gate) and `draft` (the controlled value of the input). When entering edit mode, `draft` is initialized to `account.name` — the current name becomes the pre-filled value the user edits. The input is fully controlled (`value={draft}`, `onChange={(e) => setDraft(e.target.value)}`). On commit, `draft.trim()` is sent to the API; if empty or unchanged, `setEditing(false)` exits without a dispatch. The `finally` block in `handleRename` ensures edit mode always closes, even if the API throws.

**Vue / Laravel Analogy**
In Vue 3:
```html
<h2 v-if="!editing" @click="startEdit">{{ account.name }}</h2>
<input v-else v-model="draft" @blur="save" @keydown.enter="save" @keydown.escape="editing = false" />
```
`v-if`/`v-else` is identical to React's ternary conditional render. `v-model` is the Vue equivalent of `value={draft}` + `onChange={(e) => setDraft(e.target.value)}` — a two-way binding shorthand. In Laravel Livewire, `wire:model` serves the same role.

**Common Mistakes**
1. **Not initializing `draft` to the current value when entering edit mode.** If you initialize `draft` to `''` and only set it in the `onClick`, the input starts empty — the user has to re-type the existing name.
2. **Closing edit mode in `catch` only.** If the dispatch succeeds but the component re-renders for an unrelated reason during the async call, the edit state can persist unexpectedly. Using `finally` ensures cleanup in all cases.
3. **Forgetting to handle Escape.** Without an Escape handler, the user has no obvious way to cancel an edit without typing the original name back.

---

## Code Walkthrough

### The useLayoutEffect focus
```ts
useLayoutEffect(() => {
  if (editing) {
    renameRef.current?.focus();
    renameRef.current?.select();
  }
}, [editing]);
```
Fires when `editing` changes. When it becomes `true`, React has already swapped the `<h2>` for the `<input>` in the DOM — `renameRef.current` now points to the real input element. `.focus()` gives it keyboard focus; `.select()` highlights all text so the user can immediately type a replacement without manually selecting. Both happen before the browser paints, so the user always sees a focused, selected input.

### Entering and exiting edit mode
```tsx
<h2
  onClick={() => { setDraft(account.name); setEditing(true); }}
  className="... cursor-pointer hover:text-blue-500 ..."
  title="Click to rename"
>
  {account.name}
</h2>
```
`setDraft(account.name)` initializes the draft to the current name — the `useLayoutEffect` will then fire, focus the input, and select this pre-filled value. `title="Click to rename"` provides a native tooltip on hover, making the affordance discoverable without adding persistent UI chrome.

### The commit function
```ts
async function handleRename() {
  if (!account) return;
  const trimmed = draft.trim();
  if (!trimmed || trimmed === account.name) { setEditing(false); return; }
  try {
    await dispatch(renameAccountThunk({ ...account, name: trimmed })).unwrap();
  } finally {
    setEditing(false);
  }
}
```
Two early-return cases: empty string (invalid name) and unchanged name (no-op). Both just exit edit mode. The dispatch sends the full account object with the updated name — the Haskell handler only uses `name` and `id`. `finally` guarantees `setEditing(false)` regardless of success or failure.

### The input in edit mode
```tsx
<input
  ref={renameRef}
  type="text"
  value={draft}
  onChange={(e) => setDraft(e.target.value)}
  onBlur={handleRename}
  onKeyDown={(e) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') setEditing(false);
  }}
  className="mt-1 text-2xl font-semibold ... bg-transparent border-b-2 border-blue-400 focus:outline-none w-full"
/>
```
`bg-transparent` makes the input visually inherit the page background, so it looks like text editing rather than a form field appearing. `border-b-2 border-blue-400` provides a bottom-only underline — a minimal affordance that communicates "editable" without the visual weight of a full input border. `focus:outline-none` removes the default browser focus ring since the underline already signals focus.

---

## What to Remember

- `useLayoutEffect` fires after React's commit but before the browser paints — use it only for DOM work that must be synchronous with the render (focus, measure, scroll).
- For everything else (fetching, timers, subscriptions), use `useEffect`.
- Initialize the edit `draft` to the current value when entering edit mode — don't start with an empty string.
- Use `finally` to exit edit mode — it ensures cleanup whether the API call succeeds, fails, or the component unmounts mid-flight.
- `useLayoutEffect` logs a warning during SSR — if your app ever server-renders, guard it with `typeof window !== 'undefined'` or switch to `useEffect`.
