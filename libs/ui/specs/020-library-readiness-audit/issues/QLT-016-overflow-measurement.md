# QLT-016 - Overflow measurement can become stale or negative

**Area**: Overflow hooks and components  
**Severity**: Medium  
**Effort**: Medium  
**Status**: Open

## Problem

Overflow measurement can become stale when children shrink, indicator width changes, or data changes. Visible and overflow counts need clamping.

## Evidence

- `libs/ui/registry/hooks/use-overflow-items.ts`
- `libs/ui/registry/ui/overflow/overflow-items.tsx`
- `libs/ui/registry/ui/overflow/overflow-text.tsx`

## User Impact

Overflow indicators can show wrong counts or hide the wrong items.

## Fix

- Clamp visible and overflow counts.
- Remeasure on item list and indicator changes.
- Add controllable ResizeObserver tests.

## Acceptance Criteria

- Overflow count is never negative.
- Data shrink and indicator width changes update layout.

## Verification

- Hook tests with fake widths and resize triggers.

