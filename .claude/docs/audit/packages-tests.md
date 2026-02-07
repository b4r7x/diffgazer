# Packages Test Audit

**Date**: 2026-02-07
**Auditor**: Claude Opus 4.6
**Scope**: All test files in `packages/` (15 files)

## Summary

- **Total test files**: 15
- **Total tests**: ~155
- **Tests overengineered**: 2 (config.test.ts, get-figlet.test.ts)
- **Tests with quality issues**: 3 (format.test.ts, client.test.ts, config.test.ts)
- **Missing coverage gaps**: 4 (review-state.test.ts, stream-review.test.ts, providers.test.ts, review.test.ts)
- **Excellent**: 4 (sse-parser.test.ts, event-to-log.test.ts, json.test.ts, strings.test.ts)
- **Good**: 4 (filtering.test.ts, storage.test.ts, ui.test.ts, client.test.ts)

## Per-File Audit

---

### packages/core/src/format.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/core/src/format.ts` (23 lines)
**Verdict**: MINOR_ISSUE
**Test count**: 7 tests

#### Quality
- Good AAA pattern, descriptive names.
- Tests cover both `short` and `long` formats, zero input, padding.

#### Issues Found
- `formatTimestamp` test for string input is incomplete: the source has an `isNaN` guard (line 18) that returns the raw string when the date is invalid. This is tested indirectly by the "returns string timestamps unchanged" test, but that test passes a valid time string `"10:30:00"` which does NOT go through the `new Date()` path -- it goes through the `typeof === "string"` path where `new Date("10:30:00")` is actually valid. The `isNaN` guard path (invalid date string like `"not-a-date"`) is never tested.

#### Missing Coverage
- `formatTimestamp` with an invalid date string (e.g., `"not-a-date"`) -- should return it unchanged per the `isNaN` guard.
- `formatTimestamp` with a `Date` object -- the existing test only checks regex format, which is fine for timezone reasons, but could be more specific.
- Negative ms input for `formatTime` (edge case).

#### Overengineering
- None.

---

### packages/core/src/json.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/core/src/json.ts` (33 lines)
**Verdict**: OK
**Test count**: 9 tests

#### Quality
- Excellent coverage of the small source file.
- Tests both success and error paths of `safeParseJson`.
- Tests markdown stripping (`json` fence, plain fence, with whitespace).
- Tests edge cases: empty string, whitespace, arrays, primitives.
- Follows AAA pattern well. Good test names.

#### Issues Found
- None.

#### Missing Coverage
- The `error instanceof Error` guard on line 29 -- could test with a non-Error thrown from JSON.parse, but this is practically impossible since JSON.parse always throws SyntaxError. Skip.

#### Overengineering
- None. Every test covers a distinct branch or edge case.

---

### packages/core/src/strings.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/core/src/strings.ts` (11 lines)
**Verdict**: OK
**Test count**: 8 tests

#### Quality
- Thorough coverage of all `truncate` branches.
- Tests: longer than max, shorter, equal, default suffix, custom suffix, edge cases (maxLength < suffix, = suffix, 0), empty string.
- Good test names, clean AAA pattern.

#### Issues Found
- None.

#### Missing Coverage
- `capitalize` function (line 1-4) has zero tests. It's simple (2 lines) but has a branch: empty string returns early. Worth 2 quick tests.

#### Overengineering
- None.

---

### packages/core/src/streaming/sse-parser.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/core/src/streaming/sse-parser.ts` (75 lines)
**Verdict**: OK
**Test count**: 18 tests

#### Quality
- Excellent. Comprehensive coverage of all branches.
- Well-organized into describe blocks: basic parsing, malformed input, buffer overflow, custom parseEvent, edge cases.
- Tests: single event, multiple events, split chunks, partial lines, final buffer, comments, invalid JSON, empty data, overflow, CRLF, long lines.
- Good boundary test (just under 1MB vs just over 1MB).
- Tests custom parseEvent (transform, filter, error).

#### Issues Found
- None.

#### Missing Coverage
- None significant. All branches in source are covered.

#### Overengineering
- None.

---

