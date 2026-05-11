# UI-006: Primitive Boundaries And Web Adoption

Priority: P1

## Problem

The architecture direction is correct, but a few primitives leak product assumptions and `apps/web` still reimplements some generic UI behavior.

Known gaps:

- `Stepper` hardcodes product/process copy such as `DONE`, `RUN`, `WAIT`, `FAIL`, `analyzing...`, `done`, `failed`.
- `Card` and `Panel` overlap without a clear public distinction.
- `Typography` is a weak shared primitive and overlaps with `Overflow`.
- `CardLayout` duplicates `Card` sizing.
- Some empty states bypass `EmptyState` composition.
- `SectionHeader` bordered behavior is manually duplicated.
- `DiffView` public comments reference product/server internals.
- Model picker duplicates Select/Listbox behavior and owns too much keyboard/focus state.
- `CheckboxGroup` Enter-toggle behavior is duplicated in web.
- Some search inputs rebuild `SearchInput` from `InputGroup`.
- App-local `AsciiLogo` duplicates UI `Logo`/figlet behavior.

Evidence:

- `libs/ui/registry/ui/stepper/stepper-trigger.tsx`
- `libs/ui/registry/ui/stepper/stepper-substep.tsx`
- `libs/ui/registry/ui/card/**`
- `libs/ui/registry/ui/panel/**`
- `libs/ui/registry/ui/typography/typography.tsx`
- `libs/ui/registry/ui/overflow/overflow-text.tsx`
- `libs/ui/registry/lib/diff/parse.ts`
- `apps/web/src/components/ui/card-layout.tsx`
- `apps/web/src/components/ui/ascii-logo.tsx`
- `apps/web/src/features/providers/components/model-select-dialog/**`
- `apps/web/src/features/settings/components/analysis/analysis-selector-content.tsx`
- `apps/web/src/components/shared/trust-permissions-content.tsx`
- `apps/web/src/features/providers/components/provider-list.tsx`
- `apps/web/src/features/providers/components/model-select-dialog/model-search-input.tsx`

## Required Fix

- Make `Stepper` domain-neutral via labels/slots/defaults owned by app adapters.
- Keep product assemblies app-local, but compose them from library primitives.
- Do not move `ProgressList`, severity breakdowns, history panes, onboarding page flow, or provider workflows into `libs/ui`.
- Use `SearchInput`, `EmptyState`, `SectionHeader`, `Card`, `Logo`, `KeyValue`, `Select`/`Listbox` primitives where they fit.
- If current `Select` cannot support model picker requirements, extract the missing generic primitive capability first; do not keep a custom app-local listbox forever.

## Tests

Update web behavior tests after migration:

- model picker keyboard/search/filter/select behavior;
- CheckboxGroup Enter behavior if moved into primitive;
- empty states retain accessible text;
- logo/header renders correctly;
- review/onboarding/settings flows preserve keyboard behavior.
