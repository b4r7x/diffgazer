# RDY-001: Copy-first registry dependency closure is incomplete

Area: Registry / shadcn / copy-first installability
Severity: P0
Effort: Small/Medium

## Problem

Some registry items import local hooks/libs that are not present in their resolved registry dependency closure. A clean `dgadd` or local shadcn-style install can copy source files with unresolved `@/hooks/*` or `@/lib/*` imports.

Public npm/hosted registry deployment is future-gated and not counted here. This issue affects local tarball/source-copy handoff today.

## Evidence

- `toast` declares only `spinner`, but `use-toast-container.ts` imports `@/hooks/use-outside-click`: `libs/ui/registry/registry.json:989`, `libs/ui/registry/ui/toast/use-toast-container.ts:4`.
- `toggle-group` does not declare `form-reset`, but `toggle-group.tsx` imports `@/hooks/use-form-reset`: `libs/ui/registry/registry.json:1112`, `libs/ui/registry/ui/toggle-group/toggle-group.tsx:6`.
- `select` does not declare `form-reset`, but `use-select-state.ts` imports `@/hooks/use-form-reset`: `libs/ui/registry/registry.json:1336`, `libs/ui/registry/ui/select/use-select-state.ts:5`.
- hidden `dialog-shell` declares only `presence`, but imports `@/lib/compose-refs`: `libs/ui/registry/registry.json:768`, `libs/ui/registry/ui/shared/dialog-shell.tsx:13`.
- `validate:registry` and `validate:artifacts` both pass today, so this class is not guarded.

## User Impact

Users installing `ui/toast`, `ui/toggle-group`, `ui/select`, or direct hidden registry URLs can receive copied files that fail TypeScript/bundler resolution.

## Fix

Add missing `registryDependencies`:

- `toast`: `outside-click`
- `toggle-group`: `form-reset`
- `select`: `form-reset`
- `dialog-shell`: `compose-refs`, or stop emitting/installing hidden item JSON directly

Add a registry-closure validator that scans item file imports for local `@/hooks/*`, `@/lib/*`, and `@/components/ui/*` references, maps them to registry items, resolves full dependency closure, and fails when an imported local item is missing.

## Acceptance Criteria

- `pnpm --filter @diffgazer/ui validate:registry` fails on missing local source-copy closure.
- `public/r/toast.json`, `public/r/toggle-group.json`, `public/r/select.json`, and relevant artifacts contain corrected dependencies after build.
- Fresh copy-first installs of `ui/toast`, `ui/toggle-group`, and `ui/select` type-check without manually adding helper files.

## Verification

- `pnpm --filter @diffgazer/ui validate:registry`
- `pnpm --filter @diffgazer/ui build`
- `pnpm run validate:artifacts`
- Fresh `dgadd add ui/toast`, `dgadd add ui/toggle-group`, `dgadd add ui/select` fixtures with `tsc --noEmit` and production build.

