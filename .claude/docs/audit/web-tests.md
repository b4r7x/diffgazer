# Web Test Audit

## Summary

- **Total test files audited**: 15
- **Tests overengineered**: 1 (keyboard-utils contentEditable test is conditionally skipped, borderline)
- **Tests with quality issues**: 4
- **Missing coverage gaps**: 7 important untested hooks/providers
- **Overall quality**: Good. Most tests follow project guidelines well. A few minor issues and some significant missing coverage.

### Verdicts at a Glance

| File | Verdict | Tests |
|------|---------|-------|
| review-container.utils.test.ts | OK | 9 |
| history/utils.test.ts | OK | 12 |
| keyboard-utils.test.ts | MINOR_ISSUES | 10 |
| use-model-filter.test.ts | OK | 8 |
| toast-context.test.tsx | OK | 8 |
| menu.test.tsx | MINOR_ISSUES | 7 |
| dialog-content.test.tsx | NEEDS_FIX | 6 |
| use-review-completion.test.ts | OK | 5 |
| use-review-start.test.ts | OK | 4 |
| use-api-key-form.test.ts | MISSING_COVERAGE | 4 |
| use-selectable-list.test.ts | OK | 12 |
| use-reviews.test.ts | MINOR_ISSUES | 3 |
| theme-provider.test.tsx | MINOR_ISSUES | 3 |
| use-scoped-route-state.test.ts | MISSING_COVERAGE | 5 |
| use-settings.test.ts | OK | 3 |

---

## Per-File Audit

### review-container.utils.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/features/review/components/review-container.utils.ts`
**Verdict**: OK
**Test count**: 9 tests

#### Issues Found
- None significant. Clean AAA pattern, good test names, covers all branches.

#### Missing Coverage
- `truncate` behavior for long `currentAction` strings is tested implicitly (via the source calling `truncate`). The function itself is in `@stargazer/core/strings` and should be tested there, not here. Acceptable.
- Edge case: agents with `error` status detail string ("error") -- covered at line 70.

#### Overengineering
- None. This is a pure transform function with real branching logic. Good target for unit tests.

---

### history/utils.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/features/history/utils.tsx`
**Verdict**: OK
**Test count**: 12 tests (4 getDateLabel + 1 getDateKey + 4 formatDuration + 4 buildTimelineItems)

#### Issues Found
- None. Uses fake timers correctly for date-dependent tests. Good edge case coverage for `formatDuration` (null, undefined, 0, sub-second, seconds, minutes).

#### Missing Coverage
- `getTimestamp()` function (line 19-21) is not tested. It is a simple locale formatter but could have locale-dependent issues in CI. Low risk, acceptable to skip.
- `getRunSummary()` function (lines 23-44) is not tested. It has real branching (0 issues, specific severity counts, comma joining). It returns JSX so it would need render testing. **Moderate gap** -- the logic branches (blocker/high/medium/low counts, singular vs plural, empty parts fallback) warrant testing.

#### Overengineering
- None.

---

### keyboard-utils.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/app/providers/keyboard-utils.ts`
**Verdict**: MINOR_ISSUES
**Test count**: 10 tests (8 matchesHotkey + 7 isInputElement, but 2 overlap in describe block)

#### Issues Found
- Line 84-88: The contentEditable test conditionally skips the assertion (`if (div.isContentEditable !== undefined)`). This means it might silently pass without actually testing anything in jsdom. Either fix the jsdom setup or mark the test as `it.skip` with a comment explaining why.
- Line 72-73: Uses `toBeFalsy()` instead of `toBe(false)`. The function explicitly returns `boolean`, so `toBe(false)` would be more precise and consistent with the other tests in the file.

#### Missing Coverage
- `matchesHotkey` with `meta` modifier (Cmd key on macOS) -- not tested but the source supports it.
- `matchesHotkey` with `alt` modifier -- not tested.
- These are low risk since the modifier matching logic is uniform.

#### Overengineering
- None. The source has 37 lines of real branching logic. 10 tests is appropriate.

---

### use-model-filter.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/features/providers/hooks/use-model-filter.ts`
**Verdict**: OK
**Test count**: 8 tests

