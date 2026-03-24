# Tasks: Ink Component Library for CLI (diff-ui Mirror)

**Input**: Design documents from `/specs/004-ink-diffui-components/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/terminal-components.md, quickstart.md

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US5)
- Exact file paths under `apps/cli/src/`

---

## Phase 1: Setup

**Purpose**: Install dependencies and create directory structure

- [x] T001 Add `@inkjs/ui` dependency to `apps/cli/package.json` and run `pnpm install`
- [x] T002 Create feature directory structure: `apps/cli/src/{features/{home,review,history,onboarding,providers,settings}/{components,hooks},theme,config,lib,components/layout}`
- [x] T003 [P] Create shared types file with Variant, Size unions in `apps/cli/src/types/components.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Theme System

- [x] T004 [P] Create CliColorTokens interface and dark/light/high-contrast palettes in `apps/cli/src/theme/palettes.ts`
- [x] T005 [P] Create CliThemeProvider context with useTheme hook, auto-detection via COLORFGBG, palette resolution in `apps/cli/src/theme/theme-context.tsx`

### Routing & Navigation

- [x] T006 [P] Define Route discriminated union type and ScreenName type in `apps/cli/src/app/routes.ts`
- [x] T007 [P] Create getBackTarget function with deterministic settings hierarchy rules in `apps/cli/src/lib/back-navigation.ts`
- [x] T008 Create NavigationProvider with navigate, goBack, canGoBack using stack-based back navigation in `apps/cli/src/app/navigation-context.tsx` (depends on T006, T007)

### Keyboard & Footer Providers

- [x] T009 [P] Create TerminalKeyboardProvider adapter (keyscope-compatible context shape, useInput bridge, scope-based handler registry) in `apps/cli/src/app/providers/keyboard-provider.tsx`
- [x] T010 [P] Create useKey and useScope hooks that consume TerminalKeyboardProvider context in `apps/cli/src/hooks/use-key.ts` and `apps/cli/src/hooks/use-scope.ts`
- [x] T011 [P] Create FooterProvider context with usePageFooter hook for per-screen shortcut declarations in `apps/cli/src/app/providers/footer-provider.tsx`

### Navigation Config

- [x] T012 [P] Create CLI-specific menu items, settings items, and keyboard shortcuts config in `apps/cli/src/config/navigation.ts`

### Core Terminal Components (P0 — used across 3+ stories)

- [x] T013 [P] Implement Badge component (variant colors via useTheme, dot prefix, size) in `apps/cli/src/components/ui/badge.tsx`
- [x] T014 [P] Implement Button component (variant colors, bracket mode, loading spinner, disabled state, onPress) in `apps/cli/src/components/ui/button.tsx`
- [x] T015 [P] Implement Panel compound component (Panel, Panel.Header, Panel.Content, Panel.Footer with borderStyle="round") in `apps/cli/src/components/ui/panel.tsx`
- [x] T016 [P] Implement Menu compound component (Menu, Menu.Item, Menu.Divider with arrow-key nav, highlight, select, hub variant) in `apps/cli/src/components/ui/menu.tsx`
- [x] T017 [P] Implement SectionHeader component (bold uppercase Text, muted variant, bordered option with box-drawing) in `apps/cli/src/components/ui/section-header.tsx`
- [x] T018 [P] Implement Callout compound component (Callout, Callout.Title, Callout.Content with bordered Box, variant icons) in `apps/cli/src/components/ui/callout.tsx`
- [x] T019 [P] Implement Spinner component (dots/braille/snake variants using ink-spinner, label, size) in `apps/cli/src/components/ui/spinner.tsx`
- [x] T020 [P] Implement Toast imperative API (toast store via useSyncExternalStore, toast/toast.success/error/warning/dismiss, auto-dismiss timer) and Toaster component in `apps/cli/src/components/ui/toast.tsx`
- [x] T021 [P] Implement ScrollArea component (managed viewport with scrollOffset state, arrow/pgup/pgdn keyboard scrolling, isActive) in `apps/cli/src/components/ui/scroll-area.tsx`

### Layout Components

