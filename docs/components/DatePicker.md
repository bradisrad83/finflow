# Transaction Date Picker

## What Was Built
A date field added to `AddTransactionForm` using `<input type="date">` so users can choose the transaction date rather than it always defaulting to today, with a `max` attribute preventing future dates.

## File Location
`src/components/AddTransactionForm.tsx`

---

## Concepts Introduced

### input type="date" — browser-native date picker with ISO value format

**Plain English**
`<input type="date">` gives you a date picker for free — no library, no custom calendar component. The browser renders it styled for the user's OS (a calendar popup on Chrome, a spinner on Safari, etc.) and in the user's locale format for display. But here's what matters: the *value* you receive in `onChange` and the *value* you set on the input are always `YYYY-MM-DD`, regardless of what the user sees. Whether the display shows `05/07/2026` or `07.05.2026` or `2026年5月7日`, your JavaScript always gets `"2026-05-07"`. This is the ISO 8601 date format — the same format already stored in the database and used throughout the app.

**Technically Speaking**
`<input type="date">` has a `valueAsDate` property (a `Date` object) and a `value` property (always a `YYYY-MM-DD` string). Setting `value` on the element accepts only `YYYY-MM-DD` — other formats are silently rejected and the input clears. The `max` attribute accepts `YYYY-MM-DD` and the browser enforces it natively: dates after `max` are visually disabled in the picker and the input rejects them via built-in constraint validation (`input.validity.rangeOverflow`). TypeScript types `e.target.value` as `string` for all input types — the `YYYY-MM-DD` format is a runtime guarantee from the browser spec, not a compile-time type.

**Vue / Laravel Analogy**
In Vue 3:
```html
<input type="date" v-model="date" :max="todayISO()" />
```
`v-model` on a date input binds to the same `YYYY-MM-DD` string as React's controlled `value` + `onChange`. The ISO format contract is identical — the browser spec, not Vue or React, guarantees it. In Laravel, a date field in a form request validated with `'date_format:Y-m-d'` enforces the same ISO format server-side.

**Common Mistakes**
1. **Expecting `e.target.value` to match the user's locale format.** If the user's browser displays `May 7, 2026`, `e.target.value` is still `"2026-05-07"`. You never need to parse or reformat the value — it arrives in ISO format.
2. **Setting `value` to a formatted date string.** `value="May 7, 2026"` or `value="07/05/2026"` silently clears the input. The only accepted format is `YYYY-MM-DD`.
3. **Using `new Date().toISOString().split('T')[0]` for today's date.** `toISOString()` returns a UTC timestamp. In negative-offset timezones (all US timezones), UTC midnight is still the previous calendar day — so after ~5–7pm on May 7, `toISOString()` returns `"2026-05-08"`, showing tomorrow as today. Use local date parts instead.

---

### useState lazy initializer — calling a function once at mount

