# 03 — Registry And CLI Handoff

> Implement only this brief. Do not run git add/commit/stage/stash.

## Goal

Harden `libs/registry` and `cli/add` so all three public paths are validated and `dgadd` has a clean first-release contract.

## Required Skills

- `/code-audit`
- `/clean-code`
- `/code-quality`
- `/anti-slop`
- `/sota`
- `/test-behavior-not-implementation`

## Required Reading

- `AGENTS.md`
- `libs/registry/src/registry-types.ts`
- `libs/registry/src/testing/shadcn.test.ts`
- `libs/registry/src/testing/copy-bundle.test.ts`
- `cli/add/README.md`
- `cli/add/src/commands/add.ts`
- `cli/add/src/commands/remove.ts`
- `cli/add/src/commands/cli-behavior.test.ts`
- `cli/add/src/utils/namespaces.ts`
- `cli/add/src/utils/add-integration.ts`
- `cli/add/src/utils/integration.ts`
- `scripts/monorepo/smoke-cli.mjs`
- `scripts/monorepo/smoke-package-install.mjs`

## Write Ownership

```text
libs/registry/src/**
cli/add/src/**
cli/add/scripts/**
cli/add/README.md
scripts/monorepo/smoke-cli.mjs
scripts/monorepo/smoke-package-install.mjs
scripts/monorepo/smoke-shadcn-install.mjs
package.json
```

## Required Behavior

### Part A: No pre-release bare aliases unless blessed

Remove bare UI aliases such as `dgadd add button` before public release unless the team explicitly decides they are public API.

Expected public install names:

```text
ui/<item>
keys/<item>
```

Update docs and tests accordingly. If bare aliases are removed, add rejection tests.

### Part B: Direct shadcn smoke

Add a direct shadcn smoke gate that:

1. serves `libs/ui/public/r` and `libs/keys/public/r`,
2. creates a clean fixture with both namespaces,
3. installs representative items,
4. type-checks/builds the fixture,
5. verifies CSS for CSS-heavy components.

Representative items:

```text
@diffgazer-keys/navigation
@diffgazer-keys/focus-trap
@ui/dialog
@ui/popover
@ui/select
@ui/block-bar
@ui/diff-view
```

### Part C: Schema compatibility

Local registry schema should preserve and validate relevant shadcn fields that may be needed for public registry compatibility:

- `devDependencies`
- `cssVars`
- `css`
- `envVars`
- `docs`
- `categories`
- `author`

Do not add behavior for fields that are not used, but do not silently strip future public metadata.

### Part D: Dependency install behavior

Add `dgadd` smoke coverage without `--skip-install` for:

- core UI dependencies,
- `--integration copy`,
- `--integration keys`,
- local tarball/package override for `@diffgazer/keys` before public publish.

### Part E: Remove unreachable/dead integration branches

Audit `resolveIntegrations` and warning paths. If `none` is rejected for keyboard-required components, remove unreachable warnings or make `none` a real supported mode with tests. Prefer removal unless there is a strong use case.

## Tests

Add or update:

- CLI rejection tests for removed aliases,
- dependency install smoke,
- shadcn direct smoke,
- schema preservation tests,
- remove/list/diff ownership tests if install metadata changes.

## Verification

```bash
pnpm --filter @diffgazer/registry test
pnpm --filter @diffgazer/registry type-check
pnpm --filter @diffgazer/add test
pnpm --filter @diffgazer/add type-check
pnpm run smoke:cli
pnpm run smoke:packages
pnpm run validate:artifacts:check
git diff --check
```

