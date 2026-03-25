# Research: Fix CLI Review Regression & Quality Audit

**Branch**: `013-fix-cli-review-audit` | **Date**: 2026-03-25

## R1: CLI Review Hang Root Cause

**Decision**: The bug is in `apps/cli/src/features/review/hooks/use-review-start.ts` — a missing recovery path when `stream.resume()` dispatches `RESET` for stale/expired sessions.

**Rationale**: The CLI version uses a multi-phase state machine (`idle → checking-config → checking-changes → streaming`) driven by `useEffect` chains. When `resumeById()` is called (line 70-74), it immediately sets `phase = "streaming"` and `hasStartedRef.current = true`. But `stream.resume()` in `use-review-stream.ts` (line 132-136) dispatches `RESET` for `SESSION_STALE`/`SESSION_NOT_FOUND`, which sets `isStreaming = false` and resets all steps to "pending". The start hook never detects this RESET — `phase` is already "streaming" and `hasStartedRef` is true, so no recovery path fires.

**Alternatives considered**:
1. **Add RESET detection in `useReviewStart`** (watch `stream.state.isStreaming` going false while `phase === "streaming"`) — fragile, adds coupling
2. **Adopt web's imperative pattern** (use `api.getActiveReviewSession()` directly instead of `useActiveReviewSession` hook) — aligns with working web code, eliminates the timing issue entirely
3. **Add onResetCallback to `useReviewStream`** — over-engineering, changes shared hook interface

**Selected approach**: Option 2 — rewrite CLI `useReviewStart` to match web's dependency-injection pattern. The web version:
- Receives `start`, `resume`, `getActiveSession` as props (dependency injection)
- Uses a single `useEffect` guarded by `hasStartedRef`
- Uses imperative `getActiveSession(mode).then(...).catch(...)` with fallback to `startFresh()`
- Never enters a state that can't be recovered from

## R2: CLI vs Web `useReviewStart` Divergence

**Decision**: Adopt the web's DI-based `useReviewStart` pattern for both apps.

**Rationale**: The web version is simpler (82 lines vs 110), more testable (all dependencies injected), and proven working. Key differences:

| Aspect | CLI (broken) | Web (working) |
|--------|-------------|---------------|
| Session check | `useActiveReviewSession(mode)` — TanStack Query hook | `getActiveSession(mode)` — imperative API call |
| Phase machine | 4 states, 2 useEffects | 1 useEffect, no explicit phases |
| Config check | Internal `useInit()` + `useSettings()` | Received as `configLoading`/`isConfigured` props |
| Guard | `hasStartedRef` + phase checks | `hasStartedRef` only |
| Stale session | Sets phase to "streaming" before resume, no recovery | Never sets state before resume confirms |

**Alternatives considered**:
- Keep CLI pattern but add recovery — more code, more states, harder to test
- Create a shared hook in `@diffgazer/api/hooks` — good for US5 (P3) but not needed to fix the bug now

## R3: CLI vs Web `useReviewCompletion` Divergence

**Decision**: Align CLI's completion delay logic with web's variable delay.

**Rationale**: CLI uses a fixed 2300ms delay. Web uses 2300ms when report step completed, 400ms otherwise. The web's variable delay provides better UX — shorter wait when the review didn't fully complete.

## R4: Duplicated Business Logic Inventory

**Decision**: Extract 6 duplicated functions to shared packages.

| Function | CLI Location | Web Location | Target |
|----------|-------------|-------------|--------|
| `filterIssues` | `review-results-view.tsx:19-25` | Uses `filterIssuesBySeverity` from core | Replace CLI local with `@diffgazer/core/review` import |
| `getProviderStatus` | `global-layout.tsx:10-16` | `global-layout.tsx:11-17` | Extract to `@diffgazer/core/format` |
| `getProviderDisplay` | `global-layout.tsx:18-22` | `global-layout.tsx:19-23` | Extract to `@diffgazer/core/format` |
| `mapStepStatus` | `review-progress-view.tsx:23-30` | `review-container.utils.ts` | Extract to `@diffgazer/core/review` |
| `getAgentDetail` | `review-progress-view.tsx:32-43` | `review-container.utils.ts` | Extract to `@diffgazer/core/review` |
| `tagToBadgeVariant` | `activity-log.tsx:8-19` | `log-entry.tsx:8-16` | Extract to `@diffgazer/schemas/ui` |

**Badge variant divergence**: CLI maps `agent → "success"`, web maps `agent → "info"`. Web is source of truth — use `"info"`.

## R5: Dead Code and Thin Wrappers

**Decision**: Remove all identified dead code.

| Item | Location | Reason |
|------|----------|--------|
| `GLOBAL_SHORTCUTS` | `apps/cli/src/config/navigation.ts:31-35` | Exported but never imported |
| `Size` type | `apps/cli/src/types/components.ts:2` | Exported but never imported |
| `types/components.ts` file | `apps/cli/src/types/components.ts` | `Variant` only used by toast (move inline), `Shortcut` re-export inconsistent |
| `onTabSwitch` no-op | `review-results-view.tsx:57-59` | Required but unused — make optional |

## R6: Settings Screen Bugs

**Decision**: Fix 3 bugs found in CLI settings screens.

1. **Providers screen swallows delete errors** (`providers-screen.tsx:69`): `error` variable combining `deleteCredentials.error` and `query.error` is computed but never rendered in the success path. Fix: display error below the detail pane.

2. **Diagnostics refresh partial failures** (`diagnostics-screen.tsx`): `handleRefreshAll` calls `retryServer()` and `refetchContext()` sequentially — if first throws, second never runs. Fix: use `Promise.allSettled()` matching web's pattern.

3. **Agent execution default mismatch**: CLI defaults to `"parallel"`, web defaults to `"sequential"`. Fix: both default to `"sequential"` (web is source of truth).

## R7: Remaining 012 Tasks Assessment

**Decision**: Complete 16 of 25 remaining tasks, deprecate 9.

**Complete (high value)**:
- T010-T012: formatTimestamp replacements (3 tasks)
- T013-T023: matchQueryState adoption (11 tasks, but some already done by agents)
- T034-T036: responsive breakpoint consumer adoption (3 tasks)

**Deprecate (low value or already superseded)**:
- T024 (Spinner import standardization) — cosmetic, not causing issues
- T025 (build verification) — will be done as part of 013 final verification
- T028 (`useReviewSettings` inline) — already done (file deleted per git status)
- T037 (split web `useReviewResultsKeyboard`) — already done (new files in git status)
- T038-T039 (diagnostics shared hook adoption) — already done (diagnostics.ts in git status)
- T045-T046 (build + grep verification) — superseded by 013 verification

## R8: Hook Consolidation Assessment (US5, P3)

**Decision**: Defer full consolidation to a future branch. Fix the bug in-place for now.

**Rationale**: Moving `useReviewStart` and `useReviewCompletion` to `@diffgazer/api/hooks` as fully shared hooks requires designing a platform-agnostic interface that accommodates both CLI's internal navigation and web's TanStack Router. This is architectural work beyond the scope of a bug fix + quality audit.

**What to do now**: Rewrite CLI's `useReviewStart` to use the web's DI pattern (imperative session check). This makes the code structurally similar enough that a future consolidation PR can cleanly merge them.

**Candidate for future consolidation**: `useReviewHistory` (web-only, zero platform deps, pure hook composition).
