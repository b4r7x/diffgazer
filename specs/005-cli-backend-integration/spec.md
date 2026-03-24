# Feature Specification: CLI Backend Integration

**Feature Branch**: `005-cli-backend-integration`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Connect CLI Ink components to backend API, replace all mock data with real API calls via @diffgazer/api, verify all views match web app, ensure terminal responsiveness, hook up the entire backend"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start and Complete a Real Code Review from CLI (Priority: P1)

A developer opens the diffgazer CLI, navigates to "Review Unstaged" or "Review Staged" from the home menu, and sees a real-time streaming review of their code changes. The review progress shows actual AI analysis steps (diff parsing, context building, agent execution, enrichment), live activity logs with real agent events, and concludes with a summary and browsable results — identical in structure and data to what the web app shows.

**Why this priority**: The review flow is the core product functionality. Without real review streaming, the CLI is a non-functional UI shell. This story touches the most complex backend integration (SSE streaming, multi-phase state machine, real-time event handling) and validates the entire pipeline end-to-end.

**Independent Test**: Can be fully tested by running `diffgazer` CLI in a git repository with unstaged changes, selecting "Review Unstaged", and verifying that real issues appear with severity, code evidence, and fix plans — matching what the web UI would show for the same changes.

**Acceptance Scenarios**:

1. **Given** a configured CLI (provider, API key, trust granted) with unstaged git changes, **When** the user selects "Review Unstaged" from the home menu, **Then** the review streaming phase begins showing real progress steps (diff → context → review → enrich → report) with actual agent activity logs, and transitions to a summary view with real issue counts and severity breakdown.
2. **Given** a review has completed with results, **When** the user enters the results view, **Then** they can browse real issues with severity filtering (all/blocker/high/medium/low/nit), view issue details with code evidence, explanations, and fix plans — all sourced from the backend, not mock data.
3. **Given** the user navigates to a saved review (via "Resume Last Review" on home or from history), **When** the review exists on disk, **Then** the saved results load and display identically to a freshly completed review.
4. **Given** no git changes are detected for the selected mode, **When** the review starts, **Then** the "No Changes" view appears with an option to switch between staged/unstaged modes.
5. **Given** no AI provider is configured, **When** the user tries to start a review, **Then** the "API Key Missing" view appears directing them to configure a provider in settings.

---

### User Story 2 - Configure AI Provider and Settings via CLI (Priority: P2)

A developer uses the CLI settings screens to configure their AI provider (select provider, enter API key, choose model), adjust analysis preferences (lenses, execution mode, storage), and manage repository trust — all persisted via the real backend API. Changes made in the CLI are immediately reflected in the web UI and vice versa, since both use the same backend config store.

**Why this priority**: Configuration is a prerequisite for the review flow. If settings don't persist via the backend, the CLI cannot function independently. This also validates that the onboarding wizard works end-to-end and that config state is shared between CLI and web.

**Independent Test**: Can be tested by completing the onboarding wizard in the CLI, then opening the web UI and verifying the same provider/model/settings are active — and vice versa.

**Acceptance Scenarios**:

1. **Given** a first-time user with no configuration, **When** they launch the CLI, **Then** the onboarding wizard starts and each step (storage, provider, API key, model, analysis, execution) saves its selection via the real backend API, and upon completion the user lands on the home screen with the configured provider shown in the context sidebar.
2. **Given** a configured CLI, **When** the user navigates to Settings → Providers, **Then** real provider statuses are loaded from the backend (which have API keys, which are active), and the user can activate a different provider, enter/update API keys, and select models — all persisted immediately.
3. **Given** any settings screen (theme, storage, analysis, agent execution, trust), **When** the user changes a setting, **Then** the change is saved via the real API and is reflected when the screen is revisited or when checked from the web UI.
4. **Given** the Providers screen with OpenRouter selected, **When** the user opens the model selector, **Then** the real model list is fetched from the backend and displayed for selection.

---

### User Story 3 - Browse Review History from CLI (Priority: P3)

A developer navigates to the History screen to browse past code reviews, search by branch or ID, view timeline groupings, and select a review to see its full results. All data comes from the backend's saved review store.

**Why this priority**: History provides continuity between sessions and is the second most-used feature after reviews. It validates the review CRUD API integration and the ability to navigate to saved review results.

**Independent Test**: Can be tested by running a review from the web UI, then opening the CLI History screen and verifying the review appears with correct metadata, and that selecting it loads the full results view.

**Acceptance Scenarios**:

