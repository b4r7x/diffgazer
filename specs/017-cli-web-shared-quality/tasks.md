# Tasks: CLI-Web Shared Infrastructure Consolidation & Quality Audit

**Input**: Design documents from `/specs/017-cli-web-shared-quality/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted. Existing tests must pass after each phase.

**Organization**: Tasks grouped by user story (8 stories mapped to 8 work streams). All tasks are refactoring — no new features, no new dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Baseline verification before any changes

- [x] T001 Verify clean build: run `pnpm build` at workspace root and confirm success
- [x] T002 Run existing tests: `pnpm --filter @diffgazer/web test` and confirm all pass
- [x] T003 Snapshot current line counts for dead code targets (review-screen.tsx, toast.tsx, logo.tsx, format.ts)

---

## Phase 2: Foundational (Shared Package Changes)

**Purpose**: Add shared utilities to `@diffgazer/core` that US1 and US5 consumers will import. MUST complete before app-level changes.

- [x] T004 Add `getDateKey`, `getDateLabel`, `getTimestamp`, `formatDuration`, `formatTimestampOrNA` to `packages/core/src/format.ts`
- [x] T005 [P] Add `buildResponsiveResult(tier: BreakpointTier)` to `packages/core/src/layout/breakpoints.ts`
- [x] T006 [P] Move `getProviderStatus` and `getProviderDisplay` from `packages/core/src/format.ts` to `packages/core/src/providers/display-status.ts` and re-export
- [x] T007 [P] Remove `formatElapsed` from `packages/core/src/format.ts` (dead code, duplicates `formatTime("short")`)
- [x] T008 [P] Fix `DisplayStatus` type in `packages/core/src/providers/display-status.ts` to import from `@diffgazer/schemas/config` instead of redefining
- [x] T009 Build `@diffgazer/core`: run `pnpm --filter @diffgazer/core build` and confirm success

**Checkpoint**: Shared package ready — all new exports available for consumers

---

## Phase 3: User Story 1 — Eliminate Duplicated Utility Code (Priority: P1) MVP

**Goal**: Every duplicated pure utility function exists in exactly one shared location

**Independent Test**: Grep confirms zero local definitions of extracted functions in apps; both apps import from shared packages; `pnpm build` passes

### Implementation for User Story 1

- [x] T010 [P] [US1] Update `apps/web/src/features/history/utils.tsx`: remove `getDateKey`, `getDateLabel`, `getTimestamp`, `formatDuration`; import from `@diffgazer/core/format`
- [x] T011 [P] [US1] Update `apps/cli/src/app/screens/history-screen.tsx`: remove inline `getDateKey`, `getDateLabel`, `getTimestamp`, `formatDuration`; import from `@diffgazer/core/format`
- [x] T012 [P] [US1] Update `apps/cli/src/app/screens/settings/diagnostics-screen.tsx`: remove `formatTimestampOrNA`; import from `@diffgazer/core/format`
- [x] T013 [P] [US1] Update `apps/web/src/features/settings/components/diagnostics/page.tsx`: remove `formatTimestampOrNA`; import from `@diffgazer/core/format`
- [x] T014 [P] [US1] Update `apps/cli/src/hooks/use-terminal-dimensions.ts`: use `buildResponsiveResult` from `@diffgazer/core`
- [x] T015 [P] [US1] Update `apps/web/src/hooks/use-viewport-breakpoint.ts`: use `buildResponsiveResult` from `@diffgazer/core`
- [x] T016 [P] [US1] Update `packages/api/src/hooks/use-review-stream.ts`: import `ReviewEvent` type from `@diffgazer/core/review` instead of redefining locally
- [x] T017 [US1] Create `apps/cli/src/theme/severity.ts` with shared `getSeverityColor(severity, tokens)` function
- [x] T018 [P] [US1] Update `apps/cli/src/features/review/components/severity-bar.tsx`: remove local `severityColor`; import from `../../theme/severity.ts`
- [x] T019 [P] [US1] Update `apps/cli/src/features/review/components/severity-filter-group.tsx`: remove local `severityColor`; import from `../../theme/severity.ts`
- [x] T020 [P] [US1] Update `apps/cli/src/features/history/components/history-insights-pane.tsx`: remove local `severityColor`; import from `../../theme/severity.ts`
- [x] T021 [US1] Build and verify: `pnpm build` passes, grep confirms zero local duplicates

**Checkpoint**: All utility duplication eliminated. Both apps import from single shared sources.

---

## Phase 4: User Story 2 — Remove Dead Code and Unused Exports (Priority: P1)

**Goal**: Remove all confirmed dead code (~150+ lines)

**Independent Test**: Grep confirms zero import sites for deleted exports; `pnpm build` passes; no test regressions

### Implementation for User Story 2

- [x] T022 [P] [US2] Delete `apps/cli/src/components/ui/toast.tsx` and remove `<Toaster />` mount from `apps/cli/src/app/index.tsx`
- [x] T023 [P] [US2] Delete `apps/cli/src/components/ui/logo.tsx`
- [x] T024 [P] [US2] Remove dead `no-changes` phase from `apps/cli/src/app/screens/review-screen.tsx`: delete `SHOW_NO_CHANGES` action type, reducer case, phase branch, `NoChangesInline` component, and `NO_CHANGES_MESSAGES` constant (~50 lines)
- [x] T025 [P] [US2] Remove `orientation` prop from `apps/cli/src/components/ui/scroll-area.tsx` interface and destructuring
- [x] T026 [P] [US2] Remove `focused` prop from `apps/cli/src/components/ui/navigation-list.tsx` interface and destructuring
- [x] T027 [P] [US2] Replace `InfoField` with `KeyValue` in `apps/cli/src/features/home/components/context-sidebar.tsx`, then delete `apps/cli/src/features/home/components/info-field.tsx`
- [x] T028 [P] [US2] Remove `formatElapsed` export from `packages/core/src/format.ts` (already done in T007 if completed; verify)
- [x] T029 [P] [US2] Remove 4 unused subpath exports (`./review`, `./config`, `./git`, `./shutdown`) from `packages/api/package.json`
- [x] T030 [P] [US2] Remove `DEFAULT_TTL` from `apps/web/src/config/constants.ts`
- [x] T031 [P] [US2] Remove `setPreview` no-op from `apps/web/src/app/providers/theme-provider.tsx` and remove from `ThemeContextValue` interface in `apps/web/src/types/theme.ts`
- [x] T032 [P] [US2] Remove `useFooter()` combined hook from `apps/web/src/components/layout/footer/footer-context.tsx` and its re-exports from `footer/index.ts` and `layout/index.ts`
- [x] T033 [P] [US2] Delete empty barrel `apps/web/src/features/settings/index.ts`
- [x] T034 [US2] Build and verify: `pnpm build` passes, `pnpm --filter @diffgazer/web test` passes

**Checkpoint**: All dead code removed. Codebase is cleaner with no functional changes.

---

## Phase 5: User Story 3 — Fix Settings Keyboard Boilerplate (Priority: P2)

**Goal**: All 5 pages with duplicated button-zone keyboard logic use the shared `useFooterNavigation` hook

**Independent Test**: Existing keyboard tests pass; settings pages respond to arrow/enter/space keys identically

### Implementation for User Story 3

- [x] T035 [US3] Enhance `apps/web/src/hooks/use-footer-navigation.ts`: add `allowInInput?: boolean` option, add `wrap?: boolean` option (default false), reset `focusedIndex` to 0 in `exitFooter()`
- [x] T036 [P] [US3] Refactor `apps/web/src/features/settings/components/storage/page.tsx`: replace ~15 lines keyboard boilerplate with `useFooterNavigation`
- [x] T037 [P] [US3] Refactor `apps/web/src/features/settings/components/agent-execution/page.tsx`: replace ~15 lines keyboard boilerplate with `useFooterNavigation`
- [x] T038 [P] [US3] Refactor `apps/web/src/features/settings/components/theme/page.tsx`: replace ~15 lines keyboard boilerplate with `useFooterNavigation`
- [x] T039 [P] [US3] Refactor `apps/web/src/features/settings/components/analysis/page.tsx`: replace ~15 lines keyboard boilerplate with `useFooterNavigation` (note: pass `viewState === "success"` as `enabled`)
- [x] T040 [US3] Refactor `apps/web/src/features/onboarding/components/onboarding-wizard.tsx`: replace ~19 lines keyboard boilerplate with `useFooterNavigation` using `allowInInput: true` and dynamic `buttonCount`
- [x] T041 [US3] Run existing tests: `pnpm --filter @diffgazer/web test` to verify keyboard behavior unchanged

**Checkpoint**: Zero duplicated keyboard registration blocks in settings pages.

---

## Phase 6: User Story 4 — Fix Context Provider Memoization (Priority: P2)

**Goal**: All context providers produce stable value references when inputs have not changed

**Independent Test**: Provider tests pass; no re-render regressions in either app

### Implementation for User Story 4

- [x] T042 [P] [US4] Add `useMemo`/`useCallback` to `apps/web/src/app/providers/config-provider.tsx`: memoize `dataValue` and `actionsValue`, wrap action functions in `useCallback`
- [x] T043 [P] [US4] Add `useMemo`/`useCallback` to `apps/web/src/app/providers/theme-provider.tsx`: memoize context value, wrap `setTheme` in `useCallback`
- [x] T044 [P] [US4] Add `useCallback`/`useMemo` to `apps/cli/src/app/navigation-context.tsx`: wrap `navigate`/`goBack` in `useCallback`, memoize context value
- [x] T045 [P] [US4] Add `useMemo`/`useCallback` to `apps/cli/src/theme/theme-context.tsx`: memoize context value, wrap `setTheme` in `useCallback`
- [x] T046 [P] [US4] Add `useMemo` to `apps/cli/src/app/providers/footer-provider.tsx`: memoize context value
- [x] T047 [US4] Run tests: `pnpm --filter @diffgazer/web test` to verify config-provider and theme-provider tests pass

**Checkpoint**: All providers produce stable references. ConfigProvider split-context pattern is now effective.

---

## Phase 7: User Story 5 — Consolidate Extractable Hooks (Priority: P2)

**Goal**: Shared derivation logic extracted; onboarding validation deduplicated

**Independent Test**: Both apps build and existing tests pass; responsive hooks return identical shapes

### Implementation for User Story 5

- [x] T048 [P] [US5] Extract shared `canProceed(step, data)` function from `apps/web/src/features/onboarding/hooks/use-onboarding.ts` to `apps/web/src/features/onboarding/types.ts`
- [x] T049 [US5] Update `apps/web/src/features/onboarding/components/onboarding-wizard.tsx`: import shared `canProceed` instead of local `canProceedForStep`
- [x] T050 [P] [US5] Remove manual `useMemo` wrapper from `apps/web/src/hooks/use-openrouter-models.ts` (React Compiler convention)
- [x] T051 [US5] Build and verify: `pnpm build` passes

**Checkpoint**: Hook consolidation complete. No duplicated derivation logic.

---

## Phase 8: User Story 6 — Improve Loading/Error State Patterns (Priority: P3)

**Goal**: Platform-specific loading/error presets reduce boilerplate; duplicate loading components consolidated

**Independent Test**: Preset functions produce correct JSX; consolidated loading component renders identically

### Implementation for User Story 6

- [x] T052 [P] [US6] Create `apps/cli/src/lib/query-presets.tsx` with `cliLoading(label)` and `cliError()` preset factories
- [x] T053 [P] [US6] Create `apps/web/src/lib/query-presets.tsx` with `webLoading(label)` and `webError()` preset factories
- [x] T054 [US6] Export `ReviewLoadingMessage` from `apps/web/src/features/review/components/review-container.tsx`; remove duplicate `LoadingReviewState` from `apps/web/src/features/review/components/page.tsx` and import shared component
- [x] T055 [US6] Build and verify: `pnpm build` passes

**Checkpoint**: Loading state presets available. Duplicate loading component eliminated.

---

## Phase 9: User Story 7 — Fix Misplaced Code and Thin Wrappers (Priority: P3)

**Goal**: All code in correct packages; thin re-export passthroughs eliminated; `@diffgazer/hooks` package removed

**Independent Test**: All import paths updated; `pnpm build` passes; grep confirms no imports from deleted paths

### Implementation for User Story 7

- [x] T056 [US7] Move `getProviderStatus` and `getProviderDisplay` from `packages/core/src/format.ts` to `packages/core/src/providers/display-status.ts` (already done in T006 if completed; verify consumers updated)
- [x] T057 [P] [US7] Update all consumers of `getProviderStatus`/`getProviderDisplay` to import from `@diffgazer/core/providers` instead of `@diffgazer/core/format`
- [x] T058 [US7] Remove `packages/core/src/severity.ts` passthrough; update `apps/server` consumers to import from `@diffgazer/schemas/ui` directly; remove `./severity` export from `packages/core/package.json`
- [x] T059 [P] [US7] Delete `apps/web/src/features/providers/types/index.ts`; update 3 consumers to import `DisplayStatus` and `ProviderWithStatus` from `@diffgazer/schemas/config`
- [x] T060 [US7] Move `PROVIDER_CAPABILITIES` and `OPENROUTER_PROVIDER_ID` from `apps/web/src/config/constants.ts` to `packages/schemas/src/config/providers.ts`; update web imports
- [x] T061 [US7] Move `getFigletText` from `packages/hooks/src/get-figlet.ts` to `packages/core/src/` (new file); update CLI and web ASCII logo imports
- [x] T062 [US7] Move `useTimer` from `packages/hooks/src/use-timer.ts` to `apps/web/src/hooks/use-timer.ts`; update web `timer.tsx` import
- [x] T063 [US7] Delete `packages/hooks/` package; remove from `pnpm-workspace.yaml` and any `package.json` references
- [x] T064 [US7] Build and verify: `pnpm build` passes; `pnpm install` succeeds after workspace change

**Checkpoint**: All code in correct locations. `@diffgazer/hooks` package eliminated. Zero thin re-exports.

---

## Phase 10: User Story 8 — Fix Responsiveness Edge Cases (Priority: P3)

**Goal**: CLI components adapt to container width; no hardcoded overflow at extreme terminal sizes

**Independent Test**: CLI renders correctly at 40, 60, 80, 120, 200 columns with no visual overflow

### Implementation for User Story 8

- [x] T065 [P] [US8] Fix `apps/cli/src/components/ui/input.tsx`: cap `widthBySize` values at `Math.min(size, columns - padding)` using `useTerminalDimensions`
- [x] T066 [P] [US8] Fix `apps/cli/src/components/ui/panel.tsx`: use Ink `width="100%"` for footer line instead of `"─".repeat(columns)`
- [x] T067 [P] [US8] Fix `apps/cli/src/components/ui/section-header.tsx`: use Ink `width="100%"` for border instead of `"─".repeat(columns)`
- [x] T068 [US8] Fix `apps/cli/src/features/review/components/issue-preview-item.tsx`: make `MAX_PATH_LENGTH` dynamic based on available width
- [x] T069 [US8] Manual verification: run CLI at 40, 80, 120, 200 columns and visually confirm no overflow

**Checkpoint**: All responsiveness edge cases fixed.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all changes

- [x] T070 Full workspace build: `pnpm build` at workspace root
- [x] T071 Full test suite: `pnpm --filter @diffgazer/web test`
- [x] T072 Type check: `pnpm type-check` at workspace root
- [x] T073 Grep verification: confirm zero imports from deleted files/exports (toast, logo, InfoField, formatElapsed, severity passthrough, @diffgazer/hooks, unused API subpaths)
- [x] T074 Run quickstart.md verification checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — adds shared exports needed by US1, US5, US7
- **US1 (Phase 3)**: Depends on Phase 2 — consumes new shared exports
- **US2 (Phase 4)**: Independent of other user stories — can run parallel with US1
- **US3 (Phase 5)**: Independent — modifies only web settings pages
- **US4 (Phase 6)**: Independent — modifies only provider files
- **US5 (Phase 7)**: Depends on Phase 2 (for `buildResponsiveResult`) — can run parallel with US1-US4
- **US6 (Phase 8)**: Soft dependency on US2 (duplicate loading component removal) — can start after T054's target files are clean
- **US7 (Phase 9)**: Depends on Phase 2 (for moved functions) — can run parallel with US1-US6
- **US8 (Phase 10)**: Independent — modifies only CLI UI components
- **Polish (Phase 11)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2). No dependency on other stories.
- **US2 (P1)**: No dependencies on other stories. Can start immediately after Phase 1.
- **US3 (P2)**: No dependencies on other stories. Can start after Phase 1.
- **US4 (P2)**: No dependencies on other stories. Can start after Phase 1.
- **US5 (P2)**: Depends on Phase 2 for `buildResponsiveResult`. No other story deps.
- **US6 (P3)**: Soft dependency on US2 (shared loading component). Can overlap.
- **US7 (P3)**: Depends on Phase 2 for function relocations. No other story deps.
- **US8 (P3)**: No dependencies. Can start after Phase 1.

### Parallel Opportunities

**Maximum parallelism** (after Phase 2 completes):
- Agent A: US1 (T010-T021) — shared utility consumers
- Agent B: US2 (T022-T034) — dead code removal
- Agent C: US3 (T035-T041) — keyboard consolidation
- Agent D: US4 (T042-T047) — provider memoization
- Agent E: US5 (T048-T051) — hook consolidation
- Agent F: US7 (T056-T064) — misplaced code
- Agent G: US8 (T065-T069) — responsiveness

**Within each story**, all tasks marked [P] can run in parallel.

---

## Parallel Example: User Story 2 (Dead Code Removal)

```bash
# All these tasks modify different files — launch in parallel:
Task T022: "Delete toast.tsx + remove Toaster mount from app/index.tsx"
Task T023: "Delete logo.tsx"
Task T024: "Remove dead no-changes phase from review-screen.tsx"
Task T025: "Remove orientation prop from scroll-area.tsx"
Task T026: "Remove focused prop from navigation-list.tsx"
Task T027: "Replace InfoField with KeyValue in context-sidebar.tsx; delete info-field.tsx"
Task T029: "Remove 4 unused subpath exports from packages/api/package.json"
Task T030: "Remove DEFAULT_TTL from web config/constants.ts"
Task T031: "Remove setPreview from theme-provider.tsx and types/theme.ts"
Task T032: "Remove useFooter combined hook from footer-context.tsx and re-exports"
Task T033: "Delete empty features/settings/index.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup (verify baseline)
2. Complete Phase 2: Foundational (add shared exports)
3. Complete Phase 3: US1 — eliminate utility duplication
4. Complete Phase 4: US2 — remove dead code
5. **STOP and VALIDATE**: `pnpm build` + `pnpm --filter @diffgazer/web test`
6. This alone delivers the highest-impact improvements

### Incremental Delivery

1. Setup + Foundational → shared exports ready
2. US1 + US2 → highest impact: duplication + dead code (MVP)
3. US3 + US4 → medium impact: keyboard boilerplate + memoization
4. US5 + US6 + US7 → lower impact: hook consolidation + presets + code placement
5. US8 → edge cases: responsiveness fixes
6. Polish → final verification

### Parallel Agent Strategy

With 7 agents available after Phase 2:
1. All agents complete Phase 1 + Phase 2 sequentially
2. Then fan out: each agent takes one user story (US1-US5, US7, US8)
3. US6 starts when US2 completes
4. All converge for Phase 11 (Polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- No new dependencies introduced — pure refactoring
- Commit after each phase for safe rollback points
- Stop at any checkpoint to validate independently