- [x] T022 [P] Implement Header component (back button, provider name/status display, diffgazer title) in `apps/cli/src/components/layout/header.tsx`
- [x] T023 [P] Implement Footer component (shortcut key-label pairs, left/right sections) in `apps/cli/src/components/layout/footer.tsx`
- [x] T024 Implement GlobalLayout component (Header + flex-grow content area + Footer, full terminal dimensions via useStdout) in `apps/cli/src/components/layout/global-layout.tsx` (depends on T022, T023)

### App Shell

- [x] T025 Create ScreenRouter component (switch on route, render screen components) in `apps/cli/src/app/router.tsx` (depends on T006)
- [x] T026 Update App root with full provider tree (Theme → Keyboard → Navigation → Footer → Server → GlobalLayout → ScreenRouter + Toaster) in `apps/cli/src/app/index.tsx` (depends on T005, T008, T009, T011, T024, T025)
- [x] T027 Update CLI entry point to read --theme flag and load persisted theme from config.json in `apps/cli/src/index.tsx` (depends on T026)

### Shared Hooks

- [x] T028 [P] Create use-back-handler hook (global Escape handler via useInput + useNavigation.goBack) in `apps/cli/src/hooks/use-back-handler.ts`
- [x] T029 [P] Create use-page-footer hook (syncs screen shortcuts to FooterProvider) in `apps/cli/src/hooks/use-page-footer.ts`
- [x] T030 [P] Create use-terminal-dimensions hook (useStdout columns/rows with resize tracking) in `apps/cli/src/hooks/use-terminal-dimensions.ts`
- [x] T031 Update existing logo.tsx to use useTheme() tokens.accent instead of hardcoded "cyan" in `apps/cli/src/components/ui/logo.tsx`

**Checkpoint**: Foundation ready — all providers, core components, layout, and app shell functional. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Full CLI Review Experience (Priority: P1) MVP

**Goal**: Developer can launch diffgazer in terminal, see main menu with context info, start a review, watch real-time progress, view summary, and browse issues with details/code/fix plans.

**Independent Test**: Run `diffgazer`, select "Review Unstaged", watch progress, view summary, navigate through issues.

### US1-Specific Components

- [x] T032 [P] [US1] Implement Tabs compound component (Tabs, Tabs.List, Tabs.Trigger, Tabs.Content with arrow-key switching, active tab highlight) in `apps/cli/src/components/ui/tabs.tsx`
- [x] T033 [P] [US1] Implement EmptyState compound component (EmptyState, EmptyState.Message, EmptyState.Description — centered text) in `apps/cli/src/components/ui/empty-state.tsx`

### Home Screen & Feature (required for US1 — main menu entry point)

- [x] T034 [P] [US1] Create InfoField component (label + value display) in `apps/cli/src/features/home/components/info-field.tsx`
- [x] T035 [P] [US1] Create ContextSidebar component (provider, model, last review, trust status via Panel + InfoField) in `apps/cli/src/features/home/components/context-sidebar.tsx`
- [x] T036 [P] [US1] Create HomeMenu component (Menu with MAIN_MENU_ITEMS, selection triggers navigation, disabled review if untrusted) in `apps/cli/src/features/home/components/home-menu.tsx`
- [x] T037 [US1] Create HomeScreen (layout: ContextSidebar + HomeMenu, useScope("home"), useKey q/s/h shortcuts, usePageFooter, config guard → onboarding redirect) in `apps/cli/src/app/screens/home-screen.tsx` (depends on T035, T036)

### Review Feature Components

