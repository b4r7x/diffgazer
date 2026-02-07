# Package Test Audit

## Summary

11 files audited: **8 GOOD**, **2 NEEDS_FIX**, **1 OVERENGINEERED**, 0 should delete.

Overall quality is high. Most tests follow AAA pattern, test observable behavior, and cover meaningful edge cases. A few files have minor issues (over-granularity, missing edge cases).

## File-by-File Audit

### packages/core/src/streaming/sse-parser.test.ts
- **Rating**: OVERENGINEERED
- **Source file**: packages/core/src/streaming/sse-parser.ts (74 lines)
- **Test count**: 25
- **Issues found**:
  - 25 tests for 74 lines of source is excessive. ~3.5 test-to-source line ratio.
  - Edge case section tests things JSON.parse handles natively (nested objects, arrays, escaped quotes, unicode) -- these test JSON.parse, not the SSE parser.
  - "should handle CRLF line endings" and "mixed LF and CRLF" test split behavior that's standard string.split("\n") with leftover \r in data lines -- only one of these is needed.
  - "should pass raw data with identity parseEvent" duplicates the basic parsing test (line 26-35) with slightly different data.
- **What's good**: Core streaming logic is well-tested (split across chunks, partial lines, buffer overflow, custom parseEvent filtering). Mock reader is clean and minimal.
- **Recommended action**: Remove 5-6 tests that test JSON.parse behavior (nested objects, arrays, escaped quotes, unicode, one of the CRLF tests, identity parseEvent duplicate). Keep ~19 focused tests.

### packages/core/src/format.test.ts
- **Rating**: GOOD
- **Source file**: packages/core/src/format.ts (23 lines)
- **Test count**: 9
- **Issues found**:
  - None significant. Tests are proportional to source complexity.
- **What's good**: Tests both functions, covers boundaries (0ms, wrapping at 60min), both formats, string passthrough for formatTimestamp. Timezone-aware assertion for Date formatting (`toMatch` instead of exact match).
- **Recommended action**: Keep as is.

### packages/core/src/json.test.ts
- **Rating**: GOOD
- **Source file**: packages/core/src/json.ts (32 lines)
- **Test count**: 9
- **Issues found**:
  - None significant.
- **What's good**: Tests the markdown fence stripping (the main value-add over JSON.parse), error paths, edge cases (empty string, whitespace, arrays, primitives). Error factory pattern matches source interface. AAA pattern followed.
- **Recommended action**: Keep as is.

### packages/core/src/review/event-to-log.test.ts
- **Rating**: GOOD
- **Source file**: packages/core/src/review/event-to-log.ts (205 lines)
- **Test count**: 20
- **Issues found**:
  - Minor: "1 agents" in orchestrator_start test (line 121) appears to be a real bug in the source -- pluralize is not used for agent count in orchestrator_start message. The test asserts `toContain("1 agents")` which validates the buggy behavior.
- **What's good**: Excellent coverage of all event types in the switch/if chain. Tests observable output (tag, tagType, message content) not internals. Truncation behavior tested. Singular/plural tested for agent_complete. ID generation tested. Clean test data with minimal boilerplate.
- **Recommended action**: Keep as is. Consider filing bug for "1 agents" pluralization.

### packages/core/src/review/stream-review.test.ts
- **Rating**: GOOD
- **Source file**: packages/core/src/review/stream-review.ts (134 lines)
- **Test count**: 9
- **Issues found**:
  - Only tests `buildReviewQueryParams`, not `processReviewStream` (the more complex function). However, processReviewStream requires a full SSE reader mock and is integration-heavy, so this is acceptable for a unit test file.
- **What's good**: Covers all parameter combinations (mode default, files join, lenses join, profile, empty arrays, full params). Tests observable output shape. Clean and focused.
- **Recommended action**: Keep as is. processReviewStream coverage should come from integration tests or the API-level tests.

### packages/api/src/review.test.ts
- **Rating**: GOOD
- **Source file**: packages/api/src/review.ts (166 lines)
- **Test count**: 5
- **Issues found**:
  - Only tests `resumeReviewStream` error paths. Does not test happy path (returning reader for successful stream). However, happy path requires a real ReadableStream which is integration-level.
- **What's good**: Tests all error classification branches (404 -> SESSION_NOT_FOUND, 409 -> SESSION_STALE, 500 -> STREAM_ERROR, no body, non-Error thrown values). Result<T,E> pattern correctly tested. Mock client is minimal.
- **Recommended action**: Keep as is.

### packages/api/src/client.test.ts
- **Rating**: GOOD
- **Source file**: packages/api/src/client.ts (92 lines)
- **Test count**: 17
- **Issues found**:
  - Minor: Two error tests use try/catch pattern (lines 190-195, 199-205) instead of `expect().rejects` or checking error properties via a helper -- slightly inconsistent with the rest of the file that uses `expect().rejects.toThrow()`.
