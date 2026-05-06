# RDY-014 - Published declarations are not strict-consumer safe

**Area**: Type declarations and package type-checking  
**Priority**: P0  
**Severity**: High  
**Effort**: Small/Medium

## Problem

Some emitted `.d.ts` files reference `React.*` without importing React types. The package type-check also does not cover `tsup.config.ts` or `scripts/**/*.ts`, even though those files define public exports and client directive injection.

## Evidence

- `libs/ui/dist/hooks/floating-position.d.ts:5` references `React.RefObject`.
- `libs/ui/dist/hooks/overflow-items.d.ts:6` references `React.RefObject`.
- `libs/ui/dist/components/icons.d.ts:14` references `React`.
- `libs/ui/dist/components/tabs.d.ts:5` references `React`.
- `libs/ui/registry/hooks/use-floating-position.ts:3` imports `useLayoutEffect`, `useState`, and `type RefObject`, but other sources still use `React.*`.
- `libs/ui/package.json:393` runs only `tsc --noEmit`.
- `libs/ui/tsconfig.json:19` includes registry/shared source, not build scripts or tsup config.

## User Impact

Strict TypeScript consumers with `skipLibCheck: false` and constrained `types` can get `TS2503: Cannot find namespace 'React'` when importing public subpaths.

## Fix

Use named type imports from `react`, or explicitly import `type * as React` in files that use `React.*`. Add a tools tsconfig covering `tsup.config.ts`, `scripts/**/*.ts`, and registry/docs generation source.

## Acceptance Criteria

- No emitted public `.d.ts` contains `React.` unless it imports React.
- A strict consumer fixture imports every public subpath with `skipLibCheck: false` and passes `tsc`.
- A deliberate type error in `tsup.config.ts` fails UI type-check.

## Verification

Run package build, then a clean type-only consumer under `moduleResolution: Bundler` and `NodeNext`.

