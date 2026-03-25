# Tasks: Fix CLI Review Regression & Quality Audit

**Input**: Design documents from `/specs/013-fix-cli-review-audit/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — manual verification via build + smoke test.

**Organization**: Tasks grouped by user story. US1 (Review Fix) and US2 (DRY Consolidation) are P1 and share a foundational phase. US3 (Quality), US4 (012 Completion), and US5 (Hook Consolidation — deferred per research.md R8) follow.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Verify baseline compiles and runs before any changes

- [x] T001 Run `pnpm build && pnpm type-check` to verify baseline compiles with zero errors
- [x] T002 [P] Run `pnpm dev:cli`, start a review, confirm it hangs (reproduces the bug)
- [x] T003 [P] Run `pnpm dev:web`, start a review, confirm it completes (web is working reference)

**Checkpoint**: Bug reproduced in CLI, web confirmed working

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract shared functions to packages. MUST complete before consumer updates in US1/US2.

- [x] T004 Add `getProviderStatus(isLoading: boolean, isConfigured: boolean): "active" | "idle"` and `getProviderDisplay(provider?: string, model?: string): string` to `packages/core/src/format.ts`. Export from `@diffgazer/core/format`.
- [x] T005 [P] Add `mapStepStatus(status: StepState["status"]): "pending" | "running" | "complete" | "error"` and `getAgentDetail(agent: AgentState): string` to `packages/core/src/review/index.ts`. Import types from `@diffgazer/schemas/events`. Export from `@diffgazer/core/review`.
- [x] T006 [P] Add `TAG_BADGE_VARIANTS` constant to `packages/schemas/src/ui/ui.ts`. Map: `{ system: "default", agent: "info", tool: "warning", error: "destructive" }`. Use `"info"` for agent (web is source of truth). Export from `@diffgazer/schemas/ui`.
- [x] T007 Build shared packages: `pnpm --filter @diffgazer/core --filter @diffgazer/schemas --filter @diffgazer/api build` — verify new exports compile

**Checkpoint**: Shared packages ready — all consumer updates can now begin in parallel

---

## Phase 3: User Story 1 — CLI Review Completes Successfully (Priority: P1) MVP

**Goal**: Fix the hanging review — all 5 steps must progress to completion

**Independent Test**: Run `pnpm dev:cli`, select "Review Staged", verify all steps go WAIT → ACTIVE → COMPLETE, summary screen appears, results show issues

### Implementation for User Story 1

- [x] T008 [US1] Rewrite `apps/cli/src/features/review/hooks/use-review-start.ts` to adopt web's DI pattern: remove internal `useInit()`, `useSettings()`, `useActiveReviewSession()` calls. Accept `mode`, `configLoading`, `settingsLoading`, `isConfigured`, `defaultLenses`, `start`, `resume`, `getActiveSession` as props. Single `useEffect` guarded by `hasStartedRef`. Imperative `getActiveSession(mode).then(...).catch(() => startFresh())`. Return `{ hasStartedRef, hasStreamedRef }`. Match `apps/web/src/features/review/hooks/use-review-start.ts` interface exactly. See `specs/013-fix-cli-review-audit/contracts/shared-functions.md` for interface contract.
- [x] T009 [US1] Update `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` to pass DI props to rewritten `useReviewStart`: extract `api` via `useApi()`, pass `api.getActiveReviewSession` as `getActiveSession`, pass `stream.start`/`stream.resume`, pass `configLoading`/`settingsLoading`/`isConfigured` from `useInit()`/`useSettings()`. Remove redundant config queries from lifecycle. Keep `ReviewPhase` type, phase merging, loading message derivation, `isNoDiffError`, `isCheckingForChanges`.
- [x] T010 [US1] Update `apps/cli/src/features/review/hooks/use-review-completion.ts` to use variable delay: add `steps` prop (`StepState[]`), compute delay as `2300ms` if report step completed, `400ms` otherwise (matching web's `REPORT_COMPLETE_DELAY_MS` / `DEFAULT_COMPLETE_DELAY_MS` pattern from `apps/web/src/features/review/hooks/use-review-completion.ts`).
- [x] T011 [US1] Verify review fix: run `pnpm dev:cli`, start a review, confirm all 5 steps progress and complete. Test with both "Review Staged" and "Review Unstaged".

**Checkpoint**: CLI review works end-to-end. The critical regression is fixed.

---

## Phase 4: User Story 2 — Zero Duplicated Logic (Priority: P1)

**Goal**: All shared business logic exists in one location. Both apps import from shared packages.

**Independent Test**: `grep -rn "function filterIssues\|function getProviderStatus\|function getProviderDisplay\|function mapStepStatus\|function getAgentDetail\|tagToBadgeVariant" apps/` returns zero results.

### Implementation for User Story 2

- [x] T012 [P] [US2] In `apps/cli/src/components/layout/global-layout.tsx`: delete local `getProviderStatus` and `getProviderDisplay` functions. Import both from `@diffgazer/core/format`. Update call sites (no signature changes needed).
- [x] T013 [P] [US2] In `apps/web/src/components/layout/global-layout.tsx`: delete local `getProviderStatus` and `getProviderDisplay` functions. Import both from `@diffgazer/core/format`. Update call sites.
- [x] T014 [P] [US2] In `apps/cli/src/features/review/components/review-progress-view.tsx`: delete local `mapStepStatus` and `getAgentDetail` functions. Import both from `@diffgazer/core/review`. Keep `mapStepsToProgressItems` (CLI-specific output shape, uses the shared functions internally).
- [x] T015 [P] [US2] In `apps/cli/src/features/review/components/review-results-view.tsx`: delete local `filterIssues` function. Import `filterIssuesBySeverity` from `@diffgazer/core/review`. Replace `filterIssues(issues, severityFilter)` call with `filterIssuesBySeverity(issues, severityFilter)`. Remove the unnecessary `[...issues]` copy when filter is `"all"`.
- [x] T016 [P] [US2] In `apps/cli/src/features/review/components/activity-log.tsx`: delete local `tagToBadgeVariant` function. Import `TAG_BADGE_VARIANTS` from `@diffgazer/schemas/ui`. Replace `tagToBadgeVariant(tag)` calls with `TAG_BADGE_VARIANTS[tag] ?? "default"`. This aligns `agent` badge from `"success"` to `"info"` (web source of truth).
- [x] T017 [P] [US2] Verify web activity log (`apps/web/src/features/review/components/`) uses the same `TAG_BADGE_VARIANTS` or equivalent. If it has a local `TAG_VARIANTS` map, replace with shared import. If already correct, no changes needed.
- [x] T018 [US2] Build verification: `pnpm build && pnpm type-check` — zero errors after DRY consolidation

**Checkpoint**: Zero duplicated business logic between CLI and web apps.

---

## Phase 5: User Story 3 — Clean Codebase (Priority: P2)

**Goal**: Fix settings bugs, remove dead code, eliminate quality violations

**Independent Test**: Manual audit of all modified files — zero DRY/KISS/YAGNI/SRP/anti-slop findings

### Settings Bug Fixes

- [x] T019 [P] [US3] In `apps/cli/src/app/screens/settings/providers-screen.tsx`: the `error` variable on line ~69 combining `deleteCredentials.error` and `query.error` is computed but never rendered after `matchQueryState` guard passes. Add error display in the success path JSX (e.g., `{error && <Text color={tokens.error}>{error}</Text>}` near the detail pane).
- [x] T020 [P] [US3] In `apps/cli/src/app/screens/settings/diagnostics-screen.tsx`: replace sequential `handleRefreshAll` calls (`retryServer()` then `refetchContext()`) with `Promise.allSettled([retryServer(), refetchContext()])` so both execute regardless of individual failures. Match web's pattern in `apps/web/src/features/settings/hooks/use-diagnostics-keyboard.ts`.
- [x] T021 [P] [US3] In `apps/cli/src/app/screens/settings/agent-execution-screen.tsx`: change default execution mode from `"parallel"` to `"sequential"` (line ~27, change `?? "parallel"` to `?? "sequential"`). Web is source of truth and defaults to `"sequential"`.

### Dead Code Removal

- [x] T022 [P] [US3] In `apps/cli/src/config/navigation.ts`: remove `GLOBAL_SHORTCUTS` export (line ~31-35). It is exported but never imported anywhere.
- [x] T023 [P] [US3] In `apps/cli/src/types/components.ts`: remove unused `Size` type export (line ~2). Move `Variant` type definition inline to its only consumer (`apps/cli/src/components/ui/toast.tsx`). Remove the `Shortcut` re-export — update all CLI files that import `Shortcut` from `types/components.js` to import directly from `@diffgazer/schemas/ui`. Delete `types/components.ts` if empty after changes.
- [x] T024 [P] [US3] In `apps/cli/src/components/ui/dialog.tsx`: remove section comments `// --- Types ---`, `// --- Components ---`, and `// --- Compound export ---`. Code is 143 lines — structure is self-evident.
- [x] T025 [P] [US3] In `apps/cli/src/features/review/components/review-results-view.tsx`: remove the comment `// Reserve rows for header (2), footer (2), borders (2)` on line ~67. The arithmetic `rows - 6` is clear from context.

