# Implementation Plan: Direct Diff-UI Component Migration

**Branch**: `002-diffui-direct-migration` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-diffui-direct-migration/spec.md`

## Summary

Replace @diffgazer/ui re-export facade with direct `diffui/*` imports in `apps/web`. 47 consumer files import from @diffgazer/ui. Of these, components with diff-ui counterparts are migrated to direct `diffui/components/*` imports. 4 components (CardLayout, LabeledField, Checklist, Toast) remain in @diffgazer/ui. CSS token override layer (theme-overrides.css) maps diff-ui's monochrome theme to diffgazer's GitHub palette.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only
**Primary Dependencies**: React 19, diffui (workspace:*), keyscope (workspace:*), Tailwind CSS v4, CVA + tailwind-merge + clsx
**Storage**: N/A (frontend UI migration)
**Testing**: vitest, @testing-library/react
**Target Platform**: Web (Vite dev server, port 3001)
**Project Type**: Web application (monorepo package)
**Constraints**: Zero user-facing regressions, keyboard navigation must be preserved
**Scale/Scope**: 47 consumer files, 6 feature areas, ~15 unique component types

## Research Findings (Deep Analysis)

### Spec Corrections from Codebase Analysis

| Spec Claim | Actual Finding |
|------------|---------------|
| 52 consumer files | **47 files** import from @diffgazer/ui |
| 23 components to migrate | **15 component types** actually imported in web app |
| 39 keyscope files | **35 files** use keyscope hooks |
| diff-ui has built-in keyscope integration | diff-ui components do NOT import keyscope — only examples demonstrate patterns |

### Components NOT Imported in Web App (No Migration Needed)

These exist in @diffgazer/ui but are never imported in apps/web:
- **CodeBlock** — web app uses custom `CodeSnippet` component
- **DiffView** — web app has its own local diff-view in features/review
- **Stepper/StepperStep/StepperSubstep** — web app uses local ProgressList/ProgressStep
- **HorizontalStepper** — not used anywhere
- **BlockBar** — not imported in web app
- **ToggleGroup** — not imported in web app
- **Textarea** — re-exported but never imported in web app
- **SearchInput** — not imported in web app (but exists in diff-ui)

### Actual Components Requiring Migration (by consumer file count)

| Component | Files | API Compatibility | Migration Effort |
|-----------|-------|-------------------|-----------------|
| Button | 20 | Medium — diff-ui has no `tab`/`toggle` variants, uses Spinner for loading | Medium |
| Badge | 17 | ✅ Drop-in — identical API | Low (import change only) |
| Panel/PanelHeader/PanelContent | 11 | ✅ Compatible — same compound structure | Low |
| RadioGroup/RadioGroupItem | 10 | Medium — `focusedValue` → `highlighted`, navigation now built-in | Medium |
| SectionHeader | 9 | ✅ Drop-in — identical API | Low (import change only) |
| ScrollArea | 7 | ✅ Drop-in — identical API | Low (import change only) |
| CheckboxGroup/CheckboxItem | 7 | Medium — `focusedValue` → `highlighted`, navigation built-in | Medium |
| Dialog (all parts) | 6 | ✅ Compatible — same compound structure, focus trap built-in | Low |
| Menu/MenuItem/MenuDivider | 6 | High — `focusedValue`/`onActivate` → `useListbox` automatic nav | High |
| Callout | 4 | High — monolithic (title prop) → compound (context-based) | High |
| NavigationList/NavigationListItem | 3 | High — `focusedValue`/`onActivate`/`isFocused` → `useListbox` auto nav | High |
| Input | 2 | ✅ Drop-in — identical API | Low (import change only) |
| EmptyState | 2 | ✅ Compatible — new features (size, live) but backward compatible | Low |
| KeyValue | 1 | ✅ Drop-in — identical compound API | Low (import change only) |
| Radio (standalone) | 1 | Medium — `onCheckedChange` → `onChange`, `focused` → `highlighted` | Medium |
| Tabs | 1 | ✅ Compatible — no generic type param used in practice | Low |

### Components Remaining in @diffgazer/ui

| Component | Consumer Files | Reason |
|-----------|---------------|--------|
| CardLayout | 6 | No diff-ui counterpart |
| Toast (useToast, ToastProvider) | 4+1 (root) | diff-ui uses store API, diffgazer uses context+hooks |
| LabeledField | 0 | Future use, no diff-ui counterpart |
| Checklist | 0 | Future use, no diff-ui counterpart |

### Critical API Differences

#### Button: Variant Mapping
| @diffgazer/ui | diff-ui | Action |
|---------------|---------|--------|
| primary | primary | ✅ Same |
| secondary | secondary | ✅ Same |
| error | destructive | Rename in consumer |
| success | success | ✅ Same |
| ghost | ghost | ✅ Same |
| outline | outline | ✅ Same |
| link | link | ✅ Same |
| tab | — | Remove, use Tabs instead |
| toggle | — | Remove, use ToggleGroup or custom |
| — | action | New variant available |

Loading state: @diffgazer/ui shows `[...]` text, diff-ui uses `<Spinner>` component.

#### CheckboxGroup/RadioGroup: Navigation Props
| @diffgazer/ui | diff-ui | Notes |
|---------------|---------|-------|
| `focusedValue` | `highlighted` | Rename prop |
| `onValueChange(value)` | `onChange(value)` | Rename callback |
| `onFocusChange(value)` | `onHighlightChange(value)` | Rename callback |
| External `useNavigation` | Built-in navigation | Remove manual `useNavigation` call |

#### Callout: Structural Change
```tsx
// @diffgazer/ui (current)
<Callout variant="warning" title="SECURITY WARNING">
  Message content
</Callout>

// diff-ui (target) — NEEDS VERIFICATION
// diff-ui Callout supports layout prop and controllable visibility
// but title handling needs investigation per component source
```

#### NavigationList/Menu: Focus Management Change
```tsx
// @diffgazer/ui (current) — manual focus
const nav = useNavigation({ role: "listbox" })
<NavigationList
  ref={nav.containerRef}
  focusedValue={nav.focusedValue}
  onSelect={handleSelect}
  onActivate={handleActivate}
  isFocused={isFocused}
/>

// diff-ui (target) — automatic focus via useListbox
<NavigationList
  selectedId={selectedId}
  onSelect={handleSelect}
  onHighlightChange={handleHighlight}
  focused={isFocused}
/>
// Navigation is automatic — no useNavigation needed on consumer side
```

## Project Structure

### Documentation (this feature)

```text
specs/002-diffui-direct-migration/
├── plan.md              # This file
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Implementation tasks (next step)
```

### Source Code (affected files)

```text
apps/web/
├── package.json                    # Add diffui dependency
├── src/styles/index.css            # CSS import chain (already updated)
├── src/app/routes/                 # Route files importing @diffgazer/ui
├── src/components/                 # Shared components
│   ├── layout/header.tsx           # Button
│   ├── shared/                     # Various component imports
│   └── ui/progress/                # Badge usage
├── src/features/
│   ├── home/components/            # Menu, Panel, Button, Toast, Callout, CardLayout
│   ├── settings/components/        # RadioGroup, CheckboxGroup, Panel, Menu, Button
│   ├── providers/components/       # Dialog, NavigationList, Badge, Button
│   ├── review/components/          # Tabs, EmptyState, ScrollArea, Badge, Button
│   ├── onboarding/components/      # RadioGroup, CheckboxGroup, Badge, CardLayout
│   └── history/components/         # NavigationList, Badge, ScrollArea
└── src/hooks/                      # No @diffgazer/ui imports

packages/ui/
├── package.json                    # Update deps/exports after cleanup
├── src/index.ts                    # Slim down to 4 components
├── src/components/                 # Delete migrated files
│   ├── card-layout.tsx             # KEEP
│   ├── labeled-field.tsx           # KEEP
│   ├── checklist.tsx               # KEEP
│   ├── toast/                      # KEEP
│   └── (all others)               # DELETE
├── src/lib/cn.ts                   # KEEP (internal, not re-exported)
├── src/internal/
│   ├── portal.tsx                  # DELETE (only used by Dialog)
│   └── selectable-item.ts          # DELETE (only used by Checkbox/Radio)
└── src/styles/
    ├── theme-overrides.css         # KEEP
    └── sources.css                 # UPDATE (remove component source)
```

**Structure Decision**: Existing monorepo structure preserved. No new packages or directories created.

## Implementation Phases

### Phase 0: Foundation (1 task)
Add `diffui` as direct dependency to `apps/web/package.json`. Verify CSS import chain works with direct diffui imports.

### Phase 1: Drop-in Migrations (6 tasks, parallelizable)
Components with identical or highly compatible APIs — import path change + minimal prop adjustments:
- Badge (17 files)
- SectionHeader (9 files)
- ScrollArea (7 files)
- Input (2 files)
- KeyValue (1 file)
- EmptyState (2 files)
- Panel/PanelHeader/PanelContent (11 files)
- Dialog (all parts, 6 files)
- Tabs (1 file)

### Phase 2: Medium-Effort Migrations (4 tasks, parallelizable)
Components requiring prop renames and keyboard nav adjustments:
- Button (20 files) — variant mapping, loading state
- CheckboxGroup/CheckboxItem (7 files) — focusedValue → highlighted
- RadioGroup/RadioGroupItem (10 files) — same pattern as checkbox
- Radio standalone (1 file) — prop renames

### Phase 3: High-Effort Migrations (3 tasks, parallelizable)
Components with significant API differences:
- Callout (4 files) — structural refactoring
- NavigationList (3 files) — focus model change
- Menu (6 files) — focus model change

### Phase 4: Cleanup (2 tasks, sequential)
- Remove all migrated components from @diffgazer/ui
- Update @diffgazer/ui exports to only CardLayout, LabeledField, Checklist, Toast
- Delete unused internal utilities
- Update package.json

### Phase 5: Verification (1 task)
- Full build (`pnpm build`)
- Type check (`pnpm type-check`)
- Verify no @diffgazer/ui imports remain for migrated components
- Visual verification of key pages

## Complexity Tracking

No constitution violations. Standard monorepo migration within existing structure.
