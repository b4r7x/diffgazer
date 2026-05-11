# Agent 07: Registry, Docs, Package Declarations, CSS, And Generated Artifacts

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

- `libs/ui/registry/registry.json`
- `libs/ui/public/r/**`
- `libs/ui/registry/component-docs/**`
- `libs/ui/registry/hook-docs/**`
- `libs/ui/registry/examples/**`
- `libs/ui/docs/**`
- `libs/ui/scripts/**`
- `apps/docs/src/components/docs-mdx/blocks/props-table-block.tsx`
- `libs/ui/package.json`
- `libs/ui/tsup.config.ts`
- `libs/ui/scripts/build-declarations.ts`
- generated artifacts only through documented generation commands

Coordinate before touching:

- runtime component files owned by Agents 04-06
- `cli/add/**`

## Issues

- `../issues/UI-005-registry-docs-package.md`
- docs/artifact parts of `../issues/UI-001-public-api-contract.md`
- docs/artifact parts of `../issues/UI-002-field-select-form.md`
- docs/artifact parts of `../issues/UI-003-overlays-select-apg.md`

## Requirements

- Make props/API reference sections render truthful data.
- Wire CSS/helper files consistently across registry/copy/package modes.
- Fix docs/examples that overpromise unsupported behavior.
- Fix package declaration rewriting to match package JS rewriting.
- Align install docs and npm gating language.
- Remove or make public any hidden examples that teach non-public imports.
- Regenerate and validate artifacts.

## Tests And Validators

Add validators where useful:

- public component docs with props have non-empty API data;
- public examples do not import hidden paths;
- public package declarations do not point to hidden shims unless exported;
- registry dependency closure includes CSS/helper files.

## Verification

Run:

```bash
pnpm run prepare:artifacts
pnpm --filter @diffgazer/ui validate:registry
pnpm --filter @diffgazer/keys validate:registry
pnpm run validate:artifacts:check
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/docs test
```

If docs tests are unavailable or not defined, report the exact package script state.
