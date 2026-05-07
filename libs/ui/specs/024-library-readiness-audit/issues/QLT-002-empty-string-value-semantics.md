# QLT-002: Empty string values are treated as no value in navigation and Select

Area: React state / controlled values / navigation
Severity: P1
Effort: Medium

## Problem

Valid empty string item values are treated as absent in navigation/select code because checks rely on truthiness instead of explicit null/undefined semantics.

## Evidence

- UI `useNavigation` checks `if (highlighted)`, `if (!el?.dataset.value)`, and `if (!highlighted)`: `libs/ui/registry/hooks/use-navigation.ts:210`, `libs/ui/registry/hooks/use-navigation.ts:221`, `libs/ui/registry/hooks/use-navigation.ts:242`.
- Keys `useNavigation` has the same pattern: `libs/keys/src/hooks/use-navigation.ts:147`, `libs/keys/src/hooks/use-navigation.ts:158`, `libs/keys/src/hooks/use-navigation.ts:180`.
- Select content init/Tab commit uses truthy selected/highlighted checks: `libs/ui/registry/ui/select/select-content.tsx:115`, `libs/ui/registry/ui/select/select-content.tsx:152`.
- `toSelectedArray` collapses `""` to no selection: `libs/ui/registry/ui/select/select-utils.ts:5`.

## User Impact

`value=""` can render as placeholder, fail initial highlight, fail keyboard activation, or fail navigation callbacks. This is a controlled-state correctness bug, not a ref/effect issue.

## Fix

Choose an explicit contract:

- Preferred: represent no selection as `null`, keep `""` as a valid option value, and replace truthy checks with `value != null`.
- Alternative: reject/document empty-string values and validate in dev.

## Acceptance Criteria

- Controlled Select with `value=""` displays the empty-value item.
- Opening Select highlights the empty-value item when selected.
- Enter/Space/Tab can activate an empty-string highlighted item.
- UI and Keys `useNavigation` call callbacks with `""` when `data-value=""`.

## Verification

- Add UI and Keys `useNavigation` empty-string tests.
- Add Select single-mode controlled/default value tests for `""`.
- Run UI and Keys hook/component tests.

