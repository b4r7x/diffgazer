# QLT-010 - Display primitives have robustness and bundle issues

**Area**: Display primitives  
**Priority**: P2  
**Severity**: Medium/High  
**Effort**: Medium

## Problem

Several display primitives have edge-case robustness issues or unnecessary client/runtime cost.

## Evidence

- `libs/ui/registry/ui/block-bar/block-bar.tsx:39`, `:48`, `:53`, and `:64` can emit invalid meter values or crash on invalid width/value inputs.
- `libs/ui/registry/ui/avatar/avatar.tsx:68` and `:74` plus `avatar-fallback.tsx:36`/`:40` make fallback image failure and accessible naming fragile.
- `libs/ui/registry/ui/badge/badge.tsx:1`, `card/card.tsx:1`, `panel/panel.tsx:1`, `divider/divider.tsx:1`, and `typography/typography.tsx:1` mark pure display primitives as client components.
- `libs/ui/registry/ui/logo/logo.tsx:1` is a client component.
- `libs/ui/registry/ui/logo/get-figlet-text.ts:1` imports `figlet`.
- `libs/ui/registry/ui/divider/divider.tsx:46`/`:54` can expose decorative text.

## User Impact

Display-only imports can increase client bundles, meters can expose invalid values, Avatar can render no fallback, and decorative dividers can be announced.

## Fix

Clamp/sanitize BlockBar values and widths, fix Avatar fallback failure/naming, remove client directives from true static primitives, split/precompute Logo figlet text or make dynamic logo opt-in, and hide decorative Divider text when decorative.

## Acceptance Criteria

- Invalid BlockBar inputs do not throw or expose invalid ARIA.
- Avatar has stable visible and accessible fallback content.
- Static primitives can be imported from Server Components.
- Static Logo does not force figlet into client chunks.
- Decorative Divider has no accessible text.

## Verification

Unit tests for BlockBar/Avatar/Divider, Next RSC fixture for static primitives, and bundle analysis for Logo.

