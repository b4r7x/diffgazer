# Test Coverage Audit

> Generated: 2026-02-07
> Auditor: auditor-coverage agent

## Overall Stats

| Metric | Count |
|--------|-------|
| Total source files (non-test) | ~120 |
| Files with co-located tests | 49 |
| Files that SHOULD have tests | ~68 |
| Files correctly skipped (no tests needed) | ~52 |
| **Tested files (of those needing tests)** | **49 / 68 (72%)** |
| **Untested files needing tests** | **19** |
| Existing test files | 49 |

---

## Summary of Changes Since Last Audit

The codebase has **significantly improved** since the original test-audit.md was written. At that time there were only 3 test files (~60 tests). Now there are **49 test files** covering the majority of critical modules. The infrastructure (vitest) is in place and working.

### What's Been Covered Since Last Audit
- Server: diff parser, prompts, issues, orchestrate, persistence, reviews storage, config store, config state, git service, git errors, AI client, openrouter models, app security, validation, paths, fs, http response, keyring, sessions, pipeline, enrichment, config service, review schemas, review utils
- Packages: core errors, json, strings, format, filtering, review-state, review-state-gaps, event-to-log, stream-review, sse-parser, API client, API review, schemas providers, schemas storage, schemas UI
- Web: keyboard-utils, review-container.utils, history utils, model-filter, review-error-handler, review-settings, review-stream, scoped-route-state, dialog-content, menu, severity-bar, toast-context

### What Still Needs Tests (19 files)

---

## P0 — Server Core (HIGH PRIORITY GAPS)

| File | Has Tests? | Coverage Quality | Tests Needed | Est. Count |
|------|-----------|-----------------|--------------|------------|
| `server/shared/lib/errors.ts` | NO | - | `classifyError` generic function | 5-7 |
| `server/shared/lib/review/analysis.ts` | NO | - | `runLensAnalysis` integration | 8-12 |
| `server/shared/lib/review/utils.ts` | YES | Good | Covered | - |
| `server/shared/lib/review/lenses.ts` | NO | - | Skip (constants + trivial lookup) | 0 |
| `server/shared/lib/review/profiles.ts` | NO | - | Skip (constants + trivial lookup) | 0 |
| `server/features/review/context.ts` | NO | - | Complex workspace/file tree logic | 10-15 |
| `server/features/review/service.ts` | NO | - | Complex SSE orchestration | 8-12 |
| `server/features/review/drilldown.ts` | NO | - | Issue lookup + AI call chain | 6-8 |

### Specific Test Cases Needed

#### `server/shared/lib/errors.ts` (NEW FILE)
- `classifyError` matches first matching rule pattern
- `classifyError` returns fallback when no patterns match
- `classifyError` is case-insensitive pattern matching
- `classifyError` handles non-Error thrown values (string, object, undefined)
- `classifyError` uses original error message (not lowercased) in fallback

#### `server/features/review/context.ts`
- `discoverWorkspacePackages` finds apps and packages directories
- `discoverWorkspacePackages` skips entries without package.json
- `discoverWorkspacePackages` collects dependencies from all dep fields
- `buildFileTree` excludes CONTEXT_EXCLUDE_DIRS entries
- `buildFileTree` respects depth limit
- `buildFileTree` handles symlink cycles (visited set)
- `formatWorkspaceGraph` handles empty packages list
- `formatFileTree` renders nested directory structure
- `loadContextSnapshot` returns null on missing files
- `buildProjectContextSnapshot` uses cache when statusHash matches

#### `server/features/review/service.ts`
- `streamReviewToSSE` replays existing session when found
- `streamReviewToSSE` creates new session when no existing
- `handleReviewFailure` handles AbortError silently
- `handleReviewFailure` handles ReviewAbort with step error
- `handleReviewFailure` handles unexpected errors
- `streamActiveSessionToSSE` replays buffered events
- `streamActiveSessionToSSE` subscribes for live events
- `isAbortError` identifies DOMException AbortError

#### `server/features/review/drilldown.ts`
- `drilldownIssue` finds target file and emits tool events
- `drilldownIssue` handles missing target file gracefully
- `drilldownIssueById` returns error when issue not found
- `drilldownIssueById` delegates to drilldownIssue for found issues
- `handleDrilldownRequest` loads review from storage
- `handleDrilldownRequest` returns error on storage failure

#### `server/shared/lib/review/analysis.ts`
- `runLensAnalysis` emits correct event sequence (start, thinking, progress, file events, complete)
- `runLensAnalysis` handles AI client error result
- `runLensAnalysis` respects abort signal during file scanning
- `runLensAnalysis` ensures issue evidence from diff
- `runLensAnalysis` cleans up progress timer on error

