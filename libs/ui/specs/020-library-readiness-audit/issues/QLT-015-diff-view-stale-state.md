# QLT-015 - DiffView keeps stale active hunk state

**Area**: DiffView  
**Severity**: Medium  
**Effort**: Small  
**Status**: Open

## Problem

DiffView can reset active hunk only on hunk count changes. If content changes with the same count, active state can point to stale content.

## Evidence

- `libs/ui/registry/ui/diff-view/diff-view.tsx`
- `libs/ui/registry/ui/diff-view/diff-view-unified.tsx`

## User Impact

Users can see the wrong hunk highlighted or keyboard navigation can start from a stale state.

## Fix

Reset or clamp active hunk by parsed content identity, not just hunk count. Ensure hunk headers do not use interactive roles without full keyboard behavior.

## Acceptance Criteria

- Same-count content changes reset/clamp active hunk.
- Keyboard navigation from empty state is deterministic.

## Verification

- Rerender tests with same hunk count and different content.

