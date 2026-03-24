# Research: Ink Component Library for CLI (diff-ui Mirror)

**Branch**: `004-ink-diffui-components` | **Date**: 2026-03-24

## 1. Ink 6 Component Patterns

### Decision: Build custom components on Ink primitives (Box, Text) + optionally add `@inkjs/ui` for Select/TextInput

**Rationale**: Ink 6 provides Box (flexbox via Yoga), Text (styled output), and hooks (useInput, useFocus, useFocusManager, useStdout). These are sufficient for all 18 terminal components. `@inkjs/ui` provides pre-built Select, TextInput, ConfirmInput, PasswordInput that save effort for form inputs.

**Alternatives considered**:
- Building everything from scratch: More work, no benefit over `@inkjs/ui` for standard inputs
- Using `@inkjs/ui` exclusively: Insufficient — it doesn't have Panel, Badge, Callout, Tabs, etc.

### Key Patterns Established

| Pattern | Approach |
|---------|----------|
| Layout | Box flexDirection + flexGrow + width/height (Yoga flexbox) |
| Borders | Box borderStyle="round"\|"single"\|"double" + borderColor |
| Colors | Text color prop accepts hex, chalk names, rgb() — chalk auto-downgrades |
| Input handling | useInput(handler, { isActive }) — isActive for input isolation |
| Focus management | useFocus (per-component) + useFocusManager (global) |
| Scrollable lists | Manual: state-tracked selectedIndex + scrollOffset with sliced visible window |
| Full-screen overlays | Conditional rendering (NOT absolute positioning) — unmounted components clean up useInput handlers |
| Permanent output | Static component for completed tasks/logs above dynamic content |
| Terminal dimensions | useStdout().stdout.columns/rows |
| Spinners | ink-spinner (already installed) |

### Available Dependencies

| Package | Status | Purpose |
|---------|--------|---------|
| `ink` 6.8.0 | Installed | Core renderer |
| `ink-spinner` 5.0.0 | Installed | Spinner component |
| `chalk` 5.6.2 | Installed | Color support (used internally by Ink) |
| `react` 19.2.4 | Installed | React 19 with useEffectEvent |
| `@inkjs/ui` | NOT installed | Official Select, TextInput, ConfirmInput, ProgressBar |

## 2. Routing Architecture

### Decision: Custom state-based routing with discriminated union type + NavigationProvider with stack-based back navigation

**Rationale**: No Ink 6-compatible routing library exists. ink-router targets Ink v2/v3 and is abandoned. State-based routing via useState + React context is the standard pattern for Ink apps (Shopify CLI, etc.). Zero new dependencies needed.

**Alternatives considered**:
- ink-router: Abandoned, Ink v2/v3 only, incompatible with React 19
- ink-navigation: Minimal, unmaintained wrapper
- TanStack Router: Browser-only, depends on History API

### Route Definition

```typescript
type Route =
  | { screen: "home" }
  | { screen: "onboarding" }
  | { screen: "review"; reviewId?: string; mode?: "unstaged" | "staged" }
  | { screen: "history" }
  | { screen: "help" }
  | { screen: "settings" }
  | { screen: "settings/theme" }
  | { screen: "settings/providers" }
  | { screen: "settings/storage" }
  | { screen: "settings/analysis" }
  | { screen: "settings/agent-execution" }
  | { screen: "settings/diagnostics" }
  | { screen: "settings/trust-permissions" };
```

### Back Navigation

