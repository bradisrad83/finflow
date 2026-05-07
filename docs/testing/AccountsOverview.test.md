# Interaction Tests — AccountsOverview

## What Was Built
4 passing interaction tests for `AccountsOverview` using `userEvent` — verifying that clicking buttons opens the account modal and that the "Refresh balances" button correctly reflects the loading state.

## File Location
`src/__tests__/AccountsOverview.test.tsx`

---

## Concepts Introduced

### userEvent — simulating real user interactions

**Plain English**
`fireEvent.click(button)` fires a single synthetic click event. Real users don't do that — when you click something in a browser, dozens of events fire in sequence: the mouse moves over the element, the pointer goes down, the element receives focus, the pointer comes back up, then the click fires. `userEvent` simulates this full sequence. Most React event handlers work fine with either approach, but some (particularly those relying on focus events or pointer events) only work correctly when the full sequence fires. `userEvent` is the safer, more realistic choice.

**Technically Speaking**
`userEvent.setup()` returns a `UserEvent` instance with an internal state machine that tracks the simulated pointer position and focused element. Each interaction method is `async` because `userEvent` uses `Promise`-based scheduling to fire events in the correct order, yielding between events to let React process state updates between them. `await user.click(element)` fires `pointerover` → `pointerenter` → `mouseover` → `mouseenter` → `pointermove` → `mousemove` → `pointerdown` → `mousedown` → `focus` (if focusable) → `pointerup` → `mouseup` → `click`. React's synthetic event system wraps each underlying DOM event, so all React handlers fire normally. The `await` ensures all events — and all React state updates they trigger — have settled before your assertion runs.

**Vue / Laravel Analogy**
Vue Test Utils' `wrapper.trigger('click')` is synchronous and fires a single click event — closer to `fireEvent`. For realistic testing, some Vue Testing Library recipes use `fireEvent` with specific sequences. In Laravel Dusk, `$browser->click('.button')` triggers a real Chromium click through Selenium, which inherently fires the full event sequence. `userEvent` brings that realism to jsdom-based tests without a real browser.

**Common Mistakes**
1. **Forgetting `await` before user interactions.** `user.click(button)` returns a Promise. Without `await`, your assertion runs before the events have fired and React hasn't re-rendered yet — the assertion passes trivially or for the wrong reason.
2. **Using `fireEvent` when you mean `userEvent`.** `fireEvent.click` is fine for simple click handlers, but if clicking focuses an element and the handler reads `document.activeElement`, `fireEvent` misses the focus event. Use `userEvent` to be safe.
3. **Calling interaction methods directly on `userEvent` instead of a session.** `await userEvent.click(button)` (without `setup()`) creates a new isolated session per call — fine for simple tests but loses pointer state between actions. `userEvent.setup()` creates a shared session for multiple interactions in one test.

---

### Provider discovery — composing multiple context providers for tests

**Plain English**
When a component tree renders in a test, every `useContext` hook inside it looks for a matching `Provider` ancestor. If none exists, it either returns the default value or throws. `AddAccountModal` (which opens when you click the button) calls three hooks that each need a provider: `useDispatch` needs Redux's `Provider`, `useNotification` needs `NotificationProvider`, and `useNavigate` needs a React Router. The test wrapper must include all three.

The way to discover which providers are needed is to run the test, read the error, add the missing provider, repeat. This is normal — it's not something you can always predict upfront.

**Technically Speaking**
React's context system checks for the nearest matching `Context.Provider` ancestor in the fiber tree. `useNavigate()` calls `useContext(NavigationContext)` internally — if no `Router` ancestor exists, it throws. `useNotification()` similarly calls `useContext(NotificationContext)` and throws if not found. The wrapper component in `makeWrapper` is a React component that wraps the children in all required providers:
```tsx
<Provider store={store}>
  <NotificationProvider>
    <MemoryRouter>{children}</MemoryRouter>
  </NotificationProvider>
</Provider>
```
`MemoryRouter` (not `BrowserRouter`) is used for tests because it doesn't read or write `window.location` — tests run in jsdom where URL manipulation can cause unpredictable behavior. `MemoryRouter` maintains navigation state purely in memory.

**Vue / Laravel Analogy**
Vue Test Utils' `global.plugins` array:
```ts
mount(Component, {
  global: { plugins: [store, createRouter({ history: createMemoryHistory(), routes })] }
})
```
Same concept — inject all the plugins/providers the component tree depends on. In Laravel, this is analogous to binding fakes in the service container before a test: `$this->app->bind(Navigator::class, fn() => new FakeNavigator())`.

