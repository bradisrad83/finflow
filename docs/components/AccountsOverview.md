# AccountsOverview

## What Was Built

Two components work together to render the accounts dashboard:

- **`AccountCard`** — a single card. Takes one account and displays its name, type badge, and formatted balance. It doesn't know or care where the account came from.
- **`AccountsOverview`** — the page section. Pulls all accounts from Redux, computes the total balance, and renders a responsive grid of `AccountCard`s.

Supporting files created alongside them:

| File | Purpose |
|------|---------|
| `src/types/index.ts` | Defines what an `Account` and `Transaction` object look like |
| `src/store/accountsSlice.ts` | The accounts "department" of the Redux store |
| `src/store/transactionsSlice.ts` | The transactions "department" (empty for now) |
| `src/store/index.ts` | Assembles all departments into one store, exports types |

---

## Concept 1: JSX

### Plain English
JSX is the HTML-looking code you write inside a React component's `return`. You write what looks like HTML, and React turns it into the actual page. It's not a template file — it sits right inside your JavaScript/TypeScript function.

```tsx
function AccountsOverview() {
  return (
    <section>
      <h2>Accounts</h2>
    </section>
  );
}
```

That `<section>` and `<h2>` aren't real HTML yet. They're instructions. React reads them and builds the real DOM.

There are a few syntax rules that catch people out:
- Use `className` instead of `class` (because `class` is a reserved word in JavaScript)
- Wrap multi-line JSX in parentheses after `return`
- Self-closing tags need a slash: `<img />` not `<img>`
- Dynamic values go in curly braces: `{account.name}` not `{{account.name}}`

### Technically Speaking
JSX is **syntactic sugar** — it's not a real language feature, it's a transformation. The TypeScript/Babel compiler converts JSX into plain `React.createElement()` calls before the browser ever sees it.

```tsx
// What you write:
<h2 className="text-xl">Accounts</h2>

// What the compiler produces:
React.createElement('h2', { className: 'text-xl' }, 'Accounts')
```

`React.createElement(type, props, ...children)` returns a plain JavaScript object called a **React element** — a lightweight description of what should be on screen. This is the **virtual DOM**: a tree of these plain objects that React maintains in memory, separate from the real browser DOM.

When state changes, React re-runs your component function, produces a new virtual DOM tree, **diffs** it against the previous one (reconciliation), and only updates the real DOM nodes that actually changed. This is why React can be efficient even though components re-run on every state change.

**Haskell connection:** A React element is essentially an **algebraic data type** — a pure description of UI with no side effects. The actual DOM mutation is a side effect that React defers and controls. This separation of "describe what you want" from "perform the effect" is a core functional programming idea.

---

## Concept 2: Functional Components

### Plain English
A React component is just a function that returns JSX. That's it. You call it like any other function, it returns a description of what to show, and React handles the rest.

```tsx
function AccountCard({ account }: AccountCardProps) {
  return <div>{account.name}</div>;
}
```

You don't extend a class, you don't call `this.setState`, you don't use lifecycle method names. Just a function that takes some input and returns some UI.

### Technically Speaking
Functional components are **pure functions** from props to UI — given the same props, they should always return the same JSX. This is the ideal, and it's what React's mental model is built on.

React's rendering model works like this:
```
UI = f(state)
```
Your component function `f` takes state/props as input and produces a UI description as output. Side effects (data fetching, timers, DOM manipulation) are handled separately via hooks.

This maps directly to **referential transparency** in Haskell — a function that always returns the same output for the same input, with no hidden state or side effects. React is pushing JavaScript toward this style, which is exactly why learning React well is a good on-ramp to functional programming.

The older class-based component style (`class MyComponent extends React.Component`) still exists but is rarely used in modern React. Functional components + hooks replaced it entirely.

---

## Concept 3: Props

### Plain English
Props are how a parent component sends data to a child component. The parent decides what to pass; the child just receives it and uses it. The child never modifies its own props.

Think of it like a function argument — you pass a value in, the function uses it, it doesn't change the original.

```tsx
// Parent passes the account:
<AccountCard account={account} />

// Child receives it:
function AccountCard({ account }: AccountCardProps) {
  return <p>{account.name}</p>;
}
```

**Vue analogy:** Identical to `defineProps` in Vue's Composition API. Same rule: props flow one direction, parent to child.

### Technically Speaking
Props are passed as a single **plain object** to the component function. The `{ account }` syntax in the function signature is JavaScript **destructuring** — pulling `account` out of that object so you don't have to write `props.account` everywhere.

```tsx
// These are identical:
function AccountCard(props: AccountCardProps) {
  return <p>{props.account.name}</p>;
}

function AccountCard({ account }: AccountCardProps) {
  return <p>{account.name}</p>;
}
```

