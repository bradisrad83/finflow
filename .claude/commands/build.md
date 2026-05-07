Build the feature named $ARGUMENTS for FinFlow.

Follow these steps exactly:

1. **Confirm scope first** — In 2–3 sentences, state what you're about to build, what files will be created or modified, and what new React/Redux concept it introduces. Wait for the user to confirm before writing any code.

2. **Build it** — Write the code. Follow all rules in CLAUDE.md:
   - Functional components only
   - TypeScript strict — no `any`
   - Tailwind for all styling
   - Redux Toolkit patterns where applicable
   - Seed data in `initialState`, never hardcoded in components

3. **Explain as you go** — After each new file or significant block, explain:
   - What it does in plain English
   - The Vue/Laravel analogy for any new React/Redux concept
   - Why it's written this way (not just what it does)

4. **Generate the doc** — After the code is complete, run `/doc` to generate the learning doc for what was just built.

Build one thing. Do not add extras, future-proofing, or unrelated cleanup.
