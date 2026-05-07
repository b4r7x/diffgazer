# RDY-002: CLI remove can delete copied keys hooks still required by retained UI

Area: Installer CLI / manifest safety / copy integration
Severity: P0
Effort: Medium

## Problem

In copy integration mode, keys hooks are copied and recorded as separate `keys/*` manifest-owned items. Removing a keys item can delete the copied hook even while retained UI components still import it.

## Evidence

- `add` records copied keys files as separate items with integration metadata: `cli/add/src/commands/add.ts:123`, `cli/add/src/commands/add.ts:164`, `cli/add/src/commands/add.ts:216`.
- `remove` retains files belonging to other installed items' own files only: `libs/registry/src/cli/workflows/remove.ts:81`.
- CLI remove context does not expand retained UI items with their copied keys dependencies: `cli/add/src/commands/remove.ts:44`.
- Smoke adds `ui/select` and `keys/navigation`, builds, then removes `keys/navigation` without rebuilding afterward: `scripts/monorepo/smoke-cli.mjs:425`, `scripts/monorepo/smoke-cli.mjs:433`.

## User Impact

A clean consumer can remove `keys/navigation` and leave retained copied UI source importing a missing hook. The app can pass CLI remove but fail the next type-check/build.

## Fix

During remove planning, expand retained UI items by their copied keys requirements when their manifest entry has `integrationMode: "copy"`. Either block/no-op removal while a retained UI component requires the hook, or retain the file and report why.

## Acceptance Criteria

- Removing `keys/navigation` is blocked or no-ops while any retained copy-mode UI item still needs it.
- Manifest remains accurate after blocked/no-op and valid removals.
- Smoke rebuilds/type-checks after the attempted key removal.

## Verification

- Fresh fixture: `dgadd init`, `dgadd add ui/select --integration copy`, type-check/build.
- Attempt `dgadd remove keys/navigation --yes`.
- Type-check/build again and confirm the hook remains installed or removal is explicitly blocked.
- Run existing CLI behavior/path safety tests and `pnpm run smoke:cli`.

