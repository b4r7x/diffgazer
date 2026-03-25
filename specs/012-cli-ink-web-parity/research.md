# Research: CLI Ink Web Parity

**Branch**: `012-cli-ink-web-parity` | **Date**: 2026-03-25

## R1: Current CLI Implementation State

**Decision**: The CLI app already has a complete, well-structured implementation with 14 screens, 36 feature components, 3 providers, and zero direct API calls. All data fetching flows through `@diffgazer/api/hooks`.

**Rationale**: Deep exploration of `apps/cli/src/` revealed:
- **14 screens**: home, review, history, help, onboarding, status (orphaned), + 8 settings screens (hub, theme, providers, storage, analysis, agent-execution, diagnostics, trust-permissions)
- **36 feature components** across 6 domains: home (4), review (13), onboarding (8), providers (5), settings (4), history (3)
- **3 custom providers**: TerminalKeyboardProvider (scope-based keyboard), FooterProvider (dynamic shortcuts), ServerProvider (server lifecycle)
- **10 local hooks**: 8 in `hooks/` (keyboard, navigation, terminal, exit) + 2 in `features/review/hooks/` (lifecycle, keyboard)
- **20 distinct shared hooks** consumed from `@diffgazer/api/hooks`
- **0 direct API calls** — 100% through shared TanStack Query hooks
- In-memory routing via component map + navigation context (no URL routing)

**Alternatives considered**: None — the implementation already exists. The work is consolidation and quality audit, not greenfield.

## R2: Web App Implementation State

**Decision**: The web app is equally mature with 14 routes matching all CLI screens. Both apps use the same shared hooks. The web has documented exceptions for 4 files that bypass hooks (all valid).