- [x] T038 [P] [US1] Create severity-bar component (unicode block bar per severity level with color) in `apps/cli/src/features/review/components/severity-bar.tsx`
- [x] T039 [P] [US1] Create severity-breakdown component (all severity bars stacked) in `apps/cli/src/features/review/components/severity-breakdown.tsx`
- [x] T040 [P] [US1] Create progress-step component (step name, status icon, substeps, timing) in `apps/cli/src/features/review/components/progress-step.tsx`
- [x] T041 [P] [US1] Create progress-list component (list of progress-step items with expand/collapse) in `apps/cli/src/features/review/components/progress-list.tsx`
- [x] T042 [P] [US1] Create activity-log component (scrollable log entries with timestamp, message, badge) in `apps/cli/src/features/review/components/activity-log.tsx`
- [x] T043 [P] [US1] Create code-snippet component (file path, line numbers, code text with basic ANSI highlighting) in `apps/cli/src/features/review/components/code-snippet.tsx`
- [x] T044 [P] [US1] Create issue-preview-item component (severity badge, file path, title — single row in issue list) in `apps/cli/src/features/review/components/issue-preview-item.tsx`
- [x] T045 [P] [US1] Create issue-list-pane component (scrollable list of issue-preview-items with keyboard nav, severity filter) in `apps/cli/src/features/review/components/issue-list-pane.tsx`
- [x] T046 [P] [US1] Create issue-details-pane component (Tabs: overview/code/fix-plan, SectionHeader, code-snippet, ScrollArea) in `apps/cli/src/features/review/components/issue-details-pane.tsx`

### Review Feature Hooks

- [x] T047 [P] [US1] Create use-review-stream hook (SSE streaming via api.streamReviewWithEvents, progress state machine) in `apps/cli/src/features/review/hooks/use-review-stream.ts`
- [x] T048 [P] [US1] Create use-review-lifecycle hook (orchestrates start → stream → complete → summary → results phases) in `apps/cli/src/features/review/hooks/use-review-lifecycle.ts`
- [x] T049 [P] [US1] Create use-review-keyboard hook (j/k issue nav, Tab zone switching, 1-4 tab switching, Enter/Escape) in `apps/cli/src/features/review/hooks/use-review-keyboard.ts`

### Review Screen Views

- [x] T050 [US1] Create ReviewProgressView (progress-list + activity-log side-by-side or stacked, timer, cancel button) in `apps/cli/src/features/review/components/review-progress-view.tsx` (depends on T040, T041, T042)
- [x] T051 [US1] Create ReviewSummaryView (severity-breakdown, issue count, metrics, Enter to continue, Escape to go back) in `apps/cli/src/features/review/components/review-summary-view.tsx` (depends on T038, T039)
- [x] T052 [US1] Create ReviewResultsView (issue-list-pane + issue-details-pane split, focus zone switching, adaptive layout for narrow terminals) in `apps/cli/src/features/review/components/review-results-view.tsx` (depends on T045, T046)
- [x] T053 [US1] Create ReviewContainer (phase state machine: streaming → summary → results, delegates to views) in `apps/cli/src/features/review/components/review-container.tsx` (depends on T047, T048, T050, T051, T052)
- [x] T054 [US1] Create ReviewScreen (ReviewContainer wrapper, useScope("review"), route params handling, saved review loading) in `apps/cli/src/app/screens/review-screen.tsx` (depends on T053)

**Checkpoint**: User Story 1 complete — full review workflow functional in terminal. Can launch → menu → review → progress → summary → results → navigate issues.

---

## Phase 4: User Story 2 - Screen Navigation and Layout Parity (Priority: P2)

**Goal**: Developer navigates between all screens using keyboard shortcuts with consistent header/footer on every screen, back navigation works everywhere.

**Independent Test**: Launch CLI → Settings → Providers → Back → Home → History → Back → Help → Back. Verify header/footer persist, transitions < 2s.

### Stub Screens (functional shells with layout + keyboard shortcuts + footer)

- [x] T055 [P] [US2] Create HelpScreen (Panel with help content, keyboard shortcuts reference, useScope("help"), Escape to go back) in `apps/cli/src/app/screens/help-screen.tsx`
- [x] T056 [P] [US2] Create SettingsHubScreen (Menu with settings categories from SETTINGS_MENU_ITEMS, hub variant, useScope("settings-hub")) in `apps/cli/src/app/screens/settings/hub-screen.tsx`
- [x] T057 [P] [US2] Create HistoryScreen shell (placeholder with useScope("history"), Escape back) in `apps/cli/src/app/screens/history-screen.tsx`
- [x] T058 [P] [US2] Create OnboardingScreen shell (placeholder with useScope("onboarding")) in `apps/cli/src/app/screens/onboarding-screen.tsx`

### Settings Sub-Screen Shells (minimal functional screens — full implementation in US3)

