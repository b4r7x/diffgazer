# Codebase Reusability Audit Workflow

## Purpose
Full monorepo validation: structure, naming conventions, colocation, reusability patterns. Identifies violations and auto-fixes them.

## Structure Rules Reference

Load context from `.claude/docs/`:
- `structure-packages.md` - packages/ rules (kebab-case, flat schemas)
- `structure-apps.md` - apps/ rules (kebab-case, Bulletproof React, colocation)
- `structure-server.md` - Hono patterns (kebab-case)

---

## Stage 0: Full Structure Validation (NEW)

**Agent:** `code-archaeologist`
**Goal:** Validate entire monorepo structure and naming

```
Validate all files against .claude/docs/structure-*.md:

1. NAMING CONVENTIONS

   ALL files use kebab-case:
   - packages/*: kebab-case (error-classifier.ts, lazy-loader.ts)
   - apps/cli/*: kebab-case (use-review.ts, review-display.tsx)
   - apps/server/*: kebab-case (review-orchestrator.ts, sse-helpers.ts)

   Find camelCase violations:
   - Command: find packages apps -name "*.ts" -o -name "*.tsx" | xargs basename -a | grep -v node_modules | grep -E '^[a-z]+[A-Z]'

2. FOLDER STRUCTURE

   apps/cli/src/:
   - Must have: app/, components/, features/, hooks/, lib/, types/
   - app/ must NOT have hooks/ (should be in features/app/hooks/)
   - features/ must have index.ts in each feature

   apps/server/src/:
   - Must have: api/routes/, services/, lib/, config/

   packages/schemas/src/:
   - Must be FLAT (no subfolders except for tests)

   packages/core/src/:
   - Grouped by concern (ai/, storage/, review/, utils/, etc.)

3. COLOCATION CHECK

   For each component folder:
   - If has dedicated hook → must be in component folder, not features/*/hooks/
   - If has test → must be colocated (component.test.tsx)
   - If has utils → must be colocated if used only here

4. IMPORT HIERARCHY (apps/)

   Check for violations:
   - features/* importing from other features/* (VIOLATION)
   - app/* not at top of hierarchy
   - Circular dependencies

5. GENERATE REPORT

   Output table:
   | File | Violation | Severity | Fix |
   |------|-----------|----------|-----|
   | apps/cli/src/hooks/useReview.ts | Wrong naming (should be kebab-case) | High | Rename to use-review.ts |
   | apps/cli/src/app/hooks/ | Hooks in app/ (should be features/app/) | High | Move to features/app/hooks/ |
```

**Agent:** `code-simplifier`
**Goal:** Auto-fix violations from Stage 0

```
For each violation found in Stage 0:

1. FILE RENAMES (if camelCase found)
   Generate git mv commands:
   git mv path/to/camelCaseFile.ts path/to/kebab-case-file.ts

2. FOLDER MOVES
   Move misplaced folders:
   git mv apps/cli/src/app/hooks apps/cli/src/features/app/hooks

3. UPDATE IMPORTS
   After renames, update all imports in affected files

4. CREATE MISSING STRUCTURE
   - Missing index.ts files
   - Missing folders (features/app/, etc.)

5. VERIFY
   Run: npm run type-check

Output: List of all changes made
```

## Workflow Stages

### Stage 1: Inventory Existing Utilities
**Agent:** `code-archaeologist`
**Goal:** Map all existing shared utilities and their usage

```
Analyze the shared utility packages in this codebase:

1. Scan packages/core/src/utils/ for all exported utilities
2. Scan packages/core/src/ for shared modules (errors.ts, result.ts, json.ts, validation.ts)
3. Scan packages/schemas/src/ for shared types and schemas
4. For each utility/type found:
   - Document its purpose
   - Find all files that import it
   - Find files that SHOULD use it but don't (similar patterns implemented inline)

Output a table:
| Utility | Location | Current Usage Count | Potential Usage (files with similar inline code) |
```

### Stage 2: Pattern Detection
**Agent:** `code-archaeologist`
**Goal:** Find duplicated patterns across the codebase

```
Search the codebase for duplicated patterns that should be extracted:

1. Error handling patterns:
   - Search for repeated try/catch with similar error transformation
   - Search for inline error classification (string matching on error messages)
   - Search for Result<T, E> wrapping patterns

2. Validation patterns:
   - Search for Zod schema.safeParse() usage
   - Search for JSON parsing + validation combinations
   - Search for input validation patterns

3. Async patterns:
   - Search for lazy loading (module-level let + async function)
   - Search for retry logic
   - Search for resource wrapper patterns (acquire/use/release)

4. Data transformation patterns:
   - Search for mapping functions used in multiple places
   - Search for serialization/deserialization patterns

For each pattern found:
- List all occurrences with file:line references
- Assess if extraction would reduce code and improve consistency
- Recommend extraction location (utils/, errors.ts, new file, etc.)
```

