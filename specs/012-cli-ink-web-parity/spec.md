# Feature Specification: CLI Ink Web Parity

**Feature Branch**: `012-cli-ink-web-parity`
**Created**: 2026-03-25
**Status**: Draft
**Input**: User description: "Create Ink component library mirroring web app views for CLI, share API hooks between web and CLI via @diffgazer/api/hooks, connect CLI to same backend, audit implementation quality (DRY, KISS, YAGNI, SRP, clean code)"

## Clarifications

### Session 2026-03-25

- Q: When consolidating hooks into the shared package, can the web app's code also be modified? → A: Full cross-app — both web and CLI code can be freely modified, including web UI refactoring.
- Q: Should the quality audit cover only CLI code, or also shared hooks and web app? → A: Full codebase audit — CLI, shared hooks package, and the entire web app, not limited to files modified during this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unified API Data Fetching Across CLI and Web (Priority: P1)

As a developer using diffgazer, I want the CLI terminal app to fetch and display data from the same backend using the same shared hooks as the web app, so that both interfaces stay consistent and I get the same data regardless of which interface I use.

Currently, the CLI and web app may have divergent data-fetching implementations. By consolidating all API hooks into a single shared package, both apps use identical query logic, cache invalidation, and error handling — eliminating duplication and reducing bugs.

**Why this priority**: This is the foundation for all other stories. Without shared data fetching, every CLI screen would need its own bespoke API integration, duplicating logic and creating drift between web and CLI behavior.

**Independent Test**: Can be tested by launching the CLI, navigating to any data-driven screen (home, review, settings), and verifying that the displayed data matches what the web app shows for the same backend state.

**Acceptance Scenarios**:

1. **Given** a running backend server, **When** the user launches the CLI and navigates to the home screen, **Then** the CLI displays the same project information and status as the web home page.
2. **Given** a running backend with existing reviews, **When** the user opens the review history in the CLI, **Then** all reviews visible in the web history page are also visible in the CLI.
3. **Given** the user saves a setting in the CLI, **When** they open the web app, **Then** the changed setting is reflected immediately (and vice versa).
4. **Given** the backend is unreachable, **When** the user launches the CLI, **Then** a clear connection error is shown with a retry option, matching the web app's error behavior.

---

### User Story 2 - Complete Screen Parity Between Web and CLI (Priority: P1)

As a user, I want every view available in the web app to have a functionally equivalent screen in the CLI, so that I can accomplish all tasks without leaving the terminal.

