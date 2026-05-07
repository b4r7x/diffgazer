# QLT-003: Custom form controls have split accessibility and native validity ownership

Area: Accessibility / forms / Select
Severity: P1
Effort: Medium/Large

## Problem

Checkbox, radio, and Select use visible custom widgets plus hidden native controls for form/validity behavior. Required/validation semantics can be owned by offscreen controls while users interact with visible ARIA widgets.

## Evidence

- Checkbox hidden native form controls and required handling: `libs/ui/registry/ui/checkbox/checkbox.tsx:108`, `libs/ui/registry/ui/checkbox/checkbox.tsx:123`, `libs/ui/registry/ui/checkbox/checkbox-group.tsx:110`.
- Radio hidden native form controls and required handling: `libs/ui/registry/ui/radio/radio.tsx:145`, `libs/ui/registry/ui/radio/radio.tsx:160`.
- Select hidden native select/input required behavior: `libs/ui/registry/ui/select/select.tsx:141`.
- Select trigger/listbox also mixes button/listbox and combobox-like expectations: `libs/ui/registry/ui/select/select-trigger.tsx:47`, `libs/ui/registry/ui/select/select-content.tsx:167`, `libs/ui/registry/ui/select/select-search.tsx:45`.

## User Impact

Browser validation can focus or announce an offscreen control instead of the visible widget. Screen reader semantics can be inconsistent, especially in required forms and select-only combobox scenarios.

## Fix

Choose one accessibility owner per control:

- Native owner: style around the native input/select so validity/focus/announcement target the real control.
- Custom owner: keep surrogates out of the accessibility tree and implement visible validation, focus, and error announcement on the custom widget.

For non-search Select, implement one complete APG model rather than mixed button/listbox/combobox behavior.

## Acceptance Criteria

- `reportValidity()` lands on and announces the visible control.
- `FormData` remains correct.
- No validity-owning element is hidden from the accessibility tree.
- Required behavior is consistent with and without `name`.
- Select keyboard/focus semantics match its documented APG model.

## Verification

- Browser-level form validity tests for checkbox, radio, and Select.
- Accessibility tree/focus target assertions.
- Select keyboard matrix: closed trigger, open listbox, typeahead, Home/End, Escape, Tab commit, single/multiple, searchable mode.

