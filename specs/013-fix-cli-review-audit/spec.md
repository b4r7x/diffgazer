# Feature Specification: Fix CLI Review Regression & Quality Audit

**Feature Branch**: `013-fix-cli-review-audit`
**Created**: 2026-03-25
**Status**: Draft
**Input**: Fix broken CLI review flow (regression from 012 changes), quality audit of CLI Ink implementation (clean-code, anti-slop, DRY, KISS, YAGNI, SRP), consolidate shared API hooks, ensure full CLI-web parity

## User Scenarios & Testing *(mandatory)*

### User Story 1 - CLI Review Completes Successfully (Priority: P1)

A developer starts a code review from the CLI. The review progresses through all 5 steps (Collect diff, Project context, Review issues, Enrich context, Generate report) and reaches the summary/results view. Currently the review hangs with all steps showing "WAIT" and never progresses.

**Why this priority**: The review is the core feature of diffgazer. A broken review makes the CLI unusable. This is a regression -- it worked before the 012 refactor.

**Independent Test**: Start a review from the CLI with `pnpm dev:cli`, select "Review Staged" or "Review Unstaged", and verify all 5 steps complete and results are displayed.

**Acceptance Scenarios**:

1. **Given** a fresh review with no active session, **When** the user starts a review, **Then** all 5 steps progress from "WAIT" through "ACTIVE" to "COMPLETE" and the results view appears
2. **Given** a stale/expired active session in the backend, **When** the user starts a review, **Then** the system recovers by starting a fresh review instead of hanging
3. **Given** no code changes in the working directory, **When** the user starts a review, **Then** the system shows a "No changes" message (matching the web behavior)
4. **Given** no AI provider configured, **When** the user starts a review, **Then** the system shows a "Configure Provider" prompt (matching the web behavior)
5. **Given** a review is in progress, **When** the user presses Escape, **Then** the review is cancelled and the user returns to the home screen

---

### User Story 2 - Zero Duplicated Logic Between CLI and Web (Priority: P1)

Shared business logic (issue filtering, step status mapping, agent detail formatting, provider status display) exists in a single location. Both CLI and web import from the shared source. No function is reimplemented in both apps.

**Why this priority**: Duplicated logic leads to divergent behavior (bugs visible in the audit: agent badge variant mismatch, default execution mode mismatch) and doubles maintenance cost. Fixing the review bug requires touching these same code paths.

**Independent Test**: Run `grep` across both apps for any function that exists in both -- zero matches for duplicated business logic.

**Acceptance Scenarios**:

1. **Given** the CLI's `filterIssues` function, **When** the consolidation is complete, **Then** it is replaced by `filterIssuesBySeverity` from `@diffgazer/core/review`
2. **Given** `getProviderStatus` and `getProviderDisplay` duplicated in both apps' `global-layout.tsx`, **When** consolidation is complete, **Then** a single shared implementation exists and both apps import it
3. **Given** `mapStepStatus`, `getAgentDetail`, and step-to-progress mapping logic duplicated in review views, **When** consolidation is complete, **Then** shared implementations exist in `@diffgazer/core/review`
4. **Given** `tagToBadgeVariant` in CLI maps `agent` to `"success"` while web maps it to `"info"`, **When** consolidation is complete, **Then** a single shared mapping produces consistent behavior

---

### User Story 3 - Clean Codebase with Zero Quality Violations (Priority: P2)

All code follows DRY, KISS, YAGNI, and SRP principles. Dead code, thin wrappers, unnecessary abstractions, and anti-slop patterns are removed. The codebase passes a quality audit with zero findings.

**Why this priority**: High quality code is essential for maintainability, but fixing the review regression and eliminating duplication take precedence. Some quality fixes overlap with the duplication work.

**Independent Test**: Run a manual audit checklist against all modified files -- zero findings for dead code, thin wrappers, or unnecessary abstractions.

**Acceptance Scenarios**:

1. **Given** `GLOBAL_SHORTCUTS` in CLI navigation.ts is never imported, **When** cleanup is complete, **Then** the export is removed
2. **Given** `Size` type in CLI `types/components.ts` is never used, **When** cleanup is complete, **Then** the export is removed
3. **Given** `types/components.ts` is a thin wrapper that re-exports `Shortcut` from schemas while some consumers import directly from schemas, **When** cleanup is complete, **Then** all imports use a consistent source
4. **Given** `onTabSwitch` is required by `useReviewKeyboard` but the consumer passes a no-op, **When** cleanup is complete, **Then** the callback is optional in the hook interface
5. **Given** section comments like `// --- Types ---` in `dialog.tsx` add no value, **When** cleanup is complete, **Then** unnecessary organizational comments are removed
6. **Given** CLI providers screen computes an `error` variable that is never rendered, **When** cleanup is complete, **Then** delete errors are properly displayed to the user
7. **Given** CLI diagnostics `handleRefreshAll` doesn't handle partial failures, **When** cleanup is complete, **Then** both refresh operations execute regardless of individual failures
8. **Given** CLI defaults agent execution to "parallel" while web defaults to "sequential", **When** cleanup is complete, **Then** both apps use the same default

