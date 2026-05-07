# FinFlow — Project Guide

A Mercury-style personal finance dashboard. Built as a learning project for React, Redux Toolkit, and TypeScript, with a Haskell backend added in Phase 2. Every feature has a corresponding doc in this `/docs/` folder.

---

## Running the App

**Backend (required for live data):**
```bash
cd api
stack exec finflow-api
# → FinFlow API running on http://localhost:8080
```

**Frontend:**
```bash
cd frontend
npm run dev
# → http://localhost:5173
```

**Tests:**
```bash
cd frontend
npm test          # run once
npm run test:watch  # re-run on save
```

---

## Architecture

```
finflow/
├── api/                    Haskell REST API (stack)
│   └── src/
│       ├── Main.hs         Routes, handlers, CORS
│       ├── DB.hs           SQLite queries, balance sync
│       └── Types.hs        Account, Transaction types + JSON
│
└── frontend/               React + Redux + TypeScript (Vite)
    └── src/
        ├── pages/          Dashboard, AccountDetail, NotFound
        ├── components/     AccountCard, TransactionRow, etc.
        ├── store/          Redux slices + selectors
        ├── hooks/          useTransactions, useDocumentTitle, etc.
        ├── context/        ThemeContext, NotificationContext
        ├── api/            Fetch wrappers to the Haskell API
        ├── types/          Shared TypeScript interfaces
        └── test-utils/     renderWithProviders, setup.ts
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/accounts` | List all accounts |
| POST | `/accounts` | Create account |
| PATCH | `/accounts/:id` | Rename account |
| DELETE | `/accounts/:id` | Delete account + its transactions |
| GET | `/accounts/:id/transactions` | List transactions for account |
| POST | `/accounts/:id/transactions` | Add transaction |
| PATCH | `/transactions/:id` | Edit transaction |
| DELETE | `/transactions/:id` | Delete transaction |

Balances are recalculated from transactions on every write and at API startup — the `balance` column in SQLite is always authoritative.

---

## React / Redux Learning Arc

Each entry links to the doc where the concept was first introduced.

### Hooks

| Hook | Where documented |
|------|-----------------|
| `useState` | [WriteOperations.md](store/WriteOperations.md) |
| `useEffect` | [fetchOnMount.md](store/fetchOnMount.md) |
| `useRef` | [useRef.md](components/useRef.md) |
| `useReducer` | [TransactionList.md](components/TransactionList.md) |
| `useMemo` + `useCallback` + `React.memo` | [SpendingSummary.md](components/SpendingSummary.md) |
| `useContext` + `createContext` | [NotificationContext.md](components/NotificationContext.md) |
| `useLayoutEffect` | [InlineRename.md](components/InlineRename.md) |
| `useDeferredValue` | [useDeferredValue.md](components/useDeferredValue.md) |
| `useTransition` | [useTransition.md](components/useTransition.md) |
| `useId` | [AccessibleForms.md](components/AccessibleForms.md) |
| `useSearchParams` | [useSearchParams.md](components/useSearchParams.md) |
| `useNavigate` | [useNavigate.md](components/useNavigate.md) |
| `useParams` | [RouterNavigation.md](components/RouterNavigation.md) |

### Custom Hooks

| Hook | Where documented |
|------|-----------------|
| `useTransactions` | [hooks/useTransactions.md](hooks/useTransactions.md) |
| `usePersistStore` | [hooks/usePersistStore.md](hooks/usePersistStore.md) |
| `useDocumentTitle` | [hooks/useDocumentTitle.md](hooks/useDocumentTitle.md) |

### Redux Toolkit

| Concept | Where documented |
|---------|-----------------|
| `createSlice` + `createAsyncThunk` | [createAsyncThunk.md](store/createAsyncThunk.md) |
| `extraReducers` | [extraReducers.md](store/extraReducers.md) |
| `createSelector` + composition | [selectors.md](store/selectors.md) |
| Optimistic updates (pending/rejected lifecycle) | [OptimisticUpdates.md](store/OptimisticUpdates.md) |
| `thunkAPI.dispatch` | [DeleteAccount.md](store/DeleteAccount.md) |
| `thunkAPI.signal` (abort) | [AbortRequests.md](store/AbortRequests.md) |
| `thunkAPI.getState` | [EditTransaction.md](store/EditTransaction.md) |
| Fetch on mount + dependent effects | [fetchOnMount.md](store/fetchOnMount.md) + [fetchAllTransactions.md](store/fetchAllTransactions.md) |
| Balance sync across slices | [BalanceSync.md](store/BalanceSync.md) |

### React Patterns

