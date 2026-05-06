# QLT-006 - ARIA/live-region details drift from APG expectations

**Area**: Accessibility semantics  
**Priority**: P2  
**Severity**: Medium  
**Effort**: Medium

## Problem

Several components expose roles or live-region semantics that are close but not APG-grade.

## Evidence

- `libs/ui/registry/ui/command-palette/command-palette-list.tsx:17` renders an unnamed listbox.
- `libs/ui/registry/ui/select/select-empty.tsx:19` renders plain empty content inside listbox.
- `libs/ui/registry/ui/command-palette/command-palette-empty.tsx:16` does the same.
- `libs/ui/registry/ui/popover/popover-trigger.tsx:115` can give non-native hover triggers `role="button"`.
- `libs/ui/registry/ui/popover/popover-trigger.tsx:122` and `:123` set focus/handlers without Enter/Space activation for passive triggers.
- `libs/ui/registry/ui/menu/menu-item.tsx:188` uses `aria-current` for selected menu items.
- `libs/ui/registry/ui/toast/toast-container.tsx:25` uses `role="log"`.
- `libs/ui/registry/ui/toast/toast-container.tsx:27` keeps live behavior polite.

## User Impact

Screen reader users can get generic listbox announcements, invalid listbox children, misleading button roles, wrong menu selection announcements, or delayed error toast announcements.

## Fix

Name command/listbox popups, move empty states outside listbox or render disabled options/status, add keyboard activation or remove button semantics for passive triggers, split selectable menus into proper checked menu item roles, and make error toasts assertive.

## Acceptance Criteria

- Listbox popups have names.
- Empty states are valid listbox/status children.
- Trigger role matches keyboard behavior.
- Error toasts use assertive semantics.

## Verification

Accessible role/name tests, keyboard activation tests, axe checks, and APG-specific assertions for select/command/menu/toast.

