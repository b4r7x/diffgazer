# QLT-002: Form Control Validity And Required Semantics Are Not SOTA

Area: Form controls

Severity: High

Priority: P2

Effort: L

## Problem

Checkbox, radio, and select use hidden native controls for submission/validity while exposing separate visible ARIA widgets. Required/invalid semantics are inconsistent, especially when `name` is omitted.

## Evidence

- `libs/ui/registry/ui/checkbox/checkbox.tsx:108` renders a hidden native checkbox with validation/submission state.
- `libs/ui/registry/ui/checkbox/checkbox-group.tsx:107` renders hidden group surrogates.
- `libs/ui/registry/ui/radio/radio.tsx:145` renders a hidden native radio.
- `libs/ui/registry/ui/select/select.tsx:136` renders hidden native select controls.
- `libs/ui/registry/ui/select/select-trigger.tsx:53` exposes invalid state on the visible trigger but does not fully expose required semantics.

## User Impact

Browser validation can focus invisible controls while assistive technology users interact with separate ARIA widgets. Users can get confusing focus, missing announcements, or invalid UI that does not map to the visible control.

## Fix

Choose one contract: make the native input/select the real accessible control and style around it, or stop relying on hidden native validity and provide explicit visible validation/focus behavior.

## Acceptance Criteria

- `reportValidity()` focuses and announces the visible control or the component documents a custom validation contract.
- `FormData` remains correct.
- No focusable/validity-owning element is `aria-hidden`.
- Required behavior is consistent with and without `name`, or types/docs require `name` for native form participation.

## Verification

Add browser-level tests for `reportValidity`, submit blocking, focus target, reset, disabled state, `FormData`, and accessible tree behavior. Run `pnpm --filter @diffgazer/ui test`.

