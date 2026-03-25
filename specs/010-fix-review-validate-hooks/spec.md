# Feature Specification: Fix Web Review Regression & Hooks Quality Finalization

**Feature Branch**: `010-fix-review-validate-hooks`
**Created**: 2026-03-25
**Status**: Draft
**Input**: Fix broken web review that shows wrong content after hooks refactoring. Validate shared API hooks quality (matchQueryState, anti-slop, DRY/KISS/YAGNI). Standardize loading state handling across both apps. Update documentation to match implementation.

## Clarifications

### Session 2026-03-25

- Q: What is the root cause of the broken web review? → A: In commit `9c4c807`, `use-review-start.ts` lost the "start fresh on resume failure" fallback. When resume fails with SESSION_STALE/NOT_FOUND, the shared hook dispatches RESET but nothing triggers a new review. Additionally, `useReviewCompletion` falsely triggers on the START→RESET transition, showing a "0 issues" summary with only project context descriptions visible.
- Q: Is the problem server-side or client-side? → A: Purely client-side. The server pipeline is untouched and correct. The `/api/review/stream` and `/api/review/context` endpoints are independent. The streaming pipeline never sends context data over SSE.
- Q: Which specific files were modified in the hooks refactoring that caused the regression? → A: `apps/web/src/features/review/hooks/use-review-start.ts` (removed `onNotFoundInSession`, removed SESSION_STALE/SESSION_NOT_FOUND error handling, changed resume to fire-and-forget). Also `apps/web/src/features/review/hooks/use-review-lifecycle.ts` (removed `onReviewNotInSession` option).

## Context

The shared API hooks architecture (`@diffgazer/api/hooks`) was built across specs 006-009:
- **006**: Created shared TanStack Query hooks, ApiProvider, query factories
- **007**: Fixed query key bugs, consolidated useServerStatus, added missing factories
- **008**: Consolidated 25+ files into 8, removed 6 unused hooks, introduced matchQueryState
- **009**: Fixed matchQueryState check order (data-first), removed dead code (orphaned queries/git.ts, batchEvents option)

After these changes, the web app's "Review Changes" feature is broken. The root cause is in commit `9c4c807` which simplified `use-review-start.ts` by removing the resume error-handling logic. When the system detects an active session and tries to resume it, but the session is stale (due to git state changes since last review), the resume fails silently:
1. `useReviewStream.resume()` dispatches `RESET` on `SESSION_STALE`/`SESSION_NOT_FOUND`
2. No code triggers `startFresh()` as a fallback (this behavior was removed)
3. `useReviewCompletion` falsely fires on the `START→RESET` transition (interprets streaming-to-not-streaming as successful completion)
4. The UI shows a "0 issues" summary with project context descriptions (from the independently-fetched `useReviewContext()` query) as the only visible content

The CLI app has its own `useReviewLifecycle` hook with its own resume/fallback logic, which may or may not have the same bug.

Additionally, the hooks implementation needs final quality signoff: the matchQueryState pattern validation, anti-slop audit, documentation alignment, and consistent adoption across components. A stale test file (`use-review-start.test.ts`) references the removed API and needs updating.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Web Review Resumes or Starts Fresh Correctly (Priority: P1)

A user starts a code review in the web app. If a previous active session exists on the server, the system should attempt to resume it. If the session is stale (repo changed since last review) or not found, the system MUST automatically fall back to starting a fresh review instead of showing an empty summary. The user should never see a "0 issues" result caused by a failed resume -- they should see the full AI review pipeline execute from scratch.

**Why this priority**: This is a regression in the product's core feature introduced by commit `9c4c807`. The review pipeline is the entire value proposition of diffgazer. Every time a user reviews after making changes (the most common workflow), the stale session path triggers and the review silently fails.

**Independent Test**: Can be tested by: (1) running a review to create a server session, (2) making code changes (changing git status), (3) starting another review. The second review should detect the stale session, fail to resume, and automatically start a fresh review with full agent orchestration.

**Acceptance Scenarios**:

1. **Given** a stale active session on the server (git state changed since last review), **When** the user starts a new review, **Then** the system attempts to resume, detects the session is stale, and automatically starts a fresh review with all configured lenses and agents.
2. **Given** no active session exists, **When** the user starts a review, **Then** the review starts fresh immediately with full streaming progress (step indicators, agent cards, activity log).
3. **Given** a valid active session exists (git state unchanged), **When** the user returns to the review screen, **Then** the system resumes the session and displays the streaming state or completed results.
4. **Given** a resume attempt fails for any reason, **When** the system falls back to a fresh start, **Then** the completion detection does not falsely trigger on the START→RESET transition -- it only fires after the fresh review actually completes with real results.
5. **Given** the stale test file `use-review-start.test.ts`, **When** updated to match the current API, **Then** tests cover the resume-failure-to-fresh-start fallback behavior.

