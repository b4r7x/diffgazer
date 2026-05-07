# QLT-005: Component API And DX Consistency Needs Cleanup

Area: Component API consistency and DX

Severity: Medium

Priority: P2

Effort: M

## Problem

Selection group callback names and root DOM prop passthrough are inconsistent across components.

## Evidence

- `libs/ui/registry/ui/checkbox/checkbox-group.tsx:13` exposes only `onChange`, while docs mention `onValueChange`.
- `libs/ui/registry/ui/radio/radio-group.tsx:13` exposes only `onChange`, while docs mention `onValueChange`.
- `libs/ui/docs/content/patterns/keyboard-navigation.mdx:82` references `onValueChange` conventions.
- Root prop passthrough is inconsistent in `accordion.tsx:16`, `toggle-group.tsx:11`, `menu.tsx:20`, and `navigation-list.tsx:9`.
- `libs/ui/registry/component-docs/search-input.ts:10` overstates that every component follows native-like `value + onChange`.

## User Impact

Docs copy/paste can fail, consumers cannot reliably attach `id`, `data-*`, `aria-describedby`, analytics, or test attributes to roots, and controlled-state naming feels inconsistent.

## Fix

Add `onValueChange` as the primary selection/root-state callback for CheckboxGroup and RadioGroup while keeping `onChange` as a deprecated alias. Extend root DOM prop types and spread valid rest props onto rendered roots.

## Acceptance Criteria

- CheckboxGroup and RadioGroup support `onValueChange` and deprecated `onChange`.
- Docs/API tables match generated props.
- Root components accept valid DOM/ARIA/data props.
- Native-input-like components document `onChange`; selection/root-state components document `onValueChange`.

## Verification

Run component tests covering both callback names and root prop passthrough. Run docs generation and type-check.

