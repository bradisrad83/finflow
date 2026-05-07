# React.lazy + Suspense (lazy-routes)

## What Was Built
`AccountDetail` is now lazy-loaded — its JavaScript is only downloaded the first time a user navigates to an account page — with a `<Suspense>` boundary in `App.tsx` rendering a skeleton fallback while the chunk arrives.

## File Location
`src/App.tsx`

---

## Concepts Introduced

### Static vs dynamic imports

**Plain English**
When you write `import AccountDetail from './pages/AccountDetail'` at the top of a file, that's a static import. The bundler (Vite) sees it at build time and rolls all of `AccountDetail`'s code into the main JavaScript bundle — the single file your browser downloads when the app loads. Every user pays that download cost on arrival, whether they ever visit an account page or not.

A dynamic import — `import('./pages/AccountDetail')` — is different. It returns a Promise and tells the bundler: "split this into a separate file, and only load it when this line actually runs." The first user to navigate to an account page triggers the download; everyone else who only uses the dashboard never downloads it at all.

**Technically Speaking**
`import()` is a native browser API (not React-specific) that returns `Promise<Module>`. Vite detects dynamic import calls at build time and emits a separate `.js` chunk for each one. The chunk is content-hashed (`AccountDetail.a3f2bc.js`) so browsers cache it indefinitely until the code changes. On first navigation to `/accounts/:id`, the browser fetches the chunk, evaluates it, and React renders the component. On subsequent navigations, the browser serves it from cache — no network request.

**Vue / Laravel Analogy**
In Vue 3, this is `defineAsyncComponent`:
```ts
const AccountDetail = defineAsyncComponent(() => import('./pages/AccountDetail.vue'))
```
Vite handles both the same way — a separate chunk per dynamic import. In Laravel, the closest concept is deferred loading: only running a service provider or loading a class when it's actually needed, rather than eagerly booting everything on every request. Same motivation: don't pay for what you don't use.

**Common Mistakes**
1. **Lazy-loading components that are always visible.** `Dashboard` is on the first route every user hits — lazy-loading it just adds a spinner to the initial load. Only lazy-load routes or heavy components the user might never visit.
2. **Using dynamic imports for tiny components.** The network round-trip to fetch a chunk costs more than the savings from splitting a 2KB component. Reserve lazy loading for meaningful chunks — route-level pages, rich editors, chart libraries.

---

### React.lazy — wrapping a dynamic import as a component

**Plain English**
A raw `import()` call returns a Promise, not a React component. `React.lazy` is the bridge: it takes a function that returns that Promise and gives you back something React can render. React knows to "wait" for the Promise before trying to paint — and while it's waiting, it looks up the tree for a `<Suspense>` boundary to render instead.

**Technically Speaking**
`lazy(() => import('./pages/AccountDetail'))` accepts a factory function that returns `Promise<{ default: ComponentType }>`. The module *must* have a default export — named exports aren't supported by `lazy`. React holds the lazy component in a "pending" state until the Promise resolves. During that window, rendering the component throws a special Promise (a "thenable"), which React's Suspense mechanism catches to show the fallback. Once resolved, React retries the render with the now-loaded component. The loaded module is cached — calling `lazy` again with the same path returns the cached module.

**Vue / Laravel Analogy**
```ts
// Vue 3
const AccountDetail = defineAsyncComponent(() => import('./pages/AccountDetail.vue'))
```
`defineAsyncComponent` is the direct equivalent — same contract, same behavior. Vue additionally supports loading/error component options directly in `defineAsyncComponent`, whereas React separates those concerns into `Suspense` and error boundaries respectively.

**Common Mistakes**
1. **Lazy-loading a component with named exports.** `lazy` only works with default exports. If `AccountDetail` used `export function AccountDetail()` instead of `export default`, this would fail silently. Stick to `export default` for lazy-loaded components.
2. **Calling `lazy` inside a component.** `const AccountDetail = lazy(...)` must be at module level, not inside a render function — otherwise a new lazy instance is created every render and the cache is never reused.

---

### Suspense — the loading boundary