---

### User Story 2 - Hooks Quality Meets Production Standards (Priority: P1)

A developer maintaining the shared hooks package needs confidence that the implementation follows canonical patterns, has no dead code or unnecessary abstractions, and the matchQueryState utility is a sound React pattern that won't cause issues at scale.

The hooks were built across 4 spec iterations by AI, accumulating potential quality debt. A final audit ensures the code is production-ready: correct query key usage, proper mutation invalidation, no unnecessary comments, no thin wrappers adding no value, and matchQueryState validated against React 19 Compiler and TanStack Query best practices.

**Why this priority**: Technical debt in a shared package affects every consumer. Quality issues multiply across both apps. Fixing them now prevents them from becoming the accepted pattern for future hooks.

**Independent Test**: Can be tested by running a code quality audit on all files in the hooks package, checking each finding against established criteria, and verifying fixes don't break any consumer.

**Acceptance Scenarios**:

1. **Given** the hooks package, **When** audited for anti-slop patterns, **Then** zero unnecessary comments, dead code, or AI-generated verbose patterns remain.
2. **Given** all mutation hooks, **When** their query key invalidation is inspected, **Then** every mutation uses query factory methods for key construction (no manual key assembly).
3. **Given** the matchQueryState utility, **When** called during render with a query that transitions from loading to success, **Then** no unnecessary React re-renders occur and React 19 Compiler can auto-memoize the calling component correctly.
4. **Given** the shared hooks documentation, **When** compared to the actual implementation, **Then** documentation accurately describes all features, parameters, and patterns -- no references to removed features.

---

### User Story 3 - Consistent Loading State Handling Across Components (Priority: P2)

A developer building new screens in either app wants a single, standard way to handle query loading, error, and success states. Currently, 2 components use matchQueryState while ~12 other components in both apps use manual if/return guard patterns for the same purpose. This inconsistency means developers must decide which pattern to use each time, and loading/error UI varies between screens.

**Why this priority**: Consistency improves developer velocity and user experience (predictable loading/error states). However, the manual pattern works correctly -- this is an improvement, not a fix.

**Independent Test**: Can be tested by converting one manual-guard component to matchQueryState and verifying identical visual behavior.

**Acceptance Scenarios**:

1. **Given** components with single-query loading guards, **When** converted to use the standardized loading state utility, **Then** the visual output is identical and the component has fewer lines of loading/error handling code.
2. **Given** components that combine multiple queries or mutations for their loading state, **When** evaluated for conversion, **Then** they are explicitly documented as exceptions that cannot use the single-query utility.
3. **Given** both CLI and web apps, **When** all single-query guard components are counted, **Then** at least 80% use the standardized pattern.

---

### User Story 4 - Documentation Reflects Implementation (Priority: P3)

The shared hooks documentation references features that no longer exist (e.g., batchEvents callback in useReviewStream) and lacks information about features that do exist (e.g., matchQueryState utility, domain-grouped file structure). A developer reading the docs gets a misleading picture of the hooks architecture.

**Why this priority**: Incorrect documentation is worse than no documentation -- it actively misleads. But this is documentation, not functionality, so it ranks below the working code stories.

**Independent Test**: Can be tested by comparing every statement in the documentation against the actual source code.

**Acceptance Scenarios**:

1. **Given** the shared hooks documentation, **When** it references the useReviewStream hook, **Then** it does not mention batchEvents or any removed parameters.
2. **Given** the documentation architecture section, **When** it lists files and their contents, **Then** the file tree matches the actual directory structure after consolidation.
3. **Given** the documentation, **When** it describes matchQueryState, **Then** it includes the correct check order (data-first), the guard clause usage pattern, and platform compatibility notes.

---

### Edge Cases