**Plain English**
`useState('some-value')` runs every render — it just ignores the argument after the first one. But if computing the initial value is non-trivial (like computing today's date), you'd be doing that work on every render even though it's only used once. The lazy initializer form — `useState(someFunction)` (passing the function reference, not calling it) — tells React: "call this function once, at mount, and use whatever it returns as the initial value." The function is never called again.

**Technically Speaking**
`useState<S>(initialState: S | (() => S))` is overloaded to accept either a value or a zero-argument function. When React detects a function, it calls it synchronously during the initial render to produce the initial state. On every subsequent render, `useState` ignores the argument entirely — the hook already has state in its fiber slot. The distinction between `useState(fn)` (lazy) and `useState(fn())` (eager) is: eager calls `fn` on every render pass (wasted work), lazy calls `fn` once. For `todayISO`, the difference is negligible — but the pattern matters for expensive computations like parsing JSON or constructing large arrays.

**Vue / Laravel Analogy**
In Vue 3, all `ref()` and `reactive()` initializations run once when the composable/setup function runs — there's no equivalent "lazy initializer" concept because Vue's reactivity system doesn't re-run setup on renders the way React's function components re-run on every render. In Laravel, there's no direct analogy — controller constructors run once per request, analogous to component mount, but there's no "per-render" cost to avoid.

**Common Mistakes**
1. **Writing `useState(todayISO())` instead of `useState(todayISO)`.** The parentheses call the function immediately on every render. Without parentheses, React calls it once. For this specific case, the difference is invisible, but for expensive computations it matters.
2. **Using the lazy form for values that should update.** `useState(todayISO)` sets the date once at mount — if the user keeps the page open past midnight, the initial state is still yesterday's date. That's correct behavior for a form default (the user can change it), but if you needed a live clock, `useState` isn't the right tool at all.

---

### max attribute — browser-enforced date constraint

**Plain English**
`<input type="date" max="2026-05-07">` tells the browser: don't let the user pick any date after May 7, 2026. The browser enforces this natively — future dates are greyed out in the picker, the user can't type them in, and the input's built-in validation fails if somehow an invalid value slips through. No JavaScript validation, no `if (date > today) return`, no error state to manage. The constraint is declared, not implemented.

**Technically Speaking**
`max` accepts a `YYYY-MM-DD` string for `type="date"` inputs. When the user's selection exceeds `max`, `input.validity.rangeOverflow` is `true` and `input.checkValidity()` returns `false`. In a `<form>`, this prevents submission via the native constraint validation API. In our case, the `isValid` check (`date !== ''`) combined with `max={todayISO()}` is sufficient — the browser won't let an out-of-range value be entered, so we don't need an explicit future-date check in JavaScript. Calling `todayISO()` inline (with parentheses) on each render is correct here — unlike the lazy initializer, we want the `max` to reflect the current date on every render in case the component stays mounted past midnight.

**Vue / Laravel Analogy**
In Vue: `:max="todayISO()"` — identical. In an HTML form submitted to Laravel, `max` is enforced client-side; server-side you'd add `'date' => 'before_or_equal:today'` to the form request rules. The attribute and the validation rule express the same constraint at different layers.

**Common Mistakes**
1. **Forgetting `max` and relying on form validation instead.** Without `max`, users can type or paste future dates. The native constraint is cleaner than a custom error message.
2. **Using `max={new Date().toISOString().split('T')[0]}` instead of the local-date version.** Same UTC timezone bug as with the initial value — in US timezones, after ~7pm, `toISOString()` returns tomorrow's date, which would incorrectly block today from being selected.

---

## Code Walkthrough

### The todayISO helper
```ts
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```
Module-level so it's not recreated on renders and can be passed as a reference to `useState`. Uses local date parts (`.getFullYear()`, `.getMonth()`, `.getDate()`) rather than `toISOString()` to avoid the UTC-vs-local date discrepancy in negative-offset timezones. `.padStart(2, '0')` ensures single-digit months and days are zero-padded: `5` → `"05"`.

### The lazy initializer
```ts
const [date, setDate] = useState(todayISO);
```
`todayISO` (no parentheses) — passes the function reference. React calls it once at mount. Contrast with the `max` attribute below, which calls `todayISO()` (with parentheses) on every render so `max` is always current.

### The date input
```tsx
<Input
  id={dateId}
  type="date"
  value={date}
  max={todayISO()}
  onChange={(e) => setDate(e.target.value)}
/>
```
`type="date"` activates the browser's native date picker. `value={date}` makes it controlled. `max={todayISO()}` is called (not referenced) because the max should reflect today's date at render time. `e.target.value` is always `YYYY-MM-DD` — no parsing needed, ready to submit to the API.

### Reset on submit
```ts
setDate(todayISO());
```
Called with parentheses — we need the value immediately, not as a function reference. Resets to today after submission so the next transaction defaults to today rather than whatever the user last picked.

---

## What to Remember

- `<input type="date">` always yields `YYYY-MM-DD` in `e.target.value` — no parsing needed, matches the API and database format exactly.
- Use local date parts (`getFullYear`, `getMonth`, `getDate`) for today's date, not `toISOString()` — the latter is UTC and shows the wrong date in US timezones after ~7pm.
- `useState(fn)` (no parentheses) is the lazy initializer — React calls `fn` once at mount. `useState(fn())` calls `fn` on every render.
- `max={todayISO()}` (with parentheses) is correct for the attribute — it should reflect the current date at each render, not be frozen at mount time.
- `max` is browser-enforced — future dates are disabled in the picker without any JavaScript validation logic.
