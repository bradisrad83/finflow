# Complete Migration to renderWithProviders

## What Was Built
All 4 remaining test files migrated from inline `makeWrapper` to `renderWithProviders`, with `createWrapper` exported separately from the utility to support `renderHook` tests that need the wrapper component without calling `render`.

## File Location
`src/test-utils/renderWithProviders.tsx`, `src/__tests__/useTransactions.test.tsx`, `src/__tests__/AccountsOverview.test.tsx`, `src/__tests__/AddTransactionForm.test.tsx`, `src/__tests__/TransactionRow.test.tsx`

---

## Concepts Introduced

### createWrapper — the underlying factory extracted for renderHook

**Plain English**
`renderWithProviders` calls RTL's `render` internally, which mounts a component into a DOM node. But `renderHook` is different — it mounts a hook inside a minimal component and expects you to pass a wrapper component type separately. You can't call `renderWithProviders` and then pass it as a `wrapper`. The solution: extract the store creation and provider wrapping into `createWrapper`, which returns just the component type. `renderWithProviders` calls `createWrapper` internally; `renderHook` tests call it directly.

**Technically Speaking**
```ts
export function createWrapper(options: WrapperOptions = {}): {
  wrapper: ComponentType<{ children: ReactNode }>;
  store: EnhancedStore;
}
```
`createWrapper` returns a plain object with `wrapper` (a React component type) and `store` (the configured Redux store). `renderWithProviders` destructures this internally: `const { wrapper: Wrapper, store } = createWrapper(options)`. Hook tests do the same but only extract `.wrapper`. The separation maintains DRY: one place configures the provider stack, two different test APIs consume it.

TypeScript types `wrapper` as `ComponentType<{ children: ReactNode }>` — the exact type that both `renderHook`'s `wrapper` option and `renderWithProviders`'s internal `wrapper` option expect.

**Vue / Laravel Analogy**
Vue Testing Library doesn't have a direct `renderHook` equivalent — Vue composables are called inside `setup()` within `mount()`. The `createWrapper` pattern is specific to React Testing Library where hooks and components have different mounting APIs. In Laravel, this pattern is analogous to extracting shared test setup into a `TestCase` base class method that can be called from both unit tests and feature tests.

**Common Mistakes**
1. **Calling `renderWithProviders` as the wrapper for `renderHook`.** `renderWithProviders` calls `render()` internally — it's not a React component type. `renderHook({ wrapper: renderWithProviders(...) })` won't work. Use `createWrapper({ ... }).wrapper`.
2. **Forgetting `.wrapper` when using `createWrapper` with `renderHook`.** `renderHook({ wrapper: createWrapper() })` passes the return object, not the component. Always destructure: `const { wrapper } = createWrapper()`.

---

### The hookWrapper helper pattern

**Plain English**
Each `renderHook` call in `useTransactions.test.tsx` needed a different set of transactions. Before the migration, `makeWrapper(transactions)` accepted the array directly. After, `createWrapper({ preloadedState: { transactions: { transactions } } })` achieves the same thing but using the standard options format. The `hookWrapper` function is a local helper that compresses this into one line:

```ts
function hookWrapper(transactions: Transaction[]) {
  return createWrapper({ preloadedState: { transactions: { transactions } } }).wrapper;
}
```

This keeps the test call sites clean: `{ wrapper: hookWrapper([t1, t2]) }` — identical to the old `{ wrapper: makeWrapper([t1, t2]) }` but backed by the shared utility.

**Technically Speaking**
The double `transactions` key in `{ transactions: { transactions } }` is intentional: the outer key is the Redux slice name (`transactions`), the inner key is the slice's state field (`transactions: Transaction[]`). The shorthand property `{ transactions }` is equivalent to `{ transactions: transactions }`. The `preloadedState` type allows `Partial<TransactionsState>` for the inner object, so only the `transactions` array needs to be specified — `loading` and `error` default to `false`/`null` from the merge.

**Vue / Laravel Analogy**
In Pinia test setup with `createTestingPinia({ initialState: { transactions: { list: [...] } } })`, the same double-nesting pattern appears — outer key is the store name, inner key is the state property. The pattern is consistent across React/Redux and Vue/Pinia testing.

