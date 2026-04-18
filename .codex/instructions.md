# FinFlow — Codex Instructions

## Project Purpose

FinFlow is a Mercury-style personal finance dashboard. The goal is a clean, minimal UI for viewing accounts, transactions, and financial summaries. It is a **learning project** — the developer is an experienced Vue 3 / Laravel engineer actively learning React, Redux Toolkit, and TypeScript. Haskell is planned for Phase 2 as the backend.

---

## Developer Background

| Area | Level |
|------|-------|
| Vue 3 (Composition API) | Expert |
| Laravel | Expert |
| React | Beginner — actively learning |
| Redux Toolkit | Beginner — actively learning |
| TypeScript | Intermediate |
| Tailwind CSS | Comfortable |
| Haskell | Phase 2 — not yet started |

Adjust all explanations to this profile. Use Vue/Laravel analogies wherever they help. React and Redux concepts must be explained thoroughly — both in plain English and technically — not just demonstrated in code.

---

## Tech Stack

**Frontend (Phase 1 — active)**
- React 18 + TypeScript (strict mode)
- Redux Toolkit 2.x
- Tailwind CSS v3
- Vite
- React Router DOM v7

**Backend (Phase 2 — future)**
- Haskell
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
│       ├── pages/            # route-level components
│       ├── hooks/            # custom hooks
│       └── types/
│           └── index.ts      # shared TypeScript interfaces
├── api/                      # Phase 2 — Haskell backend
├── docs/                     # Learning documentation (gitignored)
│   ├── components/
│   └── store/
└── .claude/
    ├── commands/
    └── skills/
```

> Current slices live directly in `src/store/` — move to `src/store/slices/` as the project grows.

---

## Redux Store Shape

```ts
{
  accounts: {
    accounts: Account[]
  },
  transactions: {
    transactions: Transaction[]
  }
}
```

**Types** (`src/types/index.ts`):

```ts
interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings';
  balance: number;
}

interface Transaction {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;          // ISO 8601
  category: string;
}
```

---

## Coding Rules

### Components
- Functional components only. No class components.
- One component per file. PascalCase naming.
- TypeScript strict — no `any` types. Use `unknown` and narrow instead.
- Tailwind for all styling. No inline `style={{}}` props.
- Extract sub-components when a component exceeds ~80 lines or handles multiple concerns.

### Redux
- Redux Toolkit only (`createSlice`, `configureStore`). No raw action type strings.
- Seed data lives in `initialState` in the slice. Never hardcode data in components.
- `useSelector` must be typed with `RootState`.
- `useDispatch` must use the typed `AppDispatch`.

### TypeScript
- Prop types as interfaces, not inline type literals.
- All shared types exported from `src/types/index.ts`.
- Use `ReturnType<>`, `typeof`, and other utility types rather than manually maintaining derived types.

### Libraries
- Flag any new library before installing it. Explain what it does, why it's needed, and whether a built-in alternative exists.

### Workflow
- Build one thing at a time.
- After every component or Redux addition, generate a doc in `/docs/`.

---

## How to Help Me Learn

This is not a shipping project — it is a learning project. Follow these rules in every response:

### 1. Explain what you build
Never just write code. After (or before) writing code, explain:
- What the new code does in plain English
- Why it's structured the way it is
- What React or Redux concept it introduces or uses

### 2. Use Vue and Laravel analogies
For every major React or Redux concept, map it to the Vue 3 Composition API or Laravel equivalent. Show both side by side when possible. If there's no analogy, explain why the concept doesn't exist in Vue/Laravel — that gap itself is instructive.

Examples:
- `useSelector` ↔ `computed(() => store.value)` in Pinia
- `Provider` ↔ `app.use(createPinia())`
- JSX ↔ Vue `<template>` block, but colocated with logic
- Redux reducer ↔ Vuex mutation / Pinia action

### 3. Two explanation layers
For every new concept:
- **Plain English first** — what it does, what problem it solves, no jargon without definition
- **Technically** — what's happening at the framework or language level, using correct terminology

### 4. Build one thing at a time
Do not build multiple components or slices in one response unless explicitly asked. Complete one thing, document it, and wait.

### 5. Always generate a `/docs` entry
After building a component, create or update `/docs/components/ComponentName.md`.
After building a Redux slice, create or update `/docs/store/sliceName.md`.

The doc format:
1. What was built (one sentence)
2. File location
3. Key concepts introduced (plain + technical + Vue analogy)
4. Code walkthrough
5. What to remember (3–5 bullets)

### 6. Flag new libraries
Never `npm install` anything without first explaining what the library does, why it's needed, and whether a built-in alternative exists. Wait for approval before installing.

---

## Documentation Rules

- `/docs/` is gitignored — it is a personal learning journal
- Component docs: `/docs/components/ComponentName.md`
- Slice docs: `/docs/store/sliceName.md`
- Never delete or overwrite a doc — append or update in place
