# QLT-022 - ScrollArea creates unnamed keyboard tab stops

**Area**: accessibility, display primitives  
**Severity**: Medium  
**Effort**: Small  
**Status**: Open

## Problem

`ScrollArea` is keyboard focusable by default, but it only receives `role="region"` when the caller supplies an accessible name. That creates focus stops that keyboard and screen-reader users can reach without a role or label explaining what the region is.

## Evidence

- `libs/ui/registry/ui/scroll-area/scroll-area.tsx:23` defaults `keyboardScrollable` to `true`.
- `libs/ui/registry/ui/scroll-area/scroll-area.tsx:30` sets `role` only when `aria-label` or `aria-labelledby` exists.
- `libs/ui/registry/ui/scroll-area/scroll-area.tsx:85` sets `tabIndex={0}` whenever `keyboardScrollable` is true.

## User Impact

Keyboard users encounter extra tab stops with no accessible context. Screen-reader users may hear an unlabeled generic focus target rather than a named scrollable content area.

## Fix

Require an accessible name when `keyboardScrollable` is true, or make `keyboardScrollable` opt-in for unnamed regions. The component should either render a named `region` or avoid adding a tab stop.

## Acceptance Criteria

- Focusable `ScrollArea` instances always have an accessible role and name.
- Unnamed `ScrollArea` instances are not focusable by default.
- Consumers can intentionally opt into a named scrollable region through `aria-label` or `aria-labelledby`.

## Verification

- Add behavior tests for named and unnamed `ScrollArea` variants.
- Add an accessibility regression test for components that embed `ScrollArea`, including code blocks, TOC/sidebar surfaces, and scrollable panels.
