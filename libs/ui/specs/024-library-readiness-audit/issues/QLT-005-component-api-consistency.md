# QLT-005: Component API and composition contracts are inconsistent

Area: Component API / DX / TypeScript exports
Severity: P2
Effort: Medium

## Problem

Compound root props, controlled-state names, composition patterns, and exported type surfaces are inconsistent across components.

## Evidence

- Some roots accept/spread native DOM props while `Accordion`, `ToggleGroup`, `RadioGroup`, and `CheckboxGroup` use hand-written prop lists: `libs/ui/registry/ui/accordion/accordion.tsx:16`, `libs/ui/registry/ui/toggle-group/toggle-group.tsx:11`, `libs/ui/registry/ui/radio/radio-group.tsx:13`, `libs/ui/registry/ui/checkbox/checkbox-group.tsx:13`.
- Boolean controls use `onChange` while group/value components use `onValueChange`: `libs/ui/registry/ui/checkbox/checkbox.tsx:29`, `libs/ui/registry/ui/radio/radio.tsx:39`.
- Composition mixes `as`, render props, clone-based triggers, and closed unions: `libs/ui/registry/ui/button/button.tsx:58`, `libs/ui/registry/ui/dialog/dialog-trigger.tsx:26`, `libs/ui/registry/ui/popover/popover-trigger.tsx:38`, `libs/ui/registry/ui/card/card.tsx:21`.
- Variant/type exports are uneven across component entrypoints.

## User Impact

Consumers building wrappers, router links, test selectors, analytics handlers, and typed variants need one-off adapters per component.

## Fix

Publish an API matrix:

- `checked/defaultChecked/onCheckedChange`
- `value/defaultValue/onValueChange`
- `open/defaultOpen/onOpenChange`
- `highlightedId/onHighlightChange`

Standardize root DOM prop spreading and composition policy. Export stable public union types where the values are customization inputs.

## Acceptance Criteria

- Public roots consistently accept `id`, `style`, `data-*`, `aria-*`, DOM handlers, and refs unless documented otherwise.
- Deprecated aliases are retained only intentionally.
- Docs identify the blessed composition model.
- Public entrypoints have a deliberate exported type list.

## Verification

- Type fixtures for root props and canonical controlled props.
- RTL tests for root props/ref forwarding and handler composition.
- Declaration/export snapshot for stable public types.

