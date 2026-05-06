# QLT-001 - Select form and listbox behavior is not robust

**Area**: Select  
**Priority**: P2  
**Severity**: High  
**Effort**: Medium

## Problem

`Select` has several user-visible contract gaps: disabled selects still submit hidden values, required selection is not expressible, disabled options can be highlighted/selected through typeahead, and search/listbox ARIA ownership depends on refs read during render.

## Evidence

- `libs/ui/registry/ui/select/select.tsx:95` renders hidden inputs when `name` exists.
- `libs/ui/registry/ui/select/select.tsx:98` does not mark multi hidden inputs disabled.
- `libs/ui/registry/ui/select/select.tsx:100` does not mark single hidden input disabled.
- `libs/ui/registry/ui/select/select-content.tsx:78` scans labels for typeahead without disabled metadata.
- `libs/ui/registry/ui/select/select-item.tsx:102` marks disabled items, but state selection is not guarded centrally.
- `libs/ui/registry/ui/select/select-content.tsx:157` reads `searchInputRef.current` during render for `aria-activedescendant`.

## User Impact

Forms can submit disabled values, keyboard users can choose disabled options, and assistive technology ownership can be wrong on first open/hydration.

## Fix

Disable/omit hidden inputs when the select is disabled. Add a required validation strategy. Register option metadata including disabled state, skip disabled items in typeahead, and guard `selectItem`. Track search presence declaratively.

## Acceptance Criteria

- Disabled single/multiple selects contribute no `FormData`.
- Required select validity is testable.
- Disabled options cannot be highlighted or selected by click, arrows, typeahead, Enter, or Tab.
- Searchable select assigns `aria-activedescendant` to the correct owner on first render.

## Verification

Behavior tests for form submission, disabled options, typeahead, Tab commit, required validity, searchable/non-searchable ARIA.

