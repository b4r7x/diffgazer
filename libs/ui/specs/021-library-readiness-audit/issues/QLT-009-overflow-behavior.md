# QLT-009 - Overflow measurement and trigger semantics can go stale

**Area**: Overflow components and hooks  
**Priority**: P2  
**Severity**: Medium  
**Effort**: Medium

## Problem

Overflow measurement can become stale or negative after content/item changes, and non-overflowing text can still be announced as a button through disabled tooltip trigger semantics.

## Evidence

- `libs/ui/registry/hooks/use-overflow.ts:23` measures overflow state.
- `libs/ui/registry/hooks/use-overflow-items.ts:45` calculates visible count.
- `libs/ui/registry/hooks/use-overflow-items.ts:80` can produce stale counts.
- `libs/ui/registry/ui/overflow/overflow-text.tsx:48` wraps text in a tooltip trigger path.
- `libs/ui/registry/ui/popover/popover-trigger.tsx:113` assigns trigger semantics.

## User Impact

Overflow counts/tooltips can be wrong, and plain non-overflowing text can be exposed as interactive.

## Fix

Remeasure on relevant content/item changes, clamp counts to `[0,itemCount]`, observe item/indicator resize, disconnect observers reliably, and avoid rendering tooltip trigger semantics when not overflowing.

## Acceptance Criteria

- Overflow count is never negative.
- Measurement updates after text change, child removal, and indicator width change.
- Short non-overflowing text has no button role.

## Verification

Controllable `ResizeObserver` tests, child mutation tests, observer cleanup tests, and role assertions for short/overflowing text.

