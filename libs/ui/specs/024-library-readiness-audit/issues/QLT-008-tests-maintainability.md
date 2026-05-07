# QLT-008: Test and maintainability confidence gaps remain

Area: Tests / maintainability / anti-slop
Severity: P2
Effort: Medium

## Problem

The suite is strong overall, but a few coverage and maintainability gaps reduce confidence and make future drift more likely.

## Evidence

- UI and Keys have duplicated navigation cores: `libs/ui/registry/hooks/use-navigation.ts:57`, `libs/keys/src/hooks/use-navigation.ts:9`.
- `ToggleGroup` fabricates React keyboard events via `Object.create(e, { key })`: `libs/ui/registry/ui/toggle-group/toggle-group.tsx:103`.
- `KeyValue` is exported but has no direct behavior/a11y/SSR test: `libs/ui/package.json:116`, `libs/ui/registry/ui/key-value/key-value.tsx:23`.
- `useNavigation` tests are more implementation-coupled than surrounding component tests: `libs/ui/registry/hooks/testing/use-navigation.test.tsx:10`.
- Small anti-slop leftovers exist, such as redundant aliasing in command palette state and test-only `any` in compose refs.

## User Impact

Future changes can create behavior drift between copy-first UI hooks and `@diffgazer/keys`, while some exported components can regress without direct tests.

## Fix

- Centralize shared navigation primitives or generate/validate parity between UI and Keys.
- Replace fake event mapping with explicit key options in `useNavigation`.
- Add direct tests for `KeyValue`, `Kbd.Group`, `Badge` variants/dot output, and consumer-style navigation behavior.
- Remove minor redundant aliases and test-only `any`.

## Acceptance Criteria

- UI and Keys navigation behavior is covered by the same matrix.
- No synthetic event wrapper is needed for ToggleGroup cross-axis keys.
- Exported display primitives have direct behavior or SSR tests.
- Hook tests include consumer-observable role/name/focus assertions where practical.

## Verification

- UI and Keys navigation tests.
- ToggleGroup cross-axis keyboard tests.
- `pnpm --filter @diffgazer/ui test`
- `pnpm --filter @diffgazer/keys test`

