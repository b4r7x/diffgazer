# apps/web — Audit Findings (2026-05-28)

Package: `@diffgazer/web`

## Summary

| Severity | Count | Statuses |
| --- | --- | --- |
| Critical | 1 | NEW: 1 |
| High | 3 | NEW: 3 |
| Medium | 8 | NEW: 8 |
| Low | 5 | NEW: 5 |
| **Total** | **17** | **NEW: 17** |

---

## Critical

### [NEW] [type-safety] F161 — cycleTierFilter called without argument

- **file:line:** `apps/web/src/features/providers/hooks/use-model-filter.ts:18`
- **What:** The setter uses `setTierFilter(cycleTierFilterCore)` which assigns the function reference to state instead of calling it. The function expects a `current: TierFilter` parameter to cycle through `['all', 'free', 'paid']`.
- **Why:** Passing the function reference directly to `setTierFilter` stores the function as the new state value rather than cycling the filter, breaking tier filtering behavior.
- **How:** Change line 18 from `setTierFilter(cycleTierFilterCore)` to `setTierFilter((current) => cycleTierFilterCore(current))` to properly pass the current filter state to the cycling function.
- **Effort:** low

---

## High

### [NEW] [architecture] F31 — useEffect setState chain: derived state computed in effect instead of during render

- **file:line:** `apps/web/src/features/review/components/page.tsx:106-126`
- **What:** Multiple useEffect hooks call setState to update `liveState` based on `savedOutcomeKind`. Three separate effects fire when `savedOutcomeKind` changes, each triggering conditional setState calls: fallback-to-stream -> `setLiveState`, report-error -> `handleApiError`, not-found -> `navigate`.
- **Why:** Computing derived state inside effects causes extra render passes, makes data flow hard to follow, and risks inconsistent intermediate states across the three coupled effects.
- **How:** Refactor to compute `liveState` updates inline based on `savedOutcome` directly during render, not in effects. For error handling and navigation side effects, use custom hooks or handlers called directly from event/condition checks rather than useEffect chains.
- **Effort:** high

### [NEW] [kiss] F162 — Excessive positional props in IssueListPane component

- **file:line:** `apps/web/src/features/review/components/issue-list-pane.tsx:12-34`
- **What:** `IssueListPaneProps` interface has 21 properties (`issues`, `allIssues`, `selectedIssueId`, `onSelectIssue`, `onHighlightIssue`, `onListBoundaryReached`, `severityFilter`, `onSeverityFilterChange`, `onSeverityFilterReset`, `onSeverityFilterBoundary`, `isFocused`, `isFilterFocused`, `focusedFilterIndex`, `onFocusedFilterIndexChange`, `filterRef`, `onFilterKeyDown`, `highlightedIssueId`, `onListFocus`, `listRef`, `title`, `className`).
- **Why:** A 21-prop surface is hard to read, wire, and maintain, and obscures which props belong together — increasing the chance of mis-wiring at call sites.
- **How:** Group related props into options objects: e.g., `{listState: {issues, selectedIssueId, highlightedIssueId}, callbacks: {onSelectIssue, onHighlightIssue, onListBoundaryReached, onListFocus}, filter: {severityFilter, onSeverityFilterChange, onSeverityFilterReset, onSeverityFilterBoundary, focusedFilterIndex, onFocusedFilterIndexChange}, refs: {filterRef, listRef}, ui: {isFocused, isFilterFocused, title, ...}}`.
- **Effort:** high

### [NEW] [srp] F276 — Very large keyboard hook (399 lines) violates SRP — use-model-dialog-keyboard.ts

- **file:line:** `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts:76-399`
- **What:** `use-model-dialog-keyboard.ts` is 399 lines containing dialog focus trap, search focus, two filter types, model list navigation, footer buttons, and custom button ref management.
- **Why:** A single hook owning this many responsibilities is hard to test, reason about, and modify safely; changes to one concern risk regressions in unrelated ones.
- **How:** Extract: `useModelSearchFocus` (search input + keyboard), `useModelFilters` (tier + category filter keyboards), `useModelDialogFocusTrap` (dialog boundary + close). Compose in main hook for overall keyboard coordination.
- **Effort:** high

---

## Medium

### [NEW] [dead-code] F32 — Ref mutation for stale-closure workaround without modern API

