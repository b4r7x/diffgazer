# Tasks: Fix Keyscope + diff-ui Integration

**Input**: Design documents from `/specs/003-fix-keyscope-diffui-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/two-layer-keyboard.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Paths are relative to workspace root unless noted

---

## Phase 1: Setup (Diagnosis & Baseline)

**Purpose**: Confirm exact failures, establish baseline before making changes

- [X] T001 Run diffgazer web dev server and manually test keyboard navigation on all pages — document which components/pages are broken in `specs/003-fix-keyscope-diffui-integration/diagnosis.md`
- [X] T002 Run existing test suite to establish baseline: `pnpm --filter @diffgazer/web test` — record pass/fail counts
- [X] T003 Run type-check baseline: `pnpm --filter @diffgazer/web exec tsc --noEmit` — record any existing errors

---

## Phase 2: Foundational (diff-ui Controlled Mode Infrastructure)

**Purpose**: Fix core diff-ui controlled mode patterns that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Add `defaultPrevented` check to RadioGroup handleKeyDown in `diff-ui/registry/ui/radio/radio-group.tsx` — change `navKeyDown(e); onKeyDown?.(e)` to `onKeyDown?.(e); if (!e.defaultPrevented) navKeyDown(e)` (match Tabs pattern)
- [X] T005 [P] Add `useControllableState` wrapper for highlight in CheckboxGroup in `diff-ui/registry/ui/checkbox/checkbox-group.tsx` — currently passes external `highlighted` directly to useNavigation, should wrap like RadioGroup does
- [X] T006 [P] Add `defaultPrevented` check to CheckboxGroup handleKeyDown in `diff-ui/registry/ui/checkbox/checkbox-group.tsx` — same pattern as T004
- [X] T007 [P] Add `defaultPrevented` check to useListbox onKeyDown handler in `diff-ui/registry/hooks/use-listbox.ts` — affects Menu and NavigationList
- [X] T008 [P] Add `role="group"` to Accordion root container in `diff-ui/registry/ui/accordion/accordion-header.tsx` or root element — fix missing WAI-ARIA container role
- [X] T009 Verify ref forwarding works correctly for all interactive diff-ui components — check that `forwardRef` properly exposes the root container element for Menu, RadioGroup, CheckboxGroup, NavigationList, Tabs, Select in their respective `diff-ui/registry/ui/*/` files

**Checkpoint**: diff-ui components now properly support controlled mode with defaultPrevented, useControllableState, and correct ARIA roles

---

## Phase 3: User Story 1 — diff-ui Standalone a11y (Priority: P1) MVP

**Goal**: Every interactive diff-ui component is keyboard-operable without keyscope

**Independent Test**: Render each component in isolation (no KeyboardProvider). Navigate using Tab, Arrow keys, Enter, Space, Escape. All WAI-ARIA widget interactions work.

### Implementation for User Story 1

- [X] T010 [P] [US1] Verify Menu standalone keyboard nav works in `diff-ui/registry/ui/menu/menu.tsx` — test Arrow keys, Enter, Escape, typeahead without keyscope. Menu uses useListbox (custom), should work standalone.
- [X] T011 [P] [US1] Verify RadioGroup standalone keyboard nav works in `diff-ui/registry/ui/radio/radio-group.tsx` — test Arrow keys move and select, roving tabindex, without keyscope
- [X] T012 [P] [US1] Verify CheckboxGroup standalone keyboard nav works in `diff-ui/registry/ui/checkbox/checkbox-group.tsx` — test Arrow keys navigate, Space toggles, without keyscope (after T005/T006 fixes)
- [X] T013 [P] [US1] Verify Tabs standalone keyboard nav works in `diff-ui/registry/ui/tabs/tabs-list.tsx` — test Arrow keys switch tabs, auto/manual activation
- [X] T014 [P] [US1] Verify NavigationList standalone keyboard nav works in `diff-ui/registry/ui/navigation-list/navigation-list.tsx` — test Arrow keys, typeahead, Enter activation
- [X] T015 [P] [US1] Verify Dialog standalone a11y works in `diff-ui/registry/ui/dialog/dialog-content.tsx` — test focus trap (Tab cycling), Escape closes, initial focus placement
- [X] T016 [P] [US1] Verify Select standalone keyboard nav works in `diff-ui/registry/ui/select/select-content.tsx` — test Arrow keys, typeahead, aria-activedescendant
- [X] T017 [P] [US1] Verify Accordion standalone keyboard nav works in `diff-ui/registry/ui/accordion/accordion.tsx` — test Arrow keys between headers, Enter/Space toggle (after T008 fix)
- [X] T018 [US1] Fix any standalone a11y failures discovered in T010–T017 — apply component-specific fixes in `diff-ui/registry/ui/*/`

**Checkpoint**: All 8 interactive diff-ui components work with keyboard-only navigation in isolation

---

## Phase 4: User Story 2 — Keyscope Hooks Plug In Without Conflict (Priority: P1)

**Goal**: Remove redundant useNavigation instances in diffgazer, rely on diff-ui's internal keyboard nav, keep only keyscope page-level hooks

**Independent Test**: In diffgazer, navigate through home menu, settings hub, onboarding wizard using keyboard — no double-fire, no skipped items, correct highlighting

### Pattern A: Remove redundant useNavigation (12 files)

Replace `useNavigation` → direct state for highlight. diff-ui component handles keyboard internally. For each file: preserve all existing onSelect/onEnter/onCommit behavior by wiring through the diff-ui component's props (onSelect, onChange, onHighlightChange).

- [X] T019 [P] [US2] Remove redundant useNavigation from home page and wire Menu via props in `diffgazer/apps/web/src/features/home/components/page.tsx` — keep useScope, useKey; replace useNavigation with local state + Menu's onHighlightChange; preserve onEnter → Menu onSelect
- [X] T020 [P] [US2] Remove redundant useNavigation from settings hub in `diffgazer/apps/web/src/features/settings/components/hub/page.tsx` — keep useScope, useKey; wire Menu via highlighted/onHighlightChange props; preserve onEnter → Menu onSelect
- [X] T021 [P] [US2] Simplify theme-selector-content wiring in `diffgazer/apps/web/src/features/settings/components/theme-selector-content.tsx` — remove useNavigation, use RadioGroup's onHighlightChange
- [X] T022 [P] [US2] Simplify analysis-selector-content wiring in `diffgazer/apps/web/src/features/settings/components/analysis/analysis-selector-content.tsx` — remove useNavigation, use CheckboxGroup's onHighlightChange
- [X] T023 [P] [US2] Remove redundant useNavigation from provider-step in `diffgazer/apps/web/src/features/onboarding/components/steps/provider-step.tsx` — use RadioGroup's built-in nav + onHighlightChange; preserve onSelect → RadioGroup onChange, onEnter/onCommit → RadioGroup onEnter
- [X] T024 [P] [US2] Remove redundant useNavigation from analysis-step in `diffgazer/apps/web/src/features/onboarding/components/steps/analysis-step.tsx` — use CheckboxGroup's built-in nav
- [X] T025 [P] [US2] Remove redundant useNavigation from model-step (both lists) in `diffgazer/apps/web/src/features/onboarding/components/steps/model-step.tsx` — use RadioGroup's built-in nav
- [X] T026 [P] [US2] Remove redundant useNavigation from execution-step in `diffgazer/apps/web/src/features/onboarding/components/steps/execution-step.tsx` — use RadioGroup's built-in nav
- [X] T027 [P] [US2] Simplify trust-permissions-content wiring in `diffgazer/apps/web/src/components/shared/trust-permissions-content.tsx` — remove useNavigation, use CheckboxGroup's onHighlightChange
- [X] T028 [P] [US2] Simplify storage-selector-content wiring in `diffgazer/apps/web/src/components/shared/storage-selector-content.tsx` — remove useNavigation, use RadioGroup's onHighlightChange
- [X] T029 [P] [US2] Simplify issue-details-pane tabs wiring in `diffgazer/apps/web/src/features/review/components/issue-details-pane.tsx` — remove useNavigation for tab navigation, Tabs handles it internally
**Checkpoint**: All 11 Pattern A files simplified — no redundant useNavigation instances

---

## Phase 5: User Story 3 — Scoped Keyboard Isolation (Priority: P1)

**Goal**: useFocusZone and useScope work correctly across pages and dialogs with diff-ui components

**Independent Test**: Open dialogs, switch settings pages, navigate review results multi-pane — scopes isolate correctly, zone transitions work

### Audit onBoundaryReached bridge

- [X] T030 [US3] Audit diff-ui components for onBoundaryReached prop support — check if RadioGroup, CheckboxGroup, NavigationList in `diff-ui/registry/ui/*/` expose boundary callbacks. If missing, add `onBoundaryReached` prop that surfaces keyscope's `useNavigation` boundary event to the consumer. This is required for `useFocusZone` zone transitions (e.g., ArrowDown past last item → switch to next zone).

### Pattern C: Fix useFocusZone + diff-ui coordination (3 complex files + timeline-list)

- [X] T031 [US3] Refactor use-review-results-keyboard hook in `diffgazer/apps/web/src/features/review/hooks/use-review-results-keyboard.ts` — keep useFocusZone + useKey for zone transitions; remove useNavigation for list zone (NavigationList handles nav internally); bridge highlighted state via props + onHighlightChange callback; wire onBoundaryReached for zone transitions
- [X] T032 [US3] Refactor use-history-keyboard hook in `diffgazer/apps/web/src/features/history/hooks/use-history-keyboard.ts` — keep useFocusZone + useKey; simplify useNavigation usage; bridge highlighted via NavigationList props; wire onBoundaryReached
- [X] T032a [US3] Simplify history timeline-list wiring in `diffgazer/apps/web/src/features/history/components/timeline-list.tsx` — remove redundant useNavigation, use component's built-in nav; must coordinate with T032 (same focus zone context)
- [X] T033 [US3] Refactor use-providers-keyboard hook in `diffgazer/apps/web/src/features/providers/hooks/use-providers-keyboard.ts` — keep useFocusZone + useKey; simplify useNavigation for provider list; bridge highlighted via NavigationList props; wire onBoundaryReached

### Verify scope isolation

- [X] T034 [US3] Verify scope isolation on settings pages — navigate settings hub → sub-pages (theme, storage, analysis, etc.), confirm useScope correctly pushes/pops and only active scope's useKey handlers fire
- [X] T035 [US3] Verify dialog scope isolation — open API key dialog from providers page (`diffgazer/apps/web/src/features/providers/hooks/use-api-key-dialog-keyboard.ts`), confirm parent page hotkeys suppressed
- [X] T036 [US3] Verify model select dialog scope isolation — open model dialog (`diffgazer/apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts`), confirm parent hotkeys suppressed, dialog keyboard nav works

### Update page-level onBoundaryReached wiring

- [X] T037 [US3] Verify onBoundaryReached still works for focus zone transitions in history page (`diffgazer/apps/web/src/features/history/components/page.tsx`) — diff-ui component must surface boundary events for useFocusZone to consume
- [X] T038 [US3] Verify onBoundaryReached in provider page (`diffgazer/apps/web/src/features/providers/components/page.tsx`) — same boundary-to-zone bridge verification

**Checkpoint**: All multi-pane layouts (review, history, providers) work with correct zone transitions; all dialog scopes isolate correctly

---

## Phase 6: User Story 4 — Visual Focus Indicators (Priority: P2)

**Goal**: Focused items show visible highlights in all components, both themes

**Independent Test**: Navigate through all components — every focused item has visible indicator in dark and light themes

- [X] T039 [P] [US4] Verify selectableVariants highlight styling renders correctly in diffgazer context — check `diff-ui/registry/lib/selectable-variants.ts` CVA output (bg-secondary, font-bold, left accent bar) works with diffgazer's token overrides
- [X] T040 [P] [US4] Verify `[data-focused]` CSS rule in `diffgazer/apps/web/src/styles/index.css` aligns with diff-ui's highlight mechanism — ensure no conflict between diffgazer's ring style and diff-ui's selectableVariants
- [X] T041 [US4] Visual regression check across all pages in dark theme — navigate home, settings, onboarding, review, history, providers — confirm focus indicators visible
- [X] T042 [US4] Visual regression check across all pages in light theme — same verification in light mode

**Checkpoint**: 100% of keyboard-navigable items show visible focus indicators in both themes

---

## Phase 7: User Story 5 — Theme Token Overrides (Priority: P2)

**Goal**: diff-ui components render with diffgazer's GitHub Dark/Light palette

**Independent Test**: Inspect computed CSS values on rendered diff-ui components — confirm they match theme-overrides.css values

- [X] T043 [P] [US5] Verify CSS cascade order in `diffgazer/apps/web/src/styles/index.css` — confirm `diffui/theme.css` loads before `theme-overrides.css`
- [X] T044 [P] [US5] Verify primitive token overrides in `diffgazer/apps/web/src/styles/theme-overrides.css` — check `--tui-bg`, `--tui-fg`, `--tui-blue`, etc. override diff-ui defaults correctly
- [X] T045 [US5] Verify semantic token overrides — check `--primary`, `--accent`, `--ring`, `--muted-foreground` map to diffgazer's GitHub palette in both dark and light themes
- [X] T046 [US5] Spot-check Badge, Button, Panel, Callout components rendered in diffgazer — confirm colors match GitHub Dark palette, not diff-ui monochrome

**Checkpoint**: All diff-ui components render with diffgazer's GitHub palette

---

## Phase 8: User Story 6 — All Tests Pass (Priority: P2)

**Goal**: All existing and updated tests pass after integration fixes

**Independent Test**: `pnpm --filter @diffgazer/web test` — zero failures

- [X] T047 [US6] Update keyboard-navigation integration test in `diffgazer/apps/web/src/components/shared/keyboard-navigation.integration.test.tsx` — match new two-layer wiring pattern (components handle nav internally, tests verify controlled mode via highlighted/onHighlightChange)
- [X] T048 [US6] Run full test suite: `pnpm --filter @diffgazer/web test` — fix any test failures caused by wiring changes
- [X] T049 [US6] Run type-check: `pnpm --filter @diffgazer/web exec tsc --noEmit` — fix any type errors from removed useNavigation imports or changed props
- [X] T050 [US6] Verify review-results keyboard test in `diffgazer/apps/web/src/features/review/components/review-results-view.keyboard.test.tsx` — confirm it still passes after use-review-results-keyboard refactor
- [X] T051 [US6] Verify trust-permissions test in `diffgazer/apps/web/src/components/shared/trust-permissions-content.test.tsx` — confirm it passes after wiring simplification
- [X] T052 [US6] Verify settings page tests (theme, diagnostics) in `diffgazer/apps/web/src/features/settings/components/*/page.test.tsx` — confirm they pass after wiring changes

**Checkpoint**: All tests pass, type-check clean

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [X] T053 Remove any unused keyscope imports (useNavigation) from diffgazer files that no longer need them — grep for orphaned imports across `diffgazer/apps/web/src/`
- [X] T054 Verify diff-ui npm package build still works: `cd diff-ui && pnpm build` — confirm keyscope externalization correct after component changes
- [X] T055 End-to-end keyboard navigation walkthrough of entire diffgazer web app — navigate every page, every dialog, every interactive component using only keyboard
- [X] T056 Final test suite run: `pnpm --filter @diffgazer/web test && pnpm --filter @diffgazer/web exec tsc --noEmit` — confirm everything green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup/Diagnosis)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: No dependencies — can run parallel with Phase 1
- **Phase 3 (US1)**: Depends on Phase 2 completion (diff-ui controlled mode fixes)
- **Phase 4 (US2)**: Depends on Phase 2 completion; can run parallel with Phase 3
- **Phase 5 (US3)**: Depends on Phase 4 completion (wiring changes affect zone coordination)
- **Phase 6 (US4)**: Depends on Phase 3 + Phase 4 (visual indicators rely on working nav)
- **Phase 7 (US5)**: No dependencies on other stories — can run parallel with Phase 3+
- **Phase 8 (US6)**: Depends on all implementation phases (3, 4, 5)
- **Phase 9 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US1 (standalone a11y)**: Depends on Foundational only — can start after Phase 2
- **US2 (keyscope plug-in)**: Depends on Foundational only — can start after Phase 2, parallel with US1
- **US3 (scoped isolation)**: Depends on US2 (wiring changes must be done before zone refactoring). Includes timeline-list (moved from US2 due to focus zone coordination dependency)
- **US4 (visual focus)**: Depends on US1 + US2 (nav must work before verifying visual)
- **US5 (theme tokens)**: Independent — can run anytime after Phase 2
- **US6 (tests pass)**: Depends on US1 + US2 + US3

### Parallel Opportunities

**Phase 2 (Foundational)** — all marked [P] can run in parallel:
- T004 (RadioGroup), T005+T006 (CheckboxGroup), T007 (useListbox), T008 (Accordion)

**Phase 3 (US1)** — all T010–T017 verification tasks can run in parallel

**Phase 4 (US2)** — all T019–T030 Pattern A files can run in parallel (different files)

**Phase 7 (US5)** — T043 and T044 can run in parallel

---

## Parallel Example: Phase 4 (US2)

```
# Launch all Pattern A file simplifications in parallel:
T019: "Remove useNavigation from home/page.tsx"
T020: "Remove useNavigation from settings/hub/page.tsx"
T021: "Simplify theme-selector-content.tsx"
T022: "Simplify analysis-selector-content.tsx"
T023: "Remove useNavigation from provider-step.tsx"
T024: "Remove useNavigation from analysis-step.tsx"
T025: "Remove useNavigation from model-step.tsx"
T026: "Remove useNavigation from execution-step.tsx"
T027: "Simplify trust-permissions-content.tsx"
T028: "Simplify storage-selector-content.tsx"
T029: "Simplify issue-details-pane.tsx"
T030: "Simplify timeline-list.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Diagnosis (T001–T003)
2. Complete Phase 2: Foundational diff-ui fixes (T004–T009)
3. Complete Phase 3: US1 — verify standalone a11y (T010–T018)
4. Complete Phase 4: US2 — fix diffgazer wiring (T019–T030)
5. **STOP and VALIDATE**: Test keyboard nav manually across all pages
6. If working → proceed to US3, US4, US5, US6

### Incremental Delivery

1. Foundational → diff-ui components fixed for controlled mode
2. US1 → standalone a11y verified → diff-ui independently shippable
3. US2 → diffgazer wiring simplified → keyboard nav restored
4. US3 → scoped isolation verified → multi-pane layouts working
5. US4 + US5 → visual polish → consistent look
6. US6 → all tests green → ready to merge

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps task to spec user story for traceability
- diff-ui changes are in `/Users/voitz/Projects/diffgazer-workspace/diff-ui/`
- diffgazer changes are in `/Users/voitz/Projects/diffgazer-workspace/diffgazer/apps/web/src/`
- keyscope source must NOT be modified — it provides the hooks as-is
- Tabs component (`diff-ui/registry/ui/tabs/`) is the reference implementation for the correct pattern (defaultPrevented check)
- Commit after each phase or logical group of parallel tasks
