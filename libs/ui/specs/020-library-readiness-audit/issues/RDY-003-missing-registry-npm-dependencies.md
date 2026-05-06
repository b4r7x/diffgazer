# RDY-003 - Registry items miss npm dependency metadata

**Area**: registry dependency metadata  
**Severity**: High  
**Effort**: Small  
**Status**: Open

## Problem

Registry items must declare all npm packages imported by copied files. Missing metadata causes copied installs to compile only if the consumer already has the package by coincidence.

## Evidence

- `libs/ui/registry/registry.json:85` declares no npm dependencies for `avatar`, but `libs/ui/registry/ui/avatar/avatar.tsx:12` imports `class-variance-authority`.
- `libs/ui/registry/registry.json:543` declares no npm dependencies for `label`, but `libs/ui/registry/ui/label/label.tsx:4` imports `class-variance-authority`.
- `libs/ui/registry/registry.json:623` declares no npm dependencies for `dialog`, but `libs/ui/registry/ui/dialog/dialog-content.tsx:4` imports `class-variance-authority`.
- Additional current misses include `callout`, `icons`, `toast`, `search-input`, and `spinner`.
- `libs/ui/registry/registry.json` is the source of install dependency metadata.

## User Impact

The install command succeeds, but TypeScript or the bundler fails later with missing package imports.

## Fix

Add a registry validator that parses bare imports from each item's files and compares them to `dependencies`.

## Acceptance Criteria

- Every runtime bare npm import in a copied item is declared in that item.
- Validation fails on missing npm dependency metadata.

## Verification

- Clean copied install of every public item.
- `tsc --noEmit` in the generated fixture.
