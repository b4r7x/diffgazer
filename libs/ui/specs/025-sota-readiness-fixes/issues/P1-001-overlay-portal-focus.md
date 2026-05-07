# P1-001: Overlay portal scope and modal focus lifecycle are not correct

Area: Dialog / CommandPalette / nested overlays / portal / focus restore
Severity: P1
Effort: Medium

## Problem

Nested overlays inside modal surfaces can escape the modal container, and command palette focus restore can run while the native dialog is still open. A dialog rendered closed first can also lose its scoped portal container after it opens later.

## Evidence

- `DialogContent` stores `shellRef.current` once, so closed-first render can leave the provider with `null` and nested portals fall back to `body`: `libs/ui/registry/ui/dialog/dialog-content.tsx`.
- `CommandPaletteContent` does not provide a nested portal container for popovers/tooltips/selects rendered inside the command palette: `libs/ui/registry/ui/command-palette/command-palette-content.tsx`.
- Command palette focus restore runs in a layout effect before `DialogShell` closes the native modal: `libs/ui/registry/ui/command-palette/command-palette-content.tsx`, `libs/ui/registry/ui/shared/dialog-shell.tsx`.
- `DialogShell` should not call `showModal()` outside the intended open/present state.

## User Impact

Nested overlays can render behind or outside modal top-layer behavior, focus can be restored to an inert page while the dialog is still open, and closed-first dialogs can behave differently from initially-open dialogs.

## Fix

- Make scoped portal ownership live in `DialogShell` or another single owner that updates from a callback ref.
- Distinguish "no provider" from "provider exists but container is not ready" so nested portals do not fall back to `body` inside a pending modal provider.
- Ensure `CommandPaletteContent` uses the same scoped portal behavior as `DialogContent`.
- Move command palette focus restore to after native dialog close, or delegate restore to `DialogShell` with a clear close lifecycle callback.
- Guard `showModal()` by both `open` and `present`.

## Acceptance Criteria

- Dialog rendered closed first, then opened, keeps nested portals inside the dialog container.
- Command palette nested Popover/Tooltip/Select portals render inside the modal dialog tree.
- Focus restores only after the native dialog is closed.
- Existing dialog/popover/tooltip behavior remains unchanged for non-modal usage.
- No new global portal fallback is introduced inside a modal provider.

## Verification

- Add tests for closed-first dialog portal containment.
- Add tests for command palette nested portal containment.
- Add tests for focus restore ordering after close.
- Run relevant overlay tests and `@diffgazer/ui` type-check.

