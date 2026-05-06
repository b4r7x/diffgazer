# QLT-003 - Shared navigation has stale and incorrect state paths

**Area**: Navigation helpers and listbox-like components  
**Priority**: P2  
**Severity**: High  
**Effort**: Medium

## Problem

Shared navigation can start from the wrong item, ignore the focused DOM item, and keep stale active descendant IDs after item removal.

## Evidence

- `libs/ui/registry/hooks/use-navigation.ts:190` computes focused index.
- `libs/ui/registry/hooks/use-navigation.ts:193` returns `0` when no item is highlighted, so ArrowDown advances to the second item.
- `libs/ui/registry/hooks/use-listbox.ts:74` stores highlighted/selected state.
- `libs/ui/registry/hooks/use-listbox.ts:136` can keep `aria-activedescendant` based on stale IDs.
- `libs/ui/registry/hooks/use-navigation.ts:126` falls back to role selectors, coupling behavior to literal roles.
- `libs/ui/registry/hooks/use-navigation.ts`, `libs/ui/tsup.config.ts`, and copy-mode keys registry create multiple navigation sources of truth.

## User Impact

Keyboard navigation can skip the first item, activate removed data, or drift between source tests, package output, and copied hooks.

## Fix

Derive current index from highlighted value, active descendant, or `document.activeElement` when moving focus. Clamp/reset highlighted IDs when children change. Prefer an explicit data contract over role coupling. Add a parity/drift check between UI local hook, keys package source, and copied artifact.

## Acceptance Criteria

- First forward navigation lands on the first enabled item.
- Active descendant always points to an existing enabled option.
- Navigation source drift fails CI.

## Verification

Tests for `useNavigation`, NavigationList, DiffView, Sidebar, item removal, middle focused item navigation, and hook parity.

