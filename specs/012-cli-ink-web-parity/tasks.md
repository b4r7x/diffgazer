# Tasks: CLI Ink Web Parity

**Input**: Design documents from `/specs/012-cli-ink-web-parity/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — test tasks omitted. Manual verification via build + smoke test.

**Organization**: Tasks grouped by user story. US2 (Screen Parity) and US5 (Onboarding) are already complete per research — verified in Polish phase only.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Verify baseline builds, establish working state before any changes

- [x] T001 Run `pnpm build` and `pnpm type-check` to verify baseline compiles with zero errors
- [x] T002 Run `pnpm dev:cli` and verify all 14 screens are navigable without errors
- [x] T003 Run `pnpm dev:web` and verify all 14 routes render without errors

**Checkpoint**: Baseline verified — all apps build and run correctly before any refactoring

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared package changes that both apps depend on — MUST complete before user story phases

- [x] T004 Extract shared `NavigationConfig` types (`MenuAction`, `SettingsAction`, `NavItem`, `SettingsMenuItem`) and constants (`MENU_ITEMS`, `SETTINGS_MENU_ITEMS`) from `apps/cli/src/config/navigation.ts` and `apps/web/src/config/navigation.ts` into `packages/schemas/src/ui/ui.ts`. Keep platform-specific shortcut lists in each app's local config. Update both app configs to import from `@diffgazer/schemas/ui`.
- [x] T005 Remove CLI-local `Shortcut` type definitions from `apps/cli/src/types/components.ts` and `apps/cli/src/config/navigation.ts`. Update all CLI imports to use `Shortcut` from `@diffgazer/schemas/ui`. Verify no local `interface Shortcut` remains in `apps/cli/`.
- [x] T006 [P] Add `formatTimestampLocale()` variant to `packages/core/src/format.ts` for `toLocaleString()` formatting (used by both diagnostics pages). Add `formatElapsed()` variant for `mm:ss` format (used by CLI activity log). Export both from `@diffgazer/core/format`.
- [x] T007 [P] Create `useDiagnosticsData()` shared hook in `packages/api/src/hooks/diagnostics.ts`. Extract status derivation logic (contextStatus, setupStatus, serverState, isRefreshing, refresh handlers) shared between both diagnostics pages. Export from `packages/api/src/hooks/index.ts`. Must work in both browser and Node.js/Ink environments.
- [x] T008 Run `pnpm --filter @diffgazer/schemas build && pnpm --filter @diffgazer/core build && pnpm --filter @diffgazer/api build` to verify shared packages compile after foundational changes

**Checkpoint**: Foundation ready — shared packages updated, both apps can now be updated to consume new shared code

---

## Phase 3: User Story 1 — Unified API Data Fetching (Priority: P1)

**Goal**: Eliminate all duplicate data-fetching logic and types between CLI and web. Standardize loading/error/empty state handling via `matchQueryState`.

**Independent Test**: Launch CLI and web side-by-side with same backend. Navigate all data-driven screens. Verify both show identical data, identical loading states, identical error states.

### Implementation for User Story 1

- [x] T009 [P] [US1] Replace local `formatTimestamp` in `apps/cli/src/features/review/components/activity-log.tsx` with `formatElapsed` from `@diffgazer/core/format`
- [ ] T010 [P] [US1] Replace local `formatTimestamp` in `apps/cli/src/app/screens/settings/diagnostics-screen.tsx` with `formatTimestampLocale` from `@diffgazer/core/format`
- [ ] T011 [P] [US1] Replace local `formatTimestamp` in `apps/web/src/features/settings/components/diagnostics/page.tsx` with `formatTimestampLocale` from `@diffgazer/core/format`
- [ ] T012 [P] [US1] Replace local `SEVERITY_LABELS` definition in `apps/web/src/components/ui/severity/severity-breakdown.tsx` with import from `@diffgazer/schemas/ui`
- [ ] T013 [P] [US1] Adopt `matchQueryState` in `apps/cli/src/app/screens/settings/storage-screen.tsx` — replace manual `if (isLoading)` / `if (error)` with `matchQueryState(settingsQuery, { loading, error, success })`
- [ ] T014 [P] [US1] Adopt `matchQueryState` in `apps/web/src/features/settings/components/storage/page.tsx` — replace manual loading/error ternary with `matchQueryState`
- [ ] T015 [P] [US1] Adopt `matchQueryState` in `apps/cli/src/app/screens/settings/analysis-screen.tsx` — replace manual `ViewState` pattern with `matchQueryState`
- [ ] T016 [P] [US1] Adopt `matchQueryState` in `apps/web/src/features/settings/components/analysis/page.tsx` — replace manual `ViewState` pattern with `matchQueryState`
- [ ] T017 [P] [US1] Adopt `matchQueryState` in `apps/cli/src/app/screens/settings/agent-execution-screen.tsx` — replace manual `if (isLoading)` with `matchQueryState`
- [ ] T018 [P] [US1] Adopt `matchQueryState` in `apps/web/src/features/settings/components/agent-execution/page.tsx` — replace manual loading ternary with `matchQueryState`
- [ ] T019 [P] [US1] Adopt `matchQueryState` in `apps/cli/src/app/screens/settings/providers-screen.tsx` — replace manual `if (isLoading)` / `if (error)` with `matchQueryState`
- [ ] T020 [P] [US1] Adopt `matchQueryState` in `apps/web/src/features/providers/components/page.tsx` — replace manual `if (isLoading)` early return with `matchQueryState`
- [ ] T021 [P] [US1] Adopt `matchQueryState` in `apps/cli/src/app/screens/settings/hub-screen.tsx` — replace manual `if (isLoading)` with `matchQueryState`
- [ ] T022 [P] [US1] Adopt `matchQueryState` in `apps/web/src/features/settings/components/hub/page.tsx` — add loading guard using `matchQueryState` (currently has none)
- [ ] T023 [P] [US1] Adopt `matchQueryState` in `apps/cli/src/app/screens/settings/trust-permissions-screen.tsx` — replace manual `if (initLoading)` with `matchQueryState`
- [ ] T024 [P] [US1] Standardize CLI Spinner imports: replace direct `import Spinner from "ink-spinner"` with project `Spinner` component in `apps/cli/src/app/screens/settings/storage-screen.tsx`, `apps/cli/src/app/screens/settings/trust-permissions-screen.tsx`, `apps/cli/src/app/screens/settings/diagnostics-screen.tsx`, `apps/cli/src/features/home/components/trust-panel.tsx`, `apps/cli/src/features/review/components/progress-step.tsx`
- [ ] T025 [US1] Run `pnpm build` to verify all apps compile after matchQueryState adoption and format consolidation

**Checkpoint**: All data-driven screens use shared hooks, shared types, and standardized loading/error patterns. Zero duplicate data-fetching logic.

---

## Phase 4: User Story 3 — CLI Review Workflow Mirror (Priority: P1)

**Goal**: Decompose the monolithic CLI `useReviewLifecycle` hook (216 lines) into focused, maintainable hooks matching the web's 4-hook architecture.

**Independent Test**: Start a review from CLI, watch streaming progress, navigate issues in results view. Compare with web review flow — should have equivalent functionality.

### Implementation for User Story 3

- [ ] T026 [US3] Extract `useReviewStart` hook from `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` into `apps/cli/src/features/review/hooks/use-review-start.ts`. Move session detection, active session resumption, and stream start logic. The new hook should accept review mode and lenses, return `{ start, isStarting }`.
- [ ] T027 [US3] Extract `useReviewCompletion` hook from `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` into `apps/cli/src/features/review/hooks/use-review-completion.ts`. Move completion delay timer logic (COMPLETION_DELAY_MS = 2300), phase transition from streaming→summary→results. Return `{ phase, goToSummary, goToResults }`.
- [ ] T028 [US3] Inline `useReviewSettings` (3-line thin wrapper) from `apps/web/src/features/review/hooks/use-review-settings.ts` into its only consumer `apps/web/src/features/review/hooks/use-review-lifecycle.ts`. Delete the wrapper file. Update any imports.
- [ ] T029 [US3] Refactor `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` to compose the extracted hooks (`useReviewStart`, `useReviewCompletion`). The remaining lifecycle hook should be <100 lines, coordinating phase transitions only.
- [ ] T030 [US3] Run `pnpm dev:cli`, start a review, verify streaming→summary→results flow works identically to before decomposition

**Checkpoint**: CLI review lifecycle is decomposed into focused hooks. Review flow works end-to-end.

---

## Phase 5: User Story 4 — Terminal Responsiveness (Priority: P2)

**Goal**: Centralize responsive breakpoints and fix hardcoded terminal-width separators in CLI.

**Independent Test**: Resize terminal while CLI is running. Verify layouts adapt at 80 and 100 column breakpoints. Verify separators span full terminal width.

### Implementation for User Story 4

- [x] T031 [P] [US4] Add centralized breakpoint constants (`NARROW_THRESHOLD = 80`, `WIDE_THRESHOLD = 100`) and a `useResponsive()` hook returning `{ columns, rows, isNarrow, isWide }` to `apps/cli/src/hooks/use-terminal-dimensions.ts`
- [x] T032 [P] [US4] Fix hardcoded `"─".repeat(80)` separator in `apps/cli/src/components/layout/footer.tsx` — use terminal `columns` from `useTerminalDimensions()` or parent Box width
- [x] T033 [P] [US4] Fix hardcoded `"─".repeat(40)` separator in `apps/cli/src/components/ui/panel.tsx` `Panel.Footer` — use parent Box width or `100%` width
- [ ] T034 [US4] Replace ad-hoc `columns < 80` checks in `apps/cli/src/app/screens/history-screen.tsx`, `apps/cli/src/features/review/components/review-results-view.tsx`, `apps/cli/src/app/screens/settings/providers-screen.tsx` with `isNarrow` from `useResponsive()`
- [ ] T035 [US4] Replace ad-hoc `columns >= 100` check in `apps/cli/src/features/review/components/review-progress-view.tsx` with `isWide` from `useResponsive()`
- [ ] T036 [US4] Replace direct `useStdout()` usage in `apps/cli/src/components/layout/global-layout.tsx` and `apps/cli/src/components/ui/dialog.tsx` with `useTerminalDimensions()` for consistency

**Checkpoint**: All breakpoints centralized. Separators are responsive. No direct `useStdout` calls outside `useTerminalDimensions`.

---

## Phase 6: User Story 6 — Full Codebase Quality Audit (Priority: P2)

**Goal**: Resolve all remaining quality audit findings (SRP violations, YAGNI dead code, remaining thin wrappers). Zero tolerance for DRY/KISS/YAGNI/SRP violations.

**Independent Test**: Run `pnpm build && pnpm type-check`. Grep for eliminated patterns (no local Shortcut, no local formatTimestamp, no local SEVERITY_LABELS, no unused exports).

### SRP Decomposition

- [ ] T037 [P] [US6] Split `apps/web/src/features/review/hooks/use-review-results-keyboard.ts` (208 lines, 16 return values) into three focused hooks in the same directory: `use-issue-selection.ts` (issue index, navigation), `use-severity-filter.ts` (filter state, cycling), `use-tab-navigation.ts` (tab index, focus zones). Update `apps/web/src/features/review/components/review-results-view.tsx` to compose the three hooks.
- [ ] T038 [P] [US6] Update `apps/cli/src/app/screens/settings/diagnostics-screen.tsx` to use `useDiagnosticsData()` shared hook (from T007). Remove local status derivation logic (contextStatus, refreshing state, refresh handlers). Keep only CLI-specific rendering and keyboard handling.
- [ ] T039 [P] [US6] Update `apps/web/src/features/settings/components/diagnostics/page.tsx` to use `useDiagnosticsData()` shared hook (from T007). Remove local status derivation logic. Extract keyboard handling into `use-diagnostics-keyboard.ts`. Page component should only render.

### YAGNI Cleanup

- [x] T040 [P] [US6] Remove unused severity re-exports from `packages/core/src/severity.ts`: remove `SEVERITY_ICONS`, `SEVERITY_COLORS`, `HISTOGRAM_SEVERITIES` re-exports. Keep only exports that have consumers (`SEVERITY_ORDER`, `SEVERITY_LABELS`, `calculateSeverityCounts`, `severityRank`, `SeverityCounts`).
- [x] T041 [P] [US6] Unexport `FALLBACK_LENSES` from `packages/core/src/review/lenses.ts` — make it a module-internal constant (only consumed internally by `resolveDefaultLenses`)
- [x] T042 [P] [US6] Remove unused `TableColumn` type and `TableColumnSchema` from `packages/schemas/src/ui/ui.ts`. Verify zero imports exist.
- [x] T043 [P] [US6] Remove unused `FigletFont` type export from `packages/hooks/src/index.ts`. Remove unused `UseTimerOptions` and `UseTimerResult` type exports from `packages/hooks/src/index.ts`. Keep internal types, just remove barrel re-exports.
- [x] T044 [P] [US6] Remove `SHOW_HELP_IN_MAIN_MENU = false` flag from `apps/web/src/features/home/components/page.tsx`. Replace the conditional filter with the direct filtered `MENU_ITEMS` array (always exclude "help" from main menu).

### Final Build Verification

- [x] T045 [US6] Run `pnpm build && pnpm type-check` to verify all packages and apps compile with zero errors after all changes
- [x] T046 [US6] Run grep verification: `grep -r "interface Shortcut" apps/cli/` → 0 results; `grep -r "formatTimestamp" apps/` → only imports from `@diffgazer/core/format`; `grep -r "SEVERITY_LABELS" apps/web/` → only imports from `@diffgazer/schemas/ui`

**Checkpoint**: All 17 quality findings resolved. Zero DRY/KISS/YAGNI/SRP violations remain.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all user stories, smoke testing, documentation consistency

- [x] T047 [P] Run `pnpm dev:cli` — navigate all 14 screens, verify no regressions: home, review (start + results), history, help, onboarding, settings hub, theme, providers, storage, analysis, agent-execution, diagnostics, trust-permissions
- [x] T048 [P] Run `pnpm dev:web` — navigate all 14 routes, verify no regressions: same screen list as CLI plus root layout
- [x] T049 Verify US2 (Screen Parity): enumerate all 14 web routes and confirm each has a corresponding functional CLI screen
- [x] T050 Verify US5 (Onboarding): run CLI with no config, complete full onboarding flow (provider → API key → model → analysis → storage → execution), confirm it reaches home screen
- [x] T051 Update `packages/api/src/hooks/index.ts` barrel to include new `useDiagnosticsData` export. Verify all 23+ exports are present (22 original + new additions).
- [x] T052 Run quickstart.md verification: execute all commands in `specs/012-cli-ink-web-parity/quickstart.md` verification section

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories. T005 depends on T004.
- **US1 (Phase 3)**: Depends on Phase 2 (T006, T007, T004/T005 for shared types)
- **US3 (Phase 4)**: Depends on Phase 2 only (T028 is independent)
- **US4 (Phase 5)**: Independent of other stories — can start after Phase 2
- **US6 (Phase 6)**: T038/T039 depend on T007 (useDiagnosticsData). T037, T040-T044 are independent.
- **Polish (Phase 7)**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) for shared types/hooks. No dependencies on other stories.
- **US3 (P1)**: Independent of US1. Can start after Phase 2.
- **US4 (P2)**: Independent of US1/US3. Can start after Phase 2.
- **US6 (P2)**: T037 is independent. T038/T039 depend on T007 from Foundational. T040-T044 are fully independent.

### Within Each User Story

- Shared package changes (Foundational) before app-level changes
- matchQueryState adoption tasks (T009-T024) are all [P] — fully parallel
- SRP decomposition tasks are sequential within a hook (extract → refactor → verify)
- YAGNI cleanup tasks are all [P] — fully parallel (different files)

### Parallel Opportunities

**Maximum parallelism after Phase 2 completes:**

- All of Phase 3 (T009-T024) — 16 parallel tasks across different files
- All of Phase 4 (T026-T030) — sequential but independent of Phase 3
- All of Phase 5 (T031-T036) — independent of Phases 3-4
- T037, T040-T044 from Phase 6 — independent of all other streams

**Total parallelizable at peak**: ~25 tasks simultaneously (16 matchQueryState + 3 YAGNI + 3 responsive + 3 SRP)

---

## Parallel Example: Phase 3 (US1) + Phase 5 (US4) + Phase 6 (US6) Simultaneously

```bash
# After Phase 2 completes, launch these agent groups in parallel:

