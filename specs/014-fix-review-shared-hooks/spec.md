# Feature Specification: Fix Review Regression & Consolidate Shared Review Hooks

**Feature Branch**: `014-fix-review-shared-hooks`
**Created**: 2026-03-25
**Status**: Draft
**Input**: User description: "Fix broken review in web and CLI caused by branch 013 changes. Consolidate shared API hooks and review logic into reusable packages. Quality audit for anti-slop, DRY, KISS, YAGNI compliance."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Web Review Completes Successfully (Priority: P1)

A developer runs a code review from the web UI. The review starts streaming, shows progress, and transitions to the results view with all issues displayed. If the developer navigates to a review that was previously in-session (stale or not found), the system gracefully falls back to starting a fresh review or loading saved results -- it never hangs or shows a blank screen.

**Why this priority**: The review flow is the core product feature. It is currently broken -- the web review hangs after the 013 changes. Nothing else matters if the primary feature doesn't work.

**Independent Test**: Start a review from the web UI, verify it streams to completion and shows results. Also test: navigate to `/review/<old-id>` where the session is stale -- verify fallback to fresh start.

**Acceptance Scenarios**:

1. **Given** the web app is running and configured, **When** a user starts a staged review, **Then** the review streams progress, completes, and shows the results view with all detected issues.
2. **Given** a review session that has expired (stale), **When** a user navigates to that review's URL, **Then** the system falls back to starting a fresh review instead of hanging.
3. **Given** a review ID that no longer exists in an active session, **When** a user navigates to that review's URL, **Then** the system loads saved results from the API or starts a fresh review.

---

### User Story 2 - CLI Review Completes Successfully (Priority: P1)

A developer runs a code review from the CLI terminal UI. The review starts streaming, shows progress steps and activity log, transitions through completion phases (summary, then results), and allows keyboard navigation through issues. The CLI never hangs at "Starting review..." or shows a blank screen.

**Why this priority**: The CLI is the other primary interface. It is also currently broken -- it hangs and never proceeds past the initial loading state.

**Independent Test**: Run `pnpm dev:cli`, start a review, verify it streams to completion and shows results. Test with both "staged" and "unstaged" modes.

**Acceptance Scenarios**:

1. **Given** the CLI app is running and configured, **When** a user starts a staged review, **Then** the review streams progress, transitions through completion phases, and shows results with keyboard navigation.
2. **Given** the CLI app is running, **When** a user starts a review with the same mode as the default ("staged"), **Then** the review still starts correctly (no silent no-op from identical state).
3. **Given** the CLI is in review streaming phase, **When** streaming completes, **Then** the completion hook correctly detects the transition and advances to the summary view.

---

### User Story 3 - Shared Review Hooks Eliminate Duplication (Priority: P2)

Both web and CLI apps share the same review start, completion, and lifecycle logic through a consolidated shared package rather than maintaining near-identical copies. When a bug is fixed in review start logic, both apps benefit. Platform-specific behavior (URL sync for web, phase state machine for CLI) is injected via configuration, not duplication.

**Why this priority**: The duplication is what allowed the bugs to diverge between apps. Consolidation prevents this class of bugs. However, fixing the broken review (P1) must come first since consolidation without a working review is pointless.

**Independent Test**: After consolidation, both web and CLI import `useReviewStart` from the shared package. Verify both apps still pass their review flow acceptance scenarios.

**Acceptance Scenarios**:

1. **Given** the shared `useReviewStart` hook, **When** the web app uses it with a `reviewId` parameter, **Then** it handles resume-by-ID with proper stale/not-found fallback.
2. **Given** the shared `useReviewStart` hook, **When** the CLI app uses it without a `reviewId`, **Then** it checks for active sessions and starts fresh or resumes accordingly.
3. **Given** a shared `useReviewCompletion` hook, **When** streaming transitions from active to complete, **Then** the hook detects the transition and invokes a platform-provided callback (web: `onComplete`, CLI: phase transition).

---

### User Story 4 - Shared Display Logic Reconciled (Priority: P3)

Display utility functions (`mapStepStatus`, `getAgentDetail`/`getSubstepDetail`) are reconciled between web and CLI so both apps use the shared exports. Divergent behavior (web maps error to "pending", CLI maps error to "error") is resolved with a single correct behavior, or the divergence is made explicit through a configuration parameter.

**Why this priority**: This is a quality/consistency issue, not a functional blocker. The web currently uses its own local copy of these functions, making the "shared" module misleading.

**Independent Test**: Verify both web and CLI import `mapStepStatus` from the shared package and render error states consistently.

**Acceptance Scenarios**:

1. **Given** a review step with error status, **When** rendered in both web and CLI, **Then** the visual representation follows the same mapping logic from the shared function.
2. **Given** the shared agent detail formatting function, **When** used in both apps, **Then** the output is formatted consistently (or parameterized for platform-appropriate truncation/separators).

---

### User Story 5 - Quality Audit Cleanup (Priority: P3)

The codebase is free of anti-slop patterns, unnecessary thin wrappers, dead code, and DRY/KISS/YAGNI violations introduced by the 013 branch changes. Unstable function references in effect dependency arrays are resolved. Dead code (unused `StatusScreen` in CLI) is removed.

**Why this priority**: Quality improvements that don't affect functionality. Important for maintainability but not blocking.

**Independent Test**: Run a quality audit pass across changed files. Verify no unstable references in effect deps, no dead exports, no duplicated logic that should be shared.

**Acceptance Scenarios**:

1. **Given** review lifecycle hooks in both apps, **When** functions are passed as effect dependencies, **Then** they are referentially stable (not recreated every render).
2. **Given** the CLI codebase, **When** audited for dead code, **Then** the unused `StatusScreen` and any other unreferenced components are removed.
3. **Given** shared display utilities, **When** audited, **Then** either both apps consume them or they are clearly scoped to the correct consumer.

