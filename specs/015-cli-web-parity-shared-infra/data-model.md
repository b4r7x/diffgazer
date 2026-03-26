# Data Model: 015-cli-web-parity-shared-infra

**Date**: 2026-03-26

## Entities

This feature is an audit-and-refine of existing code. No new data entities are introduced. The following entities already exist and are relevant to the work:

### Screen (CLI concept)

A full-page terminal view equivalent to a web route. Already defined in `apps/cli/src/app/routes.ts`.

```
Route =
  | { screen: "home" }
  | { screen: "onboarding" }
  | { screen: "review"; reviewId?: string; mode?: "unstaged" | "staged" }
  | { screen: "history" }
  | { screen: "help" }
  | { screen: "settings" }
  | { screen: "settings/theme" | "settings/providers" | "settings/storage" | ... }
```

**No changes needed** — all 14 screens already exist.

### Breakpoint (NEW — shared constant)

Responsive layout breakpoint tiers shared between CLI and web.

```
BreakpointTier = "narrow" | "medium" | "wide"

BREAKPOINTS = {
  narrow: { maxColumns: 79, maxPx: 767 },
  medium: { minColumns: 80, maxColumns: 119, minPx: 768, maxPx: 1023 },
  wide:   { minColumns: 120, minPx: 1024 },
}
```

**Location**: `packages/core/src/layout/breakpoints.ts` (new file)

### ScopeStack (existing, needs fix)

Keyboard scope stack in the CLI keyboard provider. Currently broken due to stale closure.

```
scopeStack: string[]   // Currently useState, needs to be useRef
activeScope: string | null  // Derived: last element of scopeStack
```

**Fix location**: `apps/cli/src/app/providers/keyboard-provider.tsx`

## State Transitions

### Review Phase State Machine (existing, no changes)

```
CLI:  loading → streaming → completing → summary → results
Web:  loading → streaming → summary → results (URL-synced)
```

Both use shared `useReviewStart` and `useReviewCompletion` hooks. Per-app `useReviewLifecycle` handles platform-specific transitions. No changes needed.

### Keyboard Scope Lifecycle (existing, needs fix)

```
Screen mounts → pushScope(name) → scopeStackRef.current = [...prev, name]
Screen unmounts → popScope() → scopeStackRef.current = prev.slice(0, -1)
```

Current bug: `useState` captured in stale closure. Fix: `useRef` for stack, `useState` for re-render trigger only.
