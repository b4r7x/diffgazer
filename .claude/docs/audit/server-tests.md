# Server Test Audit

## Summary
- Total test files: 31
- Tests overengineered: 0
- Tests with quality issues: 3 (keyring.test.ts, config/service.test.ts, review/schemas.test.ts)
- Missing coverage gaps: 8 (listed below)
- Overall verdict: **GOOD** -- tests are well-structured, follow AAA, mock at boundaries, and cover meaningful behavior. A few minor gaps remain.

## Per-File Audit

---

### app.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/app.ts`
**Verdict**: OK
**Test count**: 10 tests

#### Issues Found
- None significant. Tests correctly use Hono's `app.request()` for integration-style testing.

#### Missing Coverage
- `isLocalhostOrigin` catch branch (malformed URL passed as origin) -- edge case, low priority.
- `onError` handler (unhandled error produces 500) -- only 404 handler tested, not the 500 error handler. Consider adding one test that triggers an unhandled throw.

#### Overengineering
- None. These are security-critical tests and all are justified.

---

### shared/lib/review/issues.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/review/issues.ts`
**Verdict**: OK
**Test count**: 19 tests

#### Issues Found
- None. Good use of `makeIssue` factory, tests observable behavior.

#### Missing Coverage
- `ensureIssueEvidence`: no test for when `extractEvidenceFromDiff` returns an empty excerpt and falls back to the first 5 lines of hunk content (line 68: `excerpt || lines.slice(0, 5).join("\n")`).
- `deduplicateIssues`: title prefix truncation at 50 chars is not explicitly tested (only tested via identical titles).

#### Overengineering
- None.

---

### features/review/schemas.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/features/review/schemas.ts`
**Verdict**: OK
**Test count**: 8 tests

#### Issues Found
- None.

#### Missing Coverage
- `MAX_CSV_ITEMS` (1000) truncation is not tested. A test with >1000 items would verify the `.slice(0, MAX_CSV_ITEMS)` behavior.
- Zod schemas (`ReviewIdParamSchema`, `DrilldownRequestSchema`, etc.) are NOT tested -- but per guidelines, plain Zod schema validation should be skipped. Correct.

#### Overengineering
- None.

---

### shared/lib/validation.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/validation.ts`
**Verdict**: OK
**Test count**: 6 tests

#### Issues Found
- None. Tests cover path traversal and null byte injection. Security-relevant.

#### Missing Coverage
- None. The source is 6 lines; coverage is complete.

#### Overengineering
- None.

---

### shared/lib/diff/parser.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/diff/parser.ts`
**Verdict**: OK
**Test count**: 20 tests

#### Issues Found
- None. Excellent coverage of a complex regex state machine parser.

#### Missing Coverage
- Copy operation detection (git copy headers) -- but source doesn't handle copy, so this is N/A.
- `classifyDiffLine` is indirectly tested through `parseDiff`; no direct unit test, but that's fine.

#### Overengineering
- None. A parser deserves thorough tests.

---

### features/review/enrichment.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/features/review/enrichment.ts`
**Verdict**: OK
**Test count**: 6 tests

#### Issues Found
- None. Correctly mocks the `EnrichGitService` interface (boundary mock).

#### Missing Coverage
- Mid-abort scenario: test verifies pre-aborted signal returns original issues, but does not test abort DURING iteration (signal aborted between issue 1 and issue 2). The source has `if (signal?.aborted)` check inside the loop.
- `getFileLines` failure (rejected promise) -- only `getBlame` failure is tested. `getFileLines` failure would be caught by the outer try/catch in `enrichIssue`, but the specific context path isn't verified.

#### Overengineering
- None.

---

### shared/lib/ai/client.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/ai/client.ts`
**Verdict**: OK
**Test count**: 13 tests

#### Issues Found
- Heavy mocking of AI SDK modules (ai, @ai-sdk/google, zhipu-ai-provider, @openrouter/ai-sdk-provider). This is acceptable since these are external boundaries.

#### Missing Coverage
- `generateStream` method is not tested at all. The streaming path with `streamText`, chunk accumulation, `onChunk`, `onComplete`, `onError` callbacks, truncation detection -- none of this is verified.
- Timeout/AbortSignal handling in `generate` is not tested.

#### Overengineering
- None.

---

### shared/lib/review/prompts.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/review/prompts.ts`
**Verdict**: OK
**Test count**: 18 tests

#### Issues Found
- None. Security-critical XML escaping is thoroughly tested. Excellent.

#### Missing Coverage
- `buildDrilldownPrompt` with `targetFile` not found (line 246: `fileDiff = "File diff not available"`) -- partially covered via "File diff not available" path but could be more explicit.
- `buildReviewPrompt` with rename operation showing `previousPath` info -- not tested.

#### Overengineering
- None. Prompt injection defense deserves extensive testing.

