# Agent D4: Release Governance and Final Gates

Model: `gpt-5.5`
Reasoning: medium
Mode: implementation after D1-D3

## Objective

Fix release governance, regenerate artifacts after source/docs changes, and run final local gates.

## Write Ownership

Primary:

- `SECURITY.md`
- `SUPPORT.md`
- `cli/add/SECURITY.md`
- `cli/add/SUPPORT.md`
- `cli/diffgazer/SECURITY.md`
- `cli/diffgazer/SUPPORT.md`
- `cli/diffgazer/package.json`
- `libs/keys/SECURITY.md`
- `libs/keys/SUPPORT.md`
- `libs/ui/SECURITY.md`
- `libs/ui/SUPPORT.md`
- `libs/ui/package.json`
- `PACKAGE_GOVERNANCE.md`
- `.github/workflows/release-readiness.yml`
- `scripts/monorepo/validate-artifacts.mjs`
- `scripts/monorepo/check-invariants.mjs`
- `libs/ui/registry/registry.json`
- `libs/ui/public/r/*.json`
- `libs/ui/docs/generated/**/*.json`
- `libs/keys/registry/registry.json`
- `libs/keys/public/r/*.json`
- `libs/keys/docs/generated/**/*.json`
- `cli/add/src/generated/*.json`
- `cli/add/dist/generated/*.json`
- `pnpm-lock.yaml` only if package changes require it

Coordinate before touching:

- source component files
- docs content files

## Requirements

- Run after D1-D3 complete.
- Ensure package policy files are present and intended to be tracked. Do not run `git add`; just leave files in the worktree and add validation that checks tracked status when appropriate.
- Remove hidden network smoke from public package lifecycle scripts, especially `@diffgazer/ui prepublishOnly`; keep strict smoke in release workflow/governance docs.
- Regenerate docs/public registry/CLI embedded bundles from current source.
- Add validation for required policy files and stale artifacts where practical.
- Run final gates.

## Acceptance Criteria

- `rg "DIFFGAZER_SMOKE_ALLOW_NETWORK" */*/package.json libs/*/package.json` has no package lifecycle hit.
- Policy files are either tracked-intended and validated or removed from package `files`.
- Generated artifacts are synced.
- `pnpm --filter @diffgazer/ui validate:registry`, `pnpm run validate:artifacts`, `pnpm changeset status --since=main`, `pnpm run verify`, and strict smoke pass.

## Verification

Run:

- `pnpm --filter @diffgazer/ui validate:registry`
- `pnpm run validate:artifacts`
- `pnpm changeset status --since=main`
- `pnpm run verify`
- `DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`
- `git diff --check`
- `.bak` scan

