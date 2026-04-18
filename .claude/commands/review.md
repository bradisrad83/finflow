Review the currently open file for React and Redux best practices.

If no file is specified in $ARGUMENTS, review the file currently open in the editor.

Check for the following and report findings for each category:

---

## Review: [filename]

### Unnecessary Re-renders
- Is `useSelector` selecting more state than the component needs?
- Are objects or arrays being created inline inside JSX (causes new reference on every render)?
- Are callback functions defined inline without `useCallback` where it matters?
- Are any expensive computations done unconditionally on every render?

### Hook Usage
- Are all hooks called at the top level (not inside conditions, loops, or nested functions)?
- Does `useEffect` have a correct and complete dependency array?
- Is any state that should be derived from existing state being stored redundantly?
- Are custom hooks used where logic is repeated across components?

### Redux Patterns
- Is `useSelector` typed with `RootState`?
- Are selectors selecting the minimum needed slice of state?
- Is any Redux state being mutated directly (outside a reducer)?
- Is `useDispatch` typed with `AppDispatch`?
- Is any state in Redux that should be local component state instead?

### TypeScript
- Are there any `any` types, explicit or inferred?
- Are all prop interfaces defined and exported from the right place?
- Are union types used where a field has a fixed set of values?
- Are `ReturnType<>` or other utility types used where they should be?

### Component Responsibility
- Is this component doing more than one clearly defined job?
- Is there presentational logic mixed with data-fetching/selector logic that should be separated?
- Is the component over 80 lines? If so, what could be extracted?

### Tailwind / Styling
- Are there any inline `style={{}}` props?
- Are conditional classes using a ternary or template literal correctly?
- Are class strings getting long enough to warrant a `clsx` utility?

---

For each issue found:
1. Quote the specific line(s)
2. Explain why it's a problem
3. Show the corrected version

If a category has no issues, write "✓ No issues."

End with a one-paragraph overall assessment.