### Hook Interface Cleanup

- [x] T026 [P] [US3] In `apps/cli/src/features/review/hooks/use-review-keyboard.ts`: make `onTabSwitch` optional in the `ReviewKeyboardOptions` interface (add `?` to the property). Then in `apps/cli/src/features/review/components/review-results-view.tsx`: remove the no-op `onTabSwitch() { }` callback from the `useReviewKeyboard` call.

### Web Quality Fix

- [x] T027 [P] [US3] In `apps/web/src/features/settings/components/diagnostics/page.tsx`: remove unnecessary `useMemo` calls (~lines 45, 51). React 19 Compiler auto-memoizes — manual `useMemo` violates project convention (see CLAUDE.md: "No manual useCallback/useMemo").

### Trust Panel Pattern Fix

- [x] T028 [P] [US3] In `apps/cli/src/features/home/components/trust-panel.tsx`: replace hand-rolled `if (initLoading)` / `if (initError)` with `matchQueryState` from `@diffgazer/api/hooks` for the `useInit()` query. Import `matchQueryState`. Use the guard pattern consistent with other CLI settings screens.

- [x] T029 [US3] Build verification: `pnpm build && pnpm type-check` — zero errors after quality cleanup

**Checkpoint**: Zero quality findings across all modified files. No dead code, no thin wrappers, no anti-slop.

