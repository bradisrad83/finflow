# TransactionList

## What Was Built
A component that reads transactions from the Redux store, filters them by a selected account ID, and renders them in a list — introduced alongside `useState` in `AccountsOverview` to track which account is selected.

## File Location
`src/components/TransactionList.tsx`  
Also modified: `src/components/AccountsOverview.tsx`, `src/components/AccountCard.tsx`, `src/store/transactionsSlice.ts`

---

## Concepts Introduced

### useState

**Plain English**
Sometimes a component needs to remember something — like which account the user just clicked. That memory doesn't need to be shared with the rest of the app; it only matters inside this one component. `useState` gives you a private, reactive variable that lives inside the component. When it changes, React re-renders that component automatically. No Redux, no prop drilling — just local state.

**Technically Speaking**
`useState` is a React Hook. Hooks are special functions that let function components "hook into" React features that used to require class components. `useState<T>(initialValue)` returns a tuple: `[currentValue, setter]`. The setter is the *only* way to update the value — you never mutate it directly. When you call the setter, React schedules a re-render of that component (and its children). The state value is preserved between renders — React stores it against that component instance in an internal structure called the fiber tree.

```ts
const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
```

The `<string | null>` is the TypeScript generic — it tells the compiler this variable is either a string or null. `null` is the initial value, meaning nothing is selected on first render.

**Vue / Laravel Analogy**
This is `ref()` in Vue 3 Composition API:
```ts
// Vue
const selectedAccountId = ref<string | null>(null);
selectedAccountId.value = '1'; // mutate directly

// React
const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
setSelectedAccountId('1'); // always call the setter
```
The mental model is identical — a reactive variable that triggers a re-render when changed. The only difference: Vue lets you mutate `.value` directly; React requires you to call the setter function. Never mutate React state directly — it won't trigger a re-render.

**Common Mistakes**
1. Mutating state directly: `selectedAccountId = '1'` — this changes the variable but React doesn't know about it, so the UI won't update.
2. Calling `useState` conditionally or inside loops — React tracks hooks by call order, so they must always run in the same sequence every render.
3. Reaching for Redux when `useState` is enough — if only one component needs a piece of state, keep it local.

---

### Passing Functions as Props (Callback Props)

**Plain English**
In React, the parent component often needs to know when something happens inside a child. The way you do this is by passing a function *down* as a prop. The child calls it when the event occurs. The parent decides what to do with the information. This keeps the child "dumb" — it just reports events; the parent owns the state.

**Technically Speaking**
`onSelect: (id: string) => void` is a prop typed as a function. In `AccountCard`, `onClick={() => onSelect(account.id)}` creates an inline arrow function that calls `onSelect` when the div is clicked. That `onSelect` is actually `setSelectedAccountId` from the parent's `useState` call — passed down by reference. When the child calls it, it's directly calling the parent's state setter.

```tsx
// Parent passes the setter down
<AccountCard onSelect={setSelectedAccountId} />

// Child calls it on click
onClick={() => onSelect(account.id)}
```

**Vue / Laravel Analogy**
In Vue 3, you'd use `defineEmits` and `$emit`:
```ts
// Vue child
const emit = defineEmits<{ select: [id: string] }>();
emit('select', account.id);

// Vue parent
<AccountCard @select="selectedAccountId = $event" />
```
In React there's no event system — you just pass the function directly as a prop. It's more explicit: the child receives a function and calls it. Same outcome, less ceremony.

**Common Mistakes**
1. Forgetting `() =>` wrapper: `onClick={onSelect(account.id)}` — this *calls* the function immediately during render instead of when clicked.
2. Typing the prop as `Function` instead of `(id: string) => void` — too loose, loses type safety.
3. Trying to use `$emit`-style strings — React has no event bus; everything is just function props.

---

### Filtering Inside useSelector

**Plain English**
`useSelector` isn't just for reading a whole slice of state — you can also transform or filter the data right inside it. Instead of grabbing all transactions and filtering in the component body, you do it in one step. The component only ever sees the transactions it cares about.

**Technically Speaking**
The selector function passed to `useSelector` runs every time the store updates. If the return value is the same as last time (by reference equality), React skips the re-render. Since `.filter()` always creates a new array, this component re-renders on every store change — for seed data that's fine, but it's worth knowing. The fix (when needed later) is `createSelector` from Reselect, which memoizes the result.

