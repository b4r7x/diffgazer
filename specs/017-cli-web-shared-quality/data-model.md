# Data Model: CLI-Web Shared Infrastructure Consolidation & Quality Audit

**Date**: 2026-03-26

This is a refactoring feature — no new data entities are introduced. This document serves as the **file change manifest**: every file to create, modify, or delete, organized by work stream.

## Work Stream 1: Extract Shared Utilities (US1)

### New exports in `@diffgazer/core/format` (`packages/core/src/format.ts`)

| Function | Signature | Source |
|----------|-----------|--------|
| `getDateKey` | `(dateStr: string) => string` | `apps/web/src/features/history/utils.tsx:5` |
| `getDateLabel` | `(dateStr: string) => string` | `apps/web/src/features/history/utils.tsx:9` |
| `getTimestamp` | `(dateStr: string) => string` | `apps/web/src/features/history/utils.tsx:20` |
| `formatDuration` | `(durationMs: number \| null \| undefined) => string` | `apps/web/src/features/history/utils.tsx:28` |
| `formatTimestampOrNA` | `(value: string \| null \| undefined, fallback?: string) => string` | `apps/web/src/features/settings/components/diagnostics/page.tsx:9` |

### New export in `@diffgazer/core` (`packages/core/src/layout/breakpoints.ts`)

| Function | Signature | Notes |
|----------|-----------|-------|
| `buildResponsiveResult` | `(tier: BreakpointTier) => { tier, isNarrow, isMedium, isWide }` | Used by both `useResponsive` (CLI) and `useViewportBreakpoint` (web) |

### Files to modify (consumers)

| File | Change |
|------|--------|
| `apps/web/src/features/history/utils.tsx` | Remove `getDateKey`, `getDateLabel`, `getTimestamp`, `formatDuration`; re-export from `@diffgazer/core/format` |
| `apps/cli/src/app/screens/history-screen.tsx` | Remove inline utility functions; import from `@diffgazer/core/format` |
| `apps/cli/src/app/screens/settings/diagnostics-screen.tsx` | Remove `formatTimestampOrNA`; import from `@diffgazer/core/format` |
| `apps/web/src/features/settings/components/diagnostics/page.tsx` | Remove `formatTimestampOrNA`; import from `@diffgazer/core/format` |
| `apps/cli/src/hooks/use-terminal-dimensions.ts` | Use `buildResponsiveResult` from `@diffgazer/core` |
| `apps/web/src/hooks/use-viewport-breakpoint.ts` | Use `buildResponsiveResult` from `@diffgazer/core` |
| `packages/api/src/hooks/use-review-stream.ts` | Import `ReviewEvent` from `@diffgazer/core/review` instead of redefining |

### New file for CLI-internal dedup

| File | Content |
|------|---------|
| `apps/cli/src/theme/severity.ts` | `getSeverityColor(severity: ReviewSeverity, tokens: CliColorTokens): string` |

### Files consuming shared `getSeverityColor`

| File | Change |
|------|--------|
| `apps/cli/src/features/review/components/severity-bar.tsx` | Remove local `severityColor`; import from `theme/severity` |
| `apps/cli/src/features/review/components/severity-filter-group.tsx` | Remove local `severityColor`; import from `theme/severity` |
| `apps/cli/src/features/history/components/history-insights-pane.tsx` | Remove local `severityColor`; import from `theme/severity` |

## Work Stream 2: Remove Dead Code (US2)

### Files to delete

| File | Reason |
|------|--------|
| `apps/cli/src/components/ui/toast.tsx` | Toast system never called (zero consumers of `toast()`) |
| `apps/cli/src/components/ui/logo.tsx` | Never imported |
| `apps/web/src/features/settings/index.ts` | Empty barrel (`export {}`) |
| `apps/cli/src/features/home/components/info-field.tsx` | Replace with `KeyValue` in single consumer |

### Files to modify (remove dead code within)

