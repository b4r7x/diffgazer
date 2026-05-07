# Agent 02: Accessibility, Forms, and IDREFs

Model: `gpt-5.5`
Reasoning: medium
Mode: implementation

## Objective

Fix P1 accessibility issues in ToggleGroup, form controls, CommandPalette IDs, and public listbox ID/value semantics.

## Write Ownership

Primary:

- `libs/ui/registry/ui/toggle-group/toggle-group.tsx`
- `libs/ui/registry/ui/toggle-group/toggle-group.test.tsx`
- `libs/ui/registry/ui/checkbox/checkbox.tsx`
- `libs/ui/registry/ui/checkbox/checkbox-group.tsx`
- `libs/ui/registry/ui/checkbox/checkbox.test.tsx`
- `libs/ui/registry/ui/radio/radio.tsx`
- `libs/ui/registry/ui/radio/radio-group.tsx`
- `libs/ui/registry/ui/radio/radio.test.tsx`
- `libs/ui/registry/ui/select/select.tsx`
- `libs/ui/registry/ui/select/select-trigger.tsx`
- `libs/ui/registry/ui/select/select-utils.ts`
- `libs/ui/registry/ui/select/select.test.tsx`
- `libs/ui/registry/ui/command-palette/command-palette-input.tsx`
- `libs/ui/registry/ui/command-palette/command-palette-item.tsx`
- `libs/ui/registry/ui/command-palette/use-command-palette-state.ts`
- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/ui/registry/hooks/testing/use-listbox.test.tsx`

Coordinate before touching:

- `libs/ui/registry/ui/command-palette/command-palette-content.tsx`
- generated `libs/ui/public/r/*.json`
- generated `libs/ui/docs/generated/**/*.json`

## Requirements

- Read `spec.md` and issue `P1-002`.
- You are not alone in the codebase. Do not revert user or other-agent edits.
- Remove invalid ARIA combinations.
- Preserve `FormData` behavior.
- Make required/invalid semantics target visible accessible controls where supported.
- Encode DOM IDs separately from public values.
- Treat empty string as a real value where the component supports it.
- Add focused behavior tests.

## Acceptance Criteria

- ToggleGroup `allowDeselect` has no invalid `aria-orientation`.
- Required Checkbox, Radio, and Select have coherent accessible invalid behavior and form output.
- CommandPalette IDREFs are DOM-safe and unique.
- `useListbox` special values have safe behavior.

## Verification

Run focused tests for touched components/hooks and report results.

