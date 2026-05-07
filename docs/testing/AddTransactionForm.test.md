# Form Interaction Tests — AddTransactionForm

## What Was Built
4 passing tests for `AddTransactionForm` covering the disabled state, field enabling on input, field clearing after submission, and the async error message — using `userEvent.type`, `getByLabelText`, `findByText`, and `vi.mock` for deterministic API failure.

## File Location
`src/__tests__/AddTransactionForm.test.tsx`

---

## Concepts Introduced

### getByLabelText — querying form controls by their visible label

**Plain English**
`screen.getByText('Description')` finds the label element itself. That's not what you want when typing — you want the input the label is for. `screen.getByLabelText('Description')` does what you actually mean: find the `<input>` that has a `<label>Description</label>` associated with it via `htmlFor`/`id`. This is the correct way to find form fields in tests, because it reflects how users (and screen readers) navigate forms.

**Technically Speaking**
`getByLabelText(text)` implements the ARIA accessible name computation: it searches for a `<label>` with the given text content, reads its `for` attribute (or `htmlFor` in React), then finds the element with the matching `id`. It also handles `aria-label` and `aria-labelledby`. If the `for`/`id` link is broken (because someone changed the `useId()` output or the label was removed), the query throws — catching the accessibility bug as a test failure. `userEvent.type(getByLabelText('Description'), 'Netflix')` then fires keyboard events into that specific input.

**Vue / Laravel Analogy**
Vue Testing Library has the identical `getByLabelText` API. In Vue Test Utils, you'd write `wrapper.find('[id="description"]')` — which finds the input but doesn't validate the label association. RTL's `getByLabelText` is more robust because it also proves the label is correctly wired. In Laravel's Dusk browser tests, `$browser->type('@description', 'Netflix')` uses element data-selectors rather than labels.

**Common Mistakes**
1. **Using `getByText('Description')` and then trying to type into it.** `getByText` finds the `<label>` element, not the input. You can't type into a label. Use `getByLabelText`.
2. **Querying by placeholder instead of label.** `getByPlaceholderText('Enter description')` works but doesn't validate the label relationship. Labels are the accessible identifier; placeholders are just hints that disappear when you type.
3. **Expecting `getByLabelText` to find inputs with no associated label.** If a form field has no `<label htmlFor>` (only a placeholder), `getByLabelText` will throw. This is correct behavior — it's telling you the field lacks an accessible label.

---

### findByText — polling the DOM for async content

**Plain English**
`screen.getByText('...')` checks the DOM right now. If the text isn't there yet, it throws immediately. `screen.findByText('...')` is the async version — it returns a Promise that keeps checking every 50ms until the text appears (or times out after 1 second). You need this whenever text appears after an async operation: a state update triggered by a resolved Promise, a network response, or a dispatch that settles after the current event loop tick.

In this test, after `user.click(submitButton)`, the click events fire but `handleSubmit` keeps running asynchronously. The error message only appears after `dispatch(...).unwrap()` rejects and `setSubmitError` is called. `findByText` waits for that chain to complete.

**Technically Speaking**
`findByText(text, options?, waitForOptions?)` is syntactic sugar for `waitFor(() => getByText(text))`. `waitFor` polls using `MutationObserver` (falling back to `setInterval`) to detect DOM changes, then calls the callback. It resolves when the callback no longer throws, or rejects when `timeout` (default 1000ms) is exceeded. The async chain is: `user.click` → events fire → `handleSubmit` starts → form resets → `dispatch(thunk)` starts → mock rejects → `.unwrap()` throws → `catch` fires → `setSubmitError` → React re-render → DOM updates → `findByText` resolves.

**Vue / Laravel Analogy**
In Vue Test Utils with async components:
```ts
await wrapper.vm.$nextTick()
expect(wrapper.text()).toContain('Transaction failed')
```
`$nextTick()` waits for Vue's next render cycle — equivalent to waiting for one tick. `waitFor`/`findByText` is more powerful: it keeps retrying across multiple render cycles and Promises, not just one. In Laravel Dusk, `$browser->waitForText('Transaction failed')` is the server-side browser equivalent.