---

## P0 — Server: Already Covered (Verified)

| File | Has Tests? | Coverage Quality | Notes |
|------|-----------|-----------------|-------|
| `server/shared/lib/diff/parser.ts` | YES | Good | parser.test.ts |
| `server/shared/lib/review/orchestrate.ts` | YES | Good | orchestrate.test.ts |
| `server/shared/lib/review/prompts.ts` | YES | Good | prompts.test.ts (security-critical XML escaping) |
| `server/shared/lib/review/issues.ts` | YES | Good | issues.test.ts |
| `server/shared/lib/storage/persistence.ts` | YES | Good | persistence.test.ts |
| `server/shared/lib/storage/reviews.ts` | YES | Good | reviews.test.ts |
| `server/shared/lib/config/store.ts` | YES | Good | store.test.ts |
| `server/shared/lib/config/state.ts` | YES | Good | state.test.ts |
| `server/shared/lib/config/keyring.ts` | YES | Good | keyring.test.ts |
| `server/shared/lib/git/service.ts` | YES | Good | service.test.ts |
| `server/shared/lib/git/errors.ts` | YES | Good | errors.test.ts |
| `server/shared/lib/ai/client.ts` | YES | Good | client.test.ts |
| `server/shared/lib/ai/openrouter-models.ts` | YES | Good | openrouter-models.test.ts |
| `server/app.ts` | YES | Good | app.test.ts (CORS, hostname validation) |
| `server/shared/lib/validation.ts` | YES | Good | validation.test.ts |
| `server/shared/lib/paths.ts` | YES | Good | paths.test.ts |
| `server/shared/lib/fs.ts` | YES | Good | fs.test.ts |
| `server/shared/lib/http/response.ts` | YES | Good | response.test.ts |
| `server/features/review/pipeline.ts` | YES | Good | pipeline.test.ts |
| `server/features/review/sessions.ts` | YES | Good | sessions.test.ts |
| `server/features/review/enrichment.ts` | YES | Good | enrichment.test.ts |
| `server/features/review/schemas.ts` | YES | Good | schemas.test.ts |
| `server/features/review/utils.ts` | YES | Good | utils.test.ts |
| `server/features/config/service.ts` | YES | Good | service.test.ts |
| `server/features/git/service.ts` | YES | Good | service.test.ts |
| `server/shared/lib/review/utils.ts` | YES | Good | utils.test.ts |

---

## P1 — Packages (GAPS)

| File | Has Tests? | Coverage Quality | Tests Needed | Est. Count |
|------|-----------|-----------------|--------------|------------|
| `core/src/review/review-state.ts` | YES | **Improved** | review-state-gaps.test.ts added | - |
| `core/src/review/event-to-log.ts` | YES | Good | event-to-log.test.ts | - |
| `core/src/review/stream-review.ts` | YES | Good | stream-review.test.ts | - |
| `core/src/errors.ts` | YES | Good | errors.test.ts | - |
| `core/src/strings.ts` | YES | Good | strings.test.ts | - |
| `core/src/format.ts` | YES | Good | format.test.ts | - |
| `core/src/json.ts` | YES | Good | json.test.ts | - |
| `core/src/review/filtering.ts` | YES | Good | filtering.test.ts | - |
| `core/src/streaming/sse-parser.ts` | YES | Excellent | sse-parser.test.ts | - |
| `api/src/client.ts` | YES | Good | client.test.ts | - |
| `api/src/review.ts` | YES | Good | review.test.ts | - |
| `schemas/src/config/providers.ts` | YES | Good | providers.test.ts | - |
| `schemas/src/review/storage.ts` | YES | Good | storage.test.ts | - |
| `schemas/src/ui/ui.ts` | YES | Good | ui.test.ts | - |

**All P1 package files are now covered.** No gaps remain.

---

## P2 — Web (GAPS)

