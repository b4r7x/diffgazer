# QLT-003: Select And ToggleGroup APG Semantics Need Rework

Area: Select, listbox, toggle-group semantics

Severity: Medium

Priority: P2

Effort: L

## Problem

Select mixes button/listbox and combobox patterns, and `ToggleGroup allowDeselect` uses toggle-button semantics while arrow keys change pressed state.

## Evidence

- `libs/ui/registry/ui/select/select-trigger.tsx:47` uses a trigger model that does not fully match the select-only combobox APG pattern.
- `libs/ui/registry/ui/select/select-content.tsx:129` mounts listbox/search behavior after open.
- `libs/ui/registry/ui/select/select-search.tsx:45` handles searchable combobox behavior separately.
- `libs/ui/registry/ui/toggle-group/toggle-group.tsx:88` and `libs/ui/registry/ui/toggle-group/toggle-group-item.tsx:79` allow arrow navigation to change pressed state in `allowDeselect` mode.

## User Impact

Screen readers and keyboard users can get inconsistent announcements or accidentally change toggle values while trying to navigate.

## Fix

For Select, choose one complete APG model per mode and align roles, focus, `aria-expanded`, `aria-controls`, and `aria-activedescendant`. For `allowDeselect`, make arrow keys move focus only and reserve Space/Enter/click for activation.

## Acceptance Criteria

- Select-only mode follows one APG combobox/listbox contract end to end.
- Searchable mode is either a combobox from the start or documented as a button plus popup search pattern.
- `allowDeselect` arrows do not call `onValueChange`.
- Space/Enter toggle pressed state.

## Verification

Add keyboard matrix tests for Select closed/open/searchable modes and ToggleGroup `allowDeselect`. Run `pnpm --filter @diffgazer/ui test`.