The TypeScript interface `AccountCardProps` is a **type contract** — it says "this component requires an object with an `account` key of type `Account`". TypeScript enforces this at compile time. If you forget to pass `account`, or pass the wrong shape, the build fails before you ever run the code.

Props being **read-only** isn't enforced by the runtime (you could technically mutate them) but mutating them would cause bugs because React wouldn't know to re-render. By convention — and increasingly by TypeScript `readonly` — props are treated as immutable.

**Haskell connection:** This is **function application**. A component is a function; props are its arguments; JSX output is its return value. Haskell is strict about immutability in a way JavaScript isn't, but the principle is the same.

---

## Concept 4: `useSelector` — Reading from Redux

### Plain English
`useSelector` is how a component reads data out of the Redux store. You tell it *which part* of the store you want, and it gives you that data. If that data ever changes, React automatically re-renders your component with the new value.

```tsx
const accounts = useSelector((state: RootState) => state.accounts.accounts);
```

You don't have to manually subscribe to changes, unsubscribe when the component unmounts, or trigger re-renders yourself. `useSelector` handles all of that.

**Vue/Pinia analogy:**
```ts
// Pinia
const store = useAccountsStore();
const accounts = computed(() => store.accounts);

// Redux
const accounts = useSelector((state: RootState) => state.accounts.accounts);
```
Both are reactive reads that automatically update the UI when the data changes.

### Technically Speaking
`useSelector` is a **hook** — a special function that starts with `use` and can only be called inside a functional component (or another hook). Hooks are how React lets components tap into framework features like state, side effects, and subscriptions.

Internally, `useSelector`:
1. Subscribes to the Redux store via the `Provider`'s React Context
2. Runs your selector function against the current store state
3. Stores the result and compares it on every store update using **referential equality** (`===`)
4. If the result changed, it triggers a re-render of your component

The function you pass — `(state: RootState) => state.accounts.accounts` — is called a **selector**. It's a pure function that extracts a slice of state. Keeping selectors narrow matters for performance: if you select the entire state object, your component re-renders on *every* store change. If you select only `state.accounts.accounts`, it only re-renders when accounts change.

The `RootState` type annotation on `state` is what gives TypeScript full knowledge of the store shape:
```ts
export type RootState = ReturnType<typeof store.getState>;
```
`ReturnType<>` is a TypeScript **utility type** — it extracts the return type of a function. `typeof store.getState` gives you the type of the `getState` function, and `ReturnType<>` unwraps it to give you the shape of the state object. This way the type always stays in sync with your actual reducers automatically.

**Haskell connection:** A selector is a **projection function** — it takes a large data structure and returns a smaller piece of it. In Haskell this is a common pattern with record accessors. The idea of "give me just what I need from this structure" is central to functional data transformation.

---

## Concept 5: Rendering Lists with `.map()`

### Plain English
To display a list of items in React, you use JavaScript's `.map()` array method inside JSX. For each item in the array, you return a piece of JSX. React collects all those returned elements and renders them.

```tsx
{accounts.map((account) => (
  <AccountCard key={account.id} account={account} />
))}
```

Every item in the list needs a `key` prop — a unique identifier React uses to track which item is which. Always use a stable ID from your data (like `account.id`), never the array index.

**Vue analogy:** The same as `v-for="account in accounts" :key="account.id"`.

### Technically Speaking
There's no special list directive in React. `.map()` is a standard JavaScript array method that transforms each element — here it transforms an `Account` object into a `<AccountCard>` React element. The JSX engine renders whatever array of elements you return.

The `key` prop is not available to your component — it's a **React internal hint**. During reconciliation, React uses keys to match elements in the new virtual DOM tree against elements in the previous tree. Without keys, React falls back to positional matching (index 0 = same element, index 1 = same element), which breaks when items are reordered or inserted in the middle. With stable ID keys, React can detect moves, insertions, and deletions correctly.

Using array index as a key only works correctly for static, never-reordered lists. For anything dynamic, always use a real ID.

---

## Concept 6: The Redux Store and Slices

### Plain English
The Redux store is a single JavaScript object that holds all your application's data — accounts, transactions, UI state, etc. Think of it like a central warehouse. Slices are the different departments of that warehouse: the accounts department, the transactions department.

A slice defines:
1. What data it holds (its initial state)
2. What actions can change that data (reducers)

```ts
const accountsSlice = createSlice({
  name: 'accounts',
  initialState,       // starting data
  reducers: {
    addAccount: (state, action) => { ... }  // how to handle changes
  },
});
```

### Technically Speaking
Redux enforces the **Flux architecture pattern**: state is stored in a single immutable tree, and the only way to change it is by dispatching an **action** — a plain object describing what happened — through a **reducer** — a pure function that takes `(currentState, action)` and returns `newState`.

