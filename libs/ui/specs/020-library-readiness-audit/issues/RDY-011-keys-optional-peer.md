# RDY-011 - @diffgazer/keys is optional but statically imported

**Area**: npm dependency contract  
**Severity**: Critical  
**Effort**: Medium  
**Status**: Open

## Problem

`@diffgazer/keys` is marked optional in the npm package, but public component entries can statically import it after alias rewriting.

Optional peer dependencies are safe only when imports are optional or isolated behind separate entrypoints.

## Evidence

- `libs/ui/package.json` lists `@diffgazer/keys` as a peer.
- `libs/ui/package.json` marks `@diffgazer/keys` optional.
- `libs/ui/tsup.config.ts` externalizes keys hooks to `@diffgazer/keys`.
- Key-dependent components include accordion, tabs, menu-like navigation, command palette, and diff view.

## User Impact

Users can install `@diffgazer/ui` without `@diffgazer/keys` and later get module resolution failures by importing ordinary documented components.

## Fix

Choose one contract:

- Make `@diffgazer/keys` a required peer.
- Split keys-dependent components into clearly documented exports.
- Bundle or copy the needed keyboard helpers into `@diffgazer/ui`.
- Remove static keys imports from default public entries.

## Acceptance Criteria

- Importing any documented component never fails because an optional peer is absent.
- Peer warnings match actual runtime requirements.

## Verification

- Clean fixture with `@diffgazer/ui` only.
- Clean fixture with `@diffgazer/ui @diffgazer/keys`.

