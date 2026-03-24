# Feature Specification: Fix Keyscope Integration with diff-ui Components

**Feature Branch**: `003-fix-keyscope-diffui-integration`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Fix broken keyscope integration after migrating from local components to diff-ui package components in diffgazer web UI"

## Clarifications

### Session 2026-03-24

- Q: Are diff-ui source modifications in scope, or only diffgazer-side changes? → A: Both repos are in scope. The correct architecture is two layers: diff-ui provides solid standalone a11y as the base, and keyscope hooks are an optional enhancement plugged in ON TOP by the consumer (diffgazer). Changes to both diff-ui and diffgazer are allowed to make this layering work.

## Architecture: Two-Layer Keyboard Model

The intended architecture has two distinct layers:

1. **Layer 1 — diff-ui base a11y (standalone)**: Every interactive diff-ui component (Menu, RadioGroup, CheckboxGroup, Tabs, NavigationList, Dialog, Select, etc.) MUST have proper built-in accessibility that works without keyscope — semantic HTML, ARIA attributes, native focus management, and basic keyboard operability (Tab, Enter, Space, Escape per WAI-ARIA patterns).

2. **Layer 2 — keyscope enhancement (optional, consumer-added)**: Consumers like diffgazer optionally add keyscope hooks on top of diff-ui's base a11y to get richer keyboard navigation — arrow key list traversal, scoped hotkeys, multi-zone focus management, custom shortcuts. This is an enhancement, not a replacement.

The integration is broken because this layering doesn't work cleanly — either diff-ui's base a11y is incomplete, keyscope can't plug in on top without conflicting, or both.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - diff-ui Components Have Standalone a11y (Priority: P1)

As a consumer of diff-ui (any project, not just diffgazer), I need every interactive component to be keyboard-operable and accessible out of the box, without requiring keyscope or any external keyboard library.

**Why this priority**: This is the foundation. If base a11y doesn't work, nothing built on top can work. diff-ui is a reusable component library — it must be self-sufficient for accessibility.

**Independent Test**: Render any diff-ui interactive component in isolation (no KeyboardProvider, no keyscope imports). Navigate using only keyboard (Tab, Enter, Space, Escape, Arrow keys per WAI-ARIA widget patterns). All standard interactions must work.

**Acceptance Scenarios**:

1. **Given** a Menu rendered without keyscope, **When** user Tabs to it and presses ArrowDown, **Then** menu items are navigable and Enter activates the focused item
2. **Given** a RadioGroup rendered without keyscope, **When** user Tabs to it and presses ArrowUp/ArrowDown, **Then** radio options are traversable and Space/Enter selects
3. **Given** a CheckboxGroup rendered without keyscope, **When** user Tabs to it and presses ArrowUp/ArrowDown, **Then** checkboxes are traversable and Space toggles
4. **Given** a Dialog rendered without keyscope, **When** dialog opens, **Then** focus is trapped inside; Escape closes it; Tab cycles through focusable elements
5. **Given** a NavigationList rendered without keyscope, **When** user presses ArrowUp/ArrowDown, **Then** items highlight and Enter activates

---

### User Story 2 - Keyscope Hooks Plug In On Top Without Conflict (Priority: P1)

As a diffgazer developer, I need to plug keyscope hooks (useNavigation, useKey, useScope, useFocusZone) into diff-ui components to add enhanced keyboard navigation (custom arrow nav, scoped hotkeys, multi-zone focus) without breaking or duplicating the component's base a11y behavior.

**Why this priority**: This is the core broken integration. Diffgazer uses keyscope extensively for terminal-style keyboard-first UX. The hooks must compose cleanly on top of diff-ui's base layer.

**Independent Test**: In diffgazer, verify a diff-ui RadioGroup's keyboard nav works via its internal controller, with `highlighted` prop controlled by local state and page-level `useKey`/`useScope` hooks providing scoped hotkeys on top.

**Acceptance Scenarios**:

1. **Given** a diff-ui component with `highlighted` and `onHighlightChange` props wired to consumer local state, **When** user presses Arrow keys, **Then** navigation is driven by the component's internal controller and highlight state syncs back to the consumer via `onHighlightChange`
2. **Given** keyscope's `useKey` registers page-level hotkeys (e.g., "q" to quit, "s" for settings), **When** these keys are pressed, **Then** they fire correctly without being swallowed or duplicated by diff-ui components
3. **Given** a diff-ui component managing keyboard nav internally, **When** the consumer does NOT create a redundant `useNavigation` for the same container, **Then** there is exactly one navigation controller per component with no competing handlers

---

### User Story 3 - Scoped Keyboard Isolation Works Across Pages and Dialogs (Priority: P1)

As a user navigating between pages and dialogs in diffgazer, I need keyscope's scope system to correctly isolate keyboard handlers so that pressing keys only affects the currently active context.

**Why this priority**: Diffgazer uses keyscope's `useScope` and `useFocusZone` for page-level handler isolation and multi-pane layouts. These must compose with diff-ui components across all views.

**Independent Test**: Open a dialog from the providers page — parent page hotkeys must be suppressed while the dialog scope is active.

**Acceptance Scenarios**:

1. **Given** the settings hub with scope "settings-hub", **When** a sub-page pushes scope "settings-theme", **Then** only the sub-page's key handlers fire
2. **Given** the providers page, **When** API key dialog opens with scope "api-key-dialog", **Then** Escape closes the dialog, not the page
3. **Given** the review results page with focus zones (filters, list, details), **When** ArrowLeft/ArrowRight switch zones, **Then** each zone's handlers activate exclusively

---

### User Story 4 - Visual Focus Indicators Are Consistent (Priority: P2)

As a user, I need to see a clear visual indicator of which item is keyboard-focused across all component types and across both the base a11y layer and the keyscope enhancement layer.

**Why this priority**: Visual feedback is essential for keyboard navigation but secondary to the navigation itself working.

**Independent Test**: Navigate through lists/menus/radio groups — focused items must show visible highlights in both dark and light themes.

**Acceptance Scenarios**:

1. **Given** any navigable component, **When** an item is focused via keyboard (either base a11y or keyscope-enhanced), **Then** the item has a visible focus indicator
2. **Given** theme switching between dark and light, **When** items are keyboard-focused, **Then** focus indicators remain visible in both

---

### User Story 5 - Theme Token Overrides Apply to diff-ui Components (Priority: P2)

As a diffgazer user, I need diff-ui components to render with diffgazer's GitHub Dark/Light palette rather than diff-ui's default monochrome theme.

**Why this priority**: The CSS token override system already exists and mostly works. This ensures it remains correct after integration fixes.

**Independent Test**: Compare rendered component colors against GitHub Dark palette values in `theme-overrides.css`.

**Acceptance Scenarios**:

1. **Given** diff-ui's base theme loaded, **When** diffgazer's overrides load after it, **Then** all tokens reflect the GitHub palette
2. **Given** any diff-ui component rendered in diffgazer, **When** inspected, **Then** it uses the overridden token values

---

### User Story 6 - All Tests Pass (Priority: P2)

As a developer, I need all existing tests (including keyboard integration tests) to pass after the fix.

**Why this priority**: Tests validate the integration contract.

**Independent Test**: Run the web app test suite — all pass.

**Acceptance Scenarios**:

1. **Given** the test suite, **When** tests run, **Then** all existing tests pass with no regressions
2. **Given** updated keyboard integration tests, **When** they exercise keyscope + diff-ui together, **Then** the two-layer behavior matches expectations

---

### Edge Cases

