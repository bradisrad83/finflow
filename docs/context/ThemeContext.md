# ThemeContext — App-Wide State via Context

## What Was Built
A `<ThemeProvider>` and `useTheme()` hook that own a single `'light' | 'dark'` value, persist it to localStorage, and toggle the `dark` class on `<html>` so every Tailwind `dark:` variant flips at once — surfaced as a "Dark mode / Light mode" button in the app header.

## File Location
`src/context/ThemeContext.tsx`, `src/App.tsx`, `tailwind.config.js`

---

## Concepts Introduced

### Context API

**Plain English**
Context is React's built-in way to share a value with every component below a certain point in the tree, without passing it through props at every level. You declare a context once, wrap part of your app in a `<Provider value={...}>`, and any descendant — no matter how deep — can ask for that value with a single hook call. It exists because "prop drilling" (forwarding the same prop through five layers of components that don't care about it) gets miserable fast for things every screen needs: theme, current user, locale, feature flags.

The catch is that every component reading the context re-renders whenever the context value changes. So context is right for state that changes *rarely* and is read *widely* (theme, locale, auth user). It is wrong for state that changes constantly (form inputs, mouse position, server data) — for those you want Redux, local state, or a data-fetching library, all of which can subscribe more selectively.

**Technically Speaking**
- `createContext<T>(defaultValue)` returns a `Context<T>` object with two members: `Provider` and `Consumer` (we only use the Provider in modern React; `useContext` replaces the Consumer pattern).
- `<MyContext.Provider value={x}>` makes `x` available to any descendant. The provider does *not* hold the value — it just publishes it. The actual state lives in whatever component owns the provider (here, `ThemeProvider` owns a `useState`).
- `useContext(MyContext)` reads the nearest provider's `value`. If there's no provider above, the hook returns the `defaultValue` from `createContext`.
- React tracks each consumer. When `value` (compared by `Object.is`) changes, React schedules a re-render of every component that called `useContext(MyContext)`, regardless of memoization. There's no fine-grained subscription — it's all-or-nothing.
- Because of that, context values that are objects (`{ theme, toggleTheme }`) are usually stabilized: keep `toggleTheme` referentially stable with `useCallback`, and the bundle won't fire spurious re-renders.

The typical pattern: a custom hook (`useTheme`) wraps `useContext` and (a) hides the context object from consumers, (b) throws a clear error when used outside the provider. Consumers never import the raw context.

**Vue / Laravel Analogy**
This is React's `provide` / `inject`. In Vue 3:

```ts
// Parent: provide('theme', { theme, toggleTheme })
// Child:  const theme = inject<ThemeContextValue>('theme')
```

Same shape, same purpose, same tradeoff (every injector re-renders on change). Vue's reactivity is finer-grained at the property level — refs touched inside the injected object only re-render components that actually read those refs — whereas React's context fires on the whole value object. That's why React patterns lean on `useMemo` / `useCallback` to stabilize context values; Vue rarely needs that.

In Laravel, the closest analogy is the service container with a singleton: `app()->singleton(ThemeService::class, ...)`. Anywhere in the request lifecycle you can `app(ThemeService::class)` to read it. The difference is that Laravel containers don't trigger re-renders — there's no view layer auto-subscribing — so it's pure lookup, no reactivity.

**Common Mistakes**
- **Reaching for context for high-frequency state.** Putting form input values, mouse coordinates, or server data into context will re-render the entire subtree on every change. Use local state or a real state library for those.
- **Forgetting to wrap the app in the provider.** `useContext` returns the `defaultValue` (often `undefined`) silently. Bugs show up as "the toggle does nothing" rather than a clear error. Best practice: pass `undefined` as the default and have the custom hook throw if the context is missing — catches the omission instantly.
- **Putting an unstable object in `value`.** `<Provider value={{ theme, toggleTheme }}>` creates a new object on every render of the parent. Every consumer re-renders even if `theme` didn't change. Stabilize with `useMemo` for the value object and `useCallback` for the functions inside it.

---

### Custom Provider Component + Hook Pattern

**Plain English**
Rather than exporting the raw `Context` object and forcing consumers to wire up `<MyContext.Provider value={...}>` and `useContext(MyContext)` themselves, you wrap both ends in your own components. Export a `<ThemeProvider>` that takes only `children` and manages the state internally. Export a `useTheme()` hook that returns the value and throws a clear error if used outside the provider. Consumers never see `createContext` or `useContext` — they just call `useTheme()` and trust it works.

This is the standard way to ship a context. It hides the plumbing, gives a single chokepoint for changing the implementation later (move state to Redux, add a third theme, etc.), and produces clean error messages when misused.

**Technically Speaking**
The pattern is three parts:

1. **Private context object.** `const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)`. Not exported. Typed as `T | undefined` so the consumer hook can detect "no provider above" and throw — TypeScript then narrows the return type to `T` after the throw.
2. **Provider component.** Owns the state (`useState`), the side-effects (`useEffect` to sync localStorage / DOM class), and the stable handlers (`useCallback`). Renders `<Context.Provider value={{ ... }}>{children}</Context.Provider>`. The component's name and props are part of the public API — `children: ReactNode` is the standard typing.
3. **Custom hook.** Calls `useContext(ThemeContext)`, throws if the result is `undefined`, and returns the value. The throw narrows the return type to `ThemeContextValue` (no `| undefined` to handle in callers).

