# Simplification Tasks - Generated 2026-01-23

## Executive Summary

| Category | Issues Found |
|----------|-------------|
| **Type/Schema Issues** | 6 priority improvements |
| **Over-Abstractions** | 10 unnecessary abstractions |
| **Complexity Issues** | 4 YAGNI, 4 KISS, 7 long functions, 3 God functions |
| **Error Handling Issues** | 23 issues (4 critical, 6 high, 13 medium) |
| **Readability Issues** | 4 DRY violations, poor naming, magic numbers |
| **Comment Issues** | 29 comments to remove |
| **Test Issues** | ~19 low-value tests to remove |
| **Total Files Affected** | ~45 files |

### Priority Order
1. **CRITICAL**: Error handling fixes (silent failures in keyring.ts)
2. **HIGH**: Remove duplicate code (DRY violations)
3. **HIGH**: Fix God components (app.tsx splitting)
4. **MEDIUM**: Remove unnecessary abstractions
5. **MEDIUM**: Type consolidation
6. **LOW**: Remove unnecessary comments
7. **LOW**: Clean up tests

---

## Phase 1: Error Handling Fixes (Critical)

### Task 1.1: Fix empty catch blocks in keyring.ts

**Priority:** Critical
**Agent:** pr-review-toolkit:silent-failure-hunter
**Estimated Scope:** 1 file

**Files:**
- packages/core/src/secrets/keyring.ts (lines 16-21, 48-54, 67-68, 79-80, 91-93)

**Problem:**
Empty catch blocks and bare `catch` statements silently swallow all errors, hiding permission errors, keyring corruption, and system issues. Users get generic "not available" messages with no insight into fixable problems.

**Action:**
1. Line 16-21: Capture and log the import error before returning null
2. Line 48-50: Log cleanup errors instead of empty catch
3. Line 53-54: Return specific error codes for different failure modes
4. Lines 67-68, 79-80: Include original error in Result error messages
5. Line 91-93: Only return success for "not found" errors, propagate others

**Acceptance Criteria:**
- [ ] No empty catch blocks remain
- [ ] All catch blocks preserve error context
- [ ] Users get actionable error messages
- [ ] Tests pass

**Context for Agent:**
```typescript
// Current problematic patterns to fix:
catch {} // Empty - line 48
catch { return null; } // Loses error - line 21
catch { return false; } // Loses error - line 54
catch { return err(createError<SecretsErrorCode>("READ_FAILED", "...")); } // Loses original error
```

---

### Task 1.2: Fix silent degradation in review-orchestrator.ts

**Priority:** Critical
**Agent:** pr-review-toolkit:silent-failure-hunter
**Estimated Scope:** 1 file

**Files:**
- apps/server/src/services/review-orchestrator.ts (lines 96-119)

**Problem:**
When AI response parsing fails, the function returns raw content as "summary" with empty issues array. Users see "successful" reviews with no issues when the review actually failed completely.

**Action:**
1. Add error flag to FileReviewResult type
2. When parse fails, set `parseError: true` in result
3. Propagate parse failures to callbacks so UI can show warning
4. Consider rejecting the result entirely for critical parse failures

**Acceptance Criteria:**
- [ ] Parse failures are visible to users
- [ ] No silent degradation to empty results
- [ ] Tests cover parse failure scenarios

**Context for Agent:**
```typescript
// Current silent fallback:
return {
  filePath,
  summary: content,  // Raw AI output, not parsed
  issues: [],        // Empty - hides real issues!
  score: null,
};
```

---

### Task 1.3: Fix error context loss in review.ts

**Priority:** High
**Agent:** pr-review-toolkit:silent-failure-hunter
**Estimated Scope:** 1 file

**Files:**
- apps/server/src/services/review.ts (lines 64-69)

**Problem:**
Git diff errors lose all context - original error discarded, users only see generic "Failed to get git diff".

**Action:**
1. Capture the original error
2. Include error details in the callback message
3. Differentiate between "git not found", "not a repo", "permission denied", etc.

**Acceptance Criteria:**
- [ ] Original error preserved in error messages
- [ ] Users see actionable error information
- [ ] Tests cover error scenarios

---

## Phase 2: Remove Duplicate Code (DRY)

### Task 2.1: Remove duplicate sanitization functions

**Priority:** High
**Agent:** javascript-typescript:typescript-pro
**Estimated Scope:** 2 files

