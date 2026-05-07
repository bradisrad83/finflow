# Router Navigation

## What Was Built
React Router DOM v7 wired into the app, splitting the single-page UI into a `/` dashboard route and a `/accounts/:id` detail route, with `<Link>` navigation between them.

## File Location
`src/App.tsx`, `src/pages/Dashboard.tsx`, `src/pages/AccountDetail.tsx`, `src/components/AccountCard.tsx`, `src/components/AccountsOverview.tsx`

---

## Concepts Introduced

### BrowserRouter and the Routing Context

**Plain English**
`<BrowserRouter>` is a wrapper component that you put near the top of your app. Once it's there, every component below it can use routing features — read the current URL, navigate to new URLs, render based on the path. It's invisible (no UI), but it provides the "where am I in the app?" answer to the rest of the tree.

**Technically Speaking**
`BrowserRouter` is a context provider that uses the HTML5 History API (`pushState`, `popState`) to manage URL changes without a full page reload. It creates a routing context — internally a React Context object — that all routing hooks (`useParams`, `useNavigate`, `useLocation`) and components (`<Routes>`, `<Link>`) read from. Without `BrowserRouter` somewhere up the tree, those hooks will throw at runtime because the context is undefined.

**Vue / Laravel Analogy**
This is the React equivalent of:
```ts
const router = createRouter({ history: createWebHistory(), routes: [...] })
app.use(router)
```
in Vue 3. The big difference is that Vue Router is configured in one central place (the `routes` array), while React Router routes are declared as JSX components inside your tree — which means routes can be co-located with related code, but there's no single "route map" file to look at.

In Laravel, the closest analog is `routes/web.php` — but Laravel routes are server-side, while these are entirely client-side.

**Common Mistakes**
- Forgetting to wrap the app in `<BrowserRouter>` — every routing hook silently breaks.
- Using `<HashRouter>` (the `/#/path` style) when `<BrowserRouter>` (clean URLs) is what you want, or vice versa. `BrowserRouter` requires server config to redirect all paths to `index.html` in production.
- Putting `<BrowserRouter>` inside something that re-renders frequently — it should be high in the tree and stable.

---

### Routes, Route, and Dynamic Segments

**Plain English**
`<Routes>` looks at the current URL and decides which page component to show. Inside it, you list `<Route>` declarations — one per page. The `path` is the URL to match, and `element` is what to render. A `:something` in the path is a placeholder for any value (an account ID, a user slug, etc.) and becomes available to the page component.

**Technically Speaking**
`<Routes>` performs a single best-match operation against the current pathname using a ranking algorithm (longer/more specific paths win over shorter ones, static segments beat dynamic ones). Only one `<Route>` renders at a time per `<Routes>` block. Dynamic segments like `:id` are parsed into a `params` object exposed via `useParams()`. Path matching is exact by default in v7 — no more `<Switch>` like in v5, no more `exact` prop.

**Vue / Laravel Analogy**
- Vue Router: `{ path: '/accounts/:id', component: AccountDetail }` is `<Route path="/accounts/:id" element={<AccountDetail />} />`.
- Laravel: `Route::get('/accounts/{id}', [AccountController::class, 'show'])` — same `:id` → `{id}` parameter convention.

The key difference from both: in React Router, the route declaration *is* JSX, so it shares the component tree's mental model. In Vue and Laravel, route config is data passed to a router instance.

