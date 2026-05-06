# QLT-011 - Hook state contracts have stale update paths

**Area**: Hooks and controlled state  
**Priority**: P2  
**Severity**: Medium  
**Effort**: Small/Medium

## Problem

Several hooks have stale state/dependency or controlled-state edge cases.

## Evidence

- `libs/ui/registry/hooks/use-controllable-state.ts:24` resolves controlled/uncontrolled state.
- `libs/ui/registry/hooks/use-controllable-state.ts:35` can call `onChange` for no-op updates.
- `libs/ui/registry/hooks/use-listbox.ts:99` collapses controlled `null` highlight into uncontrolled behavior.
- `libs/ui/registry/ui/radio/radio-group.tsx:77`, `checkbox/checkbox-group.tsx:70`, and `toggle-group/toggle-group.tsx:71` pass `?? undefined` style highlight values.
- `libs/keys/src/hooks/use-key.ts:57` serializes keys with commas.
- `libs/keys/src/hooks/use-key.ts:72` splits by comma, breaking comma hotkeys.
- `libs/keys/src/hooks/use-focus-trap.ts:27` and `:67` omit ref dependencies.
- `libs/ui/registry/hooks/use-active-heading.ts:111` and `:216` can leave option changes stale until scroll/resize.

## User Impact

Consumers can receive duplicate/no-op changes, lose controlled “no highlight” state, fail comma hotkeys, keep focus traps on old refs, or see stale active headings.

## Fix

Skip no-op state updates with `Object.is`, preserve controlled `null`, avoid comma join/split key serialization, include ref dependencies in focus trap, and schedule active-heading recalculation when calculation options change.

## Acceptance Criteria

- No-op interactions do not call change handlers.
- Controlled `null` highlight remains controlled.
- `useKey(",", handler)` and `useKey("Ctrl+,", handler)` work.
- Focus trap updates when refs change.
- Active heading recalculates on option changes.

## Verification

Hook-level tests plus public component tests through Radio, ToggleGroup, Select, active heading, and keys package hooks.

