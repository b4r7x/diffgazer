# RDY-009: Artifact Validation And Smoke Coverage Are Too Weak

Area: Artifact generation and validation

Severity: P1

Effort: L

## Problem

Generated artifacts are validated for presence more than behavioral parity. CLI dist generated files, docs artifacts, keys copy bundles, and clean-tree state need stronger validation before release.

## Evidence

- `apps/docs/scripts/artifact-validation-lib.mjs:128-142` validates generated artifact presence.
- `apps/docs/scripts/artifact-validation-lib.mjs:177-182` compares only public registry JSON, not all docs/generated outputs.
- `scripts/monorepo/validate-artifacts.mjs:28` validates `src/generated` but not necessarily copied `dist/generated`.
- `cli/add/scripts/copy-generated.ts:5` copies generated files into dist.
- Package smoke in `apps/docs/scripts/smoke-package-install.mjs:281-283` only checks `dgadd help`, not real add/init flows.
- `cli/add/src/utils/integration.ts:39` and `libs/registry/src/copy-bundle.ts:21` make integrity optional or not consistently enforced.
- `.github/workflows/release-readiness.yml:37` runs validation but does not enforce clean-tree after generation.
- `libs/keys/scripts/validate-registry-closure.ts:38-40` uses a narrow regex for import closure.

## User Impact

A release can ship stale generated files or a CLI package whose runtime generated registry does not match source. Users discover this during install instead of CI.

## Fix

Validate generated content parity and run real clean consumer smoke tests.

Concrete fix:

- Add content diff checks for docs artifacts and registry artifacts.
- Validate `cli/add/dist/generated` after package build.
- Enforce a clean git tree after generation in CI.
- Require integrity for copy bundles or remove the field if it is not part of the contract.
- Replace regex-only closure validation with AST or TypeScript resolution.
- Add smoke tests for `init`, `add`, `list`, `diff`, and `remove`.

## Acceptance Criteria

- CI fails if generators leave uncommitted changes.
- CLI packed artifact includes generated files matching source-generated files.
- Clean package smoke installs a real component and key hook.
- Registry closure validation catches nested/side-effect imports.

## Verification

- Run package build, artifact validation, and `git diff --exit-code`.
- Pack `@diffgazer/add`, install it into a clean fixture, and run real `dgadd` flows.
- Tamper with generated registry output and confirm CI fails.