**Rationale**: Exploration confirmed:
- **14 routes**: home, review, history, help, onboarding, + 7 settings sub-routes, + root layout
- **Feature domains**: same 6 as CLI (home, review, onboarding, providers, settings, history)
- **Data fetching**: Zero undocumented bypasses. 4 documented exceptions still valid:
  1. `config-guards.ts` — Router `beforeLoad` (can't use hooks)
  2. `review/page.tsx` — Imperative one-shot load with branching logic
  3. `shutdown.ts` — Utility function, not a component
  4. `lib/api.ts` — API singleton creation
- **Review lifecycle**: Web decomposes into 4 focused hooks (lifecycle, start, completion, settings)

## R3: Shared Hooks Package Inventory

**Decision**: `@diffgazer/api/hooks` is comprehensive with 22 exports (10 query hooks, 8 mutation hooks, 1 streaming hook, 1 utility, 1 context hook, 1 context provider). No new hooks need to be created for CLI parity.

**Rationale**: Complete audit revealed:
- Query hooks: `useSettings`, `useInit`, `useConfigCheck`, `useProviderStatus`, `useOpenRouterModels`, `useReviews`, `useReview`, `useActiveReviewSession`, `useReviewContext`, `useServerStatus`
- Mutation hooks: `useSaveSettings`, `useSaveConfig`, `useActivateProvider`, `useDeleteProviderCredentials`, `useDeleteReview`, `useRefreshReviewContext`, `useSaveTrust`, `useDeleteTrust`, `useShutdown`
- Streaming: `useReviewStream` (useReducer-based SSE, not TanStack Query)
- Utility: `matchQueryState` (used in only 2 files despite documentation emphasis)
- 8 BoundApi methods have no corresponding hook (getConfig, deleteConfig, getTrust, listTrustedProjects, streamReview, getGitStatus, getGitDiff, runReviewDrilldown) — all intentionally unhookified

## R4: Quality Audit Findings

**Decision**: 17 findings across 4 categories. Highest-impact items: navigation config duplication, Shortcut type triplication, formatTimestamp duplication, monolithic review lifecycle hook in CLI, and review results keyboard hook (208 lines, 16 return values).

**Findings summary**:

### Thin Wrappers (2)
- **1a**: 10 web route files are 2-3 line re-exports with no route-specific logic → BUT these are a TanStack Router convention for file-based routing. **Keep as-is**.
- **1b**: `useReviewSettings` — 3-line wrapper around `useSettings()`. Only 1 consumer → Inline into `use-review-lifecycle.ts`

### DRY Violations (5)
- **2a**: `config/navigation.ts` duplicated between CLI and web (types, MENU_ITEMS, SETTINGS_MENU_ITEMS) → Extract to `@diffgazer/core` or `@diffgazer/schemas`
- **2b**: `Shortcut` type defined in 3 places (schemas, CLI types, CLI navigation) → Import from `@diffgazer/schemas/ui` everywhere
- **2c**: `formatTimestamp` in 4 locations with different implementations → Use canonical `@diffgazer/core/format`, add variants if needed
- **2d**: `SEVERITY_LABELS` duplicated in web `severity-breakdown.tsx` → Import from `@diffgazer/schemas/ui`
- **2e**: Diagnostics pages share status derivation logic between CLI and web → Extract `useDiagnosticsData()` shared hook

### SRP Violations (3)
- **3a**: Web `DiagnosticsPage` (230 lines) mixes data, keyboard, and rendering → Extract `useDiagnosticsState()` and `useDiagnosticsKeyboard()` hooks
- **3b**: `useReviewResultsKeyboard` (208 lines, 16 return values) → Split into `useIssueSelection`, `useSeverityFilter`, `useTabNavigation`
- **3c**: CLI `useReviewLifecycle` (216 lines, monolithic) → Decompose like web: `useReviewStart`, `useReviewCompletion`

### YAGNI (7)
- **4a**: 3 unused severity re-exports in `packages/core` (`SEVERITY_ICONS`, `SEVERITY_COLORS`, `HISTOGRAM_SEVERITIES`) → Remove
- **4b**: Unused `FALLBACK_LENSES` export → Unexport (internal to `resolveDefaultLenses`)
- **4c**: Unused `TableColumn` schema type → Remove
- **4d**: Unused `FigletFont` type export from `packages/hooks` → Remove
- **4e**: Unused `UseTimerOptions`/`UseTimerResult` type exports → Remove
- **4f**: `SHOW_HELP_IN_MAIN_MENU = false` constant always false → Remove flag, use filtered array directly
- **4g**: `matchQueryState` over-documented but only 2 consumers → Either adopt consistently or reduce documentation emphasis

## R5: Loading/Error/Empty State Patterns

**Decision**: Adopt `matchQueryState` consistently across all single-query screens, and standardize loading indicator patterns per platform.

**Rationale**: Current state is inconsistent:
- `matchQueryState` used in only 2 files (both history screens) despite being the documented pattern
- **CLI**: Has proper `<Spinner>` component with variants, but inconsistently imports (`ink-spinner` directly in 6 files vs project `Spinner` in others)
- **Web**: No spinner component at all — all loading is plain `<p className="text-tui-muted">Loading...</p>` text
- **Error handling**: Web uses `toast.error()` for mutations (15+ sites); CLI uses inline `<Text color="red">` or `<Callout variant="error">`
- **Empty state**: CLI has compound `EmptyState` component; web uses diffui's `<EmptyState>` in 2 places, plain text elsewhere
- Clear `matchQueryState` adoption candidates: Settings Storage/Analysis/Agent-Execution (both apps), Providers (both apps), Settings Hub (both apps), Trust Permissions (CLI)

## R6: Terminal Responsiveness

**Decision**: The current responsive approach works but needs centralization. Two ad-hoc breakpoints (80 cols narrow, 100 cols wide) should be formalized.

**Rationale**:
- `useTerminalDimensions` hook exists but is bypassed in 2 files that use `useStdout` directly
- Breakpoint `columns < 80` duplicated in 3 files (history, review results, providers)
- Breakpoint `columns >= 100` in 1 file (review progress)
- Hardcoded `"─".repeat(80)` in footer and `"─".repeat(40)` in Panel.Footer — not responsive
- No centralized breakpoint constants, no spacing tokens
- Passive resize handling via Ink's built-in re-render (standard, adequate)
- Theme is color-only (3 palettes), no typography or spacing tokens

## R7: Review Streaming Architecture

**Decision**: The streaming pipeline is well-architected with clean shared-core / platform-specific-UI split. The main gap is CLI lifecycle hook monolithicity.

**Rationale**:
- **Shared** (identical code): `useReviewStream`, `reviewReducer`, `createInitialReviewState`, `convertAgentEventsToLogEntries`, `filterIssuesBySeverity`, `resolveDefaultLenses`, `calculateSeverityCounts`, all types/schemas
- **Different** (per-platform): All UI rendering, keyboard systems (keyscope vs Ink useInput), lifecycle orchestration (web: 4 hooks, CLI: 1 monolithic hook)
- 9 component name overlaps (same name, independent implementations): ReviewContainer, ReviewProgressView, ReviewSummaryView, ReviewResultsView, IssueListPane, IssueDetailsPane, IssuePreviewItem, ActivityLog, CodeSnippet
- Web has 16 components with no CLI equivalent (AgentBoard, AgentFilterBar, ContextSnapshotPreview, etc.)
- CLI has 4 components with no web equivalent (ProgressList, ProgressStep, SeverityBar, SeverityBreakdown)

## R8: Packages Structure

**Decision**: `packages/hooks/` (`@diffgazer/hooks`) is a consolidation candidate — only 2 exports (`getFigletText`, `useTimer`) consumed by 3 files. Consider inlining into consumers.

**Rationale**:
- `packages/core/` — Well-structured with 7 subpath exports. Main concern: 3 unused re-exports in `severity.ts`
- `packages/schemas/` — Comprehensive, 7 subpath exports, all Zod-backed
- `packages/hooks/` — Only `getFigletText` (pure function, 2 consumers) and `useTimer` (1 consumer). Zero overlap with `packages/api/hooks`. Depends on `figlet` which shouldn't contaminate API hooks
- `packages/api/` — Clean separation: root = transport (no React), `./hooks` = React layer. 6 subpath exports
- `packages/tsconfig/` — 6 shared configs (base, node, react, cli, test, cli-test)

## R9: Ink Component Libraries (Web Search)

**Decision**: The CLI already has a comprehensive custom component library. `@inkjs/ui` (v2.0.0) is available but only `TextInput` is used. No additional third-party library needed.

**Rationale**: From web research:
- `ink-ui` (`@inkjs/ui`) provides spinners, progress bars, badges, alerts, select lists — but the CLI already has custom equivalents for all of these
- The CLI's custom components (Panel, Dialog, Menu, NavigationList, Tabs, Callout, EmptyState, ScrollArea, etc.) are more tailored to the app's needs than generic library components
- Adopting a library now would require rewriting working components for negligible benefit

## R10: TanStack Query in Terminal Environments

**Decision**: Current `networkMode: 'always'` configuration is correct and follows TanStack Query's recommended approach for non-browser environments.

**Rationale**: TanStack Query docs confirm `networkMode: 'always'` should be used when:
- Operating in environments without browser network detection APIs
- Queries should never be paused due to offline state
- The CLI correctly sets this globally plus disables `refetchOnWindowFocus` and `refetchOnReconnect`
