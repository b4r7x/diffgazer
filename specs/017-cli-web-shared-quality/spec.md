# Feature Specification: CLI-Web Shared Infrastructure Consolidation & Quality Audit

**Feature Branch**: `017-cli-web-shared-quality`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "Consolidate shared hooks between CLI (Ink) and Web, audit cross-workspace code quality (DRY, KISS, YAGNI, SRP, anti-slop), fix duplications, dead code, misplaced code, and improve loading state patterns across both apps"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Eliminate Duplicated Utility Code Across CLI and Web (Priority: P1)

A developer working on the diffgazer monorepo encounters the same utility functions defined independently in both the CLI and web apps. When they fix a bug or change behavior in one, the other falls out of sync. All pure utility functions that serve both platforms must exist once, in a shared package.

**Why this priority**: Duplicated logic is the highest-risk quality issue — it leads to silent divergence, doubles maintenance cost, and has already resulted in minor signature mismatches (e.g., `formatTimestampOrNA` accepting different nullability). This is the foundation for all other improvements.

**Independent Test**: Can be fully tested by verifying that each identified duplicate exists in exactly one shared location, both apps import from that location, and all existing tests still pass.

**Acceptance Scenarios**:

1. **Given** history utility functions (`getDateKey`, `getDateLabel`, `getTimestamp`, `formatDuration`) exist in both `apps/cli` and `apps/web`, **When** consolidation is complete, **Then** a single implementation exists in `@diffgazer/core/format` and both apps import from there.
2. **Given** `formatTimestampOrNA` is defined in both diagnostics screens with different signatures, **When** consolidation is complete, **Then** a single implementation in `@diffgazer/core/format` accepts `string | null | undefined` and both apps use it.
3. **Given** `severityColor(severity, tokens)` is copy-pasted 3 times within the CLI app, **When** consolidation is complete, **Then** a single function exists in the CLI theme module and all 3 consumers import it.
4. **Given** `ReviewEvent` type alias is redefined in `packages/api`, **When** consolidation is complete, **Then** `packages/api` imports it from `@diffgazer/core/review`.

---

### User Story 2 - Remove Dead Code and Unused Exports (Priority: P1)

A developer navigating the codebase encounters unused components, hooks, constants, and exports that create noise, bloat the API surface, and obscure the actual architecture. All confirmed dead code must be removed.

**Why this priority**: Dead code directly degrades developer experience and obscures the real architecture. Removal is low-risk and immediately improves clarity.

**Independent Test**: Can be verified by confirming each identified dead artifact has zero import sites (via grep) and that removing it causes no build or test failures.

**Acceptance Scenarios**:

1. **Given** the CLI `Toast` system is mounted but `toast()` is never called, **When** cleanup is complete, **Then** the `Toaster` mount and the entire toast module are removed (or kept with a TODO if intentionally reserved).
2. **Given** the CLI `Logo` component is never imported, **When** cleanup is complete, **Then** the file is removed.
3. **Given** `NoChangesInline` + `NO_CHANGES_MESSAGES` + `no-changes` phase in `review-screen.tsx` are unreachable (~50 lines), **When** cleanup is complete, **Then** the dead code is removed from the review screen state machine.
4. **Given** web `DEFAULT_TTL` constant, `setPreview` no-op, `useFooter()` combined hook, and empty `features/settings/index.ts` are unused, **When** cleanup is complete, **Then** all are removed.
5. **Given** `formatElapsed` in `@diffgazer/core/format` duplicates `formatTime("short")` with zero consumers, **When** cleanup is complete, **Then** it is removed.
6. **Given** `InfoField` in the CLI duplicates `KeyValue`, **When** cleanup is complete, **Then** `InfoField` is deleted and its single consumer uses `KeyValue`.
7. **Given** unused props (`ScrollArea.orientation`, `NavigationList.focused`) exist in CLI components, **When** cleanup is complete, **Then** they are removed from interfaces and destructuring.
8. **Given** 4 unused `@diffgazer/api` subpath exports exist (`./review`, `./config`, `./git`, `./shutdown`), **When** cleanup is complete, **Then** they are removed from `package.json`.

---

### User Story 3 - Fix DRY Violations in Settings Page Keyboard Patterns (Priority: P2)

A developer adding a new settings page must copy-paste ~15 lines of keyboard registration boilerplate (button zone arrow keys, Enter/Space handling, focus zone switching) from an existing page. The existing `useFooterNavigation` hook already encapsulates this pattern but is only used by one page.

**Why this priority**: This is the single largest copy-paste pattern in the web app (5 pages x ~15 lines each). Fixing it reduces future maintenance and onboarding friction.

**Independent Test**: Can be tested by verifying all 5 settings pages use the shared hook, keyboard behavior remains identical (existing tests pass), and the boilerplate lines are removed.

**Acceptance Scenarios**:

