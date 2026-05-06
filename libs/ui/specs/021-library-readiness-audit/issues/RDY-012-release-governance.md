# RDY-012 - Release governance is incomplete

**Area**: Release and package governance  
**Priority**: P1  
**Severity**: Medium/High  
**Effort**: Medium

## Problem

The repo has useful local release guards, but user handoff lacks checked-in CI/release workflows, clean changeset state, package-local license packaging, and broad smoke coverage.

## Evidence

- Batch B release audit found no checked-in `.github/workflows`.
- `PACKAGE_GOVERNANCE.md` is untracked while `README.md` links to it.
- `.changeset` has config/README but no pending release changeset for the broad public package changes.
- `libs/ui/package.json:14` declares MIT, but `libs/ui/LICENSE` is absent.
- `cli/diffgazer/package.json:5` declares Apache-2.0, but no package-local license file was found.
- `libs/ui/package.json:388` has build/prepublish guards, but no CI enforcement was found.

## User Impact

Publish/handoff can happen from a dirty or locally passing state that a clean user or CI environment cannot reproduce.

## Fix

Add PR and release workflows for frozen install, build, type-check, tests, registry/artifact validation, pack dry-run, consumer smoke, and changeset status. Track/remove governance docs consistently and add changesets for public package changes. Include correct license text in every public tarball.

## Acceptance Criteria

- Required CI checks exist and pass from a clean checkout.
- `pnpm changeset status` reports expected public package changes.
- `npm pack --dry-run --json` for every public package includes README and the correct LICENSE.

## Verification

Run `pnpm install --frozen-lockfile`, `pnpm run build`, `pnpm run verify`, `pnpm run smoke:packages`, `pnpm changeset status`, and package dry-run packs in CI.

