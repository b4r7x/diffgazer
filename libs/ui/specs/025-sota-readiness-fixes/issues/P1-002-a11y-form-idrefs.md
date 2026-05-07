# P1-002: Form-control accessibility, validity ownership, and IDREF safety are inconsistent

Area: Accessibility / Checkbox / Radio / Select / ToggleGroup / CommandPalette / useListbox
Severity: P1
Effort: Medium/Large

## Problem

Some controls expose invalid ARIA or split native form validity from the visible accessible control. Some public IDs are used directly as DOM IDs or IDREFs without safe encoding.

## Evidence

- ToggleGroup `allowDeselect` can render `role="group"` while also emitting `aria-orientation`: `libs/ui/registry/ui/toggle-group/toggle-group.tsx`.
- Checkbox group sets required semantics on a group while a hidden native checkbox owns required validity: `libs/ui/registry/ui/checkbox/checkbox-group.tsx`.
- Checkbox, Radio, and Select use hidden native controls for `required` or form behavior while visible widgets own interaction: `libs/ui/registry/ui/checkbox/checkbox.tsx`, `libs/ui/registry/ui/radio/radio.tsx`, `libs/ui/registry/ui/select/select.tsx`.
- Select trigger can set required ARIA on a button: `libs/ui/registry/ui/select/select-trigger.tsx`.
- CommandPalette uses public values as DOM `id`, `data-value`, and `aria-activedescendant`: `libs/ui/registry/ui/command-palette/command-palette-item.tsx`, `libs/ui/registry/ui/command-palette/command-palette-input.tsx`, `libs/ui/registry/ui/command-palette/use-command-palette-state.ts`.
- Public `useListbox` can treat empty-string item IDs as absent and has unsafe default ID generation: `libs/ui/registry/hooks/use-listbox.ts`.

## User Impact

Automated accessibility checks can fail, browser validation can target hidden controls instead of visible widgets, screen reader semantics become inconsistent, and IDREFs can collide or point at invalid/missing elements.

## Fix

- Remove invalid ARIA attributes from role combinations. In particular, do not emit `aria-orientation` on `role="group"`.
- For required form controls, make the accessibility owner and validity owner explicit and consistent. If native hidden controls remain only for `FormData`, do not make them the only required/validity target.
- Keep `FormData` behavior correct.
- Encode DOM IDs separately from public values. Public values may contain spaces, slashes, punctuation, or be empty strings.
- Make `useListbox` handle `""` as a valid ID/value where the component contract allows it, and require/derive DOM-safe IDs for IDREFs.

## Acceptance Criteria

- No axe `aria-allowed-attr` failure for `ToggleGroup allowDeselect`.
- Required Checkbox, Radio, and Select have coherent visible focus/invalid semantics and preserve `FormData`.
- Hidden form mirrors are not the only accessibility/validity owners for required custom controls.
- CommandPalette and public listbox IDREFs resolve to unique existing DOM nodes for special values.
- Empty-string value semantics are tested where supported.

## Verification

- Add or update behavior tests for ToggleGroup `allowDeselect` ARIA.
- Add browser-level validity/focus tests for Checkbox, Radio, and Select.
- Add CommandPalette special-value ID tests.
- Add `useListbox` special-value tests.
- Run relevant tests and `@diffgazer/ui` type-check.