### packages/core/src/review/event-to-log.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/core/src/review/event-to-log.ts` (206 lines)
**Verdict**: OK
**Test count**: 19 tests

#### Quality
- Excellent coverage. Tests all 17+ event types.
- Good structural organization: step events, enrich events, agent events.
- Tests edge cases: singular/plural ("1 file" vs "5 files", "1 issue" vs "3 issues"), thought truncation, unique ID generation, null filtering + order preservation.
- Clean AAA pattern throughout.

#### Issues Found
- Minor: The `orchestrator_start` test asserts `"1 agents"` (line 120) -- this is actually a bug in the source (should be "1 agent"), but the test is correctly testing the actual behavior. Not a test issue.
- `tool_start` and `tool_end` event types are handled identically to `tool_call` and `tool_result` respectively (lines 153-177 in source) but are not tested separately. Minor gap, low risk.

#### Missing Coverage
- `tool_start` event (alias for `tool_call` branch in source).
- `tool_end` event (alias for `tool_result` branch in source).
- The `default` exhaustive check path (returns null) -- tested indirectly via "filters null entries" test, but never directly.

#### Overengineering
- None.

---

### packages/core/src/review/stream-review.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/core/src/review/stream-review.ts` (135 lines)
**Verdict**: MISSING_COVERAGE
**Test count**: 10 tests

#### Quality
- Tests for `buildReviewQueryParams` are thorough and well-structured.
- Clean AAA pattern, good test names.

#### Issues Found
- None in existing tests.

#### Missing Coverage
- **`processReviewStream` (lines 50-134) has ZERO tests.** This is the core function that:
  - Routes SSE events to callbacks (`onAgentEvent`, `onStepEvent`, `onEnrichEvent`, `onChunk`, `onLensStart`, `onLensComplete`)
  - Accumulates agent events
  - Extracts `reviewResult` and `reviewId` from `complete` event
  - Handles `error` event
  - Returns `STREAM_ERROR` when stream ends without complete event
  - Returns success with `StreamReviewResult`

  This is complex logic (85 lines, ~10 branches) that deserves at least 5-8 tests:
  - Happy path: complete event yields ok result
  - Error event yields err result
  - Missing complete event yields STREAM_ERROR
  - Agent events are collected
  - Step events forwarded to onStepEvent
  - review_started sets reviewId
  - Enrich events forwarded
  - Chunk/lens events forwarded

#### Overengineering
- None.

---

### packages/core/src/review/review-state.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/core/src/review/review-state.ts` (267 lines)
**Verdict**: NEEDS_FIX (was ~20% covered, now ~70%)
**Test count**: 26 tests

#### Quality
- Significant improvement from the previous audit's ~20% estimate.
- Good organization by action type and event type.
- Tests all major actions: START, RESET, COMPLETE, ERROR.
- Tests agent lifecycle: queued, start, thinking, progress, tool_call, tool_result, error, complete.
- Tests file progress: file_start (orchestrator vs agent scope), file_complete, readFileContext colon parsing.
- Tests step events: step_start, step_complete, step_error.
- Tests enrich_progress, orchestrator_complete, issue_found, multiple concurrent agents.

#### Issues Found
- None in existing tests. All assertions are correct.

#### Missing Coverage
- **`tool_start` event** (line 103 in source -- handled same as `tool_call`): not tested.
- **`tool_end` event** (line 108 -- handled same as `tool_result`): not tested.
- **`agent_progress` without message** (line 99 -- `event.message ?? a.currentAction`): only tested with message present. Should test without message to verify fallback.
- **`tool_result` with empty/undefined summary** (line 110 -- `event.summary || undefined`): not tested. What happens when summary is empty string?
- **`file_complete` deduplication** (line 196 -- `completed.includes(event.file)` guard): not tested. What happens when same file completes twice?
- **`orchestrator_complete` without `filesAnalyzed`** (line 236 -- `event.filesAnalyzed` is truthy-checked): not tested. If filesAnalyzed is 0, the condition is falsy and the branch is skipped. This might be a bug in source.
- **`readFileContext` with `tool_start` event type** (line 217 -- `event.type === "tool_start"`): not tested.
- **Default exhaustive check** in reviewReducer (line 261): not tested (and shouldn't be -- it's unreachable by design).

