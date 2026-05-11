# Agent 03: Keys Registry, CLI, Docs, And Examples

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

- `cli/add/src/commands/add.ts`
- `cli/add/src/commands/remove.ts`
- `cli/add/src/commands/diff.ts`
- `cli/add/src/commands/cli-behavior.test.ts`
- `cli/add/src/utils/**`
- `libs/registry/src/cli/**`
- `libs/keys/registry/**`
- `libs/keys/public/r/**`
- `libs/keys/docs/**`
- `libs/keys/scripts/**`
- `libs/keys/examples/playground/**`

Coordinate before touching:

- `libs/keys/src/**`
- generated `cli/add/src/generated/**`

## Issues

- `../issues/KYS-005-registry-cli-docs.md`

## Requirements

- Fix sequential overlapping key ownership in `dgadd`.
- Resolve `focus-trap` / `focus-restore` dependency ownership ambiguity.
- Align documented keys APIs with registry/package reality.
- Fix generated demo import paths.
- Correct `tabCycle`, scope ordering, `useScope(null)`, navigation helper docs, and playground peer deps.
- Ensure examples teach keys primitives rather than hiding them behind UI where possible.
- Regenerate public registry artifacts only after source registry changes are final.

## Tests

Add or update CLI tests for:

- same-command overlapping key add/remove;
- sequential overlapping key add/remove;
- adoption only for trusted manifest-owned matching files;
- arbitrary pre-existing files are not adopted silently.

## Verification

Run:

```bash
pnpm --filter @diffgazer/add test
pnpm --filter @diffgazer/add type-check
pnpm --filter @diffgazer/registry type-check
pnpm --filter @diffgazer/keys validate:registry
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
```

Report any generated artifacts that changed.
