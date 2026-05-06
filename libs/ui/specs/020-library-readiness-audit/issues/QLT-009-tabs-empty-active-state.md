# QLT-009 - Tabs can start or become empty with no active tab

**Area**: Tabs behavior  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

Tabs can initialize without an active value or keep a stale active value after data changes. That can leave every trigger unfocusable and no panel visible.

## Evidence

- `libs/ui/registry/ui/tabs/tabs.tsx`
- `libs/ui/registry/ui/tabs/tabs-trigger.tsx`
- `libs/ui/registry/ui/tabs/tabs-content.tsx`

## User Impact

Keyboard users can be unable to focus any tab, and users can see an empty tab panel state.

## Fix

- Register enabled tab values.
- Initialize uncontrolled tabs to the first enabled tab.
- Reconcile stale uncontrolled values when children change.

## Acceptance Criteria

- Exactly one enabled tab is active and tabbable when tabs exist.
- Removed selected tab is handled deterministically.

## Verification

- Tests for no default value.
- Tests for removed or disabled selected tab.

