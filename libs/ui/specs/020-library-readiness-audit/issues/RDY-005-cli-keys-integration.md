# RDY-005 - CLI keys integration modes can generate broken installs

**Area**: CLI add flow  
**Severity**: Critical  
**Effort**: Medium  
**Status**: Open

## Problem

The installer must handle `@diffgazer/keys` consistently. If it skips keys copy/package integration while UI files still import keys hooks, the generated project is broken.

## Evidence

- `cli/add/src/utils/add-integration.ts` owns integration decision logic.
- `cli/add/src/commands/add.ts:171` selects integration from the initially requested UI names before `cli/add/src/commands/add.ts:174` resolves transitive registry dependencies.
- `cli/add/src/commands/add.ts:175` then detects needed keys hooks only after dependency resolution.
- UI registry items depend on `@diffgazer/keys/navigation`.
- UI source imports navigation hooks in multiple components.
- `cli/add/src/utils/transform.ts:165` rewrites `@/hooks/<keys-hook-name>`, while copied UI source imports `@/hooks/use-navigation`.
- `cli/add/src/utils/transform.test.ts:78` tests `@/hooks/navigation`, so package-mode rewrite coverage does not match current source imports.

## User Impact

`dgadd add accordion` or a similar command can create files with unresolved imports or silently omit required keyboard behavior.

## Fix

- Resolve the full registry dependency graph first.
- Infer keys integration from resolved `@diffgazer/keys/*` dependencies and source imports.
- Make package-mode rewrite understand generated hook filenames such as `use-navigation`.
- Make copy mode include the complete keys hook import closure.
- Make any "none" mode either produce no-op hooks, remove integration code, or be removed.

## Acceptance Criteria

- Every keys-dependent component triggers a consistent integration decision.
- No integration mode leaves unresolved imports.
- Command-level tests cover copy, package, and none/disabled modes if present.

## Verification

- Temp project tests for accordion, tabs, menu, command palette, and diff view.
