# Test Coverage Gap Analysis

> Generated: 2026-02-07
> Compared: test-audit.md (64 tier 1 items) vs 61 actual test files (662 tests)

## Summary

| Metric | Count |
|--------|-------|
| Tier 1 items in audit | 64 |
| Items with test files | 55 |
| Items without test files (GAPS) | 9 |
| New files needing tests (post-audit) | 5 |
| Tier 2 items incorrectly tested | 2 |
| Total test files | 61 |
| Total test cases | 662 |

---

## Coverage Matrix

### Tier 1 -- Has Tests

#### Server: Core Business Logic (15/15 covered)

| # | Module | Test File | Tests | Coverage Assessment |
|---|--------|-----------|-------|-------------------|
| 1 | `server/shared/lib/diff/parser.ts` | `parser.test.ts` | 22 | COMPREHENSIVE -- regex state machine, multi-pass parsing, hunk boundaries |
| 2 | `server/shared/lib/review/orchestrate.ts` | `orchestrate.test.ts` | 4 | PARTIAL -- covers NO_DIFF, concurrency cap, partial failure, abort. Missing: dedup pipeline, filter/validate/sort post-processing, all-lenses-fail case |
| 3 | `server/shared/lib/review/prompts.ts` | `prompts.test.ts` | 24 | COMPREHENSIVE -- XML escaping (security-critical), prompt construction |
| 4 | `server/shared/lib/review/issues.ts` | `issues.test.ts` | 27 | COMPREHENSIVE -- dedup by composite key, severity sorting, evidence extraction |
| 5 | `server/shared/lib/storage/persistence.ts` | `persistence.test.ts` | 20 | COMPREHENSIVE -- collection CRUD, file I/O, schema validation |
| 6 | `server/shared/lib/storage/reviews.ts` | `reviews.test.ts` | 16 | COMPREHENSIVE -- save/list/migrate, severity counts, date sorting |
| 7 | `server/shared/lib/config/store.ts` | `store.test.ts` | 24 | COMPREHENSIVE -- provider CRUD, secrets migration, credential storage |
| 8 | `server/shared/lib/config/state.ts` | `state.test.ts` | 18 | COMPREHENSIVE -- config loading, provider-secrets sync |
| 9 | `server/shared/lib/git/service.ts` | `service.test.ts` | 16 | COMPREHENSIVE -- status parsing, branch/remote/ahead/behind |
| 10 | `server/shared/lib/ai/client.ts` | `client.test.ts` | 16 | COMPREHENSIVE -- AI client creation, error classification, timeout |
| 11 | `server/shared/lib/ai/openrouter-models.ts` | `openrouter-models.test.ts` | 11 | COMPREHENSIVE -- model mapping, cache TTL, cost parsing |
| 12 | `server/features/git/service.ts` | `service.test.ts` | 10 | COMPREHENSIVE -- path traversal, symlink detection |
| 13 | `server/features/review/pipeline.ts` | `pipeline.test.ts` | 12 | COMPREHENSIVE -- diff filtering, size check, config resolution |
| 14 | `server/features/review/sessions.ts` | `sessions.test.ts` | 21 | COMPREHENSIVE -- session lifecycle, subscriber notification, abort |
| 15 | `server/app.ts` | `app.test.ts` | 13 | COMPREHENSIVE -- hostname validation, CORS allowlist, security headers |

#### Server: Supporting Logic (13/13 covered)

