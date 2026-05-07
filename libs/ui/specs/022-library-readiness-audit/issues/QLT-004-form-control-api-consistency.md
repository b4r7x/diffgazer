# QLT-004: Form Control APIs And Event Composition Are Inconsistent

Area: Form controls and component DX

Severity: P2

Effort: M

## Problem

Form controls do not present one consistent controlled/uncontrolled, callback, ARIA prop, and event composition model.

## Evidence

- Controlled prop and callback naming varies across `libs/ui/registry/ui/tabs/tabs.tsx:8-10`, `libs/ui/registry/ui/accordion/accordion.tsx:18-19`, `libs/ui/registry/ui/select/select.tsx:12-13`, `libs/ui/registry/ui/radio-group/radio-group.tsx:15`, and `libs/ui/registry/ui/toggle-group/toggle-group.tsx:13`.
- Internal handlers run before consumers can cancel in `libs/ui/registry/ui/select/select-content.tsx:129`, `libs/ui/registry/ui/select/select-content.tsx:151`, `libs/ui/registry/ui/toggle-group/toggle-group.tsx:92`, `libs/ui/registry/ui/toggle-group/toggle-group.tsx:107`, and `libs/ui/registry/ui/command-palette/command-palette-input.tsx:42`.
- `libs/ui/registry/ui/select/select-trigger.tsx:29-31` shows a different, more cancellable composition pattern.
- Disabled anchor rendering overwrites consumer behavior in `libs/ui/registry/ui/button/button.tsx:165`, `libs/ui/registry/ui/button/button.tsx:171-172`, `libs/ui/registry/ui/sidebar/sidebar-item.tsx:103`, and `libs/ui/registry/ui/sidebar/sidebar-item.tsx:108`.
- `libs/ui/registry/ui/select/select.tsx:8`, `libs/ui/registry/ui/select/select.tsx:23`, `libs/ui/registry/ui/select/select.tsx:49`, and `libs/ui/registry/ui/select/select.tsx:88-89` make the root visible div accept only limited props/ref behavior.
- ARIA labelling props are inconsistent: `libs/ui/registry/ui/radio-group/radio-group.tsx:27`, `libs/ui/registry/ui/radio-group/radio-group.tsx:127`, `libs/ui/registry/ui/checkbox/checkbox-group.tsx:28`, `libs/ui/registry/ui/checkbox/checkbox-group.tsx:95`, `libs/ui/registry/ui/toggle-group/toggle-group.tsx:23`, and `libs/ui/registry/ui/toggle-group/toggle-group.tsx:129`.
- `libs/ui/registry/ui/radio/radio.tsx:19` and `libs/ui/registry/ui/radio/radio.tsx:87` allow a standalone radio without a useful submitted value.

## User Impact

Consumers have to learn per-component exceptions, cannot reliably cancel behavior, and can ship forms that submit/reset incorrectly.

## Fix

Create and apply one component API policy.

Concrete fix:

- Standardize controlled naming and callbacks.
- Use one event composition helper that honors `event.defaultPrevented`.
- Preserve consumer handlers for disabled anchors while preventing navigation safely.
- Let root components forward relevant native props and refs.
- Standardize ARIA prop names around native `aria-*` props where possible.
- Require or default a meaningful standalone radio `value`.

## Acceptance Criteria

- Controlled/uncontrolled props follow a documented convention.
- Internal event behavior does not run after consumer cancellation.
- Disabled anchor buttons/sidebar items preserve consumer callbacks and prevent navigation.
- Select root forwards valid div props/ref.
- ARIA prop names are consistent across form controls.

## Verification

- Add API snapshot or type tests for core form controls.
- Add event composition tests using `preventDefault`.
- Add native form submission/reset tests for standalone and grouped controls.

