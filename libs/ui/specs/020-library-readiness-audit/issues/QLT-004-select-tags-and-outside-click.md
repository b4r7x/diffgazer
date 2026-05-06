# QLT-004 - Select tags and portal outside-click behavior are broken

**Area**: Select  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

`SelectTags` can render remove buttons inside a trigger button. Default portaled content can also be treated as outside the select wrapper if outside-click checks do not include the content ref.

## Evidence

- `libs/ui/registry/ui/select/select-trigger.tsx`
- `libs/ui/registry/ui/select/select-tags.tsx`
- `libs/ui/registry/ui/select/use-select-state.ts`
- `libs/ui/registry/ui/select/select-content.tsx`

## User Impact

Invalid nested interactive DOM and unreliable dropdown interactions.

## Fix

- Move removable tags outside the trigger button or redesign the trigger.
- Exclude portaled content from outside-click detection.

## Acceptance Criteria

- No button renders inside a button.
- Clicking portaled content does not close as an outside click.

## Verification

- User-event test for multi-select tags.
- User-event test for searchable portaled select.

