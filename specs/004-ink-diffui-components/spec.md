# Feature Specification: Ink Component Library for CLI (diff-ui Mirror)

**Feature Branch**: `004-ink-diffui-components`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Create an Ink component library for diffgazer CLI that mirrors the web app views using diff-ui component equivalents, with the same structure and navigation, plus documentation"

## Clarifications

### Session 2026-03-24

- Q: How should modal-based interactions (API key entry, model selection, confirmations) manifest in the CLI? → A: Full-screen overlay — dialog takes over the entire terminal, hiding header/footer temporarily
- Q: What should Theme settings control in the CLI? → A: ANSI color palette selection (dark/light/high-contrast terminal color schemes)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full CLI Review Experience (Priority: P1)

A developer runs diffgazer in the terminal and sees a complete code review experience: a main menu, the ability to start a review, watch real-time progress, view a summary of findings, and browse individual issues with details, code snippets, and fix suggestions -- all rendered natively in the terminal with the same information hierarchy as the web UI.

**Why this priority**: The review flow is the core product value. Without it, the CLI is just a launcher for the web app.

**Independent Test**: Can be fully tested by running `diffgazer` in terminal, selecting "Review Unstaged", watching the progress stream, viewing the summary, and navigating through issues. Delivers the complete review experience without needing any other screens.

**Acceptance Scenarios**:

1. **Given** the CLI is running and the project is configured, **When** the user launches diffgazer, **Then** they see the main menu with context information (provider, model, last review stats, trust status) and a list of available actions
2. **Given** the user selects "Review Unstaged" from the main menu, **When** the review starts, **Then** they see real-time progress with step status, agent activity, and timing information
3. **Given** a review has completed, **When** the summary is displayed, **Then** the user sees a severity breakdown, total issue count, and analysis metrics -- matching the information shown in the web summary view
4. **Given** the user enters the results view, **When** they browse issues, **Then** they can navigate between issues using keyboard shortcuts, see issue details (severity, file, description, code snippet, fix plan) in a split-pane or stacked layout appropriate for terminal dimensions

---

### User Story 2 - Screen Navigation and Layout Parity (Priority: P2)

A developer navigates between all CLI screens (Home, Review, History, Settings, Help, Onboarding) using keyboard shortcuts and menu selections, experiencing the same logical flow and information architecture as the web app. The terminal layout includes a header (with provider status and back navigation), a content area, and a footer (with contextual keyboard shortcut hints).

**Why this priority**: Navigation is the skeleton that connects all features. Without consistent navigation, individual screens feel disconnected.

**Independent Test**: Can be tested by launching the CLI and navigating: Home -> Settings -> Providers -> Back -> Home -> History -> Back -> Help -> Back. Verifies the routing, back navigation, keyboard shortcuts, and layout consistency.

**Acceptance Scenarios**:

1. **Given** the CLI is running, **When** the user is on any screen, **Then** they see a header with the current provider/model status and a footer with contextual keyboard shortcuts
2. **Given** the user is on the Home screen, **When** they press the shortcut key for Settings, **Then** the CLI navigates to the Settings hub screen
3. **Given** the user is on a nested screen (e.g., Settings > Providers), **When** they press the back shortcut, **Then** they return to the parent screen (Settings hub)
4. **Given** the user is on any screen, **When** they press `q`, **Then** the CLI initiates a graceful quit sequence

---

### User Story 3 - Settings Management in CLI (Priority: P3)

A developer configures diffgazer entirely from the terminal: selecting providers, entering API keys, choosing models, setting analysis options, managing trust permissions, configuring storage, and adjusting agent execution settings. Each settings sub-screen mirrors the web equivalent's functionality. Complex multi-step interactions (API key entry, model selection) render as full-screen overlays that take over the terminal, hiding the persistent header/footer until the interaction completes. The Theme settings screen allows selecting between ANSI color palettes (dark, light, high-contrast) for the CLI's terminal output.

**Why this priority**: Settings are required for first-time setup and ongoing configuration changes. Users who prefer CLI-only workflows need full settings access.

**Independent Test**: Can be tested by running the onboarding wizard from a fresh state (no config), completing all steps (provider, API key, model, analysis, storage, execution), then modifying each setting individually via Settings screens.

