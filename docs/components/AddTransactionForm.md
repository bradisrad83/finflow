# AddTransactionForm

## What Was Built
A controlled form component that dispatches a new transaction into the Redux store, introducing `useDispatch` as the write counterpart to `useSelector`.

## File Location
`src/components/AddTransactionForm.tsx`  
Also modified: `src/components/TransactionList.tsx`

---

## Concepts Introduced

### useDispatch

**Plain English**
So far, every component has only *read* from the Redux store. `useDispatch` is how you *write* to it. It gives you a `dispatch` function — the single channel through which all store updates flow. You call `dispatch` with an action (like `addTransaction({...})`), Redux finds the matching reducer, runs it, updates the store, and every subscribed component re-renders automatically.

**Technically Speaking**
`useDispatch` is a React-Redux hook that returns the store's `dispatch` function. An action is a plain object with a `type` string and optional `payload`. Redux Toolkit's `createSlice` generates action creators (like `addTransaction`) that produce these objects for you — `addTransaction({...})` returns `{ type: 'transactions/addTransaction', payload: {...} }`. The store passes that to the reducer, which uses Immer under the hood to produce a new immutable state from the `state.transactions.push(...)` call.

The `<AppDispatch>` generic:
```ts
const dispatch = useDispatch<AppDispatch>();
```
`AppDispatch` is exported from `store/index.ts` as `typeof store.dispatch`. Using it ensures TypeScript can type-check the actions you dispatch — without it, the type is too loose to catch errors.

**Vue / Laravel Analogy**
In Pinia (Vue 3), you call store actions directly:
```ts
const store = useTransactionsStore();
store.addTransaction(payload); // direct method call
```
In Redux, there are no direct method calls on the store. Instead, you dispatch a message and the reducer handles it:
```ts
dispatch(addTransaction(payload)); // send an action, reducer decides what happens
```
The Redux pattern is closer to Laravel's event system: `event(new TransactionAdded($data))` — you fire an event, a listener handles it. You don't call the listener directly. This separation makes every state change traceable in Redux DevTools.

**Common Mistakes**
1. Forgetting `<AppDispatch>` — `useDispatch()` without the generic types dispatch as `Dispatch<AnyAction>`, losing type safety on your action payloads.
2. Calling the action creator without dispatching it: `addTransaction({...})` alone does nothing — it just creates an action object. You must wrap it: `dispatch(addTransaction({...}))`.
3. Mutating state outside of a reducer — dispatching is the only valid write path. Setting a Redux value directly in a component has no effect and won't trigger re-renders.

---

### Controlled Inputs

**Plain English**
In React, form inputs don't manage their own value — your component does. Every input has a `value` prop tied to a `useState` variable, and an `onChange` handler that updates that variable on every keystroke. React is always in control of what's displayed. This is called a "controlled input."

**Technically Speaking**
An uncontrolled input lets the DOM own the value (accessed via `ref`). A controlled input inverts that: React's state is the single source of truth, and the input is just a rendering of that state. On every keystroke, `onChange` fires, the setter updates state, React re-renders, and the input reflects the new value. This round-trip is synchronous and imperceptible to the user, but it means React always knows the field's current value — no need to read the DOM.

```tsx
<input
  value={description}
  onChange={(e) => setDescription(e.target.value)}
/>
```

**Vue / Laravel Analogy**
This is `v-model` in Vue, but made explicit:
```html
<!-- Vue — sugar for :value + @input -->
<input v-model="description" />

<!-- React equivalent — written out manually -->
<input value={description} onChange={(e) => setDescription(e.target.value)} />
```
`v-model` is a shorthand that hides the two-way binding. React has no `v-model` — you write both halves yourself. Some React libraries (like React Hook Form) abstract this, but the underlying pattern is always the same.

**Common Mistakes**
1. Omitting `value` and only using `onChange` — the input becomes uncontrolled and React loses track of its state.
2. Forgetting `e.target.value` — `onChange` receives a `React.ChangeEvent<HTMLInputElement>`, not a bare value like Vue's `@input` emits.
3. Using `e.target.value` on a number input without parsing — it's always a string. Use `parseFloat()` before storing or dispatching.

