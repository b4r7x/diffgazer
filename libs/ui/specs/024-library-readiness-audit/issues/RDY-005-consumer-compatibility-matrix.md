# RDY-005: Consumer compatibility matrix and strict smoke gates need broader proof

Area: Consumer compatibility / smoke / package managers
Severity: P2
Effort: Medium/Large

## Problem

The supported consumer matrix is broader than the proven matrix. Current smokes are strong for pnpm/Vite/package mode and optional strict Next checks, but several common consumer paths remain unproven.

## Evidence

- Vite alias detection is regex-based and misses common ESM alias syntax such as `new URL("./src", import.meta.url).pathname`: `cli/add/src/utils/detect.ts:65`.
- Next RSC detection returns false when Next version cannot be parsed, even if an App Router app and Next dependency exist: `cli/add/src/utils/detect.ts:90`.
- Detection has npm/pnpm/yarn/bun branches, but current smoke fixtures primarily use pnpm.
- Normal smoke can skip Next when deps are missing; strict network-enabled smoke is not the default local run.

## User Impact

Users in common Vite/Next/package-manager setups can hit silent wrong config or untested install behavior. Release confidence depends on remembering to run strict smoke with network-enabled deps.

## Fix

Add matrix fixtures for:

- Vite TS paths, root tsconfig, `tsconfig.app.json`, object aliases, array aliases, and ESM `new URL` aliases.
- Next App Router with numeric, prerelease/canary, `latest`, and workspace/catalog Next specs.
- npm, pnpm, yarn, and bun where claimed supported.
- Strict no-skip release smoke in CI/handoff gates.

## Acceptance Criteria

- Handoff gate runs with `DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_SMOKE_STRICT_SKIPS=1` and reports zero skips.
- Copy-first and package-mode installs type-check/build across the declared package manager matrix.
- Ambiguous Next RSC detection either treats App Router + Next as RSC or fails with an actionable message before writing files.

## Verification

- `DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke:cli`
- `DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke:packages`
- New matrix fixture job in CI.

