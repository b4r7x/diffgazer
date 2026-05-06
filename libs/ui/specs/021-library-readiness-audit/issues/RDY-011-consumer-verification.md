# RDY-011 - Consumer verification is too narrow

**Area**: Smoke tests and consumer matrix  
**Priority**: P1  
**Severity**: High  
**Effort**: Large

## Problem

Existing smoke coverage does not prove the library works as a reusable installable UI library.

## Evidence

- `scripts/monorepo/smoke-package-install.mjs:72` installs with pnpm only.
- `scripts/monorepo/smoke-package-install.mjs:91` imports only `@diffgazer/ui/components/button`.
- `scripts/monorepo/smoke-package-install.mjs:98` imports only `@diffgazer/keys` root.
- `scripts/monorepo/smoke-cli.mjs:15` checks CLI help.
- No current smoke compiles Vite, Next App Router, SSR, Tailwind v4 package CSS, strict TypeScript, or package-manager matrix fixtures.

## User Impact

Build-breaking package exports, CSS setup, RSC boundaries, and CLI copy installs can escape local verification.

## Fix

Add clean fixtures using packed tarballs for Vite package mode, Vite copy mode, Next App Router package mode, Next copy mode, SSR render, strict TypeScript, Tailwind v4 `@source`, and pnpm/npm/yarn/bun installs.

## Acceptance Criteria

- Smoke fails on missing exports, broken CSS, RSC directive failures, stale registry bundles, or broken CLI copy installs.
- Every public UI subpath and CSS export is imported at least once in a clean consumer.

## Verification

Pack `@diffgazer/ui`, `@diffgazer/keys`, and `@diffgazer/add`; install tarballs into fresh fixtures and run `tsc`, Vite/Next builds, and SSR render.

