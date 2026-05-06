# RDY-012 - Hidden internals are exposed as public npm API

**Area**: public API boundary  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

Registry items marked hidden or intended as dependency-only internals can still be built and exposed through wildcard package exports.

## Evidence

- `libs/ui/tsup.config.ts:38` builds all non-theme registry items.
- `libs/ui/package.json:18` exposes wildcard `./components/*`, `./hooks/*`, and `./lib/*`.
- `libs/ui/registry/registry.json:223` marks `portal` as a registry item, and `libs/ui/registry/registry.json:689` marks `dialog-shell` as a registry item.
- Built hidden files exist at `libs/ui/dist/components/portal.js` and `libs/ui/dist/components/dialog-shell.js`.
- Stale public-looking dist entries also exist for removed registry items: `card-layout`, `checklist`, `focusable-pane`, `key-value-row`, and `labeled-field`.

## User Impact

Users can import internals that are not documented or stable. Changing them later becomes a breaking change.

## Fix

- Generate explicit public exports from non-hidden registry items.
- Keep hidden files bundled as internals only.
- Fail validation if hidden items are externally importable.

## Acceptance Criteria

- Hidden registry items cannot be imported from the npm package.
- Docs and package exports agree.

## Verification

- Import smoke for public subpaths.
- Negative import tests for hidden subpaths.
