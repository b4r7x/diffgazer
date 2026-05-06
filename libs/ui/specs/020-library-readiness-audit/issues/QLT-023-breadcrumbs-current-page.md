# QLT-023 - Breadcrumbs visually imply the current page without announcing it

**Area**: accessibility, navigation primitives  
**Severity**: Medium  
**Effort**: Small  
**Status**: Open

## Problem

`Breadcrumbs` visually styles the last item as the current page when no child has `aria-current`, but the current-page state is only announced if the consumer remembers to pass `current` to `BreadcrumbsItem`.

## Evidence

- `libs/ui/registry/ui/breadcrumbs/breadcrumbs.tsx:22` styles the last item when no descendant has `aria-current`.
- `libs/ui/registry/ui/breadcrumbs/breadcrumbs-item.tsx:23` only sets `aria-current="page"` when the caller passes `current`.
- `libs/ui/registry/ui/breadcrumbs/breadcrumbs-link.tsx:16` does not provide a current-page shortcut or warning for the terminal link.

## User Impact

Sighted users see a bold final crumb while screen-reader users may not get the same "current page" state. This creates a common silent accessibility miss in navigation.

## Fix

Make the current-page contract explicit. Either require `current` and remove the automatic visual fallback, or derive current semantics for the terminal non-link crumb in a documented, tested way.

## Acceptance Criteria

- Visual current-page styling and `aria-current="page"` cannot diverge in the default component path.
- Tests cover breadcrumbs with explicit current item, no current item, and terminal link/non-link cases.
- Docs examples show the accessible current-page pattern.

## Verification

- Add RTL assertions for `aria-current`.
- Add an accessibility test for generated docs breadcrumb examples.
