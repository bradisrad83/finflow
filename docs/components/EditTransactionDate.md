# Edit Transaction Date

## What Was Built
A date field added to the `TransactionRow` inline edit form so users can correct a transaction's date alongside description, amount, category, and type — completing the edit flow for all transaction fields.

## File Location
`src/components/TransactionRow.tsx`

---

## Concepts Introduced

### Pattern reuse — applying primitives in a new context

**Plain English**
The `<Input type="date">` control and the `todayISO()` helper were built for `AddTransactionForm`. Using them here required no new infrastructure — just adding the same field to a different form. This is what "well-factored primitives" means in practice: when a new requirement appears, the pieces slot in. The `Input` component accepts `type="date"` (because it forwards all `InputHTMLAttributes`), `draft.date` is already a `YYYY-MM-DD` string (the format `<input type="date">` expects), and `max={todayISO()}` prevents future dates. Nothing new was needed.

**Technically Speaking**
`Input` is typed as `React.InputHTMLAttributes<HTMLInputElement>`, which includes `type`, `value`, `onChange`, `max`, and every other valid input attribute. Passing `type="date"` is no different from `type="text"` at the TypeScript layer — the component accepts it and forwards it to the underlying `<input>`. The `draft` object is typed as `Transaction`, so `draft.date: string` already holds a `YYYY-MM-DD` value compatible with the date input's `value` format.

**Vue / Laravel Analogy**
This is the payoff of building reusable primitives. In Vue, a component with `v-bind="$attrs"` (attribute forwarding) can accept `type="date"` without the component knowing about it. In Laravel Blade, a reusable `@component('forms.input')` that passes `$attributes->merge(...)` to the underlying element behaves identically. The investment in `forwardRef` + `InputHTMLAttributes` pays off every time a new field type is needed without touching the `Input` component.

**Common Mistakes**
1. **Creating a separate `DateInput` component instead of reusing `Input`.** If `Input` accepts all HTML input attributes (which it does via `InputHTMLAttributes`), there's no reason for a dedicated date component — the behavior is entirely controlled by `type="date"` and `max`.
2. **Using `new Date(draft.date).toISOString().split('T')[0]` to display the value.** `draft.date` is already `YYYY-MM-DD` — the exact format `<input type="date">` requires as its `value`. Passing it directly is correct; re-parsing it would introduce the UTC timezone bug.

---

### The duplication vs extraction decision

**Plain English**
`todayISO()` appears in both `AddTransactionForm` and `TransactionRow`. The rule of thumb is: three consumers justify extraction; two don't. At two, the function is short enough (4 lines) that duplicating it has lower cost than introducing a shared utility file, deciding where it lives, naming the file, and updating imports across two components. If a third consumer appears, extract it then. This isn't "avoiding work" — it's avoiding premature structure that would need to be undone or reorganized as the codebase grows.

**Technically Speaking**
The cost of a shared utility is not just the file — it's the coupling it introduces. Two components that independently define `todayISO` can each be moved, deleted, or refactored without affecting the other. A shared utility creates a dependency: changing the utility affects all consumers simultaneously. For a stable, low-complexity function like `todayISO`, the independence is worth more than the DRY savings until the number of consumers makes the coupling clearly worthwhile.

**Vue / Laravel Analogy**
In Laravel, a helper function used in two Blade templates might live inline in each template rather than in a `helpers.php` file. The Laravel community has debated this for years — the answer is always the same: extract when the function changes, when there are three or more consumers, or when the logic is complex enough to warrant isolated testing. A 4-line date formatter doesn't meet any of those thresholds at two consumers.

**Common Mistakes**
1. **Extracting on first duplication.** Premature extraction creates shared modules that end up with a single function and only ever have two consumers. The overhead of the abstraction exceeds its value.
2. **Not extracting after the threshold is crossed.** If `todayISO` appears in a third file, it should move to `src/utils/date.ts`. Not doing so then is the opposite mistake — duplication that should have been consolidated.

---

## Code Walkthrough

### The new field in the edit form
```tsx
<div className="grid grid-cols-2 gap-2">
  <Input
    aria-label="Date"
    type="date"
    value={draft.date}
    max={todayISO()}
    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
    className="py-1.5"
  />
  <Input
    aria-label="Amount"
    ...
  />
  <Input
    aria-label="Category"
    ...
  />
  <select ...>
```
The date field is the first item in the 2-column grid — creating a 2×2 layout: date + amount on the first row, category + type on the second. `value={draft.date}` works immediately because `Transaction.date` is already `YYYY-MM-DD`. `e.target.value` from a date input is always `YYYY-MM-DD`, so `setDraft({ ...draft, date: e.target.value })` is correct with no parsing.

### The todayISO helper
```ts
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```
Duplicated from `AddTransactionForm` — same 4 lines, module-level, not exported. Using local date parts (not `toISOString()`) avoids the UTC timezone issue documented in the DatePicker doc. Called inline as `max={todayISO()}` (not as a lazy initializer) because `max` needs the current date at render time.

### The isValid check isn't changed
```ts
const trimmed = draft.description.trim();
if (!trimmed || draft.amount <= 0) return;
```
`draft.date` is not validated in `handleSave` — the browser's native `max` constraint prevents future dates, and the field always has a value from `draft.date` (initialized from the transaction's existing date). An empty date string is only possible if the user manually clears it, which a `<input type="date">` with an existing value doesn't allow in normal interaction.

---

## What to Remember

- `draft.date` is already `YYYY-MM-DD` — pass it directly as `value` to `<Input type="date">`, no conversion needed.
- `<input type="date">` always yields `YYYY-MM-DD` in `onChange` — `e.target.value` is safe to store directly in a `Transaction`.
- Duplicate short helpers at two consumers; extract to a shared utility at three.
- The `Input` component's `InputHTMLAttributes` type means `type="date"` works with no changes to `Input` itself.
- The 2×2 grid layout (date + amount, category + type) completes all four editable metadata fields for a transaction.
