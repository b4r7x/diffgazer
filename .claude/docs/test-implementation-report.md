# Test Implementation Report

Generated: 2026-02-07

---

## Section 1: Implementation Summary

### Totals

| Metric | Count |
|--------|-------|
| **Total test files** | 53 |
| **Total tests** | 660 |
| **Pre-existing test files** | 3 |
| **New test files** | 50 |

### By Package

| Package | Test Files | Tests | Pre-existing | New |
|---------|-----------|-------|-------------|-----|
| `apps/server` | 26 | 371 | 0 | 26 |
| `apps/web` | 12 | 108 | 0 | 12 |
| `packages/core` | 10 | 155 | 3 | 7 |
| `packages/api` | 2 | 24 | 0 | 2 |
| `packages/schemas` | 3 | 16 | 0 | 3 |

### Pre-existing Tests (before audit)

| File | Tests | Notes |
|------|-------|-------|
| `packages/core/src/review/filtering.test.ts` | 14* | Was 11 in audit, now 14 |
| `packages/core/src/review/review-state.test.ts` | 14* | Was 20 in audit, now 14 (some moved to gaps file) |
| `packages/core/src/streaming/sse-parser.test.ts` | 28* | Was 30+ in audit, now 28 |

*Counts based on current `it(`/`test(` occurrences.

### Infrastructure Status

| Item | Status |
|------|--------|
| vitest installed | Yes |
| `apps/server/vitest.config.ts` | Yes |
| `apps/web/vitest.config.ts` | Yes (jsdom, @/ alias, react plugin) |
| `packages/core/vitest.config.ts` | Yes |
| `packages/api/vitest.config.ts` | Yes |
| `packages/schemas/vitest.config.ts` | Yes |
| Root `pnpm test` script | Yes (`pnpm -r test`) |
| Per-package `test` script | Yes (all use `vitest run`) |

---

## Section 2: Coverage Checklist

Legend:
- [x] = test file exists with reasonable coverage
- [ ] = test file missing or coverage inadequate

### TIER 1 -- Server: Core Business Logic (Audit #1-15)

| # | Module | Test File | Tests | Status |
|---|--------|-----------|-------|--------|
| 1 | `server/shared/lib/diff/parser.ts` | `parser.test.ts` | 22 | [x] |
| 2 | `server/shared/lib/review/orchestrate.ts` | `orchestrate.test.ts` | 9 | [x] |
| 3 | `server/shared/lib/review/prompts.ts` | `prompts.test.ts` | 22 | [x] |
| 4 | `server/shared/lib/review/issues.ts` | `issues.test.ts` | 27 | [x] |
| 5 | `server/shared/lib/storage/persistence.ts` | `persistence.test.ts` | 20 | [x] |
| 6 | `server/shared/lib/storage/reviews.ts` | `reviews.test.ts` | 16 | [x] |
| 7 | `server/shared/lib/config/store.ts` | `store.test.ts` | 24 | [x] |
| 8 | `server/shared/lib/config/state.ts` | `state.test.ts` | 18 | [x] |
| 9 | `server/shared/lib/git/service.ts` | `service.test.ts` | 16 | [x] |
| 10 | `server/shared/lib/ai/client.ts` | `client.test.ts` | 16 | [x] |
| 11 | `server/shared/lib/ai/openrouter-models.ts` | `openrouter-models.test.ts` | 11 | [x] |
| 12 | `server/features/git/service.ts` | `service.test.ts` | 10 | [x] |
| 13 | `server/features/review/pipeline.ts` | `pipeline.test.ts` | 13 | [x] |
| 14 | `server/features/review/sessions.ts` | `sessions.test.ts` | 19 | [x] |
| 15 | `server/app.ts` | `app.test.ts` | 9 | [x] |

### TIER 1 -- Server: Supporting Logic (Audit #16-28)

| # | Module | Test File | Tests | Status |
|---|--------|-----------|-------|--------|
| 16 | `server/shared/lib/config/keyring.ts` | `keyring.test.ts` | 9 | [x] |
| 17 | `server/shared/lib/fs.ts` | `fs.test.ts` | 11 | [x] |
| 18 | `server/shared/lib/paths.ts` | `paths.test.ts` | 14 | [x] |
| 19 | `server/shared/lib/validation.ts` | `validation.test.ts` | 6 | [x] |
| 20 | `server/shared/lib/git/errors.ts` | `errors.test.ts` | 10 | [x] |
| 21 | `server/shared/lib/http/response.ts` | `response.test.ts` | 4 | [x] |
| 22 | `server/features/review/utils.ts` | `utils.test.ts` | 20 | [x] |
| 23 | `server/features/review/schemas.ts` | `schemas.test.ts` | 8 | [x] |
| 24 | `server/features/review/enrichment.ts` | `enrichment.test.ts` | 6 | [x] |
| 25 | `server/features/review/drilldown.ts` | -- | 0 | [ ] MISSING |
| 26 | `server/features/review/context.ts` | -- | 0 | [ ] MISSING |
| 27 | `server/features/config/service.ts` | `service.test.ts` | 15 | [x] |
| 28 | `server/shared/middlewares/trust-guard.ts` | -- | 0 | [ ] MISSING |

