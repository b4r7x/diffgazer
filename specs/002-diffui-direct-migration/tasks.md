# Implementation Tasks: Direct Diff-UI Component Migration

**Branch**: `002-diffui-direct-migration` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Task Overview

| # | Task | Phase | Depends On | Files | Effort |
|---|------|-------|------------|-------|--------|
| 1 | Add diffui dependency to apps/web | 0 | — | 1 | Low |
| 2 | Migrate features/settings/ | 1 | T1 | 11 | High |
| 3 | Migrate features/providers/ | 1 | T1 | 10 | High |
| 4 | Migrate features/review/ | 1 | T1 | 9 | Medium |
| 5 | Migrate features/home/ | 1 | T1 | 8 | High |
| 6 | Migrate features/onboarding/ | 1 | T1 | 5 | Medium |
| 7 | Migrate features/history/ | 1 | T1 | 3 | Medium |
| 8 | Migrate shared components + routes | 1 | T1 | 8 | Medium |
| 9 | Cleanup @diffgazer/ui package | 2 | T2-T8 | ~30 | Medium |
| 10 | Build verification & type check | 3 | T9 | — | Low |

---

## T1: Add diffui dependency to apps/web

**Phase**: 0 (Foundation)
**Files**: `apps/web/package.json`

1. Add `"diffui": "workspace:*"` to apps/web dependencies
2. Run `pnpm install` from workspace root
3. Verify `diffui/components/*` resolves in apps/web

---

## T2: Migrate features/settings/ (11 files)

**Phase**: 1 | **Depends on**: T1

### Files and Component Mapping

| File | Current Imports | Target Import Source | API Changes |
|------|----------------|---------------------|-------------|
| `agent-execution/page.tsx` | Button, CardLayout, RadioGroup, RadioGroupItem | Button+Radio→diffui, CardLayout→keep | `focusedValue`→`highlighted`, `onFocusChange`→`onHighlightChange`, remove manual `useNavigation` for radio |
| `analysis/page.tsx` | Button, CardLayout | Button→diffui, CardLayout→keep | Button variant check |
| `analysis/analysis-selector-content.tsx` | Badge, CheckboxGroup, CheckboxItem, ScrollArea | All→diffui | `focusedValue`→`highlighted`, remove manual `useNavigation` for checkbox |
| `storage/page.tsx` | Button, Callout, CardLayout | Button+Callout→diffui, CardLayout→keep | Callout: `title` prop → compound or verify diff-ui API |
| `theme/page.tsx` | Panel, PanelContent, Callout, Button | All→diffui | Callout structural change |
| `theme-selector-content.tsx` | RadioGroup, RadioGroupItem | →diffui | `focusedValue`→`highlighted` |
| `theme-preview-card.tsx` | Panel, PanelHeader, PanelContent, Menu, MenuItem, Badge | All→diffui | Menu: remove `focusedValue`/`onActivate`, use `onSelect`+`onHighlightChange` |
| `trust-permissions/page.tsx` | useToast, Panel, PanelHeader, PanelContent | Panel→diffui, useToast→keep | — |
| `hub/page.tsx` | Menu, MenuItem, Panel | All→diffui | Menu focus model change |
| `diagnostics/page.tsx` | (verify imports) | — | — |
| `hooks/use-trust-form-keyboard.ts` | (keyscope only, no @diffgazer/ui) | No change | — |

---

## T3: Migrate features/providers/ (10 files)

**Phase**: 1 | **Depends on**: T1

| File | Current Imports | Target | API Changes |
|------|----------------|--------|-------------|
| `provider-details.tsx` | Badge, Button, SectionHeader, KeyValue | All→diffui | Button variant check |
| `provider-list.tsx` | NavigationList, NavigationListItem, Badge, Input | All→diffui | NavigationList: remove `focusedValue`/`onActivate`/`isFocused`, use `highlightedId`/`onHighlightChange`/`focused` |
| `api-key-dialog/api-key-dialog.tsx` | Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, Badge | All→diffui | Verify Dialog compound structure match |
| `api-key-dialog/api-key-footer.tsx` | DialogFooter, Button | All→diffui | — |
| `model-select-dialog/model-select-dialog.tsx` | Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose | All→diffui | Verify all Dialog parts exist in diffui |
| `model-select-dialog/model-search-input.tsx` | Button | →diffui | — |
| `model-select-dialog/model-filter-tabs.tsx` | Button | →diffui | — |
| `model-select-dialog/dialog-footer-actions.tsx` | Button | →diffui | — |
| `model-select-dialog/model-list-item.tsx` | Badge | →diffui | — |
| `hooks/use-provider-management.ts` | useToast | →keep @diffgazer/ui | — |

---

## T4: Migrate features/review/ (9 files)

**Phase**: 1 | **Depends on**: T1

| File | Current Imports | Target | API Changes |
|------|----------------|--------|-------------|
| `issue-details-pane.tsx` | Tabs, TabsList, TabsTrigger, TabsContent, SectionHeader, EmptyState, ScrollArea | All→diffui | Tabs: `onValueChange` stays, verify compound structure |
| `analysis-summary.tsx` | Panel, PanelContent, SectionHeader, Button | All→diffui | — |
| `review-progress-view.tsx` | SectionHeader, Badge, Button, Callout | All→diffui | Callout structural change |
| `context-snapshot-preview.tsx` | SectionHeader, Button | All→diffui | — |
| `activity-log.tsx` | ScrollArea | →diffui | — |
| `api-key-missing-view.tsx` | Button | →diffui | — |
| `no-changes-view.tsx` | Button | →diffui | — |
| `review-metrics-footer.tsx` | SectionHeader | →diffui | — |
| `log-entry.tsx` | Badge | →diffui | — |
| `agent-board.tsx` | SectionHeader, Badge | →diffui | — |
| `hooks/use-review-error-handler.ts` | useToast | →keep @diffgazer/ui | — |

