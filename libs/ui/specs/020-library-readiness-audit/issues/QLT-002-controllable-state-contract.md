# QLT-002 - useControllableState has controlled undefined and updater side-effect issues

**Area**: controlled/uncontrolled state  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

`useControllableState` uses `controlledValue !== undefined` as a controlled-mode sentinel and can call change callbacks inside a state updater.

That prevents `undefined` from being a valid controlled value and can duplicate callbacks in Strict Mode.

## Evidence

- `libs/ui/registry/hooks/use-controllable-state.ts`
- Affected components include radio group, accordion, select, checkbox group, and toggle group.

## User Impact

Controlled components can become accidentally uncontrolled when the intended value is empty. Uncontrolled callbacks can fire more than once in development.

## Fix

- Detect controlled mode by prop presence or explicit `controlled` flag.
- Keep updater functions pure.
- Normalize empty values consistently.

## Acceptance Criteria

- Empty controlled values are supported intentionally.
- Strict Mode user actions call change handlers once.

## Verification

- Strict Mode callback-count tests.
- Controlled-empty tests for radio and accordion.