### TIER 1 -- Packages: Core Logic (Audit #29-37)

| # | Module | Test File | Tests | Status |
|---|--------|-----------|-------|--------|
| 29 | `core/src/json.ts` | `json.test.ts` | 9 | [x] |
| 30 | `core/src/review/review-state.ts` | `review-state.test.ts` + `review-state-gaps.test.ts` | 14 + 26 = 40 | [x] |
| 31 | `core/src/review/event-to-log.ts` | `event-to-log.test.ts` | 23 | [x] |
| 32 | `core/src/review/stream-review.ts` | `stream-review.test.ts` | 10 | [x] |
| 33 | `core/src/errors.ts` | `errors.test.ts` | 13 | [x] |
| 34 | `core/src/strings.ts` | `strings.test.ts` | 9 | [x] |
| 35 | `core/src/format.ts` | `format.test.ts` | 9 | [x] |
| 36 | `api/src/client.ts` | `client.test.ts` | 19 | [x] |
| 37 | `api/src/review.ts` | `review.test.ts` | 5 | [x] |

### TIER 1 -- Schemas: Custom Validation (Audit #38-40)

| # | Module | Test File | Tests | Status |
|---|--------|-----------|-------|--------|
| 38 | `schemas/src/config/providers.ts` | `providers.test.ts` | 5 | [x] |
| 39 | `schemas/src/review/storage.ts` | `storage.test.ts` | 5 | [x] |
| 40 | `schemas/src/ui/ui.ts` | `ui.test.ts` | 6 | [x] |

### TIER 1 -- Web: Hooks & State Management (Audit #41-58)

| # | Module | Test File | Tests | Status |
|---|--------|-----------|-------|--------|
| 41 | `web/features/review/hooks/use-review-stream.ts` | `use-review-stream.test.ts` | 13 | [x] |
| 42 | `web/features/review/hooks/use-review-lifecycle.ts` | -- | 0 | [ ] MISSING |
| 43 | `web/app/providers/config-provider.tsx` | -- | 0 | [ ] MISSING |
| 44 | `web/app/providers/keyboard-utils.ts` | `keyboard-utils.test.ts` | 15 | [x] |
| 45 | `web/app/providers/keyboard-provider.tsx` | -- | 0 | [ ] MISSING |
| 46 | `web/hooks/keyboard/use-selectable-list.ts` | -- | 0 | [ ] MISSING |
| 47 | `web/hooks/use-scoped-route-state.ts` | `use-scoped-route-state.test.ts` | 7 | [x] |
| 48 | `web/hooks/use-settings.ts` | -- | 0 | [ ] MISSING |
| 49 | `web/features/review/components/review-container.utils.ts` | `review-container.utils.test.ts` | 9 | [x] |
| 50 | `web/features/history/utils.tsx` | `utils.test.ts` | 16 | [x] |
| 51 | `web/features/providers/hooks/use-model-filter.ts` | `use-model-filter.test.ts` | 9 | [x] |
| 52 | `web/features/providers/hooks/use-openrouter-models.ts` | -- | 0 | [ ] MISSING |
| 53 | `web/components/ui/toast/toast-context.tsx` | `toast-context.test.tsx` | 9 | [x] |
| 54 | `web/app/providers/theme-provider.tsx` | -- | 0 | [ ] MISSING |
| 55 | `web/features/review/hooks/use-review-settings.ts` | `use-review-settings.test.ts` | 4 | [x] |
| 56 | `web/features/review/hooks/use-review-error-handler.ts` | `use-review-error-handler.test.ts` | 9 | [x] |
| 57 | `web/features/providers/hooks/use-api-key-form.ts` | -- | 0 | [ ] MISSING |
| 58 | `web/features/history/hooks/use-reviews.ts` | -- | 0 | [ ] MISSING |

### TIER 1 -- Web: Components with Internal Logic (Audit #59-64)