- [x] T059 [P] [US2] Create ThemeScreen shell (Panel with placeholder, useScope("settings-theme"), Escape back) in `apps/cli/src/app/screens/settings/theme-screen.tsx`
- [x] T060 [P] [US2] Create ProvidersScreen shell (Panel with placeholder, useScope("providers"), Escape back) in `apps/cli/src/app/screens/settings/providers-screen.tsx`
- [x] T061 [P] [US2] Create StorageScreen shell (Panel with placeholder, useScope("settings-storage"), Escape back) in `apps/cli/src/app/screens/settings/storage-screen.tsx`
- [x] T062 [P] [US2] Create AnalysisScreen shell (Panel with placeholder, useScope("settings-analysis"), Escape back) in `apps/cli/src/app/screens/settings/analysis-screen.tsx`
- [x] T063 [P] [US2] Create AgentExecutionScreen shell (Panel with placeholder, useScope("settings-agent-execution"), Escape back) in `apps/cli/src/app/screens/settings/agent-execution-screen.tsx`
- [x] T064 [P] [US2] Create DiagnosticsScreen shell (Panel with placeholder, useScope("settings-diagnostics"), Escape back) in `apps/cli/src/app/screens/settings/diagnostics-screen.tsx`
- [x] T065 [P] [US2] Create TrustPermissionsScreen shell (Panel with placeholder, useScope("trust-form"), Escape back) in `apps/cli/src/app/screens/settings/trust-permissions-screen.tsx`

### Wire All Screens into Router

- [x] T066 [US2] Register all 13 screens in ScreenRouter SCREEN_MAP in `apps/cli/src/app/router.tsx` (depends on T037, T054, T055-T065)
- [x] T067 [US2] Add global keyboard shortcut handler for q (quit), s (settings), h (help) across all screens via TerminalKeyboardProvider in `apps/cli/src/app/providers/keyboard-provider.tsx`

**Checkpoint**: User Story 2 complete — all 13 screens navigable with consistent layout, keyboard shortcuts, and back navigation.

---

## Phase 5: User Story 3 - Settings Management in CLI (Priority: P3)

**Goal**: Developer configures diffgazer entirely from terminal: providers, API keys, models, analysis, trust, storage, agent execution, theme. Dialogs are full-screen overlays.

**Independent Test**: Run onboarding wizard from fresh state, complete all steps. Then modify each setting via Settings screens.

### US3-Specific Components

- [x] T068 [P] [US3] Implement RadioGroup compound component (RadioGroup, RadioGroup.Item with arrow-key selection, controllable value, wrap) in `apps/cli/src/components/ui/radio.tsx`
- [x] T069 [P] [US3] Implement CheckboxGroup compound component (CheckboxGroup, CheckboxGroup.Item with toggle, multi-select, highlighted state) in `apps/cli/src/components/ui/checkbox.tsx`
- [x] T070 [P] [US3] Implement Input component (wrapper around @inkjs/ui TextInput/PasswordInput, error state, size variants) in `apps/cli/src/components/ui/input.tsx`
- [x] T071 [P] [US3] Implement Dialog compound component (full-screen overlay via conditional rendering, Dialog.Content/Header/Title/Body/Footer, Escape dismisses) in `apps/cli/src/components/ui/dialog.tsx`
- [x] T072 [P] [US3] Implement NavigationList compound component (NavigationList.Item/.Title/.Badge/.Status/.Subtitle, multi-column, keyboard nav) in `apps/cli/src/components/ui/navigation-list.tsx`
- [x] T073 [P] [US3] Implement KeyValue component (label-value pair display) in `apps/cli/src/components/ui/key-value.tsx`

### Shared Form Components

- [x] T074 [P] [US3] Create ApiKeyMethodSelector shared component (radio: paste/env, input field) in `apps/cli/src/features/providers/components/api-key-method-selector.tsx`
- [x] T075 [P] [US3] Create StorageSelectorContent shared component (RadioGroup: file/keyring) in `apps/cli/src/features/settings/components/storage-selector.tsx`
- [x] T076 [P] [US3] Create TrustPermissionsContent shared component (CheckboxGroup for capabilities + Callout warning) in `apps/cli/src/features/settings/components/trust-permissions-content.tsx`
- [x] T077 [P] [US3] Create AnalysisSelectorContent shared component (CheckboxGroup for analysis agents + badges) in `apps/cli/src/features/settings/components/analysis-selector.tsx`
- [x] T078 [P] [US3] Create ThemeSelectorContent component (RadioGroup: dark/light/high-contrast with live preview) in `apps/cli/src/features/settings/components/theme-selector.tsx`