| # | Module | Test File | Tests | Coverage Assessment |
|---|--------|-----------|-------|-------------------|
| 16 | `server/shared/lib/config/keyring.ts` | `keyring.test.ts` | 7 | PARTIAL -- covers read/write/delete and availability. Missing: error recovery edge cases |
| 17 | `server/shared/lib/fs.ts` | `fs.test.ts` | 11 | COMPREHENSIVE -- atomic write, readJsonFileSync, removeFileSync |
| 18 | `server/shared/lib/paths.ts` | `paths.test.ts` | 11 | COMPREHENSIVE -- 5-level priority chain, findGitRoot |
| 19 | `server/shared/lib/validation.ts` | `validation.test.ts` | 6 | COMPREHENSIVE -- path traversal, null bytes |
| 20 | `server/shared/lib/git/errors.ts` | `errors.test.ts` | 9 | COMPREHENSIVE -- 5 patterns + fallback |
| 21 | `server/shared/lib/http/response.ts` | NO TEST | 0 | GAP -- see missing tests section |
| 22 | `server/features/review/utils.ts` | `utils.test.ts` | 16 | COMPREHENSIVE -- parseProjectPath, errorCodeToStatus, isReviewAbort |
| 23 | `server/features/review/schemas.ts` | `schemas.test.ts` | 8 | COMPREHENSIVE -- parseCsvParam |
| 24 | `server/features/review/enrichment.ts` | `enrichment.test.ts` | 6 | PARTIAL -- covers basic enrichment and abort. Missing: blame failure fallback, file context edge cases |
| 25 | `server/features/review/drilldown.ts` | `drilldown.test.ts` | 6 | PARTIAL -- covers request handling and AI call. Missing: issue not found, save failure |
| 26 | `server/features/review/context.ts` | `context.test.ts` | 13 | COMPREHENSIVE -- workspace discovery, file tree, cache |
| 27 | `server/features/config/service.ts` | `service.test.ts` | 13 | COMPREHENSIVE -- config CRUD, validation, provider activation |
| 28 | `server/shared/middlewares/trust-guard.ts` | `trust-guard.test.ts` | 3 | THIN -- only 3 tests for a middleware. Missing: edge cases around trust capability checks |

#### Packages: Core Logic (9/9 covered)

| # | Module | Test File | Tests | Coverage Assessment |
|---|--------|-----------|-------|-------------------|
| 29 | `core/src/json.ts` | `json.test.ts` | 9 | COMPREHENSIVE -- markdown stripping, JSON parse, error factory |
| 30 | `core/src/review/review-state.ts` | `review-state.test.ts` | 32 | COMPREHENSIVE -- 22 describe blocks, covers all reducer branches including agent lifecycle, file progress, colon parsing, step events, enrich, orchestrator_complete. Major improvement from audit's "20% covered" |
| 31 | `core/src/review/event-to-log.ts` | `event-to-log.test.ts` | 23 | COMPREHENSIVE -- 17+ event type mappings |
| 32 | `core/src/review/stream-review.ts` | `stream-review.test.ts` | 10 | COMPREHENSIVE -- query param building, SSE stream processing, terminal outcomes |
| 33 | `core/src/errors.ts` | NO TEST | 0 | GAP -- see missing tests section |
| 34 | `core/src/strings.ts` | `strings.test.ts` | 8 | COMPREHENSIVE -- truncate edge cases |
| 35 | `core/src/format.ts` | `format.test.ts` | 9 | COMPREHENSIVE -- time formatting boundaries |
| 36 | `api/src/client.ts` | `client.test.ts` | 19 | COMPREHENSIVE -- URL construction, conditional headers, error parsing |
| 37 | `api/src/review.ts` | `review.test.ts` | 5 | PARTIAL -- covers resumeReviewStream basics. Missing: 404/409 status code mapping branches |

#### Schemas: Custom Validation (3/3 covered)

| # | Module | Test File | Tests | Coverage Assessment |
|---|--------|-----------|-------|-------------------|
| 38 | `schemas/src/config/providers.ts` | `providers.test.ts` | 6 | PARTIAL -- tests isValidModelForProvider. Missing: more refine edge cases |
| 39 | `schemas/src/review/storage.ts` | `storage.test.ts` | 5 | COMPREHENSIVE -- backwards-compat mode migration |
| 40 | `schemas/src/ui/ui.ts` | `ui.test.ts` | 5 | PARTIAL -- covers calculateSeverityCounts but missing severityRank indexOf -1 edge case |

#### Web: Hooks & State Management (12/18 covered)