#### Issues Found
- None. Clean renderHook + act pattern. Tests all public API: search, tier filter, cycle, reset, combined filters, empty list.

#### Missing Coverage
- Search with whitespace-only query (the source trims). Minor edge case.
- Case sensitivity of description matching (the source lowercases). Tested implicitly via "anthropic" matching "Anthropic model".

#### Overengineering
- None.

---

### toast-context.test.tsx
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/components/ui/toast/toast-context.tsx`
**Verdict**: OK
**Test count**: 8 tests

#### Issues Found
- Line 8-10: Mocking `crypto.randomUUID` globally is fine for deterministic IDs, but uses a counter that persists across tests. The `beforeEach` resets it (line 19), so this is handled correctly.
- The test for "throw when useToast is used outside provider" (line 97-101) tests `useToast` but the source also exports `useToastData` and `useToastActions` which have their own throws. Minor gap.

#### Missing Coverage
- `removeToast` clears the timeout (line 54-58 in source). Not explicitly tested that clearing prevents auto-dismiss, but the behavior is implicitly correct since the toast is removed.
- Toast with `duration` of 0 or negative -- edge case, low risk.

#### Overengineering
- None. Toast queue with timers is exactly the kind of stateful logic that needs testing.

---

### menu.test.tsx
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/components/ui/menu/menu.tsx`
**Verdict**: MINOR_ISSUES
**Test count**: 7 tests

#### Issues Found
- Line 9-12: Mocks `@/hooks/keyboard` (useKey, useKeys) as no-ops. This means keyboard navigation (ArrowUp/ArrowDown/Enter/number keys) is completely untested. The mock is necessary because keyboard hooks depend on KeyboardContext, but it means the most complex logic in the component (`findNextIndex`, navigation skipping disabled items, number key jump) is not covered.
- Lines 22-23: Uses `toBeDefined()` instead of `toBeInTheDocument()`. While functionally similar in this context, `toBeInTheDocument()` is the testing-library convention and reads better.
- Manual `unmount()` calls at end of every test are unnecessary -- React Testing Library cleans up automatically via `afterEach`.

#### Missing Coverage
- **Keyboard navigation** (ArrowUp/Down skipping disabled items, Enter activation) -- not testable with current mock strategy. Consider testing `findNextIndex` logic if extracted, or using a KeyboardProvider wrapper.
- **Number key jump** (`enableNumberJump` + digit keys) -- not tested.
- Nested Fragment children deeper than one level.

#### Overengineering
- None. The tests that exist are reasonable.

---

### dialog-content.test.tsx
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/components/ui/dialog/dialog-content.tsx`
**Verdict**: NEEDS_FIX
**Test count**: 6 tests

#### Issues Found
- Line 70-76: **Backdrop click test is fragile**. Uses `document.querySelector('[aria-hidden="true"]')` to find the backdrop, then wraps the assertion in an `if (backdrop)` guard. If the selector fails to find the element (DOM structure change), the test silently passes. Should use a more robust query or fail explicitly if backdrop is not found.
- Line 85: `document.activeElement?.textContent` check is fragile -- depends on jsdom focus behavior which may differ from real browsers.
- Uses `toBeDefined()` instead of `toBeInTheDocument()` in several places.

#### Missing Coverage
- **Focus trap Tab/Shift+Tab cycling** -- the most important behavior of this component. The `useFocusTrap` hook handles Tab key wrapping (lines 28-46 in source) but this is not tested at all.
- **Body scroll lock** (line 10-12) -- `document.body.style.overflow = 'hidden'` and restoration on unmount.
- **Focus restore on unmount** (line 52) -- `previousFocus?.focus()` when dialog closes.
- **Escape key to close** -- if supported.

#### Overengineering
- None. The existing tests are appropriate; the problem is missing coverage of the most critical behavior (focus trap).

---

### use-review-completion.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/features/review/hooks/use-review-completion.ts`
**Verdict**: OK
**Test count**: 5 tests