---

## Phase 6: User Story 4 — Complete Remaining 012 Tasks (Priority: P2)

**Goal**: Finish the 012 plan tasks that were started but not completed

**Independent Test**: Each remaining 012 task verified against its original acceptance criteria

### Format/Label Consolidation (from 012 Phase 3)

- [x] T030 [P] [US4] In `apps/cli/src/app/screens/settings/diagnostics-screen.tsx`: replace any local `formatTimestamp` with `formatTimestampLocale` from `@diffgazer/core/format` (012 task T010)
- [x] T031 [P] [US4] In `apps/web/src/features/settings/components/diagnostics/page.tsx`: replace any local `formatTimestamp` with `formatTimestampLocale` from `@diffgazer/core/format` (012 task T011)
- [x] T032 [P] [US4] In `apps/web/src/components/ui/severity/severity-breakdown.tsx`: replace local `SEVERITY_LABELS` definition with import from `@diffgazer/schemas/ui` (012 task T012)

### Responsive Breakpoint Consumer Adoption (from 012 Phase 5)

- [x] T033 [P] [US4] In `apps/cli/src/app/screens/history-screen.tsx` and `apps/cli/src/app/screens/settings/providers-screen.tsx`: replace ad-hoc `columns < 80` checks with `isNarrow` from `useResponsive()` hook (012 task T034). Import `useResponsive` from `../../hooks/use-terminal-dimensions.js`.
- [x] T034 [P] [US4] In `apps/cli/src/features/review/components/review-progress-view.tsx`: verify `isWide` from `useResponsive()` is used instead of ad-hoc `columns >= 100` (012 task T035). If already correct, mark as done. If not, replace.
- [x] T035 [P] [US4] In `apps/cli/src/components/layout/global-layout.tsx` and `apps/cli/src/components/ui/dialog.tsx`: replace direct `useStdout()` calls with `useTerminalDimensions()` for consistency (012 task T036). All terminal dimension reads should go through the centralized hook.

