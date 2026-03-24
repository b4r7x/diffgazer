# Feature Specification: Diff-UI Web Integration

**Feature Branch**: `001-diffui-web-integration`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Integrate diff-ui components into diffgazer web UI, replacing local components with diff-ui library components via workspace linking (not yet on npm). Apply diff-ui design tokens and color overrides. Keyscope integration is already complete."

## Clarifications

### Session 2026-03-24

- Q: Migration architecture — direct replacement vs re-export facade vs hybrid? → A: Re-export facade. `@diffgazer/ui` becomes a thin re-export layer that maps to diff-ui internally. Consumer files keep importing from `@diffgazer/ui` — no import path changes needed across the app.
- Q: Migration scope — all overlapping components at once vs core subset first vs page-by-page? → A: All at once. Migrate every overlapping component in a single sweep.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Replace Local UI Components with Diff-UI via Re-Export Facade (Priority: P1)

As a developer working on diffgazer, I want `@diffgazer/ui` to become a thin re-export layer over diff-ui so that the web app uses diff-ui components without changing any import paths in consumer files.

The web app currently has ~95 exports from `@diffgazer/ui` (Button, Badge, Input, Dialog, Panel, Tabs, Toast, Menu, Checkbox, Radio, ScrollArea, CodeBlock, DiffView, etc.). Many of these have direct counterparts in diff-ui's 60-item registry. The migration replaces all overlapping component implementations at once: `@diffgazer/ui` re-exports from `diffui/components/*`, `diffui/hooks/*`, and `diffui/lib/*` where a match exists. Components with no diff-ui counterpart remain as local implementations within `@diffgazer/ui`.

**Why this priority**: This is the core migration — without it, the web app continues using a parallel component set that diverges from diff-ui. The re-export facade approach is lowest-risk: one package changes internally, zero consumer files need import path updates, and individual components can be rolled back by reverting a single re-export.

**Independent Test**: Can be tested by changing `@diffgazer/ui` to re-export a subset of components from diff-ui and verifying the UI renders correctly with identical behavior and keyboard navigation intact.

**Acceptance Scenarios**:

1. **Given** `@diffgazer/ui` re-exports a component from diff-ui, **When** any consumer file imports that component from `@diffgazer/ui`, **Then** the component renders with the same visual appearance and interactive behavior as before.
2. **Given** a page uses multiple re-exported components, **When** all are backed by diff-ui, **Then** keyboard navigation via keyscope continues to work identically.
3. **Given** a component exists only in `@diffgazer/ui` and has no diff-ui counterpart, **Then** it remains as a local implementation and is exported directly (not re-exported from diff-ui).
4. **Given** diff-ui is not published on npm, **When** `@diffgazer/ui` declares `diffui` as a dependency, **Then** it resolves via workspace linking and builds successfully.
5. **Given** a diff-ui component has a different prop API than the current `@diffgazer/ui` export, **When** the re-export is added, **Then** the re-export adapts the API (wrapper or type mapping) so consumer call sites do not need changes.

---

### User Story 2 - Apply Diff-UI Design Tokens with Diffgazer Color Overrides (Priority: P2)

As a developer, I want the diffgazer web app to consume diff-ui's design token system (CSS custom properties) while overriding specific color values to match diffgazer's established GitHub-inspired palette, so that components render with the right diffgazer look and feel.

Currently, diff-ui uses a monochrome TUI palette (e.g., `--tui-bg: #0a0a0a`, `--tui-green: #e5e5e5`) while diffgazer uses a GitHub Dark/Light palette (e.g., `--tui-bg: #0d1117`, `--tui-green: #3fb950`). The structural token names are shared (`--tui-*`), but the values differ. The integration must layer diffgazer's color overrides on top of diff-ui's base tokens.

**Why this priority**: Components will render but look wrong without correct colors. This must follow P1 because the token override layer only matters once diff-ui components are actually in use.

**Independent Test**: Can be tested by importing diff-ui's `theme.css` and a diffgazer override stylesheet, then visually verifying that buttons, badges, panels, and other components match the expected diffgazer palette in both dark and light modes.

**Acceptance Scenarios**:

1. **Given** diff-ui's base theme is loaded, **When** diffgazer's color overrides are applied after, **Then** all components render with diffgazer's GitHub-inspired color palette.
2. **Given** the user switches between dark and light mode, **When** viewing any diff-ui component, **Then** the component uses the correct diffgazer color values for that mode.
3. **Given** diff-ui defines semantic tokens (primary, destructive, success, warning, etc.), **When** these tokens are used by components, **Then** they resolve to diffgazer's palette values, not diff-ui's monochrome defaults.
4. **Given** diff-ui adds a new CSS custom property in a future update, **When** the override layer does not define it, **Then** the diff-ui default value is used as a fallback without breaking.

---

### User Story 3 - Workspace Linking for Pre-NPM Development (Priority: P3)

As a developer, I want diff-ui to be consumable via pnpm workspace linking before it is published to npm, so that I can develop, iterate, and test the integration using local source without waiting for a package release.

**Why this priority**: This is an enabler for P1 and P2, but the workspace already has precedent (keyscope uses `workspace:*`). The configuration change is small but must be correct for the build pipeline to work.

**Independent Test**: Can be tested by adding the workspace dependency, running `pnpm install`, and verifying that `import { Button } from 'diffui/components/button'` resolves and builds.

