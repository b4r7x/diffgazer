# Web Test Audit

## Summary

15 files audited: **11 GOOD**, **3 NEEDS_FIX**, **1 OVERENGINEERED**

| Rating | Count | Files |
|--------|-------|-------|
| GOOD | 11 | review-container.utils, history/utils, keyboard-utils, use-model-filter, toast-context, menu, dialog-content, use-review-completion, use-review-start, use-api-key-form, use-selectable-list |
| NEEDS_FIX | 3 | use-scoped-route-state, use-reviews, theme-provider |
| OVERENGINEERED | 1 | use-settings |
| DELETE | 0 | -- |

## File-by-File Audit

### apps/web/src/features/review/components/review-container.utils.test.ts
- **Rating**: GOOD
- **Source file**: apps/web/src/features/review/components/review-container.utils.ts
- **Test count**: 9
- **Issues found**: None
- **What's good**:
  - Tests pure transformation logic (mapStepsToProgressData) with clear AAA pattern
  - Good coverage of mapping variations: empty inputs, error status mapping, agent-to-substep derivation
  - Clean helper factories (makeStep, makeAgent) without over-engineering
  - Tests observable output, not implementation details
  - Plural/singular issue text edge case is a nice touch
- **Recommended action**: Keep as is

### apps/web/src/features/history/utils.test.ts
- **Rating**: GOOD
- **Source file**: apps/web/src/features/history/utils.tsx
- **Test count**: 12
- **Issues found**: None
- **What's good**:
  - Tests pure functions (getDateLabel, getDateKey, formatDuration, buildTimelineItems)
  - Proper use of vi.useFakeTimers for date-dependent tests
  - Good edge cases: null, undefined, 0, boundary values (exact minute), empty array
  - Clean makeReview factory
  - Doesn't test getTimestamp or getRunSummary (React component), which is fine -- those are trivial or UI-only
- **Recommended action**: Keep as is

### apps/web/src/app/providers/keyboard-utils.test.ts
- **Rating**: GOOD
- **Source file**: apps/web/src/app/providers/keyboard-utils.ts
- **Test count**: 13
- **Issues found**:
  - Line 84-88: contentEditable test has conditional assertion (`if (div.isContentEditable !== undefined)`) which means the test might silently pass without asserting anything. Minor issue since jsdom behavior is the root cause.
- **What's good**:
  - Tests pure functions (matchesHotkey, isInputElement)
  - Good coverage: modifiers, case insensitivity, aliases, negative cases
  - Uses real KeyboardEvent constructor -- no over-mocking
  - Null target edge case
- **Recommended action**: Keep as is. The conditional assertion is acceptable given jsdom limitations.

### apps/web/src/features/providers/hooks/use-model-filter.test.ts
- **Rating**: GOOD
- **Source file**: apps/web/src/features/providers/hooks/use-model-filter.ts
- **Test count**: 8
- **Issues found**: None
- **What's good**:
  - Tests hook through renderHook -- correct approach since filterModels is not exported
  - Good behavioral coverage: default state, search by name, search by description, tier filters, combined filters, cycle, reset, empty list
  - Clean makeModel factory
  - Tests observable output (filteredModels), not internal state
- **Recommended action**: Keep as is

### apps/web/src/hooks/use-scoped-route-state.test.ts
- **Rating**: NEEDS_FIX
- **Source file**: apps/web/src/hooks/use-scoped-route-state.ts
- **Test count**: 7
- **Issues found**:
  - Mocks `@tanstack/react-router` to stub useLocation -- this couples the test to the internal dependency. If the hook switches to a different router, the test breaks even if behavior is identical.
  - Module-level state (routeStateStore Map) persists across tests since it's in the source module. Tests for "share state for same key" (line 49) rely on state bleeding between tests, which is fragile.
  - Tests for object/boolean values (lines 59-71) are low-value -- they test that JavaScript variables can hold objects and booleans, not meaningful hook behavior.
- **What's good**:
  - Tests core behavior: default value, direct value, functional updater, separate keys, shared state
  - Proper use of renderHook and act
- **Recommended action**:
  - Remove "should handle object values" and "should handle boolean values" tests (trivial)
  - Consider resetting the module-level store between tests to avoid cross-test contamination

### apps/web/src/components/ui/toast/toast-context.test.tsx
- **Rating**: GOOD
- **Source file**: apps/web/src/components/ui/toast/toast-context.tsx
- **Test count**: 8
- **Issues found**: None
- **What's good**:
  - Tests context provider through the useToast hook -- correct approach
  - Good behavioral coverage: add, limit (MAX_TOASTS), auto-dismiss, error persistence, manual remove, dismiss, custom duration, outside-provider error
  - Proper use of fake timers for timeout-based behavior
  - Tests the MAX_TOASTS=5 limit with 7 toasts and verifies which ones survive (newest)
- **Recommended action**: Keep as is

