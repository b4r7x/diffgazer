# RDY-002 - @diffgazer/keys registry dependency contract is not safe

**Area**: registry, keyboard integration  
**Severity**: Critical  
**Effort**: Medium  
**Status**: Open

## Problem

`@diffgazer/ui` components depend on `@diffgazer/keys` registry items, but user installs are safe only if:

- the `@diffgazer/keys` namespace is configured or dependencies use full URLs;
- copied keys items are self-contained, including transitive internal imports;
- the CLI recognizes keys dependencies consistently.

## Evidence

- `libs/ui/registry/registry.json` includes `@diffgazer/keys/navigation` dependencies.
- UI source imports navigation hooks through `@/hooks/use-navigation` or package rewrites.
- `libs/keys/registry/registry.json` defines the keys registry payload.
- Keys hook files can import internal helpers; those helpers must be part of copy payloads.
- Current shadcn namespaced registry references are two-part `@namespace/name`; `@diffgazer/keys/navigation` is parsed as namespace `@diffgazer` and resource `keys/navigation`, not as a keys package namespace.
- `libs/keys/src/hooks/use-navigation.ts:9` imports `../internal/navigation-dispatch.js`, but `libs/keys/registry/registry.json:16` only lists `src/hooks/use-navigation.ts`.
- `cli/add/src/generated/keys-copy-bundle.json` has the same copy-closure omission for `navigation`.

## User Impact

Copied UI components can compile with unresolved imports, or registry resolution can fail if the keys namespace is missing.

## Fix

- Use full URLs or publish concrete flat namespace config for both UI and keys.
- Validate that every copied keys item includes its transitive relative import closure.
- Make CLI integration decisions from the resolved dependency graph, not ad hoc metadata.

## Acceptance Criteria

- Installing every keys-dependent UI component succeeds in a clean copied project.
- Copied keys files have no unresolved relative imports.
- Docs include exact registry configuration.

## Verification

- Clean install fixture for accordion, tabs, menu, command palette, and diff view.
- Typecheck copied output.
