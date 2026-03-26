# Tasks: CLI Ink Web Parity & Cross-Workspace Quality

**Input**: Design documents from `/specs/016-cli-ink-web-parity/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization needed — existing monorepo. This phase is empty.

**Checkpoint**: Ready to begin user story implementation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational blocking tasks — all user stories build on existing infrastructure.

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 - Terminal Resize Responsiveness (Priority: P1) MVP

**Goal**: Fix the resize bug so all CLI views dynamically re-render when the terminal is resized.

**Independent Test**: Run `pnpm dev:cli`, resize terminal window on any screen — layout must reflow within one frame. Breakpoint-dependent layouts (narrow/medium/wide) must switch correctly.

### Implementation for User Story 1

- [x] T001 [US1] Fix `useTerminalDimensions` to use `useState` + `stdout.on('resize')` in `apps/cli/src/hooks/use-terminal-dimensions.ts` — add `useState<TerminalDimensions>` initialized from stdout, add `useEffect` subscribing to stdout `resize` event with cleanup. `useResponsive()` derives from this so it auto-fixes too.
- [x] T002 [US1] Add "terminal too small" guard in `apps/cli/src/components/layout/global-layout.tsx` — when columns < 40, render centered "Terminal too small" message instead of children.

**Checkpoint**: Terminal resize works on all screens. Breakpoint-dependent layouts update immediately. MVP complete.

---

## Phase 4: User Story 2 - Centered & Full-Width Layouts (Priority: P2)

**Goal**: Add horizontal centering to menu/settings screens with max-width constraints matching web visual proportions. Full-width data-dense screens (review results, progress, history, providers) remain unchanged.

**Independent Test**: Launch CLI at 80/120/160 column widths. Compare each centered screen against the web equivalent. Menus should be centered, not pinned left.

**Dependencies**: Depends on US1 (reactive dimensions needed for `useResponsive()` and `columns` in `Math.min(columns, MAX_WIDTH)`)

### Implementation for User Story 2

- [x] T003 [P] [US2] Center home screen layout in `apps/cli/src/app/screens/home-screen.tsx` — wrap content in `<Box justifyContent="center" alignItems="center" flexGrow={1}>` with inner `<Box width={Math.min(columns, 90)}>`, replace hardcoded `width={30}` sidebar with proportional width
- [x] T004 [P] [US2] Center settings hub in `apps/cli/src/app/screens/settings/hub-screen.tsx` — wrap Panel in centering Box with max-width 70
- [x] T005 [P] [US2] Center analysis settings in `apps/cli/src/app/screens/settings/analysis-screen.tsx` — wrap content in centering Box with max-width 60
- [x] T006 [P] [US2] Center agent-execution settings in `apps/cli/src/app/screens/settings/agent-execution-screen.tsx` — wrap content in centering Box with max-width 60
- [x] T007 [P] [US2] Center diagnostics settings in `apps/cli/src/app/screens/settings/diagnostics-screen.tsx` — wrap content in centering Box with max-width 60
- [x] T008 [P] [US2] Center storage settings in `apps/cli/src/app/screens/settings/storage-screen.tsx` — wrap content in centering Box with max-width 60
- [x] T009 [P] [US2] Center theme settings in `apps/cli/src/app/screens/settings/theme-screen.tsx` — wrap content in centering Box with max-width 60
- [x] T010 [P] [US2] Center trust-permissions settings in `apps/cli/src/app/screens/settings/trust-permissions-screen.tsx` — wrap content in centering Box with max-width 60
- [x] T011 [P] [US2] Center help screen in `apps/cli/src/app/screens/help-screen.tsx` — wrap content in centering Box with max-width 80
- [x] T012 [P] [US2] Center onboarding wizard in `apps/cli/src/features/onboarding/components/onboarding-wizard.tsx` — wrap wizard content in centering Box with max-width 70
- [x] T013 [P] [US2] Center review summary in `apps/cli/src/features/review/components/review-summary-view.tsx` — wrap content in centering Box with max-width 80

**Checkpoint**: All menu/settings screens render centered with balanced whitespace. Full-width screens unchanged.

---

## Phase 5: User Story 3 - Shared Hooks Between Web & CLI (Priority: P3)

**Goal**: Consolidate duplicated hooks, pure functions, and types into shared packages. Eliminate all duplicated API/state logic between CLI and web.

**Independent Test**: After consolidation, `pnpm run type-check` passes. Both `pnpm dev:cli` and `pnpm dev:web` start successfully. All screens load data and mutations work.

**Dependencies**: Independent of US1/US2. Can run in parallel.

### Extract shared utilities (parallel — different packages, no conflicts)

- [x] T014 [P] [US3] Extract `buildLensOptions()` to `packages/schemas/src/events/lens-options.ts` — move the `Object.entries(LENS_TO_AGENT).map(...)` logic, export from package index
- [x] T015 [P] [US3] Extract `getDisplayStatusConfig()` to `packages/core/src/providers/display-status.ts` — unify `statusBadge`/`statusBadgeVariant`/`statusLabel`/`getStatusIndicator` into a single mapping, export from package
- [x] T016 [P] [US3] Extract `ProviderWithStatus`/`DisplayStatus` types to `packages/schemas/src/config/` — move from `apps/web/src/features/providers/types/index.ts`, update schema package exports
- [x] T017 [P] [US3] Extract `getBackTarget()` to `packages/core/src/navigation/back-target.ts` — unify from CLI `apps/cli/src/lib/back-navigation.ts` and web `apps/web/src/lib/back-navigation/back-navigation.ts`, export from package
- [x] T018 [P] [US3] Move `areShortcutsEqual()` to `packages/schemas/src/ui/shortcuts.ts` — extract from `apps/web/src/hooks/use-page-footer.ts`, export from schema package
- [x] T019 [P] [US3] Move `isOpenRouterCompatible`/`mapOpenRouterModels` to `packages/api/src/openrouter.ts` or `packages/core/src/` — extract from `apps/web/src/hooks/use-openrouter-models.ts`

### Update consumers to use shared utilities

- [x] T020 [P] [US3] Update `apps/cli/src/features/settings/components/analysis-selector.tsx` to import `buildLensOptions` from `@diffgazer/schemas/events`
- [x] T021 [P] [US3] Update `apps/web/src/features/settings/components/analysis/page.tsx` to import `buildLensOptions` from `@diffgazer/schemas/events`
- [x] T022 [P] [US3] Update `apps/web/src/features/onboarding/components/steps/analysis-step.tsx` to import `buildLensOptions` from `@diffgazer/schemas/events`
- [x] T023 [P] [US3] Update `apps/web/src/features/review/components/review-container.utils.ts` to import and use `getAgentDetail` from `@diffgazer/core/review` instead of local `getSubstepDetail`
- [x] T024 [P] [US3] Update `apps/cli/src/features/providers/components/provider-list.tsx` and `apps/cli/src/features/providers/components/provider-details.tsx` to use shared `getDisplayStatusConfig`
- [x] T025 [P] [US3] Update `apps/web/src/features/providers/components/provider-list.tsx` to use shared `getDisplayStatusConfig`
- [x] T026 [P] [US3] Update `apps/cli/src/lib/back-navigation.ts` to re-export from shared `getBackTarget` in `@diffgazer/core`
- [x] T027 [P] [US3] Update `apps/web/src/lib/back-navigation/back-navigation.ts` to import `getBackTarget` from `@diffgazer/core`
- [x] T028 [P] [US3] Update `apps/web/src/hooks/use-openrouter-models.ts` to import shared `isOpenRouterCompatible`/`mapOpenRouterModels`
- [x] T029 [P] [US3] Update `apps/web/src/hooks/use-page-footer.ts` to import `areShortcutsEqual` from `@diffgazer/schemas/ui`

### Extract shared review lifecycle hook

- [x] T030 [US3] Create `useReviewLifecycleBase` in `packages/api/src/hooks/use-review-lifecycle-base.ts` — extract common orchestration (stream wiring, config gating, noDiff/loading derivation, completion) from both apps' `use-review-lifecycle.ts`, following contract in `contracts/hook-sharing-contract.md`
- [x] T031 [US3] Simplify CLI `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` to use shared `useReviewLifecycleBase` — keep only CLI-specific phase state machine
- [x] T032 [US3] Simplify web `apps/web/src/features/review/hooks/use-review-lifecycle.ts` to use shared `useReviewLifecycleBase` — keep only URL sync and router navigation
- [x] T033 [US3] Update `packages/api/src/hooks/index.ts` with new exports (`useReviewLifecycleBase`, types)
- [x] T034 [US3] Build all packages and type-check: `pnpm --filter @diffgazer/api build && pnpm --filter @diffgazer/schemas build && pnpm --filter @diffgazer/core build && pnpm run type-check`

**Checkpoint**: Zero duplicated API/state logic between CLI and web. Both apps start. Type-check passes.

---

## Phase 6: User Story 4 - Cross-Workspace Code Quality Audit (Priority: P4)

**Goal**: Remove thin wrappers, dead code, redundant patterns, and anti-slop across the workspace.

**Independent Test**: `pnpm run type-check` passes. No unused exports. Both apps start.

**Dependencies**: Depends on US3 (shared locations must exist before removing duplicates that reference them)

### Implementation for User Story 4

- [x] T035 [US4] Remove CLI thin wrappers and inline in `apps/cli/src/features/onboarding/components/onboarding-wizard.tsx` — delete `apps/cli/src/features/onboarding/components/steps/storage-step.tsx`, `analysis-step.tsx`, `api-key-step.tsx` and replace imports with direct component usage (`StorageSelector`, `AnalysisSelector`, `ApiKeyMethodSelector`)
- [x] T036 [P] [US4] Delete dead `WizardLayout` component at `apps/web/src/components/shared/wizard-layout.tsx` and remove its export from `apps/web/src/components/shared/index.ts`
- [x] T037 [P] [US4] Remove re-export wrapper at `apps/web/src/features/providers/components/api-key-dialog/api-key-method-selector.tsx` — update consumers to import from `@/components/shared/api-key-method-selector` directly
- [x] T038 [P] [US4] Clean JSX section comments in `apps/web/src/features/providers/components/provider-details.tsx` — remove `{/* Header */}`, `{/* Content wrapper */}`, `{/* Close content wrapper */}` etc.
- [x] T039 [P] [US4] Clean JSX section comments in `apps/web/src/components/ui/card-layout.tsx` — remove `{/* Header */}`, `{/* Content */}`, `{/* Footer */}`
- [x] T040 [P] [US4] Clean JSX section comments in `apps/web/src/components/shared/trust-permissions-content.tsx` — remove `{/* Directory Header */}`, `{/* Capabilities */}`, `{/* Actions */}`
- [x] T041 [P] [US4] Remove redundant `PROVIDER_FILTER_VALUES` array in `apps/web/src/features/providers/constants.ts` — use `[...PROVIDER_FILTERS]` or the tuple directly at usage sites
- [x] T042 [US4] Type-check and verify after cleanup: `pnpm run type-check`

**Checkpoint**: No thin wrappers, dead code, or anti-slop patterns remain. Both apps work.

---

## Phase 7: User Story 5 - Complete View Parity Verification (Priority: P5)

**Goal**: Fix the 3 identified functional parity gaps between CLI and web.

**Independent Test**: Walk through every web route and CLI screen side-by-side. Same information, same navigation paths.

**Dependencies**: Independent of US1/US2 for implementation tasks. Verification depends on all stories.

### Implementation for User Story 5

- [x] T043 [P] [US5] Implement help page content in `apps/web/src/app/routes/help.tsx` — port keyboard shortcuts reference from CLI's `apps/cli/src/app/screens/help-screen.tsx` (10 shortcut entries + About section), adapt for web layout
- [x] T044 [P] [US5] Align onboarding step order in `apps/cli/src/features/onboarding/components/onboarding-wizard.tsx` — reorder steps to match web: storage → provider → api-key → model → analysis → execution (currently CLI starts with provider)
- [x] T045 [US5] Align trust `runCommands` toggle behavior — either expose toggle in `apps/web/src/components/shared/trust-permissions-content.tsx` or hide in CLI's `apps/cli/src/features/settings/components/trust-permissions-content.tsx` to match
- [x] T046 [US5] Walk through all 13 screens in both apps and verify data + navigation parity — document any remaining gaps

**Checkpoint**: All functional parity gaps resolved. Every web route has a CLI equivalent with matching data.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all user stories

- [ ] T047 MANUAL: Run CLI at 40/80/120/160/200 column widths and verify all screens render correctly
- [ ] T048 MANUAL: Resize terminal rapidly during review stream — verify no state loss or layout breakage
- [ ] T049 MANUAL: Resize terminal while overlay is open (model select, API key input) — verify reflow
- [x] T050 Final type-check and build: `pnpm run type-check && pnpm build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Empty — no work needed
- **Foundational (Phase 2)**: Empty — no work needed
- **US1 (Phase 3)**: No dependencies — start immediately. **BLOCKS US2.**
- **US2 (Phase 4)**: Depends on US1 completion (needs reactive dimensions)
- **US3 (Phase 5)**: **Independent of US1/US2** — can start in parallel
- **US4 (Phase 6)**: Depends on US3 completion (shared locations must exist)
- **US5 (Phase 7)**: Implementation tasks independent; verification depends on all
- **Polish (Phase 8)**: Depends on all user stories being complete