### Stage 3: Cross-Package Analysis + Structure Validation
**Agent:** `code-archaeologist`
**Goal:** Analyze dependencies and validate structure

```
Analyze package boundaries and validate structure against .claude/docs/structure-*.md:

1. Naming conventions:
   - ALL files use kebab-case (error-classifier.ts, use-review.ts, review-orchestrator.ts)
   - Single-word preferred when possible (result.ts not result-type.ts)

2. Package structure (structure-packages.md):
   - packages/schemas/src/: Flat, one file per domain
   - packages/core/src/: Grouped by concern (ai/, storage/, review/)
   - packages/api/src/: Minimal (client.ts, types.ts, index.ts)

3. App structure (structure-apps.md):
   - apps/cli/: Bulletproof React (features/, components/, hooks/, app/screens/)
   - apps/server/: Hono patterns (api/routes/, services/, lib/)

4. Import hierarchy:
   - @repo/* packages → shared → features → app
   - Features cannot import from other features
   - schemas and api are leaf packages (no monorepo imports)

5. Check for:
   - Files in wrong location
   - Missing barrel exports (index.ts)
   - Cross-feature imports (violation)
   - Tests not co-located

Output: Structure violations + recommendations for moving/consolidating code.
```

### Stage 4: Code Simplification Candidates
**Agent:** `code-simplifier:code-simplifier`
**Goal:** Identify files that need simplification

```
For each source directory, identify simplification opportunities:

1. Find files with:
   - Excessive comments that could be removed
   - Overly complex patterns that could use existing utilities
   - Dead code or unused exports
   - Inline implementations of patterns available in utils/

2. For each candidate file:
   - Current line count
   - Estimated line count after simplification
   - Specific utilities that should be used
   - Code that should be extracted

Priority order:
- HIGH: Files reimplementing existing utilities
- MEDIUM: Files with extractable patterns used elsewhere
- LOW: Files with minor cleanup opportunities
```

### Stage 5: Over-Engineering Detection
**Agent:** `code-review-ai:architect-review`
**Goal:** Detect and fix AI-induced over-engineering

Reference: `.claude/workflows/audits/audit-overengineering.md`

```
Find and fix over-engineering patterns:

1. UNNECESSARY ABSTRACTIONS
   - Interfaces with single implementation → remove interface
   - Generics used with only one type → make specific
   - Factory patterns for simple objects → direct construction

2. PASS-THROUGH WRAPPERS
   - Classes that just delegate to library → use library directly
   - Layers that add no logic → collapse layers

3. OVER-VALIDATION
   - Same data validated multiple times → validate once at boundary
   - Internal functions re-validating typed params → trust the types

4. PREMATURE DRY
   - Abstractions full of conditionals → split back up
   - Shared code with <3 use cases → keep duplicated until pattern emerges

5. OVER-CONFIGURATION
   - Config for values that never change → hardcode
   - Options that have never been used → remove

Output:
| Pattern | File | Fix |
| --- | --- | --- |
| Single-impl interface | user-repo.ts | Remove IUserRepository |
| Unnecessary factory | user-factory.ts | Use `new User()` directly |
| Pass-through wrapper | logger.ts | Use winston directly |
```

### Stage 6: Test Coverage Analysis
**Agent:** `unit-testing:test-automator`
**Goal:** Verify shared utilities have adequate tests (use case coverage, not line coverage)

Reference: `.claude/docs/testing.md`

```
Audit test quality (not just existence):

1. For each file in packages/core/src/utils/:
   - Check if corresponding .test.ts exists
   - Assess USE CASE coverage (not line coverage)
   - Identify missing edge case tests

2. For packages/core/src/ shared modules:
   - Verify errors.ts, result.ts, json.ts have behavior tests
   - Check validation.ts edge cases

3. For packages/schemas/src/:
   - Verify schema validation tests for edge cases
   - Check error message tests

4. Check for test anti-patterns:
   - Tests spying on React hooks (implementation detail)
   - Tests checking internal state
   - fireEvent usage (should be userEvent)
   - getByTestId as first choice (should be getByRole)
   - vi.mock for internal modules (over-mocking)
   - Duplicate test cases
   - Trivial tests (toBeDefined on constants)

Output:
| File | Has Tests | Quality | Issues |
| --- | --- | --- | --- |
| result.ts | Yes | Good | - |
| parser.ts | Yes | Poor | Tests implementation, uses fireEvent |
| api.ts | No | N/A | Missing tests |
```

### Stage 7: Implementation Plan
**Agent:** `code-simplifier:code-simplifier`
**Goal:** Execute identified improvements

