# QLT-007: Display and navigation primitives have edge-case behavior gaps

Area: Display primitives / navigation widgets / accessibility
Severity: P2
Effort: Small/Medium

## Problem

Several smaller display/navigation primitives have focused a11y or behavior gaps that should be fixed before calling the component set SOTA.

## Evidence

- `BlockBar` with custom `BlockBar.Segment` children can visually fill while reporting `aria-valuenow=0`: `libs/ui/registry/ui/block-bar/block-bar.tsx:43`, `libs/ui/registry/ui/block-bar/block-bar.tsx:89`.
- `ScrollArea` Page/Home/End keys always mutate `scrollTop`, even in horizontal mode: `libs/ui/registry/ui/scroll-area/scroll-area.tsx:66`.
- `useImageStatus` updates React state during render on `src` changes: `libs/ui/registry/ui/avatar/use-image-status.ts:9`.
- Disabled Sidebar render-prop items can still navigate because built-in anchor guards are not provided to render props: `libs/ui/registry/ui/sidebar/sidebar-item.tsx:91`, `libs/ui/registry/ui/sidebar/sidebar-item.tsx:110`.
- Non-collapsible accordion headers marked `aria-disabled` can be skipped by roving arrow navigation even though they remain focusable: `libs/ui/registry/ui/accordion/accordion.tsx:50`, `libs/ui/registry/hooks/use-navigation.ts:116`.

## User Impact

Screen reader output, keyboard behavior, and custom link integrations can diverge from visible state and expected widget semantics.

## Fix

Fix each edge case directly:

- Derive/require `BlockBar` value for custom children.
- Make `ScrollArea` Page/Home/End respect orientation.
- Move avatar source reset out of render.
- Provide guarded render-prop click/disabled props for Sidebar items.
- Let accordion distinguish truly disabled items from non-collapsible active headers.

## Acceptance Criteria

- `BlockBar` custom children produce correct meter state or missing explicit value is rejected.
- Horizontal `ScrollArea` Page/Home/End update `scrollLeft`, not `scrollTop`.
- Avatar `src` changes reset without render-phase state updates.
- Disabled render-prop Sidebar links do not navigate.
- Accordion arrow navigation includes non-collapsible active headers and skips truly disabled items.

## Verification

- Add focused behavior/a11y tests for each affected component.
- Run `pnpm --filter @diffgazer/ui test`.

