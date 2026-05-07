# extraReducers — Cross-Slice Reactivity

## What Was Built
Two small fixes: (1) the Add Transaction button now disables itself until every required field is valid, and (2) the accounts slice now reacts to `addTransaction` via `extraReducers`, automatically adjusting the matching account's balance by the transaction's signed amount.

## File Location
`src/store/accountsSlice.ts`, `src/components/AddTransactionForm.tsx`

---

## Concepts Introduced

### extraReducers (Cross-Slice Reactivity)

**Plain English**
A slice's `reducers` field defines actions the slice *owns*. `extraReducers` is a separate field for reactions to actions the slice *doesn't own* — actions from other slices, async thunks, or anywhere else in the app. It's how one slice can listen to another slice's actions without the two slices having to know about each other directly. The producer (the slice that defined the action) just dispatches; any number of consumers can react.

**Technically Speaking**
`createSlice({ ..., extraReducers: (builder) => builder.addCase(actionCreator, reducerFn) })` registers additional cases on the slice's reducer function. When an action is dispatched, Redux runs *every* reducer in the store with that action. Most reducers ignore actions they don't recognize, but a slice with `extraReducers` opts into handling them.

The `builder` API gives you `.addCase(actionCreator, fn)` for exact matches, `.addMatcher(predicate, fn)` for pattern matches (e.g., "any pending thunk"), and `.addDefaultCase(fn)` for fallbacks. The action creator is passed by *reference*, not by string — RTK reads its `.type` property to know which dispatched action to match. This is the canonical RTK pattern for cross-slice coordination because it's explicit, type-safe, and lives next to the slice's own logic.

**Vue / Laravel Analogy**
Pinia has `$onAction` and `$subscribe` for after-the-fact subscriptions to a store's actions. Vuex has `store.subscribe`. Both are similar in spirit but registered imperatively *after* the store is built. RTK's `extraReducers` is declarative and lives inside the slice definition itself — closer to a Laravel model observer (`Account::observe(BalanceObserver::class)`) where the model declaratively listens to events on another model.

