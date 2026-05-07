# Component Tests — NetWorthCard

## What Was Built
7 passing component render tests for `NetWorthCard` using `render` + `screen` from React Testing Library — verifying the skeleton state, the loaded state with formatted balance, and the monthly net display.

## File Location
`src/__tests__/NetWorthCard.test.tsx`

---

## Concepts Introduced

### render + screen — mounting a component and querying its output

**Plain English**
`render(<NetWorthCard />)` mounts the component into a simulated browser DOM (jsdom). From that point, `screen` gives you a set of query functions to find elements by what's visible: text, role, label text, placeholder. `screen.getByText('Net worth')` finds an element whose text content is "Net worth". If it's not there, the test fails. If it IS there, you know the component rendered that text.

This is different from `renderHook` — instead of testing what a hook *returns*, you're testing what a component *displays*. You're reading the DOM the same way a real user would read the page, just through JavaScript queries instead of eyes.

**Technically Speaking**
`render(ui: ReactElement, options?: RenderOptions)` renders the element into a `<div>` appended to `document.body` using React's `createRoot`. The `screen` object provides bound queries that search within `document.body`. `screen.getByText(text)` uses the `ByText` query which finds elements by their full text content (the `textContent` property, which concatenates all child text nodes). If exactly one match is found, it returns the element. If zero or more than one, it throws with a detailed error message showing the DOM tree.

`screen.queryByText(text)` is the null-safe variant — it returns `null` instead of throwing when no match is found, making it appropriate for negative assertions (`expect(screen.queryByText('...')).toBeNull()`).

**Vue / Laravel Analogy**
In Vue Test Utils:
```ts
const wrapper = mount(NetWorthCard, { global: { plugins: [store] } })
expect(wrapper.text()).toContain('Net worth')
expect(wrapper.find('.balance').text()).toBe('$1,500.00')
```
`render` + `screen` is RTL's philosophy applied: query by what the user sees (text, roles) rather than by CSS selectors or component internals. In Laravel's Dusk browser tests, `$browser->assertSee('Net worth')` is the direct equivalent — asserting that visible text exists.

**Common Mistakes**
1. **Using `getByText` for negative assertions.** `getByText` throws when nothing is found — you can't wrap it in `expect(...).toBeNull()`. Use `queryByText` for negative checks.
2. **Forgetting `afterEach(cleanup)` in Vitest.** In Jest, RTL patches `afterEach` automatically. In Vitest, this patching sometimes doesn't fire. Without explicit `afterEach(cleanup)`, rendered components accumulate in `document.body` and multiple tests find multiple matches, causing "Found multiple elements" errors.
3. **Querying by CSS class instead of visible text.** `screen.getByClass('net-worth-label')` doesn't exist — RTL intentionally avoids CSS class queries. Query by what the user sees: `getByText`, `getByRole`, `getByLabelText`.

---

### afterEach(cleanup) — the Vitest-specific RTL cleanup requirement

**Plain English**
Every `render()` call mounts a new component into `document.body`. Without cleanup, the body accumulates all renders from every test in the file — by the third test, there are three `<section>` elements in the DOM. When test three calls `getByText('month to date')`, it finds three matches and throws. `cleanup()` unmounts everything React rendered and removes it from the DOM. `afterEach(cleanup)` runs this after every test, keeping each test isolated.

**Technically Speaking**
`cleanup()` from `@testing-library/react` calls `ReactDOM.unmountComponentAtNode` (or `root.unmount()` for React 18+) on all containers created by `render()` during the test, then removes those containers from `document.body`. In Jest, RTL adds `afterEach(cleanup)` globally via `jest.setup.ts` or by patching Jest's lifecycle automatically. In Vitest, the auto-patching is less reliable — explicit `afterEach(cleanup)` in each file or in a `setupFiles` config is the safe approach.

**Vue / Laravel Analogy**
Vue Test Utils has `wrapper.unmount()` which must be called explicitly after each test (or via `afterEach`). The problem and solution are identical: component mounting is cumulative within a test run unless explicitly cleaned up. In Laravel's database testing, `RefreshDatabase` trait plays the same role — resetting state between tests so they don't contaminate each other.

**Common Mistakes**
1. **Relying on Vitest's automatic RTL cleanup.** Unlike Jest, Vitest doesn't always trigger RTL's automatic cleanup. Always add `afterEach(cleanup)` explicitly in `.test.tsx` files that use `render`.
2. **Putting cleanup in `beforeEach` instead of `afterEach`.** `beforeEach(cleanup)` leaves the previous test's DOM in place until the next test starts — failures in the previous test may leave stale DOM that interferes with error reporting.

---

### textContent concatenation — how getByText handles adjacent text nodes

