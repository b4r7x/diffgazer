# Tasks: CLI-Web Full Parity with Shared Infrastructure

**Input**: Design documents from `/specs/015-cli-web-parity-shared-infra/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational — Fix CLI Navigation (Blocking)

**Purpose**: Fix the critical navigation bug (HOME-NAV-001) that blocks all CLI usage. MUST complete before any other phase.

**Root cause**: `TerminalKeyboardProvider.useInput` closes over stale `scopeStack` state from initial render. `useScope` accumulates stack entries without dedup.

- [x] T001 [P] [US1] Fix stale closure in keyboard provider — replace `useState<string[]>([])` with `useRef<string[]>([])` for scopeStack, keep `useState` counter for re-render triggers only, update `useInput` handler to read `scopeStackRef.current` in `apps/cli/src/app/providers/keyboard-provider.tsx`
- [x] T002 [P] [US1] Fix scope stack accumulation — add dedup guard (check if scope already on top before pushing), add bounds check to prevent unbounded growth in `apps/cli/src/hooks/use-scope.ts`
- [x] T003 [US1] Verify TrustPanel keyboard navigation works for fresh projects and all 7 home menu items navigate to correct screens in `apps/cli/src/app/screens/home-screen.tsx`

**Checkpoint**: CLI home screen navigation works — arrow keys highlight menu items, Enter navigates to screens, Esc returns home. All 14 screens reachable.

---

## Phase 2: US1 — Add Missing Review Components for Full Parity (Priority: P1)

**Goal**: Add 10 missing review detail components to CLI so the review experience matches the web exactly — Trace tab, Patch tab, interactive fix plan, AgentBoard, context preview, metrics footer, severity filter group, and dedicated error views.

**Independent Test**: Complete a review in CLI, navigate to results. Verify all 4 tabs exist (Details, Explain, Trace, Patch), fix plan is interactive, agent board shows during streaming, metrics footer displays during progress.

### Implementation for US1 — New CLI Components

- [x] T004 [P] [US1] Create terminal diff viewer component for Patch tab in `apps/cli/src/features/review/components/diff-view.tsx` — reference `apps/web/src/features/review/components/diff-view.tsx` for data shape and layout
- [x] T005 [P] [US1] Create interactive fix plan checklist component with checkbox toggling per step in `apps/cli/src/features/review/components/fix-plan-checklist.tsx` — reference `apps/web/src/features/review/components/fix-plan-checklist.tsx`
- [x] T006 [P] [US1] Create agent board component showing agent states during review streaming in `apps/cli/src/features/review/components/agent-board.tsx` — reference `apps/web/src/features/review/components/agent-board.tsx`
- [x] T007 [P] [US1] Create context snapshot preview component in `apps/cli/src/features/review/components/context-snapshot-preview.tsx` — reference `apps/web/src/features/review/components/context-snapshot-preview.tsx`
- [x] T008 [P] [US1] Create review metrics footer showing files processed, issues found, elapsed time in `apps/cli/src/features/review/components/review-metrics-footer.tsx` — reference `apps/web/src/features/review/components/review-metrics-footer.tsx`
- [x] T009 [P] [US1] Create severity filter button group replacing inline filter cycling in `apps/cli/src/features/review/components/severity-filter-group.tsx` — reference `apps/web/src/features/review/components/severity-filter-group.tsx`
- [x] T010 [P] [US1] Create dedicated NoChangesView offering mode switch in `apps/cli/src/features/review/components/no-changes-view.tsx` — reference `apps/web/src/features/review/components/no-changes-view.tsx`
- [x] T011 [P] [US1] Create dedicated ApiKeyMissingView offering settings navigation in `apps/cli/src/features/review/components/api-key-missing-view.tsx` — reference `apps/web/src/features/review/components/api-key-missing-view.tsx`

### Implementation for US1 — Update Existing CLI Components

- [x] T012 [US1] Add Trace and Patch tabs to issue details pane — add Trace tab showing agent tool execution history (step, tool, input/output, artifacts) and Patch tab using new diff-view component in `apps/cli/src/features/review/components/issue-details-pane.tsx`
- [x] T013 [US1] Integrate AgentBoard, ContextSnapshotPreview, and ReviewMetricsFooter into review progress view in `apps/cli/src/features/review/components/review-progress-view.tsx`
- [x] T014 [US1] Update IssueListPane to use new SeverityFilterGroup component replacing inline filter cycling in `apps/cli/src/features/review/components/issue-list-pane.tsx`
- [x] T015 [US1] Update ReviewContainer to use dedicated NoChangesView and ApiKeyMissingView instead of generic callouts in `apps/cli/src/features/review/components/review-container.tsx`

### Implementation for US1 — Web Parity (Bi-directional)

- [x] T016 [P] [US1] Add betterOptions and testsToAdd array display to web issue details pane (CLI has these, web doesn't) in `apps/web/src/features/review/components/issue-details-pane.tsx`

**Checkpoint**: CLI review flow shows all data matching web — 4 tabs in details, interactive fix plan, agent board during streaming, metrics footer, dedicated error views. Web gains betterOptions/testsToAdd display.

---

## Phase 3: US2 — Shared API Data Layer Verification (Priority: P1)

**Goal**: Verify zero hand-rolled fetch patterns exist, all screens use `matchQueryState()`, and shared hooks are the single source of truth.

**Independent Test**: Grep both apps for `fetch(`, `useState.*useEffect` patterns. Zero results outside documented exceptions.

- [x] T017 [P] [US2] Audit CLI app for direct fetch() calls and hand-rolled useState+useEffect data-fetching patterns — fix any found, ensure all API state uses shared hooks from `@diffgazer/api/hooks` in `apps/cli/src/`
- [x] T018 [P] [US2] Audit web app for direct fetch() calls and hand-rolled useState+useEffect data-fetching patterns — fix any found, ensure all API state uses shared hooks from `@diffgazer/api/hooks` in `apps/web/src/`
- [x] T019 [US2] Verify all CLI screens use `matchQueryState()` for loading/error/success rendering — replace any manual `if(isLoading)...if(error)...` guards with matchQueryState where applicable across `apps/cli/src/app/screens/` and `apps/cli/src/features/`

**Checkpoint**: Both apps use shared hooks exclusively. No duplication of API logic.

---

## Phase 4: US3 — Settings and Onboarding Parity (Priority: P2)

**Goal**: Verify CLI onboarding wizard and all 7 settings sub-pages match web equivalents in options, validation, and behavior.

**Independent Test**: Walk through full onboarding in both CLI and web. Verify identical config produced. Open each settings sub-page and compare options/controls.

- [x] T020 [P] [US3] Verify CLI onboarding wizard parity — compare all 6 steps (Storage, Provider, API Key, Model, Analysis, Execution) against web wizard, fix any missing options or validation differences in `apps/cli/src/features/onboarding/`
- [x] T021 [P] [US3] Verify CLI settings hub and sub-pages parity — compare Trust, Theme, Provider, Storage, Agent Execution, Analysis, Diagnostics screens against web equivalents, fix any missing options or layout differences in `apps/cli/src/app/screens/settings/`
- [x] T022 [US3] Verify CLI provider settings workflow parity — compare search/filter, API key input (paste/env var), model selection with filtering, activate/deactivate against web in `apps/cli/src/features/providers/`

**Checkpoint**: Configuration through CLI produces identical results to web. All settings screens show same options.

---

## Phase 5: US4 — History Browsing Parity (Priority: P2)

**Goal**: Verify CLI history screen matches web's three-pane layout with timeline, run list, and insights pane.

**Independent Test**: Complete 3+ reviews, open history in both platforms, verify identical data and layout.

- [x] T023 [US4] Verify CLI history screen three-pane layout matches web — timeline grouped by date, scrollable run list, insights pane with severity breakdown — fix any missing data fields or layout differences in `apps/cli/src/app/screens/history-screen.tsx` and `apps/cli/src/features/history/`
- [x] T024 [US4] Verify CLI history search functionality filters by review ID, branch, and project path — same as web search in `apps/cli/src/features/history/`

**Checkpoint**: History screen in CLI shows identical data and layout to web.

---

## Phase 6: US5 — Live Responsive Layout in Both Platforms (Priority: P2)

**Goal**: Create shared breakpoint constants and implement live viewport/terminal detection in both CLI and web with 3-tier layout system (narrow < 80, medium 80-119, wide >= 120).

**Independent Test**: Resize CLI terminal and web browser to matching widths. Verify identical layout transitions at each breakpoint.

### Implementation for US5

- [x] T025 [US5] Create shared breakpoint constants — export `BREAKPOINTS`, `BreakpointTier` type, and `getBreakpointTier()` helper in `packages/core/src/layout/breakpoints.ts` and re-export from `packages/core/src/index.ts`
- [x] T026 [US5] Update CLI responsive hook — import shared breakpoints from `@diffgazer/core`, replace hardcoded 80/100 thresholds, add `isMedium` boolean, update `isWide` threshold to 120, return `tier: BreakpointTier` in `apps/cli/src/hooks/use-terminal-dimensions.ts`
- [x] T027 [P] [US5] Create web viewport breakpoint hook — use `matchMedia` for JS-level viewport detection, import shared breakpoints from `@diffgazer/core`, return `tier: BreakpointTier` and `{ isNarrow, isMedium, isWide }`, fire on resize events in `apps/web/src/hooks/use-viewport-breakpoint.ts`
- [x] T028 [US5] Update all CLI screens using responsive layouts to 3-tier breakpoint system — update providers-screen, history-screen, review-results-view, review-progress-view to use `tier` from shared hook in `apps/cli/src/app/screens/` and `apps/cli/src/features/review/components/`
- [x] T029 [US5] Update web screens to use JS-level responsive hook alongside Tailwind for parity verification — integrate `useViewportBreakpoint()` where layouts must match CLI behavior in `apps/web/src/features/`

**Checkpoint**: Both platforms switch layouts at identical breakpoints. Resizing preserves state.

---

## Phase 7: US6 — Cross-Workspace Quality Audit (Priority: P3)

**Goal**: Audit all 5 workspace repos for anti-patterns and fix all findings in-place. Zero remaining issues.

**Independent Test**: Re-audit after fixes. All repos build, type-check, pass tests.

- [x] T030 [P] [US6] Audit and fix diffgazer monorepo — fix `as any` cast in `apps/docs/source.config.ts`, review manual useCallback/useMemo in web app for React 19 Compiler compatibility, verify matchQueryState usage across all screens in `/Users/voitz/Projects/diffgazer-workspace/diffgazer/`
- [x] T031 [P] [US6] Audit and fix keyscope — review keyboard-provider.tsx useCallback usage, verify no anti-patterns, run `pnpm test` in `/Users/voitz/Projects/diffgazer-workspace/keyscope/`
- [x] T032 [P] [US6] Audit and fix diff-ui — review command-palette useCallback usage, verify component patterns align with CLI Ink patterns, run type-check in `/Users/voitz/Projects/diffgazer-workspace/diff-ui/`
- [x] T033 [P] [US6] Audit and fix cli-core — verify no `any` types, no dead code, no anti-patterns, run type-check in `/Users/voitz/Projects/diffgazer-workspace/cli-core/`
- [x] T034 [P] [US6] Audit and fix registry-kit — verify no `any` types, no dead code, no anti-patterns, run `pnpm test` in `/Users/voitz/Projects/diffgazer-workspace/registry-kit/`

**Checkpoint**: All 5 repos pass audit. Zero remaining findings.

---

## Phase 8: Polish — End-to-End Verification

**Purpose**: Final verification that all user stories are complete and working together.

- [x] T035 [P] Screen-by-screen parity verification — launch CLI, navigate to every screen, compare each with web equivalent, verify same data/controls/keyboard shortcuts, document any remaining gaps
- [x] T036 [P] Responsive layout verification — test CLI at 40, 80, 100, 120, 200 columns and web at equivalent viewport widths, verify same breakpoints trigger same layout changes, verify resize preserves state
- [x] T037 Full workspace build verification — run `pnpm run build` and `pnpm run type-check` across all 5 repos, run all test suites, verify zero failures and zero regressions

**Checkpoint**: Feature complete. All acceptance scenarios pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately. **BLOCKS ALL other phases**.
- **Phase 2 (US1 — Review Components)**: Depends on Phase 1 completion (need working navigation)
- **Phase 3 (US2 — API Verification)**: Depends on Phase 1 completion (need to test screens)
- **Phase 4 (US3 — Settings Parity)**: Depends on Phase 1 completion (need to navigate to settings)
- **Phase 5 (US4 — History Parity)**: Depends on Phase 1 completion (need to navigate to history)
- **Phase 6 (US5 — Responsive)**: Depends on Phase 1 completion (need working screens to test layouts)
- **Phase 7 (US6 — Quality Audit)**: Depends on Phases 2-6 (audit after functional changes)
- **Phase 8 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Start after Phase 1 — no cross-story dependencies
- **US2 (P1)**: Start after Phase 1 — independent of US1
- **US3 (P2)**: Start after Phase 1 — independent of US1, US2
- **US4 (P2)**: Start after Phase 1 — independent of US1, US2, US3
- **US5 (P2)**: Start after Phase 1 — needs T025 (shared constants) before T026-T029
- **US6 (P3)**: Start after Phases 2-6 — audits the code changed in all prior stories

### Within Each Phase

- Tasks marked [P] can run in parallel (different files)
- Tasks without [P] have dependencies on prior tasks within the same phase
- T012-T015 depend on T004-T011 (integrate new components into existing files)
- T026 depends on T025 (CLI hook needs shared constants)
- T028-T029 depend on T025-T027 (screens need updated hooks)

### Parallel Opportunities

**Maximum concurrency by phase:**
- Phase 1: 2 parallel (T001, T002) then T003
- Phase 2: 8 parallel (T004-T011), then 4 sequential (T012-T015), plus T016 parallel
- Phase 3: 2 parallel (T017, T018) then T019
- Phase 4: 2 parallel (T020, T021) then T022
- Phase 5: 1 (T023) then T024
- Phase 6: T025 first, then T026+T027 parallel, then T028+T029
- Phase 7: 5 parallel (T030-T034)
- Phase 8: 2 parallel (T035, T036) then T037

**After Phase 1 completes, Phases 2-6 can all run in parallel (up to 20 agents).**

---

## Parallel Example: Phase 2 (US1 — Review Components)

```text
# Wave 1: Launch all 8 new component tasks in parallel:
T004: "Create diff-view.tsx"
T005: "Create fix-plan-checklist.tsx"
T006: "Create agent-board.tsx"
T007: "Create context-snapshot-preview.tsx"
T008: "Create review-metrics-footer.tsx"
T009: "Create severity-filter-group.tsx"
T010: "Create no-changes-view.tsx"
T011: "Create api-key-missing-view.tsx"

# Wave 2: After Wave 1 completes, integrate into existing files:
T012: "Add Trace/Patch tabs to issue-details-pane.tsx"
T013: "Integrate new components into review-progress-view.tsx"
T014: "Update issue-list-pane.tsx with SeverityFilterGroup"
T015: "Update review-container.tsx with dedicated views"

# Parallel with both waves (different app):
T016: "Add betterOptions/testsToAdd to web issue-details-pane.tsx"
```

---

## Parallel Example: Phases 2-6 After Phase 1

```text
# After Phase 1 (nav fix) completes, launch up to 20 agents:

# US1 agents (Phase 2):
T004-T011: 8 new CLI components (parallel)
T016: web parity fix (parallel)

# US2 agents (Phase 3):
T017: CLI fetch audit
T018: Web fetch audit

# US3 agents (Phase 4):
T020: Onboarding parity
T021: Settings parity

# US4 agent (Phase 5):
T023: History parity

# US5 agent (Phase 6):
T025: Shared breakpoint constants

# Total: up to 14 parallel agents in first wave
```

---

## Implementation Strategy

### MVP First (US1 — Fix Navigation + Review Parity)

1. Complete Phase 1: Fix navigation bug (T001-T003)
2. Complete Phase 2: Add missing review components (T004-T016)
3. **STOP and VALIDATE**: Launch CLI, navigate all screens, complete a review, verify all tabs and components present
4. This alone makes the CLI fully usable

### Incremental Delivery

1. Phase 1 → Navigation works → CLI usable
2. Phase 2 → Review experience matches web → Core product parity
3. Phases 3-5 → Settings, history, API verified → Full feature parity
4. Phase 6 → Responsive breakpoints shared → Layout parity
5. Phase 7 → Quality audit → Codebase health
6. Phase 8 → E2E verification → Ship-ready

### Parallel Agent Strategy (up to 20 agents)

1. Phase 1: 3 agents fix navigation (5 min)
2. After Phase 1: 14 agents across Phases 2-6 simultaneously
3. After Phases 2-6: 5 agents for quality audit (Phase 7)
4. After Phase 7: 3 agents for E2E verification (Phase 8)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Phase 1 is the critical path — blocks all other work
- Phases 2-6 can run in parallel for maximum throughput
- All file paths are relative to `/Users/voitz/Projects/diffgazer-workspace/diffgazer/` unless absolute path given
- Reference web components when building CLI equivalents to ensure prop/layout parity