### apps/web/src/components/ui/menu/menu.test.tsx
- **Rating**: GOOD
- **Source file**: apps/web/src/components/ui/menu/menu.tsx
- **Test count**: 7
- **Issues found**:
  - Mocks `@/hooks/keyboard` (useKey, useKeys) -- this is acceptable since keyboard hooks depend on KeyboardProvider context which would be complex to set up. The mock is at a boundary.
  - Uses `expect(...).toBeDefined()` instead of `.toBeInTheDocument()` -- works but less idiomatic with RTL
- **What's good**:
  - Uses proper RTL queries: getByRole("listbox"), getAllByRole("option"), getByText
  - Uses userEvent.setup() instead of fireEvent -- follows best practice
  - Tests accessibility: aria-selected, aria-label, listbox role
  - Tests Fragment children handling (real edge case)
  - Tests disabled item click behavior
  - Proper cleanup with unmount()
- **Recommended action**: Keep as is

### apps/web/src/components/ui/dialog/dialog-content.test.tsx
- **Rating**: GOOD
- **Source file**: apps/web/src/components/ui/dialog/dialog-content.tsx
- **Test count**: 6
- **Issues found**:
  - Line 70-76: backdrop click test uses `document.querySelector('[aria-hidden="true"]')` with conditional assertion -- if the selector doesn't match, the test silently passes. Should use a more robust selector or assert that backdrop exists.
- **What's good**:
  - Uses getByRole("dialog") -- proper accessible query
  - Tests accessibility: aria-modal, aria-labelledby, aria-describedby
  - Tests auto-focus behavior (important for dialogs)
  - Tests open/closed state rendering
  - Uses userEvent for click interactions
  - Provides dialog context via renderWithDialog helper
- **Recommended action**: Fix the backdrop click test to assert backdrop exists before clicking. Otherwise keep as is.

### apps/web/src/features/review/hooks/use-review-completion.test.ts
- **Rating**: GOOD
- **Source file**: apps/web/src/features/review/hooks/use-review-completion.ts
- **Test count**: 5
- **Issues found**: None
- **What's good**:
  - Tests timing-sensitive completion logic with fake timers
  - Good behavioral coverage: default delay, report-complete delay, non-report delay, error suppression, cleanup on unmount
  - Uses rerender to simulate streaming state transitions
  - Clean defaultProps factory
  - Tests the exact delay values which are meaningful to the UX (REPORT_COMPLETE_DELAY_MS vs DEFAULT_COMPLETE_DELAY_MS)
- **Recommended action**: Keep as is

### apps/web/src/features/review/hooks/use-review-start.test.ts
- **Rating**: GOOD
- **Source file**: apps/web/src/features/review/hooks/use-review-start.ts
- **Test count**: 4
- **Issues found**: None
- **What's good**:
  - Tests key decision branches: start (no reviewId), resume (has reviewId), SESSION_STALE fallback, SESSION_NOT_FOUND callback
  - Uses vi.waitFor for async effects -- proper pattern
  - Clean defaultProps factory with sensible defaults
  - Tests observable outcomes (which callbacks are called with what args)
- **Recommended action**: Keep as is

### apps/web/src/features/providers/hooks/use-api-key-form.test.ts
- **Rating**: GOOD
- **Source file**: apps/web/src/features/providers/hooks/use-api-key-form.ts
- **Test count**: 4
- **Issues found**: None
- **What's good**:
  - Tests canSubmit logic for different method/value combinations
  - Tests double-submission prevention with controlled promise -- tests real async behavior
  - Clean defaultProps factory
  - Tests observable behavior (canSubmit, isSubmitting), not internal state
- **Recommended action**: Keep as is

### apps/web/src/hooks/keyboard/use-selectable-list.test.ts
- **Rating**: GOOD
- **Source file**: apps/web/src/hooks/keyboard/use-selectable-list.ts
- **Test count**: 13
- **Issues found**:
  - Mocks `./use-keys` and captures handlers -- this is a pragmatic approach since useKeys depends on KeyboardProvider. The mock intercepts at the right boundary.
  - Line 101-123: onBoundaryReached test documents actual behavior but doesn't assert the callback was called (because the implementation only fires on focusedIndex change). The test is more of a documentation of current behavior than a behavioral test.
- **What's good**:
  - Comprehensive navigation testing: up, down, wrap, no-wrap, boundary, disabled skipping
  - Tests disabled item skipping in all directions (up, down, wrap-up, wrap-down)
  - onFocus callback testing
  - Clean helper functions (simulateKey, moveDown, moveUp)
- **Recommended action**: Keep as is

### apps/web/src/features/history/hooks/use-reviews.test.ts
- **Rating**: NEEDS_FIX
- **Source file**: apps/web/src/features/history/hooks/use-reviews.ts
- **Test count**: 3
- **Issues found**:
  - Mocks `@/lib/api` module directly (vi.mock) -- this couples the test to the import path and internal module structure. If the hook switches from `api.getReviews` to a different data source, the test breaks. Per testing guidelines, should mock at network boundary (e.g., MSW or fetch mock).
  - "optimistically remove item on delete" test (line 29) -- the source code does NOT do optimistic deletion. Looking at the source, `deleteReview` awaits `api.deleteReview(id)` first, then calls `setReviews`. The test name is misleading.
  - "rollback on API failure" test (line 47) -- the source calls `fetchReviews()` on error, which is correct behavior, but the test name implies optimistic update + rollback which isn't the actual pattern.
