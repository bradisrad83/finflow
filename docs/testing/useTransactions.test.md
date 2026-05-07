# Hook Tests — useTransactions

## What Was Built
10 passing tests for the `useTransactions` custom hook using `renderHook` from `@testing-library/react` with a Redux `Provider` wrapper, verifying accountId filtering, type filtering, query filtering, sort order, and combined filters.

## File Location
`src/__tests__/useTransactions.test.tsx`

---

## Concepts Introduced

### renderHook — testing a hook in a React context

**Plain English**
You can't call a React hook directly in a test file. `useTransactions('1')` outside a component throws an error: "Hooks can only be called inside the body of a function component." `renderHook` solves this — it's a function from React Testing Library that mounts a tiny invisible React component, runs your hook inside it, and gives you access to the return value. `result.current` is whatever the hook returned. You test it exactly like any other function output.

**Technically Speaking**
`renderHook<TResult, TProps>(renderCallback: (props: TProps) => TResult, options?: RenderHookOptions)` renders a host component that calls `renderCallback` and stores the result in a React ref. `result.current` exposes the most recent return value. React's fiber reconciler runs normally — `useEffect`, `useMemo`, `useSelector` all fire as they would in a real component. `options.wrapper` is a React component type that wraps the host component — used to inject providers. The hook is re-rendered whenever the provider's state changes, making `result.current` always reflect the latest value.

**Vue / Laravel Analogy**
Vue Test Utils uses `mount()` or `mountSuspense()` with a test plugin for Pinia:
```ts
const wrapper = mount(defineComponent({
  setup() { return { result: useTransactions('1') } },
  template: '<div />',
}), { global: { plugins: [createTestingPinia({ initialState: { ... } })] } })
```
`renderHook` is the React equivalent — a specialized version of `mount` for testing composables/hooks directly. In Laravel, testing a service class method is the analogy: you instantiate the service with test dependencies and call the method. `renderHook` is that instantiation step.

**Common Mistakes**
1. **Using a `.ts` extension for a file that contains JSX.** The `Wrapper` component in `makeWrapper` contains `<Provider>...</Provider>` — that's JSX. Vite's transform pipeline won't parse JSX in `.ts` files. Files with any JSX must use `.tsx`.
2. **Calling the hook directly without `renderHook`.** `useTransactions('1')` in test code throws immediately. React hooks must run inside a component's render cycle.
3. **Forgetting `result.current`.** `renderHook` returns a `RenderHookResult` object, not the hook's return value. The actual hook output is in `result.current`.

---

### makeWrapper — providing Redux context to a hook under test

**Plain English**
`useTransactions` calls `useSelector`, which reads from a Redux store. The store must be provided via a `<Provider>` component somewhere above in the React tree. In a real app, `<Provider store={store}>` lives at the root of `App.tsx`. In a test, you create a fresh store pre-filled with test data and wrap the hook in a `Provider` for that store. `makeWrapper` is a factory that builds this wrapper — one wrapper per test, each with its own controlled state.

**Technically Speaking**
`makeWrapper(transactions)` creates a Redux store using `configureStore` with `preloadedState` — this bypasses reducers and sets the initial state directly. It returns a `Wrapper` React component typed as `({ children: ReactNode }) => JSX.Element`. This matches the `ComponentType<{ children: ReactNode }>` type expected by `renderHook`'s `wrapper` option. Each test gets its own `makeWrapper` call, producing an isolated store — no state leaks between tests.

`preloadedState` only requires the slices relevant to the test. `useTransactions` reads only `state.transactions.transactions`, so only the `transactions` key of `preloadedState` needs to be set. TypeScript infers the type from the store's reducer configuration.

**Vue / Laravel Analogy**
In Vue Testing Library with Pinia:
```ts
const pinia = createTestingPinia({
  initialState: { transactions: { list: [...] } }
})
```
`createTestingPinia` is the Pinia equivalent of `makeWrapper` — both create a test-scoped store with controlled initial state. In Laravel, this is equivalent to binding a fake service in `$this->app->bind(TransactionRepository::class, fn() => new FakeRepo([...]))` before calling the code under test.

**Common Mistakes**
1. **Sharing a store across tests.** If `const store = configureStore(...)` is at module level and reused, one test's data leaks into the next. Always create a fresh store per test via `makeWrapper`.
2. **Only including the slice you think is needed.** If the hook or its selectors ever read from another slice, omitting it from `preloadedState` causes `undefined` reads. Including all slices with their defaults is safer.