**Common Mistakes**
1. **Adding providers one at a time from memory rather than reading the error.** Component trees can have deep dependency chains. Let the test error tell you exactly which context is missing — the error message names the hook and the required provider.
2. **Using `BrowserRouter` in tests.** `BrowserRouter` reads `window.location`. In jsdom, navigating via `useNavigate` can leak state between tests or produce unexpected URL behavior. `MemoryRouter` is isolated and predictable.
3. **Putting the Router inside the store Provider instead of outside.** The order doesn't usually matter for correctness, but convention is: store outermost, then app-level contexts, then Router innermost (since some routing hooks need Redux to be available).

---

### getByRole — querying by accessibility role

**Plain English**
`screen.getByText('Add account')` queries by visible text — fine for unique strings. `screen.getByRole('button', { name: 'Add account' })` queries by HTML role AND accessible name. The accessible name is derived from the button's text content, `aria-label`, or `aria-labelledby`. Querying by role is more robust: it verifies both that the element exists AND that it's the right type of element (a button, not a paragraph). It also better reflects how assistive technologies interact with the page.

**Technically Speaking**
ARIA roles are mapped from HTML elements: `<button>` → role "button", `<a href>` → role "link", `<input type="text">` → role "textbox". `screen.getByRole('button', { name: /add account/i })` uses the WAI-ARIA accessible name computation algorithm — checking text content, `aria-label`, `aria-labelledby`, and `title` attributes in that priority order. This query style is RTL's recommended default because it validates accessibility semantics as part of the test. If a developer changes `<button>` to `<div onClick>`, the `getByRole('button')` test will correctly fail.

**Vue / Laravel Analogy**
In Vue Testing Library, `getByRole` is available from `@testing-library/vue` with identical semantics. In Laravel Dusk, `$browser->assertSee('Add account')` is the text-content equivalent, but Dusk doesn't natively query by ARIA role.

**Common Mistakes**
1. **Using `getByText` when `getByRole` is more appropriate for interactive elements.** For buttons, links, and form controls, `getByRole` is preferred — it validates both presence and semantic correctness.
2. **Forgetting the `{ name: ... }` option when multiple elements share a role.** A page with two buttons will cause `getByRole('button')` to throw "found multiple." The `name` option disambiguates.

---

## Code Walkthrough

### The complete wrapper
```tsx
function makeWrapper(options: { accounts?: Account[]; loading?: boolean } = {}) {
  const store = configureStore({
    reducer: { accounts: accountsReducer, transactions: transactionsReducer },
    preloadedState: {
      accounts: {
        accounts: options.accounts ?? [],
        loading: options.loading ?? false,
        error: null,
      },
      transactions: { transactions: [], loading: false, error: null },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <NotificationProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </NotificationProvider>
      </Provider>
    );
  };
}
```
Three providers: Redux for state, `NotificationProvider` for the toast context, `MemoryRouter` for navigation. The `loading` option allows testing both states of the button. Each `makeWrapper()` call creates a fresh isolated store.

### The interaction test
```ts
it('clicking "Add your first account" opens the modal', async () => {
  const user = userEvent.setup();
  render(<AccountsOverview />, { wrapper: makeWrapper() });

  await user.click(screen.getByText('Add your first account'));

  expect(screen.getByText('Account name')).toBeTruthy();
});
```
Three phases: setup (create user session + render), act (`await user.click`), assert (modal content visible). The `await` is essential — `user.click` is async and React state updates happen inside it. `screen.getByText('Account name')` finds the modal's label, which only exists after `setModalOpen(true)` triggers a re-render. Because `AddAccountModal` uses `createPortal` to render into `document.body`, `screen` finds it regardless of where in the component tree it was opened.

### The disabled button check
```ts
it('"Refresh balances" is disabled while loading', () => {
  render(<AccountsOverview />, { wrapper: makeWrapper({ loading: true }) });
  const button = screen.getByText('Refreshing…') as HTMLButtonElement;
  expect(button.disabled).toBe(true);
});
```
`{ loading: true }` in `preloadedState` sets the initial store state — the component reads `selectAccountsLoading` and immediately disables the button. No interaction needed; this is a pure rendering assertion. The `as HTMLButtonElement` cast gives TypeScript the `.disabled` property. The button text changes to "Refreshing…" when loading, so we query by that text.

---

## What to Remember

- `userEvent.setup()` creates a session; `await user.click(element)` simulates the full browser event sequence — always `await` it.
- Provider discovery: run the test, read the error, add the missing provider to the wrapper. `useNavigate` needs `MemoryRouter`, `useNotification` needs `NotificationProvider`, `useDispatch` needs Redux `Provider`.
- Use `MemoryRouter` not `BrowserRouter` in tests — it avoids `window.location` side effects in jsdom.
- `createPortal` content (like `AddAccountModal`) renders into `document.body` and is always reachable via `screen`, regardless of where in the component tree it was triggered.
- `afterEach(cleanup)` is still required — the same cleanup rule applies to interaction tests.
