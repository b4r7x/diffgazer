# QLT-003 - composeRefs is not React 19 callback-ref-cleanup aware

**Area**: refs  
**Severity**: Medium  
**Effort**: Medium  
**Status**: Open

## Problem

`composeRefs` does not preserve cleanup functions returned by callback refs and is often used inline, creating new callbacks on every render.

## Evidence

- `libs/ui/registry/lib/compose-refs.ts`
- Ref composition appears in popover, select, and overlay-related components.

## User Impact

Consumer callback ref cleanup can be lost, and unnecessary detach/attach cycles can occur.

## Fix

- Add `useComposedRefs`.
- Preserve callback ref cleanup functions.
- Use memoized composed refs in components.

## Acceptance Criteria

- Callback ref cleanup is called correctly.
- Composed ref identity is stable when inputs are stable.

## Verification

- Unit tests for callback cleanup.
- Component ref lifecycle test.