#### Issues Found
- None. Clean timer-based testing with fake timers. Tests the key branches: default delay vs report-complete delay, error suppresses completion, cleanup on unmount.

#### Missing Coverage
- `hasStreamed: false` should prevent completion (line 42 in source: `wasStreaming && !isStreaming && hasStreamed && !error`). The tests always pass `hasStreamed: true`. Minor gap.
- What happens if `onComplete` is called and then the error changes -- timeout already cleared by cleanup effect.

#### Overengineering
- None.

---

### use-review-start.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/features/review/hooks/use-review-start.ts`
**Verdict**: OK
**Test count**: 4 tests

#### Issues Found
- None. Tests the four main branches: start fresh, resume, fallback on SESSION_STALE, onResumeFailed on SESSION_NOT_FOUND.

#### Missing Coverage
- `configLoading: true` or `settingsLoading: true` should prevent starting. Not tested but the guard is simple (`if (configLoading || settingsLoading || !isConfigured) return`).
- `isConfigured: false` should prevent starting. Same guard.
- The `ignore` flag cleanup (line 71) -- unmounting during async operation. Low risk.
- Resume `.catch()` branch (line 64) -- transport/runtime errors. Low risk.

#### Overengineering
- None.

---

### use-api-key-form.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/features/providers/hooks/use-api-key-form.ts`
**Verdict**: MISSING_COVERAGE
**Test count**: 4 tests

#### Issues Found
- None in existing tests. They correctly test canSubmit logic and double-submit prevention.

#### Missing Coverage
- **Error handling**: `handleSubmit` catching errors and setting `error` state (lines 36-37 in source). Not tested.
- **handleRemove**: Entire `handleRemove` function (lines 43-55) is not tested at all -- submit guard, onRemoveKey call, error handling, onOpenChange(false) on success.
- **onOpenChange(false)** called on successful submit (line 35). Not tested.
- **setKeyValue("")** reset on successful submit (line 34). Not tested.

#### Overengineering
- None.

---

### use-selectable-list.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/hooks/keyboard/use-selectable-list.ts`
**Verdict**: OK
**Test count**: 12 tests

#### Issues Found
- Lines 7-13: Mocks `./use-keys` to capture handlers. This is a pragmatic approach to avoid needing a full KeyboardProvider. The mock captures the exact handler references, which is acceptable for testing navigation logic.
- Lines 101-123: The `onBoundaryReached` test acknowledges in comments that the boundary callback only fires when `focusedIndex` changes, and the test verifies the index stays put. The test name says "should call onBoundaryReached" but the callback is NOT called because the index doesn't change (the effect only runs on `focusedIndex` change). The test is accurate to the implementation but the test name is misleading.

#### Missing Coverage
- `enabled: false` disabling navigation. Minor.
- `setFocusedIndex` manual setter (exposed in return value). Minor.
- Custom `upKeys`/`downKeys` props. Minor.
- `itemCount: 0` with moveUp/moveDown (early return in source). Minor.

#### Overengineering
- None. Navigation with disabled items and wrapping is complex enough to warrant 12 tests.

---

### use-reviews.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/features/history/hooks/use-reviews.ts`
**Verdict**: MINOR_ISSUES
**Test count**: 3 tests

#### Issues Found
- Line 4-9: Mocks `@/lib/api` at the module level -- acceptable boundary mock.
- Tests 1 and 3 are partially redundant (both test successful delete; test 3 adds the assertion on `mockDeleteReview` call and `error` being null).

#### Missing Coverage
- **Initial fetch error handling** -- `api.getReviews` rejecting. The source sets `error` state (line 18). Not tested.
- **`isLoading` initial state** -- should be true before fetch completes. Partially tested (waitFor checks it becomes false) but the initial `true` is not explicitly asserted.
- **`refresh` function** -- exposed but not tested.
- **`projectPath` parameter** -- filtering by project path. Not tested.
- **`error` state after delete failure** -- the source sets error on catch (line 28). The test checks rollback but not error state.

#### Overengineering
- None.

---

