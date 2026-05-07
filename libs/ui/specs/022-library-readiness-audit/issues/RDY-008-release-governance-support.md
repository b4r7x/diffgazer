# RDY-008: Release Governance And Support Contract Need Tightening

Area: Release, CI, versioning, and support

Severity: P1

Effort: M

## Problem

The repo has release-readiness infrastructure, but provenance, package prepublish gates, versioning, and public support expectations are not yet strong enough for handoff.

## Evidence

- `package.json:47` publishes via Changesets, but provenance is not evident from the package-level publish config.
- `.github/workflows/release-readiness.yml:9-12` has read-only permissions and no `id-token: write`, so npm provenance cannot work from that workflow as written.
- `libs/ui/package.json:390-400` has a weak `prepublishOnly` that checks build output exists but does not validate public registry/docs/package smoke behavior.
- `.changeset/public-handoff-docs.md:1-7` is pending while package versions remain unchanged.
- `libs/ui/PACKAGE_GOVERNANCE.md:166` says private maintainers, but public-facing support/security contact paths are not clearly surfaced.

## User Impact

Consumers cannot tell whether packages are published, provenance-backed, supported, or versioned according to the docs they are reading.

## Fix

Make the release contract explicit and enforce it in CI.

Concrete fix:

- Add publish provenance support where packages are published.
- Strengthen `prepublishOnly` or release CI to include registry validation, package smoke tests, and docs snippet checks.
- Apply Changesets before public handoff.
- Add visible support/security reporting docs or links.

## Acceptance Criteria

- Release CI proves package install, registry install, docs snippets, and hosted endpoints.
- Published package metadata includes correct repo, bugs, license, provenance, and support links.
- Pending changesets are applied before public docs announce the feature.
- Security/support contact is visible to users.

## Verification

- Run release-readiness workflow on a clean branch.
- Dry-run package publish where supported.
- Inspect packed package metadata.
- Verify public docs link to support and security process.

