Explain the concept or code passed as $ARGUMENTS.

If $ARGUMENTS is a concept name (e.g. "useEffect", "selector", "reconciliation"), explain the concept.
If $ARGUMENTS looks like a code snippet or refers to code in the current file, explain that specific code.
If $ARGUMENTS is empty, ask what to explain.

Use this exact format:

---

## [Concept or Code]

### Plain English
One paragraph. No assumed React knowledge. Explain what this thing *does* in the real world — what problem it solves, what it represents. Use an analogy if it makes things clearer.

### What's Actually Happening
Go one layer deeper. Use correct technical terminology. Explain the mechanism — what the framework is doing, what the compiler does, what happens at runtime. This is the version the developer can use to explain it to someone else or answer an interview question.

### Example from This Codebase
Quote the relevant snippet from the current project (if one exists) and explain exactly what that specific code does. If no example exists yet, write a minimal one that fits the FinFlow context.

### Vue or Laravel Analogy
If a direct equivalent exists in Vue 3 (Composition API) or Laravel, show both side by side. If the concept has no equivalent, explain why — that gap itself is often instructive.

### Common Mistakes
List 2–3 things developers commonly get wrong about this concept, especially coming from a Vue/Laravel background.

---

Keep the explanation focused. If the concept is large (e.g. "Redux"), pick the most important aspect to explain fully rather than giving a shallow overview of everything.