# Group A: matchQueryState adoption (12 agents, one per screen)
Agent: "Adopt matchQueryState in apps/cli/src/app/screens/settings/storage-screen.tsx"
Agent: "Adopt matchQueryState in apps/web/src/features/settings/components/storage/page.tsx"
Agent: "Adopt matchQueryState in apps/cli/src/app/screens/settings/analysis-screen.tsx"
Agent: "Adopt matchQueryState in apps/web/src/features/settings/components/analysis/page.tsx"
# ... (8 more screens)

# Group B: CLI responsive improvements (3 agents)
Agent: "Add breakpoint constants to apps/cli/src/hooks/use-terminal-dimensions.ts"
Agent: "Fix hardcoded separators in footer.tsx and panel.tsx"
Agent: "Replace ad-hoc breakpoint checks in 4 screen files"

# Group C: YAGNI cleanup (5 agents)
Agent: "Remove unused severity re-exports from packages/core/src/severity.ts"
Agent: "Unexport FALLBACK_LENSES from packages/core/src/review/lenses.ts"
Agent: "Remove TableColumn from packages/schemas/src/ui/ui.ts"
Agent: "Remove unused type exports from packages/hooks/src/index.ts"
Agent: "Remove SHOW_HELP_IN_MAIN_MENU from apps/web/src/features/home/components/page.tsx"