Mirrors web's `resolveBackAction` pattern:
- **Deterministic targets**: settings/* -> settings, settings -> home
- **Stack for everything else**: review, history, help use history stack
- **Fallback**: home screen

### Config Guards

Sync filesystem check on startup (no API round-trip needed). Redirect unconfigured users to onboarding screen.

## 3. Keyscope Compatibility

### Decision: Build a TerminalKeyboardProvider adapter; reuse useKey/useScope/useFocusZone concepts; replace useNavigation with terminal-native equivalent

**Rationale**: Keyscope hooks have hard DOM dependencies throughout. The KeyboardProvider uses `window.addEventListener("keydown")`, navigation hooks use `querySelectorAll`, `focus()`, `scrollIntoView()`, and `dataset`. None of these exist in Ink's Yoga-based render tree. However, the conceptual patterns (scoped hotkeys, focus zones) ARE portable.

**Alternatives considered**:
- Using keyscope directly: Impossible — no `window`, no DOM, no `HTMLElement`
- Replacing keyscope entirely with raw useInput: Loses scope isolation and focus zone patterns
- Forking keyscope: Overkill — the adapter is ~50 lines

### Portability Assessment

| Keyscope API | Portable? | Notes |
|---|---|---|
| `KeyboardProvider` | NO | Uses `window.addEventListener("keydown")`, `navigator.userAgent` |
| `useKey` | YES (with adapter) | Only depends on provider context's `register()` function |
| `useScope` | YES | Pure context manipulation, no DOM |
| `useFocusZone` | YES (with adapter) | Pure state machine, depends on useKey |
| `useNavigation` | NO | Uses `querySelectorAll`, `focus()`, `scrollIntoView()`, `dataset` |
| `useScopedNavigation` | NO | Combines DOM navigation + useKey |
| `useFocusTrap` | NO | Uses `document.activeElement`, `querySelectorAll`, `container.addEventListener` |
| `useScrollLock` | NO | Uses `document.body.style.overflow` — no terminal equivalent |

### Adapter Architecture

1. **TerminalKeyboardProvider**: Same context shape as KeyboardProvider. Uses Ink's `useInput` to capture keystrokes, converts `(input, key)` to keyscope's hotkey format, dispatches through same scope-based handler registry.
2. **useTerminalNavigation**: Replaces `useNavigation`. Tracks highlighted index via state instead of DOM queries. Algorithmic logic (wrap, boundary callbacks) extracted and reused.
3. **Drop useFocusTrap, useScrollLock**: No terminal equivalent needed.

## 4. Web App Feature Inventory

### Screens to Mirror (13 total)

| Web Route | CLI Screen | Components | diff-ui Imports | API Calls |
|-----------|-----------|------------|-----------------|-----------|
| `/` | home | 6 components | Menu, Panel, Button, Callout, toast | api.shutdown() |
| `/review` | review (streaming) | 8+ components | SectionHeader, Badge, Button, Callout, Panel, ScrollArea | api.streamReviewWithEvents, api.getActiveReviewSession |
| `/review` (summary) | review (summary) | 3 components | Badge, Button, SectionHeader | — |
| `/review` (results) | review (results) | 12+ components | Tabs, SectionHeader, EmptyState, ScrollArea, Badge, Button | api.getReview |
| `/history` | history | 5 components | NavigationList, Badge, ScrollArea, SectionHeader | api.getReviews, api.getReview |
| `/help` | help | 1 component | Panel | — |
| `/onboarding` | onboarding | 8 components | Button, Callout, Radio, Badge, Checkbox, ScrollArea | api.saveSettings, api.saveConfig |
| `/settings` | settings (hub) | 1 component | Menu, Panel | — |
| `/settings/theme` | settings/theme | 2 components | Panel, Callout, Button, Radio | api.saveSettings |
| `/settings/providers` | settings/providers | 13 components | NavigationList, Input, Badge, Button, Dialog, SectionHeader, KeyValue, toast | Provider config API |
| `/settings/storage` | settings/storage | 1 component | Button, Callout, Radio | api.saveSettings |
| `/settings/analysis` | settings/analysis | 2 components | Button, Badge, Checkbox, ScrollArea | api.saveSettings |
| `/settings/agent-execution` | settings/agent-execution | 1 component | Button, Radio | api.saveSettings |
| `/settings/diagnostics` | settings/diagnostics | 1 component | SectionHeader, Badge, Button | api.getReviewContext, api.refreshReviewContext, health |
| `/settings/trust-permissions` | settings/trust-permissions | 1 component | Panel, toast, Checkbox, Badge, Callout, Button | api.saveTrust, api.deleteTrust |

### diff-ui Components Used (by frequency)

| Component | Usage Count | Priority |
|-----------|-------------|----------|
| Badge | 16 files | P0 — used everywhere |
| Button | 15 files | P0 |
| Panel (Header, Content, Footer) | 8 files | P0 |
| RadioGroup/Item | 7 files | P0 — forms |
| toast/Toaster | 6 files | P0 — notifications |
| Callout (Icon, Title, Content) | 6 files | P0 |
| SectionHeader | 6 files | P0 |
| ScrollArea | 5 files | P1 — terminal scroll |
| Menu (Item, Divider) | 4 files | P0 — navigation |
| CheckboxGroup/Item | 4 files | P1 — forms |
| Dialog (full suite) | 3 files | P1 — overlays |
| NavigationList (full suite) | 2 files | P1 |
| Input | 2 files | P1 — text entry |
| Tabs (List, Trigger, Content) | 1 file | P1 |
| EmptyState | 1 file | P2 |
| KeyValue | 1 file | P2 |
| cn utility | 7 files | P0 — utility |

### Keyscope Scopes Used (17 total)

`home`, `review-progress`, `review`, `review-summary`, `api-key-missing`, `no-changes`, `history`, `onboarding`, `providers`, `api-key-dialog`, `settings-hub`, `settings-theme`, `settings-storage`, `settings-analysis`, `settings-agent-execution`, `settings-diagnostics`, `trust-form`

## 5. diff-ui Component API Summary

### Shared Patterns

- **Compound components**: All multi-part components use `Object.assign(Root, { Sub1, Sub2 })` dot-notation
- **Controllable state**: `useControllableState(value, defaultValue, onChange)` pattern throughout
- **List navigation**: Menu, NavigationList, CheckboxGroup, RadioGroup, TabsList all support `wrap` prop for keyboard navigation
- **Active/focused state**: Consistently inverted colors (`bg-foreground text-background`)
- **Selectable variants**: Checkbox and Radio share `"x" | "bullet"` variants (`[x]/[ ]` vs `[*]/[ ]`)
- **Size variants**: Most components support `"sm" | "md" | "lg"`

### Terminal Adaptation Notes

| Web Component | Terminal Adaptation |
|---|---|
| Badge | `[LABEL]` with ANSI color by variant |
| Button | `[ Label ]` with border/color by variant, bracket option |
| Callout | Box with borderStyle + icon prefix, variant maps to border color |
| Checkbox | Already terminal-native: `[x]` / `[ ]` / `[-]` |
| Dialog | Full-screen overlay, conditional render (hide header/footer) |
| EmptyState | Centered text block with icon |
| Input | `@inkjs/ui` TextInput or custom with cursor management |
| Menu | Arrow-key navigable list with `>` indicator and selection highlight |
| NavigationList | Similar to Menu but with multi-column layout (title, badge, status, subtitle) |
| Panel | Box with borderStyle="round" + optional header/content/footer |
| Radio | Already terminal-native: `( * )` / `(   )` |
| ScrollArea | Managed viewport with scroll offset tracking |
| SectionHeader | Bold uppercase Text with optional border-bottom |
| Tabs | Horizontal tab bar with arrow-key switching, content panels below |
| Toast | Temporary Text notification at screen edge, auto-dismiss timer |
| Spinner | ink-spinner or custom animation frames (braille/dots/snake) |

## 6. Theming Architecture

### Decision: React context with CliColorTokens object, 3 palettes (dark/light/high-contrast), hex values, chalk auto-downgrades

**Rationale**: Same semantic token names as web CSS vars ensures parity. Hex values give exact colors on capable terminals while chalk auto-downgrades for basic terminals. No extra dependencies — chalk is already installed.

**Alternatives considered**:
- Named chalk colors only: Too limited, doesn't match web's GitHub-inspired palette
- Separate color-level detection: Unnecessary — chalk handles it automatically
- CSS-in-terminal libraries: Don't exist for Ink

### Persistence

Theme stored in `~/.diffgazer/config.json` under `settings.theme`. CLI reads on startup (sync file read). The existing `Theme` schema (`"auto" | "dark" | "light" | "terminal"`) needs extension to include `"high-contrast"`.

### Auto-Detection

Terminal dark/light detection via `COLORFGBG` environment variable (standard heuristic used by vim, tmux). Falls back to dark.

### Color Degradation

```
Ink <Text color="#58a6ff">
  → chalk.hex("#58a6ff")(str)
    → Level 3 (truecolor): exact hex
    → Level 2 (256-color): nearest ansi256
    → Level 1 (basic 16): nearest basic color
    → Level 0: stripped
```
