# QLT-020 - Test coverage misses high-risk behavior

**Area**: tests  
**Severity**: High  
**Effort**: Medium to Large  
**Status**: Open

## Problem

The test base covers many core widgets but does not yet provide release-grade confidence for high-risk behavior.

## Evidence

Known gaps from the audit:

- public UI dirs without component tests;
- live-DOM hooks with shallow observer/resize coverage;
- overlay outside-click and focus-flow gaps;
- weak assertions that check callbacks rather than visible/focus/ARIA outcomes;
- inert ResizeObserver/MutationObserver/matchMedia mocks.

Relevant areas:

- `libs/ui/vitest.config.ts`
- `libs/ui/registry/testing`
- `libs/ui/testing`
- `libs/ui/registry/hooks/testing`
- `libs/ui/registry/ui/*/*.test.tsx`

## User Impact

Regressions in layout, focus, overlays, and copied component behavior can ship undetected.

## Fix

- Add high-risk behavior tests before low-risk styling tests.
- Add controllable observer/media helpers.
- Assert user-visible outcomes: role, name, focus, value, ARIA, form data.

## Acceptance Criteria

- High-risk untested components have contract tests.
- Live-DOM hooks test observer callbacks and cleanup.
- Overlay focus and dismiss behavior is tested.

## Verification

- Registry test suite.
- Coverage map for public component dirs.

