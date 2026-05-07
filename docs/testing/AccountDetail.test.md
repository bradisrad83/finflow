# Route Parameter Tests — AccountDetail

## What Was Built
5 passing tests for the `AccountDetail` page using `initialPath` and `routePath` options added to `renderWithProviders` — verifying that the account name, balance, and type render for a known ID, and the not-found state renders for an unknown ID.

## File Location
`src/__tests__/AccountDetail.test.tsx`, `src/test-utils/renderWithProviders.tsx`

---

## Concepts Introduced

### initialEntries + Route pattern — why both halves are required

**Plain English**
When you test a page that reads from the URL (like `AccountDetail` which calls `useParams()` to get `id`), you need two things:
1. The router to start at the right URL — `/accounts/1`
2. A route definition that maps URL segments to named params — `/accounts/:id`

`initialEntries` on `MemoryRouter` handles the first: it tells the router what URL to start at. But `useParams()` reads from the *matched route context*, not from the URL string directly. Without a `<Route path="/accounts/:id">` somewhere in the tree, the router never extracts `id` from the URL — `useParams()` returns `{}` regardless of what URL you set.

**Technically Speaking**
React Router v6 uses a context system: `useParams()` calls `useContext(RouteContext)` which reads from the nearest `<Route>` ancestor's match object. When a `<Route path="/accounts/:id">` matches the current URL, it stores `{ id: '1' }` in that context. Components inside the route tree read it via `useParams()`. Without a matching `<Route>`, the context has no params — there's nothing to read.

The `<>{children}</>` fragment in `renderWithProviders` acts as a passthrough element for the Route's `element` prop, allowing the utility to render any component in a route context without hardcoding a specific component:
```tsx
<Routes>
  <Route path={routePath} element={<>{children}</>} />
</Routes>
```
`element={<>{children}</>}` means "when this route matches, render whatever the caller passed as `ui`."

**Vue / Laravel Analogy**
In Vue Router tests:
```ts
const router = createRouter({
  history: createMemoryHistory({ initialEntries: ['/accounts/1'] }),
  routes: [{ path: '/accounts/:id', component: AccountDetail }]
})
const wrapper = mount(RouterView, { global: { plugins: [router] } })
await router.isReady()
```
Two pieces: the history with the initial URL, and the route definition with the param pattern. Vue Router's `createMemoryHistory` + `createRouter` maps directly to React's `MemoryRouter` + `Routes`/`Route`. In Laravel, testing a route-based controller uses `$this->get('/accounts/1')` — the framework parses `:id` from the route definition in `routes/web.php`.

**Common Mistakes**
1. **Using `initialEntries` without a matching `<Route>`.** Setting `initialEntries={['/accounts/1']}` makes the URL correct but `useParams()` still returns `{}`. The route pattern that extracts `:id` is the missing piece.
2. **Hardcoding the route path in `renderWithProviders` instead of passing it as an option.** Different pages have different route patterns. The `routePath` option (`'/accounts/:id'`, `'/transactions/:txId'`, etc.) must be passed per-test, not hardcoded in the utility.
3. **Forgetting `initialPath` when testing the not-found state.** Rendering without `initialPath` defaults to `'/'`. If the route pattern is `/accounts/:id`, `'/'` won't match and the component won't render at all (blank output). Use a non-matching path like `'/accounts/unknown-id'` to test the not-found state.

---

### renderWithProviders routePath option — how it wires together

**Plain English**
The `routePath` option extends `renderWithProviders` so it can wrap the component in a `<Route>` when needed. For most tests — rendering `NetWorthCard`, `AccountsOverview`, etc. — no route wrapping is needed and the option is omitted. For page components like `AccountDetail` that call `useParams()`, it must be provided. The option is opt-in: existing tests are unaffected because `routePath` defaults to `undefined`, which keeps the original behavior (no route wrapping).

**Technically Speaking**
When `routePath` is defined, `Wrapper` renders:
```tsx
<MemoryRouter initialEntries={[initialPath]}>
  <Routes>
    <Route path={routePath} element={<>{children}</>} />
  </Routes>
</MemoryRouter>
```
When `routePath` is `undefined`, it renders:
```tsx
<MemoryRouter initialEntries={[initialPath]}>
  {children}
</MemoryRouter>
```
`initialPath` defaults to `'/'` in both cases — backward-compatible since all existing tests were using `MemoryRouter` at `/`. The `Route` wrapping is the only structural difference. Both branches use `MemoryRouter`, so navigation hooks (`useNavigate`, `useLocation`) work in both.