| # | Module | Test File | Tests | Coverage Assessment |
|---|--------|-----------|-------|-------------------|
| 41 | `web/features/review/hooks/use-review-stream.ts` | NO TEST | 0 | GAP -- complex reducer + event batching + abort + resume |
| 42 | `web/features/review/hooks/use-review-lifecycle.ts` | NO TEST | 0 | GAP -- async orchestration, state machine |
| 43 | `web/app/providers/config-provider.tsx` | NO TEST | 0 | GAP -- cache TTL, 5 async operations, isConfigured derivation |
| 44 | `web/app/providers/keyboard-utils.ts` | `keyboard-utils.test.ts` | 15 | COMPREHENSIVE -- hotkey parsing, modifier detection, isInputElement |
| 45 | `web/app/providers/keyboard-provider.tsx` | NO TEST | 0 | GAP -- scope stack management, handler registry, keydown dispatch |
| 46 | `web/hooks/keyboard/use-selectable-list.ts` | `use-selectable-list.test.ts` | 12 | COMPREHENSIVE -- disabled items, wrapping, boundaries |
| 47 | `web/hooks/use-scoped-route-state.ts` | `use-scoped-route-state.test.ts` | 5 | PARTIAL -- missing MAX_ENTRIES eviction test, functional updates |
| 48 | `web/hooks/use-settings.ts` | `use-settings.test.ts` | 3 | THIN -- only 3 tests. Missing: cache TTL, request deduplication |
| 49 | `web/features/review/components/review-container.utils.ts` | `review-container.utils.test.ts` | 9 | COMPREHENSIVE -- step/agent status mapping, substep derivation |
| 50 | `web/features/history/utils.tsx` | `utils.test.ts` | 16 | COMPREHENSIVE -- date grouping, duration formatting, timeline building |
| 51 | `web/features/providers/hooks/use-model-filter.ts` | `use-model-filter.test.ts` | 9 | COMPREHENSIVE -- tier + search filtering, filter cycling |
| 52 | `web/hooks/use-openrouter-models.ts` | NO TEST | 0 | GAP -- moved from features/providers/hooks/ to hooks/. Reducer + compatibility filtering + dialog lifecycle |
| 53 | `web/components/ui/toast/toast-context.tsx` | `toast-context.test.tsx` | 9 | COMPREHENSIVE -- toast queue, auto-dismiss, animation lifecycle |
| 54 | `web/app/providers/theme-provider.tsx` | `theme-provider.test.tsx` | 3 | THIN -- only 3 tests. Missing: system detection, settings override priority |
| 55 | `web/features/review/hooks/use-review-settings.ts` | NO TEST | 0 | GAP -- small (15 lines) but has LensId validation + fallback logic |
| 56 | `web/features/review/hooks/use-review-error-handler.ts` | NO TEST | 0 | GAP -- isApiError type guard, status-to-message mapping |
| 57 | `web/features/providers/hooks/use-api-key-form.ts` | `use-api-key-form.test.ts` | 4 | PARTIAL -- covers canSubmit. Missing: double-submit prevention, method-dependent value |
| 58 | `web/features/history/hooks/use-reviews.ts` | `use-reviews.test.ts` | 3 | THIN -- only 3 tests. Missing: optimistic delete rollback on error |

#### Web: Components with Internal Logic (3/6 covered)

| # | Module | Test File | Tests | Coverage Assessment |
|---|--------|-----------|-------|-------------------|
| 59 | `web/components/ui/dialog/dialog-content.tsx` | `dialog-content.test.tsx` | 6 | PARTIAL -- covers Tab/Shift+Tab wrapping, body scroll lock. Missing: focus restore on unmount |
| 60 | `web/components/ui/menu/menu.tsx` | `menu.test.tsx` | 7 | PARTIAL -- covers recursive extraction, disabled skipping. Missing: number key jump, Enter activation |
| 61 | `web/components/ui/form/checkbox.tsx` | NO TEST | 0 | GAP -- controlled/uncontrolled, CheckboxGroup array value |
| 62 | `web/components/ui/form/radio-group.tsx` | NO TEST | 0 | GAP -- controlled/uncontrolled, keyboard nav, focus zone |
| 63 | `web/components/ui/severity/severity-bar.tsx` | NO TEST | 0 | GAP -- but only 29 lines with simple bar fill math. LOW PRIORITY |
| 64 | `web/features/review/components/activity-log.tsx` | NO TEST | 0 | GAP -- auto-scroll near-bottom detection. DOM-dependent, better as E2E |

---

### Tier 1 -- MISSING Tests (Gaps)

