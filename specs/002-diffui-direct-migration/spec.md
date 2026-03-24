# Feature Specification: Direct Diff-UI Component Migration

**Feature Branch**: `002-diffui-direct-migration`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Replace @diffgazer/ui re-export facade with direct diff-ui imports. Install diffui as a direct dependency in apps/web, rewrite all component imports to use diffui/* subpath exports, apply CSS token overrides for diffgazer palette, and slim down @diffgazer/ui to only diffgazer-specific components."

**Context**: This supersedes the approach in `001-diffui-web-integration` which used a re-export facade pattern. Instead of routing all imports through @diffgazer/ui, this migration adopts diff-ui's component API directly across the web app, rewriting consumer files to import from `diffui/*` subpath exports.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rewrite Web App to Import Directly from Diff-UI (Priority: P1)

As a developer working on diffgazer, I want the web app to import components directly from `diffui/*` subpath exports instead of through the `@diffgazer/ui` re-export facade, so that the codebase uses the canonical diff-ui API without an intermediate abstraction layer.

Currently, 52 files in `apps/web/` import from `@diffgazer/ui`. Of the ~31 unique imports, 23+ have direct counterparts in diff-ui's 44-component registry. The migration rewrites each consumer file to import from `diffui/components/*`, `diffui/hooks/*`, or `diffui/lib/*` for every component that exists in diff-ui. Consumer call sites adapt to diff-ui's prop API where it differs (e.g., keyboard navigation props, generic type parameters, compound component structure).

**Components to migrate (23):** Badge, Input, Textarea, ScrollArea, SectionHeader, KeyValue, Button, Callout, Checkbox/CheckboxGroup/CheckboxItem, Radio/RadioGroup/RadioGroupItem, Panel/PanelHeader/PanelContent, Tabs/TabsList/TabsTrigger/TabsContent, Menu/MenuItem/MenuDivider, NavigationList/NavigationListItem, Dialog (all parts), EmptyState, CodeBlock, DiffView, BlockBar, Stepper/StepperStep/StepperSubstep, HorizontalStepper, SearchInput, ToggleGroup.

**Components remaining in @diffgazer/ui (4):** CardLayout, LabeledField, Checklist, Toast (context-based system with no diff-ui counterpart).

**Why this priority**: This is the core migration — it eliminates the facade layer, reduces package coupling, and makes the web app consume diff-ui directly. Every other user story depends on this being in place.

**Independent Test**: Can be tested by rewriting imports in a single feature directory (e.g., `features/settings/`), building the web app, and verifying the UI renders correctly with identical behavior.

**Acceptance Scenarios**:

1. **Given** a consumer file previously importing Button from `@diffgazer/ui`, **When** the import is changed to `diffui/components/button`, **Then** the component renders with the same visual appearance and the file builds without type errors.
2. **Given** a consumer file using CheckboxGroup with `focusedValue` prop (diffgazer-specific), **When** migrated to diff-ui's Checkbox component, **Then** the keyboard navigation continues to work using diff-ui's built-in keyscope integration.
3. **Given** all 52 consumer files have been migrated, **When** running a full build, **Then** zero import errors exist and the app starts successfully.
4. **Given** a consumer file using Dialog with focus trap behavior, **When** migrated to diff-ui's Dialog component, **Then** focus trap, body overflow, portal rendering, and keyboard dismiss all work identically.
5. **Given** a consumer file using the generic `Tabs<T>` type parameter, **When** migrated to diff-ui's Tabs, **Then** type-safe tab values are preserved (diff-ui supports this via its own typing).
6. **Given** diff-ui components use built-in keyscope hooks internally, **When** the web app's existing `KeyboardProvider` wraps the app, **Then** diff-ui components' keyboard navigation works seamlessly alongside the app's existing `useKey`, `useScope`, and `useNavigation` usage.

---

### User Story 2 - Apply CSS Token Overrides for Diffgazer Palette (Priority: P2)

As a developer, I want the diffgazer web app to load diff-ui's base theme and apply a color override layer that maps to diffgazer's GitHub-inspired palette, so that all diff-ui components render with the correct diffgazer look and feel in both dark and light modes.

The token system is two-layered: diff-ui defines 14 primitive TUI tokens (`--tui-bg`, `--tui-fg`, `--tui-blue`, etc.) and 30+ semantic tokens (`--primary`, `--accent`, `--ring`, etc.) with a "Minimal Monochrome" default. Diffgazer overrides specific primitive values to produce a GitHub Dark/Light palette and remaps 4 semantic tokens (`--primary`, `--accent`, `--accent-foreground`, `--ring` all change from monochrome to blue-accented). Additionally, diffgazer defines 8 domain-specific tokens (`--severity-*`, `--status-*`) not present in diff-ui.

**Why this priority**: Without correct token overrides, diff-ui components render in monochrome instead of the GitHub palette. This must be validated after P1 since the override only matters once real diff-ui components are rendering.

**Independent Test**: Can be tested by loading the web app with diff-ui components active, visually comparing against the current GitHub Dark palette, and toggling dark/light mode on every page.

**Acceptance Scenarios**:

1. **Given** diff-ui's base theme is loaded first, **When** diffgazer's override layer is loaded after, **Then** primitive tokens resolve to GitHub palette values (e.g., `--tui-bg: #0d1117` in dark, `--tui-fg: #c9d1d9`).
2. **Given** semantic tokens are mapped through overridden primitives, **When** rendering a Button component, **Then** primary color is blue (`--tui-blue`), not monochrome gray.
3. **Given** the user toggles between dark and light mode, **When** viewing any page, **Then** every component uses the correct palette for that mode — no monochrome bleed-through.
4. **Given** diffgazer-specific tokens (`--severity-blocker`, `--status-running`, etc.) are defined only in the override layer, **When** components reference these tokens, **Then** they resolve correctly in both modes.
5. **Given** diff-ui adds a new CSS custom property in a future update, **When** the override layer does not define it, **Then** the diff-ui default value is used as fallback.

---

### User Story 3 - Slim Down @diffgazer/ui to Diffgazer-Specific Components Only (Priority: P3)

As a developer, I want `@diffgazer/ui` to contain only the 4 truly diffgazer-specific components (CardLayout, LabeledField, Checklist, Toast) and their supporting utilities, removing all re-exports and local implementations that now live in diff-ui.

After P1 migrates consumer imports to `diffui/*`, the re-export layer and duplicate local component files in @diffgazer/ui become dead code. Removing them prevents confusion about which import path is canonical and reduces the package's maintenance surface.

**Why this priority**: Cleanup task — the app works after P1+P2, but leaving dead code creates ambiguity. This can be done incrementally after the migration is verified.

**Independent Test**: Can be tested by removing re-exports and local component files from @diffgazer/ui, running a full build, and verifying no file in the workspace imports the removed exports.

**Acceptance Scenarios**:

1. **Given** all consumer files import directly from `diffui/*`, **When** re-exports of Badge, Input, ScrollArea, SectionHeader, KeyValue, and cn are removed from @diffgazer/ui, **Then** the build succeeds with zero errors.
2. **Given** local component files (button.tsx, callout.tsx, checkbox.tsx, radio-group.tsx, panel.tsx, tabs/, dialog/, navigation-list/, menu/, empty-state.tsx, code-block.tsx, diff-view.tsx, block-bar.tsx, stepper/, horizontal-stepper.tsx, search-input.tsx, toggle-group.tsx) are deleted from @diffgazer/ui, **Then** the build succeeds because no file imports them.
3. **Given** @diffgazer/ui retains CardLayout, LabeledField, Checklist, and Toast, **When** consumer files import these from @diffgazer/ui, **Then** they render and function correctly.
4. **Given** the internal utilities (cn.ts, selectable-item.ts, portal.tsx) are no longer needed by @diffgazer/ui's remaining components, **When** they are removed, **Then** the build succeeds (or they are kept if Toast/CardLayout still uses them).

---

### User Story 4 - Preserve Keyscope Keyboard Navigation (Priority: P1)

As a user navigating the diffgazer app with keyboard, I want all keyboard navigation to continue working identically after the migration, so that I can use arrow keys, Enter, Escape, Tab, and shortcut keys throughout the app without any regression.

Currently 39 files use keyscope hooks (useKey: 21, useNavigation: 18, useScope: 13, useFocusZone: 6). Diff-ui components have built-in keyscope integration (11 components use @keyscope/navigation internally). The migration must ensure that the app's explicit keyscope usage and diff-ui's internal keyscope usage coexist under the same `KeyboardProvider`.

**Why this priority**: P1 — keyboard navigation is a core UX pillar. Any regression breaks the TUI-like experience that defines diffgazer.

**Independent Test**: Can be tested per feature area — open each page, use arrow keys to navigate lists/menus, Enter to select, Escape to dismiss, Tab to cycle focus, and verify all flows work.

**Acceptance Scenarios**:

1. **Given** a RadioGroup migrated to diff-ui's Radio component, **When** the user presses arrow keys, **Then** selection moves through radio options identically to before.
2. **Given** a Dialog migrated to diff-ui's Dialog, **When** the user presses Tab, **Then** focus cycles within the dialog (focus trap) and Escape dismisses it.
3. **Given** the app's root `KeyboardProvider` wraps everything, **When** diff-ui components use keyscope hooks internally, **Then** both app-level and component-level keyboard handlers work without conflicts.
4. **Given** a NavigationList migrated to diff-ui's NavigationList, **When** the user presses arrow keys and Enter, **Then** items are focused, selected, and activated with the same behavior.

---

### Edge Cases

- What happens when a diff-ui component has a different compound structure than @diffgazer/ui's version? Consumer files must be updated to use diff-ui's compound API (e.g., if diff-ui's Callout uses `Callout.Title` compound vs @diffgazer/ui's `title` prop).
- What happens when the app's explicit `useNavigation` call targets the same list that a diff-ui component manages internally? The scope system in keyscope isolates them — each component operates within its own scope. If the app wraps a diff-ui component with `useScope`, navigation contexts stay separate.
- What happens when diff-ui's built-in keyboard navigation differs from @diffgazer/ui's `focusedValue`/`onActivate` pattern? Consumer files drop the external focus management props and rely on diff-ui's internal keyboard handling instead.
- What happens when @diffgazer/ui's generic `Tabs<T>` or `RadioGroup<T>` type parameter is not supported by diff-ui? If diff-ui uses `string` instead of a generic, consumer files cast or use type assertions at call sites. If diff-ui supports generics, no change needed.
- What happens when diff-ui's Button has fewer variants than @diffgazer/ui's Button (which has `tab`, `toggle`, `link` variants)? The ToggleGroup component in diff-ui may absorb `toggle` behavior. For `tab` and `link`, either diff-ui's equivalent variant is used or a small diffgazer-specific extension is created.
- What happens when the Toast system (context-based, unique to diffgazer) needs to render inside a Dialog portal? The Toast portal and Dialog portal must not interfere — both render at document.body level with distinct z-index stacking.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The web app MUST add `diffui` as a direct workspace dependency and import components via `diffui/components/*`, `diffui/hooks/*`, and `diffui/lib/*` subpath exports.
- **FR-002**: All 52 consumer files in `apps/web/` that import from `@diffgazer/ui` MUST be audited. For each import that has a diff-ui counterpart, the import MUST be rewritten to use `diffui/*` directly.
- **FR-003**: Consumer call sites MUST be adapted to diff-ui's prop API where it differs from @diffgazer/ui's API (e.g., compound component structure, keyboard navigation props, generic type parameters).
- **FR-004**: Components with no diff-ui counterpart (CardLayout, LabeledField, Checklist, Toast) MUST remain importable from `@diffgazer/ui`.
- **FR-005**: The web app MUST load diff-ui's base theme CSS and apply a diffgazer-specific override stylesheet that redefines color values to match the GitHub-inspired palette.
- **FR-006**: The color override MUST cover both dark mode (root) and light mode (`[data-theme="light"]`) including: 14 primitive TUI tokens, 4 remapped semantic tokens (`--primary`, `--accent`, `--accent-foreground`, `--ring`), `--muted-foreground`, and 5 subtle/strong variant overrides.
- **FR-007**: The color override MUST preserve diffgazer-specific domain tokens: `--severity-blocker`, `--severity-high`, `--severity-medium`, `--severity-low`, `--severity-nit`, `--status-running`, `--status-complete`, `--status-pending`.
- **FR-008**: Keyboard navigation MUST function identically after migration — all 39 files using keyscope hooks must continue working, and diff-ui's internal keyscope integration must coexist with the app's explicit keyscope usage under the same `KeyboardProvider`.
- **FR-009**: After migration, @diffgazer/ui MUST be slimmed down to contain only diffgazer-specific components and their supporting utilities — all re-exports and local component files that moved to direct diff-ui imports MUST be removed.
- **FR-010**: The `cn()` utility MUST be imported from `diffui/lib/utils` in consumer files, not from @diffgazer/ui.
- **FR-011**: All pages, dialogs, forms, and interactive flows MUST remain functional after the migration — zero user-facing regressions.

### Key Entities

- **Component Migration Map**: A per-component correspondence defining: source (current @diffgazer/ui export), target (diffui/* subpath), API differences requiring consumer adaptation, and the list of consumer files affected.
- **Token Override Layer**: A CSS stylesheet that redefines diff-ui's CSS custom property values with diffgazer's color palette, structured as a thin override loaded after diff-ui's base theme.
- **Diffgazer-Specific Component Set**: The 4 components (CardLayout, LabeledField, Checklist, Toast) that remain in @diffgazer/ui because they have no diff-ui counterpart.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of consumer files that previously imported diff-ui-counterpart components from @diffgazer/ui now import directly from `diffui/*` — zero indirect imports through the facade for migrated components.
- **SC-002**: The web app builds and runs successfully with zero import errors and zero type errors after migration.
- **SC-003**: All keyboard navigation flows work without regression — arrow key navigation, Enter selection, Escape dismissal, Tab cycling, and all keyboard shortcuts function identically across all 6 feature areas (settings, providers, review, onboarding, history, home).
- **SC-004**: Components render with the correct GitHub-inspired palette in both dark and light modes — no monochrome bleed-through from diff-ui's default theme.
- **SC-005**: @diffgazer/ui's export count drops from ~31 unique exports to ~15 (only CardLayout, LabeledField, Checklist, Toast and their types/variants).
- **SC-006**: No duplicate component implementations exist — each component has exactly one source of truth (either diffui/* or @diffgazer/ui, never both).
- **SC-007**: The `cn()` utility has a single canonical import source (`diffui/lib/utils`) used consistently across all consumer files.

## Assumptions

- The pnpm workspace at `/Users/voitz/Projects/diffgazer-workspace/` already includes diff-ui, and `diffui` resolves via workspace linking (confirmed: `link:../diff-ui/packages/npm` at root, `workspace:*` in packages/ui).
- Keyscope is fully integrated with `KeyboardProvider` wrapping the entire app (confirmed: 39 files, 5 hooks). No keyscope setup work is needed.
- Diff-ui's npm package (`diffui@0.1.0`) has proper subpath exports for all 44 components, 8 hooks, and 5 lib items (confirmed: `./components/*`, `./hooks/*`, `./lib/*`, `./theme.css`, `./styles.css`).
- Diff-ui components with built-in keyscope integration (11 components) work correctly when keyscope is installed as a peer dependency and `KeyboardProvider` is present.
- The shared CSS custom property naming convention (`--tui-*`) between both projects is intentional and allows the override-based theming to work by loading diff-ui's theme first, then the override second.
- Diff-ui's component APIs are stable enough for direct adoption — the library won't undergo breaking API changes during this migration.
- The existing `theme-overrides.css` content (188 lines covering primitives, semantics, domain tokens, animations, font-face, utility classes, and @theme block) can be moved or kept as-is with minimal changes.
