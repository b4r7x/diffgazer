# QLT-007: Shared Navigation And Typeahead Logic Still Duplicates Behavior

Area: Clean code, DRY, behavior reuse

Severity: Medium

Priority: P2

Effort: M

## Problem

Navigation dispatch and typeahead behavior exist in multiple places, creating drift risk. SelectContent also lacks the timeout cleanup present in the shared listbox hook.

## Evidence

- `libs/ui/registry/hooks/use-navigation.ts:57` keeps local direction-key utilities that also exist in keys.
- `libs/keys/src/hooks/use-navigation.ts:9` and `libs/keys/src/hooks/internal/navigation-dispatch.ts:1` contain the keys implementation.
- `libs/ui/registry/hooks/use-listbox.ts:101` implements typeahead with cleanup.
- `libs/ui/registry/ui/select/select-content.tsx:82` duplicates typeahead state/timer behavior without equivalent unmount cleanup.

## User Impact

Keyboard behavior can drift between UI and keys packages. Select and listbox typeahead can diverge, and stale timer work can run after unmount.

## Fix

Use one source for direction-key dispatch. Extract a small shared typeahead buffer hook or move Select onto `useListbox` behavior, with unmount cleanup.

## Acceptance Criteria

- One implementation for direction-key dispatch, or deliberate divergence with tests.
- One typeahead buffer path, or justified divergence.
- SelectContent clears typeahead timers on unmount.

## Verification

Run `pnpm --filter @diffgazer/ui test` and `pnpm --filter @diffgazer/keys test`. Add fake-timer unmount tests for SelectContent.