**Files:**
- apps/server/src/services/review.ts (lines 7-21, delete)
- apps/server/src/lib/sanitization.ts (keep, source of truth)

**Problem:**
`sanitizeUnicode` and `escapeXml` are defined in both files with slightly different implementations (unicode flag differs).

**Action:**
1. Delete functions from review.ts
2. Add import: `import { sanitizeUnicode, escapeXml } from "../lib/sanitization.js"`
3. Ensure sanitization.ts uses unicode flag (`/[\u{E0000}-\u{E007F}]/gu`)

**Acceptance Criteria:**
- [ ] Single source of truth for sanitization functions
- [ ] review.ts imports from sanitization.ts
- [ ] TypeScript compiles
- [ ] Tests pass

**Context for Agent:**
```typescript
// Keep in sanitization.ts (with unicode flag):
.replace(/[\u{E0000}-\u{E007F}]/gu, "")

// Delete from review.ts (missing flag):
.replace(/[\uE0000-\uE007F]/g, "")
```

---

### Task 2.2: Extract common SSE stream hook

**Priority:** High
**Agent:** react-component-architect
**Estimated Scope:** 3 files

**Files:**
- apps/cli/src/features/review/hooks/use-review.ts (lines 46-71)
- apps/cli/src/features/chat/hooks/use-chat.ts (lines 42-67)
- apps/cli/src/hooks/use-sse-stream.ts (create new)

**Problem:**
Near-identical SSE stream processing code in both hooks: parseEvent callback, onEvent handling, onBufferOverflow, error state setting.

**Action:**
1. Create `useSSEStream` hook with common logic
2. Accept callbacks for chunk/complete/error handling
3. Refactor use-review.ts to use new hook
4. Refactor use-chat.ts to use new hook

**Acceptance Criteria:**
- [ ] Common SSE logic in single hook
- [ ] Both feature hooks use shared hook
- [ ] No duplicate stream processing code
- [ ] Tests pass

---

### Task 2.3: Create error state helper

**Priority:** Medium
**Agent:** javascript-typescript:typescript-pro
**Estimated Scope:** 4 files

**Files:**
- apps/cli/src/features/review/hooks/use-review.ts (lines 39, 68, 74, 78)
- apps/cli/src/features/chat/hooks/use-chat.ts (lines 35, 64, 76)
- apps/cli/src/lib/state-helpers.ts (create new)

**Problem:**
Error state creation pattern repeated 8+ times:
```typescript
setState({ status: "error", error: { message: "...", code: "INTERNAL_ERROR" } });
```

**Action:**
1. Create helper: `createErrorState(message: string, code?: string)`
2. Replace all inline error state objects with helper calls

**Acceptance Criteria:**
- [ ] Single helper for error state creation
- [ ] All error states use helper
- [ ] Tests pass

---

### Task 2.4: Create Separator component

**Priority:** Low
**Agent:** react-component-architect
**Estimated Scope:** 5 files

**Files:**
- apps/cli/src/components/ui/separator.tsx (create new)
- apps/cli/src/components/list-screen-wrapper.tsx (lines 61, 77)
- apps/cli/src/components/settings/settings-header.tsx (line 12)
- apps/cli/src/app/screens/review-history-screen.tsx (line 47)

**Problem:**
Magic number `40` (or `20`) for separator width repeated in 5 locations:
```tsx
<Text dimColor>{"─".repeat(40)}</Text>
```

**Action:**
1. Create `<Separator width={40} />` component
2. Replace all inline separator Text elements

**Acceptance Criteria:**
- [ ] Single Separator component
- [ ] Configurable width
- [ ] All separators use component

---

## Phase 3: Remove Over-Abstractions

### Task 3.1: Remove AI client factory

**Priority:** Medium
**Agent:** code-review-ai:architect-review
**Estimated Scope:** 3 files

**Files:**
- packages/core/src/ai/client.ts (lines 8-14, simplify)
- apps/server/src/api/routes/review.ts
- apps/server/src/api/routes/chat.ts

**Problem:**
Factory pattern `createAIClient()` only creates Gemini clients. The abstraction adds indirection without value since only one provider exists.

**Action:**
1. Remove factory function
2. Export `createGeminiClient` directly as `createAIClient`
3. Update imports in consuming files
4. Remove provider parameter (always gemini)

