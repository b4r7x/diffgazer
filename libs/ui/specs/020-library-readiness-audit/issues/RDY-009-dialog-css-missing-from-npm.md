# RDY-009 - Dialog CSS is missing from npm styles output

**Area**: npm CSS build  
**Severity**: Critical  
**Effort**: Small  
**Status**: Open

## Problem

Dialog CSS is imported by source but the npm build appends a hardcoded path that does not match the actual file location.

## Evidence

- `libs/ui/tsup.config.ts:130` appends `registry/ui/dialog/dialog.css`.
- Current dialog CSS source is `libs/ui/registry/ui/shared/dialog.css`.
- `libs/ui/dist/styles.css` only contains the Tailwind/theme imports in the current package output.
- `libs/ui/tsup.config.ts` comments state component CSS is aggregated into `styles.css`.

## User Impact

Npm consumers lose dialog backdrop, scroll lock, and animation CSS.

## Fix

- Derive component CSS files from registry entries ending in `.css`.
- Append those files to `dist/styles.css`.
- Fail the build if a declared CSS file is missing or not aggregated.

## Acceptance Criteria

- `dist/styles.css` includes dialog CSS.
- The build fails on stale/missing CSS paths.

## Verification

- Build package and grep `dist/styles.css` for dialog selectors.
- Render npm Dialog in a fixture.
