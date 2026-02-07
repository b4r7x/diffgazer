# Server Test Audit

## Summary
29 files audited, 24 good, 3 need fixes, 2 overengineered, 0 should delete

Overall quality is high. Most tests follow AAA pattern, test observable behavior, mock at boundaries, and have clear naming. Issues found are minor.

## File-by-File Audit

### apps/server/src/app.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/app.ts
- **Test count**: 10
- **Issues found**: None
- **What's good**: Tests security-critical behavior (CORS, host validation, security headers) through Hono's test client. No mocking needed. Tests observable HTTP responses, not internals. Critical for CVE-2024-28224 defense.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/diff/parser.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/diff/parser.ts
- **Test count**: 21
- **Issues found**: None
- **What's good**: Comprehensive parser tests covering all diff operations (add, delete, modify, rename), edge cases (binary files, no newline marker, spaces in paths, nested paths), hunk parsing, and empty input. Pure function testing with no mocks needed. This is exactly the kind of code that benefits from thorough testing.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/validation.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/validation.ts
- **Test count**: 6
- **Issues found**: None
- **What's good**: Tests security-relevant path validation (traversal, null bytes). Simple, focused, pure function tests.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/ai/client.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/ai/client.ts
- **Test count**: 12
- **Issues found**:
  - Heavy mocking of internal modules (`../config/store.js`), but this is a boundary module that wraps external AI SDKs, so mocking is justified
- **What's good**: Tests error classification (quota, auth, rate limit, network), provider creation, and initialization flow. All assertions check Result<T,E> pattern correctly.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/review/prompts.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/review/prompts.ts
- **Test count**: 19
- **Issues found**: None
- **What's good**: Tests XML escaping (CVE-2025-53773 defense), prompt construction, security hardening inclusion, and drilldown prompt generation. Critical security tests. Helper factories (`makeDiff`, `makeLens`) are appropriately simple.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/review/orchestrate.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/review/orchestrate.ts
- **Test count**: 4
- **Issues found**: None
- **What's good**: Tests core orchestration behavior: empty diff handling, concurrency capping, partial failure (keeps good results + reports failed lenses), and abort signal. Mocks are at module boundaries (lenses.js, analysis.js). Event verification is thorough but tests observable output.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/review/issues.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/review/issues.ts
- **Test count**: 20
- **Issues found**: None
- **What's good**: Tests deduplication logic (composite key, severity priority, case-insensitive), sorting (severity > confidence > file), filtering by min severity, evidence enrichment from diff hunks, and issue completeness validation. Pure business logic, no mocking.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/review/analysis.test.ts
- **Rating**: NEEDS_FIX
- **Source file**: apps/server/src/shared/lib/review/analysis.ts
- **Test count**: 5
- **Issues found**:
  - Tests check event sequence too precisely (e.g., `eventTypes[0]` must be "agent_start", `eventTypes[1]` must be "agent_thinking"). This couples tests to exact ordering of internal implementation events, making refactoring hard.
  - `expect(eventTypes.filter((t) => t === "file_start")).toHaveLength(2)` is fine, but checking exact index positions is fragile.
- **What's good**: Tests real behaviors (error handling, abort signal, evidence enrichment, timer cleanup). The timer cleanup test is valuable.
- **Recommended action**: Change exact-index event checks to use `expect.arrayContaining` or `filter` + length checks instead of positional assertions. Keep the timer cleanup and error handling tests as is.

### apps/server/src/shared/lib/storage/persistence.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/storage/persistence.ts
- **Test count**: 16
- **Issues found**: None
- **What's good**: Tests the generic collection abstraction thoroughly: CRUD operations, error classification (ENOENT -> NOT_FOUND, EACCES -> PERMISSION_ERROR), corrupt JSON handling, non-UUID file filtering, metadata extraction. Mocks at fs boundary.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/storage/reviews.test.ts
- **Rating**: NEEDS_FIX
- **Source file**: apps/server/src/shared/lib/storage/reviews.ts
- **Test count**: 14
- **Issues found**:
  - Mocks the entire persistence layer (`createCollection`) which is an internal module, not a boundary. The reviews module builds on top of persistence, so ideally tests would use the real persistence with mocked fs. However, this is a pragmatic choice since persistence itself is tested separately.
  - `paths.js` is mocked with `vi.mock("../paths.js")` but no mock implementation is provided. This works only because the paths module is called at module load time and auto-mock provides undefined returns.
- **What's good**: Tests severity count calculation, date sorting, project path filtering, migration logic, drilldown add/replace. All use Result<T,E> pattern correctly.
- **Recommended action**: Add explicit mock implementation for paths.js or document why auto-mock is sufficient. Otherwise keep as is.