### matchQueryState Adoption (from 012 Phase 3, not already done)

- [x] T036 [P] [US4] In `apps/cli/src/app/screens/settings/hub-screen.tsx`: adopt `matchQueryState` for the settings query loading/error handling. The hub merges two queries — use `matchQueryState` on the primary query and handle the secondary inline (012 task T021).

- [x] T037 [US4] Build verification: `pnpm build && pnpm type-check` — zero errors after 012 completion

**Checkpoint**: All remaining 012 tasks completed or explicitly deprecated (see research.md R7 for deprecation list).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all user stories

- [x] T038 [P] Run `pnpm dev:cli` — full smoke test: start review (verify 5 steps complete), navigate all settings screens (verify no regressions), check history, verify error states (no provider, no changes)
- [x] T039 [P] Run `pnpm dev:web` — full smoke test: start review, navigate settings, verify parity with CLI behavior
- [x] T040 Run shared function consolidation grep verification:
  ```
  grep -rn "function filterIssues" apps/          # 0 results
  grep -rn "function getProviderStatus" apps/      # 0 results
  grep -rn "function getProviderDisplay" apps/     # 0 results
  grep -rn "function mapStepStatus" apps/          # 0 results
  grep -rn "function getAgentDetail" apps/         # 0 results
  grep -rn "tagToBadgeVariant" apps/               # 0 results
  grep -rn "GLOBAL_SHORTCUTS" apps/cli/src/        # 0 results
  ```
- [x] T041 Run `pnpm build && pnpm type-check` — final build verification with zero errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1. **BLOCKS** Phase 3 (US1) and Phase 4 (US2) consumer updates.
- **US1 (Phase 3)**: Depends on Phase 2 for shared functions. Sequential internally (T008 → T009 → T010 → T011).
- **US2 (Phase 4)**: Depends on Phase 2 for shared functions. All consumer tasks (T012-T017) are parallel.
- **US3 (Phase 5)**: No dependencies on Phase 2 — all tasks modify different files. Can start immediately after Phase 1.
- **US4 (Phase 6)**: No dependencies on Phase 2 — mostly independent file changes. Can start immediately after Phase 1.
- **Polish (Phase 7)**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: CRITICAL — must complete first (review is broken)
- **US2 (P1)**: Depends on Phase 2 foundation only. Independent of US1.
- **US3 (P2)**: Fully independent of US1/US2. All tasks touch different files.
- **US4 (P2)**: Fully independent. Some tasks touch same files as US3 (diagnostics-screen) — schedule these sequentially with US3 tasks on the same file.
- **US5 (P3)**: Deferred to future branch per research.md R8.

### File Conflict Map (tasks that touch the same file — must be sequential)

| File | Tasks | Ordering |
|------|-------|----------|
| `diagnostics-screen.tsx` | T020 (bug fix), T030 (formatTimestamp) | T020 → T030 |
| `review-results-view.tsx` | T015 (filterIssues), T025 (comment), T026 (onTabSwitch) | T015 → T025 → T026 |
| `providers-screen.tsx` | T019 (error display), T033 (responsive) | T019 → T033 |
| `global-layout.tsx` (CLI) | T012 (shared functions), T035 (useTerminalDimensions) | T012 → T035 |
| `dialog.tsx` | T024 (comments), T035 (useTerminalDimensions) | T024 → T035 |
| `diagnostics/page.tsx` (web) | T027 (useMemo), T031 (formatTimestamp) | T027 → T031 |

### Parallel Opportunities

**Maximum parallelism after Phase 2 (26 agents)**:

| Stream | Tasks | Agent Count |
|--------|-------|-------------|
| US1: Review Fix | T008 → T009 → T010 → T011 | 1 (sequential) |
| US2: Consumer Updates | T012, T013, T014, T015, T016, T017 | 6 (parallel) |
| US3: Settings Bugs | T019, T020, T021 | 3 (parallel) |
| US3: Dead Code | T022, T023, T024, T025 | 4 (parallel) |
| US3: Hook/Quality | T026, T027, T028 | 3 (parallel) |
| US4: Format/Labels | T030, T031, T032 | 3 (parallel) |
| US4: Responsive | T033, T034 | 2 (parallel) |
| US4: matchQueryState | T036 | 1 |
| **Peak total** | | **23 + 1 sequential = 24** |

---

## Parallel Example: After Phase 2

```bash
# Stream A: Review Bug Fix (sequential — 1 agent)
Agent: "T008: Rewrite use-review-start.ts to web's DI pattern"
# → then T009 → T010 → T011

# Stream B: Shared Function Consumers (6 parallel agents)
Agent: "T012: CLI global-layout.tsx — import getProviderStatus/Display from core"
Agent: "T013: Web global-layout.tsx — import getProviderStatus/Display from core"
Agent: "T014: CLI review-progress-view.tsx — import mapStepStatus/getAgentDetail from core"
Agent: "T015: CLI review-results-view.tsx — import filterIssuesBySeverity from core"
Agent: "T016: CLI activity-log.tsx — import TAG_BADGE_VARIANTS from schemas"
Agent: "T017: Web activity log — verify shared TAG_BADGE_VARIANTS"

# Stream C: Settings Bug Fixes (3 parallel agents)
Agent: "T019: providers-screen.tsx — render delete errors"
Agent: "T020: diagnostics-screen.tsx — Promise.allSettled refresh"
Agent: "T021: agent-execution-screen.tsx — default to sequential"

# Stream D: Dead Code Cleanup (4 parallel agents)
Agent: "T022: navigation.ts — remove GLOBAL_SHORTCUTS"
Agent: "T023: types/components.ts — remove Size, clean up"
Agent: "T024: dialog.tsx — remove section comments"
Agent: "T025: review-results-view.tsx — remove arithmetic comment"

# Stream E: Hook/Quality (3 parallel agents)
Agent: "T026: use-review-keyboard.ts — make onTabSwitch optional"
Agent: "T027: web diagnostics page — remove useMemo"
Agent: "T028: trust-panel.tsx — adopt matchQueryState"

# Stream F: 012 Completion (6 parallel agents)
Agent: "T030: CLI diagnostics — formatTimestampLocale"
Agent: "T031: Web diagnostics — formatTimestampLocale"
Agent: "T032: Web severity-breakdown — SEVERITY_LABELS import"
Agent: "T033: history + providers — isNarrow from useResponsive"
Agent: "T034: review-progress-view — verify isWide"
Agent: "T036: hub-screen — matchQueryState"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (verify baseline, reproduce bug)
2. Complete Phase 2: Foundation (extract shared functions)
3. Complete Phase 3: US1 (fix the review — T008-T011)
4. **STOP and VALIDATE**: CLI review completes successfully
5. The most critical regression is fixed — CLI is usable again

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add US1 (Phase 3) → Review works (MVP!)
3. Add US2 (Phase 4) → Zero duplication (DRY done)
4. Add US3 (Phase 5) → Clean codebase (quality done)
5. Add US4 (Phase 6) → 012 plan complete
6. Phase 7: Polish → Everything verified end-to-end

### Parallel Agent Strategy (up to 50 agents)

After Phase 2 completes:
- **Group 1** (1 agent): US1 review fix — sequential, critical path
- **Group 2** (6 agents): US2 consumer updates — all parallel
- **Group 3** (10 agents): US3 quality fixes — all parallel (except file conflicts)
- **Group 4** (7 agents): US4 remaining 012 tasks — all parallel (except file conflicts)
- **Group 5** (4 agents): Phase 7 verification — after all groups complete

Total: 28 agents used. Remaining capacity (22 agents) available for retry on any failed tasks.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US5 (Hook Consolidation, P3) deferred to future branch — see research.md R8
- File conflict map above shows tasks that MUST be sequential despite touching different concerns
- T008 is the critical fix — adopts web's DI pattern for `useReviewStart`
- 9 tasks from 012 are deprecated (already completed or superseded) — see research.md R7
- Commit after each phase or logical group