**Acceptance Scenarios**:

1. **Given** the CLI detects no existing configuration, **When** the user launches diffgazer, **Then** they are guided through an onboarding wizard with steps for provider, API key, model, analysis, storage, and execution settings
2. **Given** the user navigates to Settings, **When** they see the Settings hub, **Then** they see a menu of all settings categories matching the web (Providers, Theme, Storage, Analysis, Agent Execution, Diagnostics, Trust & Permissions)
3. **Given** the user enters the Providers settings screen, **When** they configure an API key and select a model, **Then** the configuration is saved and reflected in the header provider status
4. **Given** the user enters Trust & Permissions, **When** they toggle file read permissions, **Then** the changes take effect immediately and the home screen reflects the updated trust status
5. **Given** the user triggers a dialog-type interaction (e.g., API key entry), **When** the dialog opens, **Then** it takes over the full terminal screen, and **When** completed or dismissed, **Then** the previous screen with header/footer is restored
6. **Given** the user navigates to Theme settings, **When** they select a color palette (dark, light, or high-contrast), **Then** the CLI immediately applies the new ANSI color scheme across all screens

---

### User Story 4 - Review History in CLI (Priority: P4)

A developer browses past review runs from the terminal, seeing a chronological list of reviews with key metadata (date, issue count, severity breakdown). They can select a past review to re-examine its results.

**Why this priority**: History enables users to track improvement over time and revisit past findings without re-running reviews.

**Independent Test**: Can be tested by running multiple reviews, navigating to History, browsing the list, and selecting a past review to view its results.

**Acceptance Scenarios**:

1. **Given** the user navigates to History, **When** the screen loads, **Then** they see a chronological list of past reviews with date, issue count, and severity indicators
2. **Given** the user highlights a past review in the list, **When** they see an insights pane, **Then** it shows a breakdown of that review's findings
3. **Given** the user selects a past review, **When** they press Enter, **Then** the CLI navigates to the review results view for that specific review

---

### User Story 5 - Component Library Documentation (Priority: P5)

A developer contributing to diffgazer or building on top of it can find comprehensive documentation for all terminal UI components: their props, usage patterns, and visual examples. The documentation covers the mapping between web components and their terminal equivalents.

**Why this priority**: Documentation ensures maintainability and enables other contributors to extend the CLI without reverse-engineering component behavior.

**Independent Test**: Can be tested by verifying that each component has a documentation page accessible from the docs app, with props table, usage examples, and visual comparison to the web equivalent.

**Acceptance Scenarios**:

1. **Given** a developer opens the docs, **When** they navigate to the CLI components section, **Then** they find documentation for every terminal UI component
2. **Given** a developer views a component doc page, **When** they read it, **Then** they see the component's purpose, props/API, usage example, and notes on how it maps to the web equivalent
3. **Given** a developer wants to build a new CLI screen, **When** they follow the documented patterns, **Then** they can compose screens using the same component structure as existing screens

---

### Edge Cases

