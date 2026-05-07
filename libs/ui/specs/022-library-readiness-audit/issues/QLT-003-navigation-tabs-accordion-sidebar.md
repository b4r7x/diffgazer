# QLT-003: Navigation, Tabs, Accordion, And Sidebar Need State/A11y Hardening

Area: Navigation and data components

Severity: P2

Effort: M

## Problem

Navigation primitives have inconsistent state, keyboard, selector, and accessibility semantics. The issues are individually manageable but affect core components users will compose heavily.

## Evidence

- `libs/ui/registry/ui/tabs/tabs.tsx:31` can first render without a selected tab.
- `libs/ui/registry/ui/tabs/tabs-trigger.tsx:49` and `libs/ui/registry/ui/tabs/tabs-trigger.tsx:75` can make all triggers `tabIndex={-1}` until registration effects run.
- `libs/ui/registry/ui/tabs/tabs-content.tsx:24` depends on selected tab state that is repaired later.
- `libs/ui/registry/hooks/use-navigation.ts:133-145` falls back to `[data-value]`, which can include nested unrelated values.
- `libs/ui/registry/ui/accordion/accordion-trigger.tsx:40` and `libs/ui/registry/ui/sidebar/sidebar-item.tsx:81` use navigation metadata differently.
- `libs/ui/registry/ui/accordion/accordion-trigger.tsx:33` and `libs/ui/registry/ui/accordion/accordion-trigger.tsx:43-44` disable a non-collapsible open accordion trigger with native `disabled` instead of a focusable `aria-disabled` pattern.
- `libs/ui/registry/ui/sidebar/sidebar-content.tsx:23` runs internal key handling before consumer handlers can cancel.
- `libs/ui/registry/ui/sidebar/sidebar-provider.tsx:20`, `libs/ui/registry/ui/sidebar/sidebar-trigger.tsx:19`, and `libs/ui/registry/ui/sidebar/sidebar.tsx:37` do not expose a complete collapse/controls accessibility contract.

## User Impact

Keyboard users can lose the active tab stop, accordion users can lose focusability on disabled-but-current controls, and consumers cannot reliably override keyboard behavior.

## Fix

Normalize navigation state and event sequencing across navigation components.

Concrete fix:

- Derive a valid initial tab synchronously from children/props, or require/default an explicit value.
- Replace broad `[data-value]` fallback with component-specific roles or registered item IDs.
- Use focusable `aria-disabled` for non-collapsible open accordion triggers.
- Compose keyboard handlers so consumer prevention is honored.
- Add `aria-controls`/expanded/collapsed state for sidebar trigger and controlled regions.

## Acceptance Criteria

- Tabs always have exactly one tabbable trigger on first paint when enabled tabs exist.
- Navigation selectors cannot pick nested unrelated `data-value` nodes.
- Non-collapsible accordion triggers remain focusable and expose `aria-disabled`.
- Sidebar trigger and content expose a coherent collapsed/expanded contract.
- User `preventDefault` on key handlers is respected where documented.

## Verification

- Add first-render tests for Tabs.
- Add nested `data-value` regression tests for navigation.
- Add accordion keyboard/a11y tests for non-collapsible items.
- Add sidebar trigger aria and keyboard composition tests.