| # | Module | Test File | Tests | Status |
|---|--------|-----------|-------|--------|
| 59 | `web/components/ui/dialog/dialog-content.tsx` | `dialog-content.test.tsx` | 6 | [x] |
| 60 | `web/components/ui/menu/menu.tsx` | `menu.test.tsx` | 7 | [x] |
| 61 | `web/components/ui/form/checkbox.tsx` | -- | 0 | [ ] MISSING |
| 62 | `web/components/ui/form/radio-group.tsx` | -- | 0 | [ ] MISSING |
| 63 | `web/components/ui/severity/severity-bar.tsx` | `severity-bar.test.tsx` | 4 | [x] |
| 64 | `web/features/review/components/activity-log.tsx` | -- | 0 | [ ] MISSING |

### Bonus: Test files not in audit (server shared/lib/review/utils)

| Module | Test File | Tests | Notes |
|--------|-----------|-------|-------|
| `server/shared/lib/review/utils.ts` | `utils.test.ts` | 9 | Not explicitly in audit as separate item; covers `estimateTokens`, `getThinkingMessage` |

---

## Section 3: Gap Analysis

### 3.1 Audit Files Missing Tests (16 files)

#### HIGH PRIORITY (security or complex business logic)

| # | File | Risk | Est. Tests | Why |
|---|------|------|-----------|-----|
| 28 | `server/shared/middlewares/trust-guard.ts` | SECURITY | 4-6 | Trust capability enforcement |
| 25 | `server/features/review/drilldown.ts` | HIGH | 8-12 | Drilldown request handling, issue lookup, AI call + save |
| 26 | `server/features/review/context.ts` | HIGH | 10-15 | Workspace discovery, file tree building, cache check |
| 42 | `web/features/review/hooks/use-review-lifecycle.ts` | HIGH | 10-15 | Async orchestration, state machine, completion delays |
| 43 | `web/app/providers/config-provider.tsx` | HIGH | 8-12 | Cache TTL, 5 async ops, isConfigured derivation |

#### MEDIUM PRIORITY (state management and form logic)

| # | File | Risk | Est. Tests | Why |
|---|------|------|-----------|-----|
| 45 | `web/app/providers/keyboard-provider.tsx` | MEDIUM | 6-8 | Scope stack management, handler registry |
| 46 | `web/hooks/keyboard/use-selectable-list.ts` | MEDIUM | 6-8 | Navigation with disabled items, wrapping |
| 48 | `web/hooks/use-settings.ts` | MEDIUM | 4-6 | Cache TTL, request dedup, lazy fetch |
| 52 | `web/features/providers/hooks/use-openrouter-models.ts` | MEDIUM | 8-10 | Reducer + compatibility filtering |
| 54 | `web/app/providers/theme-provider.tsx` | MEDIUM | 5-7 | Theme resolution priority, system detection |
| 57 | `web/features/providers/hooks/use-api-key-form.ts` | MEDIUM | 5-7 | canSubmit derivation, double-submit prevention |
| 58 | `web/features/history/hooks/use-reviews.ts` | MEDIUM | 5-7 | Optimistic delete + rollback |

#### LOWER PRIORITY (component logic)

| # | File | Risk | Est. Tests | Why |
|---|------|------|-----------|-----|
| 61 | `web/components/ui/form/checkbox.tsx` | LOW | 6-8 | Controlled/uncontrolled, CheckboxGroup array |
| 62 | `web/components/ui/form/radio-group.tsx` | LOW | 6-8 | Controlled/uncontrolled, keyboard nav |
| 64 | `web/features/review/components/activity-log.tsx` | LOW | 4-5 | Auto-scroll near-bottom detection |

**Total missing: 16 files, estimated 95-134 tests needed.**

### 3.2 Source Files with Testable Logic NOT in Audit

These files exist in the codebase, contain exported functions with branching logic, but were not listed in the 64-file audit:

| File | Exports | Risk | Recommendation |
|------|---------|------|----------------|
| `server/shared/lib/review/lenses.ts` | `getLenses()` | LOW | Skip -- simple array lookup, low branching |
| `server/shared/lib/review/profiles.ts` | `getProfile()` | LOW | Skip -- simple map lookup |
| `server/shared/lib/review/analysis.ts` | `runLensAnalysis()` | MEDIUM | Skip -- integration function, hard to unit test in isolation |
| `server/shared/lib/http/request.ts` | `getProjectRoot()` | LOW | Skip -- thin Hono context accessor |
| `server/shared/lib/http/sse.ts` | `writeSSEError()` | LOW | Skip -- thin SSE writer |
| `server/shared/middlewares/setup-guard.ts` | `requireSetup()` | LOW | Skip -- middleware, better as integration test |
| `server/shared/middlewares/body-limit.ts` | `createBodyLimitMiddleware()` | LOW | Skip -- delegates to Hono built-in |
| `server/features/review/service.ts` | `streamActiveSessionToSSE()`, `streamReviewToSSE()` | MEDIUM | Skip -- orchestration with side effects, better as integration test |
| `web/features/home/utils/shutdown.ts` | `shutdown()` | LOW | Skip -- single API call |

