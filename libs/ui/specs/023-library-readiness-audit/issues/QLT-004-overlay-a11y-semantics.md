# QLT-004: Overlay And Composite A11y Semantics Need Hardening

Area: Overlays and composite widgets

Severity: Medium

Priority: P2

Effort: M

## Problem

Several overlay/composite details are below APG-grade polish: modal dialogs omit `aria-modal`, menu Tab does not close, menu autoFocus can land with no active item, non-modal popover can trap focus, and composite accessible names are optional.

## Evidence

- `libs/ui/registry/ui/shared/dialog-shell.tsx:53` renders the dialog shell without explicit `aria-modal="true"` for modal cases.
- `libs/ui/registry/ui/menu/menu.tsx:96` handles Escape but not Tab/Shift+Tab close behavior.
- `libs/ui/registry/ui/menu/menu.tsx:106` can focus the menu container without initializing an active item.
- `libs/ui/registry/ui/popover/popover-content.tsx:117` can trap focus for `role="dialog"` while not being modal.
- `libs/ui/registry/ui/tabs/tabs-list.tsx:45`, `navigation-list.tsx:98`, `menu.tsx:132`, and `radio-group.tsx:129` allow unnamed composites.
- `libs/ui/registry/ui/menu/menu-divider.tsx:10` omits explicit separator orientation.

## User Impact

Keyboard and screen-reader users can encounter stale popups, ambiguous composite names, focus traps that do not match modal state, or menus with no immediately actionable active item.

## Fix

Align each overlay with a single APG contract. Add `aria-modal` for modal dialogs, close menus on Tab without preventing focus movement, initialize auto-focused menus to the first enabled item, and require or document accessible names for composites.

## Acceptance Criteria

- Modal Dialog and CommandPalette expose `aria-modal="true"` while open.
- Menu Tab and Shift+Tab call `onClose` without blocking focus movement.
- Auto-focused Menu sets `aria-activedescendant` to the first enabled item.
- Popover dialog mode is either modal with modal semantics or non-modal without Tab trap.
- Public examples show named composites.

## Verification

Add RTL/user-event tests for Dialog, CommandPalette, Menu, Popover, and composite names. Keep axe tests passing.