**Acceptance Criteria:**
- [ ] No unnecessary factory layer
- [ ] Direct Gemini client creation
- [ ] TypeScript compiles
- [ ] Tests pass

**Context for Agent:**
```typescript
// Current factory (remove):
export function createAIClient(provider: AIProvider, config: AIClientConfig) {
  if (provider !== "gemini") return err(...);
  return createGeminiClient(config);
}

// Simplified:
export { createGeminiClient as createAIClient } from "./providers/gemini.js";
```

---

### Task 3.2: Remove unused utility modules

**Priority:** Medium
**Agent:** javascript-typescript:typescript-pro
**Estimated Scope:** 3 files

**Files:**
- apps/server/src/lib/sse-utils.ts (delete if unused)
- apps/server/src/lib/normalization.ts (delete if unused, 128 lines)
- packages/core/src/ai/schema-converter.ts (mark internal or delete - only used by tests)

**Problem:**
- `sse-utils.ts` creates error handler factory but inline handling used in routes
- `normalization.ts` (128 lines) appears unused
- `zodToGeminiSchema` (72 lines) only imported by its test file

**Action:**
1. Search codebase for imports of each module
2. Delete unused modules or mark as internal
3. If keeping schema-converter, remove from public exports

**Acceptance Criteria:**
- [ ] No unused modules
- [ ] Reduced bundle size
- [ ] Tests pass

---

### Task 3.3: Simplify entity API hooks

**Priority:** Medium
**Agent:** react-component-architect
**Estimated Scope:** 3 files

**Files:**
- apps/cli/src/hooks/use-entity-api.ts (simplify or delete)
- apps/cli/src/hooks/use-entity-list.ts (keep)

**Problem:**
Two-layer abstraction: `useEntityList` → `useEntityApi`. The second layer just configures the first with API calls and re-exports the same interface.

**Action:**
1. Merge `useEntityApi` configuration into consumer hooks
2. Call `useEntityList` directly with inline fetch functions
3. Remove unnecessary abstraction layer

**Acceptance Criteria:**
- [ ] Single abstraction layer
- [ ] Same functionality
- [ ] Tests pass

---

### Task 3.4: Flatten types directory

**Priority:** Low
**Agent:** javascript-typescript:typescript-pro
**Estimated Scope:** 3 files

**Files:**
- apps/cli/src/types/index.ts (delete)
- apps/cli/src/types/ui.ts (delete)
- Inline `ListState` where used

**Problem:**
Two-file structure exports a single 4-value union type. Excessive organization.

**Action:**
1. Inline `ListState` type where it's used, or
2. Move to single types.ts file at package root

**Acceptance Criteria:**
- [ ] Simplified type structure
- [ ] No unnecessary index files
- [ ] TypeScript compiles

---

### Task 3.5: Remove pass-through wrapper function

**Priority:** Low
**Agent:** javascript-typescript:typescript-pro
**Estimated Scope:** 2 files

**Files:**
- packages/core/src/storage/review-history.ts (lines 65-71)
- apps/server/src/api/routes/reviews.ts

**Problem:**
`deleteReview()` is a pure pass-through that discards the `existed` field from `reviewStore.remove()`.

**Action:**
1. Use `reviewStore.remove()` directly in the route, or
2. Keep `deleteReview` but return the `existed` field (consistency with sessions)

**Acceptance Criteria:**
- [ ] No value-less wrapper
- [ ] Consistent with sessions API
- [ ] Tests pass

---

## Phase 4: Simplify Complex Code

### Task 4.1: Split App component

**Priority:** High
**Agent:** react-component-architect
**Estimated Scope:** 5+ files

**Files:**
- apps/cli/src/app/app.tsx (295 lines, split)
- apps/cli/src/app/views/ (create directory)

**Problem:**
God component with 10 responsibilities: configuration checking, session management, git status/diff, review, settings, history, view routing, input handling, navigation state.

**Action:**
1. Extract view-specific components to apps/cli/src/app/views/
2. Create navigation manager hook
3. Create feature-specific state hooks
4. App component should only orchestrate views

**Acceptance Criteria:**
- [ ] App component < 100 lines
- [ ] Each view in separate component
- [ ] Clear separation of concerns
- [ ] Tests pass

---

### Task 4.2: Split chat.post handler

**Priority:** Medium
**Agent:** backend-architect
**Estimated Scope:** 3 files