**Recommendation:** None of these warrant new unit tests. They are either trivial, thin wrappers, or integration-level code better tested via route integration tests (Phase 5 of the audit).

### 3.3 Coverage Adequacy Notes

Some existing test files may have lower-than-ideal counts relative to audit estimates:

| # | File | Actual | Audit Est. | Notes |
|---|------|--------|-----------|-------|
| 2 | `orchestrate.ts` | 9 | 8-12 | Adequate -- within range |
| 21 | `http/response.ts` | 4 | ~4 | Module is 29 lines, 4 tests is sufficient |
| 24 | `enrichment.ts` | 6 | ~6 | Adequate |
| 37 | `api/review.ts` | 5 | 5-7 | Adequate -- could add 1-2 edge cases |
| 55 | `use-review-settings.ts` | 4 | ~3 | Module is 19 lines, 4 tests is adequate |
| 63 | `severity-bar.tsx` | 4 | ~4 | Module is 29 lines, sufficient |

No files have dangerously low coverage relative to their complexity.

---

## Section 4: Consolidated Testing Rules

### 4.1 What to Test

1. Pure functions with branching (parsers, formatters, validators, mappers)
2. Error handling paths -- what happens when things fail
3. Edge cases at boundaries -- empty inputs, off-by-one, null/undefined
4. State machines and reducers -- every action type, every branch
5. Security-critical code -- XML escaping, path traversal, CORS, host validation
6. Custom schema validation -- `.refine()`, `.transform()` only
7. Business logic -- validation rules, calculations, transformations
8. Integration points -- API responses, service interactions
9. User-visible behavior -- what user sees/clicks, form submissions

### 4.2 What NOT to Test

1. Constants, re-exports, barrel files (`index.ts`, `severity.ts`)
2. Framework behavior (React rendering, Hono routing, Zod built-in validators)
3. Trivial constructors that can't break (`ok()`, `err()`, `createError()`)
4. Implementation details (internal state, hook call counts)
5. CSS/styling, pure UI components (props-to-JSX)
6. Third-party library behavior
7. Code that requires heavy mocking of internal modules
8. Complex DOM-dependent hooks (better as E2E)
9. Plain Zod schemas (90% of `packages/schemas/`)
10. Thin API wrappers with no branching (`api/config.ts`, `api/git.ts`, `api/bound.ts`)
11. Route handlers (test as integration tests later)
12. CLI components (Ink is hard to test, web is source of truth)

### 4.3 Test Quality Rules

1. **AAA pattern**: Arrange -> Act -> Assert
2. **One behavior per test** -- related assertions OK, unrelated = split
3. **Mock at boundaries only** -- fetch, fs, AI providers, keyring, Date/timers
4. **No snapshots** -- assert specific values
5. **Test names describe behavior**: `should return error when file not found`
6. **Co-locate tests**: `parser.ts` -> `parser.test.ts` (same folder)
7. **Simple test data** -- no faker, no over-engineered factories
8. **No manual memoization testing** -- React 19 Compiler auto-memoizes

### 4.4 React Testing Rules

1. **Query priority**: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
2. **Use `userEvent`** not `fireEvent`
3. **Async**: Use `waitFor()` or `findBy*`, never arbitrary timeouts
4. **Don't test implementation**: No spying on `useState`, no checking internal state

### 4.5 Security Patterns Requiring Test Coverage

| Pattern | CVE | What to Verify |
|---------|-----|----------------|
| CORS localhost restriction | CVE-2024-28224 | Reject non-localhost origins, allow localhost/127.0.0.1 |
| XML escaping in prompts | CVE-2025-53773 | `<`, `>`, `&` are escaped in all user content |
| Host header validation | CVE-2024-28224 | Reject non-localhost Host headers |
| Security headers | -- | X-Frame-Options: DENY, X-Content-Type-Options: nosniff |
| Path traversal prevention | -- | Reject `..`, null bytes in paths |
| Trust capability check | -- | Block operations when trust is insufficient |

### 4.6 Protected Patterns (Must Preserve in Tests)

