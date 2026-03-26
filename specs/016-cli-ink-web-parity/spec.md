# Feature Specification: CLI Ink Web Parity & Cross-Workspace Quality

**Feature Branch**: `016-cli-ink-web-parity`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "Mirror web views in CLI Ink with shared hooks, responsive terminal layout, centered menus, and cross-workspace quality audit"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Terminal Resize Responsiveness (Priority: P1)

A user running the CLI resizes their terminal window. The layout immediately adapts — all views, menus, panels, and content areas re-render to fit the new dimensions without requiring a restart or manual refresh.

**Why this priority**: This is the #1 reported usability problem. Without dynamic resize, the CLI feels broken when users resize their terminal — content overflows, truncates, or renders at stale dimensions. Every other visual improvement depends on this working correctly.

**Independent Test**: Resize the terminal while on any screen (home, review, settings, history, help, onboarding). The layout re-renders within one frame to match the new terminal dimensions.

**Acceptance Scenarios**:

1. **Given** the CLI is running on the home screen, **When** the user widens the terminal from 80 to 160 columns, **Then** the layout expands to use the full 160 columns immediately.
2. **Given** the CLI is running on the review results screen with a two-pane layout, **When** the user narrows the terminal below the medium breakpoint, **Then** the layout switches to a single-column stacked view.
3. **Given** the CLI is running on any screen, **When** the user resizes the terminal vertically, **Then** the content area adjusts its visible row count and scrollable area.
4. **Given** the CLI is in the middle of a review stream, **When** the user resizes, **Then** the progress list and activity log reflow without losing streaming state.

---

### User Story 2 - Centered & Full-Width Layouts Matching Web (Priority: P2)

The CLI renders menus, settings, and content areas with the same visual intent as the web app — menus are horizontally centered, full-width views span the terminal, and list-based views center their content within the available space.

**Why this priority**: Visual parity with the web app is the core goal of this feature. Users who switch between web and CLI should feel they are using the same product. Centered menus and proper layout proportions are the most visible difference.

**Independent Test**: Launch the CLI at various terminal widths (80, 120, 160+ columns) and visually compare each screen against the web app. Menus should be centered, panels should have proportional widths, and content should not be pinned to the left edge.

**Acceptance Scenarios**:

1. **Given** the user is on the home screen at a wide terminal, **When** the home menu renders, **Then** the menu items are horizontally centered with balanced whitespace on both sides.
2. **Given** the user is on a settings sub-screen, **When** content renders, **Then** selector content is centered within the available width, matching the web's card-based layout proportions.
3. **Given** the user is on the review results screen, **When** the two-pane layout renders, **Then** the issue list and details pane split proportionally (matching the web's sidebar/main ratio).
4. **Given** the user is on the history screen, **When** the timeline renders, **Then** the list items span full width with insights pane beside them (or stacked on narrow terminals).

---

### User Story 3 - Shared Hooks Between Web & CLI (Priority: P3)

Hooks that perform the same API calls, state management, or data transformation in both apps are consolidated into the shared `@diffgazer/api/hooks` package. Each app only contains platform-specific hooks (terminal dimensions, DOM scroll, routing navigation). Duplicate logic is eliminated.

**Why this priority**: Reduces maintenance burden and prevents drift between CLI and web behavior. Every duplicated hook is a source of future bugs where one app gets a fix and the other doesn't.

**Independent Test**: After consolidation, run both apps and verify all screens load data, mutations work, and lifecycle flows (review start/resume/complete) behave identically. Removing any remaining per-app hook that duplicates shared logic should break nothing.

**Acceptance Scenarios**:

1. **Given** both apps import `usePageFooter` or equivalent, **When** the shared version is used, **Then** both apps render correct footer shortcuts without per-app wrapper duplication.
2. **Given** the CLI has hooks that duplicate shared query/mutation patterns, **When** they are removed in favor of `@diffgazer/api/hooks` imports, **Then** all CLI screens continue to function correctly.
3. **Given** a developer adds a new API endpoint, **When** they add a hook to `@diffgazer/api/hooks`, **Then** both CLI and web can consume it without any per-app boilerplate.

---

### User Story 4 - Cross-Workspace Code Quality Audit (Priority: P4)

All code across the diffgazer workspace (CLI, web, packages) is audited for code quality: no unnecessary thin wrappers, no duplicated logic, no overengineering, proper DRY/KISS/YAGNI/SRP adherence. Shared code is maximally reused between CLI and web.

**Why this priority**: Ensures long-term maintainability. The CLI was built to mirror the web, so maximizing shared code reduces the surface area for bugs and the effort needed for future features.

**Independent Test**: A code review of the workspace shows no duplicated business logic between CLI and web, no unnecessary abstractions, and all shared utilities are in packages (not copied between apps).

**Acceptance Scenarios**:

1. **Given** both apps have similar components (e.g., trust-panel, info-field, provider-list), **When** their logic (not rendering) is compared, **Then** data fetching and state management is shared via packages — only rendering differs per platform.
2. **Given** the CLI has utility functions, **When** they duplicate functions in web or packages, **Then** they are consolidated into the appropriate shared package.
3. **Given** any component or hook in either app, **When** reviewed, **Then** it follows KISS — no speculative abstractions, no feature flags for hypothetical scenarios, no defensive overengineering.

---

### User Story 5 - Complete View Parity Verification (Priority: P5)

Every screen in the web app has a corresponding CLI screen that presents the same information, navigation paths, and interactions (adapted for terminal). No views are missing or partially implemented.

**Why this priority**: Ensures feature completeness. The CLI should be a full-featured alternative to the web, not a subset.

**Independent Test**: Walk through every web route and verify the CLI has a matching screen with equivalent information and navigation.

**Acceptance Scenarios**:

1. **Given** the web has screens for: home, review (progress/summary/results), history, settings (7 sub-screens), providers, onboarding, help, **When** the CLI is checked, **Then** every screen exists with matching content.
2. **Given** the web's navigation flow (home to review, home to settings to sub-screen, etc.), **When** the CLI is checked, **Then** the same navigation paths are available via keyboard.
3. **Given** the web shows specific data on each screen (provider status, review metrics, severity breakdown, etc.), **When** the CLI is checked, **Then** the same data points are displayed.

### Edge Cases

- What happens when the terminal is resized to extremely small dimensions (< 40 columns or < 10 rows)?
- How does the layout behave when terminal reports 0 columns or 0 rows (piped output / no TTY)?
- What happens when a resize occurs during an active API mutation (e.g., saving settings)?
- How does the CLI handle switching between breakpoint tiers rapidly (user dragging terminal edge)?
- What happens to scrollable content position when the view height changes?
- What happens when the terminal is resized while an overlay (model select, API key input) is open?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CLI layout MUST dynamically re-render when the terminal is resized, updating all visible content to fit the new dimensions within a single render cycle.
- **FR-002**: The CLI MUST subscribe to terminal resize events and propagate new dimensions to all layout-dependent components via reactive state.
- **FR-003**: Menu components (home menu, settings hub, navigation lists) MUST be horizontally centered within the available terminal width.
- **FR-004**: Full-width views (review progress, review results, history) MUST span the entire terminal width, with content areas proportionally distributed.
- **FR-005**: Two-pane layouts (review results: issue list + details, history: timeline + insights) MUST maintain proportional width ratios matching the web app's sidebar/main split.
- **FR-006**: On narrow terminals (below medium breakpoint), two-pane layouts MUST collapse to a single-column stacked layout.
- **FR-007**: Hooks performing identical API calls or state management in both CLI and web MUST be consolidated into the shared hooks package, with per-app code containing only platform-specific behavior.
- **FR-008**: Every screen present in the web app MUST have a corresponding screen in the CLI with equivalent information display and navigation paths.
- **FR-009**: The CLI MUST gracefully handle extremely small terminal sizes (< 40 columns) by showing a minimum viable layout or a "terminal too small" message.
- **FR-010**: Overlay components (model select, API key input) MUST correctly reflow when terminal is resized while they are open.
- **FR-011**: Scrollable content areas MUST preserve their scroll position relative to selected items when terminal height changes.
- **FR-012**: The terminal dimensions hook MUST provide both raw dimensions and computed breakpoint tier, and all components MUST consume dimensions reactively (not as one-time reads).

### Key Entities

- **TerminalDimensions**: Current terminal column and row count, updated on resize events.
- **BreakpointTier**: Computed layout tier (narrow/medium/wide) derived from column count, driving responsive layout decisions.
- **SharedHook**: A React hook in the shared hooks package that provides data fetching, mutations, or state management consumed by both CLI and web.
- **PlatformHook**: A React hook specific to one platform (e.g., terminal dimensions for CLI, scroll-into-view for web) that cannot be shared.
- **Screen**: A CLI top-level view corresponding to a web route, containing layout, data display, and navigation logic.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Terminal resize causes layout update within 1 render frame — no stale dimensions visible to the user after resize completes.
- **SC-002**: All menu screens (home, settings hub) render centered content when terminal width exceeds content width.
- **SC-003**: 100% of web screens have a corresponding CLI screen displaying equivalent information.
- **SC-004**: After hook consolidation, zero duplicated API call patterns exist between CLI-local hooks and web-local hooks — all shared logic lives in the shared hooks package.
- **SC-005**: Cross-workspace audit identifies and resolves all instances of duplicated business logic, unnecessary thin wrappers, and overengineered abstractions.
- **SC-006**: Two-pane layouts maintain proportional splits on wide terminals and gracefully collapse on narrow terminals (below breakpoint threshold).
- **SC-007**: CLI can be used at terminal widths from 40 columns to 300+ columns without layout breakage, overflow, or truncation errors.

## Assumptions

- The existing Ink 6 renderer supports re-rendering on stdout dimension changes when dimensions are consumed as reactive state (via resize event listener rather than one-time reads).
- The existing breakpoint tier system (`getBreakpointTier`) is sufficient for CLI layout decisions — no new tiers are needed.
- The web app's current set of screens is the complete reference — no new screens need to be created for either platform as part of this feature.
- The shared hooks package already contains the majority of shared hooks — consolidation is an incremental improvement, not a rewrite.
- `networkMode: 'always'` in the CLI's QueryClient config is sufficient for all shared hooks to work in the terminal environment without browser API polyfills.