1. **Given** past reviews exist in the backend store, **When** the user navigates to History, **Then** reviews are fetched from the backend and displayed in a timeline list grouped by date, with each entry showing review ID, branch, timestamp, and issue summary.
2. **Given** a review is selected in the history list, **When** the user presses Enter, **Then** the CLI navigates to the review results view and loads the full review data from the backend.
3. **Given** the history list is displayed, **When** the user types in the search field, **Then** reviews are filtered by ID, branch name, or project path — matching the web app's search behavior.

---

### User Story 4 - Home Screen with Live Backend State (Priority: P4)

The home screen's context sidebar and menu items reflect real backend state: active provider/model, trust status, and last review information. Menu items are correctly enabled/disabled based on configuration state.

**Why this priority**: The home screen is the entry point and must accurately reflect the system state to guide user actions. It also validates the init/check config flow.

**Independent Test**: Can be tested by launching the CLI and verifying the context sidebar shows the real active provider, model, trust status, and last review — matching the web app's home page.

**Acceptance Scenarios**:

1. **Given** a configured CLI with an active provider, **When** the home screen loads, **Then** the context sidebar shows the real provider name, model, trust status, and the header shows the provider status indicator.
2. **Given** the repository is not trusted, **When** the home screen loads, **Then** the trust panel is shown with capability toggles, and granting trust persists via the real backend API.
3. **Given** a previous review exists, **When** the home screen loads, **Then** "Resume Last Review" is enabled and shows the last review's issue count.

---

### User Story 5 - Diagnostics and System Health from CLI (Priority: P5)

The diagnostics screen shows real system health data: server status, setup completeness, context snapshot status, and supports context regeneration.

**Why this priority**: Diagnostics is important for troubleshooting but is not on the critical path. It validates the health/context API integration.

**Independent Test**: Can be tested by opening Settings → Diagnostics and verifying that real server health data is shown, and that "Regenerate Context" triggers actual context snapshot rebuilding.

**Acceptance Scenarios**:

1. **Given** the diagnostics screen is opened, **When** the user views it, **Then** real data is shown: server health, setup completeness, context snapshot status, and environment info — all fetched from the backend.
2. **Given** the diagnostics screen, **When** the user selects "Regenerate Context", **Then** the backend is called to rebuild the project context snapshot and the UI reflects the updated state.

---

### User Story 6 - Terminal Responsiveness Across All Screens (Priority: P6)

All CLI screens adapt their layout to the terminal's column/row dimensions, matching the responsive behavior patterns seen in the web app (two-column layouts collapse on narrow terminals, scroll areas adjust height, text wraps correctly).

**Why this priority**: Terminal users have varying window sizes and may resize during use. While the core functionality works regardless of layout, a broken layout makes the CLI unusable.

**Independent Test**: Can be tested by resizing the terminal window while on each screen and verifying that layouts adapt gracefully — no overlapping content, truncated text, or broken borders.

**Acceptance Scenarios**:

1. **Given** a wide terminal (120+ columns), **When** viewing two-pane screens (review results, history, providers), **Then** both panes are visible side-by-side with proportional widths matching the web app's layout ratios.
2. **Given** a narrow terminal (< 80 columns), **When** viewing two-pane screens, **Then** the layout either stacks vertically or focuses on the active pane, without content overlapping or being cut off.
3. **Given** any screen with scrollable content, **When** the terminal is resized, **Then** the scroll area adjusts its height to fill available space and scroll indicators update accordingly.

---

### Edge Cases