**Plain English**
The `NetWorthCard` monthly net renders like this: `{isPositive ? '+' : ''}{fmt.format(monthlyNet)}`. These are two separate JSX expressions, which the DOM stores as two adjacent text nodes inside one `<p>` element: the first containing `"+"` and the second containing `"$500.00"`. When you call `screen.getByText('+$500.00')`, RTL reads the `<p>` element's `textContent` property — which concatenates all child text nodes: `"+" + "$500.00"` = `"+$500.00"`. The query matches the full concatenated content, even though the DOM has two nodes.

**Technically Speaking**
`textContent` is a standard DOM property that returns the concatenation of all descendant text nodes' `data` values. RTL's `ByText` queries normalize whitespace (trim + collapse multiple spaces into one) and then compare against the element's normalized textContent. Two adjacent text nodes `"+"` and `"$500.00"` produce textContent `"+$500.00"` with no space between them — the exact string to pass to `getByText`. This means `screen.getByText('+$500.00')` correctly finds the `<p>` despite the split rendering.

**Vue / Laravel Analogy**
Vue Test Utils' `wrapper.text()` returns `element.textContent` — the same concatenation. `expect(wrapper.find('p').text()).toBe('+$500.00')` would work identically. The DOM's text content model is framework-agnostic.

**Common Mistakes**
1. **Trying `getByText('$500.00')` when the full text is `'+$500.00'`.** With `exact: true` (default), RTL requires the full textContent match. Since the `<p>` has `"+$500.00"` as its full content, `getByText('$500.00')` finds nothing. Either use `getByText('+$500.00')` or `getByText('$500.00', { exact: false })` for substring matching.
2. **Assuming `getByText` searches text nodes directly.** RTL queries elements by their `textContent`, not by individual text node values. A `<p>+<span>$500.00</span></p>` and a `<p>+$500.00</p>` both produce textContent `"+$500.00"` and both match `getByText('+$500.00')`.

---

## Code Walkthrough

### afterEach cleanup
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

afterEach(cleanup);
```
At module level, before any test. `afterEach(cleanup)` registers a Vitest lifecycle hook that runs after every `it()` in this file, unmounting all components React rendered during that test and clearing the DOM. This is the first line to add in any test file that uses `render`.

### The skeleton tests using queryByText
```ts
it('does not show "Net worth" label while loading', () => {
  render(<NetWorthCard />, { wrapper: makeWrapper() });
  expect(screen.queryByText(/net worth/i)).toBeNull();
});
```
`makeWrapper()` with no arguments creates a store with empty accounts — the skeleton state. `queryByText(/net worth/i)` uses a case-insensitive regex — appropriate here since the component renders `"Net worth"` (mixed case) and we don't need to be brittle about exact casing. The assertion is `toBeNull()` — `queryByText` returns null when nothing is found, unlike `getByText` which throws.

### The balance test using exact text
```ts
it('shows the formatted total balance', () => {
  render(<NetWorthCard />, { wrapper: makeWrapper({ accounts: [account(1500)] }) });
  expect(screen.getByText('$1,500.00')).toBeTruthy();
});
```
`account(1500)` creates an account with balance 1500. `selectNetWorth` sums it to 1500. `fmt.format(1500)` produces `'$1,500.00'`. `getByText` finds the `<p>` whose textContent is exactly `'$1,500.00'`. The exact string is predictable because `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` is deterministic in a stable locale.

### The zero monthly net edge case
```ts
it('shows +$0.00 when there are no transactions this month (zero is treated as positive)', () => {
  render(<NetWorthCard />, { wrapper: makeWrapper({ accounts: [account(1000)] }) });
  expect(screen.getByText('+$0.00')).toBeTruthy();
});
```
`isPositive = monthlyNet >= 0` — zero passes the `>=` check, so `+` is prepended. The test name documents this behavior explicitly. This test was discovered by writing the incorrect assertion first (`queryByText('+$0.00').toBeNull()`), which failed and revealed the actual component behavior. Tests that fail on incorrect assumptions are valuable — they document edge cases the original author hadn't thought about.

---

## What to Remember

- Always add `afterEach(cleanup)` in Vitest test files that use `render` — Vitest doesn't auto-register RTL's cleanup the way Jest does.
- Use `queryByText` for negative assertions (returns null); use `getByText` for positive ones (throws if missing).
- `getByText('+$500.00')` works even when `+` and `$500.00` are separate JSX text nodes — RTL queries the element's full `textContent`.
- `makeWrapper({ accounts, transactions })` is the same Redux Provider pattern as hook tests — the same factory for both component and hook testing.
- When a test fails with "Found multiple elements", the cause is almost always missing cleanup — previous renders are accumulating in `document.body`.