| # | Module | Priority | Est. Tests | Notes |
|---|--------|----------|------------|-------|
| 21 | `server/shared/lib/http/response.ts` | P1 | 4-6 | `errorResponse` status mapping via VALID_ERROR_STATUSES (unknown status falls back to 500), `zodErrorHandler` first-issue extraction. Only 42 lines but has branching. |
| 33 | `core/src/errors.ts` | P1 | 5-7 | `getErrorMessage` has 3 branches (Error instance, fallback, String coerce), `toError` has 2 branches. 27 lines but used extensively. |
| 41 | `web/features/review/hooks/use-review-stream.ts` | P2 | 15-20 | Most complex web hook: reducer with START/RESET/EVENT/COMPLETE/ERROR/SET_REVIEW_ID actions, rAF batching, abort handling, resume logic. ~190 lines. |
| 42 | `web/features/review/hooks/use-review-lifecycle.ts` | P2 | 10-15 | Orchestration hook: async state machine, completion delays, resume fallback. ~187 lines. Heavy DOM/hook coupling makes unit testing difficult. |
| 43 | `web/app/providers/config-provider.tsx` | P2 | 10-15 | Cache TTL logic, 5 async operations (init, credentials, trust, activate, delete), `isConfigured` derivation, split context. ~310 lines. |
| 45 | `web/app/providers/keyboard-provider.tsx` | P2 | 6-8 | Scope stack push/pop, handler registry, keydown event dispatch with scope filtering. ~81 lines. |
| 52 | `web/hooks/use-openrouter-models.ts` | P2 | 8-10 | Reducer state machine, `isOpenRouterCompatible` filter, dialog lifecycle, model mapping. Moved from `features/providers/hooks/` to `hooks/`. ~146 lines. |
| 55 | `web/features/review/hooks/use-review-settings.ts` | P2 | 3-4 | Small (15 lines) but has LensId validation with Zod safeParse + fallback array logic. Quick to test. |
| 56 | `web/features/review/hooks/use-review-error-handler.ts` | P2 | 4-5 | `isApiError` type guard (5 conditions), status-to-title/message mapping (3 branches each). |
| 61 | `web/components/ui/form/checkbox.tsx` | P2 | 8-12 | Controlled/uncontrolled toggle, CheckboxGroup array add/remove, Enter triggers toggle. 252 lines with significant logic. |
| 62 | `web/components/ui/form/radio-group.tsx` | P2 | 8-10 | Controlled/uncontrolled selection, keyboard nav via useGroupNavigation. 230 lines. |
| 63 | `web/components/ui/severity/severity-bar.tsx` | LOW | 2-3 | Only 29 lines. Simple bar fill calc: `max > 0 ? Math.round((count / max) * width) : 0`. Skip or test trivially. |
| 64 | `web/features/review/components/activity-log.tsx` | LOW | 0 | 71 lines, DOM-dependent scroll logic. Better as E2E test. SKIP for now. |

---

### New Files (Post-Audit) -- Needs Assessment

These files exist in the codebase but were NOT listed in the 64-item audit. Some have tests, some do not.

