# RDY-015 - Package metadata, lockfile, and version policy need release hardening

**Area**: package governance  
**Severity**: Medium  
**Effort**: Medium  
**Status**: Open

## Problem

Public packages need coherent metadata, lockfile ownership, version compatibility, and migration policy.

## Evidence

- `libs/ui/package.json` defines public package metadata.
- `cli/add/package.json` defines public CLI metadata.
- The workspace lockfile and changeset/release tooling govern whether these packages can be published consistently.
- `.changeset/config.json:3` points changelog generation at `b4r7/diffgazer`, while package metadata and docs point at `b4r7x/diffgazer`.
- `libs/ui/package.json:61` declares optional `lucide-react`, but the 2026-05-05 recheck found no runtime imports in `libs/ui`, `libs/keys`, or `cli/add`.
- There is no package-local `libs/ui/LICENSE`, while `libs/ui/package.json:14` declares MIT for the package.

## User Impact

Packages can be published with missing docs, incompatible versions, or unclear upgrade paths.

## Fix

- Ensure package-local README and LICENSE are included.
- Define compatibility between `@diffgazer/ui`, `@diffgazer/keys`, and `@diffgazer/add`.
- Add changelog and migration policy.
- Ensure frozen lockfile install works in CI.

## Acceptance Criteria

- `npm pack --dry-run` contains expected files.
- Versioning policy is documented.
- Release tooling covers all public packages.

## Verification

- Pack contents snapshot.
- Changeset status check.
