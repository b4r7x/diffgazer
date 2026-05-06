# RDY-007 - Component docs generated data is missing

**Area**: Docs generation  
**Priority**: P1  
**Severity**: High  
**Effort**: Medium

## Problem

Docs routes try to load per-component generated JSON, but the UI docs generator currently emits component lists and hook/lib data without `components/<name>.json`.

## Evidence

- `apps/docs/src/routes/$lib/docs/$.tsx:43` loads component data.
- `apps/docs/src/lib/load-doc-data.ts:11` imports `../generated/${library}/${type}/${name}.json`.
- `apps/docs/src/generated/ui/component-list.json` exists.
- `apps/docs/src/generated/ui/components/` does not exist.
- `libs/ui/scripts/build-docs-data.ts:43` configures hooks.
- `libs/ui/scripts/build-docs-data.ts:50` configures libs, but no components config.

## User Impact

Component docs pages can fail to render install/source metadata even when MDX content exists.

## Fix

Add component data generation to `libs/ui/scripts/build-docs-data.ts`, sync it into `apps/docs/src/generated/ui/components`, and fail validation if a component list exists without matching component JSON files.

## Acceptance Criteria

- `apps/docs/src/generated/ui/components/button.json` exists after `prepare:generated`.
- Component docs pages load install/source data without loader errors.

## Verification

Run docs generated-data preparation, then open/build `/ui/docs/components/button` and `/ui/docs/components/menu`.

