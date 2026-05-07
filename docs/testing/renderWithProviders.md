# renderWithProviders — Custom Render Utility

## What Was Built
A `renderWithProviders` utility in `src/test-utils/` that wraps components under test with the full provider stack (Redux, NotificationProvider, MemoryRouter) and accepts `preloadedState` for store setup — eliminating the duplicated `makeWrapper` pattern from 5 test files.

## File Location
`src/test-utils/renderWithProviders.tsx`

---

## Concepts Introduced

### Custom render function — wrapping RTL's render with preconfigured providers

**Plain English**
React Testing Library's `render(<Component />)` mounts a component with no context — no Redux store, no router, no notification provider. Every test file that needs those had to define the same `makeWrapper` setup. A custom render function calls RTL's `render` internally but always includes all the providers. Test files that import `renderWithProviders` get the full provider stack automatically. They only need to specify what's unique to their test: the component and the initial state.

This is the React Testing Library team's recommended approach for projects with multiple required providers, documented explicitly in their setup guide.

**Technically Speaking**
`renderWithProviders(ui, options)` wraps RTL's `render(ui, { wrapper: Wrapper, ...options })` where `Wrapper` is a component that nests the providers. The function signature follows RTL's extension pattern: it extends `RenderOptions` (omitting `wrapper` since that's managed internally) and adds a `preloadedState` field. It returns `RenderResult & { store: EnhancedStore }` — everything RTL's `render` normally returns (unmount, rerender, baseElement, etc.) plus the configured store for direct inspection.

The `preloadedState` merging:
```ts
accounts: { accounts: [], loading: false, error: null, ...preloadedState.accounts }
```
This pattern ensures callers can pass partial slice state — just `{ accounts: [myAccount] }` — without specifying `loading` or `error`. The spread applies caller overrides on top of complete defaults.

**Vue / Laravel Analogy**
In Vue Testing Library projects, a `createWrapper` factory that installs Pinia, Vue Router, and other plugins for every test:
```ts
// test-utils.ts
export function renderWithPlugins(component, options = {}) {
  const pinia = createTestingPinia({ initialState: options.initialState })
  const router = createRouter({ history: createMemoryHistory(), routes })
  return render(component, {
    global: { plugins: [pinia, router, ...options.plugins ?? []] },
    ...options
  })
}
```
Same pattern — a thin wrapper around the testing library's render that bundles required infrastructure. In Laravel's feature tests, `$this->withMiddleware()` or custom `TestCase` base classes serve the same role: common setup extracted once rather than repeated in every test.

**Common Mistakes**
1. **Not returning the store from the utility.** A custom render that only wraps with providers is useful, but returning `{ store, ...renderResult }` lets tests call `store.getState()` or `store.dispatch(action)` for integration-style assertions. Leaving out the store forces tests back to complex workarounds.
2. **Hardcoding initial state instead of using `preloadedState`.** A utility with `accounts: [seedAccount1, seedAccount2]` hardcoded isn't reusable — every test would fight the same starting state. `preloadedState` with defaults keeps it flexible.
3. **Including too many providers.** Only include providers that most tests need. A `ThemeProvider` for dark mode is optional in tests; including it adds overhead without value. Keep the utility minimal.

---

### preloadedState merging — partial overrides with complete defaults

**Plain English**
Redux's `configureStore({ preloadedState })` requires a complete state shape — if you pass `{ accounts: { accounts: [myAccount] } }`, it complains that `loading` and `error` are missing from the `accounts` slice. The utility solves this by merging the caller's overrides onto a set of safe defaults:
```ts
accounts: { accounts: [], loading: false, error: null, ...preloadedState.accounts }
```
Now callers only specify what matters for their test — the rest defaults to a neutral state. `{ accounts: { accounts: [myAccount] } }` becomes `{ accounts: [myAccount], loading: false, error: null }` before it reaches the store.

**Technically Speaking**
The interface `PreloadedState` uses `Partial<AccountsState>` for each slice — TypeScript allows any subset of the slice's fields. The spread `...preloadedState.accounts` applies caller overrides last, so they win over defaults. If `preloadedState` is `undefined` (no argument), the `preloadedState` option to `configureStore` is also `undefined`, and each slice's own `initialState` is used instead — no explicit default needed for the no-argument case.

**Vue / Laravel Analogy**
Pinia's `createTestingPinia({ initialState: { accounts: { list: [...] } } })` handles partial state — Pinia merges with the store's `$state` defaults. In Laravel, `config(['app.locale' => 'en'])` in a test overrides only the key you care about, leaving all other config at defaults. The pattern — partial overrides onto complete defaults — is universal in testing setups.

**Common Mistakes**
1. **Passing a fully-specified state and forgetting to update it when a slice gains new fields.** If `AccountsState` gets a new `lastUpdated` field, hardcoded state in tests breaks. The partial merge `...preloadedState.accounts` automatically handles new fields via the defaults.
2. **Nesting incorrectly.** `preloadedState: { accounts: [account] }` (array directly) vs `preloadedState: { accounts: { accounts: [account] } }` (slice object). The outer key is the Redux slice name; the inner keys are the slice's state fields.

---

## Code Walkthrough

### The function signature
```ts
export function renderWithProviders(
  ui: ReactElement,
  { preloadedState, ...renderOptions }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
```
Destructuring `preloadedState` from the options separates it from RTL's `RenderOptions` — `preloadedState` is our custom addition; `renderOptions` contains RTL's native options (like `baseElement`) that get passed through unchanged. The default `= {}` means the function works with no options at all: `renderWithProviders(<Component />)`.

### The store creation and provider chain
```tsx
const store = configureStore({
  reducer: { accounts: accountsReducer, transactions: transactionsReducer },
  preloadedState: preloadedState ? {
    accounts: { accounts: [], loading: false, error: null, ...preloadedState.accounts },
    transactions: { transactions: [], loading: false, error: null, ...preloadedState.transactions },
  } : undefined,
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <NotificationProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </NotificationProvider>
    </Provider>
  );
}
```
The store is created fresh per call — no state leaks between tests. `MemoryRouter` innermost ensures any navigation hooks (`useNavigate`, `useParams`) have access to the Router context while also having access to Redux (Provider is outermost). The `Wrapper` is a component, not a render function — RTL's `wrapper` option expects a React component type.

### Passing the store back to the caller
```ts
return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
```
The spread of `render(...)` gives the caller all of RTL's normal return values: `unmount`, `rerender`, `baseElement`, `debug`, etc. Adding `store` lets tests call `store.getState()` after interactions to assert on Redux state directly — useful for integration tests that need to verify both UI and state.

### The migrated test file
```ts
// Before
render(<NetWorthCard />, { wrapper: makeWrapper({ accounts: [account(1000)] }) });

// After
renderWithProviders(<NetWorthCard />, {
  preloadedState: { accounts: { accounts: [account(1000)] } },
});
```
The test body is unchanged; only the setup call simplified. `render` import dropped, `Provider`, `configureStore`, `accountsReducer`, `transactionsReducer` imports dropped — 20+ lines of infrastructure removed.

---

## What to Remember

- `renderWithProviders` calls RTL's `render` internally with a `wrapper` that includes all required providers — callers never configure providers directly.
- Return `{ store, ...render(...) }` so tests can call `store.getState()` or `store.dispatch()` when they need to assert on Redux state after an interaction.
- Merge `preloadedState` overrides onto complete slice defaults so callers only specify what's relevant to their test, not every field.
- Keep the utility in `src/test-utils/` not `src/__tests__/` — it's shared infrastructure, not a test file.
- Returning `EnhancedStore` (not the full generic type) keeps the TypeScript surface area manageable without losing type safety.
