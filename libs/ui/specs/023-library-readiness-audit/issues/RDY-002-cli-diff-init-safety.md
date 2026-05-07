# RDY-002: CLI Package-Mode Diff And Init Rollback Are Not Handoff-Safe

Area: Installer CLI

Severity: High

Priority: P1

Effort: M

## Problem

`dgadd diff` ignores package integration mode, so files installed with `--integration keys` can immediately report false diffs. `dgadd init` also snapshots only `diffgazer.json`, so failures after file creation can leave partial project files behind.

## Evidence

- `cli/add/src/commands/add.ts:40` rewrites local keys-hook imports to `@diffgazer/keys` for package integration mode.
- `cli/add/src/commands/add.ts:132` records `integrationMode` in manifest file metadata.
- `cli/add/src/commands/diff.ts:40` compares against plain prepared registry content and does not apply package-mode rewrite.
- `libs/registry/src/cli/workflows/init.ts:114` snapshots config only before init writes files and runs follow-up steps.

## User Impact

Users can install a component, run `dgadd diff`, and see false local modifications. If init fails during dependency install or config write, a project can be left with copied files but no valid initialized manifest/config.

## Fix

Apply the same integration-mode transform in `diff` that `add` applies before writing files. For init, record created/overwritten paths and restore them on failure, or write config before failure-prone post-file hooks.

## Acceptance Criteria

- `dgadd add ui/accordion --integration keys --skip-install --yes`, followed by `dgadd diff ui/accordion`, reports up to date.
- Editing the installed component still produces a real diff.
- Copy mode and normal mode remain idempotent.
- Forced `afterFiles` and forced config-write failures leave no newly created init files.
- Existing skipped files are never deleted by rollback.

## Verification

Add CLI fixture tests for package-mode `add -> diff`, copy-mode `add -> diff`, and init rollback failure paths. Then run `pnpm --filter @diffgazer/add test` and `pnpm run smoke:cli`.

