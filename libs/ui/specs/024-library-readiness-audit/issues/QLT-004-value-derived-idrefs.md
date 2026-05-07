# QLT-004: Value-derived IDs can break ARIA relationships

Area: Accessibility / ARIA IDREF / navigation
Severity: P1
Effort: Small/Medium

## Problem

Several components derive DOM IDs and ARIA IDREFs directly from public values or weakly sanitized values. Values containing whitespace, punctuation, slashes, or normalized collisions can break relationships or point `aria-activedescendant` at the wrong element.

## Evidence

- Tabs use public `value` in trigger/content IDs and IDREFs: `libs/ui/registry/ui/tabs/tabs-trigger.tsx:69`, `libs/ui/registry/ui/tabs/tabs-content.tsx:20`.
- NavigationList derives active descendant IDs from public item IDs: `libs/ui/registry/ui/navigation-list/navigation-list-item.tsx:102`.
- Listbox uses value-derived IDs: `libs/ui/registry/hooks/use-listbox.ts:183`.
- Select option IDs only replace whitespace, so `"a b"` and `"a_b"` collide: `libs/ui/registry/ui/select/select-utils.ts:10`.

## User Impact

Screen readers can lose tab/panel relationships or announce the wrong active option for common title-derived values such as `"getting started"`.

## Fix

Generate DOM-safe internal IDs independent of public values, or encode values with a collision-resistant reversible encoding. Keep public values in state/data APIs, not raw DOM IDREF construction.

## Acceptance Criteria

- Tabs, NavigationList, Listbox, and Select keep valid IDREFs for values containing spaces, punctuation, slashes, and underscore/space collision cases.
- `aria-controls`, `aria-labelledby`, and `aria-activedescendant` always point to existing unique IDs.

## Verification

- Tests for Tabs and NavigationList with `value/id="getting started"`.
- Select tests for colliding values such as `"a b"` and `"a_b"`.
- Axe checks for affected widgets.