---

## T5: Migrate features/home/ (8 files)

**Phase**: 1 | **Depends on**: T1

| File | Current Imports | Target | API Changes |
|------|----------------|--------|-------------|
| `home-menu.tsx` | Menu, MenuDivider, MenuItem, Panel, PanelHeader | All→diffui | Menu: remove `focusedValue`/`onActivate`, use `onSelect`+`selectedId`+`onHighlightChange` |
| `page.tsx` | useToast | →keep @diffgazer/ui | — |
| `storage-wizard.tsx` | Button, Callout, CardLayout | Button+Callout→diffui, CardLayout→keep | Callout structural change |
| `trust-panel.tsx` | CardLayout, Button, useToast | Button→diffui, CardLayout+useToast→keep | — |
| `context-sidebar.tsx` | Panel, PanelContent, PanelHeader | All→diffui | — |

---

## T6: Migrate features/onboarding/ (5 files)

**Phase**: 1 | **Depends on**: T1

| File | Current Imports | Target | API Changes |
|------|----------------|--------|-------------|
| `onboarding-wizard.tsx` | CardLayout, Button, Callout | Button+Callout→diffui, CardLayout→keep | Callout structural change |
| `steps/model-step.tsx` | RadioGroup, RadioGroupItem, Badge | All→diffui | `focusedValue`→`highlighted` |
| `steps/execution-step.tsx` | RadioGroup, RadioGroupItem | All→diffui | `focusedValue`→`highlighted` |
| `steps/analysis-step.tsx` | CheckboxGroup, CheckboxItem, Badge, ScrollArea | All→diffui | `focusedValue`→`highlighted` |
| `steps/provider-step.tsx` | Badge, RadioGroup, RadioGroupItem | All→diffui | `focusedValue`→`highlighted` |

---

## T7: Migrate features/history/ (3 files)

**Phase**: 1 | **Depends on**: T1

| File | Current Imports | Target | API Changes |
|------|----------------|--------|-------------|
| `components/page.tsx` | NavigationList | →diffui | Remove `focusedValue`/`onActivate`, use `highlightedId`/`onHighlightChange` |
| `components/history-insights-pane.tsx` | ScrollArea, SectionHeader | All→diffui | — |
| `components/run-accordion-item.tsx` | Badge | →diffui | — |

---

## T8: Migrate shared components + routes (8 files)

**Phase**: 1 | **Depends on**: T1

| File | Current Imports | Target | API Changes |
|------|----------------|--------|-------------|
| `app/routes/__root.tsx` | Button, ToastProvider | Button→diffui, ToastProvider→keep | — |
| `app/routes/help.tsx` | Panel, PanelContent, PanelHeader | All→diffui | — |
| `components/layout/header.tsx` | Button | →diffui | — |
| `components/shared/api-key-method-selector.tsx` | Input, Radio | All→diffui | Radio: `onCheckedChange`→`onChange`, `focused`→`highlighted` |
| `components/shared/trust-permissions-content.tsx` | Badge, Callout, Button, CheckboxGroup, CheckboxItem | All→diffui | CheckboxGroup: `focusedValue`→`highlighted`; Callout structural change |
| `components/shared/storage-selector-content.tsx` | RadioGroup, RadioGroupItem | →diffui | `focusedValue`→`highlighted` |
| `components/ui/progress/progress-step.tsx` | Badge | →diffui | — |
| `components/ui/progress/progress-substep.tsx` | Badge | →diffui | — |
| `components/shared/keyboard-navigation.integration.test.tsx` | CheckboxGroup, CheckboxItem, Menu, MenuItem, RadioGroup, RadioGroupItem | All→diffui | Update test to use diff-ui API |

---

## T9: Cleanup @diffgazer/ui package

**Phase**: 2 | **Depends on**: T2-T8

1. **Update `packages/ui/src/index.ts`**: Export only CardLayout, LabeledField, Checklist, Toast (+ types)
2. **Delete migrated component files**:
   - `components/button.tsx`
   - `components/callout.tsx`
   - `components/checkbox.tsx`
   - `components/radio-group.tsx`
   - `components/panel.tsx`
   - `components/empty-state.tsx`
   - `components/code-block.tsx`
   - `components/diff-view.tsx`
   - `components/block-bar.tsx`
   - `components/search-input.tsx`
   - `components/toggle-group.tsx`
   - `components/horizontal-stepper.tsx`
   - `components/dialog/` (entire directory)
   - `components/navigation-list/` (entire directory)
   - `components/menu/` (entire directory)
   - `components/stepper/` (entire directory)
   - `components/tabs/` (entire directory)
3. **Delete unused utilities**:
   - `internal/selectable-item.ts`
   - `internal/portal.tsx`
4. **Keep internal**: `lib/cn.ts` (used by remaining 4 components, NOT re-exported)
5. **Update `packages/ui/package.json`**: Remove unnecessary deps if any
6. **Update `packages/ui/src/styles/sources.css`**: Remove `@source "./components"` if no component CSS needed

---

## T10: Build verification & type check

**Phase**: 3 | **Depends on**: T9

1. Run `pnpm build` from workspace root
2. Run `pnpm type-check` from workspace root
3. Verify `grep -r '@diffgazer/ui' apps/web/src/` only shows CardLayout, LabeledField, Checklist, Toast imports
4. Verify `pnpm dev:web` starts without errors
5. Spot-check key pages in browser
