# Quickstart: CLI Ink Web Parity

**Branch**: `012-cli-ink-web-parity` | **Date**: 2026-03-25

## Context

Both CLI and web apps are **already fully implemented** with matching screens and shared hooks. This feature is a **consolidation and quality audit**, not a greenfield build. The work focuses on:

1. Eliminating code duplication between CLI and web
2. Standardizing loading/error/empty state patterns
3. Fixing SRP violations in complex hooks
4. Removing dead exports
5. Centralizing responsive breakpoints in CLI
6. Ensuring `matchQueryState` is adopted consistently

## Prerequisites

```bash
pnpm install                    # workspace dependencies
pnpm build                      # build all packages
pnpm dev:cli                    # run CLI in dev mode
pnpm dev:web                    # run web in dev mode
```

## Key Directories

```
apps/cli/src/                   # CLI app (Ink 6)
apps/web/src/                   # Web app (React 19 + Vite)
packages/api/src/hooks/         # Shared API hooks (TanStack Query)
packages/core/src/              # Shared utilities, types, review reducer
packages/schemas/src/           # Zod schemas
packages/hooks/src/             # Shared non-API hooks (getFigletText, useTimer)
```

## Work Streams

### Stream 1: DRY Consolidation (Medium-sized changes)
- Extract `NavigationConfig` types/constants to shared package
- Remove CLI-local `Shortcut` type definitions (use `@diffgazer/schemas/ui`)
- Consolidate `formatTimestamp` to use `@diffgazer/core/format`
- Fix `SEVERITY_LABELS` import in web `severity-breakdown.tsx`
- Extract `useDiagnosticsData()` shared hook

### Stream 2: SRP Decomposition (Larger refactors)
- Decompose CLI `useReviewLifecycle` into focused hooks
- Split web `useReviewResultsKeyboard` (208 lines → 3 focused hooks)
- Extract data/keyboard from web `DiagnosticsPage`

### Stream 3: matchQueryState Adoption (Small, repetitive changes)
- Adopt in settings screens (storage, analysis, agent-execution) — both apps
- Adopt in providers screen — both apps
- Adopt in settings hub — both apps
- Adopt in trust permissions — CLI

### Stream 4: YAGNI Cleanup (Small deletions)
- Remove unused exports from `packages/core/src/severity.ts`
- Unexport `FALLBACK_LENSES`
- Remove unused `TableColumn` schema
- Remove unused type re-exports from `packages/hooks`
- Remove `SHOW_HELP_IN_MAIN_MENU` flag
- Standardize CLI Spinner imports (use project Spinner, not raw ink-spinner)

### Stream 5: Responsive Improvements (CLI only)
- Centralize breakpoint constants
- Fix hardcoded `"─".repeat(80)` in footer (use terminal width)
- Fix hardcoded `"─".repeat(40)` in Panel.Footer
- Consolidate `useStdout` usage through `useTerminalDimensions`

## Verification

```bash
pnpm build                      # both apps compile
pnpm --filter @diffgazer/api build  # shared hooks compile
pnpm dev:cli                    # CLI runs without errors
pnpm dev:web                    # web runs without errors
```

## Risk Areas

- **Shared hook additions** (useDiagnosticsData) — must work in both environments (browser + Node.js/Ink)
- **Navigation config extraction** — must not break menu rendering in either app
- **Review lifecycle decomposition** — complex state machine, test manually before/after
