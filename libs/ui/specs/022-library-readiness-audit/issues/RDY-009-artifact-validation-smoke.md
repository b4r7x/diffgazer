# RDY-009: Artifact Validation And Smoke Coverage Are Too Weak

Area: Artifact generation and validation

Severity: P1

Effort: L

## Problem

Generated artifacts need validation that checks content parity, package surface, and clean consumer behavior. CLI dist generated files, docs artifacts, keys copy bundles, and clean-tree state must stay covered before release.

## Evidence

- `scripts/monorepo/artifacts/validation.mjs` compares copied artifact trees, generated outputs, registry bundles, fingerprints, and manifests.
- `scripts/monorepo/validate-artifacts.mjs` checks workspace artifacts, mirrored artifacts, `cli/add/dist/generated`, package exports, and packed artifact surfaces.
- `scripts/monorepo/smoke-package-install.mjs` runs clean consumer package installs through real `dgadd` flows.
- `libs/keys/scripts/validate-registry-closure.ts` validates static, side-effect, dynamic, and require-style relative imports.
- Release validation still needs CI to fail if generators leave uncommitted changes.

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