- **file:line:** `apps/web/src/features/onboarding/components/onboarding-wizard.tsx:127-131`
- **What:** `cleanupRef` useRef is manually mutated on every render (line 128: `cleanupRef.current = cleanupEarlySave`) to ensure the cleanup effect always has the latest function. This is a workaround for accessing current dependencies inside a no-dep-array effect.
- **Why:** A render-time ref mutation as a hidden state-sync mechanism is fragile and obscures intent; it is the kind of pattern modern React APIs are designed to remove.
- **How:** If React 19.2+, use `useEffectEvent` to wrap `cleanupEarlySave`. Otherwise, move the cleanup logic directly into the effect's cleanup function so it captures current state implicitly, or stabilize `cleanupEarlySave` with `useCallback` so the ref mutation isn't needed.
- **Effort:** medium

### [NEW] [architecture] F35 — Multiple related useState calls without state consolidation

- **file:line:** `apps/web/src/features/onboarding/hooks/use-onboarding.ts:37-41`
- **What:** Five useState hooks manage related onboarding wizard state: `wizardData`, `stepIndex`, `isSubmitting`, `isEarlySaving`, `error`. They are logically coupled (e.g., error should clear when submitting, submission state gates transitions) but are split across independent state variables.
- **Why:** Coupled state spread across independent setters allows inconsistent combinations and scatters transition logic, making correct sequencing harder to guarantee.
- **How:** Consolidate into a single `useReducer` with actions: `next()`, `back()`, `setError()`, `startSubmit()`, `endSubmit()`, etc. This makes state transitions atomic and prevents inconsistent state combinations.
- **Effort:** high

### [NEW] [anti-slop] F268 — Render-time state reset pattern in useIssueSelection

- **file:line:** `apps/web/src/features/review/hooks/use-issue-selection.ts:10-18` (15-18)
- **What:** useState read inside render with `prevSourceKey` comparison to decide setState. This pattern manually implements prev-value tracking without using useRef.
- **Why:** Hand-rolled previous-value tracking via state is error-prone and harder to follow than the idiomatic alternatives for resetting state when an input changes.
- **How:** Replace the manual prev-state pattern with a `key` prop on the list or use a `useRef` to track `prevSourceKey` instead of `useState`, then only call setState in `useEffect` if needed.
- **Effort:** medium

### [NEW] [anti-slop] F269 — Similar render-time state reset in useHistoryPage

- **file:line:** `apps/web/src/features/history/hooks/use-history-page.ts:112-119` (115-119)
- **What:** Same pattern as `useIssueSelection`: useState + render-time comparison + setState to reset highlighted issue when run changes.
- **Why:** Repeating the same fragile render-time reset pattern compounds maintenance cost and duplicates a non-idiomatic approach across hooks.
- **How:** Extract into a shared custom hook or replace with a `useRef`-based pattern + `useEffect`, or use a `key` prop to remount the dependent list component.
- **Effort:** medium

### [NEW] [anti-slop] F270 — useEffect chains in ReviewPage watching derived state

- **file:line:** `apps/web/src/features/review/components/page.tsx:106-126` (106-126)
- **What:** Three separate useEffect hooks (lines 106, 112, 118) that all watch `savedOutcomeKind` and react by calling setState or navigation. This is the effect-chaining pattern.
- **Why:** Splitting one decision across three effects on the same dependency multiplies render passes and makes the outcome handling order implicit and hard to audit.
- **How:** Consolidate the three useEffect hooks into one that watches `savedOutcomeKind` and reviews all outcomes in sequence, using a switch statement to handle each case.
- **Effort:** medium

### [NEW] [srp] F274 — Large keyboard hook (289 lines) violates SRP — use-review-results-keyboard.ts

- **file:line:** `apps/web/src/features/review/hooks/use-review-results-keyboard.ts:1-289`
- **What:** `use-review-results-keyboard.ts` is 289 lines combining focus zone management, keyboard bindings, severity filtering, issue selection, footer text, and tab navigation.
- **Why:** A hook with this many concerns is difficult to test in isolation and risks cross-concern regressions on every edit.
- **How:** Extract keyboard-specific logic: create `useReviewSeverityFilterKeyboard` for filter key bindings, create `useReviewDetailsTabKeyboard` for tab navigation keys. Leave the main hook to coordinate state and compose them.
- **Effort:** high

### [NEW] [srp] F275 — Large keyboard hook (277 lines) violates SRP — use-providers-keyboard.ts

- **file:line:** `apps/web/src/features/providers/hooks/use-providers-keyboard.ts:1-277`
- **What:** `use-providers-keyboard.ts` is 277 lines combining focus zone management, search input handling, filter cycling, list navigation, action buttons, and dialog coordination.
- **Why:** Bundling navigation, filtering, and dialog coordination in one hook makes the behavior hard to follow and modify safely.
- **How:** Split into: `useProvidersListNavigation` (search + list focus), `useProvidersActionButtons` (button navigation), `useProvidersDialogKeyboard` (dialog open/close sync). Main hook composes them.
- **Effort:** high