- **What's good**:
  - Tests the three key paths: successful delete, failed delete with refetch, persistence
  - Uses waitFor for async loading state
- **Recommended action**:
  - Rename test names to match actual behavior ("should remove item after successful API delete", "should refetch reviews on delete failure")
  - Consider switching to fetch-level mocking instead of module mocking

### apps/web/src/app/providers/theme-provider.test.tsx
- **Rating**: NEEDS_FIX
- **Source file**: apps/web/src/app/providers/theme-provider.tsx
- **Test count**: 3
- **Issues found**:
  - Mocks `@/hooks/use-settings` and `@/lib/api` -- this is over-mocking internal modules. The test tests ThemeProvider but mocks the hooks it depends on, making it test only the thin layer between useSettings and document attribute.
  - Uses `getByTestId("theme")` with a custom ThemeDisplay component that reads context directly -- this tests implementation details (context value) rather than observable behavior (what the user sees). A better approach would test that the correct data-theme attribute is applied to `document.documentElement`.
  - Test "should fall back to system preference when no user setting" (line 85) has a very long comment explaining what the test does -- a sign that the test setup is more complex than it needs to be.
- **What's good**:
  - Tests the three theme resolution paths: user setting, system preference, document attribute
  - mockMatchMedia helper is clean
  - Tests document.documentElement attribute directly in one test
- **Recommended action**:
  - Simplify to focus on observable output: `document.documentElement.getAttribute("data-theme")`
  - Remove the ThemeDisplay component and testId-based assertions
  - Consider if the useSettings mock can be avoided (probably not without a full provider tree)

### apps/web/src/hooks/use-settings.test.ts
- **Rating**: OVERENGINEERED
- **Source file**: apps/web/src/hooks/use-settings.ts
- **Test count**: 5
- **Issues found**:
  - Tests module-level singleton state (cache, inflightPromise, subscribers) which bleeds between tests. Tests must run sequentially and depend on execution order -- test 2 ("should return cached data when TTL not expired") relies on test 1 having populated the cache.
  - "should deduplicate inflight requests" test (line 78-114) is 36 lines of setup to test a single assertion. The controlled promise + invalidate + mount second hook pattern is testing internal caching implementation, not user-visible behavior.
  - Mocks `@/lib/api` module directly -- couples to import structure.
  - The `setTimeout(r, 10)` calls are a test smell -- they indicate timing-dependent assertions that could be flaky.
  - Overall the tests are testing the caching/dedup mechanism (implementation) rather than the hook's observable contract (returns settings, can refresh, can invalidate).
- **What's good**:
  - Tests cover the full lifecycle: fetch, cache, invalidate, refresh, dedup
  - The deduplication test, while complex, does test a real bug-prevention scenario
- **Recommended action**:
  - Simplify to test observable behavior: "returns null then settings after mount", "refresh returns new data", "invalidate clears data"
  - Remove deduplication test or simplify it significantly
  - Add test isolation: reset module state between tests (or use vi.resetModules)
  - Remove order-dependent tests

## Overall Patterns

### Strengths
1. **Pure function tests are excellent** -- review-container.utils, history/utils, keyboard-utils all follow AAA pattern and test observable behavior
2. **Good use of fake timers** -- toast-context, use-review-completion use vi.useFakeTimers correctly for timeout-dependent behavior
3. **RTL best practices mostly followed** -- getByRole used appropriately, userEvent.setup() used instead of fireEvent
4. **Hook tests use renderHook correctly** -- proper act() wrapping, rerender for state transitions
5. **Clean test factories** -- makeStep, makeAgent, makeModel, defaultProps patterns are consistent and readable

### Common Issues
1. **Module-level mocking (vi.mock)** -- use-reviews, use-settings, theme-provider, use-scoped-route-state all mock internal modules. Per testing guidelines, should mock at network/system boundaries (fetch, DOM APIs) not internal imports.
2. **Module-level state leaks** -- use-settings and use-scoped-route-state have module-level singletons (cache, Map) that persist across tests. This makes tests order-dependent and fragile.
3. **Conditional assertions** -- keyboard-utils (contentEditable) and dialog-content (backdrop click) have assertions inside `if` blocks that may silently pass without asserting.
4. **Misleading test names** -- use-reviews describes behavior that doesn't match implementation ("optimistic" when it's actually post-API).

### Recommendations
1. For hooks that depend on API calls, prefer fetch-level mocking (MSW or global fetch mock) over vi.mock of the API module
2. For hooks with module-level state, use vi.resetModules() in beforeEach or provide a reset function
3. Avoid conditional assertions -- either skip the test with platform notes or find a way to make the assertion unconditional
4. Ensure test names accurately describe the behavior being tested