---

### features/git/service.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/features/git/service.ts`
**Verdict**: OK
**Test count**: 10 tests

#### Issues Found
- None. Security-critical path traversal prevention is thoroughly tested.

#### Missing Coverage
- None significant. All path validation branches covered.

#### Overengineering
- None.

---

### shared/lib/git/service.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/git/service.ts`
**Verdict**: MISSING_COVERAGE
**Test count**: 15 tests

#### Issues Found
- None. Good boundary mocking of `child_process`.

#### Missing Coverage
- `getDiff` is not tested at all. Both "staged" and "unstaged" modes, plus the maxBuffer option.
- `getBlame` is not tested. The porcelain output parsing (author, email, commit, date, summary extraction) is complex logic.
- `getFileLines` is not tested. Line slicing logic (`slice(startLine - 1, endLine)`) could have off-by-one errors.
- `getHeadCommit` is not tested. Both success and error paths.
- `getStatusHash` is not tested. Hash computation and empty output handling.

These are significant gaps -- `getBlame` and `getDiff` contain real parsing logic.

#### Overengineering
- None.

---

### shared/lib/fs.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/fs.ts`
**Verdict**: MISSING_COVERAGE
**Test count**: 10 tests

#### Issues Found
- None.

#### Missing Coverage
- `readJsonFile` (async version) is not tested. Different from `readJsonFileSync` -- it swallows non-ENOENT errors silently (returns null without logging).
- `writeJsonFile` (async version) is not tested. Has its own cleanup logic.
- `isNodeError` utility function is not directly tested (tested indirectly).

#### Overengineering
- None.

---

### features/review/sessions.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/features/review/sessions.ts`
**Verdict**: OK
**Test count**: 18 tests

#### Issues Found
- None. Good use of fake timers for timeout/cleanup testing.

#### Missing Coverage
- `cleanupStaleSessions` (30-minute timeout) is not directly tested. The interval-based cleanup could be verified with fake timers.
- `deleteSession` is tested only as cleanup in `afterEach`, not as a first-class operation with assertions.

#### Overengineering
- None.

---

### shared/lib/review/orchestrate.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/review/orchestrate.ts`
**Verdict**: MISSING_COVERAGE
**Test count**: 3 tests

#### Issues Found
- Mocks `lenses.js` and `analysis.js` -- acceptable since those are tested separately.

#### Missing Coverage
- `runWithConcurrency` helper is only indirectly tested. Edge cases:
  - Concurrency limit of 1 (serial execution) with multiple items
  - All lenses failing without `partialOnAllFailed` (should return err)
  - `validateIssueCompleteness` filtering out incomplete issues from results
- Event emission verification is minimal -- only `orchestrator_start` and `agent_queued` checked, not `orchestrator_complete`.
- Deduplication and sorting of issues from multiple lenses is not tested through orchestrate (tested in issues.test.ts directly).

#### Overengineering
- None.

---

### shared/lib/storage/persistence.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/storage/persistence.ts`
**Verdict**: OK
**Test count**: 15 tests

#### Issues Found
- None. Comprehensive CRUD testing with proper error code assertions.

#### Missing Coverage
- `safeReadFile` with generic (non-ENOENT, non-EACCES) error returns `PARSE_ERROR` -- not explicitly tested but would be covered by adding a test with an `EMFILE` error.
- `safeAtomicWrite` with EACCES error returns `PERMISSION_ERROR` -- not tested (only mkdir EACCES is tested).

#### Overengineering
- None.

---

### features/review/pipeline.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/features/review/pipeline.ts`
**Verdict**: MISSING_COVERAGE
**Test count**: 12 tests

#### Issues Found
- None. Good pure function testing.

#### Missing Coverage
- `resolveGitDiff` is not tested. Complex flow: getDiff call, empty diff check (staged vs unstaged error messages), parseDiff, file filtering, size limit check (MAX_DIFF_SIZE_BYTES). This is significant business logic.
- `resolveReviewConfig` is not tested. Profile loading, settings lookup, lens validation.
- `executeReview` is not tested. Orchestration delegation, error handling.
- `finalizeReview` is not tested. Enrichment, report generation, save, signal abort check.

These are tested indirectly via `service.test.ts` integration but not unit tested. The `filterDiffByFiles`, `generateExecutiveSummary`, and `generateReport` pure functions ARE well tested.

#### Overengineering
- None.

---

### shared/lib/errors.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/errors.ts`
**Verdict**: OK
**Test count**: 5 tests

#### Issues Found
- None. Clean, focused tests.

#### Missing Coverage
- None. All branches covered (first match, fallback, case-insensitive, non-Error values).

#### Overengineering
- None.

---

### features/review/drilldown.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/features/review/drilldown.ts`
**Verdict**: OK
**Test count**: 7 tests

