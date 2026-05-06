# QLT-005 - Select mixes listbox and combobox semantics

**Area**: Select accessibility  
**Severity**: Medium to High  
**Effort**: Large  
**Status**: Open

## Problem

Searchable Select mixes a button/listbox model with combobox semantics. A combobox input should not be inside a listbox that is supposed to contain options and groups.

## Evidence

- `libs/ui/registry/ui/select/select-trigger.tsx`
- `libs/ui/registry/ui/select/select-content.tsx`
- `libs/ui/registry/ui/select/select-search.tsx`
- `libs/ui/registry/ui/select/select.tsx`

## User Impact

Screen readers receive an inconsistent widget model. Disabled Select can also diverge from native form behavior if hidden inputs remain enabled.

## Fix

Pick a single APG model:

- select-only combobox/listbox; or
- editable combobox where the input controls the listbox.

Also align hidden form input behavior with disabled state.

## Acceptance Criteria

- Search input is not a combobox inside a listbox.
- Disabled Select submits no hidden values.

## Verification

- A11y tests for searchable Select.
- FormData test for disabled Select.