### theme-provider.test.tsx
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/app/providers/theme-provider.tsx`
**Verdict**: MINOR_ISSUES
**Test count**: 3 tests

#### Issues Found
- Mocks both `useSettings` and `api` at module level. The `api` mock is unused in current tests (no test calls `setTheme`). Harmless but unnecessary.
- Tests only check `data-theme` attribute on `document.documentElement`. This is the observable behavior, which is good.

#### Missing Coverage
- **`setTheme` function**: Not tested. The source persists to localStorage AND calls `api.saveSettings`. This is the main action the provider exposes.
- **`mapSettingsTheme("terminal")` mapping to "dark"**: Not tested. The source has special handling for "terminal" theme (line 28).
- **`resolveWebTheme` with invalid values**: Falls back to "auto". Not tested.
- **localStorage fallback** when no settings are available. The source reads from localStorage on init (line 45). Not tested.
- **System theme change listener**: `useSyncExternalStore` with `subscribeToSystemTheme`. Not tested that theme updates when system preference changes.

#### Overengineering
- None.

---

### use-scoped-route-state.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/hooks/use-scoped-route-state.ts`
**Verdict**: MISSING_COVERAGE
**Test count**: 5 tests

#### Issues Found
- Line 14-16: Mocks `@tanstack/react-router` with static pathname "/test". This means route-scoping cannot be tested (all tests use the same route). The key feature of this hook -- different state per route -- is not verified.

#### Missing Coverage
- **Route scoping**: State isolated by pathname. The mock returns a static pathname, so this is completely untested.
- **MAX_ENTRIES eviction** (line 6-7 in source): When >100 entries are stored, oldest are pruned. Not tested.
- **Cross-component subscription**: Two components using the same key should sync via `useSyncExternalStore`. Partially tested in "should share state for same key" test, but this relies on the external store's subscriber notification, which is implicitly tested.
- **Server snapshot** (line 56): The `getServerSnapshot` callback returns `defaultValue`. Not tested (SSR scenario).

#### Overengineering
- None.

---

### use-settings.test.ts
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/hooks/use-settings.ts`
**Verdict**: OK
**Test count**: 3 tests

#### Issues Found
- Module-level `cache` variable in source (line 6) persists across tests. The tests work because each `renderHook` triggers a fetch that overwrites the cache. But test isolation depends on execution order. Could be fragile if tests run in different order.

#### Missing Coverage
- **Cache TTL expiration**: The source checks `Date.now() - cache.timestamp > DEFAULT_TTL` (line 13). Not tested that stale cache triggers refetch.
- **Request deduplication**: `inflightPromise` prevents concurrent fetches (line 28-29). Not tested.
- **Fetch error handling**: The `.catch(() => {})` in `triggerFetch` (line 35). Not tested.
- **`isLoading` state**: Derived from `!snapshot && !getCached()`. Not explicitly tested.

#### Overengineering
- None.

---

## Missing Test Files (Tier 1 Web Items Without Tests)

These hooks/providers from the test-audit.md tier 1 list have NO test files:

### 1. use-review-stream.ts (HIGH PRIORITY)
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/features/review/hooks/use-review-stream.ts` (190 lines)
**Why it matters**: Contains a reducer (`webReviewReducer`), rAF-based event batching (`enqueueEvent`), abort handling, and resume logic. This is the core streaming state machine for the review feature.
**What to test**:
- `webReviewReducer` -- can be extracted and tested as a pure function (START, RESET, SET_REVIEW_ID, EVENT with review_started, generic EVENT passthrough)
- `start` / `resume` / `stop` lifecycle (mock `api.streamReviewWithEvents`)
- Error handling: AbortError vs generic error
- Event batching (review_started bypasses queue)

### 2. use-review-lifecycle.ts (MEDIUM PRIORITY)
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/features/review/hooks/use-review-lifecycle.ts` (187 lines)
**Why it matters**: Orchestrates the entire review flow -- composes useReviewStream, useReviewSettings, useReviewStart, useReviewCompletion. Has derived state logic (isNoDiffError, isCheckingForChanges, loadingMessage).
**What to test**: The derived state computations and handler behaviors. However, this is primarily a composition hook with heavy dependencies (useNavigate, useParams, config provider). Testing the composed sub-hooks individually (which IS being done) may be sufficient. **Lower priority** than use-review-stream.

### 3. use-review-settings.ts (LOW PRIORITY)
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/features/review/hooks/use-review-settings.ts` (16 lines)
**Why it matters**: LensId validation with fallback to FALLBACK_LENSES. Only 16 lines.
**What to test**: Invalid lenses filtered out, empty settings uses fallback, partial valid lenses kept. Simple enough that a few tests would suffice.

