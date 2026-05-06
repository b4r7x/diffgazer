# QLT-013 - Stepper collapsed content is not inert

**Area**: Stepper  
**Severity**: High  
**Effort**: Small  
**Status**: Open

## Problem

Collapsed step content can be `aria-hidden` without being inert, allowing focusable descendants to remain in tab order.

## Evidence

- `libs/ui/registry/ui/stepper/stepper-content.tsx`

## User Impact

Keyboard users can tab into visually hidden content.

## Fix

Mirror accordion-style collapsed content handling: use `inert` while collapsed and restore interactivity when expanded.

## Acceptance Criteria

- Collapsed content cannot receive focus.
- Expanded content works normally.

## Verification

- Tab test with a focusable child inside collapsed content.

