# Feature Specification: Fix Persistent Web Review Regression & Hooks Validation

**Feature Branch**: `011-fix-review-validate-hooks`
**Created**: 2026-03-25
**Status**: Draft
**Input**: Web review remains broken after 010 fixes were applied. Instead of launching lenses, subagents, and streaming progress, the review shows descriptions/context summaries. Need deep end-to-end investigation, fix, and quality validation of the shared hooks architecture including matchQueryState.

## Context

Spec 010 diagnosed the web review regression (commit `9c4c807` removed resume-to-fresh-start fallback) and implemented fixes:
- `useReviewStream.resume()` now returns `Result<void, StreamReviewError>`
- `useReviewStart` handles `SESSION_STALE`/`SESSION_NOT_FOUND` with fallback to `startFresh()`
- `useReviewCompletion` has `reviewIdRef.current !== null` guard against false triggers
- CLI `useReviewLifecycle` has the same resume result check and completion guard
- Stale test file updated to match the current API

**Despite these fixes, the web review is still broken.** The user reports that instead of seeing lenses, subagents, agent cards, and streaming progress, the review displays "descriptions of something" (likely project context summaries). The 010 root cause was correct but insufficient -- there is an additional issue in the review rendering pipeline or data flow that prevents the full review from executing.

The problem is purely client-side (the server pipeline is untouched). The CLI may also be affected. This spec covers:
1. Deep diagnosis of the remaining web review bug
2. End-to-end fix and verification
3. Quality validation of shared hooks (matchQueryState, anti-slop, patterns)
4. Consistent matchQueryState adoption across both apps

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Web Review Displays Full Streaming Pipeline (Priority: P1)

A user clicks "Review Changes" in the web app. The system should check for an active session (and handle stale/missing sessions), then execute the full AI review pipeline: streaming SSE events, step progress indicators (diff, context, review, enrich, report), agent cards with status transitions (queued, running, done, failed), live activity log, and ultimately a summary with found issues. Currently, despite 010 fixes being applied, the review shows incorrect content -- likely project context descriptions or an empty/minimal summary instead of the full streaming experience.

**Why this priority**: This is the core product feature. Every user session hits this flow. The product is unusable for its primary purpose without this working.

**Independent Test**: Start the dev server (`pnpm dev`), navigate to review, trigger "Review Changes" with staged changes, and verify the complete streaming UI renders: step indicators, agent cards, activity log, and final summary with issues.

**Acceptance Scenarios**:

1. **Given** staged changes in the repository, **When** the user starts a review, **Then** the streaming UI appears with step progress indicators, agent cards, and live activity log -- not project context descriptions or a minimal summary.
2. **Given** a stale active session, **When** the user starts a review, **Then** the system detects the stale session, falls back to a fresh start, and the full streaming pipeline executes with all lenses and agents.
3. **Given** no active session, **When** the user starts a review, **Then** a fresh review starts immediately and streams all pipeline stages.
4. **Given** a valid active session, **When** the user returns to the review screen, **Then** the system resumes the session and displays current streaming state or completed results.
5. **Given** the streaming pipeline completes, **When** the completion detection fires, **Then** it only fires after real results arrive (reviewId is set) and displays the actual issues found by agents -- not a "0 issues" summary.
6. **Given** the review is running, **When** SSE events arrive for agents and steps, **Then** agent cards update in real-time with status transitions and the activity log shows events.

---

### User Story 2 - CLI Review Flow Works Identically (Priority: P1)

The CLI review flow (`useReviewLifecycle`) should produce the same behavior: check session, handle stale/resume errors, start fresh, stream full pipeline, show completion. The CLI has its own lifecycle hook that must be verified against the same scenarios.

**Why this priority**: The CLI is the primary interface for terminal users. Both apps share the same backend and hooks package -- a fix in one must be verified in the other.

**Independent Test**: Run `pnpm dev:cli`, navigate to review, select a mode, and verify the full streaming experience renders in the terminal with step progress, agent output, and final summary.

**Acceptance Scenarios**:

1. **Given** the CLI review flow, **When** a stale session is detected, **Then** the system falls back to fresh start and the terminal shows full streaming progress.
2. **Given** the CLI review is streaming, **When** agents produce output, **Then** the terminal renders agent cards and activity log in Ink format.
3. **Given** the CLI review completes, **When** the completion timer fires, **Then** it only fires after a real review with a valid reviewId.

---

### User Story 3 - Hooks Quality Meets Production Standards (Priority: P2)

The shared hooks package (`@diffgazer/api/hooks`) built across specs 006-010 needs final quality signoff: no dead code, no unnecessary abstractions, proper query factory usage, matchQueryState validated as a sound React 19 pattern, and documentation matches implementation.