### [NEW] [srp] F277 — Component (344 lines) mixing layout, keyboard navigation, and UI rendering

- **file:line:** `apps/web/src/features/onboarding/components/onboarding-wizard.tsx:1-344`
- **What:** `onboarding-wizard.tsx` is 344 lines combining step rendering, button row navigation, keyboard handling, footer shortcuts, and layout.
- **Why:** Mixing keyboard coordination with rendering and layout in one component reduces readability and makes both concerns harder to change independently.
- **How:** Extract keyboard logic into a `useOnboardingKeyboard` hook that handles button navigation and key bindings, leaving the component to focus on step rendering and page structure.
- **Effort:** medium

---

## Low

### [NEW] [reusability] F33 — Unnecessary defensive useMemo on context values with no memoized consumers

- **file:line:** `apps/web/src/app/providers/config-provider.tsx:117-143`
- **What:** `ConfigProvider` wraps both context values (`dataValue`, `actionsValue`) in `useMemo` with exhaustive dependency arrays. No consumers of this context are memoized with `React.memo()`, making the memoization provide no re-render optimization benefit.
- **Why:** Memoization without memoized consumers adds complexity and dependency-array maintenance without delivering the intended render savings.
- **How:** Remove both `useMemo` wrappers. Let values be created fresh on every render. If future consumers are wrapped in `memo()`, add `useMemo` back with a clear comment explaining the need. This keeps code simpler until optimization is actually required.
- **Effort:** low

### [NEW] [type-safety] F34 — Type assertion 'as const' on object literal avoids proper type inference

- **file:line:** `apps/web/src/features/review/components/page.tsx:145`
- **What:** Object literal fallback uses `as const` assertion: `const currentLiveState = liveState ?? { phase: "streaming" as const, reviewId };`. The `as const` is needed to force TypeScript to infer `phase` as a literal type rather than a string.
- **Why:** Relying on an inline assertion to satisfy the type hints at a type definition that does not naturally model the literal, masking a small modeling gap.
- **How:** Verify the `LiveReviewState` type definition accepts the literal `'streaming'`. If not, update the type. Consider using a type guard or factory function to create the fallback object so TypeScript can infer the type naturally without assertions.
- **Effort:** low

### [NEW] [reusability] F36 — useCallback with mutateAsync dependency increases fragility

- **file:line:** `apps/web/src/app/providers/config-provider.tsx:88-115`
- **What:** Three useCallback hooks depend on mutation `.mutateAsync` methods as dependencies: `activateProvider`, `saveCredentials`, `deleteProviderCredentials` all have `[mutation.mutateAsync]` in their deps array. Each mutation method is extracted and passed as a dependency.
- **Why:** Depending on extracted `mutateAsync` references couples callback stability to library-internal identity guarantees, which is fragile and easy to get wrong.
- **How:** Wrap `mutateAsync` methods in a stable helper or depend only on stable method references. Alternatively, if the mutations are stable, document why and add a comment. For maximum stability, wrap the entire mutation logic in `useCallback` with minimal deps.
- **Effort:** low

### [NEW] [architecture] F272 — useEffect manages focus on SeverityFilterGroup reset button

- **file:line:** `apps/web/src/features/review/components/severity-filter-group.tsx:45-51` (45-51)
- **What:** useEffect imperatively focuses `resetButtonRef` when `isResetFocused` becomes true. Effect dependency is `[isResetFocused]`.
- **Why:** Driving focus through an effect on a derived flag adds an indirection that can be expressed more directly, reducing imperative effect usage.
- **How:** Consider moving focus management to the parent or use the `autoFocus` attribute if the reset button should receive focus when `isResetFocused` becomes true, or use a ref callback.
- **Effort:** low

### [NEW] [dry] F273 — Duplicate in-flight tracking pattern in useDiagnosticsKeyboard

- **file:line:** `apps/web/src/features/settings/hooks/use-diagnostics-keyboard.ts:40-75` (43-75)
- **What:** `handleRefreshAll` uses both a `refreshAllInFlight.current` ref and an `isRefreshingAll` useState to track the same async operation state.
- **Why:** Tracking one operation's in-flight status in two places duplicates state and risks the ref and state drifting out of sync.
- **How:** Remove the `refreshAllInFlight` ref and rely solely on `isRefreshingAll` state for both the early return check and UI. The state itself prevents concurrent calls.
- **Effort:** low