### Provider Feature (full-screen overlay dialogs)

- [x] T079 [P] [US3] Create ProviderList component (NavigationList of providers with status badges) in `apps/cli/src/features/providers/components/provider-list.tsx`
- [x] T080 [P] [US3] Create ProviderDetails component (KeyValue pairs, capabilities, action buttons) in `apps/cli/src/features/providers/components/provider-details.tsx`
- [x] T081 [P] [US3] Create ApiKeyOverlay (full-screen Dialog: method selector, input, save/cancel footer) in `apps/cli/src/features/providers/components/api-key-overlay.tsx`
- [x] T082 [P] [US3] Create ModelSelectOverlay (full-screen Dialog: search input, filter tabs, model list, select/cancel footer) in `apps/cli/src/features/providers/components/model-select-overlay.tsx`

### Settings Screens (upgrade shells to full implementations)

- [x] T083 [US3] Implement full ThemeScreen (ThemeSelectorContent, save via api.saveSettings, useTheme().setTheme) in `apps/cli/src/app/screens/settings/theme-screen.tsx` (depends on T078)
- [x] T084 [US3] Implement full ProvidersScreen (ProviderList + ProviderDetails split, ApiKeyOverlay + ModelSelectOverlay triggers) in `apps/cli/src/app/screens/settings/providers-screen.tsx` (depends on T079, T080, T081, T082)
- [x] T085 [US3] Implement full StorageScreen (StorageSelectorContent, save button, api.saveSettings) in `apps/cli/src/app/screens/settings/storage-screen.tsx` (depends on T075)
- [x] T086 [US3] Implement full AnalysisScreen (AnalysisSelectorContent, save button, api.saveSettings) in `apps/cli/src/app/screens/settings/analysis-screen.tsx` (depends on T077)
- [x] T087 [US3] Implement full AgentExecutionScreen (RadioGroup for execution modes, save button, api.saveSettings) in `apps/cli/src/app/screens/settings/agent-execution-screen.tsx` (depends on T068)
- [x] T088 [US3] Implement full DiagnosticsScreen (system health checks, refresh button, server status, context info) in `apps/cli/src/app/screens/settings/diagnostics-screen.tsx`
- [x] T089 [US3] Implement full TrustPermissionsScreen (TrustPermissionsContent, save/revoke, api.saveTrust/deleteTrust) in `apps/cli/src/app/screens/settings/trust-permissions-screen.tsx` (depends on T076)

### Home Feature: Trust Panel

- [x] T090 [US3] Create TrustPanel component (inline trust permissions for first-time trust prompt on home screen) in `apps/cli/src/features/home/components/trust-panel.tsx`
- [x] T091 [US3] Update HomeScreen to show TrustPanel when project needs trust (needsTrust check) in `apps/cli/src/app/screens/home-screen.tsx`

### Onboarding Wizard

- [x] T092 [P] [US3] Create WizardProgress component (step indicator: completed/current/pending steps) in `apps/cli/src/features/onboarding/components/wizard-progress.tsx`
- [x] T093 [P] [US3] Create ProviderStep (RadioGroup of providers with badges) in `apps/cli/src/features/onboarding/components/steps/provider-step.tsx`
- [x] T094 [P] [US3] Create ApiKeyStep (ApiKeyMethodSelector for key entry) in `apps/cli/src/features/onboarding/components/steps/api-key-step.tsx`
- [x] T095 [P] [US3] Create ModelStep (RadioGroup of models with capability badges) in `apps/cli/src/features/onboarding/components/steps/model-step.tsx`
- [x] T096 [P] [US3] Create AnalysisStep (AnalysisSelectorContent reuse) in `apps/cli/src/features/onboarding/components/steps/analysis-step.tsx`
- [x] T097 [P] [US3] Create StorageStep (StorageSelectorContent reuse) in `apps/cli/src/features/onboarding/components/steps/storage-step.tsx`
- [x] T098 [P] [US3] Create ExecutionStep (RadioGroup for agent execution mode) in `apps/cli/src/features/onboarding/components/steps/execution-step.tsx`
- [x] T099 [US3] Create OnboardingWizard component (step state machine, next/back/complete flow, WizardProgress, api.saveSettings on complete) in `apps/cli/src/features/onboarding/components/onboarding-wizard.tsx` (depends on T092-T098)
- [x] T100 [US3] Implement full OnboardingScreen (OnboardingWizard wrapper, redirect to home on complete) in `apps/cli/src/app/screens/onboarding-screen.tsx` (depends on T099)

