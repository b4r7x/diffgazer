# Agent 04: UI Public API And Form Contracts

Model: Opus 4.7
Mode: implementation

## Required Skills

Load before work:

- `$sota`
- `$code-audit`
- `architecture`
- `clean-code`
- `code-quality`
- `anti-slop`
- `test-behavior-not-implementation`
- `typescript-expert`
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`

## Write Ownership

Primary:

- `libs/ui/registry/ui/field/**`
- `libs/ui/registry/ui/input/**`
- `libs/ui/registry/ui/textarea/**`
- `libs/ui/registry/ui/select/select.tsx`
- `libs/ui/registry/ui/select/select-trigger.tsx`
- `libs/ui/registry/ui/radio/**`
- `libs/ui/registry/ui/checkbox/**`
- `libs/ui/registry/ui/callout/**`
- `libs/ui/registry/ui/navigation-list/**`
- `libs/ui/registry/ui/menu/**`
- `libs/ui/registry/ui/command-palette/use-command-palette-state.ts`
- affected tests/docs/examples/app consumers

Coordinate before touching:

- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/ui/registry/ui/select/select-content.tsx`
- generated artifacts

## Issues

- `../issues/UI-001-public-api-contract.md`
- `../issues/UI-002-field-select-form.md`

## Requirements

- Rename public highlight APIs to `highlighted/defaultHighlighted/onHighlightChange`.
- Rename `Callout visible/defaultVisible/onVisibleChange` to `open/defaultOpen/onOpenChange`.
- Resolve standalone `Checkbox` and `Radio` public value API before release.
- Remove or relocate `error`/`invalid` props from native wrappers if they violate Field ownership.
- Make `Field.Control + Select` accessible.
- Fix stale Label docs.
- Update all app consumers, tests, docs, examples, registry metadata, and public artifacts.

## Tests

Add tests for:

- renamed public APIs;
- no deprecated aliases accepted unless explicitly approved;
- `Field + Select` accessible name/describedby/invalid/required/disabled;
- native `Input` and `Textarea` still expose native `onChange(event)`;
- `Field` owns error/description wiring.

## Verification

Run:

```bash
pnpm --filter @diffgazer/ui test -- field input textarea select radio checkbox callout navigation-list menu command-palette
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/web type-check
```

Also run a grep for stale public API names and report intentional internal-only matches.