| File | Has Tests? | Coverage Quality | Tests Needed | Est. Count |
|------|-----------|-----------------|--------------|------------|
| `web/hooks/use-settings.ts` | NO | - | Cache TTL, dedup, invalidation | 5-7 |
| `web/hooks/use-openrouter-models.ts` | NO | - | Reducer, filtering, fetch lifecycle | 6-8 |
| `web/hooks/keyboard/use-selectable-list.ts` | NO | - | Navigation, wrapping, disabled items | 5-7 |
| `web/features/review/hooks/use-review-lifecycle.ts` | NO | - | Complex hook composition, skip (E2E) | 0 |
| `web/features/review/hooks/use-review-completion.ts` | NO | - | Timeout delay logic | 4-5 |
| `web/features/review/hooks/use-review-start.ts` | NO | - | Start/resume branching | 4-5 |
| `web/features/history/hooks/use-reviews.ts` | NO | - | Optimistic delete + rollback | 3-4 |
| `web/features/providers/hooks/use-api-key-form.ts` | NO | - | canSubmit, double-submit prevention | 4-5 |
| `web/features/providers/hooks/use-providers-page-state.ts` | NO | - | Skip (composition hook, too many deps) | 0 |
| `web/app/providers/config-provider.tsx` | NO | - | Complex async, skip for now (integration) | 0 |
| `web/app/providers/keyboard-provider.tsx` | NO | - | Scope management, skip (DOM-heavy) | 0 |
| `web/app/providers/theme-provider.tsx` | NO | - | Theme resolution priority | 3-4 |

### Web: Already Covered (Verified)

| File | Has Tests? | Notes |
|------|-----------|-------|
| `web/app/providers/keyboard-utils.ts` | YES | keyboard-utils.test.ts |
| `web/features/review/components/review-container.utils.ts` | YES | review-container.utils.test.ts |
| `web/features/history/utils.tsx` | YES | utils.test.ts |
| `web/features/providers/hooks/use-model-filter.ts` | YES | use-model-filter.test.ts |
| `web/features/review/hooks/use-review-error-handler.ts` | YES | use-review-error-handler.test.ts |
| `web/features/review/hooks/use-review-settings.ts` | YES | use-review-settings.test.ts |
| `web/features/review/hooks/use-review-stream.ts` | YES | use-review-stream.test.ts |
| `web/hooks/use-scoped-route-state.ts` | YES | use-scoped-route-state.test.ts |
| `web/components/ui/dialog/dialog-content.tsx` (logic) | YES | dialog-content.test.tsx |
| `web/components/ui/menu/menu.tsx` (logic) | YES | menu.test.tsx |
| `web/components/ui/severity/severity-bar.tsx` (logic) | YES | severity-bar.test.tsx |
| `web/components/ui/toast/toast-context.tsx` (logic) | YES | toast-context.test.tsx |

### Specific Test Cases Needed (Web)

#### `web/hooks/use-settings.ts`
- Returns null settings when cache is empty
- Triggers fetch on first mount (no cache)
- Returns cached data when TTL not expired
- Invalidates cache when TTL expired
- `refresh` updates cache with fresh data
- `invalidate` clears cache and notifies subscribers
- Deduplicates inflight requests

#### `web/hooks/use-openrouter-models.ts`
- `isOpenRouterCompatible` returns true for models with response_format
- `isOpenRouterCompatible` returns true for models with structured_outputs
- `isOpenRouterCompatible` returns false for models without supported params
- `mapOpenRouterModels` maps isFree to tier correctly
- Reducer FETCH_START sets loading state
- Reducer FETCH_SUCCESS sets loaded state with payload
- Reducer FETCH_ERROR sets error state
- Reducer RESET returns to initial state

#### `web/hooks/keyboard/use-selectable-list.ts`
- Moves focus down to next non-disabled item
- Moves focus up to previous non-disabled item
- Wraps from last to first when wrap=true
- Does not wrap when wrap=false
- Calls onBoundaryReached at boundaries when wrap=false
- Skips disabled items during navigation

#### `web/features/review/hooks/use-review-completion.ts`
- Fires onComplete after delay when streaming stops
- Uses REPORT_COMPLETE_DELAY_MS when report step is completed
- Uses DEFAULT_COMPLETE_DELAY_MS when report step not completed
- Does not fire when error is present
- Clears timeout on unmount

#### `web/features/review/hooks/use-review-start.ts`
- Starts review when config is ready and no reviewId
- Resumes review when reviewId is present
- Falls back to start on SESSION_STALE resume error
- Calls onResumeFailed on SESSION_NOT_FOUND

#### `web/features/providers/hooks/use-api-key-form.ts`
- canSubmit is true when method is "env"
- canSubmit is true when method is "paste" and value non-empty
- canSubmit is false when method is "paste" and value empty
- Prevents double submission (isSubmitting guard)

---

## SKIP — No Tests Needed (Verified)