### Parallel Execution Strategy

```
Time →

Stream A: US1 (T001-T002) → US2 (T003-T013) → US4 (T035-T042) → Polish
                                                  ↑
Stream B: US3 (T014-T034) ───────────────────────┘

Stream C: US5 (T043-T045) → T046 (after all complete)
```

**Maximum parallelism**:
- **Agents 1-2**: US1 tasks (sequential, same file area)
- **Agents 3-8**: US3 extract tasks (T014-T019, all different packages, fully parallel)
- **Agent 9**: US5 T043 (web help page, independent file)
- **Agent 10**: US5 T044 (CLI onboarding order, independent file)
- After US3 extracts complete: **Agents 3-8+** can handle US3 consumer updates (T020-T029, all [P], different files)
- After US1 complete: **Agents 1+** can start US2 tasks (T003-T013, all [P], different files)

### Within Each User Story

- US1: T001 before T002 (T002 depends on reactive dimensions from T001)
- US2: All tasks [P] (different screen files)
- US3: Extract tasks [P] → Consumer updates [P] → Lifecycle extraction (sequential T030-T034)
- US4: T035 sequential (touches onboarding-wizard), rest [P]
- US5: T043-T044 [P], T045 sequential, T046 last

---

## Parallel Example: User Story 3

```bash
# Wave 1 — Extract shared utilities (all parallel, different packages):
Agent 1: "Extract buildLensOptions to packages/schemas/src/events/lens-options.ts"
Agent 2: "Extract getDisplayStatusConfig to packages/core/src/providers/display-status.ts"
Agent 3: "Extract ProviderWithStatus types to packages/schemas/src/config/"
Agent 4: "Extract getBackTarget to packages/core/src/navigation/back-target.ts"
Agent 5: "Move areShortcutsEqual to packages/schemas/src/ui/shortcuts.ts"
Agent 6: "Move isOpenRouterCompatible/mapOpenRouterModels to shared location"

# Wave 2 — Update consumers (all parallel, different app files):
Agent 1: "Update CLI analysis-selector to use shared buildLensOptions"
Agent 2: "Update web analysis/page to use shared buildLensOptions"
Agent 3: "Update web onboarding analysis-step to use shared buildLensOptions"
Agent 4: "Update web review-container.utils to use shared getAgentDetail"
Agent 5: "Update CLI provider components to use shared display status"
Agent 6: "Update web provider-list to use shared display status"
Agent 7: "Update CLI back-navigation to use shared getBackTarget"
Agent 8: "Update web back-navigation to use shared getBackTarget"
Agent 9: "Update web use-openrouter-models to use shared functions"
Agent 10: "Update web use-page-footer to use shared areShortcutsEqual"

# Wave 3 — Lifecycle hook (sequential):
Agent 1: "Create useReviewLifecycleBase in packages/api/src/hooks/"
Then: "Simplify CLI use-review-lifecycle.ts"
Then: "Simplify web use-review-lifecycle.ts"
Then: "Update index.ts exports and type-check"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001-T002 (Phase 3: Terminal Resize)
2. **STOP and VALIDATE**: Resize terminal on every screen — immediate reflow
3. This alone fixes the #1 reported bug

### Incremental Delivery

1. US1 → Terminal resize works (MVP)
2. US2 → Menus/settings centered (visual parity)
3. US3 → Hooks consolidated (maintainability)
4. US4 → Quality cleanup (code health)
5. US5 → Parity gaps fixed (completeness)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy (up to 20 agents)

1. **Wave 1** (agents 1-10):
   - Agents 1-2: US1 (T001-T002, sequential)
   - Agents 3-8: US3 extract tasks (T014-T019, parallel)
   - Agent 9: US5 T043 (web help page)
   - Agent 10: US5 T044 (onboarding order)

2. **Wave 2** (after US1 complete + US3 extracts complete):
   - Agents 1-11: US2 centering tasks (T003-T013, all parallel)
   - Agents 12-20: US3 consumer updates (T020-T029, all parallel)

3. **Wave 3** (after US3 consumers + US2 complete):
   - Agent 1: US3 lifecycle (T030-T034, sequential)
   - Agents 2-8: US4 cleanup (T035-T042, mostly parallel)
   - Agent 9: US5 T045 (trust alignment)

4. **Wave 4** (after all):
   - Agents 1-4: Polish (T047-T050)
   - Agent 5: US5 T046 (full parity verification)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 is the MVP — fixes the #1 reported bug (terminal resize)
- US3 is the largest story (21 tasks) but highly parallelizable (3 waves of parallel work)
- US2 is the most visual story — requires manual comparison with web app
- US4/US5 are cleanup/verification — lower risk, lower priority
- Commit after each logical group of tasks
- Stop at any checkpoint to validate story independently
