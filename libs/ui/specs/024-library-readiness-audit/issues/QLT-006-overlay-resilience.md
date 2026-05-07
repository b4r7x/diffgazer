# QLT-006: Overlay dismissal and browser API resilience need hardening

Area: Dialog / Popover / Tooltip / outside click / floating position
Severity: P2
Effort: Small/Medium

## Problem

Overlay behavior is generally strong, but several edge cases can surprise users or fail in less common browser environments.

## Evidence

- Backdrop click detection checks only `e.target === dialogRef.current`, so clicks in empty dialog chrome can dismiss: `libs/ui/registry/ui/shared/dialog-shell.tsx:57`.
- Outside-click listeners are bubble-phase and can be blocked by app code calling `stopPropagation()`: `libs/ui/registry/hooks/use-outside-click.ts:159`.
- Floating overlays hard-require `ResizeObserver`: `libs/ui/registry/hooks/use-floating-position.ts:205`.

## User Impact

Dialogs/command palettes can dismiss accidentally, popovers can stay open when app code stops propagation, and overlays can throw in embedded/older/unpolyfilled environments.

## Fix

- For dialog backdrop clicks, compare pointer coordinates against `dialog.getBoundingClientRect()`.
- Register document outside-click listeners in capture phase and remove with the same option.
- Guard `ResizeObserver` and still perform initial positioning plus scroll/resize cleanup.

## Acceptance Criteria

- Clicks inside the dialog rect never dismiss; clicks outside do.
- Outside click closes top overlay even when outside target stops propagation.
- Popover/Tooltip opens without `ResizeObserver`.

## Verification

- Dialog/CommandPalette coordinate-based backdrop tests.
- Outside-click tests for pointer/mouse targets that stop propagation.
- Popover test with `globalThis.ResizeObserver` temporarily unset.