---

### User Story 4 - Incomplete 012 Tasks Completed (Priority: P2)

The remaining 25 tasks from the 012-cli-ink-web-parity plan are completed. This includes matchQueryState adoption across settings screens, responsive breakpoint consumer adoption, and SRP decomposition verification.

**Why this priority**: These tasks represent planned work that was started but not finished. Completing them ensures the 012 goals are fully met.

**Independent Test**: Verify each remaining 012 task against its original acceptance criteria.

**Acceptance Scenarios**:

1. **Given** `trust-panel.tsx` and other single-query screens hand-roll loading/error, **When** adoption is complete, **Then** they use `matchQueryState` per project conventions
2. **Given** ad-hoc `columns < 80` checks exist in CLI components, **When** responsive adoption is complete, **Then** they use the centralized `isNarrow`/`isWide` from `useResponsive()`
3. **Given** direct `useStdout()` calls exist alongside `useTerminalDimensions`, **When** cleanup is complete, **Then** all terminal dimension reads go through the centralized hook

---

### User Story 5 - Review Hook Consolidation (Priority: P3)

The `useReviewStart` and `useReviewCompletion` hooks are unified between CLI and web into shared implementations in `@diffgazer/api/hooks`, with platform-specific callers adapting the shared interface.

**Why this priority**: The hooks were extracted in 012 but diverged between CLI and web. Unifying them prevents future drift and makes the review bug fix durable. However, fixing the bug itself (US1) takes priority over architectural consolidation.

**Independent Test**: Both CLI and web review flows work correctly, both importing start/completion logic from the shared hooks package.

**Acceptance Scenarios**:

1. **Given** CLI `useReviewStart` uses a TanStack Query hook for session check while web uses an imperative API call, **When** consolidation is complete, **Then** both use the same session-check approach (imperative, matching web's pattern)
2. **Given** CLI `useReviewCompletion` uses a fixed 2300ms delay while web uses a variable delay, **When** consolidation is complete, **Then** both use the same delay logic
3. **Given** `useReviewHistory` exists only in web but has zero platform dependencies, **When** consolidation is complete, **Then** it lives in `@diffgazer/api/hooks` and both apps import it

---

### Edge Cases

- What happens when the server is unreachable during review start? The system should show an error message and allow retry, not hang.
- What happens when `useActiveReviewSession` returns a session that becomes stale mid-stream? The stream hook's `RESET` dispatch must trigger a recovery path.
- What happens when two reviews are started rapidly in sequence? The `hasStartedRef` guard must prevent double-starts.
- What happens when the terminal is resized during a review? The layout must adapt using centralized responsive breakpoints.
- What happens when `matchQueryState` is used with a query that has no data but no error (initial fetch)? The `loading` callback handles this correctly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: CLI review MUST progress through all 5 steps to completion when the backend is responsive and configured
- **FR-002**: CLI review MUST recover from stale active sessions by falling back to a fresh review start
- **FR-003**: CLI review MUST show appropriate error views for "no provider configured" and "no changes detected" scenarios, matching web behavior
- **FR-004**: Shared business logic functions (issue filtering, step status mapping, provider status display, badge variant mapping) MUST exist in exactly one location imported by both apps
- **FR-005**: CLI settings screens that depend on a single query MUST use `matchQueryState` for loading/error/success rendering
- **FR-006**: Dead exports (`GLOBAL_SHORTCUTS`, `Size` type, unused re-exports) MUST be removed
- **FR-007**: CLI providers screen MUST display delete-credential errors to the user
- **FR-008**: CLI diagnostics refresh MUST execute both operations regardless of individual failures
- **FR-009**: Default values for settings (agent execution mode) MUST be consistent between CLI and web
- **FR-010**: Ad-hoc terminal dimension checks MUST use centralized responsive breakpoints
- **FR-011**: Optional callbacks in hook interfaces MUST be typed as optional rather than requiring no-op implementations

## Assumptions

- The 012 branch changes are the baseline -- we build on them, not revert them
- The shared hooks package (`@diffgazer/api/hooks`) infrastructure (ApiProvider, QueryClient, etc.) is stable and working
- The server/backend endpoints are unchanged and working correctly
- The review bug is in the client-side hook logic, not in the server's SSE streaming
- Web review flow is working correctly and serves as the reference implementation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: CLI review completes successfully 100% of the time when backend is responsive and configured (currently 0% due to hang)
- **SC-002**: Zero duplicated business logic functions across CLI and web apps (currently at least 6 duplicated functions identified)
- **SC-003**: Zero dead exports in shared packages and app code (currently at least 3 identified)
- **SC-004**: 100% of single-query settings screens use `matchQueryState` for loading/error/success rendering
- **SC-005**: Zero quality audit findings (DRY, KISS, YAGNI, SRP, anti-slop) across all modified files
- **SC-006**: All remaining 012 plan tasks completed or explicitly deprecated with justification
- **SC-007**: Both CLI and web produce identical review results for the same input (behavioral parity)
- **SC-008**: CLI terminal layout adapts correctly at narrow (<80 columns), standard (80-100), and wide (>100) breakpoints
