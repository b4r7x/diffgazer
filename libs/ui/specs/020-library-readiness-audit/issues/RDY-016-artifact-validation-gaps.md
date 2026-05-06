# RDY-016 - Artifact validators warn instead of failing

**Area**: artifact pipeline  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

Some severe artifact problems are warnings or are not validated: missing client directives, missing CSS aggregation, missing dist entries, hidden internals exported, stale registry JSON, and missing dependency metadata.

## Evidence

- `libs/ui/tsup.config.ts` warns for UI items missing `meta.client`.
- `libs/ui/tsup.config.ts` warns for missing entry outputs.
- Registry generation scripts live under `libs/ui/scripts`.
- `libs/ui/dist/artifacts` has stale generated items that are no longer in the current 62-item registry: `card-layout`, `checklist`, `focusable-pane`, `key-value-row`, and `labeled-field`.
- `libs/ui/dist/artifacts/fingerprint.sha256` does not match the current artifact manifest inputs.
- `cli/add/dist/generated/registry-bundle.json` drifts from `cli/add/src/generated/registry-bundle.json`.
- `libs/ui/dist/styles.css` omits `libs/ui/registry/ui/shared/dialog.css`, while `libs/ui/tsup.config.ts:129` still looks for `registry/ui/dialog/dialog.css`.
- `libs/ui/package.json:18` wildcard exports make hidden built entries importable.

## User Impact

The package can build successfully while producing artifacts that fail in consumer apps.

## Fix

Add a `verify:artifacts` gate that hard-fails on:

- source `"use client"` without output directive;
- declared CSS not included in package CSS;
- hidden item exported publicly;
- unknown bare local registry dependencies;
- malformed cross-package registry namespaces;
- missing npm dependency metadata;
- stale `public/r`;
- stale `dist/artifacts`;
- stale docs generated data;
- stale CLI/generated bundles.

## Acceptance Criteria

- All severe artifact mismatches fail local verification and CI.
- Publish scripts run artifact verification.

## Verification

- Controlled failing fixtures or snapshot validation.
