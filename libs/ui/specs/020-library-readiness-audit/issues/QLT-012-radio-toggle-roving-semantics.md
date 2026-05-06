# QLT-012 - Radio and toggle roving tabindex and semantics are inconsistent

**Area**: RadioGroup, ToggleGroup  
**Severity**: Medium to High  
**Effort**: Medium  
**Status**: Open

## Problem

Radio and toggle groups can initially render multiple tabbable items when no value is selected. ToggleGroup can also use radio semantics while allowing deselection.

## Evidence

- `libs/ui/registry/lib/resolve-tab-target.ts`
- `libs/ui/registry/ui/radio/radio-group-item.tsx`
- `libs/ui/registry/ui/toggle-group/toggle-group.tsx`
- `libs/ui/registry/ui/toggle-group/toggle-group-item.tsx`

## User Impact

Keyboard users get too many tab stops, and assistive tech gets semantics that do not match behavior.

## Fix

- Register item order in group state.
- Keep only one item tabbable.
- Use radio semantics only for non-deselectable exclusive choices.
- Use button + `aria-pressed` for real toggle behavior.

## Acceptance Criteria

- Unselected group starts with one tabbable item.
- Toggle semantics match deselect behavior.

## Verification

- Initial tabindex tests.
- Toggle deselection semantic tests.

