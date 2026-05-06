# NotFound (not-found)

## What Was Built
A `NotFound` page component and a `path="*"` catch-all route in `App.tsx` so any unrecognized URL renders a 404 message instead of a blank page.

## File Location
`src/pages/NotFound.tsx`, `src/App.tsx`

---

## Concepts Introduced

### path="*" — the wildcard catch-all route

**Plain English**
React Router tries each `<Route>` in order, from top to bottom, and renders the first one whose path matches the current URL. `path="*"` is the wildcard — it matches *any* URL that no previous route claimed. Put it last and it becomes your 404 handler: "if nothing else matched, show this." Put it first and it matches everything, so nothing else ever renders.

**Technically Speaking**
React Router v6 evaluates routes using a scoring algorithm that ranks specificity — more specific patterns (like `/accounts/:id`) always beat less specific ones, regardless of order. However, `path="*"` has the lowest possible score and is intentionally designed as a catch-all of last resort. It matches the full remaining pathname from the current location. Within a `<Routes>` block, React Router renders at most one route — the highest-scoring match. If `path="*"` is the only match, it wins.

**Vue / Laravel Analogy**
In Vue Router:
```ts
{ path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
```
This is the canonical Vue catch-all — a regex-flavored wildcard registered as the last route. In Laravel, the equivalent is the implicit 404 response when no route matches, or a custom handler registered in `bootstrap/app.php`:
```php
->withExceptions(function (Exceptions $exceptions) {
    $exceptions->render(fn (NotFoundHttpException $e) => response()->view('errors.404'));
})
```
Same concept across frameworks: define what happens when nothing else matches.

**Common Mistakes**
1. **Registering `path="*"` before other routes.** It will match everything and none of your real routes will ever render. Always put it last.
2. **Confusing `path="*"` with `path="/:anything"`.** The latter only matches paths with exactly one segment (like `/foo`), not nested paths like `/foo/bar`. `path="*"` matches everything including nested paths.
3. **Lazy-loading the NotFound component.** It's typically tiny and could be the very first thing rendered (if a user bookmarks a bad URL). Lazy-loading adds a network round-trip before showing a simple message — not worth it.

---

### Route order and matching priority

**Plain English**
React Router v6 reads all your `<Route>` elements, scores them by specificity, and renders the best match. Exact paths (`/`) score higher than parameterized paths (`/accounts/:id`), which score higher than wildcards (`*`). This means you don't have to order routes perfectly — React Router figures out the right one. The one exception is `path="*"`, which is deliberately the lowest score and always loses to any real path. Putting it last is convention, not requirement in v6 — but it makes the intent obvious to anyone reading the code.

**Technically Speaking**
React Router v6 introduced a ranking algorithm borrowed from the `remix` routing philosophy. Each route segment is scored: static segments (e.g. `accounts`) score higher than dynamic segments (`:id`), which score higher than splats (`*`). The route with the highest cumulative score wins. This is a departure from v5, which used first-match ordering and required careful manual ordering. In v6, `<Routes>` is declarative — you describe all routes and React Router picks the best one, similar to how CSS specificity works.

**Vue / Laravel Analogy**
Vue Router also uses a scoring algorithm since v4, ranking static paths above dynamic ones. Laravel's router resolves routes in registration order (first match wins), so order does matter there — a catch-all wildcard route registered before specific routes would intercept everything. React Router v6's ranking system is more forgiving.

**Common Mistakes**
1. **Assuming v5 behavior in v6.** In React Router v5, routes matched in order and `<Switch>` stopped at the first match. In v6, `<Routes>` always picks the best match — putting a wildcard first doesn't make it catch everything like it would in v5.
2. **Adding `exact` prop.** In v6, all routes match exactly by default. The `exact` prop from v5 doesn't exist and adding it does nothing.

---

## Code Walkthrough

### The NotFound component
```tsx
function NotFound() {
  return (
    <section className="px-8 py-20 flex flex-col items-center text-center">
      <p className="text-6xl font-semibold text-gray-200 dark:text-gray-700 select-none">
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-50">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
        The URL you entered doesn&apos;t match any page in FinFlow.
      </p>
      <Link to="/" className="mt-6 ...">
        Back to dashboard
      </Link>
    </section>
  );
}
```
No hooks, no state, no Redux — just JSX. The `404` number uses `text-gray-200 dark:text-gray-700` to render it as a large decorative background element rather than a prominent heading; the actual message in `<h1>` carries the semantic meaning. `select-none` prevents the oversized number from being accidentally selected when users double-click the area. `&apos;` is the HTML entity for an apostrophe — correct practice inside JSX text, though modern JSX parsers handle bare apostrophes in text nodes fine.

### The catch-all route
```tsx
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/accounts/:id" element={<AccountDetail />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```
Three routes, read top to bottom for human clarity but evaluated by score. `/` and `/accounts/:id` are specific — they match their exact patterns and nothing else. `path="*"` is the backstop. Navigate to `/settings`, `/foo/bar/baz`, or `/accounts/` with no ID and `NotFound` renders. The header and footer (the `<div>` wrapping `<main>`) still render because `<Suspense>` and the layout are outside `<Routes>` — only the `<main>` content changes.

### Why NotFound isn't lazy
```ts
import NotFound from './pages/NotFound';  // static, not lazy()
```
`AccountDetail` is lazy because it's a secondary page many users may never visit. `NotFound` is the opposite: if a user lands on a bad URL as their very first page load (a broken bookmark, a mistyped link), lazy-loading would add a network request before showing a simple message. Static import means it's bundled with the main chunk and available instantly.

---

## What to Remember

- `path="*"` matches any URL not claimed by a more specific route — always register it last by convention.
- React Router v6 uses a scoring algorithm (specificity-based), not first-match ordering — unlike v5 and unlike Laravel's router.
- The layout outside `<Routes>` (header, wrappers) always renders; only the matched `<Route>`'s `element` changes.
- Don't lazy-load `NotFound` — it may be the very first component a user sees on a bad URL, and the chunk fetch would delay a simple message.
- No hooks or state needed for a 404 page — a `<Link>` back home is sufficient and keeps it simple.
