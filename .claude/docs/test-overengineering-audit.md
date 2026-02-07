# Test Quality & Overengineering Audit

**Date:** 2026-02-07
**Files reviewed:** 53 test files
**Total tests:** ~450+ individual test cases

---

## Summary Statistics

| Category | Count | Severity |
|----------|-------|----------|
| Over-mocking (internal modules) | 6 files | HIGH |
| Testing constants/trivial code | 3 files | MEDIUM |
| Duplicate/redundant tests | 4 files | MEDIUM |
| Over-engineered factories | 2 files | LOW |
| Vague test names | 0 files | -- |
| Snapshot abuse | 0 files | -- |
| fireEvent vs userEvent | 0 files | -- |
| getByTestId overuse | 0 files | -- |

**Overall verdict:** The test suite is **generally well-written**. Most tests follow AAA pattern, use descriptive names, test observable behavior, and mock at boundaries. The main issue is over-mocking of internal modules in 6 server-side files and some duplicate/redundant coverage across files.

---

## HIGH Severity Issues

### 1. Over-mocking internal modules: `config/service.test.ts`

**File:** `apps/server/src/features/config/service.test.ts:1-285`

**Problem:** Mocks `../../shared/lib/config/store.js` and `../../shared/lib/ai/openrouter-models.js` -- these are internal modules, not boundaries. The guideline says "mock at boundaries only (fetch, fs, AI, keyring)". The store itself is tested separately; this service should ideally integrate through it.

**Mitigation:** This is a judgment call. The store has side effects (file I/O) so mocking it prevents filesystem access. This is *defensible* but creates coupling to the store's API shape. If the store were refactored to accept dependencies via DI, mocking would be unnecessary.

**Severity:** HIGH (per guidelines, but pragmatically acceptable since store does I/O)

### 2. Over-mocking internal modules: `reviews.test.ts`

**File:** `apps/server/src/shared/lib/storage/reviews.test.ts:1-375`

**Problem:** Mocks `./persistence.js` (an internal module) and `../paths.js`. The persistence module is the very abstraction being tested through. This means the test verifies that `reviews.ts` calls the right methods on `createCollection`, not that it actually works.

**Before (current):**
```typescript
vi.mock("./persistence.js", () => ({
  createCollection: vi.fn(() => ({
    read: mockCollectionRead,
    write: mockCollectionWrite,
    list: mockCollectionList,
    remove: mockCollectionRemove,
    ensureDir: mockCollectionEnsureDir,
  })),
}));
```

**Proposed fix:** Since `persistence.ts` already mocks `node:fs/promises` in its own tests, the reviews test could mock only `node:fs/promises` and `../fs.js` (the real boundaries) and let `createCollection` run with the mocked fs. This tests the actual integration.

**Severity:** HIGH

### 3. Over-mocking internal modules: `store.test.ts`

**File:** `apps/server/src/shared/lib/config/store.test.ts:1-399`

**Problem:** Mocks `../fs.js`, `../paths.js`, and `./keyring.js`. The `../fs.js` and `./keyring.js` mocks are legitimate boundary mocks (filesystem + OS keyring). However, `../paths.js` is a pure function module with no side effects -- it just joins strings. Mocking it adds unnecessary coupling.

**Before (current):**
```typescript
vi.mock("../paths.js", () => ({
  getGlobalConfigPath: () => "/mock/config.json",
  getGlobalSecretsPath: () => "/mock/secrets.json",
  // ...
}));
```

**Proposed fix:** Let `paths.js` run for real. Set `STARGAZER_HOME` env var to a temp directory, or mock only `os.homedir()` if needed.

**Severity:** HIGH

### 4. Over-mocking internal modules: `state.test.ts`

**File:** `apps/server/src/shared/lib/config/state.test.ts:1-275`

**Problem:** Same as store.test.ts -- mocks `../fs.js` (OK, boundary) and `../paths.js` (not OK, pure functions).

**Severity:** HIGH

### 5. Over-mocking internal modules: `openrouter-models.test.ts`

**File:** `apps/server/src/shared/lib/ai/openrouter-models.test.ts:1-240`

**Problem:** Mocks `../paths.js` and `../fs.js`. The `../fs.js` mock is OK (boundary). The `../paths.js` mock is unnecessary since it's pure string concatenation.

**Severity:** HIGH

### 6. Over-mocking internal modules: `client.test.ts` (AI)

