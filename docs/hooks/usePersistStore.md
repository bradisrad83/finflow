# usePersistStore — localStorage Persistence

## What Was Built
A `useEffect`-based hook that watches the entire Redux store and writes its state to `localStorage` on every change, paired with a hydration step in the store config that loads any saved state on app boot — so refreshing the page no longer wipes added transactions or balance edits.

## File Location
`src/hooks/usePersistStore.ts`, `src/store/index.ts`, `src/App.tsx`

---

## Concepts Introduced

### useEffect (Intentional Use)

**Plain English**
`useEffect` is a hook that runs a function *after* a component renders, then re-runs it whenever values in its dependency array change. It's how you do "side effects" in React — anything that talks to the world outside React's render tree, like writing to localStorage, calling APIs, setting up timers, or syncing with non-React libraries. The dependency array is what tells React when to fire the effect: pass `[state]` and it runs whenever `state` changes; pass `[]` and it runs only once on mount.

**Technically Speaking**
`useEffect(fn, deps)` schedules `fn` to run after the browser has committed the rendered output to the DOM (asynchronously, after paint, unless you use `useLayoutEffect`). React stores `[fn, deps]` in the component's hook slot. On subsequent renders, React compares each item in the new `deps` array to the saved one using `Object.is`. If any item differs, the previous effect's cleanup function (if any) is called, then `fn` runs again with the latest closure. If all deps match, the effect is skipped.

`useEffect` is the canonical bridge between React's pure-function world (render is supposed to be a deterministic projection of state to UI) and the impure outside world (DOM APIs, network, storage). The first render always runs the effect; subsequent renders only run it if deps changed.

**Vue / Laravel Analogy**
This is closest to Vue 3's `watch` / `watchEffect`:
- `useEffect(() => ..., [state])` ≈ `watch(state, () => ...)` — runs when `state` changes.
- `useEffect(() => ..., [])` ≈ `onMounted(() => ...)` — runs once after mount.
- `useEffect(() => ...)` (no deps array) ≈ `watchEffect` that fires on every render — almost never what you want.

The big difference: Vue tracks reactive dependencies automatically. React makes you list them. This is more verbose but more explicit — you can see at a glance what causes an effect to fire, and ESLint can catch missing deps via `eslint-plugin-react-hooks`.

In Laravel, the closest analog is a model observer or event listener — but those run at the framework level, not the component level. Components don't really have lifecycle equivalents in Laravel because rendering is server-side and one-shot.

**Common Mistakes**
- **Missing dependencies.** Closing over a variable from props/state without listing it in deps. The effect uses a stale value forever. ESLint's `react-hooks/exhaustive-deps` catches this.
- **Forgetting cleanup.** If your effect sets up a subscription, timer, or event listener, return a cleanup function. Otherwise you'll leak memory or fire stale handlers.
- **Using `useEffect` for derived state.** If you find yourself writing `useEffect(() => setX(deriveFrom(y)), [y])`, you should be using `useMemo` instead — derived state isn't a side effect.

---

### preloadedState (Synchronous Hydration)

**Plain English**
`preloadedState` is an option you pass to `configureStore` that tells Redux: "instead of using each slice's default state, start with this object." It's how you hydrate a Redux store from an external source (localStorage, server-rendered HTML, etc.) before the app renders. If you pass `undefined`, Redux falls back to each slice's `initialState` — which is what happens for first-time visitors.

**Technically Speaking**
`configureStore({ reducer, preloadedState })` calls each reducer with `preloadedState[sliceName]` (or `undefined` for slices not present) as the initial state, before any user actions. If the value is `undefined`, the slice's reducer returns its built-in `initialState`. This happens once, synchronously, when the store is created — before React mounts.

The alternative — dispatching a "hydrate" action inside a `useEffect` after mount — causes a visible flash where the UI renders with default state for one frame, then re-renders with the saved state. `preloadedState` avoids that by completing hydration before the first render even starts.

**Vue / Laravel Analogy**
In Pinia, this is `pinia.state.value = savedState` before `app.use(pinia)`. In Vuex, `new Vuex.Store({ state: savedState, ... })`. Both happen synchronously at app boot, before any component renders.

In Laravel, this is closer to setting initial values on a model in the controller before passing it to a Blade view — the data is "preloaded" before the view renders.

**Common Mistakes**
- **Hydrating with a `useEffect` instead.** Causes a render flash and complicates components. Always hydrate via `preloadedState` if the source is synchronous.
- **Trusting parsed JSON without a type assertion.** `JSON.parse` returns `any`. If your saved schema doesn't match what your slices expect, the store starts in an invalid state and crashes on the first action. Always wrap in `try/catch` and ideally validate the shape.
- **Persisting and hydrating sensitive data.** localStorage is plain text accessible to any JS on the page. Never persist auth tokens, PII, or secrets there.

---

### Renderless / Headless Components