**Checkpoint**: User Story 3 complete — all settings screens functional, onboarding wizard works end-to-end, dialogs render as full-screen overlays.

---

## Phase 6: User Story 4 - Review History in CLI (Priority: P4)

**Goal**: Developer browses past review runs, sees metadata, selects past review to re-examine results.

**Independent Test**: Run reviews, navigate to History, browse list, select past review to view its results.

### History Feature Components

- [x] T101 [P] [US4] Create RunItem component (date, issue count, severity badges, select indicator) in `apps/cli/src/features/history/components/run-item.tsx`
- [x] T102 [P] [US4] Create HistoryInsightsPane component (ScrollArea with severity breakdown, metrics for selected review) in `apps/cli/src/features/history/components/history-insights-pane.tsx`
- [x] T103 [US4] Create TimelineList component (NavigationList of RunItems, keyboard nav, search filtering) in `apps/cli/src/features/history/components/timeline-list.tsx` (depends on T101)

### History Screen

- [x] T104 [US4] Implement full HistoryScreen (TimelineList + HistoryInsightsPane split, zone switching, api.getReviews, navigate to review on Enter) in `apps/cli/src/app/screens/history-screen.tsx` (depends on T102, T103)

**Checkpoint**: User Story 4 complete — history browsing functional, can load past reviews into results view.

---

## Phase 7: User Story 5 - Component Library Documentation (Priority: P5)

**Goal**: Every terminal component has a docs page with props, usage, web-mapping notes.

**Independent Test**: Navigate to CLI components section in docs app, verify every component has documentation.

- [x] T105 [P] [US5] Create CLI component docs index page and section in docs app config at `apps/docs/`
- [x] T106 [P] [US5] Create documentation pages for all 18 terminal components (Badge, Button, Panel, Menu, SectionHeader, Callout, Spinner, Toast, ScrollArea, RadioGroup, CheckboxGroup, Input, Dialog, NavigationList, Tabs, EmptyState, KeyValue, Spinner) with props table, usage example, web-mapping notes in `apps/docs/` content directory
- [x] T107 [P] [US5] Create documentation pages for layout components (Header, Footer, GlobalLayout) and patterns guide (routing, theming, keyboard) in `apps/docs/` content directory

**Checkpoint**: User Story 5 complete — all components documented with props, usage, and web-mapping.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T108 Verify responsive layout adaptation: test all screens at 80, 120, and 200+ column widths, fix overflow/truncation issues
- [x] T109 Verify keyboard shortcut consistency across all screens against `apps/web/src/config/navigation.ts` shortcuts
- [x] T110 Run quickstart.md validation: verify all patterns documented match actual implementation
- [x] T111 Update existing `apps/cli/src/components/ui/status-display.tsx` to use themed colors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (Phase 3) can proceed independently after Phase 2
  - US2 (Phase 4) can proceed independently after Phase 2 (but benefits from US1 for home/review screens)
  - US3 (Phase 5) can proceed independently after Phase 2
  - US4 (Phase 6) depends on NavigationList from US3 (T072) and ReviewResultsView from US1 (T052) for re-viewing past reviews
  - US5 (Phase 7) depends on all components being implemented (US1 + US3)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2. No dependencies on other stories. **MVP target.**