**File:** `apps/server/src/shared/lib/ai/client.test.ts:1-280`

**Problem:** Mocks `ai`, `@ai-sdk/google`, `zhipu-ai-provider`, `@openrouter/ai-sdk-provider`, and `../config/store.js`. The AI SDK mocks are legitimate (external services). But mocking `../config/store.js` is an internal module mock. The `initializeAIClient` tests specifically test the integration between client and store, yet mock the store entirely.

**Mitigation:** The `createAIClient` tests are fine -- they test the function directly with explicit args. Only `initializeAIClient` tests have this issue.

**Severity:** HIGH (for `initializeAIClient` section only)

---

## MEDIUM Severity Issues

### 7. Testing a constant: `pipeline.test.ts:151-155`

**File:** `apps/server/src/features/review/pipeline.test.ts:151-155`

**Problem:** Tests a constant value.
```typescript
describe("MAX_DIFF_SIZE_BYTES", () => {
  it("should be 512KB", () => {
    expect(MAX_DIFF_SIZE_BYTES).toBe(524288);
  });
});
```

This tests nothing meaningful -- if someone changes the constant, they'd update the test too. Per guidelines: "Constants: `expect(API_URL).toBe('...')` tests nothing."

**Proposed fix:** Delete this test block.

**Severity:** MEDIUM

### 8. Testing Zod schema behavior: `use-review-settings.test.ts`

**File:** `apps/web/src/features/review/hooks/use-review-settings.test.ts:1-35`

**Problem:** Tests `LensIdSchema.safeParse()` directly -- this is testing Zod's validation behavior, not application code. The schema is defined in `@stargazer/schemas` and the test file is in the hooks directory.

```typescript
describe("LensId validation", () => {
  it("should accept valid lens IDs", () => {
    expect(LensIdSchema.safeParse("correctness").success).toBe(true);
  });
});
```

Per guidelines: "Third-party libraries: Their tests cover them" and "Skip: plain Zod."

**Proposed fix:** Delete. If the schema needs testing, test it in `packages/schemas/` as a schema test, not in a hooks test file.

**Severity:** MEDIUM

### 9. Duplicate test coverage: `use-review-stream.test.ts`

**File:** `apps/web/src/features/review/hooks/use-review-stream.test.ts:1-187`

**Problem:** This file retests `reviewReducer` from `@stargazer/core/review` which is already comprehensively tested in two files:
- `packages/core/src/review/review-state.test.ts` (285 lines, ~20 tests)
- `packages/core/src/review/review-state-gaps.test.ts` (538 lines, ~30 tests)

The web test file adds zero new coverage -- it tests the exact same reducer with the same event types. Comments in the file acknowledge this: "The webReviewReducer is not exported, so we test the core reviewReducer."

**Proposed fix:** Delete this file entirely. The reducer is already thoroughly tested in packages/core.

**Severity:** MEDIUM

### 10. Testing framework behavior: `providers.test.ts`

**File:** `packages/schemas/src/config/providers.test.ts:1-57`

**Problem:** Partially tests Zod's `refine` validation behavior. The `UserConfigSchema.safeParse` tests verify that Zod applies a refinement correctly. While the refine logic is custom, the tests are tightly coupled to Zod's `safeParse` API rather than testing a business function.

**Mitigation:** The refinement logic (model-provider validation) IS custom business logic worth testing. This is borderline acceptable.

**Severity:** MEDIUM (borderline)

### 11. Duplicate coverage across `review-state.test.ts` and `review-state-gaps.test.ts`

**File:** `packages/core/src/review/review-state.test.ts` and `packages/core/src/review/review-state-gaps.test.ts`

**Problem:** These two files test the same `reviewReducer` function with overlapping coverage. Some tests appear in both:
- START action resetting state
- RESET action resetting state
- review_started event setting startedAt
- agent events updating state

The "gaps" file was clearly written to fill missing coverage, but some tests duplicate the original file.

**Proposed fix:** Merge into a single `review-state.test.ts` file and remove duplicates.

**Severity:** MEDIUM

---

## LOW Severity Issues

### 12. Over-engineered factory: `reviews.test.ts`

**File:** `apps/server/src/shared/lib/storage/reviews.test.ts:27-96`

**Problem:** Three factory functions (`makeIssue`, `makeReviewOptions`, `makeSavedReview`) with override support. `makeSavedReview` builds a deeply nested object. While each factory is individually simple, together they create a test data hierarchy that's hard to follow.