**Files:**
- apps/server/src/api/routes/chat.ts (lines 18-110, 93 lines)
- apps/server/src/services/chat.ts (create new)

**Problem:**
Route handler doing 10 things: validation, session loading, message saving, config loading, API key retrieval, AI client init, history building, prompt construction, SSE streaming, response persistence.

**Action:**
1. Extract chat orchestration to service
2. Route handler calls service methods
3. Consider middleware for AI client initialization

**Acceptance Criteria:**
- [ ] Route handler < 30 lines
- [ ] Service handles orchestration
- [ ] Same functionality
- [ ] Tests pass

---

### Task 4.3: Simplify AsyncState generic type

**Priority:** Low
**Agent:** javascript-typescript:typescript-pro
**Estimated Scope:** 1 file

**Files:**
- apps/cli/src/hooks/use-config.ts (lines 7-11)

**Problem:**
Premature generic type `AsyncState<TSuccess, TLoading, TError>` adds cognitive overhead for simple union types.

**Action:**
1. Inline specific state types:
```typescript
export type ConfigCheckState = "idle" | "loading" | "configured" | "unconfigured" | "error";
export type SaveConfigState = "idle" | "saving" | "success" | "error";
```

**Acceptance Criteria:**
- [ ] No generic AsyncState type
- [ ] Clear, explicit state types
- [ ] TypeScript compiles

---

## Phase 5: Type/Schema Improvements

### Task 5.1: Add messageCount validation to SessionSchema

**Priority:** Medium
**Agent:** javascript-typescript:typescript-pro
**Estimated Scope:** 2 files

**Files:**
- packages/schemas/src/session.ts (add refine)
- packages/schemas/src/session.test.ts (add tests)

**Problem:**
`SessionSchema` has denormalized `messageCount` in metadata but no validation ensuring it matches `messages.length`. `SavedReviewSchema` does this correctly.

**Action:**
1. Add `.refine()` to SessionSchema:
```typescript
.refine(
  (data) => data.metadata.messageCount === data.messages.length,
  { message: "messageCount must match messages.length" }
)
```
2. Add test cases for validation

**Acceptance Criteria:**
- [ ] SessionSchema validates messageCount consistency
- [ ] Tests cover valid and invalid cases
- [ ] Pattern matches SavedReviewSchema

---

### Task 5.2: Add file/line relationship constraint

**Priority:** Medium
**Agent:** javascript-typescript:typescript-pro
**Estimated Scope:** 2 files

**Files:**
- packages/schemas/src/review.ts (ReviewIssueSchema)
- packages/schemas/src/review.test.ts

**Problem:**
`ReviewIssueSchema` allows `{ file: null, line: 42 }` which is nonsensical. If line is specified, file should be required.

**Action:**
1. Add refinement: `line !== null` implies `file !== null`
2. Add test cases

**Acceptance Criteria:**
- [ ] Cannot have line without file
- [ ] Tests cover constraint
- [ ] Existing valid data still passes

---

### Task 5.3: Extract shared ScoreSchema

**Priority:** Low
**Agent:** javascript-typescript:typescript-pro
**Estimated Scope:** 2 files

**Files:**
- packages/schemas/src/review.ts
- packages/schemas/src/review-history.ts

**Problem:**
`z.number().min(0).max(10).nullable()` repeated in multiple places for score fields.

**Action:**
1. Create `ScoreSchema = z.number().min(0).max(10).nullable()`
2. Use in ReviewResultSchema, FileReviewResultSchema, ReviewHistoryMetadataSchema

**Acceptance Criteria:**
- [ ] Single ScoreSchema definition
- [ ] Used in all score fields
- [ ] Tests pass

---

## Phase 6: Remove Unnecessary Comments

### Task 6.1: Remove "WHAT" comments from review-orchestrator.ts

**Priority:** Low
**Agent:** experienced-engineer:code-quality-reviewer
**Estimated Scope:** 1 file

**Files:**
- apps/server/src/services/review-orchestrator.ts

**Comments to remove (9):**
- Lines 20-22: Section divider
- Lines 121-123: Section divider with changelog note
- Line 134: "Step 1: Get diff files"
- Line 144: "Step 2: Create batches and track results"
- Line 151: "Step 3: Process batches sequentially..."
- Line 173: "Step 4: Aggregate and complete"
- Lines 60-62: Redundant JSDoc on self-explanatory function