- What happens when a diff-ui component's base a11y handles Arrow keys AND keyscope's `useNavigation` also handles Arrow keys on the same container? (Keyscope must take precedence; base layer must defer)
- What happens when keyscope is NOT present? (diff-ui's base a11y must work identically — keyscope is optional)
- How does a dialog's focus trap (base a11y) interact with keyscope's scope push? (Must not conflict — scope isolates hotkeys, focus trap isolates Tab)
- What happens when a consumer passes `highlighted` but NOT `onKeyDown`? (Component should still be operable via its base a11y keyboard handling)
- How do `useFocusZone` transitions interact with diff-ui components that manage their own highlight state? (Zone transition must be able to reset/set component highlight externally)

## Requirements *(mandatory)*

### Functional Requirements

**Layer 1 — diff-ui Base a11y**:

- **FR-001**: Every interactive diff-ui component MUST be keyboard-operable without keyscope — following WAI-ARIA widget patterns (Tab to reach, Arrow keys to traverse, Enter/Space to activate, Escape to dismiss)
- **FR-002**: diff-ui components MUST use semantic HTML and ARIA attributes (role, aria-selected, aria-checked, aria-expanded, etc.) for assistive technology compatibility
- **FR-003**: diff-ui components with lists (Menu, RadioGroup, CheckboxGroup, Tabs, NavigationList, Select) MUST support internal Arrow key navigation as their base behavior

**Layer 2 — Keyscope Enhancement Integration**:

- **FR-004**: diff-ui components MUST support a controlled mode where external `highlighted`/`onKeyDown` props override the built-in keyboard navigation — when provided, the component defers to the external controller
- **FR-005**: When keyscope's `useNavigation` provides `highlighted` and `onKeyDown` to a diff-ui component, the component's internal navigation MUST NOT create a competing controller
- **FR-006**: Keyscope's provider-dependent hooks (useKey, useScope, useFocusZone) MUST coexist with diff-ui's base a11y without interference
- **FR-007**: The KeyboardProvider MUST remain at the diffgazer app root to support provider-dependent hooks

**Cross-Cutting**:

- **FR-008**: Visual focus indicators MUST be visible on the currently focused/highlighted item regardless of which layer drives the focus
- **FR-009**: diff-ui's CSS tokens MUST be overridable via diffgazer's theme cascade
- **FR-010**: The workspace dependency chain MUST resolve to a single keyscope instance
- **FR-011**: All existing tests MUST pass; new or updated tests MUST cover the two-layer integration pattern

### Key Entities

- **Base a11y Layer**: Built-in keyboard behavior and ARIA attributes in diff-ui components, following WAI-ARIA widget patterns. Works standalone without keyscope.
- **Enhancement Layer**: Keyscope hooks (useNavigation, useKey, useScope, useFocusZone) optionally added by the consumer for richer keyboard UX.
- **Controlled Mode**: A component operating mode where external props (highlighted, onKeyDown) from keyscope override the component's internal keyboard navigation.
- **Focus Zone**: A keyscope concept for multi-pane layouts where each zone has independent keyboard handlers.
- **Scope**: A keyscope concept for layered keyboard handler isolation — only the topmost scope's handlers fire.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: diff-ui interactive components are keyboard-operable standalone (without keyscope) — verified by rendering in isolation
- **SC-002**: Keyscope hooks plug into diff-ui components without duplicate handlers or erratic behavior — zero double-fire or skipped-item bugs in diffgazer
- **SC-003**: All existing tests pass with no regressions
- **SC-004**: Visual focus indicators appear on 100% of keyboard-navigable items across all pages in both themes
- **SC-005**: Theme token overrides apply correctly — diff-ui components render with diffgazer's palette
- **SC-006**: Type-checking passes with no new errors

## Assumptions

- diff-ui components currently have partial built-in `useNavigation` usage (confirmed: CheckboxGroup, RadioGroup, Menu, Tabs, etc. use it internally via re-export facade). This needs to become proper standalone a11y that also supports controlled override.
- keyscope's `useNavigation` is standalone (no provider needed) — confirmed
- keyscope's `useKey`, `useScope`, `useFocusZone` require KeyboardProvider — confirmed
- Workspace pnpm linking resolves keyscope to a single instance — confirmed via symlinks
- CSS cascade order (diff-ui theme → diffgazer overrides) is correct — confirmed
- Stale keyscope artifacts (fingerprint mismatch) is a separate docs-app concern, not in scope

## Scope Boundaries

**In scope**:
- Ensuring diff-ui components have solid standalone a11y (Layer 1) — changes to diff-ui source allowed
- Making keyscope hooks composable on top of diff-ui (Layer 2) — changes to both diff-ui and diffgazer
- Fixing all broken keyboard navigation in diffgazer web UI
- Updating tests to cover the two-layer pattern

**Out of scope**:
- Rebuilding keyscope artifacts (docs-app concern)
- Adding new keyboard shortcuts or navigation features beyond restoring what was working
- CLI app keyboard navigation
- Publishing diff-ui to npm
- Modifying keyscope source (keyscope hooks should work as-is)
