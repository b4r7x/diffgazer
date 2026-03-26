# Feature Specification: CLI-Web Full Parity with Shared Infrastructure

**Feature Branch**: `015-cli-web-parity-shared-infra`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "CLI-Web full parity: shared Ink component library mirroring web views, shared API hooks, cross-workspace quality audit"

## Clarifications

### Session 2026-03-26

- Q: Is this feature a greenfield build or an audit-and-refine of the existing CLI implementation? → A: Audit & refine. The existing CLI (14 screens, 18 Ink components, shared hooks integrated) is the baseline. Find gaps, fix quality issues, fix bugs, and maximize code sharing.
- Q: Known bugs? → A: Critical navigation bug on CLI home screen — arrow keys don't work, menu component is non-functional, buttons don't navigate to other views. User cannot access any screen beyond the home view.
- Q: When web parity conflicts with terminal usability (e.g., multi-pane in narrow terminal), which wins? → A: Pixel-perfect parity with multi-pane layouts. Both CLI and web MUST live-detect viewport/terminal width changes and dynamically switch layouts (multi-pane ↔ stacked). Same responsive behavior in both platforms.
- Q: Should audit findings requiring changes in other workspace repos (diff-ui, cli-core, registry-kit, keyscope) be fixed or documented? → A: Fix everything. Make changes across all 5 repos in this feature. No follow-up issues — resolve all findings in-place.

## Known Issues *(blocking)*

- **HOME-NAV-001**: CLI home screen navigation is completely broken — arrow keys do not highlight menu items, the menu component does not respond to input, and selecting menu items (Review, History, Settings, etc.) does not navigate to the corresponding screen. This blocks all other screen verification.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Fix CLI Navigation and Verify All Screens Are Reachable (Priority: P1)

A developer launches diffgazer from the terminal and can navigate the home menu with arrow keys, select any menu item with Enter, and reach every screen (Review, History, Settings, Onboarding, Help). Currently, the home screen navigation is broken: arrow keys don't work, the menu component doesn't respond, and buttons don't navigate anywhere. This must be fixed first — it blocks verification of all other screens.

**Why this priority**: The CLI is completely unusable in its current state. No screen beyond the home view can be reached. This is the prerequisite for every other user story.

**Independent Test**: Launch the CLI, use arrow keys to highlight each menu item, press Enter on each one, and verify navigation to the correct screen. Then press Esc/back to return home and repeat for all items.

**Acceptance Scenarios**:

1. **Given** the CLI home screen, **When** the user presses arrow keys, **Then** menu items highlight in sequence (Review Unstaged, Review Staged, Resume Review, History, Settings, Help, Quit).
2. **Given** a highlighted menu item, **When** the user presses Enter, **Then** the CLI navigates to the corresponding screen (e.g., "History" → history screen, "Settings" → settings hub).
3. **Given** any non-home screen, **When** the user presses Esc, **Then** the CLI navigates back to the home screen with the menu still functional.
4. **Given** all screens are reachable, **When** each screen renders, **Then** the data, controls, and layout match the corresponding web view — context sidebar, review progress, summary, results with two-pane issue browser, history with timeline, settings hub with sub-pages.

---

### User Story 2 — Shared API Data Layer Eliminates Duplication (Priority: P1)

Both the CLI and web app consume the same set of API hooks from a single shared package (`@diffgazer/api/hooks`). No hand-rolled `useState + useEffect` fetch patterns exist in either app. Adding a new API endpoint means writing one hook in the shared package, and both apps gain access immediately.

**Why this priority**: Duplicated API logic was the original pain point that led to the shared hooks architecture. Any regression — hooks that exist only in one app, or duplicated fetch patterns — undermines the entire architecture.

**Independent Test**: Grep both apps for direct `fetch()` calls or `useState + useEffect` data-fetching patterns. None should exist outside the documented exceptions (route guards, imperative functions). Every query/mutation used by either app traces back to `@diffgazer/api/hooks`.

**Acceptance Scenarios**:

1. **Given** the shared hooks package, **When** a developer adds a new query hook, **Then** both CLI and web can import and use it without any additional per-app wrappers (unless platform-specific behavior is needed).
2. **Given** both apps running, **When** a mutation fires (e.g., save settings), **Then** the same cache invalidation rules apply in both apps — the affected queries refetch automatically.
3. **Given** the CLI app, **When** TanStack Query runs in Node.js (Ink), **Then** queries and mutations work without browser polyfills.
4. **Given** loading/error states in any screen, **When** a query is pending or has failed, **Then** both apps use `matchQueryState()` for consistent, declarative state rendering without per-component boilerplate.

---

### User Story 3 — Complete Settings and Onboarding Parity (Priority: P2)

The CLI onboarding wizard and all settings screens (Trust, Theme, Provider, Storage, Agent Execution, Analysis, Diagnostics) provide the same configuration options, validation rules, and feedback as the web equivalents. A user who completes onboarding in the CLI has an identical configuration to one who completes it in the web.

**Why this priority**: Configuration is the gateway to using the product. Inconsistencies between CLI and web settings create confusion and support burden.

**Independent Test**: Walk through the full onboarding flow in both CLI and web. At each step, verify the same options are available, the same validations apply, and the resulting saved configuration is identical.

**Acceptance Scenarios**:

1. **Given** the onboarding wizard, **When** the user completes all 6 steps (Storage, Provider, API Key, Model, Analysis, Execution), **Then** both CLI and web produce the same configuration with the same fields and values.
2. **Given** the settings hub, **When** the user opens any sub-page, **Then** the CLI shows the same options, current values, and action buttons as the web equivalent.
3. **Given** a provider settings page, **When** the user configures an API key and selects a model, **Then** the dialogs/overlays in CLI offer the same input methods (paste, env var) and model filtering as the web.
4. **Given** the diagnostics page, **When** the user views system health, **Then** CLI shows server status, setup status, and context status with the same detail level as the web.

---

### User Story 4 — History Browsing with Full Detail (Priority: P2)

The CLI history screen provides the same three-pane layout as the web: a timeline grouped by date, a scrollable list of review runs, and an insights pane showing severity breakdown and issue details for the selected review. Users can search, filter, and navigate to any past review.

**Why this priority**: History is essential for tracking review trends and revisiting past findings. A CLI without full history browsing forces users to switch to the web for this workflow.

**Independent Test**: Run 3+ reviews, then open history in both CLI and web. Verify the same reviews appear, the same date groupings are shown, and selecting a review shows the same insights data.

**Acceptance Scenarios**:

1. **Given** the history screen, **When** reviews exist, **Then** the CLI displays a date-grouped timeline, a scrollable run list, and an insights pane — matching the web's three-pane layout.
2. **Given** the search functionality, **When** the user types a search query, **Then** the CLI filters reviews by ID, branch, or project path — same as the web.
3. **Given** a selected review in history, **When** the user presses Enter, **Then** the CLI navigates to the full review results view for that review.

---

### User Story 5 — Live Responsive Layout in Both CLI and Web (Priority: P2)

Both CLI and web detect viewport/terminal width changes in real time and dynamically switch between layout modes (multi-pane for wide, stacked for narrow). The layouts are pixel-perfect mirrors of each other — same breakpoints, same pane proportions, same collapse behavior. Resizing dynamically adjusts the layout without losing state.

**Why this priority**: Terminal and browser users work in various window sizes. Both platforms must respond identically to width changes so the experience is consistent regardless of interface.

**Independent Test**: Run both CLI and web side-by-side. Resize both to matching widths (narrow, medium, wide). Verify the layouts match at each breakpoint — same panes visible, same stacking order, same proportions.

**Acceptance Scenarios**:

1. **Given** a wide viewport/terminal (>= 120 columns), **When** any screen renders, **Then** both CLI and web show full multi-pane layouts (sidebar + content, list + details) with matching proportions.
2. **Given** a medium viewport/terminal (80–119 columns), **When** any screen renders, **Then** both CLI and web show a condensed layout with reduced pane widths but all panes still visible.
3. **Given** a narrow viewport/terminal (< 80 columns), **When** any screen renders, **Then** both CLI and web collapse to stacked single-column layout with no horizontal overflow.
4. **Given** a running CLI or web app, **When** the user resizes the viewport/terminal, **Then** the layout switches between modes in real time without losing current screen state, selection, or navigation position.
5. **Given** the same breakpoint width, **When** comparing CLI and web, **Then** the same panes are visible, in the same order, with the same relative sizing.

---

### User Story 6 — Cross-Workspace Code Quality Audit with All Findings Fixed (Priority: P3)

Across all 5 workspace repos (diffgazer, diff-ui, cli-core, registry-kit, keyscope), the codebase is audited and all findings are fixed in-place — no deferred issues, no follow-up tickets. The audit covers: duplicated logic between CLI and web, thin wrappers adding no value, over-engineered abstractions, anti-patterns, unused code, and opportunities to extract shared logic to upstream packages (cli-core, registry-kit). The Ink component library mirrors diff-ui's API surface so developers working in either platform use familiar patterns.

**Why this priority**: Long-term maintainability depends on consistency across the entire workspace. Fixing only diffgazer while leaving issues in upstream packages creates a false sense of quality. All 5 repos ship together.

**Independent Test**: Run a cross-workspace audit of all 5 repos. Fix every finding. Re-audit to confirm zero remaining issues. All repos build, type-check, and pass tests after changes.

**Acceptance Scenarios**:

1. **Given** the CLI Ink component library, **When** compared to diff-ui web components, **Then** matching components expose the same prop names, variants, and composition patterns — adapted only where terminal constraints require it.
2. **Given** both apps, **When** audited for duplicated logic, **Then** no business logic is duplicated — only platform-specific rendering adapters exist per-app. Shared logic has been extracted to upstream packages where appropriate.
3. **Given** the shared hooks package, **When** audited for thin wrappers, **Then** every hook provides meaningful logic — no hooks exist that simply re-export or trivially wrap another function.
4. **Given** all 5 workspace repos, **When** audited for code quality, **Then** no anti-patterns are found: no manual memoization (React 19 Compiler handles this), no type assertions, no commented-out code, no unused imports.
5. **Given** changes made across repos, **When** the full workspace builds, **Then** all 5 repos compile, type-check, and pass their test suites without regressions.

---

### Edge Cases

- **Server disconnection during review stream**: CLI shows "Server Disconnected" with retry option, same as web's error state.
- **Invalid review ID in navigation**: CLI validates UUID format and shows error toast, same as web's route guard behavior.
- **Active session resume after crash**: CLI queries for active session on review screen mount, resumes if found, starts fresh if stale — same as web's resume logic.
- **No git changes detected**: CLI shows "No Changes" view with option to switch mode (staged/unstaged) — same as web.
- **Extremely narrow terminal (< 40 columns)**: CLI collapses to stacked layout and removes decorative borders/padding to fit content. All controls remain accessible.
- **Missing provider/API key**: CLI shows configuration prompt with navigation to settings — same as web's missing key view.
- **Concurrent CLI and web sessions**: Both can run simultaneously against the same backend without conflicts, sharing configuration and review data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: CLI MUST render every screen present in the web app: Home, Review (streaming, summary, results), History, Onboarding (6 steps), Settings Hub, and all 7 settings sub-pages (Trust, Theme, Provider, Storage, Agent Execution, Analysis, Diagnostics).
- **FR-002**: CLI MUST display the same data fields, status indicators, and information hierarchy as the corresponding web screen — no missing data points.
- **FR-003**: CLI MUST use the same keyboard navigation scheme as the web: arrow keys for navigation, Tab for zone switching, Space/Enter for selection, Esc for back, with per-screen shortcut customization.
- **FR-004**: Both apps MUST consume all API data through shared hooks from `@diffgazer/api/hooks` — no direct `fetch()` or hand-rolled state management for API data outside documented exceptions.
- **FR-005**: CLI MUST use `matchQueryState()` from the shared hooks for all loading/error/success state rendering — no per-component boilerplate for query states.
- **FR-006**: CLI Ink components MUST mirror diff-ui web components in prop names, variant options, and composition patterns — adapted only where terminal rendering constraints require it.
- **FR-007**: Both CLI and web MUST live-detect viewport/terminal width changes and dynamically switch layouts using shared breakpoints — multi-pane for wide (>= 120), condensed for medium (80–119), stacked for narrow (< 80). Layout transitions MUST preserve screen state.
- **FR-008**: CLI review flow MUST support the same phase state machine as web: loading, streaming, summary, results — with the same transitions and conditions.
- **FR-009**: CLI MUST support review resume: if a reviewId is provided or an active session exists, resume the stream rather than starting fresh.
- **FR-010**: CLI onboarding MUST validate inputs using the same schemas from `@diffgazer/schemas` as the web.
- **FR-011**: Mutations in CLI MUST trigger the same cache invalidation rules as web.
- **FR-012**: CLI MUST display toast notifications for user-facing events with the same message content as web toasts.
- **FR-013**: CLI provider settings MUST support the same workflows as web: search/filter providers, set API key (paste or env var), select model with filtering, activate/deactivate providers.
- **FR-014**: CLI history screen MUST support search, date-grouped timeline, and per-review insights pane — matching the web's three-pane layout.

