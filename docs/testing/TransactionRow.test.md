# Callback Spy Tests — TransactionRow

## What Was Built
8 passing tests for `TransactionRow` using `vi.fn()` as spy props — verifying the component renders correctly, calls `onDelete` with the right transaction when the delete button is clicked, calls it exactly once, and doesn't fire `onUpdate` when delete is clicked.

## File Location
`src/__tests__/TransactionRow.test.tsx`

---

## Concepts Introduced

### vi.fn() — a spy function passed as a prop

**Plain English**
`vi.fn()` creates an empty function that records every time it's called: when, how many times, and with what arguments. You pass it as a prop to a component, trigger an interaction, and then ask "was this function called? With what?" The component doesn't know or care that it's a spy rather than a real function — it just calls `onDelete(transaction)` as instructed by its own code.

This is the "contract testing" pattern: you're not testing whether the delete ultimately removes a transaction from the database — that's the job of the Redux reducer tests. You're testing the component's specific contract: "when the delete button is clicked, call `onDelete` with this transaction." That's a small, focused test of one responsibility.

**Technically Speaking**
`vi.fn()` returns a `MockFunction` — a callable with a `.mock` property containing `calls: CallArgs[][]`, `results: MockResult<T>[]`, and `instances: Context[]`. Matchers like `toHaveBeenCalledWith` and `toHaveBeenCalledTimes` read from `.mock.calls`. `toHaveBeenCalledWith(txn)` checks that at least one call's argument list deep-equals `[txn]`. `toHaveBeenCalledTimes(1)` checks `.mock.calls.length === 1`. `not.toHaveBeenCalled()` checks `.mock.calls.length === 0`.

Because `TransactionRow`'s `handleDelete` is `useCallback(() => { onDelete(transaction) }, [onDelete, transaction])`, the spy receives the exact `transaction` reference passed as the prop. Deep equality and reference equality both pass.

**Vue / Laravel Analogy**
In Vue Test Utils with Vitest or Jest:
```ts
const onDelete = vi.fn()
mount(TransactionRow, {
  props: { transaction: txn, onDelete, onUpdate: vi.fn() }
})
await wrapper.find('[aria-label="Delete Netflix"]').trigger('click')
expect(onDelete).toHaveBeenCalledWith(txn)
```
Identical pattern — `vi.fn()` as a prop spy, assert after interaction. In Laravel's PHPUnit, event listeners or closure-based callbacks are tested similarly:
```php
$listener = $this->spy(Listener::class);
$event->fire();
$listener->shouldHaveReceived('handle')->with($expectedData);
```
The concept is universal: inject a spy into the code under test, trigger the code path, assert the spy's call record.

**Common Mistakes**
1. **Not resetting spies between tests.** A `vi.fn()` created inside each test is fresh — it has no call history. A `vi.fn()` created at module level and reused would accumulate calls from previous tests. Always create spies inside `it()` or use `beforeEach(() => vi.clearAllMocks())`.
2. **Using `toHaveBeenCalled()` instead of `toHaveBeenCalledWith(txn)`.** `toHaveBeenCalled()` only verifies the function was called — not that it was called with the right argument. A component that calls `onDelete()` with no arguments would pass `toHaveBeenCalled()` but fail `toHaveBeenCalledWith(txn)`.
3. **Asserting on `vi.fn()` passed to the wrong prop.** Passing the spy as `onUpdate` and clicking delete — `onUpdate` shouldn't fire and wouldn't, so the assertion would trivially pass. Always pass the spy to the prop you intend to test.

---

### toHaveBeenCalledTimes — testing that stopPropagation worked

**Plain English**
The delete button has `e.stopPropagation()` to prevent the click from bubbling up to the row container, which would open edit mode. Without it, clicking delete would call `onDelete` AND trigger `startEdit`. The `toHaveBeenCalledTimes(1)` assertion is the test that catches this: if `onDelete` were called twice, the test would fail, indicating a propagation bug.

**Technically Speaking**
`e.stopPropagation()` prevents the DOM event from bubbling to ancestor elements. In React's synthetic event system, this is implemented by setting `event.isPropagationStopped()` to `true`, which stops React's event delegation loop from calling further handlers. Without it, a click on the delete button would fire: delete button's `onClick` → row div's `onClick` (edit mode). `toHaveBeenCalledTimes(1)` verifies the propagation stop worked: `onDelete` was called exactly once (from the delete button), not twice (once from the button and once if a secondary path were somehow triggered).

**Vue / Laravel Analogy**
In Vue, `@click.stop` is the template shorthand for `e.stopPropagation()`. Testing it: `expect(onDelete).toHaveBeenCalledTimes(1)` in Vitest/Jest is identical. In Laravel, event propagation doesn't apply (server-side), but the concept of verifying something fired exactly N times appears in:
```php
$listener->shouldHaveReceived('handle')->once();
```
The pattern — assert call count, not just presence — is universal.