---

### Type Casting with `as`

**Plain English**
TypeScript sometimes knows less than you do. The browser tells TypeScript that `select.value` is just a `string` — it doesn't know your options are restricted to `'credit' | 'debit'`. The `as` keyword is a way of saying "I know better than the compiler here — treat this as this specific type." Use it sparingly, and only when you're certain the runtime values match.

**Technically Speaking**
`e.target.value as 'credit' | 'debit'` is a type assertion — it doesn't emit any runtime code, it only affects the type checker. TypeScript's DOM typings declare `HTMLSelectElement.value` as `string` because a select can technically contain any option values. Since we hardcoded the options to exactly `'credit'` and `'debit'`, the assertion is safe. An alternative is to validate with a type guard: `if (v === 'credit' || v === 'debit')` — safer, but more verbose for a controlled select.

**Vue / Laravel Analogy**
There's no direct Vue analogy since Vue's template compiler infers prop types from `defineProps`. In Laravel, this is like casting a raw string from `$request->input('type')` to a typed enum — you trust the validation has already constrained the value, so you cast it rather than re-checking.

**Common Mistakes**
1. Using `as` to force incompatible types — `as` suppresses errors, it doesn't fix them. If the runtime value doesn't match, you get silent bugs.
2. Reaching for `as any` when `as` on a specific type is available — `as any` disables all checking, `as 'credit' | 'debit'` keeps the rest of the type system honest.

---

## Code Walkthrough

```ts
const dispatch = useDispatch<AppDispatch>();
```
Gets the typed dispatch function from the Redux store. `<AppDispatch>` is the key — without it TypeScript doesn't know what actions are valid.

```ts
const [description, setDescription] = useState('');
const [amount, setAmount] = useState('');
const [category, setCategory] = useState('');
const [type, setType] = useState<'credit' | 'debit'>('debit');
```
Four independent pieces of local state, one per field. `amount` is stored as a string because all input values are strings — we parse it to a float only on submit. `type` needs an explicit generic because TypeScript would infer `useState('debit')` as `useState<string>`, which is too wide for our union.

```ts
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const parsed = parseFloat(amount);
  if (!description.trim() || !category.trim() || isNaN(parsed) || parsed <= 0) return;
```
`e.preventDefault()` stops the browser from doing a full page reload on form submit — the default HTML form behavior. The guard clause returns early if any field is invalid, keeping the dispatch call clean.

```ts
dispatch(addTransaction({
  id: crypto.randomUUID(),
  accountId,
  description: description.trim(),
  amount: parsed,
  category: category.trim(),
  type,
  date: new Date().toISOString().split('T')[0],
}));
```
The dispatch call. `crypto.randomUUID()` generates a unique ID without a library. `accountId` comes from props — the form always knows which account it belongs to. `.split('T')[0]` trims the ISO timestamp down to just the date portion (`2026-04-19`).

```ts
setDescription('');
setAmount('');
setCategory('');
setType('debit');
```
Reset all fields after a successful submit. Because these are controlled inputs, clearing the state clears the visible inputs — the DOM follows React's state, not the other way around.

```tsx
onChange={(e) => setType(e.target.value as 'credit' | 'debit')}
```
The select's onChange. The cast is safe because the only `<option>` values in the JSX are `'debit'` and `'credit'`.

---

## What to Remember

- `useDispatch<AppDispatch>()` — always use the typed version, not the plain `useDispatch()`.
- Dispatching is the only valid write path to the Redux store — call `dispatch(actionCreator(payload))`, never mutate store state directly.
- Controlled inputs store their value in `useState`, not in the DOM — `value` + `onChange` are both required.
- `amount` from a number input is still a string — always `parseFloat()` before dispatching.
- `e.preventDefault()` on form submit is required in React, just as in vanilla JS — without it the page reloads.
