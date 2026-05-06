# RDY-015 - CLI detection breaks root-source and package-manager cases

**Area**: CLI consumer compatibility  
**Priority**: P1  
**Severity**: High  
**Effort**: Medium

## Problem

`dgadd init` can write inconsistent paths for projects whose `@/*` alias maps to project root, and package-manager detection can pick the one-off executor instead of the project manager.

## Evidence

- `libs/registry/src/cli/detect.ts:88` can resolve source dir to `"."`.
- `cli/add/src/commands/init.ts:52` defaults components to `src/components/ui`.
- `cli/add/src/commands/init.ts:102` strips only a `src/` prefix when writing aliases.
- `cli/add/src/commands/init.ts:114` records `componentsFsPath: src/components/ui`.
- `libs/registry/src/cli/detect.ts:34` checks `npm_config_user_agent`.
- `libs/registry/src/cli/detect.ts:66` can prefer user agent before lockfiles/packageManager.
- `libs/registry/src/cli/package-manager.ts:45` uses the detected binary for installs.

## User Impact

Root-source apps can get aliases that do not match installed files, and `npx` in pnpm/yarn/bun projects can create the wrong lockfile or install with the wrong manager.

## Fix

Derive default component dirs from detected source dir and validate alias-to-filesystem consistency before writing config. Prefer `packageManager`, then lockfiles, then user agent; warn on conflicts.

## Acceptance Criteria

- Fixtures for `@/* -> ./src/*`, `@/* -> ./*`, and custom source dirs pass `dgadd init && dgadd add ui/button`.
- `npx @diffgazer/add init` in pnpm/yarn/bun projects uses the project manager or warns clearly.

## Verification

Run CLI fixtures for root-source and `src` apps across npm, pnpm, yarn, and bun lockfiles.

