# Input component (forward-ref-input)

## What Was Built
A shared `<Input>` component using `React.forwardRef` that encapsulates the repeated input styling across the app and can receive a `ref` prop from parent components — enabling `useRef`-based focus control to work through the abstraction.

## File Location
`src/components/Input.tsx`

---

## Concepts Introduced

### React.forwardRef — letting custom components accept a ref

**Plain English**
In React, `ref` is special — it's not a prop. When you write `<MyInput ref={someRef} />`, React intercepts `ref` before the component function even runs, and `someRef` is silently lost. The component never sees it. This means wrapping a native `<input>` in your own component breaks all the `useRef` focus logic you've built elsewhere.

`forwardRef` is the opt-in that fixes this. It tells React: "This component knows about `ref` and will pass it somewhere." The component receives `ref` as a second argument (not in props), and you forward it to the underlying DOM element. The parent's `useRef` now reaches the real `<input>` as if there were no wrapper at all.

**Technically Speaking**
`React.forwardRef<RefType, PropsType>(renderFn)` returns a `ForwardRefExoticComponent`. The `renderFn` signature is `(props: PropsType, ref: ForwardedRef<RefType>) => ReactElement`. The two type parameters tell TypeScript:
1. What type `ref.current` will be after mounting — here `HTMLInputElement`
2. What props the component accepts — here `React.InputHTMLAttributes<HTMLInputElement>`

Without `forwardRef`, `ref` is a reserved prop name that React strips before calling the function component. TypeScript will also error if you try to pass `ref` to a custom component that doesn't use `forwardRef` — it's enforced at the type level as well as at runtime.

`Input.displayName = 'Input'` sets the component name for React DevTools. Because `forwardRef` creates an anonymous function, DevTools would otherwise show `ForwardRef` instead of `Input` in the component tree.

**Vue / Laravel Analogy**
In Vue 3, `ref` on a child component gives you the component instance (not a DOM element), and you'd need `defineExpose` to surface specific methods. For DOM element access through a custom input component, you'd typically use a template ref directly on the underlying element. Vue doesn't have the same `ref`-is-not-a-prop restriction as React — the framework handles it differently at the rendering layer.

In Laravel Blade, there's no direct equivalent — server-rendered HTML doesn't have a ref forwarding concept. The pattern is purely a client-side component system concern.

**Common Mistakes**
1. **Passing `ref` to a custom component without `forwardRef` and wondering why `.focus()` doesn't work.** React silently drops the ref — no error, no warning. The symptom is `ref.current` staying `null` after mount.
2. **Forgetting the second argument in the render function.** `forwardRef((props) => ...)` — if you only destructure `props` and omit `ref`, the ref is received but never forwarded to the DOM element. The component accepts the ref syntactically but drops it functionally.
3. **Using `forwardRef` on every component by default.** `forwardRef` is only needed when a parent needs to imperatively access a DOM node inside your component (focus, scroll, measure). If no `useRef` is ever attached to your component, the regular function component is simpler.

---

### Extending HTMLAttributes for full prop compatibility

**Plain English**
A native `<input>` accepts dozens of props: `type`, `value`, `onChange`, `placeholder`, `disabled`, `aria-label`, `list`, `min`, `step`, `autoFocus`, `onKeyDown`, and many more. Rather than manually listing every prop your `Input` component should support, you extend `React.InputHTMLAttributes<HTMLInputElement>` — the type that already lists all valid input props. Your component inherits every prop the native element supports, TypeScript validates them all, and callers can pass anything a real `<input>` would accept.

**Technically Speaking**
```ts
type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
```
`React.InputHTMLAttributes<T>` is a TypeScript interface in the React type definitions that lists every attribute valid on an `<input>` element, typed according to the DOM element type `T`. Extending it (or using it as a type alias, as here) means `InputProps` includes `value: string | number`, `onChange: React.ChangeEventHandler<HTMLInputElement>`, `className: string | undefined`, `ref` (handled separately by `forwardRef`), and ~60 other props. The `...props` spread in the render function passes all of them through to the native element without manual enumeration.

**Vue / Laravel Analogy**
In Vue 3, `v-bind="$attrs"` (or `inheritAttrs: true` default) achieves the same effect — attributes passed to a component that doesn't explicitly declare them are forwarded to the root element. React's `...props` spread is the explicit equivalent. In Laravel Blade components, `$attributes->merge(...)` serves the same purpose: forwarding undeclared attributes to the underlying HTML element.

**Common Mistakes**
1. **Manually listing individual props** (`type`, `value`, `onChange`) instead of extending `InputHTMLAttributes`. This works for the props you thought of, but breaks when a caller tries to pass `autoFocus`, `disabled`, `aria-label`, or any prop you didn't list.
2. **Forgetting to destructure `className` out before spreading.** If you spread `{...props}` without extracting `className`, the passed `className` gets set directly on the element — but so does the base class, because you also set `className={baseClass}`. The last one wins and the base class is overwritten entirely. Always merge them explicitly.

---

## Code Walkthrough

### The full component
```ts
const baseClass =
  'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/30 focus:border-blue-300 dark:focus:border-blue-400';

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={className ? `${baseClass} ${className}` : baseClass}
    {...props}
  />
));

Input.displayName = 'Input';
```
`baseClass` at module level is created once. `{ className, ...props }` destructures `className` so it can be merged with `baseClass`, while `...props` captures everything else to spread onto the element. The ternary avoids a trailing space when no `className` is passed. `ref` arrives as the second argument and is forwarded directly to `<input ref={ref}>`.

### The ref arriving as second argument
```ts
forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
```
The render function has two parameters — this is what makes `forwardRef` different from a normal component function. The first is props (destructured), the second is `ref`. You can't get `ref` from the props object; React explicitly separates it. If you try `const { className, ref, ...props } = props`, TypeScript will tell you `ref` is not in `InputHTMLAttributes`.

### Using it with a ref in AccountDetail
```tsx
<Input
  ref={searchRef}
  type="text"
  placeholder="Search description"
  value={query}
  onChange={...}
  className="flex-1 shadow-sm"
/>
```
`ref={searchRef}` works now because `Input` uses `forwardRef`. `className="flex-1 shadow-sm"` appends to `baseClass` — `flex-1` overrides `w-full` in a flex container (flex children can override their width), and `shadow-sm` adds a shadow not present in the base. All other props (`type`, `value`, `onChange`, `placeholder`) flow through `...props` to the native element.

### Why the select stays as a raw element
```tsx
<select
  className="col-span-1 w-full rounded-lg border ..."
>
```
`Input` only handles `<input>` elements — its `forwardRef<HTMLInputElement>` type enforces this. A `<select>` element has `HTMLSelectElement` as its ref type and a different attribute set (`multiple`, `size`, etc.). Creating a `Select` component with `forwardRef<HTMLSelectElement>` would follow the identical pattern, but it's out of scope for this build.

---

## What to Remember

- `ref` is not a prop in React — it's a reserved keyword stripped before the component function runs. `forwardRef` is the only way to receive it in a custom component.
- The render function in `forwardRef` takes `(props, ref)` as two separate arguments — `ref` is never in the props object.
- Always destructure `className` before spreading `...props` — otherwise the passed class silently overwrites your base class instead of merging with it.
- `Input.displayName = 'Input'` prevents React DevTools from showing your component as `ForwardRef` — always set it on `forwardRef` components.
- `React.InputHTMLAttributes<HTMLInputElement>` gives you full prop compatibility for free — use it instead of manually listing individual props.
