# 07 — Build And Release Gates

> Implement only this brief. Do not run git add/commit/stage/stash.

## Goal

Make release-readiness checks coherent for docs, web, package artifacts, direct shadcn, `dgadd`, and npm package smoke.

## Required Skills

- `/code-audit`
- `/clean-code`
- `/code-quality`
- `/anti-slop`
- `/sota`
- `/test-behavior-not-implementation`

## Required Reading

- `AGENTS.md`
- `package.json`
- `turbo.json`
- `PACKAGE_GOVERNANCE.md`
- `.github/workflows/release-readiness.yml`
- `apps/docs/package.json`
- `apps/web/package.json`
- `apps/web/vite.config.ts`
- `libs/ui/package.json`
- `libs/keys/package.json`
- `cli/add/package.json`
- `scripts/monorepo/validate-artifacts.mjs`
- `scripts/monorepo/smoke-cli.mjs`
- `scripts/monorepo/smoke-package-install.mjs`

## Write Ownership

```text
package.json
turbo.json
PACKAGE_GOVERNANCE.md
.github/workflows/release-readiness.yml
apps/docs/package.json
apps/web/package.json
scripts/monorepo/**
libs/ui/package.json
libs/keys/package.json
cli/add/package.json
```

## Required Behavior

### Part A: Turbo docs outputs

Docs build output uses `.output/public`. Turbo build outputs must include docs output so cached builds restore the actual deployable docs artifact.

### Part B: Clean-checkout web build

Root `web:build` must be coherent on a clean checkout. It should either:

- use Turbo with dependency builds, or
- explicitly prepare/build `@diffgazer/ui` and `@diffgazer/keys` first.

### Part C: Publish hooks consistency

Package-local prepublish/pack validation should be consistent enough that direct package publish cannot bypass core gates. Align `@diffgazer/keys` and `@diffgazer/add` with the documented release contract where practical.

### Part D: Deterministic dependency versions

Avoid `latest` dependencies in package manifests where reproducibility matters. Known candidate:

- `apps/docs` uses `nitro: "latest"`.

### Part E: Root `test-ci` compatibility

Add a root `test-ci` script if practical so `$sota-verify` can run its expected command. It should wrap the release-readiness gates or a documented CI-safe subset that includes artifacts, type-check, tests, smoke, and monorepo verification.

### Part F: Release check script

Add or document one root script that runs the no-publish release readiness sequence:

- artifact prep,
- artifact validation,
- type-check,
- tests,
- strict smoke,
- package smoke,
- pack dry-runs,
- monorepo verify,
- `git diff --check`.

Do not run `changeset publish`.

## Tests

Add script-level assertions or update existing monorepo validation so failures are caught when:

- docs output is missing from Turbo outputs,
- web build is run on a clean checkout without built libs,
- required smoke scripts are skipped unexpectedly,
- package files omit registry/public/readme artifacts.

## Verification

```bash
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
pnpm run build
pnpm run verify
pnpm run smoke:packages
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
pnpm run verify:monorepo
npm run test-ci
git diff --check
```