**Plain English**
A renderless component is a component that exists purely to run logic — it returns `null` (or nothing) and produces no visible output. The pattern shows up when you need to attach a hook to the React tree but don't have UI to attach it to. In our case, `<StorePersistence />` exists only to call `usePersistStore()` inside the Redux `<Provider>` context.

**Technically Speaking**
Returning `null` from a function component is a valid render result — React skips DOM creation but still treats the component as part of the tree. It runs hooks, fires effects, holds state, and re-renders normally. Renderless components are useful when:
- A hook needs a specific position in the tree (e.g., inside a context provider).
- You want to isolate re-renders (a component subscribed to volatile state can re-render without causing parents/siblings to re-render).
- You're abstracting cross-cutting behavior (analytics, persistence, focus management).

In our case, `<StorePersistence />` solves the second concern: it subscribes to the entire Redux state via `useSelector(state => state)` and re-renders on every dispatch, but since it returns `null`, only that empty component re-renders — the rest of the tree is untouched.

**Vue / Laravel Analogy**
Vue 3 has the same pattern: a component whose `setup()` returns `() => null` (or an empty template). Vue calls these "renderless components" too. Common use cases (`<RouterView>` doesn't qualify; mount-only mixins do).

Laravel doesn't have a direct analog because Laravel components always render output — the closest is a service class registered in the container, but that's not view-tree concept.

**Common Mistakes**
- **Putting the hook in `App` directly.** Then *every* state change re-renders `App` and forces React to reconcile the entire tree (still cheap because of bailouts, but unnecessary).
- **Putting it outside `<Provider>`.** The hook calls `useSelector`, which throws without Redux context. Renderless components need to live where their hooks can resolve their dependencies.
- **Adding UI to a renderless component "just in case."** If it has no UI today, return `null`. If it grows UI tomorrow, refactor then.

---

## Code Walkthrough

### `src/hooks/usePersistStore.ts`

```ts
function usePersistStore() {
  const state = useSelector((state: RootState) => state);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
}
```

Three things are happening, all in five lines.

`useSelector((state: RootState) => state)` subscribes the component to the entire store. Every dispatched action runs this selector. Because Redux Toolkit uses Immer, any state-mutating reducer produces a *new* root state reference, which fails the default `Object.is` equality check, which triggers a re-render of this component.

`useEffect(() => { ... }, [state])` runs after each render where `state` changed. The dependency array contains exactly one item: the state reference. Since the state object is recreated on every dispatch, the effect fires on every dispatch — exactly what we want.

`localStorage.setItem(STORAGE_KEY, JSON.stringify(state))` is the actual side effect — synchronously writing the serialized state to the browser's persistent storage. Note: `JSON.stringify` is synchronous and can be slow on huge objects. For our app it's fine; for a 50MB Redux store it would be a problem and you'd debounce or move to IndexedDB.

### `src/store/index.ts`

```ts
function loadPersistedState(): PersistedState | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return undefined;
  }
}

export const store = configureStore({
  reducer: { accounts: accountsReducer, transactions: transactionsReducer },
  preloadedState: loadPersistedState(),
});
```

`loadPersistedState` runs once at module load (which is once at app boot). It returns either a typed snapshot or `undefined`. The `try/catch` handles two failure modes: missing data (no key in localStorage) and corrupt data (JSON.parse throws). Either way we fall back to `undefined`, which makes `configureStore` use each slice's built-in `initialState`.

The `as PersistedState` cast on `JSON.parse(raw)` is a *trust statement* — TypeScript can't verify the shape of arbitrary JSON, so we're declaring the assumption explicitly. This is the only honest way to type a parse boundary in TypeScript. If the real shape doesn't match, the `try/catch` is your last line of defense.

### `src/App.tsx`

```tsx
function StorePersistence() {
  usePersistStore();
  return null;
}

function App() {
  return (
    <Provider store={store}>
      <StorePersistence />
      <BrowserRouter>...</BrowserRouter>
    </Provider>
  );
}
```

The renderless component lives inside `<Provider>` (so `useSelector` works) but outside `<BrowserRouter>` (it doesn't care about routing). It re-renders on every state change but produces no DOM, so the cost is minimal.

---

## What to Remember

- `useEffect(fn, deps)` runs after render — use it for side effects (storage, APIs, timers), not for derived values (use `useMemo` instead).
- Hydrate Redux via `preloadedState`, not via a `useEffect` that dispatches a hydrate action — `preloadedState` runs before the first render, so there's no flash.
- `JSON.parse` returns `any`. Wrap parsing in `try/catch` and assert a specific shape; an `as` cast at the parse boundary is the only honest way to type external data.
- A component that returns `null` is valid React — useful for hosting hooks in a specific tree position without producing DOM.
- Selecting the whole state (`state => state`) is normally bad practice, but it's correct when the component's *purpose* is to react to any state change. Isolate it in a renderless component so you don't drag the whole tree into re-rendering.
