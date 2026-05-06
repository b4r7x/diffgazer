# RDY-010 - Client component directives are missing from npm output

**Area**: npm package, React Server Components  
**Severity**: Critical  
**Effort**: Medium  
**Status**: Open

## Problem

The build re-injects `"use client"` based on `registry.items[].meta.client`. If metadata is missing, a client component can be emitted without the directive.

## Evidence

- `libs/ui/tsup.config.ts:141` injects directives from `meta.client`.
- `libs/ui/tsup.config.ts:158` warns for UI items missing `meta.client`.
- Source files under `libs/ui/registry/ui` include a mix of client and display components.
- The 2026-05-05 recheck found dist entries missing directives for source-client component entries including `avatar`, `textarea`, `icons`, `panel`, `scroll-area`, `card`, `section-header`, `empty-state`, `kbd`, `divider`, `logo`, `toc`, and `typography`.

## User Impact

Next App Router and other RSC users can hit server/client boundary errors.

## Fix

- Scan source files for top-level `"use client"` and derive item client-ness automatically, or
- Keep metadata manual but fail when source and metadata disagree.
- Remove unnecessary client directives from pure display primitives.

## Acceptance Criteria

- Every npm entry that needs `"use client"` starts with it.
- Pure server-compatible display primitives omit it.
- Build fails on mismatch.

## Verification

- Static script comparing registry source to dist output.
- Next App Router fixture importing every component.
