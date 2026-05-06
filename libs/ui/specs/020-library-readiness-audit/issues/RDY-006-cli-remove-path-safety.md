# RDY-006 - CLI remove and path safety need ownership metadata

**Area**: CLI safety  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

Remove/diff flows must not operate on files outside the project or delete user-owned files that merely match a registry path. Safe removals require manifest ownership and content hashes.

## Evidence

- `cli/add/src/context.ts` resolves project config.
- `cli/add/src/commands/remove.ts` owns removal behavior.
- `cli/add/src/commands/diff.ts` owns diff behavior.

## User Impact

Users can lose hand-written files or let a bad config point commands outside the intended project tree.

## Fix

- Store installed file paths, source item, registry integrity, content hash, CLI version, and integration mode.
- Remove only files whose current hash matches the installed hash, unless `--force`.
- Validate all configured paths against project `cwd` using real paths.

## Acceptance Criteria

- Unknown existing files are not deleted by default.
- Config paths outside the project are rejected.
- Symlink escapes are rejected for mutating commands.

## Verification

- Temp project with pre-existing component file.
- Temp project with config pointing outside root.
- Temp project with symlinked component dir.

