# Code Simplification Prompts

## Quick Simplification

```
Run code simplification on recently modified files:

1. code-simplifier:code-simplifier: Remove comments, simplify patterns
2. Run type-check and tests after each file change

Rules:
- Remove all WHAT comments, keep only WHY comments
- Use existing utilities from packages/core/src/utils/
- No commented-out code
- Functions <20 lines, nesting <3 levels
```

---

## Full Simplification Analysis

```
Run comprehensive code simplification ANALYSIS (do not make changes yet):

PHASE 1 - Discovery:
- code-archaeologist: Map codebase structure
- Explore: Find all type/schema definitions

PHASE 2 - Type Analysis:
- pr-review-toolkit:type-design-analyzer: Review packages/schemas/
- Explore: Find types defined outside packages/schemas/
- List duplicate types with file locations

PHASE 3 - Over-Abstraction:
- code-review-ai:architect-review: Find unnecessary layers
- List wrapper functions, premature generics

PHASE 4 - Complexity:
- pr-review-toolkit:code-simplifier: Find YAGNI/KISS violations
- List functions >20 lines, nesting >3 levels

PHASE 5 - Comments:
- Find all comments in source files
- Flag for removal: WHAT comments, commented code, TODOs without tickets
- Flag to keep: WHY comments, regex explanations, API quirks

PHASE 6 - Tests:
- unit-testing:test-automator: Analyze test files
- Flag: trivial tests, duplicates, implementation tests

OUTPUT: Task list with file:line locations for each issue.
```

---

## Execute Simplification Tasks

```
Execute simplification based on analysis:

For each identified issue:
1. Apply fix using appropriate agent
2. Run: npm run type-check
3. Run: npx vitest run <affected-test>
4. Report success/failure

Agents by task type:
- Type consolidation: typescript-pro
- Remove abstraction: code-review-ai:architect-review
- Simplify code: code-simplifier:code-simplifier
- Remove comments: code-simplifier:code-simplifier
- Clean up tests: unit-testing:test-automator
```

---

## Comment Cleanup

```
Clean up comments in [FILE]:

DELETE:
- Comments describing WHAT code does (obvious from code)
- Commented-out code
- TODO/FIXME without ticket references
- Section dividers and decorative comments
- Redundant JSDoc on self-explanatory functions

KEEP:
- Comments explaining WHY (business reasons)
- Non-obvious workarounds with explanation
- Regex explanations
- External API quirks
- Performance justifications
- Warnings about non-obvious behavior

Use Edit tool to remove unnecessary comments.
```

---

## Test Cleanup

```
Clean up tests in [TEST_FILE]:

DELETE:
- Tests for trivial code (getters, setters)
- Duplicate test cases (same behavior tested twice)
- Implementation-detail tests (spying on private methods)
- CSS/styling tests
- Tests that verify framework behavior
- Tests that mock everything

KEEP:
- Business logic tests
- Edge case tests
- Error handling tests
- Integration point tests

Use Edit tool, then run: npx vitest run [TEST_FILE]
```

---

## Type Consolidation

```
Consolidate type [TYPE_NAME]:

1. Find all definitions across packages
2. Create canonical definition in packages/schemas/src/
3. Use Zod schema with z.infer pattern:
   export const Schema = z.object({...});
   export type TypeName = z.infer<typeof Schema>;
4. Delete duplicate definitions
5. Update all imports to use @repo/schemas
6. Run type-check to verify
```

---

## Utility Usage Check

```
Check if file uses available utilities:

Existing utilities in packages/core/src/utils/:
- createLazyLoader: For optional module loading
- createErrorClassifier: For error pattern matching
- createResourceWrapper: For optional resource access
- validateSchema: For Zod validation
- parseAndValidate: For JSON + Zod validation

Existing utilities in packages/core/src/:
- safeParseJson (json.ts): Safe JSON parsing
- createError (errors.ts): Error factory
- ok/err (result.ts): Result type helpers

If file has similar inline patterns, update to use these utilities.
```