| File | Lines to Remove | Description |
|------|----------------|-------------|
| `apps/cli/src/app/screens/review-screen.tsx` | ~50 lines (40,52,85-86,162-169,175-223) | `SHOW_NO_CHANGES` action, `no-changes` phase, `NoChangesInline` component, `NO_CHANGES_MESSAGES` |
| `apps/cli/src/app/index.tsx` | `<Toaster />` mount | Remove toast renderer |
| `apps/cli/src/components/ui/scroll-area.tsx` | Lines 8,15 | Remove `orientation` prop from interface and destructuring |
| `apps/cli/src/components/ui/navigation-list.tsx` | Lines 14,168 | Remove `focused` prop from interface and destructuring |
| `packages/core/src/format.ts` | Lines 29-34 | Remove `formatElapsed` (duplicates `formatTime("short")`) |
| `packages/api/package.json` | 4 export entries | Remove `./review`, `./config`, `./git`, `./shutdown` subpaths |
| `apps/web/src/config/constants.ts` | Line 3 | Remove `DEFAULT_TTL` |
| `apps/web/src/app/providers/theme-provider.tsx` | Line 92 | Remove `setPreview` no-op |
| `apps/web/src/types/theme.ts` | Line 8 | Remove `setPreview` from `ThemeContextValue` interface |
| `apps/web/src/components/layout/footer/footer-context.tsx` | Line 61-63 | Remove `useFooter()` combined hook |
| `apps/web/src/components/layout/footer/index.ts` | 1 line | Remove `useFooter` re-export |
| `apps/web/src/components/layout/index.ts` | 1 line | Remove `useFooter` re-export |
| `apps/cli/src/features/home/components/context-sidebar.tsx` | Import line | Replace `InfoField` import with `KeyValue` |

## Work Stream 3: Settings Keyboard Consolidation (US3)

### File to modify (shared hook)

| File | Change |
|------|--------|
| `apps/web/src/hooks/use-footer-navigation.ts` | Add `allowInInput?: boolean` option, add `wrap?: boolean` option (default false), reset `focusedIndex` to 0 in `exitFooter()` |

### Files to modify (consumers)

| File | Change |
|------|--------|
| `apps/web/src/features/settings/components/storage/page.tsx` | Remove ~15 lines keyboard boilerplate; use `useFooterNavigation` |
| `apps/web/src/features/settings/components/agent-execution/page.tsx` | Remove ~15 lines keyboard boilerplate; use `useFooterNavigation` |
| `apps/web/src/features/settings/components/theme/page.tsx` | Remove ~15 lines keyboard boilerplate; use `useFooterNavigation` |
| `apps/web/src/features/settings/components/analysis/page.tsx` | Remove ~15 lines keyboard boilerplate; use `useFooterNavigation` |
| `apps/web/src/features/onboarding/components/onboarding-wizard.tsx` | Remove ~19 lines keyboard boilerplate; use `useFooterNavigation` with `allowInInput: true` |

## Work Stream 4: Provider Memoization (US4)

| File | Change |
|------|--------|
| `apps/web/src/app/providers/config-provider.tsx` | Wrap `dataValue` and `actionsValue` in `useMemo`; wrap action functions in `useCallback` |
| `apps/web/src/app/providers/theme-provider.tsx` | Wrap context value in `useMemo`; wrap `setTheme` in `useCallback` |
| `apps/cli/src/app/navigation-context.tsx` | Wrap `navigate`/`goBack` in `useCallback`; wrap context value in `useMemo` |
| `apps/cli/src/theme/theme-context.tsx` | Wrap context value in `useMemo`; wrap `setTheme` in `useCallback` |
| `apps/cli/src/app/providers/footer-provider.tsx` | Wrap context value in `useMemo` |

## Work Stream 5: Hook Consolidation (US5)

