# QLT-021 - Public API naming, composition, and polymorphic types are inconsistent

**Area**: public API and DX  
**Severity**: Medium to High  
**Effort**: Large  
**Status**: Open

## Problem

Equivalent components expose inconsistent naming and composition models:

- `onChange` vs `onValueChange` vs `onSelectedIdChange`;
- `as` vs render-prop composition;
- inconsistent context hook exports;
- leaf parts without normal DOM props/ref escape hatches;
- broad polymorphic `HTMLElement` types and ref casts.

## Evidence

Recheck these areas:

- `libs/ui/registry/ui/tabs`
- `libs/ui/registry/ui/select`
- `libs/ui/registry/ui/accordion`
- `libs/ui/registry/ui/checkbox`
- `libs/ui/registry/ui/radio`
- `libs/ui/registry/ui/toggle-group`
- `libs/ui/registry/ui/button`
- `libs/ui/registry/ui/sidebar`
- `libs/ui/registry/ui/card`
- `libs/ui/registry/ui/typography`

## User Impact

Consumers have to relearn similar APIs component by component, and internals can accidentally become supported public API.

## Fix

Define a public API matrix:

- `value/defaultValue/onValueChange` for value components;
- `checked/defaultChecked/onCheckedChange` for checked state;
- `open/defaultOpen/onOpenChange` for visibility;
- `selectedId/defaultSelectedId/onSelectedIdChange` for selected-id collections;
- `onSelect` or `onActivate` only for activation events.

Also define a composition policy and typed polymorphic helper.

## Acceptance Criteria

- Similar components use the same prop names.
- Deprecated aliases exist for migration where needed.
- Context hooks are intentionally public or internal.
- Polymorphic components preserve element-specific attributes and refs.

## Verification

- Type tests.
- Export snapshot.
- Docs generated from the same API matrix.