**Plain English**
`<Suspense>` is React's answer to: "what do I show while I'm waiting?" Wrap any part of your component tree in `<Suspense fallback={<Something />}>` and React will render `<Something />` whenever any lazy component inside is still loading. The moment the lazy component is ready, React swaps the fallback out for the real content — no setState, no loading flags, no `if (loading) return ...` checks.

**Technically Speaking**
`<Suspense>` is a React built-in that catches thrown Promises (thenables) from its subtree during render. When `lazy` renders a component whose module hasn't loaded yet, it throws a Promise. Suspense catches it, renders the `fallback`, and subscribes to the Promise. When the Promise resolves, Suspense re-renders its subtree — this time the lazy component has its module available and renders normally. `Suspense` can be nested: a more specific boundary closer to the lazy component wins over a more general one higher up. Placing it around `<Routes>` means it covers *all* lazy routes with one boundary.

**Vue / Laravel Analogy**
Vue 3 has a `<Suspense>` component with nearly identical semantics:
```html
<Suspense>
  <template #default><AccountDetail /></template>
  <template #fallback><LoadingSpinner /></template>
</Suspense>
```
React uses a `fallback` prop instead of named slots, but the contract is the same: render the fallback until the async content is ready, then swap. In Laravel, there's no rendering equivalent — server-rendered responses are synchronous.

**Common Mistakes**
1. **Forgetting `<Suspense>` entirely.** Without a Suspense boundary, a lazy component that's loading throws an uncaught Promise during render, which crashes the component tree. Always pair `lazy` with `Suspense`.
2. **Placing `<Suspense>` inside the lazy component itself.** The boundary must be *above* the lazy component in the tree — `Suspense` can't catch its own children's thrown Promises if it's the component that's missing.
3. **Using a blank `fallback`.** `fallback={null}` means the entire `<main>` goes blank while loading. A skeleton or spinner maintains layout and signals progress.

---

## Code Walkthrough

### The lazy import (module level)
```ts
const AccountDetail = lazy(() => import('./pages/AccountDetail'));
```
This lives at the top of `App.tsx`, outside any component function — so it's defined once and cached. `lazy` receives an arrow function (not the import result directly) so the dynamic import only fires when React first tries to render `AccountDetail`, not when the module loads. If the arrow function were called immediately (`lazy(import('./pages/AccountDetail'))`), the chunk would download at app load — defeating the purpose.

### Removing the static import
```ts
// removed:
import AccountDetail from './pages/AccountDetail';
```
`Dashboard` stays as a static import because it renders on the first route. Lazy-loading the home page would add a spinner to every initial load — wrong trade-off. Only `AccountDetail` moves to lazy because it's a secondary page users may never visit.

### The Suspense boundary
```tsx
<Suspense fallback={
  <div className="px-8 py-10">
    <div className="h-8 w-48 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse mb-4" />
    <div className="h-4 w-32 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
  </div>
}>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/accounts/:id" element={<AccountDetail />} />
  </Routes>
</Suspense>
```
The boundary wraps `<Routes>` rather than just the `<AccountDetail />` route element. This is intentional — if you wrapped only the route element, React Router would try to render the route match before Suspense could intercept the thrown Promise. Wrapping `<Routes>` lets Suspense see the throw before routing logic runs.

The fallback is two pulse bars positioned to approximate the heading area of `AccountDetail` — a heading-sized block and a subheading block. It's shown only on the very first visit to any account page; after that the chunk is cached and renders synchronously.

---

## What to Remember

- `React.lazy` takes a function returning `Promise<Module>` — the function must be an arrow, not an immediate call, so the import fires on demand not at load time.
- The module must have a `default` export — `lazy` doesn't work with named exports.
- Every lazy component needs a `<Suspense>` ancestor somewhere above it in the tree — without one, a loading lazy component crashes the render.
- Place `<Suspense>` above `<Routes>`, not around individual `<Route>` elements, to ensure Suspense can catch the thrown Promise before React Router resolves the match.
- Only lazy-load routes or heavy components users might not visit — static-importing the first-rendered route adds a spinner to every page load.
