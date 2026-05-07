# useNavigate (navigate-after-create)

## What Was Built
`AddAccountModal` now calls `useNavigate` to programmatically redirect to the new account's detail page immediately after the API confirms its creation.

## File Location
`src/components/AddAccountModal.tsx`

---

## Concepts Introduced

### useNavigate — programmatic navigation

**Plain English**
All routing so far has been declarative: `<Link to="/accounts/1">` renders a link and navigation happens when the user clicks it. But sometimes you need to navigate *because something finished* — an API call succeeded, a form was submitted, a timeout elapsed. You can't put a `<Link>` inside a `try/catch`. `useNavigate` gives you a plain function, `navigate`, that you call whenever you're ready to move — from an event handler, an async callback, anywhere. It's navigation on your schedule, not the user's click.

**Technically Speaking**
`useNavigate()` returns a `NavigateFunction` typed as `(to: string | number, options?: NavigateOptions) => void`. Calling `navigate('/accounts/1')` pushes a new entry onto the browser's history stack — the same operation a `<Link>` click performs. Passing a number like `navigate(-1)` moves backwards in history (equivalent to `window.history.back()`). The `options` object accepts `{ replace: true }` to replace the current history entry instead of pushing a new one — useful after a login redirect where you don't want the user to navigate back to the login form. `useNavigate` must be called inside a component that is a descendant of `<BrowserRouter>`, since it reads from React Router's context.

**Vue / Laravel Analogy**
This is `useRouter().push()` in Vue 3:
```ts
// Vue 3
const router = useRouter()
router.push(`/accounts/${account.id}`)

// React
const navigate = useNavigate()
navigate(`/accounts/${account.id}`)
```
The mental model is identical — a function you call imperatively to change the route. In Laravel, the nearest equivalent is `redirect()->route('accounts.show', $account)` in a controller — navigation triggered by code completing, not a user clicking a link.

**Common Mistakes**
1. **Navigating before `onClose()`.** If you call `navigate` before unmounting the modal, React tries to render the new page while the modal's cleanup (removing event listeners, etc.) still hasn't run. Always close/unmount first, then navigate.
2. **Using `useNavigate` outside a Router context.** Calling it in a component that isn't inside `<BrowserRouter>` throws at runtime. In tests, wrap the component in a `<MemoryRouter>`.
3. **Using `navigate` when a `<Link>` would do.** `<Link>` is accessible by default (keyboard navigable, right-clickable, shows URL on hover). Only reach for `useNavigate` when navigation can't happen at click time — async callbacks, timers, conditional logic.

---

### Capturing the thunk return value with .unwrap()

**Plain English**
When you `dispatch` an async thunk, you get back a Promise-like object. Calling `.unwrap()` on it turns it into a real Promise that resolves with the data the thunk returned on success, or throws the error on failure. Before this feature, we discarded that return value — `await dispatch(createAccountThunk(...)).unwrap()` and moved on. Now we capture it: `const account = await ...unwrap()`. The `account` variable is the `Account` the API sent back, complete with its `id`.

**Technically Speaking**
`dispatch(createAsyncThunk(...))` returns a `AsyncThunkAction` — a special object with a `.unwrap()` method. `.unwrap()` returns a Promise that resolves to the thunk's fulfilled payload (`Account`) or rejects with the serialized error. The payload type is inferred from the first type parameter of `createAsyncThunk<Account, Account>` — TypeScript knows `.unwrap()` resolves to `Account` without any cast. This is why we can immediately access `account.id` — the type is fully known at the call site.

**Vue / Laravel Analogy**
In a Vuex action that calls an API and returns data:
```ts
// Vue 3 / Vuex
const account = await store.dispatch('accounts/create', payload)
navigate(`/accounts/${account.id}`)
```
In Laravel, a controller method returns a response and the calling code (e.g. a test or a redirect) uses the returned model directly:
```php
$account = Account::create($data);
return redirect()->route('accounts.show', $account);
```
Same pattern: create something, get it back, use its ID to go somewhere.

**Common Mistakes**
1. **Forgetting `.unwrap()` and getting an action object instead of data.** `const result = await dispatch(createAccountThunk(...))` — `result` here is the Redux action object (`{ type, payload, meta }`), not the `Account`. You need `.unwrap()` to extract the payload.
2. **Not handling the rejection.** `.unwrap()` throws on failure. Without a `try/catch`, an API error becomes an unhandled Promise rejection. The existing `try/catch` in `handleSubmit` already covers this.

---

## Code Walkthrough

### Adding useNavigate
```ts
import { useNavigate } from 'react-router-dom';

function AddAccountModal({ onClose }: AddAccountModalProps) {
  const navigate = useNavigate();
```
`useNavigate` is imported from `react-router-dom` alongside `useParams`, `useSearchParams`, and `Link` — it's part of the same Router toolkit. `navigate` is just a function; calling it changes the URL.

### Capturing the created account
```ts
const account = await dispatch(
  createAccountThunk({
    id: crypto.randomUUID(),
    name: name.trim(),
    type,
    balance: 0,
  }),
).unwrap();
```
Before this change, the return value was discarded. Now it's captured as `account`. TypeScript infers the type as `Account` from the thunk's type signature — `createAsyncThunk<Account, Account>` — so `account.id` is typed and safe to use immediately.

### Navigate after close
```ts
onClose();
navigate(`/accounts/${account.id}`);
```
Two lines, order matters. `onClose()` unmounts the modal first — this removes the backdrop, clears local state, and unregisters the `Escape` key listener. Then `navigate` pushes the new route. If these were reversed, the modal would still be mounted during the route transition, causing a brief visual glitch and a stale event listener cleanup on an unmounted component.

The template literal `` `/accounts/${account.id}` `` matches the route defined in `App.tsx`: `<Route path="/accounts/:id" element={<AccountDetail />} />`. React Router reads `:id` from the URL and `useParams` surfaces it inside `AccountDetail`.

---

## What to Remember

- `useNavigate()` returns a `navigate` function — call it from anywhere (async callbacks, event handlers, effects) to change the route imperatively.
- `.unwrap()` turns a dispatched thunk into a real Promise that resolves with the payload — capture the return value when you need the created/updated data.
- Always `onClose()` before `navigate()` — unmount first, then change the route.
- Use `<Link>` for navigation the user initiates with a click; use `useNavigate` only when navigation is triggered by code completing.
- `navigate('/path')` pushes to history; `navigate('/path', { replace: true })` replaces — use `replace` when you don't want the user to be able to navigate back (e.g. post-login redirects).
