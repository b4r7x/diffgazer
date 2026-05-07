# QLT-005: Overlay Semantics And Global Listener Handling Need Hardening

Area: Overlays, focus, global listeners

Severity: P2

Effort: M

## Problem

Overlay primitives are close but still have focus-role mismatches, weak outside-click coverage, and stale-effect patterns.

## Evidence

- `libs/ui/registry/ui/popover/popover-content.tsx:97-128` can render a non-modal click popover as `role="dialog"` while trapping Tab and not requiring a clear accessible name.
- `libs/ui/registry/hooks/use-outside-click.ts:124` and `libs/ui/registry/hooks/use-outside-click.ts:137` use render-time latest-handler refs and listen only to `mousedown`.
- `libs/ui/registry/ui/dialog/dialog-description.tsx:12` has effect dependency risk.
- `libs/ui/registry/ui/command-palette/command-palette-item.tsx:43` has register/unregister effect dependency risk.
- `libs/ui/registry/ui/popover/use-popover-behavior.ts:75` has hover timer behavior that is under-tested.

## User Impact

Popover users can get unexpected focus traps, unnamed dialogs, missed touch/pointer outside interactions, or stale registrations under StrictMode.

## Fix

Align overlay modes to explicit semantics and update global listener hooks.

Concrete fix:

- Separate non-modal popover, modal/dialog popover, and tooltip-like hover behavior.
- Only use `role="dialog"` when the content has dialog semantics and an accessible name.
- Use pointer events for outside interactions and test touch/pointer/mouse paths.
- Replace latest-handler refs with `useEffectEvent` or commit-phase updates.
- Fix effect dependencies for registrations and descriptions.

## Acceptance Criteria

- Click popover semantics match documented behavior and do not trap focus unexpectedly.
- Dialog-like overlays require accessible names.
- Outside-click behavior works for pointer, mouse, touch, and portal boundaries.
- StrictMode does not duplicate stale registrations.

## Verification

- Add role/name tests for popover modes.
- Add pointer/touch outside-click tests.
- Add StrictMode tests for command palette registrations.
- Add timer cleanup tests for hover popover.