---

### preloadedState — initializing a test store without dispatching

**Plain English**
`configureStore({ preloadedState })` starts the store with the state you provide, skipping the reducer's `initialState`. In a production app, the store starts empty and actions fill it. In tests, you want the store to already contain specific data. `preloadedState` is the direct path — you describe the exact state object and it's there immediately when the store is created. No dispatching, no waiting, no side effects.

**Technically Speaking**
`preloadedState: Partial<RootState>` is the second argument to RTK's `configureStore`. It's merged with each slice's `initialState` — slice keys in `preloadedState` override the slice's own defaults, keys not in `preloadedState` use the slice's defaults. TypeScript enforces that the shape matches `RootState` (or a partial of it). The store's getState() immediately returns this state before any actions are dispatched.

**Vue / Laravel Analogy**
Pinia's `createTestingPinia({ initialState: { ... } })` is the direct equivalent. In Laravel, `Config::set('some.key', 'test-value')` before a test call serves a similar purpose — injecting known state before the code runs. The pattern is universal: tests need to control their starting conditions.

**Common Mistakes**
1. **Dispatching actions to set up test state instead of using `preloadedState`.** `store.dispatch(addTransaction(t))` works but adds noise — the test verifies reducer logic rather than hook behavior. `preloadedState` is direct and intent-clear.
2. **Providing the full `TransactionsState` type when you only need transactions.** `preloadedState.transactions = { transactions: [...] }` is incomplete — `loading` and `error` are required by the type. Use `{ transactions: [...], loading: false, error: null }`.

---

## Code Walkthrough

### The wrapper factory
```tsx
function makeWrapper(transactions: Transaction[]) {
  const store = configureStore({
    reducer: { accounts: accountsReducer, transactions: transactionsReducer },
    preloadedState: {
      transactions: { transactions, loading: false, error: null },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}
```
`configureStore` creates a real Redux store with the test transactions pre-loaded. The returned `Wrapper` component is a valid React component that wraps its children in a Redux `Provider`. Each `makeWrapper` call produces a fresh, isolated store — no shared state between tests.

### A basic renderHook call
```ts
it('returns only transactions for the given account', () => {
  const t1 = txn({ accountId: '1' });
  const t2 = txn({ accountId: '2' });
  const { result } = renderHook(() => useTransactions('1'), {
    wrapper: makeWrapper([t1, t2]),
  });
  expect(result.current).toHaveLength(1);
  expect(result.current[0].id).toBe(t1.id);
});
```
`renderHook(() => useTransactions('1'), { wrapper: makeWrapper([t1, t2]) })` — the first arg is a callback that calls the hook, the second is options with the provider wrapper. `result.current` is the `Transaction[]` the hook returned. The hook ran inside a React component context with the provided store — `useSelector` found the store, `useMemo` ran the filter.

### The combined filter test
```ts
it('applies type and query filters together', () => {
  const creditNetflix = txn({ type: 'credit', description: 'Netflix refund' });
  const debitNetflix = txn({ type: 'debit', description: 'Netflix' });
  const debitOther = txn({ type: 'debit', description: 'Spotify' });
  const { result } = renderHook(
    () => useTransactions('1', { type: 'debit', query: 'netflix' }),
    { wrapper: makeWrapper([creditNetflix, debitNetflix, debitOther]) },
  );
  expect(result.current).toHaveLength(1);
  expect(result.current[0].description).toBe('Netflix');
  expect(result.current[0].type).toBe('debit');
});
```
Three transactions, two filters: type=debit AND query=netflix. Only `debitNetflix` survives both. The test names each transaction clearly (`creditNetflix`, `debitNetflix`, `debitOther`) so the assertion logic is obvious — no mental mapping required.

---

## What to Remember

- Hook test files that contain JSX (`<Provider>`) must use `.tsx` extension, not `.ts`.
- `renderHook(() => useHook(args), { wrapper: ProviderComponent })` — the hook goes in the callback, the provider goes in `wrapper`.
- `result.current` is the hook's return value — `renderHook` itself returns a result object, not the hook output.
- Create a fresh store per test via `makeWrapper` — never share store state between tests.
- `preloadedState` in `configureStore` sets initial state without dispatching actions — the direct path for test setup.
