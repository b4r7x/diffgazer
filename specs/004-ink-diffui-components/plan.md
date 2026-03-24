# Implementation Plan: Ink Component Library for CLI (diff-ui Mirror)

**Branch**: `004-ink-diffui-components` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-ink-diffui-components/spec.md`

## Summary

Build a terminal-native component library for the diffgazer CLI that mirrors all 13 web app screens using Ink 6 equivalents of the 18 diff-ui components actively used. The architecture follows the same feature-based structure as the web app (with "screens" instead of "pages"), using custom state-based routing, a keyscope adapter for terminal keyboard input, and ANSI color theming with dark/light/high-contrast palettes. Dialogs render as full-screen overlays. All components get documentation pages.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, .js extensions in imports
**Primary Dependencies**: Ink 6.8.0, React 19.2.4, ink-spinner 5.0.0, chalk 5.6.2, @inkjs/ui (to add: Select, TextInput, ConfirmInput)
**Storage**: N/A (reuses existing `~/.diffgazer/config.json` via `@diffgazer/api` and server)
**Testing**: vitest (existing workspace setup), @testing-library/react (for hook tests)
**Target Platform**: macOS/Linux/Windows terminals, 80+ columns minimum
**Project Type**: CLI app (Ink 6 React terminal renderer) within existing monorepo
**Performance Goals**: <2s screen transitions (SC-003), 30fps Ink render cap (default)
**Constraints**: 80-column minimum width, 16-color graceful degradation, no new server dependencies
**Scale/Scope**: 18 components, 13 screens, 6 feature modules, 3 providers (theme, keyboard, navigation), ~100 files

## Constitution Check

*GATE: Constitution is unconfigured (template only). No gates to check. Proceeding.*

**Post-Phase 1 re-check**: N/A — no constitution gates defined.

## Project Structure

### Documentation (this feature)

```text
specs/004-ink-diffui-components/
├── plan.md                      # This file
├── spec.md                      # Feature specification
├── research.md                  # Phase 0: technical research
├── data-model.md                # Phase 1: data model
├── quickstart.md                # Phase 1: developer quickstart
├── contracts/
│   └── terminal-components.md   # Phase 1: component API contracts
└── checklists/
    └── requirements.md          # Spec quality checklist
```

### Source Code (repository root)

```text
apps/cli/src/
├── app/
│   ├── routes.ts                          # Route discriminated union type
│   ├── navigation-context.tsx             # NavigationProvider + useNavigation
│   ├── router.tsx                         # ScreenRouter (switch on route)
│   ├── index.tsx                          # App root (updated with provider tree)
│   ├── providers/
│   │   ├── server-provider.tsx            # Existing
│   │   ├── keyboard-provider.tsx          # TerminalKeyboardProvider (keyscope adapter)
│   │   └── footer-provider.tsx            # Footer shortcut context
│   ├── screens/
│   │   ├── home-screen.tsx
│   │   ├── onboarding-screen.tsx
│   │   ├── review-screen.tsx
│   │   ├── history-screen.tsx
│   │   ├── help-screen.tsx
│   │   └── settings/
│   │       ├── hub-screen.tsx
│   │       ├── theme-screen.tsx
│   │       ├── providers-screen.tsx
│   │       ├── storage-screen.tsx
│   │       ├── analysis-screen.tsx
│   │       ├── agent-execution-screen.tsx
│   │       ├── diagnostics-screen.tsx
│   │       └── trust-permissions-screen.tsx
│   └── modes/
│       ├── dev.ts                         # Existing
│       └── prod.ts                        # Existing
├── components/
│   ├── ui/                                # Terminal component library (18 components)
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── callout.tsx
│   │   ├── checkbox.tsx
│   │   ├── dialog.tsx
│   │   ├── empty-state.tsx
│   │   ├── input.tsx
│   │   ├── key-value.tsx
│   │   ├── logo.tsx                       # Existing (update for theming)
│   │   ├── menu.tsx
│   │   ├── navigation-list.tsx
│   │   ├── panel.tsx
│   │   ├── radio.tsx
│   │   ├── scroll-area.tsx
│   │   ├── section-header.tsx
│   │   ├── spinner.tsx
│   │   ├── status-display.tsx             # Existing
│   │   ├── tabs.tsx
│   │   └── toast.tsx
│   └── layout/
│       ├── global-layout.tsx
│       ├── header.tsx
│       └── footer.tsx
├── features/                              # Feature modules (mirrors web)
│   ├── home/
│   │   ├── components/
│   │   │   ├── home-menu.tsx
│   │   │   ├── context-sidebar.tsx
│   │   │   ├── info-field.tsx
│   │   │   └── trust-panel.tsx
│   │   └── hooks/
│   ├── review/
│   │   ├── components/
│   │   │   ├── review-container.tsx
│   │   │   ├── review-progress-view.tsx
│   │   │   ├── review-summary-view.tsx
│   │   │   ├── review-results-view.tsx
│   │   │   ├── issue-list-pane.tsx
│   │   │   ├── issue-details-pane.tsx
│   │   │   ├── issue-preview-item.tsx
│   │   │   ├── activity-log.tsx
│   │   │   ├── code-snippet.tsx
│   │   │   ├── severity-bar.tsx
│   │   │   ├── severity-breakdown.tsx
│   │   │   ├── progress-list.tsx
│   │   │   └── progress-step.tsx
│   │   └── hooks/
│   │       ├── use-review-lifecycle.ts
│   │       ├── use-review-stream.ts
│   │       └── use-review-keyboard.ts
│   ├── history/
│   │   ├── components/
│   │   │   ├── timeline-list.tsx
│   │   │   ├── history-insights-pane.tsx
│   │   │   └── run-item.tsx
│   │   └── hooks/
│   ├── onboarding/
│   │   ├── components/
│   │   │   ├── onboarding-wizard.tsx
│   │   │   ├── wizard-progress.tsx
│   │   │   └── steps/
│   │   │       ├── provider-step.tsx
│   │   │       ├── api-key-step.tsx
│   │   │       ├── model-step.tsx
│   │   │       ├── analysis-step.tsx
│   │   │       ├── storage-step.tsx
│   │   │       └── execution-step.tsx
│   │   └── hooks/
│   ├── providers/
│   │   ├── components/
│   │   │   ├── provider-list.tsx
│   │   │   ├── provider-details.tsx
│   │   │   ├── api-key-overlay.tsx
│   │   │   └── model-select-overlay.tsx
│   │   └── hooks/
│   └── settings/
│       ├── components/
│       │   ├── theme-selector.tsx
│       │   ├── analysis-selector.tsx
│       │   └── theme-preview.tsx
│       └── hooks/
├── hooks/
│   ├── use-back-handler.ts
│   ├── use-exit-handler.ts                # Existing
│   ├── use-servers.ts                     # Existing
│   ├── use-page-footer.ts
│   └── use-terminal-dimensions.ts
├── theme/
│   ├── palettes.ts                        # CliColorTokens + 3 palettes
│   └── theme-context.tsx                  # CliThemeProvider + useTheme
├── config/
│   └── navigation.ts                      # Menu items, shortcuts
├── lib/
│   └── back-navigation.ts                 # getBackTarget
└── types/
    └── cli.ts                             # Existing