Every web route (home, review, history, onboarding, settings/*, providers, help) must have a corresponding CLI screen that offers the same functionality — viewing, creating, editing, and navigating — adapted for the terminal environment.

**Why this priority**: Feature completeness ensures users are not forced to switch to the web app for any workflow. This is equally critical to shared hooks because screens without data are useless, and data without screens is invisible.

**Independent Test**: Can be tested by enumerating all web routes and verifying each has a corresponding CLI screen with equivalent functionality.

**Acceptance Scenarios**:

1. **Given** the web app has screens for home, review, history, onboarding, settings (trust, agent execution, theme, storage, diagnostics, analysis, providers), and help, **When** the user navigates the CLI, **Then** each of these is accessible as a distinct CLI screen.
2. **Given** a review is in progress on the web, **When** the user opens the CLI review screen, **Then** they see the same review progress, issues, and details.
3. **Given** the user is on any CLI screen, **When** they use keyboard navigation, **Then** they can move between screens using consistent, discoverable shortcuts.

---

### User Story 3 - CLI Review Workflow Mirror (Priority: P1)

As a developer, I want to start, monitor, and inspect AI code reviews entirely from the CLI, matching the web review experience, so that I can stay in my terminal workflow.

The review flow is the core feature of diffgazer. The CLI must support: starting a new review, streaming review progress in real-time, viewing the issue list with severity breakdown, drilling into individual issue details, and navigating between issues.

**Why this priority**: The review workflow is the primary use case of diffgazer. Without a complete CLI review experience, the terminal app is essentially a settings viewer.

**Independent Test**: Can be tested by initiating a review from CLI, watching it stream to completion, browsing issues by severity, and viewing individual issue details with code context.

**Acceptance Scenarios**:

1. **Given** a configured project, **When** the user starts a review from the CLI home screen, **Then** the review begins and progress streams in real-time with step-by-step indicators.
2. **Given** a completed review, **When** the user views the review screen, **Then** they see a severity breakdown, issue count, and a navigable issue list.
3. **Given** an issue list, **When** the user selects an issue, **Then** they see the full issue details including description, file location, and severity — matching the web detail view.

---

### User Story 4 - Terminal Responsiveness and Adaptive Layout (Priority: P2)

As a user running diffgazer in terminals of various sizes, I want the CLI interface to adapt its layout to my terminal dimensions, so that information remains readable and usable regardless of window size.

Terminal windows vary from 80x24 to ultra-wide monitors. The CLI should gracefully adapt — showing/hiding sidebars, adjusting column widths, and reflowing content based on available space.

**Why this priority**: Usability in varied terminal environments is important for developer adoption, but the core functionality must work first.

**Independent Test**: Can be tested by resizing the terminal window while the CLI is running and verifying that layouts adjust without breaking or showing truncated content.

**Acceptance Scenarios**:

1. **Given** a narrow terminal (80 columns), **When** the user views the home screen, **Then** the layout condenses to a single-column view without horizontal overflow.
2. **Given** a wide terminal (200+ columns), **When** the user views the review screen, **Then** additional panels (e.g., issue details sidebar) are shown to use available space.
3. **Given** the user resizes their terminal while on any screen, **Then** the layout re-renders to fit the new dimensions without requiring a restart.

---

### User Story 5 - Onboarding and Provider Setup from CLI (Priority: P2)

As a new user, I want to complete the full onboarding flow (initial setup, provider configuration, API key entry, trust permissions) from the CLI, so that I never need to open a browser to get started.

The onboarding flow guides new users through first-time setup: selecting an AI provider, entering API credentials, configuring trust permissions, and running their first review. This must work identically in the CLI.

**Why this priority**: First-time experience determines adoption. A broken or incomplete CLI onboarding sends users to the web, undermining the CLI-first promise.

**Independent Test**: Can be tested by running the CLI with no prior configuration and completing the full onboarding flow through to a first review.

**Acceptance Scenarios**:

1. **Given** no existing configuration, **When** the user launches the CLI, **Then** they are directed to the onboarding screen.
2. **Given** the onboarding screen, **When** the user selects a provider and enters an API key, **Then** the key is validated and stored, and the user progresses to the next step.
3. **Given** completed onboarding, **When** the user returns to the home screen, **Then** they see their configured project ready for review.

---

### User Story 6 - Full Codebase Quality Audit (Priority: P2)

As a maintainer, I want the entire diffgazer codebase — CLI, web app, and shared packages — to follow established quality principles (DRY, KISS, YAGNI, SRP, no thin wrappers, no over-engineering) so that the code is easy to understand, modify, and extend.

A thorough audit across all apps and packages should verify that: no logic is duplicated between web and CLI, no unnecessary abstractions exist, components have single responsibilities, shared code is properly extracted to shared packages rather than copied, and the web app code meets the same quality bar.

**Why this priority**: Technical debt compounds. A full audit now prevents costly refactoring later and ensures consistent quality across the entire project.

**Independent Test**: Can be tested by code review against a defined checklist of quality criteria, with zero violations of DRY/KISS/YAGNI/SRP principles across the entire codebase (CLI, web, shared packages).

**Acceptance Scenarios**:

1. **Given** the full codebase (CLI, web, shared packages), **When** audited for duplicate code, **Then** no data-fetching logic exists outside the shared hooks package.
2. **Given** any component in CLI or web, **When** reviewed for thin wrappers, **Then** no component exists solely to forward props to another component without adding behavior.
3. **Given** the shared hooks package, **When** imported by both web and CLI, **Then** both apps compile and function correctly with zero hook duplication.
4. **Given** the web app codebase, **When** audited for quality principles, **Then** no violations of DRY, KISS, YAGNI, or SRP are found.

---

### Edge Cases

- What happens when the terminal has fewer than 80 columns? The CLI should display a minimum-width warning or degrade gracefully.
- How does the CLI handle a backend that becomes unreachable mid-session? Active screens should show a connection-lost indicator and attempt reconnection.
- What happens during a streaming review if the terminal is resized? The stream should continue without data loss, reflowing the display.
- How does the CLI handle very long issue descriptions or file paths that exceed terminal width? Content should wrap or truncate with an indicator.
- What happens if the user navigates away from a review screen while a review is streaming? The review should continue in the background, and the user can return to it.
- How does keyboard navigation work when overlays/modals are open? Focus should be trapped within the overlay until dismissed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CLI MUST provide screens for all web app routes: home, review, history, onboarding, settings (trust permissions, agent execution, theme, storage, diagnostics, analysis, providers), and help.
- **FR-002**: The CLI MUST use the same shared API hooks package as the web app for all data fetching and mutations.
- **FR-003**: The CLI MUST display loading, error, and empty states for all data-driven screens, matching the web app's state handling patterns.
- **FR-004**: The CLI MUST support real-time streaming of review progress with visual step indicators.
- **FR-005**: The CLI MUST support keyboard-driven navigation between screens with discoverable shortcuts.
- **FR-006**: The CLI MUST adapt its layout to terminal dimensions, supporting terminals from 80 columns to ultra-wide.
- **FR-007**: The CLI MUST support the full provider setup flow: provider selection, API key entry, key validation, and model selection.
- **FR-008**: The CLI MUST support viewing, filtering, and navigating review history.
- **FR-009**: The CLI MUST support viewing and modifying all settings available in the web app.
- **FR-010**: The CLI MUST handle backend connection loss gracefully with clear error messaging and retry capability.
- **FR-011**: The CLI MUST support the complete onboarding flow for first-time users.
- **FR-012**: No data-fetching or mutation logic MAY be duplicated between the CLI and web app — all API interactions MUST flow through the shared hooks package.
- **FR-013**: The CLI MUST support overlay/modal patterns for inline editing (API keys, model selection) with focus trapping.
- **FR-014**: Both web and CLI codebases MAY be freely modified to achieve hook consolidation and quality improvements, including web UI refactoring where beneficial.
- **FR-015**: The quality audit MUST cover the entire codebase — CLI app, web app, and all shared packages — not only files modified during this feature.

### Key Entities

- **Screen**: A full-screen CLI view corresponding to a web app route. Contains layout, data display, and user interaction logic adapted for the terminal.
- **Shared Hook**: A React hook in the shared API package that encapsulates a data-fetching or mutation operation, used identically by both web and CLI.
- **Review Session**: A streaming AI code review with real-time progress updates, issue discovery, and severity classification. Must work identically across both interfaces.
- **Provider Configuration**: AI provider credentials and model selection, stored persistently and editable from either interface.

## Assumptions

- The existing shared hooks package (`@diffgazer/api/hooks`) already contains all hooks needed for both web and CLI. If additional hooks are needed, they will be added to this shared package, not created locally in the CLI.
- The backend server API is stable and does not need modification for CLI consumption — the same endpoints serve both interfaces.
- The CLI uses Ink 6 (React for terminal) which supports React hooks, context, and the component model needed to consume shared hooks.
- Terminal color support follows standard conventions (256-color / truecolor where available, graceful fallback).
- Keyboard shortcuts follow terminal conventions (arrow keys for navigation, Enter for selection, Escape for back/cancel, tab for focus cycling).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of web app screens have a corresponding functional CLI screen with equivalent data display and user interactions.
- **SC-002**: 100% of API data fetching in both CLI and web flows through shared hooks — zero local fetch implementations in either app.
- **SC-003**: Users can complete the full workflow (onboarding, provider setup, review initiation, issue browsing) entirely from the CLI without opening the web app.
- **SC-004**: The CLI renders correctly in terminals ranging from 80 to 300+ columns wide without horizontal overflow or layout breakage.
- **SC-005**: Zero instances of duplicated data-fetching, mutation, or state management logic between the CLI and web codebases after audit.
- **SC-006**: All CLI screens display appropriate loading indicators, error messages, and empty states — no raw errors or blank screens.
- **SC-007**: Review streaming in the CLI shows real-time progress matching the web experience, with no data loss during terminal resize.
- **SC-008**: Code audit passes with zero violations of DRY, KISS, YAGNI, and SRP principles across the entire codebase (CLI, web, and shared packages).