This combo gives you encapsulation (the context object is private), runtime safety (clear error if misused), and type safety (no nullable returns leaking out). It's also trivially testable — render anything inside `<ThemeProvider>` in a test, no boilerplate.

**Vue / Laravel Analogy**
In Vue, this is the Pinia-store-as-composable pattern: you export `useThemeStore()` and consumers never touch the underlying store object directly. Or, with `provide` / `inject`, you'd write a `useTheme()` composable that wraps the `inject` call and validates the symbol was provided.

In Laravel, this maps to a facade: `Theme::current()` and `Theme::toggle()` hide the underlying `ThemeService` resolution. The facade is the public API; the service container binding is the private wiring.

**Common Mistakes**
- **Exporting the raw context object.** Tempting because it's one line less, but it leaks the implementation. If you later swap to Redux or a different state mechanism, every consumer breaks. Keep the context private.
- **Forgetting the "throw if not wrapped" check.** Without it, `useContext` silently returns `undefined` and consumers crash later with cryptic errors like "cannot read property 'theme' of undefined." A throw at the hook says exactly what's wrong.
- **Letting the provider double as a regular component.** A provider should typically have a single job — manage and broadcast its value. If you start adding unrelated rendering logic to it, split it into two components.

---

### Side-Effects in `useEffect` for DOM and Storage

**Plain English**
`useEffect` is the place to "do something with the outside world" after a render. State changes are pure — they update React's internal model — but the DOM, localStorage, and the network are *outside* React. Anything that touches them needs to wait until after the render commits, and it needs to run again whenever the dependent state changes. Here, two things happen on every theme change: add or remove the `dark` class on `<html>`, and write the new value to localStorage. Neither belongs in the render function (renders should be pure); both belong in an effect that depends on `[theme]`.

**Technically Speaking**
`useEffect(fn, [deps])` runs `fn` after the DOM commit phase, only when one of the values in `deps` has changed since the previous run (compared by `Object.is`). The first run always fires (the initial render). It's the React-controlled escape hatch for imperative work: DOM mutation, subscriptions, timers, network requests.

In this provider, the effect:
- Reads `document.documentElement` (the `<html>` element).
- Calls `classList.add('dark')` or `classList.remove('dark')` based on the current `theme`.
- Writes the theme to localStorage.

Both side-effects are idempotent — running them twice produces the same result — which matters for React's strict mode (effects run twice in dev) and for any future re-runs caused by other deps. The effect doesn't return a cleanup function because nothing needs to be torn down between runs (the next run overwrites the DOM class and the storage value cleanly).

**Vue / Laravel Analogy**
In Vue, this is `watch(theme, (next) => { ... })` or `watchEffect(() => { ... })`. The semantics line up: a function that re-runs when reactive dependencies change. Vue tracks dependencies automatically (no `[deps]` array); React requires you to list them. The tradeoff is explicitness vs. ergonomics.

In Laravel there's no direct frontend equivalent — server requests don't have a "render then sync to DOM" lifecycle. The closest is a model event listener (`saved`, `updated`) that runs side effects when the model changes — same idea, different layer.

**Common Mistakes**
- **Putting DOM mutations in the render function.** Touching `document` during render breaks SSR, fights React's commit ordering, and runs even when render is thrown away. Always go through `useEffect` for DOM work.
- **Wrong dependency array.** Omitting a value the effect reads (stale closure bug); including a value that changes every render (effect runs every render — defeats the point). The ESLint `react-hooks/exhaustive-deps` rule catches both.
- **Forgetting cleanup when one is needed.** This effect doesn't need cleanup, but effects that subscribe (event listeners, timers, intersection observers) must return a cleanup function. Skipping it leaks subscriptions on unmount and on every re-run.

---

### Tailwind `darkMode: 'class'` Strategy

**Plain English**
Tailwind has two ways to handle dark mode: `'media'` follows the user's OS preference automatically, and `'class'` only activates `dark:` variants when an ancestor element has the `dark` class. We picked `'class'` because the user wants a manual toggle inside the app — not "whatever the OS says." Tailwind compiles every `dark:bg-gray-900` into a CSS rule scoped under `.dark`, so flipping a single class on `<html>` lights up every styled element at once.

**Technically Speaking**
With `darkMode: 'class'` in `tailwind.config.js`, a utility like `dark:bg-gray-900` compiles to roughly:

```css
.dark .dark\:bg-gray-900 { background-color: rgb(17 24 39); }
```

So the variant only applies when an ancestor matches `.dark`. Toggling `document.documentElement.classList` for the `dark` class is enough to switch the entire app — no per-component theme prop, no class swap on every element. The build size is the same as light-mode-only code; you just get both rule sets compiled for any utility you wrap in a `dark:` variant.