```

**Structure Decision**: Feature-based structure mirroring the web app's `apps/web/src/features/` pattern. Screens replace pages. Components live in `components/ui/` (terminal component library) and `components/layout/` (shell). Each feature module is self-contained with its own components and hooks subdirectories.

## Complexity Tracking

> No constitution violations — no complexity justification needed.

## Implementation Phases (for task generation)

### Phase A: Foundation (no dependencies)

1. **Theme system**: `theme/palettes.ts` + `theme-context.tsx` (CliThemeProvider, useTheme)
2. **Route definitions**: `app/routes.ts` (Route union type)
3. **Navigation context**: `app/navigation-context.tsx` (NavigationProvider, useNavigation, goBack)
4. **Back navigation logic**: `lib/back-navigation.ts` (getBackTarget)
5. **Footer context**: `app/providers/footer-provider.tsx` (FooterProvider, usePageFooter)
6. **Terminal keyboard provider**: `app/providers/keyboard-provider.tsx` (TerminalKeyboardProvider — keyscope adapter)
7. **Navigation config**: `config/navigation.ts` (menu items, shortcuts)

### Phase B: Component Library (depends on Phase A for theming)

Build 18 terminal components in priority order:
- **P0 (most used)**: Badge, Button, Panel, Menu, SectionHeader, Callout, Spinner, Toast
- **P1 (forms + navigation)**: RadioGroup, CheckboxGroup, Input, ScrollArea, Dialog, NavigationList, Tabs
- **P2 (niche)**: EmptyState, KeyValue

Plus layout components: Header, Footer, GlobalLayout

### Phase C: App Shell (depends on A + B)

1. Update `app/index.tsx` with provider tree (Theme → Keyboard → Navigation → Footer → Server → Layout → Router)
2. Update `app/router.tsx` with ScreenRouter (switch on all routes)
3. Create shared hooks: `use-back-handler.ts`, `use-page-footer.ts`, `use-terminal-dimensions.ts`

### Phase D: Screens (depends on C, parallelizable per screen)

Build 13 screens in priority order:
- **P1**: HomeScreen, ReviewScreen (streaming + summary + results)
- **P2**: SettingsHubScreen, all 7 settings sub-screens
- **P3**: HistoryScreen, HelpScreen
- **P4**: OnboardingScreen

### Phase E: Feature Modules (depends on D, parallelizable per feature)

Build feature-specific components and hooks for each screen:
- Home feature: HomeMenu, ContextSidebar, TrustPanel
- Review feature: ReviewContainer, ReviewProgressView, ReviewSummaryView, ReviewResultsView, IssueListPane, IssueDetailsPane, CodeSnippet, SeverityBar, ProgressList
- History feature: TimelineList, HistoryInsightsPane
- Onboarding feature: OnboardingWizard, WizardProgress, 6 step components
- Providers feature: ProviderList, ProviderDetails, ApiKeyOverlay, ModelSelectOverlay
- Settings feature: ThemeSelector, AnalysisSelector

### Phase F: Documentation

Create documentation pages for all 18 terminal components in the docs app.

## Key Technical Decisions

| Decision | Choice | See |
|----------|--------|-----|
| Routing | Custom state-based with discriminated union | research.md #2 |
| Keyscope in Ink | TerminalKeyboardProvider adapter | research.md #3 |
| Dialogs | Full-screen overlay via conditional rendering | spec.md Clarifications |
| Theming | React context + hex palettes, chalk auto-downgrades | research.md #6 |
| Component APIs | Mirror diff-ui prop names where applicable | contracts/ |
| New dependency | `@inkjs/ui` for TextInput, Select, ConfirmInput | research.md #1 |
| Back navigation | Deterministic for settings, stack for rest | research.md #2 |
| Theme persistence | Existing `~/.diffgazer/config.json` | research.md #6 |