#### Issues Found
- Mocks internal modules (storage, git, parser, prompts) -- acceptable as these are separate feature boundaries.

#### Missing Coverage
- `drilldownIssue` with AI client error (generate returns err) -- not tested at this level (tested in the mock client factory default).
- `handleDrilldownRequest` when `getDiff` throws -- returns COMMAND_FAILED error, tested but the specific error code assertion is missing.
- `handleDrilldownRequest` when `addDrilldownToReview` fails -- not tested (write failure after successful drilldown).

#### Overengineering
- None.

---

### features/review/utils.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/features/review/utils.ts`
**Verdict**: OK
**Test count**: 13 tests

#### Issues Found
- None.

#### Missing Coverage
- `recordTrace` is not tested. It's a utility that wraps function calls with trace metadata.
- `parseProjectPath` is not tested (requires Hono context mock).
- `errorCodeToStatus` is not tested.
- `handleStoreError` is not tested.

These are thin wrappers and mostly framework glue, so low priority.

#### Overengineering
- None.

---

### shared/lib/config/state.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/config/state.ts`
**Verdict**: OK
**Test count**: 14 tests

#### Issues Found
- None. Good use of env var override for `STARGAZER_HOME`.

#### Missing Coverage
- `persistTrust` / `persistTrustAsync` not tested (tested indirectly via store.test.ts).
- `persistConfigAsync` not tested directly.
- Lazy path caching (`_configPath`, `_secretsPath`, `_trustPath`) not tested -- but this is implementation detail, skip.

#### Overengineering
- None.

---

### shared/lib/config/store.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/config/store.ts`
**Verdict**: OK
**Test count**: 19 tests

#### Issues Found
- Uses `vi.resetModules()` + dynamic `import()` to get fresh singleton each test -- correct pattern for module-level singletons.

#### Missing Coverage
- `deleteProviderCredentials` with keyring storage -- only file storage tested.
- `migrateSecretsStorage` keyring-to-file path -- only file-to-keyring tested.
- `getProjectInfo` -- not tested (depends on `resolveProjectRoot` and `readOrCreateProjectFile`).
- `setActiveProvider` with `preserveModel` flag -- only tested implicitly.

#### Overengineering
- None.

---

### shared/lib/ai/openrouter-models.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/ai/openrouter-models.ts`
**Verdict**: OK
**Test count**: 10 tests

#### Issues Found
- Uses `vi.spyOn(globalThis, "fetch")` -- correct boundary mock for HTTP.

#### Missing Coverage
- `mapOpenRouterModel` with various malformed inputs (missing pricing, missing context_length, string pricing values) -- partially covered via "filter out invalid models" test.
- `parseCost` with negative values, non-numeric strings, number inputs -- not directly tested but low risk.

#### Overengineering
- None.

---

### shared/lib/config/keyring.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/config/keyring.ts`
**Verdict**: NEEDS_FIX
**Test count**: 5-6 tests (varies by environment)

#### Issues Found
- Tests use runtime branching (`if (keyringAvailable)`) to choose which tests run. This means on CI where keyring is unavailable, only the error-path tests run. On a developer machine with keyring, only the success-path tests run. **Neither environment runs both paths.**
- The keyring tests perform real I/O against the system keyring when available -- this is an integration test, not a unit test. Could leave test artifacts in the keyring if tests fail mid-execution.

#### Missing Coverage
- `readKeyringSecret` catch branch (KEYRING_READ_FAILED) -- not tested in either environment.
- `writeKeyringSecret` catch branch (KEYRING_WRITE_FAILED) -- not tested.
- `loadKeyring` with failed require -- not tested (would need vi.mock of createRequire).
- `checkKeyringAvailability` failure path -- not tested.

#### Overengineering
- None.

---

### shared/lib/paths.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/paths.ts`
**Verdict**: OK
**Test count**: 9 tests

#### Issues Found
- None. Good coverage of path resolution priority and security checks.

#### Missing Coverage
- `getGlobalConfigPath`, `getGlobalSecretsPath`, `getGlobalTrustPath`, `getGlobalOpenRouterModelsPath`, `getProjectStargazerDir`, `getProjectInfoPath` -- all trivial path.join wrappers, correctly skipped per guidelines.
- `findGitRoot` reaching filesystem root without finding .git -- tested via "return normalized cwd when no git root found".

#### Overengineering
- None.

---

### shared/lib/git/errors.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/git/errors.ts`
**Verdict**: OK
**Test count**: 9 tests

#### Issues Found
- None. All error classification rules tested.

#### Missing Coverage
- None. Exhaustive coverage of all `GIT_ERROR_RULES` patterns plus fallback.

#### Overengineering
- None.

---

### shared/middlewares/trust-guard.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/middlewares/trust-guard.ts`
**Verdict**: OK
**Test count**: 3 tests

