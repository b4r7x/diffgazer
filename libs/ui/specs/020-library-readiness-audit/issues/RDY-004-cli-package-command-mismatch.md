# RDY-004 - CLI command and package identity must be unambiguous

**Area**: CLI, docs, first-run UX  
**Severity**: Critical  
**Effort**: Small  
**Status**: Open

## Problem

The public install command must be mechanically correct. In the current structure the runtime package is `@diffgazer/ui`, while the installer CLI is `@diffgazer/add` with the `dgadd` binary.

Docs and generated install blocks must not derive commands from branding text or historical package names.

## Evidence

- `libs/ui/package.json` names the runtime package `@diffgazer/ui`.
- `cli/add/package.json` names the CLI package `@diffgazer/add`.
- `cli/add/package.json` exposes the `dgadd` binary.
- `libs/ui/README.md` currently documents npm runtime usage, but future registry docs must document the CLI separately.

## User Impact

If docs show the wrong command, users fail before they can install any component.

## Fix

- Pick the canonical command syntax, likely `npx @diffgazer/add ...` or `npx dgadd` only if package publishing supports that.
- Add docs config fields such as `cliPackage`, `cliCommand`, and `runtimePackage`.
- Do not derive commands from logo text or library display name.

## Acceptance Criteria

- Every public docs command resolves to the intended published package.
- `npx <documented-package> --help` works in a clean fixture.
- Generated component install snippets use the same command as getting-started docs.

## Verification

- Docs command lint.
- Clean `npx` smoke test.

