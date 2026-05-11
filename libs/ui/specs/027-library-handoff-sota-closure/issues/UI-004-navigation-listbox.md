# UI-004: Listbox, Menu, Sidebar, Accordion, And Typeahead Navigation

Priority: P0

## Problem

UI navigation primitives still have nested composite and boundary gaps.

Known gaps:

- `useListbox` typeahead can update an outer composite when a nested inner composite bubbles a printable key.
- Accordion queries nested triggers because it hand-rolls navigation query instead of owner scoping.
- Boundary handoff is blocked or under-specified because `useNavigation` can prevent default before consumers can hand off.
- `Sidebar.Item value` is optional, but keyboard navigation only discovers items with `data-value`.
- Disabled selected/checked items can still render active state when supplied through controlled/default state.
- Typeahead starts from the first enabled item rather than current active item and does not support repeated-character cycling.
- Menu skips disabled items, while APG menu guidance generally keeps disabled menu items focusable but not activatable.

Evidence:

- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/ui/registry/ui/menu/menu.tsx`
- `libs/ui/registry/ui/menu/menu-item.tsx`
- `libs/ui/registry/ui/navigation-list/navigation-list.tsx`
- `libs/ui/registry/ui/navigation-list/navigation-list-item.tsx`
- `libs/ui/registry/ui/sidebar/sidebar-content.tsx`
- `libs/ui/registry/ui/sidebar/sidebar-item.tsx`
- `libs/ui/registry/ui/accordion/accordion.tsx`
- `libs/ui/registry/ui/accordion/accordion-trigger.tsx`

## Required Fix

- Use keys owner-scoping utilities consistently.
- Scope typeahead to the current composite owner.
- Make boundary callbacks include event/key where needed.
- Make `Sidebar.Item` value required or derive a stable value and document the contract.
- Normalize disabled selected/highlighted handling across listbox/menu/navigation-list.
- Improve typeahead or document supported subset.

## Tests

Add tests for:

- nested listboxes/menus do not update outer highlight via typeahead;
- nested accordion arrow keys do not affect outer accordion;
- boundary handoff gets the triggering key;
- sidebar items without explicit values are either invalid or navigable by derived value;
- disabled selected/checked items have expected ARIA behavior;
- typeahead starts after current item and repeated keys cycle if supported.
