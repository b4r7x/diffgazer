# QLT-025 - Navigation helper couples behavior to literal role attributes

**Area**: keyboard navigation, accessibility, maintainability  
**Severity**: Medium  
**Effort**: Medium  
**Status**: Open

## Problem

The shared navigation hook finds items with CSS selectors based on literal `role` attributes. Components then add redundant or questionable roles so the helper can find them, coupling DOM semantics to implementation details.

## Evidence

- `libs/keys/src/hooks/use-navigation.ts:57` builds a selector from `[role="${role}"]`.
- `libs/keys/src/hooks/use-navigation.ts:60` queries matching descendants from the container.
- `libs/ui/registry/ui/accordion/accordion-trigger.tsx:36` comments that `role="button"` is redundant on `<button>` but required by `useNavigation`.
- `libs/ui/registry/ui/accordion/accordion-trigger.tsx:40` adds that redundant role.
- `libs/ui/registry/ui/sidebar/sidebar-content.tsx:31` uses `role="menu"` for persistent sidebar navigation, which is already tracked as an accessibility issue in `QLT-008`.

## User Impact

Component semantics can drift from WAI-ARIA/APG patterns because internal keyboard code needs literal roles. Tests may pass because they satisfy selectors rather than because the DOM is accessible.

## Fix

Decouple navigation discovery from ARIA role attributes. Prefer explicit item refs, registered descendants, data attributes such as `data-navigation-item`, or a caller-provided selector that is separate from the accessible role.

## Acceptance Criteria

- Native buttons no longer need redundant `role="button"` for navigation.
- Sidebar navigation can use landmark/list semantics without breaking keyboard behavior.
- Navigation tests assert accessible semantics and keyboard behavior independently.
- `useNavigation` documents how it discovers items without forcing ARIA role misuse.

## Verification

- Update keyboard navigation tests for accordion, tabs, toggle group, radio group, select/menu/listbox, and sidebar.
- Add assertions that redundant roles are absent where native semantics already apply.
