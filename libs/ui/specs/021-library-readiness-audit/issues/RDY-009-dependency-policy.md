# RDY-009 - Dependency policy is split across consumption modes

**Area**: Dependencies and runtime surface  
**Priority**: P1  
**Severity**: High  
**Effort**: Medium

## Problem

Package metadata, registry metadata, CLI init, and generated CLI bundles expose different dependency stories.

## Evidence

- `libs/ui/public/r/button.json:7` declares only `class-variance-authority`.
- `libs/ui/public/r/button.json:21` imports `@/lib/utils`.
- `libs/ui/registry/lib/utils.ts:1` imports `clsx` and `tailwind-merge`.
- `cli/add/src/commands/init.ts:95` installs core dependencies only during init.
- `cli/add/scripts/bundle-registry.ts:10` treats core deps specially.
- `cli/add/src/commands/add.ts:160` defaults `--keys-version` to `latest`.
- `cli/add/src/utils/add-integration.ts:46` installs plain `@diffgazer/keys` for latest.
- `libs/ui/package.json:408` lists optional `lucide-react`, but no runtime source import was found.

## User Impact

Clean consumers can get different dependency surfaces depending on copy mode vs package mode, and package-mode keys installs can drift from the UI registry bundle.

## Fix

Make dependency policy explicit and enforceable. Either make `utils` a hidden registry lib with dependency metadata or hard-require validated `dgadd init` before add. Pin generated keys package integration to a compatible range, and remove stale optional peers until actually imported.

## Acceptance Criteria

- Clean source-copy installs get all runtime npm dependencies.
- `--integration=keys` installs a compatible `@diffgazer/keys` range, not floating `latest`.
- No optional peer is listed or documented without a shipped import.

## Verification

Fresh app fixtures for `ui/button`, `ui/select --integration copy`, `ui/select --integration keys`, and `ui/logo`; type-check and build after each.