```
newState = reducer(currentState, action)
```

This is a direct application of **the reducer pattern**, which is itself a specialization of **fold/reduce** from functional programming. In Haskell:
```haskell
foldl :: (b -> a -> b) -> b -> [a] -> b
```
A Redux reducer is `(state -> action -> state)` — the same shape. You accumulate state over a stream of actions instead of a stream of list elements.

Redux Toolkit's `createSlice` uses **Immer** under the hood. Immer lets you write code that looks like mutation:
```ts
addAccount: (state, action) => {
  state.accounts.push(action.payload);  // looks like mutation
}
```
But produces a new immutable state object. Immer wraps your state in a **Proxy** — a JavaScript object that intercepts property assignments and instead records them as a set of "patches", then applies those patches to produce a new object. Your original state is never actually modified.

This matters because Redux's change-detection relies on **referential equality**. If you mutated the original object, `oldState === newState` would be `true` even though data changed, and nothing would re-render.

**Haskell connection:** This is the **State monad** pattern — threading state through a computation without mutating it. The reducer is a pure transformation; Immer just makes writing it in JavaScript less painful.

---

## Concept 7: The Redux `Provider`

### Plain English
Before any component can use `useSelector`, the store has to be made available to the whole app. You do this once in `App.tsx` by wrapping everything in `<Provider store={store}>`. After that, any component anywhere in the tree can read from the store without you passing it down manually through props.

```tsx
function App() {
  return (
    <Provider store={store}>
      <AccountsOverview />
    </Provider>
  );
}
```

**Vue analogy:** This is the equivalent of `app.use(createPinia())` — a one-time setup that makes the store globally accessible.

### Technically Speaking
`Provider` uses **React Context** — a built-in mechanism for making a value available to any component in the tree without threading it through props at every level (called "prop drilling"). The store is placed into context by `Provider`, and `useSelector` reads it back out from context wherever it's called.

Context uses the **nearest matching ancestor** rule — if you had multiple `Provider`s nested (unusual but valid), the inner one would shadow the outer one for components inside it.

The store itself is a singleton — one object for the lifetime of the app. In server-side rendering (SSR), you create a new store per request instead, which is why `configureStore` is a factory function rather than a module-level object you import directly. (Not relevant to FinFlow yet, but worth knowing why it's structured that way.)

---

## Code Walkthrough

### `src/store/index.ts`

```ts
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

These two exported types are the **connective tissue** between your store and your components. `RootState` tells TypeScript what the store looks like so `useSelector` gets full autocomplete. `AppDispatch` tells TypeScript what actions are valid when you dispatch — you'll use this once we add write operations.

### `src/components/AccountsOverview.tsx`

```tsx
const accounts = useSelector((state: RootState) => state.accounts.accounts);

const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
```

`accounts` is a plain JavaScript array. You own it — apply any array methods you want. The `reduce` sums all balances: starting from `0`, it walks every account and adds its balance to a running total.

```tsx
{accounts.map((account) => (
  <AccountCard key={account.id} account={account} />
))}
```

Each `Account` from the array becomes one `<AccountCard>`. The `key` is internal to React; `account` is the prop the child receives.

### `src/components/AccountCard.tsx`

```tsx
const formattedBalance = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(account.balance);
```

`Intl.NumberFormat` is a built-in browser API for locale-aware formatting. It handles `$`, commas, and two decimal places automatically. Always prefer this over manual string formatting for numbers — it respects locale and handles edge cases correctly.

```tsx
<span className={`... ${account.type === 'checking' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-600'}`}>
```

Conditional classes use a plain JavaScript ternary inside a template literal. There's no Vue-style `:class` binding. For complex conditional class logic, the `clsx` library is the standard tool.

---

## What to Remember

- **JSX is a compiler transform, not real HTML.** It becomes `React.createElement()` calls that produce virtual DOM objects.
- **Components are functions.** Input: props. Output: JSX. Same input should always produce same output.
- **Props are immutable from the child's perspective.** Pass data down; use callbacks (covered later) to communicate back up.
- **`useSelector` subscribes your component to the store.** Keep selectors narrow — select only what the component needs, or it re-renders too often.
- **`key` on list items is for React's reconciler, not for your code.** Use stable IDs, never index.
- **Redux reducers are pure functions:** `(state, action) => newState`. Immer makes writing them look like mutation but they're not.
- **`RootState` keeps your types in sync automatically.** Never manually maintain a state type — let `ReturnType<>` derive it.
- **The `Provider` is a one-time setup.** It uses React Context to avoid prop drilling the store through every component layer.
- **Functional React is functional programming.** Pure functions, immutable data, and separating descriptions from effects — these ideas point directly toward Haskell.
