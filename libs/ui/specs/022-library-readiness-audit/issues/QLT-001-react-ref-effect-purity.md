# QLT-001: React Ref And Effect Anti-Patterns Remain

Area: React hooks, refs, effects, controlled state

Severity: P2

Effort: L

## Problem

Several hooks and components still use refs as render-affecting state, write refs during render, or use effects to repair state that can be derived synchronously. This is the highest-priority component-quality issue from this audit.

React 19 guidance still expects render to be pure: refs are for DOM or mutable values that do not affect rendering, and effects are for external synchronization rather than derived UI state.

## Evidence

- `libs/ui/registry/hooks/use-navigation.ts:214-230` writes `focusIndexRef.current` and `moveRef.current` during render/handler setup.
- `libs/ui/registry/hooks/use-outside-click.ts:124-156` uses latest-handler refs written during render.
- `libs/ui/registry/hooks/use-active-heading.ts:102` and `libs/ui/registry/hooks/use-active-heading.ts:111` write handler/state refs during render.
- `libs/ui/registry/hooks/use-overflow-items.ts:58` and `libs/ui/registry/hooks/use-overflow-items.ts:61` write refs during render.
- `libs/ui/registry/hooks/use-toast-container.ts:12-13` writes latest callback refs during render.
- `libs/ui/registry/ui/select/use-select-state.ts:62` and `libs/ui/registry/ui/select/use-select-state.ts:89` store render-visible option labels in a mutable ref.
- `libs/ui/registry/ui/select/select-content.tsx:116`, `libs/ui/registry/ui/select/select-content.tsx:118`, and `libs/ui/registry/ui/select/select-content.tsx:194` use width refs as render/layout-affecting state.
- `libs/ui/registry/hooks/use-listbox.ts:83` and `libs/ui/registry/hooks/use-listbox.ts:149-165` read DOM/ref state during render and force a layout-effect rerender.
- `libs/ui/registry/ui/tabs/tabs.tsx:31-54` repairs selected tab state from an effect and can call `onValueChange` from that effect.
- `libs/ui/registry/ui/diff-view/diff-view.tsx:131-134` resets `activeHunk` from an effect after parsed changes update.
- `libs/ui/registry/ui/empty-state/empty-state.tsx:40-52` suppresses live-region behavior until a mount effect runs.

## User Impact

These patterns are brittle under StrictMode, concurrent rendering, SSR hydration, and future React compiler expectations. They can cause stale UI, missed updates, hydration differences, and hard-to-reproduce keyboard/focus bugs.

## Fix

Remove render-affecting refs and effect-driven derived state.

Concrete fix:

- Replace latest-handler refs with React 19 `useEffectEvent` where available, or commit-phase ref updates when event identity truly must be stable.
- Move option labels, trigger width, item registration, and listbox item collections into React state or external stores with `useSyncExternalStore` semantics.
- Derive fallback selected tab/hunk state during render without firing consumer callbacks from effects.
- Keep refs for DOM nodes, timers, observers, and non-rendering mutable values only.
- Add lint/test coverage that catches `.current =` writes outside effects, event handlers, or safe one-time initialization.

## Acceptance Criteria

- No component or hook writes render-affecting `.current` values during render.
- No hook uses a dummy state update only to force React to notice a ref mutation.
- Controlled components do not call consumer `onValueChange` from synchronization effects.
- SSR and StrictMode tests pass for navigation, select, tabs, diff view, toast, and empty-state flows.
- A targeted grep or lint rule documents allowed ref writes and rejects the patterns above.

## Verification

- Add StrictMode tests around `useNavigation`, `useListbox`, `Select`, `Tabs`, and `DiffView`.
- Add SSR/hydration tests for `EmptyState`, `Select`, `Tabs`, and `Toast`.
- Run `pnpm --filter @diffgazer/ui test` and `pnpm --filter @diffgazer/ui type-check`.
- Review `rg "\.current\s*=" libs/ui/registry` results and classify every remaining write.

