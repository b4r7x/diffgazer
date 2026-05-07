# RDY-008: Public Export Contract Exposes Hidden Internals

Area: npm package exports and public API

Severity: Medium

Priority: P1

Effort: S

## Problem

Hidden registry internals are exported as public npm subpaths, making internal implementation details part of the semver contract.

## Evidence

- `libs/ui/registry/registry.json:250` and `libs/ui/registry/registry.json:768` mark internals such as `portal` and `dialog-shell` hidden.
- `libs/ui/package.json:266` and `libs/ui/package.json:272` export `@diffgazer/ui/components/portal` and `@diffgazer/ui/components/dialog-shell`.
- Local package smoke confirms package exports resolve, so these paths are real public subpaths.

## User Impact

Consumers can depend on internal primitives that were intended to stay hidden. Later refactors become breaking changes.

## Fix

Either remove hidden items from package exports/declaration generation or intentionally document and support them as public primitives by changing registry metadata and docs.

## Acceptance Criteria

- Hidden registry items are not exportable from npm unless intentionally documented.
- Export validation fails when `meta.hidden` items appear in `package.json#exports`.
- Docs and registry metadata match the public package surface.

## Verification

Add export-map validation to `validate:artifacts` or `validate:registry`; run `pnpm --filter @diffgazer/ui build`, `pnpm run validate:artifacts`, and package import smoke.