### 4. use-review-error-handler.ts (LOW PRIORITY)
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/features/review/hooks/use-review-error-handler.ts` (51 lines)
**What to test**: `isApiError` type guard (pure function, 5 branches), status-to-message mapping (400, 404, other). The hook itself depends on useToast and useNavigate.
**Recommendation**: Test `isApiError` as a pure function. The hook's mapping logic is straightforward.

### 5. config-provider.tsx (MEDIUM PRIORITY)
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/app/providers/config-provider.tsx` (292 lines)
**Why it matters**: Cache TTL, 5 async operations (refresh, activateProvider, saveCredentials, deleteProviderCredentials, updateAfterAction), isConfigured derivation, split context pattern.
**What to test**: Cache hit vs miss, invalidation, error states for each async operation, isConfigured derivation.

### 6. keyboard-provider.tsx (LOW PRIORITY)
**Source**: `/home/b4r7/Projects/stargazer/apps/web/src/app/providers/keyboard-provider.tsx` (80 lines)
**Why it matters**: Scope stack management, handler registry, keydown dispatch with input element filtering.
**What to test**: pushScope/popScope lifecycle, handler registration/deregistration, scope isolation (only active scope handlers fire), isInputElement filtering.

### 7. use-openrouter-models.ts (FILE NOT FOUND)
The file referenced in test-audit.md (`web/features/providers/hooks/use-openrouter-models.ts`) does not exist. It may have been removed or renamed.

---

## Action Items

### Priority 1 -- Fix Existing Tests
1. **dialog-content.test.tsx**: Fix the backdrop click test to fail explicitly if backdrop element is not found (remove `if (backdrop)` guard). Add focus trap Tab/Shift+Tab cycling tests.
2. **use-selectable-list.test.ts**: Rename the misleading `onBoundaryReached` test to accurately describe what it verifies.
3. **keyboard-utils.test.ts**: Fix contentEditable test to not silently skip. Use `toBe(false)` instead of `toBeFalsy()`.

### Priority 2 -- Fill Coverage Gaps in Existing Tests
4. **use-api-key-form.test.ts**: Add tests for error handling in handleSubmit, handleRemove function, and state reset on success.
5. **use-reviews.test.ts**: Add tests for initial fetch error, refresh function.
6. **use-scoped-route-state.test.ts**: Mock useLocation to return different pathnames to test route scoping. Add MAX_ENTRIES eviction test.
7. **theme-provider.test.tsx**: Add test for `setTheme`, `mapSettingsTheme("terminal")`, localStorage fallback.
8. **history/utils.test.ts**: Add test for `getRunSummary` branching logic.
9. **use-settings.test.ts**: Add test for cache TTL expiration.

### Priority 3 -- Add Missing Test Files
10. **use-review-stream.ts**: Extract and test `webReviewReducer` as a pure function. Test start/resume/stop lifecycle with mocked API.
11. **use-review-error-handler.ts**: Test `isApiError` type guard as a pure function.
12. **use-review-settings.ts**: Test lens validation and fallback (3-4 tests).
13. **config-provider.tsx**: Test cache behavior, async operations, error states.

### Priority 4 -- Low-Impact Improvements
14. **menu.test.tsx**: Remove unnecessary manual `unmount()` calls. Use `toBeInTheDocument()` instead of `toBeDefined()`.
15. **dialog-content.test.tsx**: Use `toBeInTheDocument()` instead of `toBeDefined()`.
16. **use-review-completion.test.ts**: Add test with `hasStreamed: false`.
17. **use-review-start.test.ts**: Add test for loading guards (configLoading/settingsLoading/!isConfigured).