```
Based on findings from stages 1-6, execute improvements in order:

1. Extract new utilities (if any identified)
2. Update files to use existing utilities
3. Remove duplicated code
4. Clean up comments and dead code
5. Verify all tests pass after changes

For each change:
- Run type-check after modification
- Run affected tests
- Document the change made
```

---

## Execution Commands

### Run Full Audit (Sequential)
```
Run the codebase reusability audit:

Stage 1: Use code-archaeologist to inventory all utilities in packages/core/src/utils/, packages/core/src/*.ts, and packages/schemas/src/. Map their exports and find all import usages across the codebase.

Stage 2: Use code-archaeologist to search for duplicated patterns: error handling (try/catch transformations, error classification), validation (Zod safeParse, JSON+validation), async patterns (lazy loading, retry, resource wrappers), and data transformations. List all occurrences with file:line.

Stage 3: Use code-archaeologist to analyze cross-package dependencies. Find types/utilities duplicated across packages/core, packages/schemas, packages/api, and apps/. Identify code in wrong packages.

Stage 4: Use code-simplifier to identify files needing cleanup - those reimplementing existing utilities, having extractable patterns, or containing dead code.

Stage 5: Use architect-review to detect over-engineering: single-impl interfaces, unnecessary factories, pass-through wrappers, over-validation, premature DRY.

Stage 6: Use test-automator to audit test quality (not just existence) - behavior tests, no implementation tests, proper mocking.

Stage 7: Based on findings, use code-simplifier to execute improvements: remove over-engineering, extract utilities, update files to use shared code, clean up.

After each stage, summarize findings before proceeding.
```

### Run Quick Check (Parallel where possible)
```
Run parallel agents for quick codebase reusability check:

1. code-archaeologist: Scan packages/core/src/utils/ and list all exports with their import counts
2. code-archaeologist: Search for "safeParse", "try {", "catch (", "Result<" patterns and count occurrences per file
3. code-archaeologist: Find files with >150 lines in packages/core/src/ and packages/api/src/ that might need splitting

Combine results into actionable recommendations.
```

---

## Expected Outputs

### Utility Inventory Table
| Utility | Package | Exports | Used By (count) | Underutilized? |
|---------|---------|---------|-----------------|----------------|
| createErrorClassifier | core/utils | 1 | 1 | Check gemini-like patterns |
| createLazyLoader | core/utils | 2 | 1 | Check async imports |
| validateSchema | core/utils | 1 | 2 | Check Zod usage |
| parseAndValidate | core/utils | 1 | 1 | Check JSON+Zod combos |

### Pattern Duplication Report
| Pattern | Occurrences | Files | Recommendation |
|---------|-------------|-------|----------------|
| Error string matching | 3 | a.ts, b.ts, c.ts | Use createErrorClassifier |
| Lazy module load | 2 | x.ts, y.ts | Use createLazyLoader |
| Zod safeParse inline | 5 | ... | Use validateSchema |

### Action Items
| Priority | File | Action | Utility to Use |
|----------|------|--------|----------------|
| P1 | src/foo.ts | Replace inline error classification | createErrorClassifier |
| P1 | src/bar.ts | Replace manual lazy load | createLazyLoader |
| P2 | src/baz.ts | Extract common pattern | New utility needed |

---

---

## Specialized Audits

Run these individually or as part of the full audit. Located in `.claude/workflows/audits/`.

### Run All Specialized Audits (Parallel)

```
Run these audits in parallel:

1. audit-schemas.md (Agent: pr-review-toolkit:type-design-analyzer)
   Target: packages/schemas/
   Focus: Zod patterns, safeParse, type inference

2. audit-core.md (Agent: javascript-typescript:typescript-pro)
   Target: packages/core/
   Focus: Library patterns, Result<T,E>, exports

3. audit-react.md (Agent: react-component-architect)
   Target: apps/cli/, apps/web/
   Focus: React 19, useMemo/useCallback, Zustand, colocation

4. audit-server.md (Agent: backend-development:backend-architect)
   Target: apps/server/
   Focus: Hono patterns, thin routes, services

5. audit-tests.md (Agent: unit-testing:test-automator)
   Target: All *.test.ts*
   Focus: Practical testing, behavior over implementation

6. audit-overengineering.md (Agent: code-review-ai:architect-review)
   Target: All source files
   Focus: YAGNI, unnecessary abstractions, AI-generated patterns
```

### Run Individual Audit

```
Run audit from .claude/workflows/audits/audit-react.md
```

---

## Notes

- Always run `npm run type-check` after changes
- Run affected tests after each file modification
- Commit after each logical group of changes
- Don't over-extract - only extract if pattern is used 2+ times
- Prefer editing existing utilities over creating new ones
