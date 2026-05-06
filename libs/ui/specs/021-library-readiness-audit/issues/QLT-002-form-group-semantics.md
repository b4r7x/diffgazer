# QLT-002 - Checkbox, radio, and toggle group semantics need hardening

**Area**: Form/selectable groups  
**Priority**: P2  
**Severity**: High  
**Effort**: Medium

## Problem

Checkbox group required behavior, radio/toggle roving tabindex, and toggle disabled semantics diverge from native and APG expectations.

## Evidence

- `libs/ui/registry/ui/checkbox/checkbox-group.tsx:87` passes group `required` to children.
- `libs/ui/registry/ui/checkbox/checkbox-item.tsx:36` receives item required state.
- `libs/ui/registry/lib/resolve-tab-target.ts:10` relies on DOM state during render.
- `libs/ui/registry/ui/radio/radio-group-item.tsx:28` uses the resolved tab target.
- `libs/ui/registry/ui/toggle-group/toggle-group-item.tsx:44` uses the same pattern.
- `libs/ui/registry/ui/toggle-group/toggle-group-item.tsx:49` computes disabled state but does not apply native disabled.
- `libs/ui/registry/ui/toggle-group.tsx:107` exposes radiogroup semantics even when deselection is allowed.

## User Impact

Required checkbox groups can require every option, unselected groups can create multiple tab stops, and disabled toggle items can still be focus/highlight targets.

## Fix

Represent group-level “at least one selected” validation separately from item `required`. Track first enabled roving target declaratively. Apply native disabled or force disabled items out of tab/focus/highlight behavior. Use `aria-pressed` button semantics for deselectable toggle groups or disallow deselection in radiogroup mode.

## Acceptance Criteria

- Empty required group is invalid; any one checked item makes it valid.
- Unselected radio/toggle groups expose exactly one tabbable enabled item.
- Disabled toggle items are not tabbable, not highlighted, and not activatable.
- `allowDeselect` has valid accessible semantics.

## Verification

Form validity tests, `user.tab()` tab-order tests, disabled focus/hover/click tests, and role/state assertions.