- `Result<T, E>` -- always test both `ok` and `error` branches
- Provider abstraction -- don't hardcode single provider in tests
- Safe index access with `??` fallback -- test undefined index case
- `@repo/api` client -- test through it, don't mock it away

### 4.7 Error Handling Pattern

All tests for functions returning `Result<T, E>` must:
```typescript
// Test success case
const result = await fn(validInput);
expect(result.ok).toBe(true);
expect(result.value).toEqual(expected);

// Test error case
const result = await fn(invalidInput);
expect(result.ok).toBe(false);
expect(result.error.code).toBe('EXPECTED_CODE');
```

Do NOT use try/catch in tests for Result-returning functions.

---

## Section 5: Gap-Filling Team Prompt

The following is a self-contained prompt for a new agent team to fill all remaining test gaps.

---

### BEGIN PROMPT

You are tasked with writing tests for 16 untested files in the Stargazer project. This is a TypeScript pnpm monorepo with an embedded web UI for AI code review.

#### Project Context

- **Monorepo root**: `/home/b4r7/Projects/stargazer`
- **Test runner**: Vitest (already installed and configured)
- **Test command**: `pnpm test` (runs all), or per-package: `cd apps/server && pnpm test`, `cd apps/web && pnpm test`
- **Vitest configs**: Already exist in `apps/server/`, `apps/web/`, `packages/core/`, `packages/api/`, `packages/schemas/`
- **Web test environment**: jsdom (configured in `apps/web/vitest.config.ts` with `@/` alias and react plugin)
- **53 test files already exist with 660 tests** -- your job is to fill the remaining 16 gaps

#### Critical Rules

1. **Co-locate tests**: Place `foo.test.ts` next to `foo.ts` in the same directory.
2. **AAA pattern**: Arrange -> Act -> Assert. One behavior per test.
3. **Mock at boundaries only**: Mock `fetch`, `fs`, AI providers, keyring, `Date`/timers. NEVER mock internal modules.
4. **No snapshots**: Assert specific values.
5. **Test names**: `it('should [behavior] when [condition]')`.
6. **Result<T, E>**: Test both `ok: true` and `ok: false` branches. Never use try/catch for Result-returning functions.
7. **React hooks**: Use `renderHook` from `@testing-library/react`. Use `act()` for state updates.
8. **React components**: Use `render` from `@testing-library/react`. Query by role, not testId. Use `userEvent`, not `fireEvent`.
9. **No manual memoization**: React 19 Compiler handles it. Don't test useCallback/useMemo.
10. **Simple test data**: No faker. Just inline objects.
11. **Import style**: ESM only. `import { describe, it, expect, vi } from 'vitest'`.

#### Files to Test (16 gaps)

##### Gap 1: `apps/server/src/shared/middlewares/trust-guard.ts`
- **Test file**: `apps/server/src/shared/middlewares/trust-guard.test.ts`
- **Target**: 4-6 tests
- **What to test**:
  - Middleware allows request when trust capability is present/sufficient
  - Middleware blocks request (returns 403) when trust is insufficient
  - Edge cases: missing trust header, empty trust value
- **How to mock**: Create mock Hono `Context` and `next()` function. Mock the trust-checking mechanism (read the source to see how trust is determined -- likely reads from config or header).
- **Priority**: HIGH (security)

##### Gap 2: `apps/server/src/features/review/drilldown.ts`
- **Test file**: `apps/server/src/features/review/drilldown.test.ts`
- **Target**: 8-12 tests
- **What to test**:
  - Successfully looks up an issue by ID and returns drilldown result
  - Returns error when issue ID not found
  - Handles AI client errors gracefully (returns Result error)
  - Saves drilldown result after successful AI call
  - Handles abort/cancellation
- **How to mock**: Mock the storage layer (file I/O), mock the AI client. Do NOT mock internal utility functions.
- **Priority**: HIGH

##### Gap 3: `apps/server/src/features/review/context.ts`
- **Test file**: `apps/server/src/features/review/context.test.ts`
- **Target**: 10-15 tests
- **What to test**:
  - Workspace discovery returns correct file tree structure
  - File tree building handles nested directories
  - Cache check returns cached result when available
  - Cache check returns null/miss when cache expired
  - Empty workspace (no files) returns empty tree
  - Handles file system errors gracefully
  - Large directory trees are handled without infinite recursion
- **How to mock**: Mock `fs` operations (readdir, stat). Mock any caching layer.
- **Priority**: HIGH

