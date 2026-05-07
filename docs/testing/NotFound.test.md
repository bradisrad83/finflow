# Snapshot Tests — NotFound

## What Was Built
A snapshot test for the `NotFound` page component that captures its complete rendered HTML on first run and compares against it on subsequent runs — catching any unintended changes to the component's output.

## File Location
`src/__tests__/NotFound.test.tsx`, `src/__tests__/__snapshots__/NotFound.test.tsx.snap`

---

## Concepts Introduced

### toMatchSnapshot — capturing rendered output as the expected value

**Plain English**
A behavior test asserts something specific: "the text 'Page not found' exists." A snapshot test asserts something broader: "the entire rendered output is exactly what it was last time."

On first run, `toMatchSnapshot()` creates a `.snap` file containing the full serialized HTML of the component. The test always passes the first time — there's nothing to compare against yet. On every subsequent run, it serializes the current output and compares character-by-character against the stored snapshot. If a class name changes, an element is added, text is edited, an attribute appears — the test fails with a diff showing exactly what changed.

The developer then decides: was the change intentional? If yes, run `vitest --update-snapshots` to accept the new output. If no, the test caught a regression.

**Technically Speaking**
`expect(container).toMatchSnapshot()` serializes the DOM node using Vitest's snapshot serializer (which understands HTML nodes and formats them as indented markup). The result is stored in `__snapshots__/TestFileName.snap` as a named export: `exports["TestName > test description 1"]`. On subsequent runs, Vitest loads the stored value, serializes the current DOM the same way, and compares strings. A mismatch fails the test with a unified diff.

`container` is `HTMLElement` — the `<div>` that RTL renders the component into. Snapshotting `container` captures the full element tree. Snapshotting `container.firstChild` would capture just the root element (the `<section>`) without the wrapper div. Either works; `container` is more common.

**Vue / Laravel Analogy**
Vue Test Utils + Jest/Vitest:
```ts
const wrapper = mount(NotFound, { global: { plugins: [router] } })
expect(wrapper.html()).toMatchSnapshot()
```
`wrapper.html()` returns the serialized HTML string, equivalent to RTL's serialization of `container`. In Laravel, snapshot testing isn't a standard pattern — server-rendered views are typically tested with `assertSee` and `assertViewIs`. Snapshot testing is specific to component-based UI development where the rendered output is managed in JavaScript.

**Common Mistakes**
1. **Snapshotting dynamic components.** Components that render `new Date()`, random IDs, or data from the current store state produce different output on each run. The snapshot will fail every time or be meaningless if you update it each run. Only snapshot components whose output is fully deterministic.
2. **Blindly updating snapshots without reviewing the diff.** `vitest --update-snapshots` accepts *all* changed snapshots at once. If an unintended change sneaked in alongside an intentional one, it gets committed too. Always review the diff before accepting.
3. **Treating a failing snapshot as the test "passing."** When a snapshot fails because you intentionally changed the component, the workflow is: review the diff → confirm the change is correct → run `--update-snapshots` → commit the updated `.snap` file alongside the component change. The `.snap` file is part of the PR's expected output.

---

### The .snap file — version-controlled expected output

**Plain English**
The `.snap` file isn't a build artifact or a cache file — it's the snapshot test's expected value, committed to git alongside your code. When you change a component and the snapshot test fails, the git diff shows both the component change AND the rendered output change side by side. Reviewers can see in one PR: "the text changed from X to Y, and the rendered HTML changed from A to B." That's the signal that the change is intentional.

If the `.snap` file isn't committed, snapshots fail for every developer on every fresh checkout. If it's in `.gitignore`, the test always passes (creating a new snapshot every run). Both defeat the purpose.

**Technically Speaking**
Vitest writes snapshot files to `<testDir>/__snapshots__/` using the test file's name as the filename with `.snap` appended. The format is a CommonJS module exporting a template literal per snapshot, keyed by test name. On `vitest --update-snapshots`, Vitest overwrites the file with the current output. The snapshots are human-readable and diff cleanly in git — the tree structure, indentation, and attribute ordering are deterministic.

**Vue / Laravel Analogy**
Vue's snapshot files have the same format and same workflow — commit the `.snap` file, update it when changes are intentional. In Laravel, there's no direct equivalent; stored test fixtures in `tests/fixtures/` serve a similar purpose in some projects — expected output files committed alongside test files.

**Common Mistakes**
1. **Adding `*.snap` to `.gitignore`.** This makes snapshots generate fresh every run, which always passes — defeating the regression detection purpose entirely.
2. **Not committing updated `.snap` files with component changes.** If you update the component and run `--update-snapshots` but don't commit the `.snap` change, CI will fail when it runs the tests without the update.

---

## Code Walkthrough

### The minimal test
```tsx
function renderNotFound() {
  return render(
    <MemoryRouter>
      <NotFound />
    </MemoryRouter>,
  );
}

describe('NotFound', () => {
  it('matches the snapshot', () => {
    const { container } = renderNotFound();
    expect(container).toMatchSnapshot();
  });
});
```
`renderNotFound` is extracted into a helper because it's used once here but would be reused if more tests were added. The component only needs `MemoryRouter` (for the `<Link>` component) — no Redux, no NotificationProvider. `container` is the DOM root; `toMatchSnapshot()` serializes and stores the full HTML tree.

### The generated .snap file
```
exports[`NotFound > matches the snapshot 1`] = `
<div>
  <section class="px-8 py-20 flex flex-col items-center text-center">
    <p class="text-6xl font-semibold text-gray-200 dark:text-gray-700 select-none">
      404
    </p>
    <h1 class="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-50">
      Page not found
    </h1>
    ...
    <a class="..." href="/">
      Back to dashboard
    </a>
  </section>
</div>
`;
```
The key `NotFound > matches the snapshot 1` is composed from the test's `describe` label, `it` description, and an index (for multiple snapshots in one test). Every class, attribute, and text node is captured. Change `"Page not found"` to `"Page Not Found"` in `NotFound.tsx` and this test immediately fails with a diff showing the old and new text.

---

## What to Remember

- `toMatchSnapshot()` passes on first run (creates the snapshot); fails on subsequent runs if the output changed.
- Commit `.snap` files to git — they're the stored expected output, not a cache.
- Only snapshot static components whose output is fully deterministic (no dates, no random IDs, no dynamic state).
- `vitest --update-snapshots` accepts the new output as correct — always review the diff before running it.
- Use `container` (the full DOM wrapper) rather than `container.firstChild` to capture the complete rendered tree.