| Module | Lines | Has Test? | Should Test? | Why |
|--------|-------|-----------|-------------|-----|
| `server/shared/lib/review/analysis.ts` | 247 | YES (5 tests) | YES | `runLensAnalysis`: AI call orchestration, progress events, error handling, timer cleanup. Tests cover event sequence, error, abort, evidence, timer cleanup. COMPREHENSIVE for its role. |
| `server/features/review/service.ts` | 222 | YES (11 tests) | YES | `streamReviewToSSE`, `streamActiveSessionToSSE`: SSE replay, session lifecycle, error routing. Tests cover replay, subscribe, stale errors, abort, ReviewAbort, unexpected errors. COMPREHENSIVE. |
| `server/shared/lib/errors.ts` | 22 | YES (5 tests) | YES | `classifyError`: generic error classification with pattern matching. Tests cover matching, fallback. COMPREHENSIVE. |
| `server/shared/middlewares/setup-guard.ts` | 22 | YES (3 tests) | YES | `requireSetup` middleware: checks setup status. Tests exist. THIN but middleware is simple. |
| `server/shared/lib/review/lenses.ts` | 67 | NO | NO | Pure data mapping (constant lens definitions + trivial `getLenses` lookup). Tier 2 -- skip. |
| `server/shared/lib/review/profiles.ts` | 36 | NO | NO | Pure data (constant profile definitions + trivial `getProfile` lookup). Tier 2 -- skip. |
| `server/shared/lib/review/utils.ts` (review) | 24 | NO | NO | `estimateTokens` (1 branch) and `getThinkingMessage` (switch on lens ID). Trivial, skip. |
| `server/shared/lib/http/sse.ts` | 15 | NO | NO | Thin wrapper: `writeSSEError` just calls `stream.writeSSE`. Tier 2 -- skip. |
| `server/shared/lib/http/request.ts` | 10 | NO | NO | Single-line `getProjectRoot` wrapper, delegates to `resolveProjectRoot`. Tier 2 -- skip. |
| `server/shared/middlewares/body-limit.ts` | 9 | NO | NO | Thin wrapper around Hono's `bodyLimit`. Tier 2 -- skip. |
| `web/features/review/hooks/use-review-start.ts` | 76 | YES (4 tests) | YES | Review start orchestration, resume logic with error code branching. Tests exist. PARTIAL -- missing resume error code edge cases. |
| `web/features/review/hooks/use-review-completion.ts` | 67 | YES (5 tests) | YES | Completion delay logic with report step detection. Tests exist. PARTIAL -- missing report step delay vs default delay distinction test. |
| `web/features/review/hooks/use-context-snapshot.ts` | 41 | NO | NO | Simple fetch hook with streaming-awareness. Thin wrapper around API call. Tier 2 -- skip. |
| `web/features/providers/hooks/use-providers-page-state.ts` | 110 | NO | NO | Composition hook that wires together other hooks and filtering. Most logic is in delegated hooks. Tier 2 -- skip. |
| `web/features/history/hooks/use-review-detail.ts` | 36 | NO | NO | Simple fetch-by-id hook. No branching logic. Tier 2 -- skip. |
| `web/hooks/use-server-status.ts` | 53 | NO | MAYBE | Health check with interval polling. Has AbortController cleanup and error classification. Low priority. |
| `web/hooks/use-trust.ts` | 39 | NO | NO | Thin API wrappers (save/revoke). Delegates to `api.saveTrust`/`api.deleteTrust`. Tier 2 -- skip. |
| `web/hooks/use-scroll-into-view.ts` | 59 | NO | NO | DOM-dependent scroll calculation. Better as E2E. Tier 2 -- skip. |
| `web/features/home/utils/shutdown.ts` | 11 | NO | NO | 11-line fire-and-forget POST + `window.close()`. Cannot meaningfully test. Tier 2 -- skip. |
| `packages/schemas/src/events/*.ts` | various | NO | NO | Pure Zod schemas (stream.ts, enrich.ts, step.ts, agent.ts). No custom `.refine()` or `.transform()`. Tier 2 -- skip. |
| `packages/schemas/src/config/settings.ts` | N/A | NO | NO | Pure Zod schema. Tier 2 -- skip. |
| `packages/schemas/src/context/context.ts` | N/A | NO | NO | Pure Zod schema. Tier 2 -- skip. |
| `packages/schemas/src/review/issues.ts` | N/A | NO | NO | Pure Zod schema. Tier 2 -- skip. |

---

### Tier 2 -- Incorrectly Tested

| Module | Test File | Tests | Why It Should Be Reconsidered |
|--------|-----------|-------|-------------------------------|
| `packages/api/src/config.ts` | `config.test.ts` | 4 | Listed as "Thin API wrappers" in tier 2 (`api/config.ts`, `api/git.ts`, `api/bound.ts` -- "No branching, delegate to client"). These tests verify URL construction and parameter passing, which has *some* value for catching typos, but the audit explicitly says to skip. Tests are already written so keeping them is fine -- just noting the discrepancy. |
| `packages/hooks/src/get-figlet.ts` | `get-figlet.test.ts` | 4 | Not in the audit at all. `use-figlet.ts` is listed as tier 2 skip. `get-figlet.ts` is a separate file (not the hook) that has actual branching (font caching, error handling). Tests are reasonable -- NOT a problem. |

**Verdict:** No tests need to be removed. The `api/config.test.ts` is technically a tier 2 item being tested, but the tests are already written and provide marginal value. Not worth deleting.

---

## THIN Test Files (Need Expansion)

These files have tests but coverage is notably shallow relative to the module's complexity:

| Module | Tests | Missing Coverage |
|--------|-------|-----------------|
| `server/shared/lib/review/orchestrate.ts` | 4 | Dedup pipeline, filter/validate/sort, all-lenses-fail, default lenses fallback |
| `server/shared/middlewares/trust-guard.ts` | 3 | Only 3 tests for middleware; edge cases with missing trust data |
| `server/features/review/enrichment.ts` | 6 | Blame failure fallback, file context edge cases |
| `server/features/review/drilldown.ts` | 6 | Issue not found path, save failure handling |
| `web/hooks/use-settings.ts` | 3 | Cache TTL expiration, request deduplication, lazy fetch |
| `web/app/providers/theme-provider.tsx` | 3 | System theme detection, settings override chain |
| `web/features/history/hooks/use-reviews.ts` | 3 | Optimistic delete with rollback on error |
| `web/features/providers/hooks/use-api-key-form.ts` | 4 | Double-submit prevention guard, method-dependent value switching |
| `web/hooks/use-scoped-route-state.ts` | 5 | MAX_ENTRIES eviction, functional updates |
| `packages/api/src/review.ts` | 5 | HTTP 404/409 status code to error code mapping branches |
| `schemas/src/config/providers.ts` | 6 | More `.refine()` edge cases with invalid model+provider combos |
| `schemas/src/ui/ui.ts` | 5 | `severityRank` indexOf -1 edge case (unknown severity) |

