# QLT-007: Behavior Test Coverage Has Important Gaps

Area: Tests and behavior coverage

Severity: P2

Effort: L

## Problem

The UI package has a solid baseline test count, but several high-risk behaviors are either weakly tested or not covered with realistic harnesses.

## Evidence

- `libs/ui/registry/hooks/use-floating-position.ts:193` has important layout/listener behavior, while `libs/ui/registry/hooks/use-floating-position.test.ts:137` does not fully exercise real repositioning and cleanup.
- `libs/ui/registry/hooks/use-overflow.ts:32`, `libs/ui/registry/hooks/use-overflow-items.ts:110`, `libs/ui/registry/hooks/use-overflow.test.ts:10`, and `libs/ui/registry/hooks/use-overflow-items.test.ts:173` need stronger observer/RAF cleanup coverage.
- `libs/ui/registry/ui/popover/use-popover-behavior.ts:75` and `libs/ui/registry/ui/popover/popover.test.tsx:48` leave hover timer/listener behavior under-tested.
- `libs/ui/vitest.config.ts:13`, `libs/ui/registry/ui/button/button.ssr.test.tsx:5`, `libs/ui/registry/ui/button/button.strict.test.tsx:6`, and `libs/ui/registry/ui/logo/logo.test.tsx:20` show SSR/StrictMode coverage is concentrated in a few components.
- `libs/ui/registry/ui/spinner/use-spinner-animation.ts:13`, `libs/ui/registry/ui/spinner/spinner.test.tsx:6`, and `libs/ui/test-setup.ts:20` do not fully prove reduced-motion/timer behavior.
- `libs/ui/registry/ui/empty-state/empty-state.tsx:40`, `libs/ui/registry/ui/label/label.tsx:45`, `libs/ui/registry/ui/input/input.tsx:13`, and `libs/ui/registry/ui/toc/toc-item.tsx:56` point to primitives with minimal behavior coverage.

## User Impact

Regression risk remains high for keyboard/focus behavior, observers, timers, SSR, and StrictMode because the current tests can pass while user-visible bugs remain.

## Fix

Add focused behavior tests around public contracts rather than implementation details.

Concrete fix:

- Use realistic DOM sizing mocks for floating and overflow hooks.
- Verify cleanup for observers, RAF, timers, document listeners, and portals.
- Expand SSR/StrictMode tests to overlays, select, toast, spinner, and empty-state.
- Add primitive behavior tests for label/input/toc/empty-state contracts.

## Acceptance Criteria

- Tests fail if global listeners, observers, RAFs, or timers leak.
- SSR and StrictMode coverage exists for high-risk interactive primitives.
- Floating/overflow tests validate user-visible placement/visibility behavior.
- Primitive tests assert accessible behavior and form association.

## Verification

- Run `pnpm --filter @diffgazer/ui test`.
- Add leak assertions in afterEach for timers/listeners where practical.
- Add coverage-focused tests without snapshot-only assertions.