# Group D: SRP decomposition (3 agents)
Agent: "Split use-review-results-keyboard.ts into 3 focused hooks"
Agent: "Update CLI diagnostics to use useDiagnosticsData shared hook"
Agent: "Update web diagnostics to use useDiagnosticsData + extract keyboard hook"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (verify baseline)
2. Complete Phase 2: Foundational (shared types + hooks)
3. Complete Phase 3: US1 (matchQueryState + format consolidation)
4. **STOP and VALIDATE**: Build, type-check, smoke test both apps
5. All data fetching is now standardized — biggest value delivered

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add US1 (Phase 3) → Standardized data fetching (MVP!)
3. Add US3 (Phase 4) → Clean review lifecycle
4. Add US4 (Phase 5) → Responsive CLI
5. Add US6 (Phase 6) → Full quality audit resolved
6. Phase 7: Polish → Everything verified end-to-end

### Parallel Team Strategy

With multiple agents after Phase 2:
- **Stream A** (6 agents): US1 matchQueryState adoption — 12 screen files
- **Stream B** (2 agents): US3 review lifecycle decomposition — 4 hook files
- **Stream C** (3 agents): US4 responsive improvements — 6 CLI files
- **Stream D** (5 agents): US6 YAGNI + SRP cleanup — 10 files across packages + apps
- **Stream E** (2 agents): Verification — build checks + grep verification

Total: ~18 agents working in parallel after foundation is ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US2 (Screen Parity) and US5 (Onboarding) already verified as complete by research — smoke-tested in Phase 7
- All shared package changes (T004-T007) MUST complete before any app-level task
- matchQueryState adoption is the highest-volume parallel opportunity (12 independent screen files)
- Review lifecycle decomposition (T026-T029) is sequential — extract before refactor
- Commit after each phase or logical group