**Common Mistakes**
- Forgetting that `<Routes>` only renders one `<Route>` at a time — if you want layouts that wrap multiple routes, you need nested routes (a v7 feature we haven't used yet).
- Putting a dynamic segment too early: `/:id/accounts` will match `/dashboard` because `dashboard` looks like an `:id`. Static paths should come first or be more specific.
- Trying to read `:id` from props — it's not passed as a prop. You must call `useParams()`.

---

### useParams and Reading URL State

**Plain English**
`useParams()` is a hook that gives you the dynamic parts of the current URL. If your route is `/accounts/:id` and the user is on `/accounts/3`, `useParams()` returns `{ id: '3' }`. The URL becomes a place to store state — refreshing the page or sharing the URL keeps the user on the same view.

**Technically Speaking**
`useParams<T>()` returns an object whose keys match the dynamic segments in the matched route. The generic type parameter lets you tell TypeScript what shape to expect (`useParams<{ id: string }>()`), but the values are still typed as `string | undefined` in strict mode because the hook can technically be called outside a matching route. This means you almost always need a guard (`if (!id) return ...`) before using the value.

The values are always strings — even if your URL has `/accounts/123`, `id` is `"123"` not `123`. Convert with `Number(id)` if needed.

**Vue / Laravel Analogy**
Vue Router: `const route = useRoute(); const id = route.params.id`. Same idea, slightly different API. Laravel: route parameters are injected into the controller method (`public function show($id)`) rather than read via a hook.

**Common Mistakes**
- Forgetting that params are strings, not numbers. `useParams().id === 3` is always false.
- Not handling the `undefined` case in TypeScript strict mode — params can be missing if the hook runs outside a matched route.
- Using `useParams` to make decisions in a parent component above `<Routes>` — it only works inside a route's element.

---

### Link vs Anchor Tags

**Plain English**
`<Link to="/foo">` looks like an anchor tag in the rendered HTML, but clicking it doesn't reload the page. It updates the URL via JavaScript and tells `<Routes>` to render the new page. Always use `<Link>` instead of `<a href>` for internal navigation — `<a href>` triggers a full page reload, which throws away your Redux store and forces every component to re-mount.

**Technically Speaking**
`<Link>` renders an `<a>` element with the correct `href` attribute (so right-click → "open in new tab" works, screen readers see it as a link), but intercepts the click event and calls `history.pushState` instead of letting the browser navigate. This is "client-side navigation" — the URL changes, the routing context updates, the matched route re-renders, and nothing else reloads. Redux state, React state, and component instances all persist across navigations.

**Vue / Laravel Analogy**
- `<Link to="/x">` = Vue Router's `<RouterLink to="/x">`. Identical purpose.
- Laravel doesn't have a direct analog because Laravel apps traditionally do server-side navigation. The closest equivalent is Inertia.js's `<Link>` component, which does the same trick.

**Common Mistakes**
- Using `<a href="/path">` for internal links — full page reload, lost state.
- Using `<Link>` for external URLs — it'll try to use client-side navigation and break. Use `<a>` for external links.
- Forgetting that `<Link>` renders an `<a>` (inline by default) — if you want it to behave like a block (e.g., a card), add `className="block"`.

---

## Code Walkthrough

### `src/App.tsx`

```tsx
<Provider store={store}>
  <BrowserRouter>
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header>...<Link to="/">FinFlow</Link>...</header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts/:id" element={<AccountDetail />} />
        </Routes>
      </main>
    </div>
  </BrowserRouter>
</Provider>
```

Two providers wrap the app: `<Provider>` for Redux and `<BrowserRouter>` for routing. They're independent — neither needs to be inside the other for correctness, but the convention is to put the data store outermost. `<Routes>` only sits in `<main>`, so the header (with the `<Link to="/">` logo) renders on every page. That's the routing equivalent of a layout component — content above `<Routes>` is shared across all routes.

### `src/pages/AccountDetail.tsx`

```tsx
const { id } = useParams<{ id: string }>();
const account = useSelector((state: RootState) =>
  state.accounts.accounts.find((a) => a.id === id)
);

if (!account) {
  return <p>Account not found.</p>;
}
```

Two pieces of data come together here: the `id` from the URL (via `useParams`) and the account data from Redux (via `useSelector`). The `find` runs inside the selector, so when the accounts slice changes, this component re-renders with the updated account. The `if (!account)` guard handles two cases at once: invalid URL (`/accounts/999`) and the brief moment before TypeScript can narrow `id` from `string | undefined`.

### `src/components/AccountCard.tsx`

```tsx
<Link
  to={`/accounts/${account.id}`}
  className="block bg-white rounded-2xl p-6 ..."
>
```

Two non-obvious things here. First, the entire card is wrapped in `<Link>` — clicking anywhere on the card navigates. Second, the `block` class is critical: `<Link>` renders an `<a>` tag, which is `display: inline` by default. Without `block`, the card would shrink to fit its content and break the grid layout.

---

## What to Remember

- `<BrowserRouter>` provides routing context to everything below it — without it, routing hooks throw at runtime.
- The URL is now a piece of application state. Use it for things like "which account is selected" instead of `useState` — refreshing the page just works.
- `useParams()` returns strings, always. Type them with a generic (`useParams<{ id: string }>()`) but still guard for `undefined`.
- Use `<Link>` for internal navigation, never `<a href>` — `<a>` triggers a full page reload and wipes Redux state.
- `<Link>` renders as `<a>` (inline). Add `block` if you want it to wrap a card-shaped element.