#### Issues Found
- None. Clean middleware test using Hono test client.

#### Missing Coverage
- None. All three paths covered (no trust, readFiles false, readFiles true).

#### Overengineering
- None.

---

### shared/middlewares/setup-guard.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/middlewares/setup-guard.ts`
**Verdict**: OK
**Test count**: 3 tests

#### Issues Found
- None.

#### Missing Coverage
- None. All paths covered.

#### Overengineering
- None.

---

### shared/lib/storage/reviews.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/storage/reviews.ts`
**Verdict**: OK
**Test count**: 13 tests

#### Issues Found
- None. Good coverage of CRUD operations and migration logic.

#### Missing Coverage
- `migrateReview` with `issues.length === 0` returns null -- not directly tested (tested indirectly via "skip migration when severity counts already present").
- `filterByProjectAndSort` with multiple sort orders -- only tested with 2 items.

#### Overengineering
- None.

---

### shared/lib/review/analysis.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/shared/lib/review/analysis.ts`
**Verdict**: OK
**Test count**: 5 tests

#### Issues Found
- None. Good use of fake timers for progress timer testing.

#### Missing Coverage
- `estimateTokens` and `getThinkingMessage` utility functions -- not tested (imported from `./utils.js`, presumably tested elsewhere or trivial).
- `buildReviewPrompt` is called but its output is not verified (it's tested in prompts.test.ts).

#### Overengineering
- None.

---

### features/config/service.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/features/config/service.ts`
**Verdict**: MISSING_COVERAGE
**Test count**: 10 tests

#### Issues Found
- None significant.

#### Missing Coverage
- `getInitState` -- not tested. Aggregates providers, settings, project info, setup status.
- `saveConfig` -- not tested. Thin wrapper over `saveProviderCredentials`.
- `getConfig` -- not tested. Returns current provider config or null.
- `deleteProvider` -- not tested. Wraps `deleteProviderCredentials`.
- `deleteConfig` -- not tested. Gets config then deletes; has CONFIG_NOT_FOUND error path.

These are mostly thin wrappers, so lower priority, but `getInitState` and `deleteConfig` have logic worth testing.

#### Overengineering
- None.

---

### features/review/service.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/features/review/service.ts`
**Verdict**: OK
**Test count**: 10 tests

#### Issues Found
- None. Good integration-style testing of the SSE streaming pipeline.

#### Missing Coverage
- `tryReplayExistingSession` with empty headCommit (returns false early) -- not tested.
- `streamReviewToSSE` with `clientSignal` passed and combined with session signal -- not tested.
- Complete happy-path verification (all pipeline steps called in order with correct args) could be more explicit.

#### Overengineering
- None.

---

### features/review/context.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/server/src/features/review/context.ts`
**Verdict**: OK
**Test count**: 11 tests

#### Issues Found
- None. Good coverage of workspace discovery, file tree building, and caching.

#### Missing Coverage
- `readFileDirectory` error handling (readdir fails silently, returns []) -- not directly tested.
- `formatWorkspaceGraph` with dependency edges present -- partially tested but could verify the "-> dep1, dep2" output format.

#### Overengineering
- None.

---

## Action Items

### Priority 1 (Security/Critical Logic -- Add Tests)
1. **shared/lib/git/service.ts**: Add tests for `getDiff`, `getBlame`, `getFileLines`, `getHeadCommit`, `getStatusHash`. These contain real parsing logic and are called frequently. (~10-15 tests)
2. **shared/lib/ai/client.ts**: Add tests for `generateStream` method. Streaming is a primary user-facing feature. (~5 tests)

### Priority 2 (Business Logic Gaps -- Add Tests)
3. **features/review/pipeline.ts**: Add tests for `resolveGitDiff` (empty diff messages, size limit), `resolveReviewConfig` (profile/lens resolution). (~8 tests)
4. **shared/lib/review/orchestrate.ts**: Add test for all-lenses-failed without `partialOnAllFailed` returning error. (~2 tests)
5. **shared/lib/config/keyring.ts**: Refactor tests to use `vi.mock` for the keyring module so both success and failure paths run in all environments. (~4 tests)

### Priority 3 (Minor Gaps -- Nice to Have)
6. **shared/lib/fs.ts**: Add tests for async `readJsonFile` and `writeJsonFile`. (~4 tests)
7. **features/config/service.ts**: Add tests for `getInitState` and `deleteConfig`. (~4 tests)
8. **shared/lib/config/store.ts**: Add tests for keyring-to-file migration and keyring delete path. (~3 tests)
9. **app.ts**: Add test for `onError` handler (500 response). (~1 test)

### No Action Needed
- All other test files are in good shape.
- No tests need to be removed for overengineering.
- Test naming, AAA pattern, boundary mocking, and Result type handling are consistently good across the codebase.