**Common Mistakes**
1. **Only testing `toHaveBeenCalled()` and missing double-fire bugs.** `toHaveBeenCalled()` passes whether a function was called once or ten times. Always use `toHaveBeenCalledTimes(n)` when call count is part of the contract.
2. **Forgetting to test the negative.** `expect(onUpdate).not.toHaveBeenCalled()` after clicking delete verifies isolation — the wrong callback wasn't fired. This catches bugs where an event handler accidentally calls multiple callbacks.

---

### getByRole with name option — disambiguating multiple buttons

**Plain English**
A component can have multiple buttons: the row div itself has `role="button"` and `aria-label="Edit Netflix"`, and the delete icon has `aria-label="Delete Netflix"`. If you call `getByRole('button')` without the `name` option, RTL throws "Found multiple elements." The `name` option narrows to one: `getByRole('button', { name: /delete netflix/i })` finds only the delete button by its accessible name. This is also more readable — the test's intent is clear from the query.

**Technically Speaking**
ARIA accessible names are computed from `aria-label`, `aria-labelledby`, or the element's text content. `getByRole('button', { name: /delete netflix/i })` finds `<button aria-label="Delete Netflix">` because the accessible name matches the regex `/delete netflix/i`. The `/i` flag makes the match case-insensitive — resilient if the label casing changes. Using regex over exact strings (`name: 'Delete Netflix'`) is preferred for accessible name queries because they're less brittle.

**Vue / Laravel Analogy**
Vue Testing Library has the identical `getByRole` API with the same `name` option. In Laravel Dusk:
```php
$browser->click('[aria-label="Delete Netflix"]')
```
This queries by the ARIA attribute directly rather than by computed accessible name — less flexible but equivalent in outcome.

**Common Mistakes**
1. **Querying by CSS class instead of accessible name.** `screen.getByClass('delete-button')` doesn't exist in RTL. Query by what the user and screen reader experience: role + name.
2. **Using exact string matching when regex is clearer.** `{ name: 'Delete Netflix' }` breaks if the transaction description changes casing or gains punctuation. Regex `{ name: /delete netflix/i }` is more resilient.

---

## Code Walkthrough

### The spy setup
```ts
it('calls onDelete with the transaction when delete button is clicked', async () => {
  const onDelete = vi.fn();
  const user = userEvent.setup();
  render(<TransactionRow transaction={txn} onDelete={onDelete} onUpdate={vi.fn()} />, {
    wrapper: makeWrapper(),
  });

  await user.click(screen.getByRole('button', { name: /delete netflix/i }));

  expect(onDelete).toHaveBeenCalledWith(txn);
});
```
`vi.fn()` is created inside `it()` — fresh for each test. `onUpdate={vi.fn()}` passes another spy for the prop the test doesn't care about — a real function could be used, but `vi.fn()` is lighter. The assertion reads like the component's contract: "given a delete click, `onDelete` was called with `txn`."

### The three-angle delete assertions
```ts
expect(onDelete).toHaveBeenCalledWith(txn);       // correct argument
expect(onDelete).toHaveBeenCalledTimes(1);         // correct count
expect(onUpdate).not.toHaveBeenCalled();           // no cross-contamination
```
Three separate `it()` blocks, each focused on one assertion. This is the single-assertion principle: when a test fails, you know exactly which part of the contract broke. A test with all three assertions together would give a less informative failure message.

### The edit mode pre-fill test
```ts
it('edit form is pre-filled with the current description', async () => {
  const user = userEvent.setup();
  render(<TransactionRow transaction={txn} onDelete={vi.fn()} onUpdate={vi.fn()} />, {
    wrapper: makeWrapper(),
  });

  await user.click(screen.getByRole('button', { name: /edit netflix/i }));

  const input = screen.getByLabelText('Description') as HTMLInputElement;
  expect(input.value).toBe('Netflix');
});
```
After clicking the row, the edit form appears. `getByLabelText('Description')` finds the input by its label — the same accessible query used in the form tests. `input.value` reads the controlled input's current value — should match the transaction's description. This test verifies the `startEdit` callback's `setDraft(transaction)` correctly initializes the form with current values.

---

## What to Remember

- `vi.fn()` created inside `it()` is always fresh — no state leaks between tests.
- `toHaveBeenCalledWith(txn)` uses deep equality — it verifies the exact argument, not just that the function was called.
- `toHaveBeenCalledTimes(1)` is the test for `e.stopPropagation()` — it catches double-fire propagation bugs that `toHaveBeenCalled()` would miss.
- `getByRole('button', { name: /delete netflix/i })` disambiguates multiple buttons by their accessible name — always prefer role + name queries over CSS class or data-testid.
- Pass `vi.fn()` to every callback prop, not just the one under test — then `expect(otherSpy).not.toHaveBeenCalled()` verifies prop isolation.
