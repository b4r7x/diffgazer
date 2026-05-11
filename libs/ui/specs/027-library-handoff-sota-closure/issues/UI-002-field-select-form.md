# UI-002: Field, Select, And Form Accessibility

Priority: P0

## Problem

Form primitives do not yet provide a consistent, accessible composition contract.

Known gaps:

- `Field.Control` clones id/required/disabled/invalid/description props onto `Select`, but `Select` spreads them onto a wrapper div, not the real combobox trigger.
- Docs promise `Field` can compose with `Select`, but tests do not cover it.
- `Select.Trigger` can default to `aria-label="Select"` instead of receiving the field label relationship.
- Input examples manually wire label/id with `Input` and `Textarea`, conflicting with Field ownership.
- Label docs refer to stale `text` prop; implementation uses `label`.

Evidence:

- `libs/ui/registry/ui/field/field.tsx`
- `libs/ui/registry/ui/select/select.tsx`
- `libs/ui/registry/ui/select/select-trigger.tsx`
- `libs/ui/registry/ui/field/field.test.tsx`
- `libs/ui/registry/examples/input/input-form.tsx`
- `libs/ui/registry/component-docs/field.ts`
- `libs/ui/docs/content/components/field.mdx`
- `libs/ui/registry/component-docs/label.ts`
- `libs/ui/docs/content/components/label.mdx`

## Required Fix

- Make `Field.Control` composition with `Select` actually wire label/control/description/error/invalid to the interactive control.
- Do not turn `InputGroup` into a form field.
- Preserve native `Input` and `Textarea` event contracts.
- Update examples to teach `Field` for labels/errors/descriptions.
- Remove stale docs.

## Tests

Add behavior/accessibility tests:

- `Field + Select` combobox has accessible name from `Field.Label`.
- `aria-describedby` includes description and error on the real interactive control.
- invalid/required/disabled state reaches the correct element.
- `Input`, `Textarea`, and `InputGroup` remain compatible with `Field`.