- What happens when the terminal window is too narrow for a split-pane layout? Falls back to stacked/scrollable layout
- How does the CLI handle a review that was started in the web and accessed from CLI History? Loads review data via the same API, renders in terminal format
- What happens when the user resizes the terminal during a review? Layout adapts to new dimensions
- How does the onboarding wizard handle a partially completed setup if the user quits mid-flow? Saves progress, resumes from the last incomplete step on next launch
- What happens when there are more issues than fit on screen? Scrollable list with keyboard navigation
- How does the CLI render code snippets without syntax highlighting? Uses ANSI color codes for basic highlighting, gracefully degrades in limited terminals
- What happens when a full-screen dialog overlay is open and the user presses Escape? The dialog is dismissed and the previous screen is restored
- What happens when the user switches ANSI theme in a terminal that doesn't support 256 colors? Gracefully degrades to basic 16-color palette

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a terminal component library with equivalents for all UI components used in the web app: Badge, Button, Callout, Checkbox, Dialog, EmptyState, Input, Menu, NavigationList, Panel, Radio, ScrollArea, SectionHeader, Tabs, Toast, Spinner, ProgressList, SeverityBar
- **FR-002**: System MUST render a persistent layout with header (provider status, back navigation), content area, and footer (contextual keyboard shortcuts) on every screen
- **FR-003**: System MUST support screen-based routing matching the web app's route structure: Home, Review (with streaming/summary/results phases), History, Help, Onboarding, and Settings (with 7 sub-screens: Hub, Providers, Theme, Storage, Analysis, Agent Execution, Diagnostics, Trust & Permissions)
- **FR-004**: System MUST support keyboard-driven navigation: arrow keys for list/menu traversal, Enter for selection, Escape/Backspace for back, and single-key shortcuts (q, s, h) for global actions
- **FR-005**: System MUST display real-time review progress with step completion status, agent activity indicators, and elapsed time
- **FR-006**: System MUST render issue details including severity indicator, file path, description, code snippet, and fix plan in the review results view
- **FR-007**: System MUST support the onboarding wizard flow with sequential steps matching the web onboarding (provider, API key, model, analysis, storage, execution)
- **FR-008**: System MUST adapt layout to terminal dimensions, using stacked layouts when width is insufficient for side-by-side display
- **FR-009**: System MUST provide documentation for every terminal component covering props, usage, and web-to-terminal mapping
- **FR-010**: System MUST organize code following the same feature-based structure as the web app, using "screens" instead of "pages"
- **FR-011**: Terminal components MUST have a consistent API surface that mirrors their web diff-ui counterparts where applicable (same prop names for shared concepts like `variant`, `size`, `onSelect`)
- **FR-012**: System MUST display review history as a navigable list with date, issue count, and severity breakdown per review
- **FR-013**: Dialog components MUST render as full-screen overlays that take over the entire terminal, temporarily hiding the persistent header and footer, and restoring the previous screen on dismissal via Escape or completion
- **FR-014**: Theme settings MUST offer ANSI color palette selection with at least three options: dark, light, and high-contrast. The selected palette MUST be applied immediately and persisted across sessions

### Key Entities

- **Screen**: A full terminal view corresponding to a web route (Home, Review, History, Settings, Help, Onboarding). The top-level unit of navigation
- **Terminal Component**: A terminal-native React component that mirrors the visual behavior and API of a diff-ui web component, adapted for terminal rendering constraints (box-drawing characters, ANSI colors, fixed-width text)
- **Layout**: The persistent frame around screen content (header + content area + footer) providing navigation context and status information
- **Feature Module**: A self-contained directory grouping a screen's components, hooks, and utilities -- matching the web app's feature-based organization pattern
- **Dialog Overlay**: A full-screen terminal view that temporarily replaces all screen content (including header/footer) for complex multi-step interactions; dismissed via Escape or on completion
- **ANSI Theme**: A named color palette (dark, light, high-contrast) defining ANSI color assignments for all terminal components. Persisted in user configuration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 13 screens present in the web app (Home, Review streaming/summary/results, History, Help, Onboarding, Settings Hub + 7 sub-screens) have functional terminal equivalents that display the same information
- **SC-002**: Users can complete the full review workflow (start review -> watch progress -> view summary -> browse issues -> navigate back) entirely in the terminal
- **SC-003**: Users can navigate between any two screens using keyboard shortcuts in under 2 seconds per transition
- **SC-004**: Terminal layout adapts correctly to widths from 80 to 200+ columns without content overflow or truncation
- **SC-005**: Every terminal component (18+ components) has a documentation page with props table, usage example, and web-mapping notes
- **SC-006**: First-time setup can be completed entirely in the terminal via the onboarding wizard without needing the web UI
- **SC-007**: Past reviews accessible from History load and display correctly, matching the data shown in the web History view

## Assumptions

- The CLI already has Ink 6 installed and basic rendering infrastructure (confirmed: `apps/cli/` uses Ink + React)
- The same `@diffgazer/api` client used by the web app will be used by the CLI for data fetching
- The same `@diffgazer/schemas` are available for type-safe data structures
- Keyscope hooks (useKey, useScope) are available for keyboard navigation in the terminal environment
- Terminal width of 80 columns is the minimum supported width
- The CLI shares the same Hono backend server as the web app for all API operations
