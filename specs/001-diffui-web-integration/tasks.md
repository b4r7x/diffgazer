# Tasks: Diff-UI Web Integration

**Input**: Design documents from `/specs/001-diffui-web-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-public-api.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Workspace Linking)

**Purpose**: Enable diff-ui as a consumable dependency via workspace linking (enables US1 and US2)

- [X] T001 Add `diffui: "workspace:*"` dependency to `packages/ui/package.json`
- [X] T002 Run `pnpm install` and verify `diffui` resolves from workspace
- [X] T003 Verify a test import `import { Button } from 'diffui/components/button'` compiles in `packages/ui/`

**Checkpoint**: Workspace linking works — diff-ui components are importable from @diffgazer/ui package

---

## Phase 2: User Story 1 - Replace Local UI Components with Diff-UI via Re-Export Facade (Priority: P1)

**Goal**: @diffgazer/ui becomes a thin re-export layer over diff-ui for all overlapping components. Zero consumer file changes.

**Independent Test**: Build the web app (`pnpm --dir apps/web build`), verify zero import errors. Open dev server and confirm UI renders identically.

### Direct Re-Exports (16 components — same API)

- [X] T005 [US1] Re-export Badge, BadgeProps, badgeVariants from `diffui/components/badge` in `packages/ui/src/index.ts`
- [X] T006 [US1] Re-export Input, InputProps from `diffui/components/input` and Textarea, TextareaProps from `diffui/components/textarea` in `packages/ui/src/index.ts`
- [X] T007 [US1] Re-export inputVariants from `diffui/lib/input-variants` in `packages/ui/src/index.ts`
- [X] T008 [US1] Re-export ScrollArea, ScrollAreaProps from `diffui/components/scroll-area` in `packages/ui/src/index.ts`
- [X] T010 [US1] Re-export SectionHeader, SectionHeaderProps from `diffui/components/section-header` in `packages/ui/src/index.ts`
- [X] T017 [US1] Re-export KeyValue, KeyValueProps, KeyValueItemProps, KeyValueVariant, KeyValueLayout from `diffui/components/key-value` in `packages/ui/src/index.ts`
- [X] T019 [US1] Build check: `pnpm --dir packages/ui build` and `pnpm --dir apps/web build` verify zero type errors

> **Note**: T004 (Button), T009 (BlockBar), T011 (EmptyState), T012 (Tabs), T013 (Menu), T014 (SearchInput), T015 (ToggleGroup), T016 (DiffView), T018 (HorizontalStepper) kept local — API/type differences prevent direct re-export (extra variants, generic type params, diffgazer-specific props like focusedValue/onActivate)

### Adapted Re-Exports (9 components — need thin wrappers)

> **Note**: Wrapper file creation (T020-T026, T028) can run in parallel since each targets a different file. The index.ts re-export updates (T029) must run sequentially after all wrappers are created.

> **Note**: T020-T029 deferred — components kept as local implementations. API differences are too extensive for thin adapters (diffgazer uses external keyboard nav via focusedValue/onActivate, context-based Toast, generic TabsProps<T>, extra Button variants, compound-vs-flat EmptyState/Callout). These components already work correctly with the CSS token override layer (Phase 3).

### Utility Deduplication

- [X] T030 [US1] Re-export `cn` from `diffui/lib/utils` in `packages/ui/src/index.ts` (local cn.ts kept for internal component imports)

**Checkpoint**: All overlapping components re-exported from diff-ui. Web app builds with zero errors. Consumer files unchanged.

---

## Phase 3: User Story 2 - Apply Diff-UI Design Tokens with Diffgazer Color Overrides (Priority: P2)

**Goal**: diff-ui's base theme provides structural tokens; diffgazer overrides color values to match its GitHub-inspired palette. Both dark and light modes render correctly.

**Independent Test**: Open dev server, verify components match current GitHub palette in dark mode. Switch to light mode, verify correct rendering. Compare screenshots before/after.

### Token Override Layer

- [X] T031 [US2] Create `packages/ui/src/styles/theme-overrides.css` with dark mode overrides
- [X] T032 [US2] Add light mode overrides under `[data-theme="light"]` selector
- [X] T033 [US2] Preserve diffgazer-only domain tokens (severity, status) for both modes
- [X] T034 [US2] Preserve `--muted-foreground` override

### CSS Import Order Update

- [X] T035 [US2] Update `apps/web/src/styles/index.css` — new import order: tailwindcss → diffui/theme.css → @diffgazer/ui/theme-overrides.css → @diffgazer/ui/sources.css
- [X] T036 [US2] Update `packages/ui/src/styles/index.css` — imports diffui/theme.css then ./theme-overrides.css
- [X] T037 [US2] Update `@source` directives in sources.css — added diff-ui dist path for Tailwind class scanning
- [X] T038 [US2] JetBrains Mono `@font-face` preserved in theme-overrides.css

**Checkpoint**: All components render with GitHub-inspired palette. Dark/light mode switching works correctly. Domain-specific tokens (severity, status) preserved.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, verification, and finalization

- [ ] T039 ~~Remove old `packages/ui/src/styles/theme.css`~~ — DEFERRED, still used by `apps/docs/src/index.css`
- [X] T040 Delete local component source files replaced by re-exports: badge.tsx, input.tsx, scroll-area.tsx, section-header.tsx, key-value.tsx. Updated stepper imports to use `diffui/components/badge`, code-block to use `diffui/components/scroll-area`.
- [X] T041 Full build verification: `pnpm --dir packages/ui build` and `pnpm --dir apps/web build` pass with zero errors
- [ ] T042 Dev server verification: run `pnpm --dir apps/web dev` and visually verify all pages render correctly
- [ ] T043 Keyboard navigation verification: test keyboard flows
- [ ] T044 Dark/light mode verification: toggle theme on every major page
- [X] T045 Verify no duplicate `cn()`: one definition in `lib/cn.ts` (internal use), re-exported from `diffui/lib/utils` in index.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 (Phase 2)**: Depends on Setup (T001-T003) completion
  - Direct re-exports (T004-T019): Can begin immediately after Setup
  - Adapted re-exports (T020-T029): Can begin immediately after Setup, parallel with direct re-exports
  - Utility dedup (T030): Can run parallel with re-exports
- **US2 (Phase 3)**: Can begin after Setup, but benefits from US1 being complete (to verify tokens apply to re-exported components)
- **Polish (Phase 4)**: Depends on US1 and US2 completion

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Setup (Phase 1). Core migration.
- **User Story 2 (P2)**: Technically independent of US1 (can create override CSS anytime), but validation requires US1 components to be in place.
- **User Story 3 (P3)**: Implemented as Setup (Phase 1) — prerequisite for both US1 and US2.

### Within User Story 1

- Direct re-exports (T004-T018) are sequential changes to `packages/ui/src/index.ts` (same file) but each can be done as an atomic commit
- Adapted wrapper creation (T020-T026, T028) targets different files and CAN run in parallel
- Index.ts updates for adapted components (T029) MUST run after all wrappers are created
- Build checks (T019, T029) must run after their respective groups
- Local source file deletion deferred to T040 (Phase 4) — do NOT delete during re-export tasks

### Parallel Opportunities

**Within Phase 2 (US1):**
```
Parallel group 1 (adapted wrappers — different files):
  T020: Callout adapter in packages/ui/src/components/callout/
  T021: Checkbox adapter in packages/ui/src/components/checkbox/
  T022: Radio adapter in packages/ui/src/components/radio/
  T023: Panel adapter in packages/ui/src/components/panel/
  T024: Stepper adapter in packages/ui/src/components/stepper/
  T025: Toast adapter in packages/ui/src/components/toast/
  T026: Dialog adapter in packages/ui/src/components/dialog/
  T028: CodeBlock adapter in packages/ui/src/components/code-block/
```

**Within Phase 3 (US2):**
```
Parallel group 2 (different CSS concerns):
  T031+T032: Color overrides (dark + light)
  T033: Domain token preservation
  T038: Font preservation
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: US1 direct re-exports (T004-T019)
3. Complete Phase 2: US1 adapted re-exports (T020-T029)
4. Complete Phase 2: Utility dedup (T030)
5. **STOP and VALIDATE**: Build succeeds, UI renders, keyboard nav works
6. Components now come from diff-ui, but colors may be off (monochrome)

### Full Delivery

1. Complete MVP above
2. Complete Phase 3: US2 token overrides (T031-T038)
3. **VALIDATE**: Colors match GitHub palette in both modes
4. Complete Phase 4: Polish (T039-T045)
5. **FINAL VALIDATION**: Full visual + keyboard + build check

---

## Notes

- All tasks modify `packages/ui/` — the web app (`apps/web/`) changes only its CSS imports (T035)
- Toast adapter (T025) is the highest-complexity task — diff-ui uses store-based API vs diffgazer's context+hooks
- Direct re-exports are the lowest-risk tasks — simple import path changes
- Keep old component files until build verification passes (delete in Phase 4)