**Acceptance Scenarios**:

1. **Given** diff-ui is not on npm, **When** `diffui` is added as a workspace dependency to the web app's `@diffgazer/ui` package, **Then** pnpm resolves it from the local workspace and `pnpm install` succeeds.
2. **Given** the workspace link is configured, **When** the developer runs the dev server, **Then** changes to diff-ui source are reflected in the web app (after rebuild if needed).
3. **Given** the workspace link is in place, **When** a production build is triggered, **Then** the build completes without errors and the output includes diff-ui component code.

---

### Edge Cases

- What happens when a diff-ui component has a significantly different prop API than the `@diffgazer/ui` equivalent? The re-export layer must include a thin adapter wrapper that maps the old API to the new one, so consumer files are unaffected.
- What happens when a diff-ui component imports a keyscope hook that the `@diffgazer/ui` version handles differently? Keyscope is already integrated, so the diff-ui component's hook usage should work within the existing `KeyboardProvider`.
- What happens when diff-ui's `theme.css` defines CSS variables that conflict with diffgazer's existing `theme.css`? The override layer must load after diff-ui's base theme to take precedence.
- What happens when a component uses diff-ui's `cn()` utility but the web app already has its own `cn()` from `@diffgazer/ui`? The canonical `cn()` should come from diff-ui (`diffui/lib/utils`), with `@diffgazer/ui` re-exporting it.
- What happens when diff-ui marks `keyscope` as an optional peer dependency but diffgazer already has it installed? The existing installation satisfies the peer dependency — no additional action needed.
- What happens when a re-exported component causes a type incompatibility at a consumer call site? The re-export must preserve or adapt the type signature so existing code compiles without changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `@diffgazer/ui` MUST add `diffui` as a workspace dependency and re-export diff-ui components through its existing public API.
- **FR-002**: All overlapping components between `@diffgazer/ui` and diff-ui MUST be migrated at once — `@diffgazer/ui` re-exports from diff-ui for every component that has a counterpart.
- **FR-003**: Components with no diff-ui counterpart (diffgazer-specific UI such as severity badges, progress indicators, ASCII logo) MUST remain as local implementations within `@diffgazer/ui`.
- **FR-004**: Consumer files throughout the web app MUST NOT require import path changes — they continue importing from `@diffgazer/ui`.
- **FR-005**: Where a diff-ui component has a different prop API than the existing `@diffgazer/ui` export, the re-export layer MUST include an adapter so consumer call sites are unaffected.
- **FR-006**: The web app MUST load diff-ui's design token stylesheet (`theme.css`) as the base layer.
- **FR-007**: The web app MUST apply a diffgazer-specific color override stylesheet that redefines CSS custom property values to match the GitHub-inspired palette.
- **FR-008**: The color override MUST cover both dark mode (root) and light mode (`[data-theme="light"]`) variants.
- **FR-009**: Keyboard navigation MUST continue to function identically after the migration — keyscope hooks used by diff-ui components must work within the existing `KeyboardProvider`.
- **FR-010**: The migration MUST NOT break existing features — all pages, dialogs, forms, and interactive flows must remain functional.
- **FR-011**: A single source of utility functions (e.g., `cn()` for class merging) MUST be established — `@diffgazer/ui` re-exports utilities from diff-ui to avoid duplication.

### Key Entities

- **Re-Export Mapping**: A correspondence between `@diffgazer/ui` exports and diff-ui registry items, identifying which components are re-exported from diff-ui, which remain local, and which require API adaptation wrappers.
- **Token Override Layer**: A stylesheet that redefines diff-ui's CSS custom property values with diffgazer's color palette, structured as a thin override (not a full theme duplication).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All diff-ui components used via re-export render visually identical to the current `@diffgazer/ui` appearance (same colors, spacing, typography) in both dark and light modes.
- **SC-002**: 100% of existing keyboard navigation flows work without modification after component replacement — no regressions in keyscope-powered interactions.
- **SC-003**: The web app builds and runs successfully with diff-ui resolved via workspace linking, with zero unresolved import errors.
- **SC-004**: Zero consumer files require import path changes — all imports remain `@diffgazer/ui`.
- **SC-005**: The number of locally maintained component implementations in `@diffgazer/ui` is reduced to only those with no diff-ui equivalent.
- **SC-006**: Switching between dark and light mode produces correct color rendering for every re-exported component.
- **SC-007**: No duplicate utility functions (e.g., `cn()`) exist — a single canonical source is used across the app.

## Assumptions

- The pnpm workspace at `/Users/voitz/Projects/diffgazer-workspace/` already includes `diff-ui` in its `pnpm-workspace.yaml` packages list (confirmed: it does).
- Keyscope is fully integrated and working (confirmed: 47 files, `KeyboardProvider` wrapping the app). No keyscope-related work is needed for this feature.
- The diff-ui npm package build (`packages/npm`) produces working subpath exports from local source via workspace linking.
- The shared CSS custom property naming convention (`--tui-*`) between both projects is intentional and allows override-based theming.
- Components that exist in both libraries serve the same purpose and have broadly compatible APIs, with minor prop differences that can be reconciled via adapter wrappers in the re-export layer.
- `@diffgazer/ui` continues to exist as a package but transitions from containing component implementations to being a re-export facade over diff-ui, with only diffgazer-specific components remaining as local code.
