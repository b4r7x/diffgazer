# Quickstart: 015-cli-web-parity-shared-infra

**Date**: 2026-03-26

## Context

This is an audit-and-refine feature. The CLI app already exists with 14 screens, 18 Ink components, and shared hooks integration. The work is:

1. Fix critical navigation bug (HOME-NAV-001)
2. Add missing review detail components (Trace tab, Patch tab, interactive fix plan, etc.)
3. Implement shared responsive breakpoints with live detection
4. Cross-workspace quality audit with all findings fixed

## Prerequisites

```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm run bootstrap          # init submodules + install
pnpm run build              # build all packages
```

## Key Directories

```
diffgazer/
├── apps/cli/src/            # CLI app (Ink 6 + React 19)
│   ├── app/                 # Providers, router, screens
│   │   ├── providers/       # keyboard-provider.tsx (BUG 1 HERE)
│   │   ├── screens/         # 14 screen components
│   │   └── navigation-context.tsx
│   ├── features/            # Feature modules (review, history, etc.)
│   ├── components/ui/       # 18 Ink UI components
│   └── hooks/               # CLI-specific hooks (use-scope.ts BUG 2 HERE)
├── apps/web/src/            # Web app (React 19 + TanStack Router)
│   ├── features/            # Feature modules (review, history, etc.)
│   └── components/          # diff-ui web components
├── packages/api/src/hooks/  # 26 shared hooks (TanStack Query)
├── packages/core/src/       # Shared business logic
└── packages/schemas/src/    # Shared Zod schemas
```

## Development Commands

```bash
# Run CLI in dev mode
cd diffgazer && pnpm dev:cli

# Run web in dev mode
cd diffgazer && pnpm dev:web

# Type-check all
cd /Users/voitz/Projects/diffgazer-workspace && pnpm run type-check

# Test specific package
cd diffgazer/packages/api && pnpm test
cd diffgazer/apps/cli && pnpm test
```

## Bug Fix Entry Points

### HOME-NAV-001: Keyboard Provider Stale Closure
- **File**: `apps/cli/src/app/providers/keyboard-provider.tsx:49,115-146`
- **Fix**: Replace `useState<string[]>([])` for `scopeStack` with `useRef<string[]>([])`. Keep a `useState` counter for re-render triggers only. Update `useInput` handler to read `scopeStackRef.current`.

### Scope Stack Accumulation
- **File**: `apps/cli/src/hooks/use-scope.ts:10-15`
- **Fix**: Add dedup guard in `pushScope` — check if scope is already on top of stack before pushing.

## Component Gap Entry Points

### Missing Review Components (add to CLI)
- Trace tab → `apps/cli/src/features/review/components/issue-details-pane.tsx`
- Patch tab → new `apps/cli/src/features/review/components/diff-view.tsx`
- Interactive fix plan → update existing fix plan rendering
- AgentBoard → new `apps/cli/src/features/review/components/agent-board.tsx`
- ContextSnapshotPreview → new component
- ReviewMetricsFooter → new component

### Shared Breakpoints (new)
- Constants: `packages/core/src/layout/breakpoints.ts`
- CLI hook update: `apps/cli/src/hooks/use-terminal-dimensions.ts`
- Web hook: new `apps/web/src/hooks/use-viewport-breakpoint.ts`