**Common Mistakes**
- **Importing the slice's *whole reducer* instead of just the action creator.** You need the action creator (`addTransaction`), not the slice's exported `default` reducer. Importing the reducer is fine and won't cause issues, just unrelated.
- **Trying to dispatch from inside `extraReducers`.** Reducers must be pure synchronous transformations of state. Dispatching another action inside one is a Redux antipattern (and not even possible — there's no `dispatch` available there). If you need to dispatch in response to an action, use a thunk, listener middleware, or compose the work in the calling component.
- **Creating circular imports.** If `accountsSlice` imports from `transactionsSlice`, `transactionsSlice` must not import from `accountsSlice` — keep cross-slice dependencies one-directional.

---

### Authoritative Balance + Deltas

**Plain English**
Earlier we ripped out a bug that recomputed account balance by summing all transactions every time a card was clicked. The fix said: balance is *authoritative* — it comes from the bank API, the transactions don't define it. But that left a gap: when the user adds a transaction in-app, what should happen to the balance? The answer is: apply the transaction's signed amount as a *delta* on top of the existing balance. The seed balance stays as the baseline; new in-app activity adjusts it from there. This matches how real banks track running balances.

**Technically Speaking**
Three patterns for keeping balance and transactions in sync:

1. **Recompute from scratch (rejected).** Sum all transactions every render. Wrong because the seed balance has its own meaning that can't be derived from the visible transaction list.
2. **Apply deltas (chosen).** Treat the seed as the baseline. Each newly-added transaction adjusts balance by `±amount` based on its `type`. The store always holds the current authoritative balance.
3. **Selector-based derived view.** Keep balance only in the seed and compute display values in selectors. Cleaner but requires a "starting balance" concept and complicates the data model — overkill here.

The delta approach is implemented inside `accountsSlice`'s `extraReducers` for `addTransaction`. The form code stays oblivious — it dispatches `addTransaction` once, two slices update independently. This separation is what makes Redux scalable: the form doesn't know or care that adding a transaction also affects the balance.

**Vue / Laravel Analogy**
In Laravel this is the difference between a database column (`accounts.balance` — authoritative, written by an explicit transaction) and a query-time aggregate (`accounts.transactions().sum('amount')` — derived). Real ledger systems use both: the column is the running total, the aggregate is a verification check. We're doing the same thing client-side.

**Common Mistakes**
- **Mixing the two patterns.** Some places recompute, others apply deltas — guaranteed drift.
- **Forgetting to revert deltas on transaction deletion.** When a transaction is removed, the balance must reverse the original delta. If you didn't track the original signed amount, you can't undo it cleanly.
- **Trusting persisted balance forever.** If the bank API is the real source of truth, the persisted local balance must eventually be reconciled (replaced by the API value), not trusted indefinitely.

---

### Disabled-Button Validation

**Plain English**
For small forms with obvious required fields, the simplest validation UX is to grey out the submit button until everything's valid. No error states to manage, no "you forgot X" message after submission, no inline red text. The user gets immediate visual feedback the moment all fields are filled — and when something's missing, the button just sits there looking inert. It's appropriate when the validation rules are simple and visible; it's *not* appropriate for non-obvious rules (password complexity, email format, server-side checks) where the user needs to know *why* the form is invalid.

**Technically Speaking**
A controlled form already exposes its current values via component state. A boolean `isValid` derived from those values can drive both the `disabled` attribute on `<button>` and the early-return in the submit handler. The `disabled` attribute on a `<button type="submit">` is honored by the browser — clicking does nothing, the form doesn't submit, no event fires. This is purely client-side gating; you'd still validate server-side in any real app.

The Tailwind class swap based on `isValid` is a common React pattern: a ternary expression interpolated into a template-literal `className`. There's no two-way data flow magic — `isValid` is recomputed on every render, the className is recomputed, React diffs the attribute, the DOM updates.

**Vue / Laravel Analogy**
In Vue 3 this would be `<button :disabled="!isValid">` where `isValid` is a `computed()`. Same pattern, less verbose syntax thanks to Vue's directive system. In Laravel, server-side form validation via `FormRequest` classes is the equivalent for the backend — but the client-side disabled-button pattern is the same in any framework.

**Common Mistakes**
- **Disabling the button without also early-returning in the handler.** The `disabled` attribute prevents the click event, but if the form ever has multiple submission paths (Enter key in a field, programmatic submit), the handler should still bail on invalid input.
- **Using disabled when the user genuinely needs to know what's wrong.** For non-obvious rules, prefer inline error messages — a disabled button just looks broken.
- **Computing `isValid` inside `useEffect` and storing it in state.** Don't. It's derived state — compute it during render directly.

---

## Code Walkthrough

### `accountsSlice.ts` — extraReducers

```ts
import { addTransaction } from './transactionsSlice';

const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: { addAccount, updateBalance },
  extraReducers: (builder) => {
    builder.addCase(addTransaction, (state, action) => {
      const { accountId, amount, type } = action.payload;
      const account = state.accounts.find((a) => a.id === accountId);
      if (account) {
        account.balance += type === 'credit' ? amount : -amount;
      }
    });
  },
});
```

The import on line 1 is what makes cross-slice reactivity work: `addTransaction` is the action creator owned by `transactionsSlice`. Passing it by reference into `builder.addCase` tells RTK "when this exact action type fires, run this reducer too."

The reducer body looks like a mutation (`account.balance += ...`), but Redux Toolkit uses Immer under the hood — what looks like mutation actually produces a new immutable state. The `if (account)` guard handles the edge case where a transaction references a missing account ID; we silently skip rather than throwing.

The signed delta — `type === 'credit' ? amount : -amount` — is the entire balance-adjustment logic. The form sends a transaction; the accounts slice translates it into a balance change. Two slices, one dispatched action, two coordinated updates.

### `AddTransactionForm.tsx` — disabled-button validation

```tsx
const parsedAmount = parseFloat(amount);
const isValid =
  description.trim() !== '' &&
  category.trim() !== '' &&
  !isNaN(parsedAmount) &&
  parsedAmount > 0;

// ...

<button
  type="submit"
  disabled={!isValid}
  className={`... ${
    isValid
      ? 'bg-blue-500 text-white hover:bg-blue-600'
      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
  }`}
>
  Add
</button>
```

`isValid` is derived during render — no `useState`, no `useEffect`, no syncing. It's recomputed every time the form re-renders (which is on every keystroke, since each input is controlled). The `disabled` attribute and the className styling both read from the same boolean — single source of truth, impossible for them to drift.

`parseFloat('') === NaN`, and `NaN > 0` is `false`, so the empty-amount case is caught by the last two conditions naturally.

---

## What to Remember

- `extraReducers` lets a slice react to actions from other slices — the cleanest way to coordinate state changes across slices in RTK.
- Pass action creators by reference to `builder.addCase`, not by string. RTK reads `.type` off the action creator for matching.
- Treat balance as authoritative state with applied deltas — don't recompute from transactions, but do adjust on every new transaction event.
- For simple forms, derive `isValid` during render and bind it to both `disabled` and className. No state, no effects.
- Cross-slice imports must be one-directional. If `accountsSlice` imports from `transactionsSlice`, the reverse must not happen.
