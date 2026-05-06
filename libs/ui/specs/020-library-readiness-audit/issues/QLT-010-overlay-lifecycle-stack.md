# QLT-010 - Overlay lifecycle and dismissal are not stack-safe

**Area**: Dialog, Popover, Toast, Command Palette  
**Severity**: High  
**Effort**: Medium to Large  
**Status**: Open

## Problem

Overlay lifecycle can depend on `animationend`, and dismiss handlers are not stack-aware. Nested overlays can close together or restore focus incorrectly.

## Evidence

- `libs/ui/registry/hooks/use-presence.ts`
- `libs/ui/registry/hooks/use-outside-click.ts`
- `libs/ui/registry/ui/popover/use-popover-behavior.ts`
- `libs/ui/registry/ui/shared/dialog-shell.tsx`
- `libs/ui/registry/ui/toast/use-toast-container.ts`
- `libs/ui/registry/ui/command-palette/command-palette-content.tsx`

## User Impact

Overlays can get stuck, close the wrong layer, or restore focus to the wrong element.

## Fix

- Add presence fallback timeout or computed duration fallback.
- Handle `animationcancel`.
- Add a top-layer overlay manager for Escape and outside pointer events.
- Capture focus restore target before opening.

## Acceptance Criteria

- Closing does not rely solely on animation events.
- Nested overlays dismiss one layer at a time.
- Focus restore target is correct.

## Verification

- Nested overlay tests.
- Reduced-motion/no-animation tests.
- Focus restore tests.

