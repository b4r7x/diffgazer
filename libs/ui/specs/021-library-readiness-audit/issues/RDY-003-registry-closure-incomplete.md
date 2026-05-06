# RDY-003 - Registry install closure is incomplete

**Area**: Registry dependency closure  
**Priority**: P0  
**Severity**: Critical  
**Effort**: Small/Medium

## Problem

Several registry items import files or utilities that are not reachable through their registry dependencies. Source-copy and shadcn installs can produce unresolved imports.

## Evidence

- `libs/ui/registry/ui/dialog/dialog-content.tsx:8` imports `../shared/portal-context`.
- `libs/ui/registry/ui/popover/popover-content.tsx:7` imports `../shared/portal-context`.
- `libs/ui/registry/registry.json:235` hidden `portal` only includes `registry/ui/shared/portal.tsx`.
- `libs/ui/registry/registry.json:652` `dialog` does not depend on `portal`.
- `libs/ui/registry/ui/accordion/accordion.tsx:11` imports `composeRefs`.
- `libs/ui/registry/registry.json:12` `accordion.registryDependencies` omits `compose-refs`.
- `libs/ui/registry/registry.json:1755` defines the `compose-refs` item.

## User Impact

`dgadd add ui/dialog`, `ui/popover`, or `ui/accordion` can write source that does not compile in a clean consumer.

## Fix

Add `portal-context.tsx` to the hidden `portal` item, add `portal` to `dialog.registryDependencies`, and add `compose-refs` to `accordion.registryDependencies`. Extend closure validation to follow relative imports and `@/` aliases.

## Acceptance Criteria

- Clean copy installs of `accordion`, `dialog`, `popover`, and `menu` have no unresolved imports.
- Registry validation fails on missing relative shared files and missing local utility dependencies.

## Verification

Run a clean fixture: `dgadd add ui/accordion ui/dialog ui/popover ui/menu --integration copy --yes`, then type-check/build.