**Vue / Laravel Analogy**
This isn't really a Vue/Laravel concept — it's a Tailwind feature. The closest analog in any framework is "scope CSS to a parent class" (e.g., BEM modifiers, SCSS `&.dark` blocks). The mechanism is identical: ancestor selector + descendant rule.

**Common Mistakes**
- **Forgetting to set `darkMode: 'class'` in the config.** Default is `'media'`, which means your toggle does nothing — variants only fire from `prefers-color-scheme`. Easy to miss; the symptom is "the button toggles state but nothing changes visually."
- **Toggling the class on the wrong element.** Has to be an ancestor of every `dark:` variant in the app. `document.documentElement` (`<html>`) is the safest — covers everything, including portals.
- **Forgetting to add `dark:` variants where they're needed.** Tailwind doesn't auto-derive a dark counterpart. Every color utility you want themed needs an explicit `dark:` sibling. White cards on a white page in dark mode mean you skipped some.

---

## Code Walkthrough

### `ThemeContext.tsx` — context + provider + hook

```ts
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
```

Type is `ThemeContextValue | undefined`, default value is `undefined`. The `| undefined` is what makes the "throw if no provider" check work — if `useContext` returns `undefined`, we know nobody wrapped us in a provider. Without that union, the default would have to be a fake-but-valid `ThemeContextValue`, and consumers would silently use it instead of erroring.

```ts
const [theme, setTheme] = useState<Theme>(loadInitialTheme);
```

Pass the function `loadInitialTheme` (no parens), not `loadInitialTheme()`. React calls the function exactly once on first render to compute the initial state — this is the "lazy initial state" pattern. If you write `useState(loadInitialTheme())` instead, you're calling localStorage on every single render and discarding the result every time except the first. Imperceptible for a small read, but the pattern matters once initial computation is expensive.

```ts
useEffect(() => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem(STORAGE_KEY, theme);
}, [theme]);
```

Two side-effects bundled into one effect because they both depend on the same trigger (theme change). Splitting them into two effects with the same `[theme]` dep would behave identically — code style choice. The DOM mutation runs against `<html>` so the `dark` class lands above every component in the tree; this is what makes Tailwind's `'class'` strategy fire app-wide from a single toggle.

```ts
const toggleTheme = useCallback(() => {
  setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
}, []);
```

Two things happen here. First, `useCallback(fn, [])` returns the same function reference across renders — so the `value={{ theme, toggleTheme }}` object only changes when `theme` changes, not on every render of `ThemeProvider`. Second, `setTheme((prev) => ...)` uses the updater form of `setState`, which reads the previous state at the time the update runs (not the time the closure was created). Critical when the setter is called outside of a render cycle — like inside an event handler that fires after several state changes have queued. Direct form (`setTheme(theme === 'dark' ? 'light' : 'dark')`) would close over a stale `theme` if `toggleTheme` is ever called twice in the same render tick.

```ts
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
```

The throw is doing double duty: a clear runtime error if someone forgets the provider, and a TypeScript narrowing — after the `if (!ctx) throw`, TS knows `ctx` is `ThemeContextValue` (not `... | undefined`). Consumers get a non-null return type without manual `!` assertions.

### `App.tsx` — wiring the provider

```tsx
<Provider store={store}>
  <StorePersistence />
  <ThemeProvider>
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 ...">
        ...
      </div>
    </BrowserRouter>
  </ThemeProvider>
</Provider>
```

`<ThemeProvider>` sits outside `<BrowserRouter>` because routes change but the theme shouldn't reset on navigation. It sits inside `<Provider store={store}>` because the theme has nothing to do with Redux — and there's no harm in either order, but keeping unrelated providers nested inwards is a useful default. `<ThemeToggle>` lives *inside* `<ThemeProvider>` (in the header), which is non-negotiable: `useTheme()` outside the provider would throw.

```tsx
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  // ...
}
```

The whole consumer side, in two lines. No prop drilling, no Redux dispatch, no global variable — just a hook call. That's the payoff of context: any component anywhere reads the same source of truth with one line.

### `tailwind.config.js`

```js
export default {
  darkMode: 'class',
  // ...
}
```

One line. Without this, every `dark:` variant in the codebase is dead — they only activate from `prefers-color-scheme` by default.

---

## What to Remember

- Context is for state that's read widely and changes rarely (theme, locale, auth user). For high-frequency state, use Redux or local state — context re-renders every consumer on every change.
- Wrap context behind a custom `<Provider>` component and a `useX()` hook. Keep the raw `Context` object private. The hook should throw when used outside the provider — that's also a TypeScript narrowing trick that gets rid of `| undefined` in the return type.
- `useState(initFn)` (function reference) calls `initFn` once. `useState(initFn())` calls it on every render. Use the function form for any non-trivial initial value (localStorage reads, parsing, computation).
- DOM mutations and localStorage writes belong in `useEffect`, never in the render function. Renders must be pure; effects are the escape hatch for anything outside React's world.
- Tailwind's `darkMode: 'class'` strategy means flipping the `dark` class on `<html>` toggles every `dark:` variant at once. You still have to add `dark:` variants explicitly to every color utility you want themed — Tailwind doesn't infer them.