### Key Entities

- **Screen**: A full-page terminal view (equivalent to a web route/page). Contains components, keyboard bindings, and data dependencies.
- **Ink Component**: A terminal UI primitive (button, menu, dialog, etc.) that mirrors a diff-ui web component in API surface and behavior.
- **Shared Hook**: A React hook in `@diffgazer/api/hooks` that encapsulates API query/mutation logic, consumed identically by both CLI and web.
- **Focus Zone**: A keyboard navigation region within a screen. Zones are cycled with Tab, items within a zone are navigated with arrow keys.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every web screen (10 routes) has a corresponding CLI screen with the same data, controls, and navigation — verified by side-by-side comparison.
- **SC-002**: Zero instances of duplicated API fetch logic between CLI and web — all data fetching traces to shared hooks.
- **SC-003**: Zero instances of hand-rolled data-fetching patterns in either app — all API state managed through shared hooks.
- **SC-004**: All CLI Ink components accept the same core props and variants as their diff-ui web counterparts.
- **SC-005**: Both CLI and web switch layouts at the same breakpoints (< 80, 80–119, >= 120 columns) with live detection — resizing triggers immediate layout transition in both platforms without state loss.
- **SC-006**: Cross-workspace audit of all 5 repos (diffgazer, diff-ui, cli-core, registry-kit, keyscope) produces zero remaining findings — all issues fixed in-place, all repos build and pass tests.
- **SC-007**: A new API endpoint added to the shared hooks package is immediately usable in both apps without per-app adapter code (unless platform-specific behavior is required).
- **SC-008**: CLI review completion time is within 5% of web review completion time for the same codebase — no performance regression from the terminal layer.

## Assumptions

- This feature is an audit-and-refine of the existing CLI implementation (14 screens, 18 Ink components, shared hooks already integrated) — not a greenfield build. The existing code is the baseline.
- The existing shared hooks architecture (`@diffgazer/api/hooks`) is the correct foundation — this feature extends it, not replaces it.
- Ink 6 + React 19 provides sufficient rendering capability to reproduce all web layouts in terminal form (with adaptive simplification for narrow terminals).
- The `useReviewLifecycle` hook remains platform-specific by design — CLI manages a phase state machine while web syncs to URL state. This is not duplication.
- Terminal users accept that some visual details (hover effects, animations, gradient colors) cannot be reproduced in a text-based terminal — the information content and controls are what must match.
- The backend server (`apps/server/`) requires no changes — this feature is purely about the client-side rendering and data consumption layer.
- The home screen navigation bug (HOME-NAV-001) is the highest priority fix — it blocks all other screen verification and audit work.