- **US2 (P2)**: Can start after Phase 2. Benefits from US1 (home/review already built) but stubs suffice. Can proceed in parallel with US1.
- **US3 (P3)**: Can start after Phase 2. Adds form components + settings implementations. Fully independent.
- **US4 (P4)**: Needs NavigationList (T072 from US3) and can reuse ReviewResultsView (T052 from US1) for past review viewing.
- **US5 (P5)**: Needs all components built. Should run after US1 + US3 minimum.

### Within Each User Story

- Components before screens
- Hooks before views that consume them
- Views before container/screen that composes them
- All [P] tasks within a story can run in parallel

### Parallel Opportunities

**Phase 2 (max parallelism):** T004-T012 all [P] — 9 tasks in parallel. Then T013-T021 all [P] — 9 components in parallel. Then T022-T023 [P], T028-T031 [P].

**Phase 3 US1:** T032-T033 [P], T034-T036 [P], T038-T049 [P] — up to 15 tasks in parallel.

**Phase 4 US2:** T055-T065 all [P] — 11 screen shells in parallel.

**Phase 5 US3:** T068-T073 [P] — 6 components in parallel. T074-T078 [P] — 5 shared components. T079-T082 [P] — 4 provider components. T092-T098 [P] — 7 wizard steps.

---

## Parallel Example: Phase 2 Foundational

```
# Wave 1: All infrastructure (9 agents)
T004: Create palettes.ts
T005: Create theme-context.tsx
T006: Create routes.ts
T007: Create back-navigation.ts
T009: Create keyboard-provider.tsx
T010: Create useKey + useScope hooks
T011: Create footer-provider.tsx
T012: Create navigation config

# Wave 2: Navigation context (needs T006, T007)
T008: Create navigation-context.tsx

# Wave 3: All core components (9 agents)
T013: Badge | T014: Button | T015: Panel | T016: Menu
T017: SectionHeader | T018: Callout | T019: Spinner
T020: Toast | T021: ScrollArea

# Wave 4: Layout + app shell
T022: Header | T023: Footer | T028-T031: Shared hooks
T024: GlobalLayout (needs T022, T023)
T025: ScreenRouter (needs T006)
T026: App index.tsx (needs T005, T008, T009, T011, T024, T025)
T027: CLI entry (needs T026)
```

## Parallel Example: Phase 3 US1

```
# Wave 1: All feature components (15 agents)
T032: Tabs | T033: EmptyState | T034: InfoField | T035: ContextSidebar
T036: HomeMenu | T038: SeverityBar | T039: SeverityBreakdown
T040: ProgressStep | T041: ProgressList | T042: ActivityLog
T043: CodeSnippet | T044: IssuePreviewItem | T045: IssueListPane
T046: IssueDetailsPane | T047: useReviewStream | T048: useReviewLifecycle
T049: useReviewKeyboard

# Wave 2: Screens (need feature components)
T037: HomeScreen | T050: ReviewProgressView | T051: ReviewSummaryView
T052: ReviewResultsView

# Wave 3: Composition
T053: ReviewContainer
T054: ReviewScreen
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test full review workflow in terminal
5. Demo: launch → menu → review → progress → summary → browse issues

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → **MVP!** (review workflow in terminal)
3. Add US2 → All screens navigable with shortcuts
4. Add US3 → Full settings + onboarding in terminal
5. Add US4 → History browsing
6. Add US5 → Component documentation
7. Polish → responsive layout, keyboard consistency

### Parallel Team Strategy (up to 100 agents)

After Foundational is complete:
- **Agent group A (15 agents)**: User Story 1 — review feature components + screens
- **Agent group B (11 agents)**: User Story 2 — screen shells (can start immediately)
- **Agent group C (25 agents)**: User Story 3 — form components + settings + onboarding
- **Agent group D (4 agents)**: User Story 4 — history (after US3 delivers NavigationList)
- **Agent group E (3 agents)**: User Story 5 — docs (after US1 + US3 complete)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All components follow contracts in `specs/004-ink-diffui-components/contracts/terminal-components.md`
- All components use `useTheme()` for colors — never hardcode ANSI values
- All screens declare footer shortcuts via `usePageFooter()`
- All screens register keyscope scope via `useScope()`
- ESM only: use `.js` extensions in all imports