**Common Mistakes**
1. **Using `getByText` for content that appears asynchronously.** If the error message renders after an async dispatch, `getByText` will throw because the text isn't there yet. Use `findByText` or `waitFor(() => screen.getByText(...))`.
2. **Forgetting `await` before `findByText`.** `screen.findByText(...)` returns a Promise. Without `await`, the assertion passes trivially (you're asserting on a Promise object, which is always truthy).
3. **Using `findByText` when `getByText` is sufficient.** If content is rendered synchronously (present immediately after `render()`), `getByText` is clearer and faster. Save `findByText` for genuinely async scenarios.

---

### vi.mock — replacing a module for deterministic test behavior

**Plain English**
The error test needs `createTransaction` to fail immediately. In a test environment, `fetch` to `localhost:8080` eventually fails (no server), but it takes time — potentially longer than `findByText`'s 1-second timeout. `vi.mock` replaces the entire `../api` module with a version where `createTransaction` immediately rejects. This makes the test fast and deterministic, regardless of network speed or server availability.

`importOriginal()` loads the real api module so you can spread it — keeping all the other real functions (`fetchAccounts`, `deleteAccount`, etc.) and only replacing the one you need.

**Technically Speaking**
`vi.mock(modulePath, factory)` is hoisted to the top of the test file by Vitest's transform pipeline before any `import` statements execute. This ensures the mock is in place when the component module first imports `../api`. The factory function receives `importOriginal` — a function that loads the real module, typed as `() => Promise<T>`. The spread `...actual` preserves every real export except `createTransaction`, which is replaced with `vi.fn().mockRejectedValue(new Error('API unavailable'))`. `vi.fn()` creates a spy function; `.mockRejectedValue(error)` makes it return `Promise.reject(error)` on every call.

**Vue / Laravel Analogy**
In Vue projects using Jest or Vitest, `jest.mock('axios')` or `vi.mock('axios')` intercepts HTTP calls at the module level — identical pattern. In Laravel, `Http::fake(['*' => Http::response([], 500)])` or `Http::preventStrayRequests()` serves the same purpose: preventing real network calls in tests and returning controlled responses. The philosophy is the same: tests should not depend on external services.

**Common Mistakes**
1. **Using `vi.spyOn` instead of `vi.mock` for ES module functions.** `vi.spyOn(api, 'createTransaction')` can fail with ES module mocking depending on how the module is compiled. `vi.mock` at the file level is more reliable for replacing individual exports.
2. **Forgetting `...actual` when spreading the real module.** If you return only `{ createTransaction: vi.fn() }`, all other api functions (`fetchAccounts`, `deleteAccount`, etc.) become undefined. Spread the original to preserve them.
3. **Expecting `vi.mock` to work when placed inside a test.** Vitest hoists `vi.mock` to the top of the file. A `vi.mock` inside `it()` or `beforeEach()` will still execute at hoist time, not when the test runs — which can cause confusing ordering bugs. Keep `vi.mock` at module level.

---

## Code Walkthrough

### The vi.mock setup
```ts
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    createTransaction: vi.fn().mockRejectedValue(new Error('API unavailable')),
  };
});
```
Module-level, hoisted before imports. `importOriginal()` loads the real api module — `typeof import('../api')` gives TypeScript the full type for the real module, enabling correct inference of the spread. `mockRejectedValue` makes every call to `createTransaction` return an instantly-rejected Promise. The rest of the api (fetch, delete, etc.) remains real — this test doesn't touch them.

### The fillRequiredFields helper
```ts
async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Description'), 'Netflix');
  await user.type(screen.getByLabelText('Amount'), '15.99');
  await user.type(screen.getByLabelText('Category'), 'Subscriptions');
}
```
Extracted from three tests that share the same setup. The type parameter `ReturnType<typeof userEvent.setup>` is derived from the `userEvent.setup()` return — avoids importing the `UserEvent` type manually. Each `user.type` fires one keypress event per character, updating React's controlled input state after each.

### The findByText assertion
```ts
await user.click(screen.getByRole('button', { name: 'Add' }));

expect(await screen.findByText('Transaction failed — please try again.')).toBeTruthy();
```
After the click, `findByText` polls. The chain: click → `handleSubmit` starts → form resets → thunk dispatches → `api.createTransaction` (mock) rejects immediately → `.unwrap()` throws → `catch` fires → `setSubmitError` → React re-renders. `findByText` resolves when the error text appears, usually in the next render cycle (under 100ms with the immediate mock rejection).

---

## What to Remember

- `getByLabelText` finds form inputs by their associated `<label>` — the accessible, correct way to query form fields in tests.
- `findByText` is the async query that polls until text appears — required after any async state update, not just the next render tick.
- `vi.mock` is hoisted before imports — define it at module level, not inside tests.
- Spread `...actual` from `importOriginal()` to keep all real module exports; replace only the function(s) under test.
- Relying on real network failures for error tests is fragile (timing-dependent) — always mock API calls that you expect to fail.
