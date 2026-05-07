# RDY-005: Release And CI Gates Are Not Clean

Area: Release, CI, versioning, governance

Severity: High

Priority: P1

Effort: M

## Problem

The release gate currently fails because Changesets ignores a package that is not visible as a workspace package. Next package-mode smoke can also skip in CI if local dependencies are missing.

## Evidence

- `.changeset/config.json:16` ignores `@diffgazer/keys-artifacts`.
- `pnpm-workspace.yaml:1` includes `libs/*`, not nested `libs/keys/artifacts`.
- Local `pnpm changeset status --since=origin/main` fails with `@diffgazer/keys-artifacts` not found.
- `scripts/monorepo/smoke-package-install.mjs:536` marks the Next package-mode smoke as optional when deps are missing.
- `.github/workflows/release-readiness.yml:52` runs `pnpm run smoke:packages`, which can pass with the Next smoke skipped.

## User Impact

Release readiness can fail late or pass without proving the documented Next package-mode path. This undermines public handoff confidence.

## Fix

Remove `@diffgazer/keys-artifacts` from Changesets ignore or add it as a documented workspace package. Make Next package-mode smoke mandatory in release CI by provisioning `next`, `@tailwindcss/postcss`, and `postcss`, or by running a separate network-enabled release job.

## Acceptance Criteria

- `pnpm changeset status --since=origin/main` exits 0.
- CI logs contain `OK: Next package-mode Tailwind CSS output`, not a skip.
- Release readiness workflow fails on skipped required consumer smoke.

## Verification

Run `pnpm changeset status --since=origin/main`, `pnpm run smoke:packages`, and a CI-equivalent Next smoke job with dependencies available.

