# QLT-006: Display Primitive Contracts Need Cleanup

Area: Display primitives, SSR, bundle surface

Severity: P2

Effort: M

## Problem

Several display primitives have small but user-visible contract issues around props, live regions, SSR output, animation, and bundle boundaries.

## Evidence

- `libs/ui/registry/ui/logo/logo.tsx:15` and `libs/ui/registry/ui/logo/logo.tsx:32` expose a `font` prop/contract that does not match behavior.
- `libs/ui/registry/ui/logo/get-figlet-text.ts:1` imports `figlet`; `libs/ui/registry.json:1479` exposes logo registry behavior that makes this surface important.
- `libs/ui/registry/ui/callout/callout.tsx:39-43` uses live-region roles more aggressively than docs imply at `libs/ui/docs/content/component-docs/callout.ts:35`.
- `libs/ui/registry/ui/empty-state/empty-state.tsx:40-52` suppresses SSR/live output until mount.
- `libs/ui/registry/ui/block-bar/block-bar.tsx:70` ignores `label` when custom children are provided.
- `libs/ui/registry/ui/block-bar/block-bar.tsx:50` and `libs/ui/registry/ui/block-bar/block-bar-segment.tsx:46` can normalize/round widths into visual overdraw.
- `libs/ui/registry/ui/spinner/spinner.tsx:51` lacks ref forwarding.
- `libs/ui/registry/ui/spinner/use-spinner-animation.ts:26` can create invalid timing behavior for bad speed values.
- `libs/ui/registry/ui/icons/chevron.tsx:32` and `libs/ui/registry/ui/icons/chevron.tsx:61` do not forward all expected SVG props/reduced-motion behavior.
- `libs/ui/registry/ui/section-header/section-header.tsx:1`, `libs/ui/registry/ui/kbd/kbd.tsx:1`, and `libs/ui/registry/ui/icons/chevron.tsx:1` mark pure primitives as client components unnecessarily.

## User Impact

Consumers can get unexpected bundle weight, noisy announcements, hydration differences, layout glitches, missing refs, or unnecessary client components in server-rendered apps.

## Fix

Tighten each primitive contract and split optional behavior.

Concrete fix:

- Align Logo props with implemented behavior and isolate figlet helpers behind an explicit deep import.
- Make Callout live-region defaults opt-in or severity-specific.
- Render stable SSR output for EmptyState.
- Preserve BlockBar accessible labels with custom children and clamp widths.
- Forward refs and validate speed values in Spinner.
- Forward SVG props and respect reduced motion in Chevron.
- Remove `"use client"` from pure primitives that do not need it.

## Acceptance Criteria

- Display primitive docs match props and runtime behavior.
- Pure primitives are server-safe unless interactivity requires client mode.
- SSR snapshots are stable.
- Animation primitives handle invalid inputs safely.
- Optional heavy helpers do not load through default display imports.

## Verification

- Add SSR tests for Logo, Callout, EmptyState, SectionHeader, Kbd, Chevron.
- Add reduced-motion and invalid-speed tests for Spinner/Chevron.
- Bundle-analyze Logo import paths.
- Add visual/DOM tests for BlockBar labels and width clamping.

