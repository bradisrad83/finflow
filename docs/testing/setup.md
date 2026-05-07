# Global Test Setup with Vitest setupFiles

## What Was Built
A `src/test-utils/setup.ts` file registered via Vitest's `setupFiles` config that runs `afterEach(cleanup)` globally — eliminating the need to import and call cleanup in every individual test file.

## File Location
`src/test-utils/setup.ts`, `vite.config.ts`

---

## Concepts Introduced

### setupFiles — global test infrastructure executed before every test file

**Plain English**
Every test file that renders React components needs `afterEach(cleanup)` to prevent DOM accumulation between tests. Having to import `cleanup`, import `afterEach`, and call `afterEach(cleanup)` in every file is repetitive — and forgetting it causes "Found multiple elements" errors that are annoying to debug.

`setupFiles` is a Vitest config option that lists files to run before each test file. Anything in those files — lifecycle hooks, polyfills, global mocks, testing library setup — applies to every test automatically. You add cleanup once, globally. Every future test file gets it for free.

**Technically Speaking**
`setupFiles: ['./src/test-utils/setup.ts']` in `vite.config.ts` tells Vitest's test runner to import and execute `setup.ts` before evaluating each test module. The execution order per test file is:
1. jsdom environment is initialized
2. `setupFiles` execute — `afterEach(cleanup)` is registered in the global Vitest lifecycle
3. The test file is evaluated — `describe`/`it` blocks are registered
4. Tests run — the globally-registered `afterEach(cleanup)` fires after each one

`afterEach` from Vitest registers a lifecycle callback in the current scope. When called in a `setupFiles` context (before any test file runs), it registers at the global scope — affecting every test in every file. This is different from calling `afterEach` inside a `describe` block (affects only that block) or at the top level of a test file (affects only that file).

**Vue / Laravel Analogy**
Jest's `setupFilesAfterFramework` serves the identical purpose:
```js
// jest.config.js
setupFilesAfterFramework: ['<rootDir>/src/test-utils/setup.js']
```
In Vue Testing Library projects, the setup file typically includes `import '@testing-library/vue'` which auto-registers cleanup. In Laravel's PHPUnit, the `TestCase` base class (which all test classes extend) plays the same role — `setUp()` and `tearDown()` methods defined once in the base class apply to all inheriting tests. `setupFiles` is Vitest's equivalent of the base class pattern.

**Common Mistakes**
1. **Confusing `setupFiles` with `globalSetup`.** `globalSetup` runs once before the entire test suite and doesn't have access to the test lifecycle (no `afterEach`, no `beforeEach`). `setupFiles` runs before each test file and has full access to lifecycle hooks. Use `setupFiles` for per-test setup; use `globalSetup` only for one-time external setup like starting a database.
2. **Forgetting to remove per-file cleanup after adding global cleanup.** If `afterEach(cleanup)` exists in both `setup.ts` and individual test files, it runs twice — harmless but noisy. Remove the per-file calls after registering globally.
3. **Adding too much to the setup file.** `setup.ts` should contain only infrastructure that every test needs. Mocks specific to one component or one test suite belong in `vi.mock(...)` at the test file level, not in global setup. Keeping global setup minimal prevents unwanted side effects in unrelated tests.

---

### The execution order — why cleanup must be in setupFiles, not globalSetup

**Plain English**
There are two kinds of Vitest "global" setup: `setupFiles` (runs before each test file, has lifecycle hooks) and `globalSetup` (runs once before the entire suite, no lifecycle hooks). `afterEach(cleanup)` is a lifecycle hook — it's called "after each test." That only makes sense inside the per-file execution context, where Vitest's test runner is managing individual tests. In `globalSetup`, there are no individual tests to hook into yet, so `afterEach` doesn't exist. `setupFiles` is the right choice.

**Technically Speaking**
Vitest's architecture separates global orchestration (`globalSetup` — starts/stops test workers) from per-file execution context (`setupFiles` — runs in each worker's module scope). `afterEach` is a function exported from Vitest's worker runtime (`import { afterEach } from 'vitest'`), which only exists in the per-file context. Calling `afterEach` registers a callback in Vitest's internal lifecycle stack for the current file's context. When called in `setupFiles`, the "current context" is the root scope — affecting all files processed by that worker.

**Vue / Laravel Analogy**
Laravel's PHPUnit distinguishes between `setUpBeforeClass()` (runs once per test class) and `setUp()` (runs before each test method). `cleanup` is the equivalent of `tearDown()` — it must run after each test method, not once per class. `setupFiles` corresponds to `setUp()`/`tearDown()` in a shared base class; `globalSetup` corresponds to `setUpBeforeClass()`.

**Common Mistakes**
1. **Trying to put `afterEach` in `globalSetup`.** `globalSetup` runs in a different process context where Vitest's test lifecycle functions don't exist. The file won't find `afterEach` and may silently fail or throw. Always use `setupFiles` for lifecycle hooks.
2. **Using `globalSetup` for browser environment setup.** `globalSetup` runs in Node, not in the jsdom environment. If you need to polyfill browser globals, do it in `setupFiles` where jsdom is already initialized.

---

## Code Walkthrough

### The entire setup file
```ts
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);
```
Three lines. `cleanup` unmounts all React components rendered during a test and removes their containers from `document.body`. `afterEach(cleanup)` registers that call to happen after every individual test — including tests in files that don't know this file exists. The import of `afterEach` from `'vitest'` (not from some global) makes the registration explicit and TypeScript-safe.

### The vite.config.ts addition
```ts
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test-utils/setup.ts'],
},
```
`setupFiles` accepts an array — you can register multiple setup files if needed (e.g., one for RTL setup, one for custom matchers). The path is relative to the Vite config file's location. Vitest resolves it against the project root, so `'./src/test-utils/setup.ts'` works regardless of which directory the test runner is invoked from.

### What was removed from each test file
```ts
// Before — in 4 test files
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
afterEach(cleanup);

// After — in those same files
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
// no afterEach(cleanup) — handled globally
```
Two imports removed, one function call removed, per file. Across 4 files: 12 lines eliminated. More importantly: every future test file that uses `render` gets cleanup automatically without needing to know it exists.

---

## What to Remember

- `setupFiles` runs before each test file in its execution context — lifecycle hooks like `afterEach` are available and apply globally.
- `globalSetup` runs once before the entire suite in a Node process — no lifecycle hooks, no jsdom, wrong place for `afterEach(cleanup)`.
- Keep `setup.ts` minimal: only infrastructure every test needs. Component-specific mocks belong in individual test files.
- After adding global cleanup, remove `afterEach(cleanup)` from individual files — otherwise it runs twice.
- The path in `setupFiles` is relative to the project root (where `vite.config.ts` lives), not to the test files.
