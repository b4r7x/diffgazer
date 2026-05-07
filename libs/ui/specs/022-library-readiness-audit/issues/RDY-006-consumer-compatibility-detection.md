# RDY-006: Consumer Compatibility Detection Is Too Narrow

Area: Consumer compatibility

Severity: P1

Effort: M

## Problem

Project detection and source transforms assume a narrow set of consumer layouts. Vite aliases, TypeScript config layouts, Next version detection, RSC transforms, and Windows paths need broader handling before handoff.

## Evidence

- `cli/add/src/utils/detect.ts:18` only recognizes the `@/*` alias shape.
- `libs/registry/src/cli/fs.ts:125` reads only `tsconfig.json` or `jsconfig.json`, missing common `tsconfig.app.json`, references, and extends.
- `cli/add/src/utils/detect.ts:29` can miss non-semver or prerelease Next versions.
- `cli/add/src/utils/transform.ts:146` can strip existing `"use client"` when RSC mode is false.
- `cli/add/src/registry.ts:37` defaults missing metadata to client behavior.
- `libs/ui/registry.json:1721` has pure lib entries that should be explicitly server-safe.
- `libs/registry/src/cli/workflows/init.ts:106-110` strips only POSIX-style source prefixes and writes aliases from strings.

## User Impact

Real Vite, Next, TypeScript, and Windows projects can get incorrect aliases, missing client directives, unnecessary client boundaries, or broken imports after installation.

## Fix

Broaden detection and make transforms metadata-driven.

Concrete fix:

- Resolve aliases through TypeScript config references/extends where practical.
- Support Vite's common `tsconfig.app.json` setup.
- Detect Next from package manager metadata and tolerate prerelease versions.
- Preserve existing `"use client"` directives unless an explicit transform requires removal.
- Add `meta.client: false` to pure lib/server-safe items.
- Normalize source paths through platform-independent helpers.

## Acceptance Criteria

- Vite projects using `tsconfig.app.json` resolve aliases correctly.
- Next prerelease/non-standard versions are detected or fail with a clear prompt.
- Existing client directives are never silently stripped.
- Pure lib files install without unnecessary client directives.
- Windows fixture tests pass.

## Verification

Create clean fixtures for:

- Vite with `tsconfig.app.json` and `@/*`.
- Vite with a custom alias.
- Next App Router with current stable and prerelease package metadata.
- Windows path snapshots for init/add output.

