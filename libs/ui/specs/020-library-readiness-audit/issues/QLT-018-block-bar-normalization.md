# QLT-018 - BlockBar meter values and names are not normalized

**Area**: BlockBar  
**Severity**: Medium to High  
**Effort**: Small to Medium  
**Status**: Open

## Problem

BlockBar can produce invalid meter values if `value`, segment sums, `max`, or `barWidth` are not normalized. Custom children can also drop accessible names.

## Evidence

- `libs/ui/registry/ui/block-bar/block-bar.tsx`

## User Impact

Assistive tech receives invalid meter semantics and layout can break on invalid dimensions.

## Fix

- Clamp `value` into `[0, max]`.
- Sanitize `max > 0`.
- Clamp `barWidth`.
- Preserve accessible name unless explicitly overridden.

## Acceptance Criteria

- Meter values are always valid.
- Custom children keep an accessible name by default.

## Verification

- Edge-case tests for negative/over-max values and custom children.

