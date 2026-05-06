# RDY-005 - @diffgazer/keys is not RSC safe

**Area**: Next App Router / RSC compatibility  
**Priority**: P0  
**Severity**: Critical  
**Effort**: Medium

## Problem

`@diffgazer/keys` exposes a single package root that re-exports hook/provider modules, but the built root does not start with `"use client"`. Several source modules use React hooks and browser APIs without client directives.

## Evidence

- `libs/keys/package.json:17` exposes only the root export.
- `libs/keys/dist/index.js:1` starts with exports, not `"use client"`.
- `libs/keys/src/providers/keyboard-provider.tsx:36` uses `useState`.
- `libs/keys/src/providers/keyboard-provider.tsx:93` uses `window.addEventListener`.
- `libs/keys/src/hooks/use-key.ts:68` uses `useEffect`.
- `cli/add/src/utils/transform.ts:146` strips existing `"use client"` and reinjects only when `rsc` is true.

## User Impact

Next App Router consumers can hit RSC compile/runtime errors when importing `@diffgazer/keys` or UI package entries that depend on it.

## Fix

Preserve/add `"use client"` on keys root and client modules, and add a build invariant checking built directives. In copy mode, preserve client directives for registry items marked `meta.client` by default, or make RSC opt-out instead of opt-in.

## Acceptance Criteria

- `@diffgazer/keys/dist/index.js` starts with `"use client"`.
- Next App Router package and copy fixtures build with `KeyboardProvider`, `useKey`, `useNavigation`, Dialog, Menu, Select, and CommandPalette.

## Verification

Pack UI/keys/add, install into a clean Next App Router fixture, and run `next build` for both package mode and source-copy mode.

