# Codebase Reusability Audit Workflow

## Purpose
Validate the entire codebase for reusability patterns, identify code that should be extracted to shared packages (core/types/schemas), and find places where existing utilities should be used.

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

### Stage 3: Cross-Package Analysis
**Agent:** `code-archaeologist`
**Goal:** Analyze dependencies between packages

```
Analyze package boundaries and shared code opportunities:

1. Map the package structure:
   - packages/core/
   - packages/schemas/
   - packages/api/
   - apps/server/
   - apps/cli/ (if exists)

2. For each package, identify:
   - Types that are duplicated across packages
   - Utilities that are re-implemented in multiple packages
   - Constants/config that should be centralized

3. Check for:
   - Circular dependency risks
   - Types in wrong package (e.g., API types in core)
   - Schemas that should be in packages/schemas but are elsewhere

Output recommendations for moving/consolidating code.
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

### Stage 5: Test Coverage Analysis
**Agent:** `unit-testing:test-automator`
**Goal:** Verify shared utilities have adequate tests

```
Audit test coverage for shared utilities:

1. For each file in packages/core/src/utils/:
   - Check if corresponding .test.ts exists
   - Assess test coverage (functions tested vs exported)
   - Identify missing edge case tests

2. For packages/core/src/ shared modules:
   - Verify errors.ts, result.ts, json.ts have tests
   - Check validation.ts test coverage

3. For packages/schemas/src/:
   - Verify schema validation tests exist
   - Check for missing type export tests

Output:
| File | Has Tests | Coverage Assessment | Missing Tests |
```

### Stage 6: Implementation Plan
**Agent:** `code-simplifier:code-simplifier`
**Goal:** Execute identified improvements

```
Based on findings from stages 1-5, execute improvements in order:

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

Stage 5: Use test-automator to audit test coverage for all shared utilities in packages/core/src/utils/ and packages/schemas/src/.

Stage 6: Based on findings, use code-simplifier to execute improvements: extract utilities, update files to use shared code, remove duplication, clean up.

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

## Notes

- Always run `npm run type-check` after changes
- Run affected tests after each file modification
- Commit after each logical group of changes
- Don't over-extract - only extract if pattern is used 2+ times
- Prefer editing existing utilities over creating new ones
