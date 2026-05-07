# Category Proportion Bars (category-bars)

## What Was Built
Thin proportion bars added to each category row in `SpendingSummary` that visually represent each category's share of total spending or income, using CSS custom properties to bridge React's dynamic data and Tailwind's static class system.

## File Location
`src/components/SpendingSummary.tsx`

---

## Concepts Introduced

### CSS custom properties as a bridge for dynamic Tailwind widths

**Plain English**
Tailwind generates its CSS at build time by scanning your source files for class names. If you write a dynamic class at runtime — like `` `w-[${pct}%]` `` — Tailwind's scanner never sees those specific values, so the rules never make it into the CSS bundle. The browser tries to apply a class that doesn't exist and nothing renders. The fix is a two-part pattern: set the dynamic value as a CSS custom property (a CSS variable) via React's `style` prop, then reference that variable in a static Tailwind class that the scanner *can* see. One part is dynamic data, one part is static styling.

**Technically Speaking**
Tailwind v3's JIT engine performs a static content scan (configured via `content` in `tailwind.config.js`) at build time. It generates CSS only for class names it literally finds in source files as complete strings. A dynamically constructed string like `` `w-[${someValue}]` `` results in different class names at runtime that were never scanned — they have no CSS rules. The correct pattern is:
```tsx
style={{ '--bar-w': `${pct}%` } as React.CSSProperties}
className="w-[var(--bar-w)]"
```
`w-[var(--bar-w)]` is a complete static string — Tailwind scans it, generates `width: var(--bar-w)` in the bundle. At runtime, the `style` prop sets `--bar-w` on the element as a CSS custom property. The browser resolves `var(--bar-w)` using the element's own custom property value. No dynamic class names needed, no CSS-in-JS library needed.

The `as React.CSSProperties` cast is required because TypeScript's `React.CSSProperties` interface only includes standard CSS property names — it doesn't have index signatures for `--` prefixed custom properties. The cast is safe: the browser fully supports custom properties in the `style` attribute.

**Vue / Laravel Analogy**
In Vue 3, you'd use a CSS binding combined with a CSS variable in a `<style scoped>` block:
```vue
<div :style="{ '--bar-w': `${pct}%` }" class="bar" />

<style scoped>
.bar { width: var(--bar-w); }
</style>
```
Vue's scoped styles are static (like Tailwind classes), and the dynamic value flows through a CSS variable. The React/Tailwind pattern is identical in concept — dynamic value in `style`, static rule in the stylesheet. In Laravel there's no direct analogy; server-rendered HTML would use an inline `style="width: 75%"` directly, since there's no build-time scanning step.

**Common Mistakes**
1. **Constructing Tailwind class names dynamically.** `` className={`w-[${pct}%]`} `` looks like it should work but doesn't — Tailwind's scanner never sees those values and generates no CSS for them. Always keep the full Tailwind class name as a complete static string.
2. **Using `style={{ width: '75%' }}` directly.** This works but violates the pattern of keeping all presentation in Tailwind classes. The CSS variable approach keeps the `style` prop as data-passing only, with the visual rule in the class.
3. **Forgetting the `as React.CSSProperties` cast.** TypeScript will error on `style={{ '--bar-w': ... }}` without it because `React.CSSProperties` doesn't type custom properties. The cast is the standard workaround.

---

### Track and fill pattern for progress bars

**Plain English**
A progress bar needs two elements: a background track that spans the full available width, and a fill bar that spans only the percentage. In HTML/CSS, the common approach is a container div (the track, full width, gray background) containing a child div (the fill, dynamic width, colored). The child's width is a percentage of the parent's width, so the track defines the 100% reference point. The bar at 75% means "75% of the container's width."

**Technically Speaking**
```tsx
<div className="mt-2 h-1 rounded-full bg-gray-100 dark:bg-gray-700">
  <div className="h-1 rounded-full bg-blue-400 w-[var(--bar-w)]" ... />
</div>
```
The outer div is `block` by default (full width of its container, which is the padded row). The inner div's `w-[var(--bar-w)]` is a percentage of that parent — CSS percentages on `width` are always relative to the containing block's width. Both divs share the same `h-1` (4px) and `rounded-full` for visual alignment. The track's `overflow: hidden` (via `overflow-hidden` or implicit clipping) isn't needed here since the inner div's width can't exceed 100% — `totalSpending` is always the sum of all `row.total` values, so the largest category is always exactly 100%.

**Vue / Laravel Analogy**
This is the same HTML structure you'd write in any framework — two nested divs with the outer one full-width and the inner one a percentage width. The pattern is framework-agnostic. In Laravel Blade:
```html
<div class="track">
  <div class="fill" style="width: {{ $row->total / $totalSpending * 100 }}%"></div>
</div>
```
The only difference in React is how the dynamic value is passed (CSS variable via `style` prop, rather than a server-rendered inline style).

**Common Mistakes**
1. **Using `width: 100%` on the track explicitly.** Block elements are already full-width — the explicit `w-full` is redundant. The track's width comes from its parent's block layout.
2. **Computing the percentage as a whole number with `.toFixed(0)`.** This causes rounding errors where multiple categories sum to more or less than 100%. `.toFixed(1)` preserves enough precision without displaying unnecessarily long decimal strings in the CSS variable value.

---

## Code Walkthrough

### The outer row structure change
```tsx
// before: flat flexbox row
<div className="flex items-center justify-between px-5 py-3 ...">

// after: column layout with nested flexbox
<div className="px-5 py-3 ...">
  <div className="flex items-center justify-between">
    ...text and amount...
  </div>
  <div className="mt-2 h-1 ...">  {/* bar */}
```
The `flex items-center justify-between` moved from the row container to an inner div. The outer row is now a block element (column-oriented), so the bar div stacks naturally below the text line. `mt-2` adds 8px of space between the text and the bar.

### The bar elements
```tsx
<div className="mt-2 h-1 rounded-full bg-gray-100 dark:bg-gray-700">
  <div
    className="h-1 rounded-full bg-blue-400 dark:bg-blue-500 w-[var(--bar-w)]"
    style={{ '--bar-w': `${((row.total / totalSpending) * 100).toFixed(1)}%` } as React.CSSProperties}
  />
</div>
```
Outer div: the track — `h-1` (4px tall), `rounded-full` (pill shape), gray background. Inner div: the fill — same dimensions, blue, width determined by the CSS variable. The percentage is `row.total / totalSpending * 100` — if "Groceries" is $200 of $400 total spending, it gets `50.0%`. The top-ranked category is always 100%.

### Why income uses totalIncome, not totalSpending
```tsx
style={{ '--bar-w': `${((row.total / totalIncome) * 100).toFixed(1)}%` } as React.CSSProperties}
```
The income panel's bars are proportional to income categories only — "Income" categories shouldn't be scaled against spending totals. Each panel is self-contained: spending bars are relative to total spending, income bars are relative to total income.

---

## What to Remember

- Never construct Tailwind class names dynamically at runtime — Tailwind's scanner only includes classes it finds as complete static strings in source files.
- CSS custom properties (`--var-name`) set via `style` prop are the correct bridge between React's dynamic data and Tailwind's static class system.
- Use `as React.CSSProperties` to silence TypeScript errors on custom property keys in the `style` object — the cast is safe, the browser supports them.
- The track-and-fill pattern: outer div is full-width (the 100% reference), inner div's percentage width is relative to the outer div.
- The top-ranked category is always 100% of its bar — bars show relative proportion within their own panel (spending vs. spending, income vs. income), not across both panels.
