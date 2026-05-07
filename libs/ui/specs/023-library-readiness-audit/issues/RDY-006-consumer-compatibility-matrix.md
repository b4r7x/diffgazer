# RDY-006: Consumer Compatibility Matrix Is Not Proven

Area: Consumer compatibility

Severity: High

Priority: P1

Effort: L

## Problem

The repo has good Vite/package smoke, but it does not fully prove the real Next App Router/RSC handoff shape, several package-manager paths, Vite-only alias detection, or key-package integration transforms.

## Evidence

- `scripts/monorepo/smoke-package-install.mjs:429` writes a Next `app/page.tsx` that is itself client-marked, so it does not prove server RSC pages importing client-marked Diffgazer components.
- `scripts/monorepo/smoke-cli.mjs:221` uses the same client-page pattern for copy-first Next smoke.
- `cli/add/src/utils/detect.ts:90` parses only numeric Next major/minor specs; `latest`, canary, workspace/catalog refs, and aliases can fall through.
- `cli/add/src/utils/detect.ts:65` uses regex-based Vite alias detection.
- Package-manager detection supports npm, pnpm, yarn, and bun, but clean smoke uses pnpm only.
- `cli/add/src/utils/transform.test.ts` covers direct hook imports, but not the full mixed import/re-export matrix for keys package mode.

## User Impact

Users in common Next/Vite/package-manager configurations can hit untested install/build behavior even though the local happy path passes.

## Fix

Add a clean compatibility matrix for Next server pages, package mode, copy mode, Vite TS/jsconfig aliases, Vite-only aliases or explicit rejection, package managers, and keyboard-heavy components with `--integration copy` and `--integration keys`.

## Acceptance Criteria

- Next package-mode and copy-first fixtures build with server `app/page.tsx` importing Diffgazer client components directly.
- Next `latest`, canary/prerelease, and workspace/catalog specs detect RSC correctly or produce an explicit prompt.
- Vite fixtures pass for `tsconfig.app.json`, custom aliases, and supported Vite alias forms.
- npm, pnpm, yarn, and bun install flows pass or unsupported managers are documented.
- `dgadd add ui/menu --integration keys` builds in clean Vite and Next fixtures.

## Verification

Run `pnpm --filter @diffgazer/ui build`, `pnpm --filter @diffgazer/add build`, `pnpm run smoke:packages`, and the new clean fixture matrix.

