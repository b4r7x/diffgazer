# QLT-004 - Tabs can lose active state and event behavior

**Area**: Tabs API and behavior  
**Priority**: P2  
**Severity**: High  
**Effort**: Medium

## Problem

Tabs can render with no selected/focusable tab, memoize stale change callbacks, and let consumer handlers replace internal behavior instead of composing consistently.

## Evidence

- `libs/ui/registry/ui/tabs/tabs.tsx:33` defaults uncontrolled value to `""`.
- `libs/ui/registry/ui/tabs/tabs.tsx:37` memoizes context.
- `libs/ui/registry/ui/tabs/tabs.tsx:39` omits `setValue` from memo dependencies.
- `libs/ui/registry/ui/tabs/tabs-trigger.tsx:57` tab state depends on value matching.
- `libs/ui/registry/ui/tabs/tabs-content.tsx:24` hides non-active panels.
- `libs/ui/registry/ui/tabs/tabs-trigger.tsx:61` and `:66` show consumer/internal handler composition risk.

## User Impact

All tabs can become `tabIndex=-1`, all panels can hide, and updated `onValueChange` callbacks may not run.

## Fix

Register enabled tab values, initialize uncontrolled tabs to the first enabled tab or require a value/defaultValue, reconcile removed/disabled active values, include `setValue` in memo dependencies, and standardize event composition.

## Acceptance Criteria

- Exactly one enabled tab is selected/tabbable when tabs exist.
- Replacing `onValueChange` uses the new callback.
- Consumer `onClick` can compose with internal selection.

## Verification

Tests for no default value, active tab removed/disabled, controlled stale value, callback rerender, and handler composition.