1. **Given** 5 web settings pages each contain ~15 lines of identical button-zone keyboard logic, **When** refactoring is complete, **Then** all 5 pages use `useFooterNavigation` (or an adapted version) and the inline keyboard registrations are removed.
2. **Given** the web onboarding wizard contains the same keyboard pattern, **When** refactoring is complete, **Then** it also uses the shared hook.

---

### User Story 4 - Fix Context Provider Memoization Gaps (Priority: P2)

The React Compiler is not installed in the project despite the CLAUDE.md convention. Several context providers create new object references on every render, causing unnecessary re-renders throughout the component tree. Most critically, the web `ConfigProvider`'s deliberate data/actions split is completely defeated by the lack of memoization.

**Why this priority**: Context providers sit at the top of the render tree. Unstable references cascade re-renders to every consumer, impacting both perceived performance and developer expectations about the split-context pattern.

**Independent Test**: Can be tested by verifying that each provider's value is wrapped in `useMemo`/`useCallback` where appropriate, and that the component tree does not re-render consumers when unrelated parent state changes.

**Acceptance Scenarios**:

1. **Given** web `ConfigProvider` splits data/actions into two contexts but neither value is memoized, **When** fix is applied, **Then** both `dataValue` and `actionsValue` are wrapped in `useMemo`.
2. **Given** CLI `NavigationProvider` creates new function references for `navigate`/`goBack` on every render, **When** fix is applied, **Then** functions are wrapped in `useCallback`.
3. **Given** CLI `CliThemeProvider` and `FooterProvider` create new value objects on every render, **When** fix is applied, **Then** values are wrapped in `useMemo`.
4. **Given** web `ThemeProvider` creates a new value object on every render, **When** fix is applied, **Then** value is wrapped in `useMemo`.

---

### User Story 5 - Consolidate Extractable Hooks to Shared Packages (Priority: P2)

Several hooks implement identical logic in both CLI and web with only the input source differing (terminal vs. browser). The state management and return shapes are the same. Extracting the shared logic reduces duplication and ensures consistent behavior.

**Why this priority**: These extractions prevent future divergence and make the shared package the true single source of truth for cross-platform patterns.

**Independent Test**: Can be tested by verifying the shared hooks exist in the appropriate package, both apps import and use them, and all existing app-level tests pass.

**Acceptance Scenarios**:

1. **Given** `useResponsive` (CLI) and `useViewportBreakpoint` (web) both produce `{ tier, isNarrow, isMedium, isWide }` with the same derivation logic, **When** extraction is complete, **Then** a shared `buildResponsiveResult(tier)` utility exists in `@diffgazer/core` and both hooks use it.
2. **Given** the web's `useOpenRouterModels` wrapper adds filtering/mapping that uses only shared `@diffgazer/api` functions, **When** extraction is complete, **Then** a `useProcessedOpenRouterModels` hook exists in `@diffgazer/api/hooks` and both apps can use it.
3. **Given** onboarding step validation (`canProceed`) is duplicated between the web hook and wizard component, **When** extraction is complete, **Then** a single validation function exists and both locations call it.

---

### User Story 6 - Improve Loading/Error State Patterns (Priority: P3)

Both apps use `matchQueryState` for loading/error/success branching, but each call site writes its own loading/error JSX from scratch. This leads to inconsistent loading messages and error formatting. Platform-specific presets would reduce boilerplate while keeping the cross-platform `matchQueryState` utility.

**Why this priority**: Improves developer experience and UI consistency but is a convenience improvement, not a correctness issue.

**Independent Test**: Can be tested by verifying preset functions exist for each platform, can be composed with `matchQueryState`, and produce the expected loading/error UI elements.

**Acceptance Scenarios**:

1. **Given** CLI screens repeat `() => <Spinner label="Loading..." />` and `(err) => <Text color="red">Error: {err.message}</Text>` in every `matchQueryState` call, **When** presets are created, **Then** a CLI `queryPresets` module provides reusable `loading(label)` and `error()` functions.
2. **Given** web screens have similar repetitive loading/error JSX patterns, **When** presets are created, **Then** a web `queryPresets` module provides equivalent reusable functions.
3. **Given** two identical loading components exist in the web review flow (`LoadingReviewState` and `ReviewLoadingMessage`), **When** consolidation is complete, **Then** a single component exists.

---

### User Story 7 - Fix Misplaced Code and Thin Wrappers (Priority: P3)

Some code is located in the wrong package or file, creating confusion about where to find things. Some re-export layers add indirection without value. Correcting placement improves discoverability.

**Why this priority**: Improves code organization but has no functional impact. Low risk, low urgency.

**Independent Test**: Can be tested by verifying moved code is importable from its new location, old import paths are updated, and no functionality changes.

**Acceptance Scenarios**:

1. **Given** `getProviderStatus` lives in `@diffgazer/core/format.ts` but is unrelated to formatting, **When** relocation is complete, **Then** it lives alongside other provider display helpers in `@diffgazer/core/providers`.
2. **Given** `@diffgazer/core/severity` is a pure passthrough re-exporting from `@diffgazer/schemas/ui`, **When** cleanup is complete, **Then** consumers import directly from `@diffgazer/schemas/ui` and the passthrough is removed.
3. **Given** `features/providers/types/index.ts` in the web re-exports types from `@diffgazer/schemas/config` with no added value, **When** cleanup is complete, **Then** consumers import from `@diffgazer/schemas/config` directly.
4. **Given** `PROVIDER_CAPABILITIES` is defined in web `config/constants.ts` but is domain knowledge usable by CLI, **When** relocation is complete, **Then** it lives in `@diffgazer/schemas/config`.
5. **Given** `@diffgazer/hooks` contains only 2 exports (`getFigletText` which is not a hook, and `useTimer` used only by web), **When** cleanup is complete, **Then** `getFigletText` moves to `@diffgazer/core` and `useTimer` moves to the web app, eliminating the thin package.

---

### User Story 8 - Fix Responsiveness Edge Cases (Priority: P3)

Several CLI components have hardcoded widths that can overflow narrow terminals or waste space in wide ones. Line-drawing components use full terminal width even when rendered inside a narrower parent container.

**Why this priority**: Affects edge-case terminal sizes. The core responsive system works well for common sizes.

**Independent Test**: Can be tested by rendering the CLI at various terminal widths (40, 60, 80, 120, 200 columns) and verifying no visual overflow or truncation issues.

**Acceptance Scenarios**:

1. **Given** the CLI `Input` component has hardcoded `widthBySize = { sm: 20, md: 40, lg: 60 }`, **When** fix is applied, **Then** widths are capped at the available container width.
2. **Given** `Panel.Footer` and `SectionHeader` draw lines using `"─".repeat(columns)` based on full terminal width, **When** fix is applied, **Then** they use their parent's constrained width.
3. **Given** `IssuePreviewItem` has `MAX_PATH_LENGTH = 30` hardcoded, **When** fix is applied, **Then** the truncation length adapts to the available width.

---

### Edge Cases

- What happens when a shared hook is extracted but one platform needs slightly different behavior? **Assumption**: The shared hook accepts configuration options; platform-specific behavior is injected via parameters.
- What happens when dead code removal breaks an untested code path? **Assumption**: All removals are verified via grep for zero import sites AND a full build + test run.
- What happens when memoization is added to a provider that previously caused re-renders that masked a stale-closure bug? **Assumption**: Existing behavior is preserved by memoizing values but keeping the same dependency arrays. Any stale-closure bugs exposed are addressed as part of the same change.
- What happens when a re-export passthrough is removed but external consumers depend on it? **Assumption**: Only internal workspace consumers exist; external npm consumers use subpath imports from `@diffgazer/schemas` directly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All pure utility functions used by both CLI and web MUST exist in exactly one shared package (`@diffgazer/core` or `@diffgazer/schemas`), not duplicated across apps.
- **FR-002**: All confirmed dead code (zero import sites, unreachable code paths) MUST be removed.
- **FR-003**: Context providers creating new value references on every render MUST be memoized with `useMemo`/`useCallback` until the React Compiler is actually installed.
- **FR-004**: The 5 web settings pages with duplicated button-zone keyboard boilerplate MUST use a shared hook.
- **FR-005**: The `matchQueryState` utility MUST remain renderer-agnostic in `@diffgazer/api/hooks`. Platform-specific presets MUST live in each app.
- **FR-006**: No changes MUST break existing builds, tests, or runtime behavior.
- **FR-007**: The responsive breakpoint derivation logic MUST be shared between CLI and web via `@diffgazer/core`.
- **FR-008**: Misplaced code (functions in wrong files/packages, pure re-export passthroughs) MUST be relocated to the correct location.

### Key Entities

- **Shared Package (`@diffgazer/core`)**: Pure utility functions, types, and business logic with no React dependency.
- **Shared Hooks (`@diffgazer/api/hooks`)**: React hooks for data fetching, mutations, and state management shared between CLI and web.
- **Shared Schemas (`@diffgazer/schemas`)**: Zod schemas, domain types, and constants shared across all packages.
- **CLI App (`apps/cli`)**: Ink-based terminal UI consuming shared packages.
- **Web App (`apps/web`)**: React DOM-based browser UI consuming shared packages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero duplicated pure utility functions exist across `apps/cli` and `apps/web` — each utility has exactly one source of truth in a shared package.
- **SC-002**: Total lines of confirmed dead code removed is at least 150 lines.
- **SC-003**: All context providers pass a referential stability check — provider value references are stable when their inputs have not changed.
- **SC-004**: All existing tests pass after every change (no regressions).
- **SC-005**: The number of duplicated keyboard registration blocks in web settings pages drops from 5 to 0.
- **SC-006**: Build succeeds for all packages (`pnpm build` at workspace root).
- **SC-007**: Cross-app code review finds no new DRY violations rated "HIGH" or "CRITICAL" severity.
