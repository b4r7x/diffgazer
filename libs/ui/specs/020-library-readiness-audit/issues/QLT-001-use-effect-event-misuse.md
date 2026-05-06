# QLT-001 - useEffectEvent is used outside its intended React 19 role

**Area**: React 19 hooks  
**Severity**: High  
**Effort**: Large  
**Status**: Open

## Problem

`useEffectEvent` is used as a general stable callback primitive for callbacks returned from hooks, stored in context, or called from JSX/user events.

Effect Events should be kept for non-reactive logic called from effects or effect-installed subscriptions.

## Evidence

Recheck these source areas in `libs/ui/registry`:

- `registry/hooks/use-controllable-state.ts`
- `registry/hooks/use-presence.ts`
- `registry/hooks/use-active-heading.ts`
- `registry/ui/popover/use-popover-behavior.ts`
- `registry/ui/command-palette/use-command-palette-state.ts`
- `registry/ui/accordion/use-accordion-state.ts`
- `registry/ui/checkbox/checkbox-group.tsx`
- `registry/ui/callout/callout.tsx`

## User Impact

Callbacks can violate React semantics, hide dependencies, and behave unpredictably under Strict Mode or concurrent rendering.

## Fix

- Replace public/event/context callbacks with `useCallback` or render-local handlers.
- Keep `useEffectEvent` only for effect-owned listeners, observers, timers, or other Effect Events.
- Update memo dependency arrays after replacing callbacks.

## Acceptance Criteria

- No callback exposed through props, return values, or context uses `useEffectEvent`.
- Effect Events remain only in effect-owned paths.

## Verification

- Static grep for `useEffectEvent`.
- Tests for accordion, popover, command palette, checkbox, callout, presence, and active heading.

