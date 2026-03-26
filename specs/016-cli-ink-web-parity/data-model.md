# Data Model: CLI Ink Web Parity

**Date**: 2026-03-26
**Feature**: 016-cli-ink-web-parity

## Entities

### TerminalDimensions

Reactive terminal size, updated on resize events.

| Field | Type | Source |
|-------|------|--------|
| columns | number | `stdout.columns ?? 80` |
| rows | number | `stdout.rows ?? 24` |

**State transitions**: Updates on every `stdout` `resize` event. Initial value from `useStdout()` at mount.

### ResponsiveDimensions (extends TerminalDimensions)

Computed breakpoint state derived from column count.

| Field | Type | Derived From |
|-------|------|-------------|
| tier | `BreakpointTier` | `getBreakpointTier(columns)` |
| isNarrow | boolean | `tier === "narrow"` (< 80 cols) |
| isMedium | boolean | `tier === "medium"` (80-119 cols) |
| isWide | boolean | `tier === "wide"` (120+ cols) |

### LayoutMode

Per-screen layout classification determining centering behavior.

| Value | Behavior | Screens |
|-------|----------|---------|
| `centered` | Horizontally centered with max-width | Home, Settings Hub, all single-panel settings, Review Summary, Help, Onboarding |
| `full-width` | Spans entire terminal, proportional panes | Review Results, Review Progress, History, Providers |

### SharedHook

Hooks in `@diffgazer/api/hooks` consumed by both apps.

| Category | Hooks | Count |
|----------|-------|-------|
| Config queries | `useSettings`, `useInit`, `useConfigCheck`, `useProviderStatus`, `useOpenRouterModels` | 5 |
| Config mutations | `useSaveSettings`, `useSaveConfig`, `useActivateProvider`, `useDeleteProviderCredentials` | 4 |
| Review queries | `useReviews`, `useReview`, `useActiveReviewSession`, `useReviewContext` | 4 |
| Review mutations | `useDeleteReview`, `useRefreshReviewContext` | 2 |
| Review lifecycle | `useReviewStream`, `useReviewStart`, `useReviewCompletion` | 3 |
| Diagnostics | `useDiagnosticsData` | 1 |
| Trust | `useSaveTrust`, `useDeleteTrust` | 2 |
| Server | `useServerStatus`, `useShutdown` | 2 |
| Utilities | `matchQueryState` | 1 |

### ConsolidationTarget

Code to be shared or removed.

| Target | Current Location(s) | Destination |
|--------|---------------------|-------------|
| `buildLensOptions` | CLI analysis-selector, web analysis/page, web onboarding analysis-step | `@diffgazer/schemas/events` |
| `getSubstepDetail` | web review-container.utils | Import `getAgentDetail` from `@diffgazer/core/review` |
| Display status mapping | 4 provider components across CLI/web | `@diffgazer/core` |
| `ProviderWithStatus` type | web providers/types, CLI inline | `@diffgazer/schemas/config` |
| `getBackTarget` | CLI lib, web lib | `@diffgazer/core` |
| Review lifecycle orchestration | CLI `use-review-lifecycle.ts`, web `use-review-lifecycle.ts` | `@diffgazer/api/hooks` |

## Validation Rules

- Terminal dimensions: `columns >= 1`, `rows >= 1`. Fallback to 80x24 when undefined (piped/no TTY).
- Breakpoint thresholds: narrow < 80, medium 80-119, wide 120+. Already defined in `@diffgazer/core`.
- Max content width for centered layouts: TBD per screen (likely 80-100 columns for home, 60-80 for settings panels).