#### Overengineering
- None.

---

### packages/core/src/review/filtering.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/core/src/review/filtering.ts` (14 lines)
**Verdict**: OK
**Test count**: 4 tests

#### Quality
- Thorough for such a simple function.
- Tests: "all" filter, specific severities, no matches, empty input.
- Clean AAA pattern.

#### Issues Found
- None.

#### Missing Coverage
- None. All branches covered.

#### Overengineering
- Borderline -- this is a 4-line function (minus the "all" check, it's `array.filter`). But the tests are quick and serve as documentation. Acceptable.

---

### packages/api/src/client.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/api/src/client.ts` (93 lines)
**Verdict**: GOOD (minor issues)
**Test count**: 17 tests

#### Quality
- Well-organized into URL construction, headers, HTTP methods, error handling.
- Good use of helpers (`lastCall()`, `jsonResponse()`, `errorResponse()`).
- Tests all HTTP methods (GET, POST, PUT, DELETE).
- Tests URL normalization (trailing slash, missing leading slash, query params).
- Tests header behavior (Accept, Content-Type, projectRoot, custom headers).
- Tests error handling: body with message, status code, error code, non-JSON body, network error, invalid JSON response.

#### Issues Found
- **"throws ApiError with status code" test (line 190-195)**: Uses try/catch without a fail assertion if no error is thrown. If `client.get` succeeds unexpectedly, the test silently passes. Should use `expect(...).rejects.toThrow()` or add `expect.assertions(1)`.
- **"throws ApiError with error code from body" test (line 197-207)**: Same issue -- no fail guard.
- **`stream` method** (line 89 in source): Not tested at all. It calls `send("GET", ...)` and returns the raw Response. Should have at least one test.
- **`request` method** (line 90 in source): Not tested. It's the raw `send` function exposed. Low priority.

#### Missing Coverage
- `stream` method (returns raw Response, not parsed JSON).
- `request` method (raw send).
- POST/PUT without body (body is `undefined`).
- Query params with special characters (URL encoding).

#### Overengineering
- None.

---

### packages/api/src/review.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/api/src/review.ts` (167 lines)
**Verdict**: MISSING_COVERAGE
**Test count**: 5 tests

#### Quality
- Tests for `resumeReviewStream` error handling are good: 404, 409, 500, no body, non-Error thrown.
- Correct use of Result pattern assertions.
- Properly mocks at boundary (ApiClient).

#### Issues Found
- None in existing tests.

#### Missing Coverage
- **`resumeReviewStream` happy path**: No test for successful stream processing. Should test when `client.stream` returns a Response with a body that produces a successful `processReviewStream` result.
- **`streamReview` function** (lines 32-43): Zero tests. Simple function but constructs params and calls `client.stream`.
- **`streamReviewWithEvents` function** (lines 45-61): Zero tests. This is the main review streaming function that:
  - Builds query params
  - Calls `client.stream`
  - Checks for reader
  - Calls `processReviewStream`
- **`getReviews`, `getReview`, `getReviewContext`, `refreshReviewContext`, `deleteReview`, `runReviewDrilldown`** (lines 110-153): Zero tests. These are all thin wrappers over `client.get`/`client.post`/`client.delete`. Low priority -- they're trivial delegations.
- **`bindReview`** (line 155): Not tested. Barrel binding function. Skip.

#### Overengineering
- None.

---

### packages/api/src/config.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/api/src/config.ts` (116 lines)
**Verdict**: OVERENGINEERED
**Test count**: 4 tests

#### Quality
- Tests verify correct URL paths and parameter passing.
- Clean AAA pattern.

#### Issues Found
- **These tests are testing trivial delegation.** Every function in `config.ts` is a 1-3 line wrapper that calls `client.get`, `client.post`, or `client.delete` with a hardcoded path. There is zero business logic. The tests are essentially asserting that string literals match string literals.
- Example: `getProviderStatus` just calls `client.get("/api/config/providers")` and returns `.providers`. Testing this verifies... nothing useful. The real behavior is in `client.ts` (already tested).
- `deleteTrust` (line 90-96) has the most logic: it constructs a URL with `URLSearchParams`. This is the only function worth testing, and it's NOT tested.

#### Missing Coverage
- `deleteTrust` -- the only function with real logic (URLSearchParams construction). This one IS worth testing.

#### Overengineering
- All 4 existing tests test trivial delegation with no business logic. They should be removed or replaced with the one `deleteTrust` test that matters.

---

### packages/schemas/src/review/storage.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/schemas/src/review/storage.ts` (52 lines)
**Verdict**: OK
**Test count**: 5 tests

#### Quality
- Tests the custom `.transform()` on `ReviewMetadataSchema` -- this is exactly what should be tested per guidelines.
- Tests backwards-compat migration: `mode` present, `staged=true`, `staged=false`, both missing.
- Tests default counts for severity fields.
- Clean AAA pattern.

#### Issues Found
- None.

#### Missing Coverage
- `mode` provided AND `staged` provided (priority test -- `mode` should win). Minor gap.
- Invalid input (e.g., `mode: "invalid"`) should fail validation. Low priority since it's just Zod enum validation.

#### Overengineering
- None. Tests target the custom transform logic, not plain Zod schema structure.

---

### packages/schemas/src/config/providers.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/schemas/src/config/providers.ts` (279 lines)
**Verdict**: MISSING_COVERAGE
**Test count**: 6 tests

#### Quality
- Tests the custom `.refine()` on `UserConfigSchema` -- correct per guidelines.
- Tests valid/invalid model for gemini, valid for zai/zai-coding, openrouter (accepts any), no model.
- Clean and focused.

#### Issues Found
- None in existing tests.

#### Missing Coverage
- **Reject GLM model for gemini provider**: Not tested (e.g., `model: "glm-4.7"` with `provider: "gemini"`). Actually this IS tested -- "rejects invalid model for gemini provider" uses `"glm-4.7"`. OK.
- **Reject gemini model for zai provider**: Not tested (e.g., `model: "gemini-2.5-flash"` with `provider: "zai"`).
- **Empty string model**: Not tested. `model: ""` -- is it treated as "no model" or validated? The schema has `z.string().optional()` so `""` is a valid string that would be checked against the provider. Should fail for gemini.
- **`isValidModelForProvider` default case** (line 166 -- `return false`): unreachable due to Zod enum validation, so skip.

#### Overengineering
- None.

---

### packages/schemas/src/ui/ui.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/schemas/src/ui/ui.ts` (256 lines)
**Verdict**: OK
**Test count**: 6 tests

#### Quality
- Tests the two exported functions: `severityRank` and `calculateSeverityCounts`.
- Tests rank ordering (relative comparison -- good approach).
- Tests specific rank value for blocker.
- Tests count calculation with mixed severities, empty input, single severity.
- Clean AAA pattern.

#### Issues Found
- None.

#### Missing Coverage
- None significant. The rest of `ui.ts` is constants and Zod schemas (should not be tested per guidelines).

#### Overengineering
- None.

---

### packages/hooks/src/get-figlet.test.ts

**Source**: `/home/b4r7/Projects/stargazer/packages/hooks/src/get-figlet.ts` (27 lines)
**Verdict**: OVERENGINEERED
**Test count**: 4 tests

#### Quality
- Tests: renders text with uppercase, specified font, error returns null, font caching.

#### Issues Found
- **Heavy mocking of a trivial wrapper.** `getFigletText` is a 10-line function that wraps `figlet.textSync` with font loading. The test mocks both `figlet` and two font imports, then asserts that the mock was called correctly. This is testing implementation details, not behavior.
- **"loads font only once per font type" test (line 44-51)**: The test comment itself acknowledges it's flaky due to module-level caching across tests. It asserts `textSync` was called twice, which proves nothing about font caching -- it proves the function was called twice.
- The source is too trivial to justify this test complexity. It wraps a third-party library with caching. The only meaningful test is "returns null on error."

#### Missing Coverage
- N/A -- the function is too simple.

#### Overengineering
- All 4 tests. This file should either:
  - Be deleted entirely (function is trivial wrapper per guidelines: "Skip: trivial code, third-party library wrappers")
  - Or kept with just the "returns null on error" test (only test with non-trivial assertion)

---

## Action Items

### P0: Fix Missing Coverage (high-value gaps)

1. **`packages/core/src/review/stream-review.test.ts`** -- Add 5-8 tests for `processReviewStream`:
   - Happy path (complete event -> ok result)
   - Error event -> err result
   - Stream ends without complete -> STREAM_ERROR
   - Agent events collected in array
   - Callbacks invoked for step/enrich/chunk/lens events
   - reviewId set from review_started and complete events

2. **`packages/core/src/review/review-state.test.ts`** -- Add ~5 tests for remaining gaps:
   - `agent_progress` without message (fallback to current action)
   - `tool_result` with empty summary
   - `file_complete` deduplication (same file twice)
   - `orchestrator_complete` with `filesAnalyzed: 0` (falsy -- branch skipped)
   - `tool_start`/`tool_end` aliases (quick tests)

3. **`packages/api/src/review.test.ts`** -- Add happy path test for `resumeReviewStream` (successful stream).

### P1: Fix Quality Issues

4. **`packages/api/src/client.test.ts`** -- Fix 2 tests that use try/catch without fail guards:
   - "throws ApiError with status code" -- use `expect.assertions(1)` or `rejects.toThrow`
   - "throws ApiError with error code from body" -- same fix
   - Add test for `stream` method

5. **`packages/core/src/format.test.ts`** -- Add test for `formatTimestamp` with invalid date string.

6. **`packages/core/src/strings.test.ts`** -- Add 2 tests for `capitalize` function.

### P2: Remove Overengineering

7. **`packages/hooks/src/get-figlet.test.ts`** -- Delete or reduce to single "returns null on error" test. Current tests mock everything and test implementation details of a trivial wrapper.

8. **`packages/api/src/config.test.ts`** -- Delete 3 of 4 tests (trivial delegation). Add 1 test for `deleteTrust` (only function with real logic: URLSearchParams construction). Consider deleting the file entirely -- these functions have no business logic.

### P3: Nice-to-Have

9. **`packages/schemas/src/config/providers.test.ts`** -- Add test for cross-provider model rejection (gemini model on zai provider) and empty string model.

10. **`packages/schemas/src/review/storage.test.ts`** -- Add test for `mode` + `staged` both present (priority: `mode` wins).

---

## Verdict Summary Table

| File | Verdict | Tests | Key Finding |
|------|---------|-------|-------------|
| `core/format.test.ts` | MINOR_ISSUE | 7 | Missing invalid date test |
| `core/json.test.ts` | OK | 9 | Excellent |
| `core/strings.test.ts` | OK | 8 | Missing `capitalize` tests |
| `core/streaming/sse-parser.test.ts` | OK | 18 | Excellent, comprehensive |
| `core/review/event-to-log.test.ts` | OK | 19 | Excellent, all event types |
| `core/review/stream-review.test.ts` | MISSING_COVERAGE | 10 | `processReviewStream` untested |
| `core/review/review-state.test.ts` | NEEDS_FIX | 26 | ~70% covered, ~5 gaps remain |
| `core/review/filtering.test.ts` | OK | 4 | Complete for simple source |
| `api/client.test.ts` | GOOD | 17 | 2 flaky assertions, missing `stream` test |
| `api/review.test.ts` | MISSING_COVERAGE | 5 | No happy path, no `streamReview*` tests |
| `api/config.test.ts` | OVERENGINEERED | 4 | Tests trivial delegation |
| `schemas/review/storage.test.ts` | OK | 5 | Good transform tests |
| `schemas/config/providers.test.ts` | GOOD | 6 | Minor cross-provider gap |
| `schemas/ui/ui.test.ts` | OK | 6 | Good function tests |
| `hooks/get-figlet.test.ts` | OVERENGINEERED | 4 | Trivial wrapper, heavy mocking |
