# RDY-006 - CLI ownership and path safety are insufficient

**Area**: Installer safety  
**Priority**: P0  
**Severity**: Critical  
**Effort**: Medium/Large

## Problem

The installer can treat matching pre-existing files as installed, adopt skipped files into the manifest, and validate paths lexically instead of through realpath/symlink-safe checks.

## Evidence

- `libs/registry/src/cli/command-helpers.ts:91` treats manifest presence as sufficient and then falls back to existing files.
- `libs/registry/src/cli/workflows/remove.ts:95` collects existing files for removal.
- `libs/registry/src/cli/workflows/remove.ts:112` deletes collected files.
- `libs/registry/src/cli/fs.ts:51` uses `resolve/relative`, not realpath, for containment.
- `libs/registry/src/cli/fs.ts:127` skips existing files by default.
- `cli/add/src/commands/add.ts:197` updates manifest for resolved UI names after apply, regardless of skipped files.

## User Impact

`dgadd remove` can delete user-owned files, and `dgadd add` can mark files as owned even when it did not write them.

## Fix

Record per-file ownership: target path, content hash, source item, registry integrity, CLI version, and integration mode. Remove only owned and unmodified files by default. Validate configured paths with realpath and reject symlink escapes.

## Acceptance Criteria

- Remove never deletes unowned or modified files without `--force`.
- Add does not adopt skipped files without explicit `--adopt`.
- Mutating commands reject symlink/path escapes.

## Verification

Clean fixture tests for pre-existing files, modified installed files, malicious `diffgazer.json`, symlinked install dirs, dry-run, overwrite, and remove.