### apps/server/src/shared/lib/fs.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/fs.ts
- **Test count**: 10
- **Issues found**: None
- **What's good**: Tests atomic write pattern (write to temp + rename), cleanup on failure (both write and rename errors), file permissions (0o600), ENOENT handling, corrupt JSON recovery. Mocks at fs boundary.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/git/service.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/git/service.ts
- **Test count**: 14
- **Issues found**: None
- **What's good**: Tests git status parsing thoroughly: branch extraction, ahead/behind counts, remote tracking, all file statuses (staged, unstaged, untracked, added, deleted, conflicted), mixed status, empty output, git command failure. Mocks at child_process boundary.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/git/errors.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/git/errors.ts
- **Test count**: 9
- **Issues found**: None
- **What's good**: Tests error classification (not-a-repo, git-not-found, permission, timeout, buffer exceeded, unknown). Tests non-Error values and empty messages. Pure function testing.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/config/state.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/config/state.ts
- **Test count**: 15
- **Issues found**: None
- **What's good**: Tests config loading (defaults, merging, provider normalization, invalid provider filtering), secrets loading, trust loading with capability normalization, persistence with file permissions, and provider/secrets sync logic. Mocks at fs boundary.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/config/store.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/config/store.ts
- **Test count**: 18
- **Issues found**:
  - Uses `vi.resetModules()` + dynamic `import()` for each test because store.ts has module-level state. This is a necessary pattern for testing singleton modules, not over-engineering.
- **What's good**: Tests provider management (list, activate, credentials save/delete), settings, keyring integration, trust management (save, get, remove, list), and secrets migration (file -> keyring). Comprehensive coverage of the config store API.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/config/keyring.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/config/keyring.ts
- **Test count**: 5-7 (varies by environment)
- **Issues found**: None
- **What's good**: Adaptive testing - runs different test paths based on actual keyring availability. Tests real keyring integration when available, graceful degradation when not. Cleans up test keys.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/ai/openrouter-models.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/ai/openrouter-models.ts
- **Test count**: 10
- **Issues found**: None
- **What's good**: Tests cache loading/persisting, API fetch with model filtering, cache TTL behavior, fallback to cache on fetch failure, and error when both cache and fetch fail. Mocks at fs and fetch boundaries.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/paths.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/paths.ts
- **Test count**: 9
- **Issues found**: None
- **What's good**: Tests path resolution priority (header > env > cwd), git root discovery, security validation (rejects paths outside home without .git), whitespace handling. Tests `getGlobalStargazerDir` with env override.
- **Recommended action**: Keep as is

### apps/server/src/shared/lib/errors.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/shared/lib/errors.ts
- **Test count**: 5
- **Issues found**: None
- **What's good**: Tests the generic `classifyError` utility: pattern matching, fallback, case-insensitive matching, non-Error thrown values, original message preservation. Pure function, no mocking.
- **Recommended action**: Keep as is

### apps/server/src/features/config/service.test.ts
- **Rating**: OVERENGINEERED
- **Source file**: apps/server/src/features/config/service.ts
- **Test count**: 15
- **Issues found**:
  - Several tests are thin delegation checks. For example, `saveConfig` test just verifies `saveProviderCredentials` was called with the right args -- this tests glue code, not behavior.
  - `deleteProvider` test similarly just checks delegation.
  - `getSetupStatus` test is trivially simple (checks `hasProvider` is false when providers is empty).
  - These tests add maintenance burden without meaningful confidence since the underlying store is already well-tested.
- **What's good**: `checkConfig` tests are valuable (tests the composition of multiple store calls into a business result). `activateProvider` tests are good (tests validation logic like requiring model). `getOpenRouterModels` tests are good (tests error handling composition).
- **Recommended action**: Consider removing pure delegation tests (`saveConfig`, `deleteProvider`, `getSetupStatus`) that just verify pass-through calls. Keep `checkConfig`, `activateProvider`, `getOpenRouterModels`, `getProvidersStatus` tests.

### apps/server/src/features/git/service.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/features/git/service.ts
- **Test count**: 11
- **Issues found**: None
- **What's good**: Tests path traversal prevention thoroughly: `..` traversal, absolute paths, Windows paths, null bytes, backslashes, symlink escape, basePath realpath failure. Security-critical tests. Also tests valid paths and git-not-found.
- **Recommended action**: Keep as is

### apps/server/src/features/review/sessions.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/features/review/sessions.ts
- **Test count**: 17
- **Issues found**: None
- **What's good**: Tests in-memory session store: CRUD, state transitions (ready, complete), subscriber notification, unsubscribe, abort/cancel, session limits (eviction at max), async error handling in subscribers, timer-based cleanup, and active session lookup with matching criteria. Uses fake timers appropriately.
- **Recommended action**: Keep as is

### apps/server/src/features/review/pipeline.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/features/review/pipeline.ts
- **Test count**: 12
- **Issues found**: None
- **What's good**: Tests diff file filtering (with path normalization), executive summary generation (singular/plural, severity breakdown, orchestration summary), and report generation. Pure function tests.
- **Recommended action**: Keep as is

### apps/server/src/features/review/utils.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/features/review/utils.ts
- **Test count**: 14
- **Issues found**: None
- **What's good**: Tests reviewAbort factory, isReviewAbort type guard (positive + negative cases including null, undefined, wrong kind, missing fields), and summarizeOutput utility (strings, arrays, objects, null/undefined, truncation). Pure functions.
- **Recommended action**: Keep as is

