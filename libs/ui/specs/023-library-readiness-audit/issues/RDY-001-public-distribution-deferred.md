# RDY-001: Public Distribution Endpoints Are Deferred Until Deployment

Area: Distribution and public handoff

Severity: Deferred, not a current implementation blocker

Priority: Deferred

Effort: M

## Problem

The public npm packages and hosted registry endpoints are intentionally not deployed yet. This should remain future deployment work, not a blocker for the current local implementation/readiness pass.

## Evidence

- UI docs and package READMEs explicitly state publish gating as of 2026-05-06, for example `libs/ui/docs/content/getting-started/consumption-modes.mdx:6` and `cli/add/README.md:7`.
- `libs/ui/docs/content/utils/shadcn-namespace.mdx:21` tells users to serve local registry folders for validation and avoid publishing concrete production hosts until deployment smoke tests pass.
- Existing `libs/ui/specs/022-library-readiness-audit/issues/RDY-001-public-distribution-endpoints.md` already records this as a deferred issue.

## User Impact

External users cannot use public npm or hosted registry URLs until deploy. For current handoff work, users must validate via local tarballs and local registry/static server fixtures.

## Fix

Keep this issue as deployment-phase work. Publish packages and hosted registries only after release CI, clean consumer fixtures, and endpoint smoke tests pass.

## Acceptance Criteria

- `npm view @diffgazer/add version --json` returns the intended published version.
- `npm view @diffgazer/ui version --json` returns the intended published version.
- `npm view @diffgazer/keys version --json` returns the intended published version.
- Hosted registry item URLs return 200.
- Docs distinguish local tarball validation from public post-deploy commands.

## Verification

After deployment, run public npm and hosted registry smoke in clean Vite and Next consumers. Until then, run local tarball smoke and local static registry smoke.

