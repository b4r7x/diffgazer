# Research: CLI-Web Shared Infrastructure Consolidation & Quality Audit

**Date**: 2026-03-26
**Methodology**: 20 parallel Opus agents explored the entire workspace (CLI, Web, server, 4 shared packages, cross-workspace analysis)

## R1: Loading/Error State Pattern

**Decision**: Keep `matchQueryState` as the cross-platform utility. Add platform-specific preset factories to each app.

**Rationale**: `matchQueryState` is already renderer-agnostic (returns `ReactNode`). TanStack Query v5 intentionally leaves this pattern to userland — there is no built-in equivalent. The community has converged on the same pattern (Gabriel Pichot's blog, TanStack Discussion #809). Suspense was evaluated and rejected: it requires error boundaries, which add structural complexity without visual benefit in terminal environments. `useSuspenseQuery` would eliminate the need for `matchQueryState` but forces a fundamentally different component structure.

**Alternatives considered**:
- `useSuspenseQuery` + `<Suspense>` + `<ErrorBoundary>`: Adds structural requirements, not compatible with Ink's simple rendering model
- `react-error-boundary` in Ink: Works in principle but adds boilerplate for retry UX in terminal
- External libraries (`suspensive`): Adds dependency for marginal benefit
- Single shared component with platform injection (`react-agnostic`): Unmaintained, adds complexity

## R2: React Compiler Status

**Decision**: Add manual `useMemo`/`useCallback` to context providers. Document as intentional exception.

**Rationale**: The React Compiler is NOT installed. No `babel-plugin-react-compiler`, no `reactCompiler` option in Vite config, no `.babelrc` files. The CLAUDE.md rule "No manual useCallback/useMemo" is aspirational. Five context providers create new object references on every render, causing cascading re-renders:
- Web `ConfigProvider`: data/actions split completely defeated without memoization
- Web `ThemeProvider`: new value object every render
- CLI `NavigationProvider`: new `navigate`/`goBack` closures every render
- CLI `CliThemeProvider`: new value object every render
- CLI `FooterProvider`: wrapping stable `useState` setters in unmemoized object

The CLI `TerminalKeyboardProvider` is the only provider already correctly memoized.

**Alternatives considered**:
- Install React Compiler: Out of scope for a refactoring PR; requires careful validation across both apps
- Do nothing: ConfigProvider's deliberate split-context pattern is pointless without memoization
- Use `useRef` + stable callbacks pattern: More complex than `useCallback`, less readable

## R3: Settings Keyboard Boilerplate Consolidation

**Decision**: Adapt `useFooterNavigation` hook to support all 5 consumers. Add `allowInInput` and `wrap` options.

**Rationale**: The existing `useFooterNavigation` hook at `apps/web/src/hooks/use-footer-navigation.ts` already encapsulates the exact 6-key pattern (ArrowUp/Down/Left/Right/Enter/Space). Four settings pages and the onboarding wizard each contain ~15 lines of identical keyboard registration.

**Gaps to bridge**:
1. `allowInInput: true` needed for onboarding wizard (has text input step) → add option
2. Wrapping vs. clamping: hook wraps, inline code clamps → add `wrap` option (default: false for backward compat)
3. Dynamic button count: wizard has 1 or 2 buttons depending on step → hook already accepts `buttonCount` param
4. Extra `enabled` guards: analysis page adds `viewState === "success"` → caller passes composed boolean as `enabled`
5. ArrowDown entry: hook has built-in entry handler; pages use `onBoundaryReached` callbacks → make entry optional or use `enterFooter()` imperatively
6. Reset on exit: hook's `exitFooter()` doesn't reset index → fix to also reset `focusedIndex` to 0

**Alternatives considered**:
- Create a new hook from scratch: Would duplicate the existing hook's logic
- Extract a generic `useZoneNavigation`: Over-engineering for this specific pattern
- Leave the boilerplate: Violates DRY, maintenance burden

## R4: Shared Utility Extraction Targets

**Decision**: Extract 5 pure functions to `@diffgazer/core/format`, 1 to `@diffgazer/core/layout/breakpoints`.

**Rationale**: These functions are defined identically in both apps with no platform-specific logic:

| Function | CLI Location | Web Location | Target |
|----------|-------------|-------------|--------|
| `getDateKey` | `history-screen.tsx:36` | `history/utils.tsx:5` | `@diffgazer/core/format` |
| `getDateLabel` | `history-screen.tsx:40` | `history/utils.tsx:9` | `@diffgazer/core/format` |
| `getTimestamp` | `history-screen.tsx:51` | `history/utils.tsx:20` | `@diffgazer/core/format` |
| `formatDuration` | `history-screen.tsx:55` | `history/utils.tsx:28` | `@diffgazer/core/format` |
| `formatTimestampOrNA` | `diagnostics-screen.tsx:17` | `diagnostics/page.tsx:9` | `@diffgazer/core/format` |
| `buildResponsiveResult` | `use-terminal-dimensions.ts` (inline) | `use-viewport-breakpoint.ts` (inline) | `@diffgazer/core/layout/breakpoints` |

**Alternatives considered**:
- Create a new `@diffgazer/core/history` subpath: Over-specific; these are general date/time utilities
- Put in `@diffgazer/schemas/ui`: These are formatting functions, not schemas

## R5: Dead Code Verification

**Decision**: Remove all 11 confirmed dead items. InfoField is NOT dead (1 consumer) but should be replaced with KeyValue.

**Verified dead items** (zero import sites confirmed via grep):

| Item | Location | Lines |
|------|----------|-------|
| CLI Toast system | `apps/cli/src/components/ui/toast.tsx` | ~100 lines (entire file + Toaster mount) |
| CLI Logo component | `apps/cli/src/components/ui/logo.tsx` | ~30 lines (entire file) |
| CLI NoChangesInline + SHOW_NO_CHANGES | `apps/cli/src/app/screens/review-screen.tsx:40,52,85-86,162-169,175-223` | ~50 lines |
| Web DEFAULT_TTL | `apps/web/src/config/constants.ts:3` | 1 line |
| Web setPreview no-op | `apps/web/src/app/providers/theme-provider.tsx:92` + `types/theme.ts:8` | 2 lines |
| Web useFooter combined hook | `apps/web/src/components/layout/footer/footer-context.tsx:61` + re-exports | 5 lines |
| Web empty settings barrel | `apps/web/src/features/settings/index.ts` | 1 line (entire file) |
| Core formatElapsed | `packages/core/src/format.ts:29-34` | 6 lines |
| CLI ScrollArea.orientation | `apps/cli/src/components/ui/scroll-area.tsx:8,15` | 2 lines |
| CLI NavigationList.focused | `apps/cli/src/components/ui/navigation-list.tsx:14,168` | 2 lines |
| API unused subpaths | `packages/api/package.json` (4 entries) | 16 lines |

**InfoField** at `apps/cli/src/features/home/components/info-field.tsx` has 1 active consumer (`context-sidebar.tsx`). It duplicates `KeyValue` functionally. Action: replace usage with `KeyValue`, then delete `InfoField`.

## R6: Misplaced Code Analysis

**Decision**: Relocate 5 items, remove 2 passthrough re-exports, eliminate `@diffgazer/hooks` package.

| Item | Current Location | Target | Reason |
|------|-----------------|--------|--------|
| `getProviderStatus` | `@diffgazer/core/format.ts` | `@diffgazer/core/providers/display-status.ts` | Not a formatting function |
| `@diffgazer/core/severity` | Passthrough re-exporting `@diffgazer/schemas/ui` | Remove; consumers import from schemas directly | Zero added value |
| `features/providers/types/index.ts` | Web app thin re-export | Remove; consumers import from `@diffgazer/schemas/config` | Zero added value |
| `PROVIDER_CAPABILITIES` | `apps/web/src/config/constants.ts` | `@diffgazer/schemas/config` | Domain knowledge, not web-specific |
| `getFigletText` | `@diffgazer/hooks` | `@diffgazer/core` (new subpath or add to strings) | Not a hook; pure function |
| `useTimer` | `@diffgazer/hooks` | `apps/web/src/hooks/` | Only used by web |
| `DisplayStatus` type | Duplicated in core and schemas | Core imports from schemas | Eliminate duplication |

## R7: Responsiveness Edge Cases

**Decision**: Fix 3 hardcoded width issues in CLI components.

| Issue | File | Fix |
|-------|------|-----|
| Input widthBySize hardcoded | `components/ui/input.tsx:22-26` | Cap each size at `Math.min(size, columns - padding)` |
| Panel/SectionHeader full-width lines | `panel.tsx:76`, `section-header.tsx:28` | Use `width="100%"` Ink prop instead of `"─".repeat(columns)` |
| IssuePreviewItem hardcoded MAX_PATH_LENGTH | `issue-preview-item.tsx:12` | Derive from available width via prop or parent context |

## R8: Hook Consolidation Assessment

**Decision**: Extract `buildResponsiveResult` and fix `canProceed` duplication. Defer OpenRouter model processing extraction.

**`buildResponsiveResult`**: Both CLI and web derive `{ tier, isNarrow, isMedium, isWide }` from a `BreakpointTier`. Extract as a pure function to `@diffgazer/core/layout/breakpoints.ts`. Trivial change, high value.

**`canProceed` duplication**: The onboarding wizard (`onboarding-wizard.tsx:89-106`) and the `useOnboarding` hook (`use-onboarding.ts:44-59`) both implement identical step validation switch statements. Extract to a shared function in the onboarding types file.

**`useProcessedOpenRouterModels`**: The web wrapper adds filtering/mapping using `@diffgazer/api` functions. The CLI's onboarding model step does not currently need this processing. Defer extraction until CLI needs it (YAGNI).

**`ReviewEvent` type alias**: Redefined in `packages/api/src/hooks/use-review-stream.ts:14` — import from `@diffgazer/core/review` instead.
