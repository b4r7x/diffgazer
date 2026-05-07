# RDY-007: npm Runtime Package Surface Is Too Large

Area: Package distribution and dependency policy

Severity: High

Priority: P1

Effort: M

## Problem

The runtime npm package publishes much more than the runtime import surface, and `figlet` is installed for every `@diffgazer/ui` consumer even though it is only needed by an explicit deep helper.

## Evidence

- `libs/ui/package.json:408` publishes all of `dist`.
- `libs/ui/scripts/build-publish-artifacts.ts:65` copies docs, registry source, generated docs JSON, and public registry artifacts into `dist/artifacts`.
- Local `npm pack --dry-run --json` in `libs/ui` reports `entryCount: 1123` and `unpackedSize: 25,591,925`.
- `libs/ui/package.json:431` includes `figlet` in production dependencies.
- `libs/ui/registry/ui/logo/get-figlet-text.ts:1` imports `figlet`, while the default logo path does not need it.

## User Impact

Normal runtime package consumers pay install/cache/audit cost for non-runtime artifacts and optional figlet support.

## Fix

Publish only runtime JS, CSS, public declarations, and package metadata in the runtime package. Move registry/docs artifacts to a separate artifact package or hosting pipeline. Make `figlet` an optional peer/deep-package dependency, separate package, or documented explicit runtime dependency with a clear tradeoff.

## Acceptance Criteria

- `npm pack --dry-run --json` no longer includes `dist/artifacts/**` or private declaration staging unless they are documented public contract.
- Unpacked size is close to runtime output, not tens of MB.
- Installing normal `@diffgazer/ui` no longer installs `figlet` unless an explicit opt-in path/package is used, or docs state why it is intentionally included.
- `@diffgazer/ui/components/logo` resolves without requiring figlet.

## Verification

Run `npm_config_cache=/private/tmp/npm-cache npm pack --dry-run --json` in `libs/ui`, then install the tarball in a clean consumer and run `pnpm why figlet`.