**Comments to keep:**
- Line 75: "handled below" (non-obvious callback structure)
- Lines 106-107: Logging explanation

**Acceptance Criteria:**
- [ ] No "WHAT" comments remain
- [ ] No section dividers remain
- [ ] WHY comments preserved
- [ ] Code remains understandable

---

### Task 6.2: Remove "WHAT" comments from chat.ts route

**Priority:** Low
**Agent:** experienced-engineer:code-quality-reviewer
**Estimated Scope:** 1 file

**Files:**
- apps/server/src/api/routes/chat.ts

**Comments to remove (5):**
- Line 25: "Load session"
- Line 32: "Add user message"
- Line 38: "Initialize AI client inline"
- Line 70: "Stream response"
- Line 81: "Save assistant message"

**Acceptance Criteria:**
- [ ] No obvious "WHAT" comments
- [ ] Security/WHY comments preserved

---

### Task 6.3: Remove "WHAT" comments from use-navigation.ts

**Priority:** Low
**Agent:** experienced-engineer:code-quality-reviewer
**Estimated Scope:** 1 file

**Files:**
- apps/cli/src/app/hooks/use-navigation.ts

**Comments to remove (10):**
- Line 110: "Main view: navigate to other views"
- Line 151: "Git status view: refresh or go back"
- Line 165: "Git diff view: refresh, toggle staged, or go back"
- Line 186: "Review view: refresh, toggle staged, or go back"
- Line 207: "Chat view: go back only"
- Line 218: "Settings view: redirect to onboarding if unconfigured"
- Line 225: "Review history view: discuss selected review"
- Line 239: "Handler map: view -> input handler"
- Line 261: "Global input handler: quit, passive views, or delegate"

**Comments to keep:**
- Line 70: PASSIVE_VIEWS explanation (domain-specific term)

**Acceptance Criteria:**
- [ ] Function names are self-documenting
- [ ] No redundant comments
- [ ] Domain-specific comments preserved

---

### Task 6.4: Remove TODO without ticket

**Priority:** Low
**Agent:** experienced-engineer:code-quality-reviewer
**Estimated Scope:** 1 file

**Files:**
- packages/core/src/ai/client.ts (line 13)

**Comment to remove:**
```typescript
// TODO: Add other providers here when needed
```

**Action:** Either create a ticket and reference it, or remove the comment (code structure is obvious).

**Acceptance Criteria:**
- [ ] No TODOs without ticket references

---

## Phase 7: Clean Up Tests

### Task 7.1: Remove framework behavior tests from persistence.test.ts

**Priority:** Low
**Agent:** unit-testing:test-automator
**Estimated Scope:** 1 file

**Files:**
- packages/core/src/storage/persistence.test.ts

**Tests to remove (~10):**
- Lines 58-74: "should create parent directory if missing" (tests mkdir)
- Lines 79-98: "should write data without runtime validation" (tests commented-out functionality)
- Lines 162-177: "should check document existence correctly" (trivial getter)
- Lines 387-405: "should create directory when calling ensureDir" (tests mkdir)
- Lines 407-423: "should succeed when directory already exists" (tests mkdir)
- Lines 678-697: "should successfully write atomically" (trivial)
- Lines 699-717: "should use atomic write with temp file" (duplicate)
- Lines 1052-1069: "should include helpful context in NOT_FOUND errors" (formatting only)
- Lines 1071-1089: "should include details in PARSE_ERROR" (formatting only)
- Lines 1117-1133: "should create proper store errors" (trivial factory)

**Tests to keep:**
- All validation cycle tests
- Metadata extraction tests (lines 426-566)
- Performance benchmark (lines 568-672)
- Permission error handling

**Acceptance Criteria:**
- [ ] No framework behavior tests
- [ ] No error message formatting tests
- [ ] Business logic tests preserved
- [ ] Tests pass

---

### Task 7.2: Remove TypeScript compile-time tests from config-union.test.ts

**Priority:** Low
**Agent:** unit-testing:test-automator
**Estimated Scope:** 1 file

**Files:**
- packages/schemas/src/config-union.test.ts

**Tests to remove (3):**
- Lines 57-82: "type narrowing" describe block (2 tests) - Tests TypeScript compiler behavior
- Lines 38-54: "strips extra config field" - Tests Zod's default behavior

