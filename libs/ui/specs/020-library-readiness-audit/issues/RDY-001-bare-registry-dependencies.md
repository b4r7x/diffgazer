# RDY-001 - Bare registry dependencies need local validation

**Area**: registry installability  
**Severity**: High  
**Effort**: Small to Medium  
**Status**: Open

## Problem

Some `registryDependencies` point to sibling `@diffgazer/ui` items by bare name, for example `spinner`, `icons`, or `controllable-state`.

Current shadcn registry behavior allows bare dependency names for local items, so the issue is not the syntax itself. The issue is that the repo needs a hard validator proving that every bare dependency resolves to an item in the same registry, and that every cross-package dependency uses a valid configured namespace or URL.

## Evidence

- `libs/ui/registry/registry.json` has local dependencies such as `button -> spinner`.
- `libs/ui/registry/registry.json` has local dependencies such as `accordion -> controllable-state`, `icons`.
- The registry also uses scoped external dependencies such as `@diffgazer/keys/navigation`, proving namespaces are part of the install model.
- The 2026-05-05 recheck found the 65 bare local dependency edges currently resolve to local item names, but malformed or renamed edges are not hard-failed.
- `libs/ui/registry/registry.json:2` and `libs/ui/public/r/registry.json:2` currently use a malformed `$schema` URL, which shows registry metadata validation is incomplete.

## User Impact

A future rename, generated artifact drift, or bad cross-package namespace can ship without being caught, causing first-time shadcn-style installs to produce missing files or unresolved dependency errors.

## Fix

Keep bare local dependencies only if the validator proves they resolve in the same registry. Normalize cross-package dependencies to a valid flat namespace such as `@diffgazer-keys/navigation`, or to full hosted registry URLs.

## Acceptance Criteria

- Every bare dependency resolves to exactly one non-hidden local item or an explicitly allowed hidden local dependency.
- Every cross-package dependency uses a configured registry namespace or full URL.
- A clean install of one public item recursively installs the intended sibling items.
- Registry validation fails on unknown bare dependencies, malformed schema URLs, malformed namespaces, and registry/public drift.

## Verification

- Add a validator for local dependency closure and namespace correctness.
- Run clean install fixtures for button, dialog, menu, select, and accordion.
