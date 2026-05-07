# FinFlow

A Mercury-style personal finance dashboard. Track accounts, transactions, spending by category, and net worth — all in a clean, minimal UI.

Built as a full-stack learning project: **React 18 + Redux Toolkit + TypeScript** on the frontend, **Haskell + Servant + SQLite** on the backend.

---

![Dashboard screenshot placeholder](https://via.placeholder.com/1200x600/0f172a/ffffff?text=FinFlow+Dashboard)

---

## Features

- **Account management** — Create, rename, and delete checking and savings accounts
- **Transaction tracking** — Add, edit, and delete transactions with description, amount, category, date, and type
- **Spending summary** — Visual breakdown of spending and income by category with proportion bars
- **Net worth card** — Total balance across all accounts with month-to-date net income/spending
- **Date-grouped transactions** — Transactions organised under "Today", "Yesterday", and date headers
- **Search and filter** — Filter by type (All / Credits / Debits) and search by description
- **Inline editing** — Click any transaction row or account name to edit in place
- **Category autocomplete** — Suggests your existing categories as you type
- **CSV export** — Download the current account's transactions as a spreadsheet
- **Optimistic updates** — New transactions appear instantly; rollback on API failure
- **Dark mode** — System-aware, toggleable from the header
- **Toast notifications** — Confirmation messages for account and transaction operations

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 + TypeScript (strict) |
| State management | Redux Toolkit 2.x |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v3 |
| Build tool | Vite |
| Backend language | Haskell (GHC 9.10) |
| Backend framework | Servant |
| HTTP server | Warp |
| Database | SQLite (via sqlite-simple) |
| Package manager | Stack (Haskell) / npm (frontend) |

---

## Prerequisites

Before you start, make sure you have:

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **Haskell Stack** — [docs.haskellstack.org](https://docs.haskellstack.org)

Verify both are installed:
```bash
node --version    # should print v18.x.x or later
stack --version   # should print Version 2.x.x or later
```

---

## Project Structure

```
finflow/
├── api/                    Haskell backend
│   ├── src/
│   │   ├── Main.hs         Servant routes, handlers, CORS config
│   │   ├── DB.hs           SQLite queries and balance sync logic
│   │   └── Types.hs        Account + Transaction types with JSON instances
│   ├── package.yaml        Haskell dependencies
│   └── stack.yaml          GHC version and resolver
│
└── frontend/               React frontend
    ├── src/
    │   ├── pages/          Dashboard, AccountDetail, NotFound
    │   ├── components/     UI components (AccountCard, TransactionRow, etc.)
    │   ├── store/          Redux slices and selectors
    │   ├── hooks/          Custom hooks (useTransactions, useDocumentTitle)
    │   ├── context/        ThemeContext, NotificationContext
    │   ├── api/            Fetch wrappers to the Haskell API
    │   ├── types/          Shared TypeScript interfaces
    │   └── test-utils/     Shared test utilities
    ├── src/__tests__/      Test files (83 passing)
    └── vite.config.ts      Vite + Vitest config
```

---

## Running the App

You need **two terminals** — one for the backend, one for the frontend.

### Terminal 1 — Haskell API

```bash
cd api

# First run: build the project (takes a few minutes)
stack build

# Start the server
stack exec finflow-api
```

You should see:
```
FinFlow API running on http://localhost:8080
```

The API will create `finflow.db` (SQLite) in the `api/` directory on first run and seed it with sample accounts and transactions.

> **Note:** Keep this terminal running. The frontend requires the API to fetch and persist data.

### Terminal 2 — React Frontend

```bash
cd frontend

# Install dependencies (first run only)
npm install

# Start the dev server
npm run dev
```

You should see:
```
  VITE v8.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Verify Everything is Working

With both servers running:

1. **Check the API directly:**
   ```bash
   curl http://localhost:8080/accounts
   # Should return a JSON array of accounts
   ```

2. **Check the frontend is fetching data:**
   Open DevTools → Network tab → reload the page. You should see requests to `localhost:8080/accounts` returning `200 OK`.

3. **End-to-end test:**
   Add a transaction → close the browser tab → reopen it. If the transaction is still there, the Haskell backend persisted it to SQLite correctly.

---

## Running Tests

```bash
cd frontend

# Run all tests once
npm test

# Watch mode (re-runs on file save)
npm run test:watch
```

Expected output:
```
 Test Files  10 passed (10)
      Tests  83 passed (83)
```

The test suite covers:
- Redux selectors and reducers (pure function tests)
- Custom hooks (`renderHook`)
- Component rendering (`render` + `screen`)
- User interactions (`userEvent`)
- Form submission with async assertions (`findByText`)
- Spy functions (`vi.fn()`, `toHaveBeenCalledWith`)
- Routed page components (`useParams` via `initialPath` + `routePath`)
- Snapshots (`toMatchSnapshot`)

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/accounts` | List all accounts |
| `POST` | `/accounts` | Create a new account |
| `PATCH` | `/accounts/:id` | Rename an account |
| `DELETE` | `/accounts/:id` | Delete account and all its transactions |
| `GET` | `/accounts/:id/transactions` | List transactions for an account |
| `POST` | `/accounts/:id/transactions` | Add a transaction |
| `PATCH` | `/transactions/:id` | Edit a transaction |
| `DELETE` | `/transactions/:id` | Delete a transaction |

All endpoints accept and return JSON. Account balances are recalculated from transactions on every write — the database is always consistent.

---

## Development Notes

### Resetting the database

The SQLite database lives at `api/finflow.db`. To start fresh with seed data:

```bash
rm api/finflow.db
stack exec finflow-api   # recreates and seeds on first run
```

### Production build

```bash
cd frontend
npm run build   # outputs to frontend/dist/
```

### Rebuilding the Haskell binary

```bash
cd api
stack build
stack exec finflow-api
```

---

## Learning Resources

This project was built as a learning exercise. The `/docs/` folder contains detailed write-ups for every React/Redux concept, Haskell pattern, and testing technique introduced during development.

Start with [`docs/GUIDE.md`](docs/GUIDE.md) for the full learning arc and a map to every doc.

---

## License

MIT