##### Gap 4: `apps/web/src/features/review/hooks/use-review-lifecycle.ts`
- **Test file**: `apps/web/src/features/review/hooks/use-review-lifecycle.test.ts`
- **Target**: 10-15 tests
- **What to test**:
  - Initial state is idle/ready
  - Starting a review transitions to loading/running state
  - Completion transitions to completed state with delay
  - Error during review transitions to error state
  - Abort cancels the review
  - Resume logic after disconnect
  - State machine transitions are valid (no illegal transitions)
- **How to mock**: Mock the API client (`@repo/api` or fetch). Use `vi.useFakeTimers()` for completion delays. Use `renderHook` from `@testing-library/react`.
- **Priority**: HIGH

##### Gap 5: `apps/web/src/app/providers/config-provider.tsx`
- **Test file**: `apps/web/src/app/providers/config-provider.test.tsx`
- **Target**: 8-12 tests
- **What to test**:
  - Provides config context to children
  - `isConfigured` derivation is correct (true when provider + API key exist)
  - `isConfigured` is false when no provider configured
  - Cache TTL: stale data triggers refetch
  - Each async operation (load, save, etc.) updates context correctly
  - Error states are propagated
  - Split context: config value context vs config dispatch context
- **How to mock**: Mock fetch/API calls. Use `renderHook` with wrapper providing the provider. Use `vi.useFakeTimers()` for cache TTL.
- **Priority**: HIGH

##### Gap 6: `apps/web/src/app/providers/keyboard-provider.tsx`
- **Test file**: `apps/web/src/app/providers/keyboard-provider.test.tsx`
- **Target**: 6-8 tests
- **What to test**:
  - Registers handler and dispatches matching keydown events
  - Scope stack: inner scope shadows outer scope handlers
  - Unregistering a handler stops it from firing
  - Multiple handlers for different keys in same scope
  - Handler not called when scope is not active
- **How to mock**: Use `renderHook` with wrapper. Simulate keydown events on document.
- **Priority**: MEDIUM

##### Gap 7: `apps/web/src/hooks/keyboard/use-selectable-list.ts`
- **Test file**: `apps/web/src/hooks/keyboard/use-selectable-list.test.ts`
- **Target**: 6-8 tests
- **What to test**:
  - Navigation moves selection down/up
  - Wrapping: going past end wraps to beginning (and vice versa)
  - Disabled items are skipped during navigation
  - Boundary callbacks fire at list start/end
  - Empty list edge case
  - Single item list
- **How to mock**: Use `renderHook`. Mock keyboard provider if needed, or test the pure navigation logic.
- **Priority**: MEDIUM

##### Gap 8: `apps/web/src/hooks/use-settings.ts`
- **Test file**: `apps/web/src/hooks/use-settings.test.ts`
- **Target**: 4-6 tests
- **What to test**:
  - Returns cached settings when within TTL
  - Fetches fresh settings when cache expired
  - Request deduplication: concurrent calls result in single fetch
  - Lazy fetch: no fetch until first access
  - Error handling on fetch failure
- **How to mock**: Mock fetch. Use `vi.useFakeTimers()` for TTL.
- **Priority**: MEDIUM

##### Gap 9: `apps/web/src/features/providers/hooks/use-openrouter-models.ts`
- **Test file**: `apps/web/src/features/providers/hooks/use-openrouter-models.test.ts`
- **Target**: 8-10 tests
- **What to test**:
  - Reducer: initial state
  - Reducer: loading models action
  - Reducer: models loaded action with filtering
  - Compatibility filtering removes incompatible models
  - Dialog open/close lifecycle
  - Model selection updates state
  - Error state on fetch failure
- **How to mock**: Mock fetch for model list API. Use `renderHook`. Test reducer directly if exported, otherwise test through hook.
- **Priority**: MEDIUM

##### Gap 10: `apps/web/src/app/providers/theme-provider.tsx`
- **Test file**: `apps/web/src/app/providers/theme-provider.test.tsx`
- **Target**: 5-7 tests
- **What to test**:
  - Default theme is applied (system or light)
  - Theme resolution priority: explicit setting > system preference
  - System theme detection (matchMedia mock)
  - Settings override changes theme
  - Theme change updates DOM/context
- **How to mock**: Mock `window.matchMedia`. Mock settings API. Use `renderHook` with wrapper.
- **Priority**: MEDIUM

##### Gap 11: `apps/web/src/features/providers/hooks/use-api-key-form.ts`
- **Test file**: `apps/web/src/features/providers/hooks/use-api-key-form.test.ts`
- **Target**: 5-7 tests
- **What to test**:
  - `canSubmit` is false when key is empty
  - `canSubmit` is true when key is non-empty
  - Method-dependent value handling
  - Double-submit prevention (disabled after first submit until complete)
  - Form reset
