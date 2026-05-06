# RDY-016 - shadcn namespace setup is incomplete

**Area**: shadcn registry docs  
**Priority**: P1  
**Severity**: Medium  
**Effort**: Small

## Problem

Docs show a shadcn namespaced install command without first documenting the required registry mappings, including the separate keys namespace used by registry dependencies.

## Evidence

- `libs/ui/docs/content/utils/compose-refs.mdx:16` shows `npx shadcn@latest add "@ui/compose-refs"`.
- `libs/ui/registry/registry.json:15` uses `@diffgazer-keys/navigation`.
- `libs/keys/registry/registry.json:7` exposes `navigation`.
- Current docs do not provide a complete `components.json` `registries` setup for both namespaces before the shadcn command.

## User Impact

Users attempting shadcn installation can fail namespace resolution or miss cross-package dependencies.

## Fix

Document a complete `components.json` mapping for `@ui` and `@diffgazer-keys`, then verify representative shadcn installs.

## Acceptance Criteria

- shadcn docs include both namespace URLs.
- `npx shadcn@latest add @ui/accordion @ui/dialog @ui/popover` installs dependencies including keys hooks and shared files.

## Verification

Create a clean shadcn app, configure registries, add representative items, and type-check/build.