```ts
const transactions = useSelector((state: RootState) =>
  state.transactions.transactions.filter((t) => t.accountId === accountId)
);
```

**Vue / Laravel Analogy**
This is a `computed` property in Vue:
```ts
const transactions = computed(() =>
  store.transactions.filter(t => t.accountId === selectedAccountId.value)
);
```
Both re-run automatically when their dependencies change. The difference is Vue's computed memoizes by default; React's `useSelector` with an inline filter does not.

**Common Mistakes**
1. Filtering *after* `useSelector` in a separate variable — works, but you miss the chance to keep the selector clean and composable.
2. Selecting the entire state: `useSelector((state) => state)` — subscribes to every change in the store, causing constant re-renders.
3. Assuming the filtered array is stable between renders — `.filter()` returns a new array reference every time, which matters if you pass it to memoized children.

---

### Conditional Rendering

**Plain English**
Sometimes you only want to show a component if a condition is true. In React, you do this inline in JSX using JavaScript's `&&` operator or a ternary. If the left side of `&&` is falsy, React renders nothing. If it's truthy, React renders the right side.

**Technically Speaking**
JSX is just JavaScript, so any valid JS expression works inside `{}`. `{selectedAccountId && <TransactionList accountId={selectedAccountId} />}` evaluates to either `null` (when `selectedAccountId` is `null`) or the `TransactionList` element. When React sees `null`, it renders nothing. When the value becomes a non-empty string, React mounts the component for the first time — running its initial render and `useSelector` call.

**Vue / Laravel Analogy**
This is `v-if` in Vue:
```html
<TransactionList v-if="selectedAccountId" :accountId="selectedAccountId" />
```
Identical behavior — the component is mounted/unmounted based on the condition. In React it's just a JS expression; in Vue it's a directive. Same outcome.

**Common Mistakes**
1. Using `0` as the condition: `{count && <List />}` — React renders `0` to the screen when count is 0 because 0 is falsy but still a renderable value. Use `{count > 0 && <List />}` instead.
2. Forgetting that the component *unmounts* when the condition is false — any internal state is reset.
3. Reaching for ternary when `&&` is cleaner: `{condition ? <Thing /> : null}` — just use `{condition && <Thing />}`.

---

## Code Walkthrough

```ts
const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
```
The entire selection feature lives in this one line in `AccountsOverview`. The array destructuring gives us the current value and the setter. `null` = nothing selected. TypeScript knows it can only ever be a string or null.

```tsx
<AccountCard
  key={account.id}
  account={account}
  isSelected={selectedAccountId === account.id}
  onSelect={setSelectedAccountId}
/>
```
`isSelected` is a derived boolean — React computes it fresh on every render by comparing IDs. `onSelect` is the state setter passed directly as a prop. The child doesn't know or care what `onSelect` does — it just calls it.

```tsx
{selectedAccountId && (
  <TransactionList accountId={selectedAccountId} />
)}
```
Conditional rendering. `TransactionList` doesn't exist in the DOM at all until an account is selected. When it mounts, its `useSelector` runs for the first time and fetches the filtered transactions.

```ts
const transactions = useSelector((state: RootState) =>
  state.transactions.transactions.filter((t) => t.accountId === accountId)
);
```
The selector and filter in one step. `accountId` comes from props — the component receives it and uses it to narrow the store data. This is the React/Redux equivalent of a Laravel Eloquent scope: `Transaction::where('account_id', $accountId)->get()`.

```tsx
className={`text-sm font-semibold tabular-nums ${
  transaction.type === 'credit' ? 'text-emerald-600' : 'text-gray-700'
}`}
```
Dynamic Tailwind classes using a ternary inside a template literal. Credits are green, debits are neutral gray. `tabular-nums` is a font-variant setting that keeps number columns from shifting as digit widths vary.

---

## What to Remember

- `useState` returns `[value, setter]` — always call the setter to update, never mutate directly.
- Passing a function as a prop is how React children communicate upward — it's the replacement for Vue's `$emit`.
- `useSelector` can filter and transform — you don't have to select raw slice state and post-process it separately.
- `{condition && <Component />}` mounts/unmounts the component — internal state resets when it unmounts.
- Keep state as local as possible: if only one component needs it, `useState` beats Redux every time.