**Mitigation:** The factories are used across 10+ tests in 5 describe blocks, so they're justified. This is within the guideline: "Complex factories are OK when: Test requires many variations."

**Severity:** LOW

### 13. Over-engineered factory: `issues.test.ts`

**File:** `apps/server/src/shared/lib/review/issues.test.ts:12-49`

**Problem:** Three factory functions (`makeIssue`, `makeDiff`, `makeFileDiff`). However, they're all used across multiple test blocks and are reasonably simple.

**Severity:** LOW (acceptable)

### 14. Slight redundancy in `getThinkingMessage` tests

**File:** `apps/server/src/features/review/utils.test.ts:24-60`

**Problem:** Tests each lens-specific message individually. While not wrong, the last test ("unknown lens returns generic message") is the only behavioral edge case. The rest are effectively testing a lookup table.

**Mitigation:** These tests serve as documentation of expected messages per lens. Acceptable.

**Severity:** LOW

---

## Well-Written Test Files (Positive Examples)

These files exemplify the project's testing guidelines and should be used as reference:

### `apps/server/src/shared/lib/diff/parser.test.ts`
- Excellent coverage of a critical parser
- Tests real git diff formats with inline test data
- No mocking needed (pure function)
- Clear AAA pattern, descriptive names
- Edge cases: binary files, rename, no newline at EOF, spaces in paths

### `apps/server/src/shared/lib/review/prompts.test.ts`
- Tests security-critical XML escaping behavior
- Tests through the public API (`buildReviewPrompt`) rather than internal `escapeXml`
- Comprehensive: injection attempts, unicode, empty strings, double escaping

### `apps/server/src/app.test.ts`
- Integration tests using Hono's built-in test client
- Tests real security behavior: CORS, host validation, security headers
- No mocking at all -- tests the actual middleware chain
- Tests CVE mitigations directly

### `apps/server/src/features/review/sessions.test.ts`
- Tests in-memory session management with real timers
- Proper cleanup in afterEach
- Tests limits, eviction, abort, async error handling
- Uses vi.useFakeTimers() correctly for time-dependent behavior

### `packages/core/src/streaming/sse-parser.test.ts`
- Comprehensive SSE parser testing with mock readers
- Tests chunking, buffer overflow, malformed input, unicode
- The `createMockReader` helper is well-designed and reusable

### `packages/api/src/client.test.ts`
- Tests the API client's fetch behavior thoroughly
- Mocks `fetch` (legitimate boundary mock)
- Clean helper functions (`lastCall`, `jsonResponse`, `errorResponse`)
- Tests URL construction, headers, all HTTP methods, error handling

### `apps/web/src/components/ui/menu/menu.test.tsx`
- Uses `userEvent` correctly (not `fireEvent`)
- Uses accessible queries (`getByRole`, `getByText`)
- Tests click handlers, disabled state, aria attributes
- Proper cleanup with `unmount()`

### `apps/web/src/components/ui/dialog/dialog-content.test.tsx`
- Tests accessibility: aria-modal, aria-labelledby, focus management
- Uses `userEvent` for interactions
- Tests both open and closed states
- Minimal setup with clear context provider wrapper

---

## Recommendations Summary

| Priority | Action | Files Affected |
|----------|--------|---------------|
| 1 | Delete constant test for `MAX_DIFF_SIZE_BYTES` | `pipeline.test.ts` |
| 2 | Delete `use-review-stream.test.ts` (duplicate of core tests) | `use-review-stream.test.ts` |
| 3 | Delete `use-review-settings.test.ts` (tests Zod, not app code) | `use-review-settings.test.ts` |
| 4 | Merge `review-state.test.ts` + `review-state-gaps.test.ts` | 2 files in packages/core |
| 5 | Stop mocking `paths.js` in store/state/openrouter tests | `store.test.ts`, `state.test.ts`, `openrouter-models.test.ts` |
| 6 | Consider integration approach for `reviews.test.ts` | `reviews.test.ts` |

### What NOT to change
- Factory functions in `issues.test.ts`, `reviews.test.ts` -- they're justified by usage
- `config/service.test.ts` store mocking -- pragmatically acceptable since store does I/O
- Schema tests in `packages/schemas/` -- they test custom refine/transform logic
- All web component tests -- they follow RTL best practices correctly
