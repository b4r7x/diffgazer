# QLT-008 - Sidebar uses menu roles for persistent navigation

**Area**: Sidebar accessibility  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

Persistent sidebar navigation should normally use `nav`, list, link, and button semantics. `menu`/`menuitem` roles imply a composite action menu interaction model.

## Evidence

- `libs/ui/registry/ui/sidebar/sidebar.tsx`
- `libs/ui/registry/ui/sidebar/sidebar-content.tsx`
- `libs/ui/registry/ui/sidebar/sidebar-item.tsx`

## User Impact

Assistive tech users get the wrong interaction model for page navigation.

## Fix

Use navigation semantics and `aria-current` for active routes unless the component implements a true menu pattern.

## Acceptance Criteria

- Sidebar navigation no longer exposes menu semantics by default.
- Active route is announced correctly.

## Verification

- Role/name tests for nav and links.