### apps/server/src/features/review/service.test.ts
- **Rating**: OVERENGINEERED
- **Source file**: apps/server/src/features/review/service.ts
- **Test count**: 12
- **Issues found**:
  - Heavy mocking (4 module-level mocks: sessions, pipeline, git/service, utils). This creates a test that is tightly coupled to the service's internal structure.
  - The `streamActiveSessionToSSE` tests are partially testing orchestration between sessions and SSE stream, which is reasonable. But the `streamReviewToSSE` tests mock so many modules that they mainly test the wiring, not the behavior.
  - The `isAbortError` test at the end has a comment saying "isAbortError is not exported, but we can test it via handleReviewFailure behavior" -- this is fine, but the test is essentially a duplicate of the "should handle AbortError silently" test above, just with a regular Error.
- **What's good**: Error handling tests are valuable (AbortError, ReviewAbort, unexpected errors, SSE write failures). Session replay test is good.
- **Recommended action**: The mocking complexity is borderline justified since this is the main integration point. Consider:
  1. Remove the duplicate `isAbortError` describe block (line 341-370) -- it's redundant with the AbortError test above.
  2. Keep the error handling and session replay tests.

### apps/server/src/features/review/context.test.ts
- **Rating**: NEEDS_FIX
- **Source file**: apps/server/src/features/review/context.ts
- **Test count**: 13
- **Issues found**:
  - Mock setup is complex (6 modules mocked, multiple mock implementations per test). Tests are fragile because they depend on exact call order of readFile/readdir/readJsonFile mocks.
  - `mockResolvedValueOnce` chains are hard to read and understand. When mocking `readFile` with 3 sequential resolved values then a rejection, it's difficult to know which call corresponds to which operation.
  - The `buildFileTree` depth limit test (lines 276-324) navigates a chain of 6 nodes to verify depth limiting -- this is more of an integration test through the full stack and is somewhat fragile.
- **What's good**: Tests workspace package discovery, dependency edge collection, file tree exclusion patterns, symlink cycle prevention, and context caching/cache invalidation. These are important behaviors.
- **Recommended action**: Consider adding inline comments to mock chains to clarify which call maps to which operation (e.g., `// apps dir readdir`, `// packages dir readdir`). Some tests already have these comments -- apply consistently. The tests themselves test real behavior, so the core logic is sound.

### apps/server/src/features/review/drilldown.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/features/review/drilldown.ts (inferred)
- **Test count**: 7
- **Issues found**: None
- **What's good**: Tests drilldown at three levels: `drilldownIssue` (file lookup, event emission, missing file), `drilldownIssueById` (issue lookup, delegation), `handleDrilldownRequest` (full flow with storage + git + AI, storage failure). Mocks at appropriate boundaries (storage, git, AI).
- **Recommended action**: Keep as is

### apps/server/src/features/review/schemas.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/features/review/schemas.ts
- **Test count**: 8
- **Issues found**: None
- **What's good**: Tests a specific utility function `parseCsvParam` with good edge coverage (comma-separated, single value, empty, undefined, null, whitespace, empty items, all-empty). Pure function.
- **Recommended action**: Keep as is

### apps/server/src/features/review/enrichment.test.ts
- **Rating**: GOOD
- **Source file**: apps/server/src/features/review/enrichment.ts
- **Test count**: 5
- **Issues found**: None
- **What's good**: Tests enrichment with blame and context, progress event emission, skip logic for issues without line numbers, partial failure handling, and abort signal respect. Clean mocking of git service interface.
- **Recommended action**: Keep as is

## Overall Patterns

### What's working well
- **Result<T,E> pattern** is consistently tested with `expect(result.ok).toBe(true/false)` + narrowed property access. Very clean.
- **AAA pattern** is followed consistently across all files.
- **Mocking at boundaries**: Most tests mock at system boundaries (fs, child_process, fetch, AI SDKs). Internal module mocks are rare and justified.
- **Security tests**: CORS, host validation, path traversal, XML escaping, and prompt injection prevention are all well-covered.
- **Helper factories**: Simple `makeIssue()`, `makeDiff()`, `makeSession()` helpers keep tests readable without over-engineering.
- **No snapshot tests**: All assertions are specific and intentional.
- **Pure function focus**: Many test files test pure functions with no mocking needed.

### Areas for improvement
1. **Event sequence assertions**: `analysis.test.ts` tests exact event ordering by index, which is fragile. Use set-based or count-based assertions instead.
2. **Thin delegation tests**: `config/service.test.ts` has tests that only verify pass-through calls, adding maintenance cost without confidence.
3. **Mock chain readability**: `context.test.ts` has complex `mockResolvedValueOnce` chains that would benefit from inline comments mapping calls to operations.
4. **Duplicate test**: `service.test.ts` has a redundant `isAbortError` describe block that duplicates existing coverage.

### Statistics
- Total tests: ~286
- Rating breakdown: 24 GOOD, 3 NEEDS_FIX, 2 OVERENGINEERED, 0 DELETE
- Most common mock targets: node:fs/promises, node:child_process, node:fs (appropriate boundaries)
- Tests per file average: ~10
