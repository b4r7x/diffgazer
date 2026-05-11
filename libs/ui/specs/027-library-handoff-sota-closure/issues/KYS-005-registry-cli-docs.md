# KYS-005: Keys Registry, CLI, Docs, And Examples Handoff

Priority: P0

## Problem

Keys handoff surfaces are not equivalent across package, copy, CLI, docs, and generated demo data.

Known gaps:

- Sequential `dgadd add keys/focus-trap`, then `dgadd add keys/focus-restore` can fail to add explicit ownership for `keys/focus-restore`.
- `focus-trap` mixes dependency metadata with inlined `focus-restore` files.
- Docs describe `useKey`, `useScope`, `useScopedNavigation`, and `useFocusZone` as first-class, but registry copy mode only exposes a smaller subset.
- Generated demo imports can point at nonexistent `registry/examples/keys/...` paths.
- `useFocusZone` docs claim a `tabCycle` default that implementation does not provide.
- Scope docs describe active scope as strictly "last pushed", while implementation orders by React `useId` or imperative order.
- Docs omit accepted `useScope(null)`.
- API utilities docs omit public navigation direction helpers.
- Playground React dependency does not meet `@diffgazer/keys` peer requirement.
- Registry examples import UI components heavily, sometimes hiding the keys primitive being taught.

Evidence:

- `cli/add/src/commands/add.ts`
- `cli/add/src/commands/cli-behavior.test.ts`
- `libs/keys/registry/registry.json`
- `libs/keys/public/r/*.json`
- `libs/keys/scripts/build-docs-data.ts`
- `libs/keys/docs/**`
- `libs/keys/registry/hook-docs/**`
- `libs/keys/registry/examples/**`
- `libs/keys/examples/playground/package.json`

## Required Fix

- Fix sequential CLI ownership adoption only when the skipped file is already manifest-owned by trusted Diffgazer item(s) with matching integrity.
- Resolve `focus-trap` dependency duplication: either self-contained without dependency metadata or dependency-owned files only in dependency item.
- Decide and document registry surface:
  - either add provider-backed registry entries for `useKey`, `useScope`, `useScopedNavigation`, `useFocusZone`;
  - or clearly mark those APIs as package-only.
- Fix generated demo path generation.
- Correct docs/examples to match implementation.
- Update public `/r` files after source registry changes.

## Tests

Add CLI tests for:

- sequential overlapping keys add/remove ownership;
- same-command overlapping keys add/remove ownership;
- rejecting adoption of arbitrary pre-existing local files;
- removing one key does not delete files still owned by another key.

Run:

```bash
pnpm --filter @diffgazer/add test
pnpm --filter @diffgazer/add type-check
pnpm --filter @diffgazer/keys validate:registry
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
```
