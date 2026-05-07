# QLT-002: Select And Listbox Contracts Need Rework

Area: Select, listbox, form behavior, accessibility

Severity: P2

Effort: L

## Problem

Select and listbox behavior mixes ARIA ownership issues, mutable render state, stale item state, and native form gaps. This is the densest single component-quality cluster.

## Evidence

- `libs/ui/registry/ui/select/select-content.tsx:154-180` renders search/combobox behavior inside the listbox content.
- `libs/ui/registry/ui/select/select-search.tsx:45-53` gives search input combobox semantics inside listbox ownership.
- `libs/ui/registry/ui/select/select-item.tsx:146` and `libs/ui/registry/ui/select/select-item.tsx:151` allow visual indicators to contribute to accessible item names.
- `libs/ui/registry/ui/select/use-select-state.ts:62` and `libs/ui/registry/ui/select/use-select-state.ts:89` store option labels in mutable refs.
- `libs/ui/registry/ui/select/select-value.tsx:39`, `libs/ui/registry/ui/select/select-tags.tsx:25`, and `libs/ui/registry/ui/select/select-empty.tsx:16` read label state during render.
- `libs/ui/registry/hooks/use-listbox.ts:87`, `libs/ui/registry/hooks/use-listbox.ts:108`, and `libs/ui/registry/hooks/use-listbox.ts:149` can leave selected/highlighted state stale after items change.
- `libs/ui/registry/hooks/use-navigation.ts:248` can activate a removed/stale highlighted item.
- `libs/ui/registry/hooks/use-controllable-state.ts:18`, `libs/ui/registry/ui/search-input/search-input.tsx:67`, `libs/ui/registry/ui/checkbox/checkbox.tsx:80`, `libs/ui/registry/ui/radio-group/radio-group.tsx:57`, `libs/ui/registry/ui/select/use-select-state.ts:49`, and `libs/ui/registry/ui/select/select.tsx:98` do not fully participate in native form reset.

## User Impact

Screen reader users can get invalid composite semantics or noisy option names. Keyboard users can activate stale items. Form users can reset a form and see custom controls stay out of sync.

## Fix

Rework Select around a single explicit state model and APG-aligned structure.

Concrete fix:

- Keep search input outside the listbox ownership tree, or use an APG combobox pattern where the input owns the popup listbox.
- Move option labels and item registry into React state/external store instead of mutable refs.
- Mark decorative indicators `aria-hidden`.
- Clear or remap highlighted/selected state when registered items change.
- Add native form reset handling for uncontrolled custom controls.

## Acceptance Criteria

- Select structure matches one documented APG pattern.
- Option accessible names exclude decorative indicators.
- Removed options cannot be selected by stale highlight state.
- Uncontrolled select, checkbox, radio group, and search input reset with native form reset.
- No Select render output depends on mutable ref-only state.

## Verification

- Add accessibility tests for searchable select semantics and item names.
- Add keyboard tests for removing filtered/highlighted options.
- Add native form reset tests for select, checkbox, radio group, and search input.
- Run UI tests and inspect with axe or equivalent accessibility checks.