**Why this priority**: Quality issues in a shared package multiply across both apps. However, the hooks work correctly for all non-review flows -- this is improvement, not a fix.

**Independent Test**: Run a code quality audit on all hooks files, verify each finding, and confirm fixes don't break any consumer.

**Acceptance Scenarios**:

1. **Given** all mutation hooks, **When** inspected for cache key usage, **Then** all use query factory methods for key construction (no manual key assembly).
2. **Given** the matchQueryState utility, **When** analyzed for React 19 Compiler compatibility, **Then** it causes no unnecessary re-renders and is correctly memoizable.
3. **Given** the shared hooks documentation, **When** compared to actual implementation, **Then** all descriptions match reality -- no references to removed features, correct file tree, correct API signatures.
4. **Given** both apps, **When** single-query loading guard components are counted, **Then** at least 80% use matchQueryState pattern consistently.

---

### Edge Cases

- What happens if the review screen component renders project context data (`useReviewContext()`) instead of streaming data (`useReviewStream` state) due to a wrong data source being read?
- What happens if the web review page's useEffect triggers project context fetch but not the streaming start?
- What happens if the review reducer's START action clears all state but the UI reads from a different state source (e.g., a separate query)?
- What happens if the review screen conditionally renders based on a phase/flag that was changed during the hooks refactoring?
- What happens if there's a race condition between the active session check query and the streaming start?
- What happens if the web review page mounts, fires the review context query, but the streaming hook never receives a `start()` call due to a dependency array issue?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The web review MUST display the full streaming pipeline UI (step indicators, agent cards, activity log) when a review is started, not project context descriptions or an empty summary.
- **FR-002**: The data source for the review streaming UI MUST be the `useReviewStream` hook's state (steps, agents, events, issues), not the `useReviewContext()` query.
- **FR-003**: The review rendering pipeline MUST correctly transition through all phases: idle -> checking config -> streaming -> completing -> summary -> results.
- **FR-004**: When a resume fails (stale, not found), the system MUST automatically fall back to a fresh start that executes the full pipeline with lenses and agents.
- **FR-005**: Completion detection MUST only fire after a real review completes (reviewId is set), never on a START->RESET transition from a failed resume.
- **FR-006**: The CLI review MUST be verified to work correctly through the same session/resume/start/stream/complete flow.
- **FR-007**: All mutation hooks MUST use query factory methods for cache key construction.
- **FR-008**: The matchQueryState utility MUST be validated as React 19 Compiler compatible.
- **FR-009**: Components using single-query loading guards SHOULD use matchQueryState where applicable.
- **FR-010**: Shared hooks documentation MUST accurately reflect the current implementation.
- **FR-011**: Both apps MUST build and pass all existing tests after changes.

### Key Entities

- **Review Streaming State**: The `ReviewStreamState` from `useReviewStream` containing steps, agents, events, issues, reviewId, isStreaming, error. This is the authoritative data source for the review UI during streaming.
- **Review Context**: The project context snapshot from `useReviewContext()`. This is a separate, independent query that provides project-level information. It MUST NOT be conflated with review streaming data.
- **Review Phase**: The lifecycle phase (idle, checking-config, checking-changes, streaming, completing, summary, results) that determines which UI is rendered.
- **matchQueryState**: Pure function mapping query state to render callbacks. Validated as React 19 Compiler compatible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete a full code review in the web app seeing all pipeline stages (step indicators, agent cards, activity log) and a final summary with real issues.
- **SC-002**: The stale session scenario (review -> make changes -> review again) works end-to-end: detects stale, falls back, starts fresh, streams full pipeline.
- **SC-003**: Both apps (web and CLI) build, all existing tests pass, and the review flow works end-to-end.
- **SC-004**: Zero hooks quality audit findings at warning level or higher remain.
- **SC-005**: At least 80% of single-query loading guard components use matchQueryState.
- **SC-006**: Shared hooks documentation matches implementation with 100% accuracy.

## Assumptions

- The server-side review pipeline is correct and untouched. The issue is purely client-side.
- The 010 fixes (resume Result return, completion guard, test updates) are correct and should be preserved. The remaining issue is in the review page/screen rendering or data flow.
- The most likely remaining cause is the review screen reading from a wrong data source (e.g., `useReviewContext()` instead of streaming state) or a conditional rendering change introduced during the hooks refactoring.
- Deep investigation using multiple parallel agents is needed to trace the complete data flow from "Review Changes" click through to the rendered UI.
- The matchQueryState pattern has been validated as sound (pure function, no hook violations, React 19 Compiler compatible). This spec validates it in context.
