# QLT-014 - NavigationList can keep stale active descendant ids

**Area**: NavigationList, useListbox  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

NavigationList can keep `selectedId` or `highlightedId` after items change, causing `aria-activedescendant` to reference a missing option or Enter to activate removed data.

## Evidence

- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/ui/registry/ui/navigation-list`

## User Impact

Assistive tech gets invalid active descendant references and keyboard activation can target stale data.

## Fix

Validate active ids against current enabled options on every items change.

## Acceptance Criteria

- `aria-activedescendant` never points to a removed item.
- Enter cannot activate removed items.

## Verification

- Rerender tests removing highlighted and selected items.

