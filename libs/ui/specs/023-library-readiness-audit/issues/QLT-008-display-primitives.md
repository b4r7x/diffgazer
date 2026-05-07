# QLT-008: Display Primitive Contracts Need Cleanup

Area: Display primitives

Severity: Medium

Priority: P2

Effort: M

## Problem

Some display primitives have small but user-visible contract gaps: `Callout live` does not work for `variant="info"`, some static primitives are client-only due context APIs, and `KeyValue` has thin behavior coverage.

## Evidence

- `libs/ui/registry/ui/callout/callout.tsx:75` does not map `variant="info" live` to live-region semantics.
- `libs/ui/registry/ui/callout/callout.test.tsx:42` lacks explicit `info live` coverage.
- `libs/ui/registry/registry.json:493` and `registry.json:586` mark context-based display primitives as client entries.
- `libs/ui/registry/ui/block-bar/block-bar-context.tsx:1` and `key-value-context.tsx:1` use React context for static-looking primitives.
- `libs/ui/registry/ui/key-value/key-value.tsx:23` and `key-value-item.tsx:58` have limited behavior coverage.

## User Impact

Info callouts with `live` silently do not announce. Server Component consumers cannot import some static-looking primitives without client boundaries. KeyValue semantic regressions can slip through.

## Fix

Make `live` map non-error variants to `role="status"` or `aria-live="polite"`. Document or split client-only compound APIs for static primitives. Add behavior tests for KeyValue.

## Acceptance Criteria

- `variant="info" live` is discoverable by `getByRole("status")` or equivalent live-region assertion.
- Registry `meta.client` matches intended RSC contract.
- KeyValue tests cover `dl/dt/dd` semantics, layout variants, per-item overrides, and misuse behavior if intended.

## Verification

Run targeted display primitive tests and SSR tests, then `pnpm --filter @diffgazer/ui test`.

