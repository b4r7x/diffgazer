# RDY-002 - Theme item breaks dgadd listing and all-item flows

**Area**: CLI registry installability  
**Priority**: P0  
**Severity**: Critical  
**Effort**: Small

## Problem

`dgadd list --json` fails because `publicInstallNames()` includes the public `registry:theme` item, but the CLI registry path helper only supports `registry/ui/`, `registry/hooks/`, and `registry/lib/`.

## Evidence

- `libs/ui/registry/registry.json:1690` declares a public `theme` item.
- `libs/ui/registry/registry.json:1698` includes `styles/theme-base.css`.
- `cli/add/src/utils/namespaces.ts:29` includes every public item without filtering installable types.
- `libs/registry/src/cli/fs.ts:148` rejects unsupported registry file paths.
- Local audit command failed: `node --import tsx cli/add/src/index.ts list --json` with `Unsupported registry file path "styles/theme-base.css"`.

## User Impact

Users cannot reliably inspect available items, and `add --all`, `diff`, or `remove` can hit the same non-installable theme path.

## Fix

Filter CLI-installable items to `registry:ui`, `registry:hook`, and `registry:lib`, or explicitly teach CLI workflows how to handle `registry:theme`. If `theme` is only installed by `dgadd init`, exclude it from list/add/diff/remove public names.

## Acceptance Criteria

- `dgadd list --json` succeeds.
- `dgadd add --all --dry-run` does not include unsupported `styles/*` paths unless theme install is explicitly supported.

## Verification

Run `node --import tsx cli/add/src/index.ts list --json`, `dgadd list`, and dry-run all-item add/remove flows.

