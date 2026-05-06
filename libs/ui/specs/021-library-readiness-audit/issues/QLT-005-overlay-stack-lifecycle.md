# QLT-005 - Overlay lifecycle is not stack-safe

**Area**: Dialog, popover, command palette, toast, presence  
**Priority**: P2  
**Severity**: High  
**Effort**: Medium/Large

## Problem

Overlays do not share a stack model. Outside-click and Escape handling can affect multiple layers, presence can remain stuck if no animation event fires, and dialog labeling/focus restore is fragile.

## Evidence

- `libs/ui/registry/ui/popover/popover-content.tsx:69` wires outside click at content level.
- `libs/ui/registry/hooks/use-outside-click.ts:19` checks only the given root.
- `libs/ui/registry/ui/popover/use-popover-behavior.ts:82` listens for Escape on document.
- `libs/ui/registry/ui/menu/menu.tsx:70` has separate key handling.
- `libs/ui/registry/ui/toast/use-toast-container.ts:20` has separate Escape dismissal.
- `libs/ui/registry/hooks/use-presence.ts:21` enters closing and waits for animation end.
- `libs/ui/registry/hooks/use-presence.ts:25` only handles `animationend`.
- `libs/ui/registry/ui/dialog/dialog-content.tsx:60` can point `aria-labelledby` at a missing/generated title.
- `libs/ui/registry/ui/command-palette/command-palette-content.tsx:35` captures restore focus after open effects.

## User Impact

Nested overlays can close ancestors unexpectedly; Escape can dismiss more than one thing; closing overlays can remain mounted; dialogs can be unnamed.

## Fix

Add a top-layer overlay manager using `event.composedPath()` for outside clicks and LIFO Escape handling. Add animation cancel/fallback timeout to presence. Track mounted dialog title before setting generated `aria-labelledby`; honor explicit labels. Capture focus restore target before opening.

## Acceptance Criteria

- Nested popovers/dialogs close one layer at a time.
- Closing completes without `animationend`.
- Dialogs have valid accessible names.
- Focus returns to the opener.

## Verification

Tests for nested popovers, popover inside dialog, menu inside dialog, toast with overlay, missing animations, dialog title/aria-label variants, and browser-level focus restore.

