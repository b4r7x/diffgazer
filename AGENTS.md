# Repository Agent Rules

## Public UI API

- Public value controls use `value`, `defaultValue`, and `onChange(value)`.
- Native wrappers that render native form elements keep native React event handlers, for example `Input onChange(event)` and `Textarea onChange(event)`.
- Non-value state keeps semantic callback names: `open`/`onOpenChange`, `highlighted`/`onHighlightChange`, `selectedId`/`onSelect`, and `onNavigate`.
- Do not add deprecated aliases before the first public customer-facing release. Rename the API and update all docs, examples, registry files, generated bundles, and app consumers.

## Form Primitives

- `Input` is the bare native input wrapper.
- `InputGroup` is only a decorated input shell for prefix/suffix content.
- `Field` owns form wiring: label, control id, required, disabled, invalid, description, error, and ARIA relationships.
- Do not turn decorated inputs into form fields. Compose `Field` with `Input`, `InputGroup`, `Textarea`, `Select`, or another control.

## Testing

- Test user-visible behavior and accessibility contracts.
- Prefer role/label/text queries over implementation details.
- Do not assert Tailwind class names unless the class is explicitly the public API.

## Generated Artifacts

- Do not commit deterministic generated data under `libs/ui/docs/generated`, `libs/keys/docs/generated`, or `cli/add/src/generated`.
- Keep public registries under `libs/ui/public/r` and `libs/keys/public/r` committed; they are the reviewable registry contract.
- Run `pnpm run prepare:artifacts` before artifact validation, docs sync, root type-check, root tests, or release checks when generated files are missing or stale.