| Pattern | Where documented |
|---------|-----------------|
| `React.lazy` + `Suspense` | [ReactLazy.md](components/ReactLazy.md) |
| `createPortal` | [AddAccountModal.md](components/AddAccountModal.md) |
| `forwardRef` | [Input.md](components/Input.md) |
| URL state with `useSearchParams` | [useSearchParams.md](components/useSearchParams.md) |
| Inline confirmation (destructive actions) | [DeleteAccount.md](store/DeleteAccount.md) |
| Component-as-form toggle | [EditTransaction.md](store/EditTransaction.md) |
| CSS custom properties + Tailwind | [CategoryBars.md](components/CategoryBars.md) |
| `Blob` + `URL.createObjectURL` | [CSVExport.md](components/CSVExport.md) |
| `<input type="date">` + UTC gotcha | [DatePicker.md](components/DatePicker.md) |
| Empty states | [EmptyState.md](components/EmptyState.md) |
| `<datalist>` autocomplete | [CategoryAutocomplete.md](components/CategoryAutocomplete.md) |

---

## Testing Arc

83 tests across 10 files. Infrastructure in `src/test-utils/`.

### Infrastructure

| File | Purpose |
|------|---------|
| `test-utils/setup.ts` | Global `afterEach(cleanup)` via `setupFiles` |
| `test-utils/renderWithProviders.tsx` | Custom render + `createWrapper` |

Docs: [setup.md](testing/setup.md), [renderWithProviders.md](testing/renderWithProviders.md), [completeMigration.md](testing/completeMigration.md)

### Test Files and Concepts

| File | New concept | Doc |
|------|------------|-----|
| `selectors.test.ts` | Pure function testing, `makeState` factory | [selectors.test.md](testing/selectors.test.md) |
| `accountsSlice.test.ts` | Reducer testing, `.fulfilled(payload, req, arg)` | [accountsSlice.test.md](testing/accountsSlice.test.md) |
| `transactionsSlice.test.ts` | Chained reducer calls for optimistic rollback | [transactionsSlice.test.md](testing/transactionsSlice.test.md) |
| `useTransactions.test.tsx` | `renderHook` + `createWrapper` | [useTransactions.test.md](testing/useTransactions.test.md) |
| `NetWorthCard.test.tsx` | `render` + `screen`, component testing | [NetWorthCard.test.md](testing/NetWorthCard.test.md) |
| `AccountsOverview.test.tsx` | `userEvent.click`, interaction testing | [AccountsOverview.test.md](testing/AccountsOverview.test.md) |
| `AddTransactionForm.test.tsx` | `userEvent.type`, `getByLabelText`, `findByText`, `vi.mock` | [AddTransactionForm.test.md](testing/AddTransactionForm.test.md) |
| `TransactionRow.test.tsx` | `vi.fn()` spy props, `toHaveBeenCalledWith` | [TransactionRow.test.md](testing/TransactionRow.test.md) |
| `AccountDetail.test.tsx` | Route params, `initialPath` + `routePath` | [AccountDetail.test.md](testing/AccountDetail.test.md) |
| `NotFound.test.tsx` | Snapshot testing, `toMatchSnapshot()` | [NotFound.test.md](testing/NotFound.test.md) |

---

## Haskell Backend Arc

| Topic | Doc |
|-------|-----|
| Initial API setup (Types, DB, Servant routes) | [haskell/SessionOne.md](haskell/SessionOne.md) |
| CORS fix, balance persistence | [haskell/DBBalanceSync.md](haskell/DBBalanceSync.md) |
| Wiring the frontend | [haskell/WireFrontend.md](haskell/WireFrontend.md) |

The backend maintains correct account balances in SQLite at the database layer. No React recalculation workarounds needed for data that survives server restarts.

---

## Key Files to Read First

If you're picking this up cold, read in this order:

1. **`src/types/index.ts`** — `Account` and `Transaction` interfaces. Everything flows from these.
2. **`src/store/index.ts`** — the Redux store shape.
3. **`src/store/selectors.ts`** — how state is read throughout the app.
4. **`src/pages/Dashboard.tsx`** — the root page, data loading pattern.
5. **`src/pages/AccountDetail.tsx`** — the most complex page; shows most patterns in one file.
6. **`src/test-utils/renderWithProviders.tsx`** — the test utility that everything else uses.

---

## Stats

- **83** passing tests across 10 files
- **59** learning docs across 7 subdirectories
- **8** Haskell API endpoints
- **~15** React hooks demonstrated
- **~10** Redux Toolkit patterns demonstrated
- **~10** testing patterns demonstrated