- **How to mock**: Use `renderHook`. Minimal mocking needed -- this is mostly state logic.
- **Priority**: MEDIUM

##### Gap 12: `apps/web/src/features/history/hooks/use-reviews.ts`
- **Test file**: `apps/web/src/features/history/hooks/use-reviews.test.ts`
- **Target**: 5-7 tests
- **What to test**:
  - Optimistic delete: item removed from list immediately
  - Rollback on error: item restored after failed delete
  - Success path: item stays deleted after confirmed
  - Loading states during fetch
  - Empty state when no reviews
- **How to mock**: Mock fetch/API. Use `renderHook`. Use `act()` for async updates.
- **Priority**: MEDIUM

##### Gap 13: `apps/web/src/components/ui/form/checkbox.tsx`
- **Test file**: `apps/web/src/components/ui/form/checkbox.test.tsx`
- **Target**: 6-8 tests
- **What to test**:
  - Controlled mode: checked prop controls state
  - Uncontrolled mode: clicking toggles internal state
  - CheckboxGroup: selecting adds to array value
  - CheckboxGroup: deselecting removes from array value
  - Enter key triggers toggle + onEnter callback
  - Disabled checkbox doesn't toggle
- **How to mock**: Use `render` + `userEvent`. Minimal mocking.
- **Priority**: LOW

##### Gap 14: `apps/web/src/components/ui/form/radio-group.tsx`
- **Test file**: `apps/web/src/components/ui/form/radio-group.test.tsx`
- **Target**: 6-8 tests
- **What to test**:
  - Controlled mode: value prop controls selection
  - Uncontrolled mode: clicking selects radio
  - Keyboard navigation selects adjacent radio
  - `onFocusZoneEnter` fires before `onValueChange`
  - Only one radio selected at a time
  - Disabled radio is not selectable
- **How to mock**: Use `render` + `userEvent`. May need to mock keyboard provider or `useGroupNavigation`.
- **Priority**: LOW

##### Gap 15: `apps/web/src/features/review/components/activity-log.tsx`
- **Test file**: `apps/web/src/features/review/components/activity-log.test.tsx`
- **Target**: 4-5 tests
- **What to test**:
  - Auto-scrolls to bottom when new entries added and user is near bottom (within 50px)
  - Does NOT auto-scroll when user has scrolled up (more than 50px from bottom)
  - Scroll-to-bottom button appears when not at bottom
  - Empty log state
- **How to mock**: Use `render`. Mock `scrollHeight`, `scrollTop`, `clientHeight` on the scroll container. Use `vi.useFakeTimers()` if there are animation frames.
- **Priority**: LOW

#### Execution Steps

1. **Read each source file** before writing its test. Understand the exports, branching logic, and dependencies.
2. **Write tests** in the co-located test file (same directory as source).
3. **Run tests incrementally** after each file:
   ```bash
   # Server tests
   cd /home/b4r7/Projects/stargazer && pnpm --filter server test

   # Web tests
   cd /home/b4r7/Projects/stargazer && pnpm --filter web test

   # All tests
   cd /home/b4r7/Projects/stargazer && pnpm test
   ```
4. **Fix any failures** before moving to the next file.
5. **Verify all tests pass** at the end with `pnpm test`.

#### Existing Patterns to Follow

Look at these existing test files for style reference:
- `apps/server/src/shared/lib/diff/parser.test.ts` -- server unit test pattern (22 tests)
- `apps/server/src/shared/lib/review/prompts.test.ts` -- security test pattern (22 tests)
- `apps/web/src/app/providers/keyboard-utils.test.ts` -- web utility test pattern (15 tests)
- `apps/web/src/features/review/hooks/use-review-stream.test.ts` -- hook test pattern (13 tests)
- `apps/web/src/components/ui/dialog/dialog-content.test.tsx` -- component test pattern (6 tests)
- `packages/core/src/review/review-state-gaps.test.ts` -- reducer gap-fill pattern (26 tests)

#### Expected Outcome

- 16 new test files
- ~95-134 new tests
- All tests pass with `pnpm test`
- Total project: 69 test files, ~755-794 tests

### END PROMPT

---

## Appendix: Complete Test File Inventory

