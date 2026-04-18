# FinFlow — Claude Code Project Context

## Project Purpose

FinFlow is a Mercury-style personal finance dashboard. The goal is a clean, minimal UI for viewing accounts, transactions, and financial summaries. It is also a **learning project** — the developer is an experienced Vue 3 / Laravel engineer learning React, Redux Toolkit, and TypeScript. Haskell is planned for Phase 2 as the backend.

When building features, explain what you're doing and why. Never just write code silently. Build one thing at a time.

---

## Developer Background

| Area | Level |
|------|-------|
| Vue 3 (Composition API) | Expert |
| Laravel | Expert |
| React | Beginner — actively learning |
| Redux Toolkit | Beginner — actively learning |
| TypeScript | Beginner - actively learning |
| Tailwind CSS | Comfortable |
| Haskell | Phase 2 — not yet started |

**Adjust all explanations to this profile.** Use Vue/Laravel analogies wherever they help. Don't over-explain HTML or CSS basics, but explain React and Redux concepts thoroughly — both in plain English and in technical terms. The developer wants to truly understand the code, not just ship it.

---

## Tech Stack

**Frontend (Phase 1 — active)**
- React 18 + TypeScript (strict)
- Redux Toolkit 2.x
- Tailwind CSS v3
- Vite
- React Router DOM v7

**Backend (Phase 2 — future)**
- Haskell (stack TBD)
- REST or GraphQL API

---

## Folder Structure

```
finflow/
├── frontend/
│   └── src/
│       ├── components/       # UI components, one per file, PascalCase
│       ├── store/
│       │   ├── index.ts      # configureStore, RootState, AppDispatch
│       │   └── slices/       # one file per slice (accountsSlice.ts, etc.)
│       ├── pages/            # route-level components (Phase 1 future)
│       ├── hooks/            # custom hooks (Phase 1 future)
│       └── types/
│           └── index.ts      # shared TypeScript interfaces
├── api/                      # Phase 2 — Haskell backend
├── docs/                     # Learning documentation (gitignored)
│   ├── components/           # one .md per component
│   └── store/                # one .md per slice
└── .claude/
    ├── commands/             # custom slash commands
    └── skills/               # reference patterns for Claude
```

> **Note:** Current slices (`accountsSlice.ts`, `transactionsSlice.ts`) live directly in `src/store/` — move to `src/store/slices/` as the project grows.

---

## Redux Store Shape

```ts
// Full store state type
{
  accounts: {
    accounts: Account[]         // Array of bank/savings accounts
  },
  transactions: {
    transactions: Transaction[] // Array of financial transactions
  }
}
```

**Types** (defined in `src/types/index.ts`):

```ts
interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings';
  balance: number;
}

interface Transaction {
  id: string;
  accountId: string;           // foreign key to Account.id
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;                // ISO 8601
  category: string;
}
```

---

## Coding Rules

These rules apply to every file written in this project. Do not deviate without flagging it.

### Components
- Functional components only. No class components, ever.
- One component per file. File name matches component name in PascalCase.
- TypeScript strict — no `any` types. If you're tempted to use `any`, use `unknown` and narrow it.
- Tailwind for all styling. No inline `style={{}}` props. No external CSS files per component.
- Extract sub-components when a component exceeds ~80 lines or has clearly separate responsibilities.

### Redux
- Use Redux Toolkit (`createSlice`, `configureStore`). No manual action type strings.
- Seed data lives in `initialState`. No hardcoded values in components.
- `useSelector` selectors must be typed with `RootState`. Never select the whole state.
- `useDispatch` must use the typed `AppDispatch` type (once we introduce dispatch).

### TypeScript
- All component prop types defined as interfaces, not inline type literals.
- Export types from `src/types/index.ts`. Don't redefine the same shape in multiple files.
- `ReturnType<>`, `typeof`, and other utility types are preferred over manually maintained types.

### Libraries
- **Never install a new library without flagging it first** and explaining why it's needed, what it does, and whether a built-in alternative exists.

### Workflow
- **Build one thing at a time.** Complete and document it before starting the next.
- After every new component or Redux slice, generate a doc in `/docs/`.

---

## Documentation Rules

Every component and Redux slice gets a corresponding markdown file in `/docs/`:

- Component docs → `/docs/components/ComponentName.md`
- Slice docs → `/docs/store/sliceName.md`

Each doc must include:
1. What was built (one sentence)
2. File location
3. Key concepts introduced — explained in plain English AND technical detail
4. Vue/Laravel analogy for each major concept
5. Code walkthrough of the important parts
6. What to remember (3–5 bullets)

The `/docs/` folder is gitignored — it is a learning journal, not project documentation.

---

## Available Slash Commands

| Command | Purpose |
|---------|---------|
| `/doc` | Generate a learning doc for the last built feature |
| `/explain` | Explain a concept or piece of code |
| `/review` | Review the current file for React/Redux best practices |
| `/next` | Suggest the single next logical thing to build |
