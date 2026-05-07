# RDY-010: Dependency Policy And Runtime Surface Need Cleanup

Area: Dependency policy and runtime surface

Severity: P1

Effort: M

## Problem

The public dependency story is not tight enough. Keys declares an apparently unused runtime dependency, Logo pulls a large ASCII-art dependency through the default component surface, and copy-first dependency behavior is not proven in smoke tests.

## Evidence

- `libs/keys/package.json:80` declares `zod`, while source search found no `zod` import in keys source.
- `libs/ui/docs/content/integrations/keys.mdx:8` describes keys as a small integration, creating tension with an unexplained dependency.
- `libs/ui/registry/ui/logo/index.ts:1-2` re-exports Logo and figlet helpers together.
- `libs/ui/registry/ui/logo/get-figlet-text.ts:1-3` imports `figlet`.
- `libs/ui/package.json:402-406` includes `figlet` in runtime dependencies.
- `cli/add/scripts/bundle-registry.ts:10`, `libs/registry/src/cli/workflows/init.ts:98-100`, and `cli/add/src/commands/add.ts:185-187` encode dependency install behavior, but clean copy-first dependency smoke coverage is limited.

## User Impact

Consumers can install extra dependencies they do not need, see larger bundles than expected, or hit missing dependency issues in copy-first mode that CI did not exercise.

## Fix

Make dependency policy explicit and tested.

Concrete fix:

- Remove `zod` from keys if unused, or document and test the runtime that needs it.
- Split Logo figlet helpers from the default `components/logo` export if they are optional.
- Decide whether `figlet` is an optional/deep import dependency or a documented runtime dependency.
- Add copy-first smoke tests that prove dependency installation for components using CVA, clsx, tailwind-merge, and optional helpers.

## Acceptance Criteria

- `@diffgazer/keys` dependencies match actual imports.
- Importing `@diffgazer/ui/components/logo` does not pull `figlet` unless the API explicitly promises that behavior.
- Copy-first install of dependency-heavy components builds in a clean project.
- Docs list runtime dependencies accurately.

## Verification

- Run dependency graph checks against package source.
- Bundle-analyze a clean consumer importing `Logo`.
- Copy-install `button`, `select`, `logo`, and `keys:navigation`, then build.

