# QLT-012 - Public API consistency and prop forwarding are uneven

**Area**: Component API/DX  
**Priority**: P2  
**Severity**: Medium  
**Effort**: Medium

## Problem

Public component APIs are not consistent in event composition, invalid/error naming, native prop/ref forwarding, variant vocabulary, and internal export boundaries.

## Evidence

- `libs/ui/registry/ui/tabs/tabs-trigger.tsx:38`, `:61`, and `:66` show handler composition risk.
- `libs/ui/registry/ui/stepper/stepper-trigger.tsx:49`/`:61` accepts/ignores or replaces handler behavior.
- `libs/ui/registry/ui/input/input.tsx:9`, `textarea/textarea.tsx:11`, `search-input/search-input.tsx:42`, `checkbox/checkbox.tsx:42`, `radio/radio.tsx:32`, and `select/select.tsx:20` use different invalid/error APIs.
- `libs/ui/registry/ui/select/select-trigger.tsx:8`, `select-item.tsx:49`, `command-palette-item.tsx:24`, and `dialog-content.tsx:27` have uneven native props/ref surfaces.
- `libs/ui/registry/ui/select/index.ts:29` exports internal select context.
- `libs/ui/registry/ui/overflow/overflow-text.tsx:52` uses avoidable `any`.
- Variant names drift across `button.tsx:23`, `badge.tsx:7`, `callout-context.tsx:5`, and `menu-item.tsx:147`.

## User Impact

Consumers cannot predict whether handlers compose, whether native attrs/refs work, or which prop names represent the same semantic state.

## Fix

Add a shared event composition helper, standardize `invalid` semantics with aliases if needed, use `ComponentPropsWithRef` with targeted `Omit`s for DOM parts, stop exporting private contexts unless deliberate, remove avoidable `any`, and normalize severity variant names.

## Acceptance Criteria

- Consumer handlers and internal behavior run consistently.
- Native attrs/refs work on public DOM-emitting parts.
- Form/selectable components share an invalid API.
- Public exports are limited to supported extension points.

## Verification

Behavior tests for event composition plus type/compile fixtures passing refs, `data-*`, ARIA, handlers, and variant aliases.