- **What's good**: Excellent boundary testing of the API client. Tests URL construction (trailing slash, leading slash normalization, query params), headers (Accept, Content-Type, custom headers, projectRoot), all HTTP methods, and comprehensive error handling (JSON error body, status codes, error codes, non-JSON response, network errors, invalid JSON response). Tests observable behavior (what fetch receives, what client returns).
- **Recommended action**: Keep as is. The try/catch inconsistency is minor and the tests are correct.

### packages/core/src/strings.test.ts
- **Rating**: GOOD
- **Source file**: packages/core/src/strings.ts (11 lines)
- **Test count**: 8
- **Issues found**:
  - Only tests `truncate`, not `capitalize`. capitalize is trivial (3 lines) so skipping it is fine per testing guidelines.
- **What's good**: Thorough edge case coverage for truncate: longer than max, shorter, equal, default suffix, custom suffix, maxLength < suffix length (0, 1, 2), maxLength == suffix length, empty string. Tests are proportional and all test real edge cases that could fail.
- **Recommended action**: Keep as is.

### packages/core/src/review/review-state.test.ts
- **Rating**: NEEDS_FIX
- **Source file**: packages/core/src/review/review-state.ts (266 lines)
- **Test count**: 26
- **Issues found**:
  - Test for `createInitialReviewState` "initializes all required fields" (lines 30-41) tests implementation details: checks `Array.isArray(state.steps)`, checks each field individually. This essentially re-implements the function. A single assertion against the expected shape would be cleaner, or just remove it since individual action tests implicitly verify initial state.
  - Some test data is very verbose due to agent metadata objects being repeated inline 15+ times. A helper like `makeAgentMeta("detective")` would reduce noise without being over-engineered.
  - "resets startedAt to null on START action" and "clears all state fields on START action" overlap -- both test START after review_started, and the second test already checks startedAt.
- **What's good**: Comprehensive reducer testing. Tests all event types flowing through the reducer. State transitions tested correctly (queued -> running -> complete/error). File progress with scope filtering tested. Tool call colon parsing tested. Multiple concurrent agents tested. COMPLETE preserves issues. ERROR sets error and stops streaming.
- **Recommended action**: Remove the redundant "initializes all required fields" test (keep just the startedAt null check). Extract a helper for repeated agent metadata. Remove the "resets startedAt" test since "clears all state fields" already covers it.

### packages/schemas/src/review/storage.test.ts
- **Rating**: GOOD
- **Source file**: packages/schemas/src/review/storage.ts (51 lines)
- **Test count**: 5
- **Issues found**:
  - None significant.
- **What's good**: Tests the schema's `.transform()` logic -- the actual business logic in the schema (backwards compat: mode from staged boolean, default severity counts). Doesn't test basic Zod parsing, focuses on the transform. Clean base data object avoids repetition.
- **Recommended action**: Keep as is.

### packages/schemas/src/config/providers.test.ts
- **Rating**: NEEDS_FIX
- **Source file**: packages/schemas/src/config/providers.ts (278 lines)
- **Test count**: 5
- **Issues found**:
  - Only tests the `.refine()` on UserConfigSchema (model/provider validation). This is good, but misses `zai-coding` provider which shares GLM models with `zai`. Should have a test confirming zai-coding accepts GLM models.
  - Test "rejects invalid model for gemini provider" uses `glm-4.7` which happens to be a valid model for another provider. While the test works, using a truly invalid model string like `"not-a-model"` would make the intent clearer.
- **What's good**: Tests the refine logic (the only non-trivial behavior). Covers gemini valid, gemini invalid, zai valid, openrouter any-model, and optional model. Clean base config object.
- **Recommended action**: Add a test for `zai-coding` provider accepting GLM models. Consider using an obviously invalid model string for the rejection test.

## Overall Patterns

### Strengths
1. **Testing observable behavior**: Almost all tests check outputs/return values, not internal state or call counts.
2. **AAA pattern**: Consistently followed across all files.
3. **Proportional coverage**: Test count is generally proportional to source complexity.
4. **Edge cases**: Good coverage of boundary conditions (empty inputs, 0 values, singular/plural).
5. **Result<T,E> testing**: Error paths consistently tested with `result.ok` checks.
6. **Minimal mocking**: Only fetch (in client.test.ts) and ReadableStream reader (in sse-parser.test.ts) are mocked -- both are true boundaries.

### Issues
1. **SSE parser over-testing**: The one clearly overengineered file tests JSON.parse behavior rather than parser behavior.
2. **Verbose agent metadata**: The review-state tests repeat full agent metadata objects ~15 times. A simple factory would improve readability.
3. **Missing `zai-coding` coverage**: The provider validation test misses the third provider that shares GLM models.
4. **No `processReviewStream` unit tests**: The most complex function in stream-review.ts is untested at the unit level (acceptable if covered by integration tests).
