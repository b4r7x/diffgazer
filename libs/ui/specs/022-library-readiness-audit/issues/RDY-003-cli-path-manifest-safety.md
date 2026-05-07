# RDY-003: Installer CLI Path And Manifest Safety Is Incomplete

Area: Installer CLI

Severity: P0

Effort: L

## Problem

The CLI accepts project paths and manifest records without a single strict safety boundary. Some paths can be absolute or traverse outside the intended project, keys ownership is incomplete, and manifest paths are not portable across platforms.

## Evidence

- `cli/add/src/context.ts:29` and `cli/add/src/context.ts:95` derive filesystem paths from config aliases without a central project-boundary check.
- `cli/add/src/commands/add.ts:77` and `cli/add/src/commands/add.ts:92` operate on install paths, but safety is applied inconsistently across flows.
- `cli/add/src/commands/diff.ts:30` and `cli/add/src/commands/remove.ts:55` use paths that should share the same resolver as `add`.
- `cli/add/src/commands/add.ts:95`, `cli/add/src/commands/add.ts:137`, and `cli/add/src/commands/add.ts:239` do not give keys installs the same source ownership and manifest semantics as UI installs.
- `cli/add/src/commands/remove.ts:19` and `cli/add/src/commands/remove.ts:49` make non-UI removal awkward or force-based.
- `libs/registry/src/cli/workflows/remove.ts:111` depends on manifest ownership metadata that is not fully namespace-aware.
- `cli/add/src/commands/add.ts:140` stores manifest paths using composed strings, while `cli/add/src/commands/remove.ts:27` computes paths with `relative(...)`, which can diverge on Windows.
- `libs/registry/src/cli/workflows/init.ts:91-94` and `cli/add/src/commands/init.ts:89-96` can leave partial init state without dry-run, skip-install, or rollback coverage.

## User Impact

A failed or malicious config can write outside the expected tree, removal can miss installed files, and Windows consumers can get manifests that do not line up with remove/diff operations.

## Fix

Add one path and manifest ownership layer used by `init`, `add`, `list`, `diff`, and `remove`.

Concrete fix:

- Resolve aliases through a single `resolveProjectPath` helper.
- Reject absolute paths and `..` traversal unless explicitly allowed and still inside the project root.
- Store manifest records in normalized POSIX relative paths.
- Track `sourceName` or namespace for UI and keys installs.
- Make keys add/remove/list/diff first-class, not force-only cleanup.
- Add rollback or transactional writes for `init`.

## Acceptance Criteria

- Every CLI write path is checked against the project root before writing.
- Manifest records are portable across macOS, Linux, and Windows.
- `dgadd add keys:navigation`, `dgadd list`, `dgadd diff`, and `dgadd remove keys:navigation` work without force.
- Invalid alias config fails before any write.
- Interrupted init does not leave an inconsistent manifest/config state.

## Verification

Clean consumer checks:

- Run add/remove/list/diff for `ui:button` and `keys:navigation`.
- Repeat on a project with `components` alias set to `../outside` and verify no writes occur.
- Repeat with Windows-style paths in fixture tests.
- Verify manifest records are stable snapshots.