| # | Test File (relative to project root) | Tests | New? |
|---|--------------------------------------|-------|------|
| 1 | `packages/core/src/review/filtering.test.ts` | 14 | Pre-existing |
| 2 | `packages/core/src/review/review-state.test.ts` | 14 | Pre-existing |
| 3 | `packages/core/src/streaming/sse-parser.test.ts` | 28 | Pre-existing |
| 4 | `packages/core/src/format.test.ts` | 9 | New |
| 5 | `packages/core/src/errors.test.ts` | 13 | New |
| 6 | `packages/core/src/json.test.ts` | 9 | New |
| 7 | `packages/core/src/strings.test.ts` | 9 | New |
| 8 | `packages/core/src/review/event-to-log.test.ts` | 23 | New |
| 9 | `packages/core/src/review/review-state-gaps.test.ts` | 26 | New |
| 10 | `packages/core/src/review/stream-review.test.ts` | 10 | New |
| 11 | `packages/api/src/client.test.ts` | 19 | New |
| 12 | `packages/api/src/review.test.ts` | 5 | New |
| 13 | `packages/schemas/src/review/storage.test.ts` | 5 | New |
| 14 | `packages/schemas/src/ui/ui.test.ts` | 6 | New |
| 15 | `packages/schemas/src/config/providers.test.ts` | 5 | New |
| 16 | `apps/server/src/shared/lib/git/errors.test.ts` | 10 | New |
| 17 | `apps/server/src/shared/lib/fs.test.ts` | 11 | New |
| 18 | `apps/server/src/shared/lib/review/issues.test.ts` | 27 | New |
| 19 | `apps/server/src/shared/lib/paths.test.ts` | 14 | New |
| 20 | `apps/server/src/shared/lib/review/utils.test.ts` | 9 | New (bonus) |
| 21 | `apps/server/src/features/review/schemas.test.ts` | 8 | New |
| 22 | `apps/server/src/shared/lib/review/orchestrate.test.ts` | 9 | New |
| 23 | `apps/server/src/app.test.ts` | 9 | New |
| 24 | `apps/server/src/features/review/utils.test.ts` | 20 | New |
| 25 | `apps/server/src/shared/lib/validation.test.ts` | 6 | New |
| 26 | `apps/server/src/shared/lib/git/service.test.ts` | 16 | New |
| 27 | `apps/server/src/shared/lib/review/prompts.test.ts` | 22 | New |
| 28 | `apps/server/src/features/review/sessions.test.ts` | 19 | New |
| 29 | `apps/server/src/shared/lib/diff/parser.test.ts` | 22 | New |
| 30 | `apps/server/src/shared/lib/storage/persistence.test.ts` | 20 | New |
| 31 | `apps/server/src/features/review/pipeline.test.ts` | 13 | New |
| 32 | `apps/server/src/features/review/enrichment.test.ts` | 6 | New |
| 33 | `apps/server/src/shared/lib/http/response.test.ts` | 4 | New |
| 34 | `apps/server/src/shared/lib/config/state.test.ts` | 18 | New |
| 35 | `apps/server/src/shared/lib/ai/client.test.ts` | 16 | New |
| 36 | `apps/server/src/features/git/service.test.ts` | 10 | New |
| 37 | `apps/server/src/shared/lib/ai/openrouter-models.test.ts` | 11 | New |
| 38 | `apps/server/src/shared/lib/config/store.test.ts` | 24 | New |
| 39 | `apps/server/src/shared/lib/storage/reviews.test.ts` | 16 | New |
| 40 | `apps/server/src/shared/lib/config/keyring.test.ts` | 9 | New |
| 41 | `apps/server/src/features/config/service.test.ts` | 15 | New |
| 42 | `apps/web/src/features/review/components/review-container.utils.test.ts` | 9 | New |
| 43 | `apps/web/src/features/history/utils.test.ts` | 16 | New |
| 44 | `apps/web/src/app/providers/keyboard-utils.test.ts` | 15 | New |
| 45 | `apps/web/src/features/providers/hooks/use-model-filter.test.ts` | 9 | New |
| 46 | `apps/web/src/features/review/hooks/use-review-error-handler.test.ts` | 9 | New |
| 47 | `apps/web/src/hooks/use-scoped-route-state.test.ts` | 7 | New |
| 48 | `apps/web/src/features/review/hooks/use-review-settings.test.ts` | 4 | New |
| 49 | `apps/web/src/components/ui/toast/toast-context.test.tsx` | 9 | New |
| 50 | `apps/web/src/components/ui/severity/severity-bar.test.tsx` | 4 | New |
| 51 | `apps/web/src/components/ui/menu/menu.test.tsx` | 7 | New |
| 52 | `apps/web/src/components/ui/dialog/dialog-content.test.tsx` | 6 | New |
| 53 | `apps/web/src/features/review/hooks/use-review-stream.test.ts` | 13 | New |