- What happens when the backend server is not running or becomes unreachable mid-operation? CLI should show a connection error state (similar to web's "Server Disconnected" with retry), not crash.
- What happens when a review streaming connection drops mid-review? The CLI should detect the broken SSE connection and show an error with the option to retry.
- What happens when the user's API key is invalid or rate-limited? The review flow should surface the specific error (invalid key vs. rate limit) with actionable guidance, matching the web app's error handling.
- What happens when there are no saved reviews in history? The history screen should show an empty state, not an error.
- What happens when the config file is corrupted or missing? The CLI should fall through to the onboarding flow, matching the web's config guard behavior.
- What happens when the terminal has very few rows (< 20)? Scrollable areas should still function with minimal viewport, and the layout should not break.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: CLI MUST use the shared API client package for all backend communication, using the same factory and bound methods as the web app.
- **FR-002**: CLI MUST replace all mock data (MOCK_STEPS, MOCK_LOG_ENTRIES, MOCK_ISSUES, MOCK_SUMMARY, MOCK_REVIEWS, MOCK_PROVIDERS, MOCK_MODELS) with real API calls to the corresponding backend endpoints.
- **FR-003**: CLI MUST implement real SSE streaming for code reviews, handling all 20+ event types (step events, agent events, enrichment events, completion) and updating the progress/activity views in real-time.
- **FR-004**: CLI MUST implement the config guard pattern: check configuration state on startup and redirect to the onboarding wizard if not configured, matching the web app's guard behavior.
- **FR-005**: All onboarding wizard steps MUST save their selections via real API calls so that configuration persists across CLI and web sessions.
- **FR-006**: Settings screens (theme, providers, storage, analysis, agent execution, trust permissions) MUST load current values from the backend on mount and save changes via the corresponding API endpoints.
- **FR-007**: The providers screen MUST fetch real provider statuses, support activating/deactivating providers, entering/updating API keys, and selecting models — including fetching the OpenRouter model list from the backend.
- **FR-008**: The history screen MUST fetch real review data and support navigating to saved review results.
- **FR-009**: The home screen context sidebar MUST display real backend state: active provider, model, trust status, and last review info — loaded from the backend on mount.
- **FR-010**: The review results view MUST display real issues with all detail tabs (overview with code evidence, explanation, agent trace, suggested patch) populated from backend data, matching the web app's structure.
- **FR-011**: The diagnostics screen MUST show real server health, setup status, and context snapshot state, and support triggering context regeneration via the backend API.
- **FR-012**: CLI MUST handle server connection failures gracefully with a retry mechanism, showing a clear error state when the backend is unreachable — not crashing or hanging.
- **FR-013**: CLI MUST handle API errors with user-friendly messages, distinguishing between common error types (invalid API key, rate limit, network failure, server error) matching the web app's error handling patterns.
- **FR-014**: All two-pane layouts (review results, history, providers) MUST adapt to terminal width: side-by-side on wide terminals, stacked or focused on narrow terminals.
- **FR-015**: The header provider status indicator MUST show real provider name and connection state (active/idle), matching the web app's header behavior.
- **FR-016**: The "Resume Last Review" menu item on the home screen MUST check for active review sessions and enable/disable accordingly.
- **FR-017**: The shutdown flow (quit from home menu) MUST call the proper API to terminate the server process.
- **FR-018**: Review mode switching (staged/unstaged) MUST work with real parameters passed to the streaming endpoint.

### Key Entities

- **API Client Instance**: The shared API client configured with the server URL and project root. Single instance shared across all screens, created at app initialization.
- **Review Stream Event**: The discriminated union of 20+ SSE event types (step, agent, enrichment, completion) that drive the review progress UI in real-time.
- **Init Response**: The full initialization payload containing provider status, settings, project info, trust state, and setup completeness — consumed by the home screen and config guards.
- **Saved Review**: A persisted review with full results (issues, summary, metadata, git context) loaded from the backend store for history browsing and review resumption.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 13 CLI screens display real backend data with zero mock/hardcoded data remaining in the production source code.
- **SC-002**: A code review started from the CLI produces identical results (same issues, severities, code evidence) as a review of the same changes started from the web UI.
- **SC-003**: Configuration changes made in the CLI are immediately visible in the web UI, and vice versa — verifiable by toggling between both interfaces.
- **SC-004**: The review streaming view updates in real-time as SSE events arrive, with no perceptible lag between event receipt and UI update in the terminal.
- **SC-005**: All CLI screens render correctly on terminals between 40 and 200+ columns wide, with no overlapping content, truncated critical information, or broken borders.
- **SC-006**: When the backend server is unreachable, the CLI shows a clear error state within 5 seconds and offers retry — does not crash, hang, or show raw stack traces.
- **SC-007**: The CLI's feature set covers 100% of the web app's user-facing screens, with each screen consuming the same backend endpoints as its web counterpart.

## Assumptions

- The embedded Hono server (prod mode) and dev server spawning (dev mode) already work correctly — this feature focuses on connecting screens to the backend, not on server infrastructure.
- The shared API client package is stable and its methods match the server's API contract — no API client changes are needed.
- The existing 18 Ink UI components (Badge, Button, Callout, etc.) are feature-complete for rendering backend data — no new UI components need to be created.
- The review SSE streaming protocol is the same for CLI and web consumers — no CLI-specific server endpoints are needed.
- Terminal responsiveness uses the existing `useTerminalDimensions()` hook that's already implemented in the CLI.