| Category | Files | Reason |
|----------|-------|--------|
| Barrel files (index.ts) | ~20 files | Re-exports only, zero logic |
| Type-only files | `*/types.ts`, `*/types/index.ts` | TypeScript validates |
| Constants files | `constants.ts`, `severity.ts` | No logic |
| Plain Zod schemas | Most of `packages/schemas/src/` | Testing Zod, not our code |
| Thin API wrappers | `api/config.ts`, `api/git.ts`, `api/bound.ts` | No branching, delegate to client |
| Route handlers | All `router.ts` files | Test as integration later |
| Pure UI components | Most `apps/web/src/components/` | Props-to-JSX, no business logic |
| CLI components | All `apps/cli/src/` | Ink hard to test, web is source of truth |
| DOM-heavy keyboard hooks | `use-group-navigation.ts`, `use-model-dialog-keyboard.ts`, etc. | Better as E2E |
| Pure-render components | Layout, icons, badges, wrappers | TypeScript catches errors |
| Trivial wrappers | `shared/lib/http/request.ts` (10 lines), `shared/lib/review/lenses.ts` (constants), `shared/lib/review/profiles.ts` (constants) | Can't break |
| Middleware wrappers | `body-limit.ts` (9 lines), `trust-guard.ts` (25 lines), `setup-guard.ts` (22 lines) | Thin wrappers over Hono/service layer |
| Schema event files | `events/agent.ts`, `events/step.ts`, `events/stream.ts`, `events/enrich.ts` | Plain Zod |
| Hooks package | `hooks/src/use-timer.ts`, `hooks/src/get-figlet.ts` | Trivial wrappers |
| `core/src/result.ts` | 11 lines, can't break |

---

## Gap Summary by Priority

| Priority | Untested Files | Est. Tests Needed |
|----------|---------------|-------------------|
| P0 (Server) | 5 files | 37-54 |
| P1 (Packages) | 0 files | 0 |
| P2 (Web) | 8 files (5 actionable) | 27-36 |
| **Total** | **13 actionable** | **64-90** |

### Recommended Order to Fill Gaps

1. **`server/shared/lib/errors.ts`** (5-7 tests) — Simple pure function, quick win, used by AI client
2. **`server/features/review/drilldown.ts`** (6-8 tests) — Issue lookup + AI call, important business logic
3. **`server/features/review/context.ts`** (10-15 tests) — Workspace discovery, file tree, cache logic
4. **`server/features/review/service.ts`** (8-12 tests) — SSE streaming orchestration (complex, needs mocking)
5. **`server/shared/lib/review/analysis.ts`** (8-12 tests) — Lens analysis integration (needs AI mock)
6. **`web/hooks/use-openrouter-models.ts`** (6-8 tests) — Reducer + pure functions extractable
7. **`web/hooks/use-settings.ts`** (5-7 tests) — Cache/dedup logic
8. **`web/features/review/hooks/use-review-completion.ts`** (4-5 tests) — Timeout delay logic
9. **`web/features/review/hooks/use-review-start.ts`** (4-5 tests) — Start/resume branching
10. **`web/features/providers/hooks/use-api-key-form.ts`** (4-5 tests) — Form state logic
11. **`web/features/history/hooks/use-reviews.ts`** (3-4 tests) — Optimistic delete
12. **`web/app/providers/theme-provider.tsx`** (3-4 tests) — Theme resolution
13. **`web/hooks/keyboard/use-selectable-list.ts`** (5-7 tests) — Navigation logic (DOM-dependent, lower priority)

### Files Explicitly Skipped (Not Worth Testing)

- `server/shared/lib/review/lenses.ts` — Constants + trivial map lookup
- `server/shared/lib/review/utils.ts` (server) — Already tested via utils.test.ts
- `web/features/review/hooks/use-review-lifecycle.ts` — Composition hook, too many framework deps, better as E2E
- `web/features/providers/hooks/use-providers-page-state.ts` — Composition hook, orchestrates other hooks
- `web/app/providers/config-provider.tsx` — Complex async context, better as integration test
- `web/app/providers/keyboard-provider.tsx` — DOM-heavy scope management

---

## Infrastructure Status

| Item | Status |
|------|--------|
| Vitest installed | YES |
| Per-package vitest.config.ts | YES (server, core, api, schemas) |
| Web vitest.config.ts | YES (jsdom environment) |
| Test scripts in package.json | YES |
| Root `pnpm test` | YES |

---

## Notes

- The codebase went from 3 test files to 49 test files since the original audit
- All P0 server core modules are covered except 5 files (errors.ts is new, the rest are complex integration points)
- All P1 package modules are fully covered
- Web coverage is good for pure logic and extractable utils; remaining gaps are mostly hooks with React lifecycle dependencies
- `server/shared/lib/review/profiles.ts` is constants + trivial lookup — correctly skipped
