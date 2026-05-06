# QLT-006 - Label and checkbox group semantics do not match custom controls

**Area**: forms, accessibility  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

Label wrapping can label the hidden input rather than the focusable custom checkbox/radio root. Checkbox group `required` can also mean every checkbox is required instead of at least one.

## Evidence

- `libs/ui/registry/ui/label/label.tsx`
- `libs/ui/registry/ui/checkbox/checkbox.tsx`
- `libs/ui/registry/ui/checkbox/checkbox-group.tsx`

## User Impact

Custom controls can be unnamed for assistive tech, and required group validation can be wrong.

## Fix

- Wire labels to focusable custom roots using `aria-labelledby` or explicit label props.
- Decide and implement group-level required semantics.

## Acceptance Criteria

- `getByRole("checkbox", { name })` works for label examples.
- Required checkbox group behavior matches docs.

## Verification

- Label accessibility tests.
- Form validation tests.