---

### Edge Cases

- What happens when a review resume fails with a network error (not stale/not-found)? The error must be surfaced to the user, not silently swallowed or reset.
- What happens when config/settings queries fail to load during review start? The review start must show an error state, not hang indefinitely waiting for config.
- What happens when the CLI terminal is resized during review streaming? The layout must adapt without restarting the review or losing state.
- What happens when `useReviewCompletion` detects streaming end but the streaming state hasn't propagated through React's render cycle yet? The completion logic must use a re-render-triggering mechanism (state) rather than refs read during render.
- What happens when the shared `useReviewStart` receives both an explicit `reviewId` AND there is an active session for a different review? The explicit `reviewId` takes precedence (web behavior).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The shared `useReviewStream.resume` method MUST provide a mechanism for callers to respond to stale/not-found error conditions (either via Result return type or callback/event).
- **FR-002**: The web review start logic MUST fall back to a fresh start when resume encounters a stale session error, matching pre-013 behavior.
- **FR-003**: The web review start logic MUST load saved review results from the API when resume encounters a not-found session error, matching pre-013 behavior.
- **FR-004**: The CLI review start MUST actually trigger the stream, not just set mode state. The stream must start even when the mode value doesn't change from the default.
- **FR-005**: The CLI review completion detection MUST receive streaming state changes through a mechanism that triggers React re-renders (not through a ref read during render).
- **FR-006**: `useReviewStart` MUST be consolidated into a single shared implementation that accepts an optional review ID parameter and works for both CLI and web.
- **FR-007**: `useReviewCompletion` MUST have shared detection/delay logic extracted to a common module, with platform-specific output (callback vs phase state) injected via configuration.
- **FR-008**: Derived state functions (`isNoDiffError`, `isCheckingForChanges`, `loadingMessage` computation) MUST be extracted from `useReviewLifecycle` into pure functions in the shared core review package.
- **FR-009**: `mapStepStatus` and agent detail formatting MUST be reconciled between web and CLI, with both apps consuming from the shared package.
- **FR-010**: Function references passed as effect dependencies MUST be referentially stable across renders (since React Compiler is not active).
- **FR-011**: Dead code (unused `StatusScreen`, unused type re-exports) MUST be removed.
- **FR-012**: All changes MUST maintain backwards compatibility with the existing shared hooks public API surface.

### Key Entities

- **ReviewStream**: The SSE streaming connection delivering review progress events. Managed by `useReviewStream` in the shared hooks package.
- **ReviewPhase** (CLI): State machine governing the CLI review view progression: loading, streaming, completing, summary, results.
- **ReviewCompletion**: The transition detection logic that observes streaming going from active to inactive and triggers the completion flow with configurable delay.
- **DefaultLenses**: The set of analysis lenses resolved from user settings, determining which review checks run.
- **SessionError**: Error conditions when resuming a review session (stale, not-found, network error) that require different handling strategies.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can complete a full review cycle (start, stream, view results) in the web app without hanging or blank screens. 100% of review start scenarios (fresh, resume-stale, resume-not-found) complete successfully.
- **SC-002**: A user can complete a full review cycle in the CLI app without hanging. Both "staged" and "unstaged" modes start and complete correctly.
- **SC-003**: The `useReviewStart` hook exists in exactly one shared location and is consumed by both apps with zero duplication of start/resume/fallback logic.
- **SC-004**: The `useReviewCompletion` shared detection logic exists in exactly one location, with platform adapters of 10 lines or fewer in each app.
- **SC-005**: Zero unstable function references appear in effect dependency arrays across all review hooks in both apps.
- **SC-006**: Zero dead/unreachable code remains in the review feature area of both apps.

## Assumptions

- The shared hooks package (`@diffgazer/api/hooks`) is the correct location for consolidated review hooks (per existing architecture).
- React Compiler is NOT active in this project, so manual referential stability of function references in effect deps is necessary.
- The `useReviewStream` hook's `useReducer`-based architecture is correct and should be preserved.
- The pre-013 behavior of handling stale/not-found session errors with explicit fallback logic was correct and should be restored.
- The web's `mapStepStatus` mapping of error to "pending" was an intentional UX choice that should be investigated before choosing a unified behavior.

## Root Cause Analysis (from investigation)

### Web Review Hang

The shared `useReviewStream.resume` was changed from returning `Result<void, StreamReviewError>` to `Promise<void>`. It now silently dispatches `RESET` on stale/not-found errors. After `RESET`, the state is indistinguishable from "never started" -- `useReviewCompletion` fires `onComplete` with empty data (zero issues, null reviewId), transitioning to a summary view with no content. The `onReviewNotInSession` callback chain was also removed, eliminating the fallback path for loading saved reviews.

### CLI Review Hang

`useReviewLifecycle.start()` only calls `setMode()`. When the mode value doesn't change (default "staged" to requested "staged"), no re-render occurs, and `useReviewStart`'s effect never re-fires after config finishes loading. Additionally, `hasStreamedRef.current` is read during render and passed as a plain boolean to `useReviewCompletion`, meaning it may receive stale values that prevent phase transitions. The `start`/`resume` closures are also recreated every render, causing identity instability in effect dependency arrays.

### Consolidation Gap

`useReviewStart` is ~90% identical between web and CLI (web adds optional `reviewId` support). `useReviewCompletion` is ~60% shared (same detection, different output shape). `display.ts` was extracted from CLI logic without reconciling with web's divergent `mapStepStatus`/`getSubstepDetail`. These should all live in shared packages.
