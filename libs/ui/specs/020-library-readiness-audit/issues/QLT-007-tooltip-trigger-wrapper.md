# QLT-007 - Tooltip trigger wrapper creates the wrong focus and name behavior

**Area**: Tooltip accessibility  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

Tooltip shorthand can wrap children in a focusable generic element, creating an extra tab stop and placing `aria-describedby` on the wrapper rather than the real control.

## Evidence

- `libs/ui/registry/ui/tooltip/tooltip.tsx`
- `libs/ui/registry/ui/popover/popover-trigger.tsx`

## User Impact

Keyboard and screen reader users interact with the wrong element.

## Fix

Use `asChild`, clone, or render-prop trigger behavior so tooltip props land on the actual interactive element.

## Acceptance Criteria

- No extra tab stop is introduced around a button or link.
- The focused control receives `aria-describedby`.

## Verification

- Tab-order test.
- Accessibility assertion on the trigger element.

