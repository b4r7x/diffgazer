# Run Reusability Audit

Execute this prompt to run a full codebase reusability audit.

---

## Quick Audit (Copy & Paste)

```
Run codebase reusability audit with multiple agents:

**Stage 1 - Utility Inventory (code-archaeologist):**
Scan packages/core/src/utils/ and packages/core/src/*.ts for all exported functions/types. For each, count imports across the codebase. Output table: | Utility | File | Export Count | Import Count |

**Stage 2 - Pattern Detection (code-archaeologist):**
Search entire codebase for these patterns and list files:line where found:
- Zod .safeParse() not using validateSchema
- try/catch with error message string matching
- Module-level "let x = null" + async loader function
- Inline JSON.parse without safeParseJson
- Result<T,E> creation patterns that could use utilities

**Stage 3 - Recommendations (code-archaeologist):**
Based on stages 1-2, identify:
- Files that should use existing utilities but don't
- Patterns occurring 2+ times that should be extracted
- Code that belongs in different packages

**Stage 4 - Execute (code-simplifier):**
For each high-priority finding, update the file to use shared utilities. Run type-check and tests after each change.

Run stages 1-3 first, summarize findings, then ask before executing stage 4.
```

---

## Full Audit (Detailed)

```
Run comprehensive codebase reusability audit:

PHASE 1 - DISCOVERY (run in parallel):

Agent 1 (code-archaeologist): "Inventory all utilities"
- List all exports from packages/core/src/utils/*.ts
- List all exports from packages/core/src/errors.ts, result.ts, json.ts
- List all exports from packages/schemas/src/*.ts
- For each export, grep for imports and count usage

Agent 2 (code-archaeologist): "Find duplicated patterns"
- Search for: schema.safeParse, try { ... } catch, .toLowerCase().includes, JSON.parse
- Group by pattern type
- List all occurrences with file:line

Agent 3 (code-archaeologist): "Cross-package analysis"
- Map type definitions across packages
- Find types/interfaces defined in multiple packages
- Identify potential circular dependencies

PHASE 2 - ANALYSIS:

Agent (code-archaeologist): "Generate recommendations"
Based on Phase 1 findings:
- List files that should use existing utilities (priority by occurrence count)
- List patterns that should be extracted (used 2+ times)
- List code that should move between packages

PHASE 3 - EXECUTION (sequential):

For each recommendation from Phase 2:
1. Agent (code-simplifier): Update file to use shared utility
2. Run: npm run type-check
3. Run: npx vitest run <affected-test-file>
4. Report success/failure

Summarize after each phase before proceeding.
```

---

## Targeted Audits

### Audit Single Directory
```
Run reusability audit for packages/core/src/ai/:

1. code-archaeologist: List all files, their line counts, and what utilities they import from ../utils/
2. code-archaeologist: Find patterns in these files that match existing utilities but aren't using them
3. code-simplifier: Update files to use shared utilities where applicable
```

### Audit for Specific Pattern
```
Run audit for error handling patterns:

1. code-archaeologist: Search for "catch (" across codebase, list all files
2. code-archaeologist: For each catch block, check if it uses createError, createErrorClassifier, or inline error creation
3. code-archaeologist: Identify catch blocks that should use shared error utilities
4. code-simplifier: Update identified files to use createErrorClassifier or appropriate error utilities
```

### Audit for Missing Tests
```
Run test coverage audit for shared utilities:

1. test-automator: List all files in packages/core/src/utils/
2. test-automator: For each file, check if .test.ts exists
3. test-automator: For files without tests, create comprehensive test files
4. Run: npx vitest run packages/core/src/utils/
```