**Tests to keep:**
- Lines 6-29: Valid states validation
- Lines 32-36: Configured: true without config rejection

**Acceptance Criteria:**
- [ ] No TypeScript-only tests
- [ ] Runtime validation tests preserved
- [ ] Tests pass

---

### Task 7.3: Remove constant validation duplicates from config.test.ts

**Priority:** Low
**Agent:** unit-testing:test-automator
**Estimated Scope:** 1 file

**Files:**
- packages/schemas/src/config.test.ts

**Tests to remove (4):**
- Lines 162-187: "GEMINI_MODEL_INFO constant validation"
- Lines 189-215: "AVAILABLE_PROVIDERS constant validation"
- Lines 104-113: "validates all GEMINI_MODEL_INFO entries" (duplicate)
- Lines 154-159: "validates all AVAILABLE_PROVIDERS entries" (duplicate)

**Acceptance Criteria:**
- [ ] No constant structure tests
- [ ] Schema validation tests preserved
- [ ] Tests pass

---

## Phase 8: Readability Improvements

### Task 8.1: Rename single-letter parameters

**Priority:** Medium
**Agent:** experienced-engineer:code-quality-reviewer
**Estimated Scope:** 4 files

**Files:**
- apps/cli/src/app/hooks/use-screen-handlers.ts (lines 67, 75, 87, 92): `s` → `session`, `r` → `review`
- apps/server/src/services/review.ts (line 15): `s` → `text`
- apps/server/src/lib/response.ts (lines 6, 13, 22, 30): `c` → `ctx`
- apps/server/src/services/review-aggregator.ts (lines 51-52): `i` → `issue`

**Acceptance Criteria:**
- [ ] No single-letter params (except loop variables)
- [ ] Clear, descriptive names
- [ ] TypeScript compiles

---

### Task 8.2: Extract magic numbers to constants

**Priority:** Medium
**Agent:** experienced-engineer:code-quality-reviewer
**Estimated Scope:** 3 files

**Files:**
- apps/cli/src/components/git-diff-display.tsx (lines 54, 57, 58): `50` → `MAX_DIFF_LINES_DISPLAY`
- apps/cli/src/hooks/use-scroll.ts (line 21): `24` → `DEFAULT_TERMINAL_HEIGHT`
- apps/server/src/services/review.ts (line 4): Add comment to `MAX_DIFF_SIZE_BYTES`

**Acceptance Criteria:**
- [ ] No magic numbers
- [ ] Constants have descriptive names
- [ ] Constants have explanatory comments

---

### Task 8.3: Centralize error codes

**Priority:** Low
**Agent:** javascript-typescript:typescript-pro
**Estimated Scope:** 3 files

**Files:**
- packages/schemas/src/errors.ts (extend)
- apps/server/src/api/routes/chat.ts
- apps/server/src/api/routes/review.ts

**Problem:**
Inconsistent error codes: "INTERNAL_ERROR", "AI_ERROR", "STREAM_ERROR", "NOT_FOUND" used inline.

**Action:**
1. Add common error codes to schemas/errors.ts
2. Import and use in routes

**Acceptance Criteria:**
- [ ] Single source of truth for error codes
- [ ] Consistent usage across routes

---

## Validation Phase

After all tasks complete, run validation:

```bash
# Type check
pnpm turbo type-check

# Run all tests
pnpm turbo test

# Verify no duplicate types remain
grep -r "export type.*=" packages/ apps/ | sort | uniq -d

# Verify no wrapper functions remain (manual review)

# Verify function lengths
# All functions should be <50 lines, ideally <20 lines
```

**Final Acceptance Criteria:**
- [ ] TypeScript compiles with no errors
- [ ] All tests pass
- [ ] No duplicate sanitization functions
- [ ] No empty catch blocks
- [ ] No God components (>100 lines)
- [ ] No WHAT comments (only WHY comments)
- [ ] No trivial/duplicate tests
- [ ] No magic numbers

---

## Agent Assignments Summary

| Agent | Task Count |
|-------|------------|
| pr-review-toolkit:silent-failure-hunter | 3 |
| javascript-typescript:typescript-pro | 10 |
| react-component-architect | 4 |
| code-review-ai:architect-review | 1 |
| backend-architect | 1 |
| experienced-engineer:code-quality-reviewer | 6 |
| unit-testing:test-automator | 3 |
| **Total** | **28 tasks** |