| File | Change |
|------|--------|
| `packages/core/src/layout/breakpoints.ts` | Add `buildResponsiveResult` (covered in WS1) |
| `apps/web/src/hooks/use-openrouter-models.ts` | Remove manual `useMemo` wrapper (React Compiler convention) |
| `apps/web/src/features/onboarding/hooks/use-onboarding.ts` | Extract `canProceed` to shared function |
| `apps/web/src/features/onboarding/components/onboarding-wizard.tsx` | Import shared `canProceed` instead of local `canProceedForStep` |

## Work Stream 6: Loading State Presets (US6)

### New files

| File | Content |
|------|---------|
| `apps/cli/src/lib/query-presets.tsx` | `cliLoading(label)`, `cliError()` preset factories for `matchQueryState` |
| `apps/web/src/lib/query-presets.tsx` | `webLoading(label)`, `webError()` preset factories for `matchQueryState` |

### Files to modify

| File | Change |
|------|--------|
| `apps/web/src/features/review/components/page.tsx` | Remove `LoadingReviewState`; import `ReviewLoadingMessage` from `review-container.tsx` |
| `apps/web/src/features/review/components/review-container.tsx` | Export `ReviewLoadingMessage` |

## Work Stream 7: Misplaced Code (US7)

| Item | Source | Target | Consumer Updates |
|------|--------|--------|-----------------|
| `getProviderStatus` + `getProviderDisplay` | `packages/core/src/format.ts` | `packages/core/src/providers/display-status.ts` | Update imports in `apps/cli`, `apps/web` global layouts |
| `@diffgazer/core/severity` | `packages/core/src/severity.ts` | DELETE | Update `apps/server` imports to use `@diffgazer/schemas/ui` |
| `providers/types/index.ts` | `apps/web/src/features/providers/types/index.ts` | DELETE | Update 3 consumers to import from `@diffgazer/schemas/config` |
| `PROVIDER_CAPABILITIES` | `apps/web/src/config/constants.ts` | `packages/schemas/src/config/providers.ts` | Update web imports |
| `OPENROUTER_PROVIDER_ID` | `apps/web/src/config/constants.ts` | `packages/schemas/src/config/providers.ts` | Update web imports |
| `getFigletText` | `packages/hooks/src/get-figlet.ts` | `packages/core/src/` (new file) | Update CLI `logo.tsx` and web `ascii-logo.tsx` imports |
| `useTimer` | `packages/hooks/src/use-timer.ts` | `apps/web/src/hooks/use-timer.ts` | Update web `timer.tsx` import |
| `@diffgazer/hooks` package | `packages/hooks/` | DELETE (after relocations) | Remove from workspace `pnpm-workspace.yaml` |
| `DisplayStatus` type in core | `packages/core/src/providers/display-status.ts:1` | Import from `@diffgazer/schemas/config` | No consumer changes |

## Work Stream 8: Responsiveness Fixes (US8)

| File | Change |
|------|--------|
| `apps/cli/src/components/ui/input.tsx` | Cap `widthBySize` values at `Math.min(size, columns - padding)` using `useTerminalDimensions` |
| `apps/cli/src/components/ui/panel.tsx` | Use Ink `width="100%"` for footer line instead of `"─".repeat(columns)` |
| `apps/cli/src/components/ui/section-header.tsx` | Use Ink `width="100%"` for border instead of `"─".repeat(columns)` |
| `apps/cli/src/features/review/components/issue-preview-item.tsx` | Accept `maxPathLength` prop or derive from parent width |

## Dependency Graph (Work Stream Execution Order)

```
WS1 (Extract Utilities) ──┐
WS2 (Dead Code)        ──┤──→ WS6 (Loading Presets) ──→ Build & Test
WS7 (Misplaced Code)   ──┤
WS4 (Memoization)      ──┘
WS3 (Keyboard Consolidation) ──→ Build & Test
WS5 (Hook Consolidation) ──→ Build & Test
WS8 (Responsiveness) ──→ Build & Test
```

WS1, WS2, WS4, and WS7 can run in parallel (independent file changes). WS3, WS5, WS6, and WS8 are also independent of each other. WS6 depends on WS2 (removing duplicate loading component before creating presets).