---

## Priority Action Items

### P0 -- Quick Wins (small files, high test-to-effort ratio)

1. **`core/src/errors.ts`** -- 27 lines, 3 branches in `getErrorMessage`, 2 in `toError`. ~5 tests, 15 minutes.
2. **`server/shared/lib/http/response.ts`** -- 42 lines. `errorResponse` unknown status fallback to 500, `zodErrorHandler` issue extraction. ~5 tests, 15 minutes.
3. **`web/features/review/hooks/use-review-settings.ts`** -- 15 lines. LensId validation + fallback. ~3 tests, 10 minutes.
4. **`web/features/review/hooks/use-review-error-handler.ts`** -- 51 lines. Pure `isApiError` type guard can be tested without DOM. ~5 tests, 15 minutes.

### P1 -- Expand Thin Tests

5. **`server/shared/lib/review/orchestrate.ts`** -- Add 4-6 tests for dedup/filter/sort pipeline and all-lenses-fail case.
6. **`packages/api/src/review.ts`** -- Add 3-4 tests for HTTP status code mapping (404, 409, other).
7. **`web/hooks/use-settings.ts`** -- Add 3-4 tests for cache TTL and deduplication.
8. **`schemas/src/ui/ui.ts`** -- Add 1-2 tests for severityRank with unknown severity.

### P2 -- Complex Hooks (higher effort)

9. **`web/hooks/use-openrouter-models.ts`** -- Reducer + compatibility filter. ~8 tests.
10. **`web/features/review/hooks/use-review-stream.ts`** -- Most complex gap. Reducer + rAF batching. ~15 tests.
11. **`web/app/providers/config-provider.tsx`** -- Cache TTL, isConfigured derivation. ~10 tests.
12. **`web/app/providers/keyboard-provider.tsx`** -- Scope stack, handler registry. ~6 tests.
13. **`web/components/ui/form/checkbox.tsx`** -- Controlled/uncontrolled, group values. ~10 tests.
14. **`web/components/ui/form/radio-group.tsx`** -- Controlled/uncontrolled, keyboard nav. ~8 tests.

### Skip (confirmed no-test)

- `severity-bar.tsx` -- 29 lines, trivial math, low risk
- `activity-log.tsx` -- DOM scroll logic, E2E territory
- All new server files: `lenses.ts`, `profiles.ts`, `review/utils.ts`, `sse.ts`, `request.ts`, `body-limit.ts` -- pure data or thin wrappers
- All new web hooks: `use-context-snapshot.ts`, `use-providers-page-state.ts`, `use-review-detail.ts`, `use-trust.ts`, `shutdown.ts`, `use-scroll-into-view.ts` -- thin API wrappers or DOM-dependent

---

## Notable Findings

1. **`review-state.ts` is now well-tested.** The audit noted "only ~20% of reducer branches covered" but the test file now has 32 tests across 22 describe blocks, covering agent lifecycle, file progress, colon parsing, step events, enrich events, and orchestrator_complete. This is no longer a gap.

2. **`service.ts` and `analysis.ts` are new post-audit files with good tests.** The review service (11 tests) and lens analysis (5 tests) were extracted/added after the audit was written and already have comprehensive test coverage.

3. **`use-openrouter-models.ts` was relocated.** It moved from `features/providers/hooks/` to `hooks/` (shared level). The audit references the old location (#52). No test exists at either location.

4. **`use-review-start.ts` and `use-review-completion.ts` are new hooks** that were not in the original audit but have been tested (4 and 5 tests respectively). They were likely extracted from `use-review-lifecycle.ts`.

5. **Server has excellent coverage.** 31 test files with 387 tests. All 28 audit items have tests. Only `http/response.ts` (#21) is missing.

6. **Web is the weakest area.** 9 of the 13 missing test files are in `apps/web/`. The most impactful gaps are `use-review-stream.ts`, `config-provider.tsx`, and `use-openrouter-models.ts`.

7. **No unnecessary tests to remove.** The 2 tier-2 items with tests (`api/config.ts`, `get-figlet.ts`) provide marginal value and are already written. Not worth deleting.
