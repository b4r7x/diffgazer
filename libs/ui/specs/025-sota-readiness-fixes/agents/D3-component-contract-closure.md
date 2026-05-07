# Agent D3: Component Contract Closure

Model: `gpt-5.5`
Reasoning: medium
Mode: implementation

## Objective

Close the remaining small component contract defects needed for a 5/5 quality result.

## Write Ownership

Primary:

- `libs/ui/registry/ui/stepper/stepper.tsx`
- `libs/ui/registry/ui/stepper/stepper-context.tsx`
- `libs/ui/registry/ui/stepper/stepper-trigger.tsx`
- `libs/ui/registry/ui/stepper/stepper-content.tsx`
- `libs/ui/registry/ui/stepper/stepper.test.tsx`
- `libs/ui/registry/ui/tabs/tabs.tsx`
- `libs/ui/registry/ui/tabs/tabs-list.tsx`
- `libs/ui/registry/ui/tabs/tabs.test.tsx`
- `libs/ui/registry/ui/menu/menu.tsx`
- `libs/ui/registry/ui/menu/menu-item.tsx`
- `libs/ui/registry/ui/menu/menu.test.tsx`
- `libs/ui/registry/ui/navigation-list/navigation-list.tsx`
- `libs/ui/registry/ui/navigation-list/navigation-list.test.tsx`
- `libs/ui/registry/ui/key-value/key-value.tsx`
- `libs/ui/registry/ui/key-value/key-value-item.tsx`
- `libs/ui/registry/ui/key-value/key-value.test.tsx`
- `libs/ui/registry/ui/block-bar/block-bar.tsx`
- `libs/ui/registry/ui/block-bar/block-bar.test.tsx`
- `libs/ui/registry/ui/overflow/overflow-items.tsx`
- `libs/ui/registry/ui/overflow/overflow.test.tsx`

Coordinate before touching:

- docs files owned by D2
- generated artifacts

## Requirements

- Read `spec.md`, `P1-006`, and `P2-002`.
- Fix Stepper dangling `aria-controls`: no emitted IDREF may point to a missing panel.
- Fix Tabs nested scan so parent Tabs do not collect nested Tabs triggers.
- Fix Menu/Listbox IDREF safety: Menu item DOM IDs must align with encoded active-descendant generation, and falsy-value checks must treat empty string as valid where supported.
- Fix KeyValue horizontal/bordered layout contract or narrow docs via handoff to D2 if runtime should not change.
- Define and test BlockBar mixed `segments` + `children` behavior if easy; otherwise document it for D2.
- Add focused tests for Stepper, Tabs, Menu, NavigationList, KeyValue, BlockBar/Overflow where touched.

## Acceptance Criteria

- Every emitted `aria-controls` and `aria-activedescendant` resolves to an existing element.
- Nested Tabs do not affect parent active/fallback values.
- KeyValue layout matches docs.
- Mixed API ambiguity is removed or documented.

## Verification

Run focused component tests and `@diffgazer/ui type-check`.