**Common Mistakes**
1. **Passing transactions directly instead of nested.** `preloadedState: { transactions: [t1, t2] }` would try to set the entire transactions slice to an array, which doesn't match `TransactionsState`. The correct form is `{ transactions: { transactions: [t1, t2] } }`.

---

### When to use renderWithProviders vs createWrapper

**Plain English**
Use `renderWithProviders` for component tests — it calls `render()` and returns the full RTL result plus the store. Use `createWrapper` when you need just the wrapper component: for `renderHook` tests, or if you need to configure the store for inspection before rendering. As a rule: if your test calls `render` or `renderHook`, use `renderWithProviders` or `createWrapper` respectively. Never define a local `makeWrapper` — that was the pattern before the shared utility existed.

**Technically Speaking**
The decision tree:
- **`renderHook(() => useMyHook(), { wrapper })`** → `const { wrapper } = createWrapper(options)`
- **`render(<MyComponent />, { wrapper })`** → use `renderWithProviders(<MyComponent />, options)` instead (it handles the wrapper internally)
- **need the store AND rendered result** → `const { store, ...rest } = renderWithProviders(<MyComponent />, options)`
- **need the store before rendering** → `const { store, wrapper } = createWrapper(options); const result = render(ui, { wrapper })`

**Vue / Laravel Analogy**
In Vue Testing Library, `mount` handles both components and composables (via an adapter component). There's no separate `renderHook`. The `createWrapper`/`renderWithProviders` split is React-specific — it exists because React hooks and React components have different test mounting APIs.

**Common Mistakes**
1. **Creating a new `makeWrapper` for a special case.** If `renderWithProviders` doesn't cover a use case, extend its options first. A local `makeWrapper` creates a second source of truth for provider configuration.
2. **Using `renderWithProviders` inside a describe block that creates its own wrapper.** Some tests nest `renderWithProviders` inside a factory function with extra setup. This is fine as long as the factory calls `renderWithProviders` — it should never recreate the provider stack manually.

---

## Code Walkthrough

### The refactored renderWithProviders.tsx
```ts
export function createWrapper(options: WrapperOptions = {}): {
  wrapper: ComponentType<{ children: ReactNode }>;
  store: EnhancedStore;
} {
  const { preloadedState, initialPath = '/', routePath } = options;
  const store = configureStore({ ... });
  function Wrapper({ children }) { ... }
  return { wrapper: Wrapper, store };
}

export function renderWithProviders(ui, { preloadedState, initialPath, routePath, ...renderOptions } = {}) {
  const { wrapper: Wrapper, store } = createWrapper({ preloadedState, initialPath, routePath });
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
```
`renderWithProviders` is now three lines: delegate to `createWrapper`, then call `render`. No duplication — both exports share one implementation. The store is returned from both, so tests can inspect state after rendering or after a hook call.

### The hookWrapper helper
```ts
function hookWrapper(transactions: Transaction[]) {
  return createWrapper({ preloadedState: { transactions: { transactions } } }).wrapper;
}

// Usage:
const { result } = renderHook(() => useTransactions('1'), {
  wrapper: hookWrapper([t1, t2]),
});
```
One function, one line. The helper converts the domain-specific argument (`transactions: Transaction[]`) into the generic `createWrapper` options format, extracting `.wrapper` at the end. Every `renderHook` call in the file uses `hookWrapper` — the configuration is defined once and the test bodies are readable.

### The final import set in each migrated test
```ts
// Before (6-8 imports for provider boilerplate)
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import type { ReactNode } from 'react';
import accountsReducer from '../store/accountsSlice';
import transactionsReducer from '../store/transactionsSlice';

// After (1 import replaces all of the above)
import { renderWithProviders } from '../test-utils/renderWithProviders';
```
Five import lines collapse to one. The test file now imports only what's unique to its tests — the component, the types, the spy functions. Infrastructure is invisible.

---

## What to Remember

- `createWrapper` returns `{ wrapper, store }` — use `.wrapper` for `renderHook`, use the whole result for when you need the store too.
- `renderWithProviders` = `createWrapper` + `render` — use it for component tests.
- No test file should define `makeWrapper` or import `configureStore`, `Provider`, or slice reducers directly — that's all handled by the shared utility.
- The `hookWrapper` local helper pattern: adapt `createWrapper`'s generic options to a domain-specific argument, extract `.wrapper`.
- After any infrastructure migration, verify with `grep -l "makeWrapper\|configureStore"` — zero results is the goal.