**Vue / Laravel Analogy**
No direct equivalent in Vue Test Utils — in Vue, `useRoute().params` is populated from the router instance you provide, and `createTestingPinia({ stubRouterParam: true })` is sometimes used. React Testing Library's approach of composing providers and route wrappers explicitly maps more closely to creating a real Vue Router instance per test.

**Common Mistakes**
1. **Using `routePath` without `initialPath`.** If `routePath` is `'/accounts/:id'` but `initialPath` is `'/'` (default), the route doesn't match and `children` never renders. Always pair `routePath` with a matching `initialPath`.
2. **Providing `initialPath` without `routePath` for a component that uses `useParams`.** The URL will be correct but params won't be extracted.

---

### Exact text matching — avoiding false positives with regex

**Plain English**
`screen.getByText(/checking/i)` is a regex — it finds any element whose text *contains* "checking" (case-insensitive). This matched both "checking" (the type label) and "Primary Checking" (the account name), causing "Found multiple elements." Using `screen.getByText('checking')` (a string with default `exact: true`) only matches elements whose full text content equals exactly "checking" — not "Primary Checking." Choose regex for flexible matching, exact strings for precision.

**Technically Speaking**
RTL's `ByText` queries work on `element.textContent`. With a regex like `/checking/i`, it calls `text.match(regex)` — any element containing "checking" anywhere in its text matches. With a string and `exact: true` (default), it compares `element.textContent.trim() === query`. The `<p>checking</p>` element has textContent `"checking"` — exact match passes. The `<h2>Primary Checking</h2>` has textContent `"Primary Checking"` — exact match fails. Using `exact: false` converts the string to a substring match, behaving like a regex.

**Vue / Laravel Analogy**
Vue Testing Library has the same `getByText` API with identical exact/regex behavior. In Laravel Dusk, `$browser->assertSee('checking')` finds any occurrence — the equivalent of regex mode. `$browser->assertSeeIn('.type-label', 'checking')` scopes the search — similar to using a more specific RTL selector.

**Common Mistakes**
1. **Using regex when the text appears in multiple places.** `/checking/i` matches "checking", "Checking", "Primary Checking", "Checking Account". Always check what else on the page might match before using a regex.
2. **Using exact string matching when the text has surrounding whitespace.** If the DOM renders `  checking  ` with whitespace, exact match fails. RTL normalizes whitespace in queries — trim and collapse internal spaces — so this is rarely an issue in practice.

---

## Code Walkthrough

### The routePath + initialPath options in renderWithProviders
```tsx
const routerContent = routePath ? (
  <Routes>
    <Route path={routePath} element={<>{children}</>} />
  </Routes>
) : (
  <>{children}</>
);

return (
  <Provider store={store}>
    <NotificationProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        {routerContent}
      </MemoryRouter>
    </NotificationProvider>
  </Provider>
);
```
The ternary switches between two rendering modes. `routerContent` is computed once and passed to `MemoryRouter` — clean and readable. `<>{children}</>` is the passthrough fragment. The `initialPath` is always passed to `MemoryRouter` now (defaulting to `'/'`) — a subtle improvement even for tests that don't use `routePath`.

### The "account found" test
```ts
renderWithProviders(<AccountDetail />, {
  initialPath: `/accounts/${checking.id}`,
  routePath,
  preloadedState: { accounts: { accounts: [checking] } },
});
expect(screen.getByText('Primary Checking')).toBeTruthy();
```
Three inputs to the test: the URL (`initialPath`), the route pattern (`routePath`), and the store state (`preloadedState`). Together they simulate: "the user navigated to `/accounts/1`, the store has an account with id `'1'`, and the router matched the `/accounts/:id` pattern." `AccountDetail` reads `id` from `useParams`, finds the account via `selectAccountById('1')`, and renders "Primary Checking."

### The "account not found" test
```ts
renderWithProviders(<AccountDetail />, {
  initialPath: '/accounts/unknown-id',
  routePath,
});
expect(screen.getByText('Account not found.')).toBeTruthy();
```
No `preloadedState` — the store starts empty. The URL has an ID that doesn't exist in the store. `selectAccountById('unknown-id')` returns `null`. The component renders the early-return "Account not found" branch. This test verifies the fallback path, not just the happy path.

---

## What to Remember

- `initialEntries` sets the URL; `routePath` defines the param pattern — `useParams()` needs **both** to return params.
- The `routePath` option is opt-in — existing tests that don't use `useParams` are unaffected.
- Always pair `routePath` with a matching `initialPath` — a route pattern won't match the default `'/'`.
- `getByText('checking')` (exact string) finds only elements with that exact full text content; `getByText(/checking/i)` (regex) finds anything containing it — pick based on uniqueness of the text.
- Testing the not-found path requires an `initialPath` with an ID that doesn't exist in `preloadedState`.