- What happens if the resume fails with an unexpected error code (not SESSION_STALE or SESSION_NOT_FOUND)? The system should surface the error through the streaming hook's error state and display it to the user, not silently swallow it.
- What happens if the fresh start also fails after a resume fallback? Standard error handling applies -- the error is displayed through the review error handler.
- What happens if the server session TTL changes? The resume/fallback logic should be robust to any rejection reason from the resume endpoint.
- What happens if two rapid review starts race (user clicks twice)? The AbortController cancels the first stream before starting the second.
- What happens if matchQueryState is called with a disabled query (neither loading nor with data/error)? The fallback `loading()` handler fires, which is the correct behavior for queries awaiting their first fetch.
- What happens when converting a component that combines query loading with mutation pending state to matchQueryState? These components are not candidates and should remain with manual patterns.
- What happens if the CLI app has the same resume-fallback bug? The CLI's `useReviewLifecycle` has its own resume logic that must be verified separately.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a review session resume fails (session stale, session not found, or any resume rejection), the system MUST automatically fall back to starting a fresh review with the user's configured lenses and mode.
- **FR-002**: The completion detection MUST NOT falsely trigger on a START→RESET transition caused by a failed resume. It MUST only trigger when the review pipeline has actually completed with real results (reviewId is set, or steps have progressed beyond initial state).
- **FR-003**: All review states (streaming, summary, results) and transitions MUST work correctly in the web app, including the resume→fallback→fresh-start path.
- **FR-004**: The web review MUST show agent cards with status transitions (queued, running, done, failed), progress indicators, and a live activity log during streaming, identical to pre-refactoring behavior.
- **FR-005**: The stale test file (`use-review-start.test.ts`) MUST be updated to cover the resume-failure-to-fresh-start fallback behavior with the current API.
- **FR-006**: All mutation hooks MUST use query factory methods for cache key construction -- no manual key assembly that could diverge from the factory.
- **FR-007**: The hooks package MUST have zero unnecessary comments that explain obvious code, zero dead code, and zero unused exports.
- **FR-008**: The matchQueryState utility MUST be validated as React 19 Compiler compatible with no unnecessary re-renders.
- **FR-009**: Components with single-query loading/error guards MUST use the standardized loading state utility where applicable, with documented exceptions for multi-query or mutation-based loading states.
- **FR-010**: The shared hooks documentation MUST accurately reflect the current implementation -- no references to removed features, correct file structure, correct API descriptions.
- **FR-011**: The CLI review flow MUST be verified for the same resume-fallback behavior -- if the same bug exists, it MUST be fixed.
- **FR-012**: Both apps MUST build and pass all existing tests after all changes.

### Key Entities

- **Review Pipeline**: The multi-step AI analysis flow (diff, context, review/agents, enrich, report) that produces code review results. Triggered by the user, orchestrated on the server, streamed via SSE to both apps.
- **Session Resume**: The process of reconnecting to an active server-side review session. When the session is stale or missing, the system must fall back to a fresh start.
- **Completion Detection**: The mechanism that detects when streaming has ended and transitions the UI from the progress view to the summary view. Must distinguish between a successful completion and a failed resume reset.
- **matchQueryState**: A utility that maps a query's state (loading/error/success) to corresponding render output. Used as a guard clause pattern in components to standardize loading/error handling.
- **Query Factory**: A configuration object that defines cache keys and fetch functions for each API resource. Used by hooks for type-safe cache invalidation.
- **Loading State Guard**: The per-component pattern of checking query loading/error state before rendering success content. Currently a mix of manual if/return and matchQueryState.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete a full code review in the web app after making changes to a previously-reviewed project (the stale session scenario), seeing all pipeline stages and agent results with no regression.
- **SC-002**: The resume→fallback→fresh-start path works in under 3 seconds total (failed resume detected and fresh start initiated without user intervention).
- **SC-003**: The hooks package audit produces zero critical or warning-level findings.
- **SC-004**: At least 80% of single-query loading guard components across both apps use the standardized pattern.
- **SC-005**: Documentation accuracy rate is 100% -- every statement in the shared hooks docs matches the actual implementation.
- **SC-006**: Both apps build and all existing tests pass after all changes.
- **SC-007**: The stale test file is updated and all test cases pass, covering the resume-failure-to-fresh-start behavior.

## Assumptions

- The root cause has been confirmed through code investigation: commit `9c4c807` removed the resume error-handling fallback from `use-review-start.ts`. The server-side pipeline is correct and untouched.
- The fix should restore the "start fresh on resume failure" behavior. The exact mechanism (returning Result from resume, exposing a state flag, or using an effect) is a planning-phase decision.
- The `useReviewCompletion` false trigger needs a guard condition (e.g., checking that `reviewId` is set or that pipeline steps progressed) to distinguish real completion from a resume RESET.
- The CLI app has its own `useReviewLifecycle` hook with separate resume logic that may or may not have the same bug. Verification is required.
- matchQueryState has been validated by independent research as a sound pattern: pure function, no hook rules violations, React 19 Compiler compatible, community-recognized approach. The check order (data-first) was already fixed in commit c3f9998.
- Components that combine multiple queries, use mutation pending states, or derive custom state objects from queries are not candidates for matchQueryState -- these are documented exceptions, not oversights.
- The streaming review hook (useReviewStream) is architecturally correct as a useReducer-based hook outside TanStack Query. SSE streaming does not fit the query/mutation model.
