# P1-005: Release governance and package lifecycle are not clean enough for handoff

Area: Changesets / package metadata / package lifecycle / policy files
Severity: P1
Effort: Small/Medium

## Problem

The release metadata does not fully describe the public package changes, and some files included by package manifests are untracked. The `diffgazer` package lifecycle can depend on workspace build order that is only guaranteed by root Turbo, not by the package's own prepack path.

## Evidence

- Package manifests include `SECURITY.md` and `SUPPORT.md` files that are currently untracked.
- Current changeset bumps only part of the changed public package set.
- `cli/diffgazer/package.json` has public metadata/build lifecycle changes without matching changeset coverage.
- `diffgazer prepack` can run a local package build without first building workspace dependencies that resolve to ignored `dist` outputs.

## User Impact

Release automation can publish incomplete metadata, skip a changed package, fail from a clean checkout, or produce packages that reference files not tracked in git.

## Fix

- Ensure all package-included policy files exist and are intended to be tracked.
- Update changesets to cover all public package changes that remain, including `diffgazer` if its package metadata/build changes stay.
- Make `diffgazer` prepack/build self-contained or route it through the correct scoped Turbo dependency build.
- Keep release-readiness CI focused on deterministic gates; avoid hidden network requirements in package lifecycle scripts.

## Acceptance Criteria

- `git ls-files` includes every policy file referenced by package `files`.
- `pnpm changeset status --since=main` accounts for all changed public package surfaces.
- Direct `diffgazer` package pack/build works from a clean checkout with ignored `dist`.
- Root release-readiness remains deterministic and does not hide package lifecycle gaps.

## Verification

- Run changeset status.
- Run relevant package build/pack dry-run checks.
- Run `validate:artifacts`.
- Check `git status --short` for expected tracked/untracked policy files.

