# RDY-013 - Public docs and README are stale or contradictory

**Area**: docs, onboarding  
**Severity**: High  
**Effort**: Small to Medium  
**Status**: Open

## Problem

Docs must clearly distinguish three paths:

- npm runtime package: `@diffgazer/ui`;
- registry/copy install;
- CLI installer: `@diffgazer/add` / `dgadd`.

Any historical names or generated commands from old package names should be removed.

## Evidence

- `libs/ui/README.md` documents npm runtime usage.
- `cli/add/package.json` documents the installer package and binary.
- `apps/docs` owns generated docs and registry pages.
- `apps/docs/src/components/docs-mdx/blocks/install-command.tsx:12` reads `logoText`, and line 13 generates `npx @diffgazer/ui add <name>` for UI components instead of using `@diffgazer/add` or `dgadd`.
- `apps/docs/config/docs-libraries.json:7` sets the UI `logoText` to `@diffgazer/ui`, while lines 11-14 reference `@diffgazer/ui-artifacts`, which is not an existing package.
- `libs/ui/README.md:13` imports `@diffgazer/ui/theme.css`, but package-mode consumers also need a clear `styles.css` and Tailwind `@source` story.
- `cli/add/README.md:8` starts with `npx @diffgazer/add init`, then `cli/add/README.md:16` switches to bare `dgadd init` without explaining binary availability.

## User Impact

Users can install the wrong package, use the wrong command, or misunderstand whether the library is copy-first or runtime-package-first.

## Fix

- Add explicit docs config for package names and commands.
- Generate install commands from a dedicated CLI package/bin field instead of `logoText`.
- Generate component inventory from registry metadata.
- Add command lint for docs snippets.
- Document when `@diffgazer/keys` and Tailwind `@source` are required.

## Acceptance Criteria

- Every docs install command works in a clean fixture.
- README and hosted docs describe the same product paths.
- No placeholder registry URLs remain.

## Verification

- Docs command smoke test.
- Link and package-name lint.
