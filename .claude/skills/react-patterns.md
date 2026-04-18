# React Patterns Reference

Claude should consult this file when building React components in FinFlow.

---

## Component Structure

Always structure a component file in this order:
1. Imports (React, then libraries, then local)
2. TypeScript interface for props
3. Component function
4. Export

```tsx
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import type { Account } from '../types';

interface AccountCardProps {
  account: Account;
}

function AccountCard({ account }: AccountCardProps) {
  return <div>{account.name}</div>;
}

export default AccountCard;
```

Keep components focused. If a component exceeds ~80 lines or handles more than one concern, extract.

---

## useState

Use `useState` for data that is:
- Local to one component
- Not needed by siblings or parents
- UI state (open/closed, active tab, form input values)

```tsx
const [isOpen, setIsOpen] = useState(false);
const [inputValue, setInputValue] = useState('');
```

**Never** store derived values in state. If a value can be computed from existing state or props, compute it inline:

```tsx
// Wrong — redundant state
const [fullName, setFullName] = useState(`${first} ${last}`);

// Correct — derived inline
const fullName = `${first} ${last}`;
```

**Initialize with the right type.** TypeScript infers the type from the initial value. If the initial value is `null` or `undefined`, provide an explicit type:

```tsx
const [account, setAccount] = useState<Account | null>(null);
```

---

## useEffect

`useEffect` runs *after* the component renders. Use it for:
- Fetching data from an API
- Setting up subscriptions or event listeners
- Syncing with something outside React (localStorage, a timer)

**Always include a dependency array.** Omitting it means the effect runs after every render — almost always wrong.

```tsx
// Runs once on mount (empty array)
useEffect(() => {
  fetchAccounts();
}, []);

// Runs when accountId changes
useEffect(() => {
  fetchTransactionsForAccount(accountId);
}, [accountId]);
```

**Cleanup:** Return a function from `useEffect` to clean up subscriptions or timers:

```tsx
useEffect(() => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);  // runs on unmount
}, []);
```

**Common mistake:** Adding a function to the dependency array that is recreated on every render, causing an infinite loop. If the function is defined in the component, either move it outside, wrap it in `useCallback`, or include only the values it depends on directly.

---

## useSelector

Always type the state parameter with `RootState`:

```tsx
import type { RootState } from '../store';

const accounts = useSelector((state: RootState) => state.accounts.accounts);
```

**Select the minimum.** Don't select the whole slice when you only need one field:

```tsx
// Wrong — component re-renders on any accounts slice change
const accountsState = useSelector((state: RootState) => state.accounts);

// Correct — only re-renders when the array itself changes
const accounts = useSelector((state: RootState) => state.accounts.accounts);
```

**Never** call `useSelector` conditionally or inside a loop. Hooks must always be called in the same order.

---

## useDispatch

Import and type `useDispatch` with `AppDispatch`:

```tsx
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';

const dispatch = useDispatch<AppDispatch>();
```

Dispatch action creators from your slice:

```tsx
import { addAccount } from '../store/accountsSlice';

dispatch(addAccount({ id: '4', name: 'New Account', type: 'checking', balance: 0 }));
```

---

## Props and TypeScript

Define props as an interface above the component. Never use inline type literals for complex props:

```tsx
// Correct
interface AccountCardProps {
  account: Account;
  onSelect?: (id: string) => void;   // optional callback
}

// Avoid for anything beyond one field
function AccountCard({ account }: { account: Account }) { ... }
```

Optional props use `?`. Provide sensible defaults in destructuring when needed:

```tsx
function AccountCard({ account, onSelect = () => {} }: AccountCardProps) { ... }
```

---

## Rendering Lists

Always use `.map()` with a `key` prop. Always use a stable ID from the data:

```tsx
{accounts.map((account) => (
  <AccountCard key={account.id} account={account} />
))}
```

Never use array index as `key` unless the list is static and never reordered.

---

## Conditional Rendering

Use short-circuit `&&` for simple show/hide:

```tsx
{isLoading && <Spinner />}
```

Use a ternary for either/or:

```tsx
{accounts.length > 0 ? <AccountGrid /> : <EmptyState />}
```

For complex conditions, extract to a variable before the return:

```tsx
const content = isLoading ? <Spinner /> : <AccountGrid accounts={accounts} />;
return <section>{content}</section>;
```

---

## Conditional Classes (Tailwind)

Use a template literal ternary. For more than two conditions, `clsx` is worth adding:

```tsx
// Simple ternary (no library needed)
className={`px-2 py-1 rounded ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
```

If class strings grow long or have 3+ conditions, flag that `clsx` should be added.

---

## Component Responsibility

A component should do **one of** these, not both:
- **Container component:** reads from Redux, handles logic, passes data down as props
- **Presentational component:** receives props, renders UI, has no Redux awareness

`AccountsOverview` is a container. `AccountCard` is presentational. Keep this separation as the project grows.

---

## Common Beginner Mistakes

1. **Mutating state directly** — never `accounts.push(x)` in a component. Dispatch an action.
2. **Forgetting the `key` prop** on list items — or using index as key.
3. **Deriving state unnecessarily** — if you can compute it, don't store it.
4. **Calling hooks conditionally** — hooks must always run in the same order, unconditionally.
5. **Selecting too much from Redux** — causes unnecessary re-renders.
6. **Forgetting the `useEffect` cleanup** — can cause memory leaks and stale closures.
