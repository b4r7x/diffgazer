# Data Model: Ink Component Library for CLI

**Branch**: `004-ink-diffui-components` | **Date**: 2026-03-24

## Entities

### Route (Navigation State)

Discriminated union representing current screen location.

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

type ScreenName = Route["screen"];
```

**Identity**: Current route is a singleton (one active route at a time).
**State transitions**: navigate(Route) pushes current to stack, goBack() pops or uses deterministic target.

### NavigationStack

```typescript
interface NavigationState {
  route: Route;
  stack: Route[];       // max depth ~20 (bounded by screen count)
}
```

**Back-navigation rules**:
- `settings/*` → `settings` (deterministic)
- `settings` → `home` (deterministic)
- Everything else → pop from stack, fallback to `home`

### CliColorTokens (Theme)

```typescript
interface CliColorTokens {
  // Primitive
  bg: string; fg: string; blue: string; violet: string;
  green: string; red: string; yellow: string;
  border: string; muted: string;
  // Semantic
  success: string; warning: string; error: string;
  info: string; accent: string;
  // Domain (severity)
  severityBlocker: string; severityHigh: string;
  severityMedium: string; severityLow: string; severityNit: string;
  // Domain (status)
  statusRunning: string; statusComplete: string; statusPending: string;
}
```

**Palettes**: `dark`, `light`, `high-contrast` — each implementing CliColorTokens.
**Persistence**: `~/.diffgazer/config.json` → `settings.theme`.

### Shortcut (Footer)

```typescript
interface Shortcut {
  key: string;    // display label, e.g. "↑/↓", "Enter", "q"
  label: string;  // action description, e.g. "Navigate", "Select", "Quit"
}
```

**Lifecycle**: Each screen declares its own shortcuts via a footer context (same pattern as web's `usePageFooter`).

### TerminalKeyboardScope

```typescript
interface ScopeEntry {
  name: string;                          // e.g. "home", "review-progress"
  handlers: Map<string, Set<Handler>>;   // hotkey pattern → handler set
}

type Handler = () => void;
```

**State transitions**: pushScope(name) → new scope active, popScope() → previous scope active. Only handlers in the active scope fire.

## Relationships

```
App
├── CliThemeProvider (tokens: CliColorTokens)
│   ├── TerminalKeyboardProvider (scopes: ScopeEntry[])
│   │   ├── NavigationProvider (route: Route, stack: Route[])
│   │   │   ├── Layout
│   │   │   │   ├── Header (reads: provider config, back action)
│   │   │   │   ├── ScreenRouter (reads: route → renders screen)
│   │   │   │   │   └── [Screen] (uses: useKey, useScope, useTheme, useNavigation)
│   │   │   │   └── Footer (reads: shortcuts from FooterProvider)
│   │   │   └── FooterProvider (shortcuts: Shortcut[])
│   │   └── DialogLayer (conditional: replaces Layout when dialog open)
│   └── ServerProvider (servers: ServerFactory[])
```

## Existing Data (Shared Packages)

The CLI reuses these data types from existing packages — no new data models needed:

| Package | Types Used |
|---------|-----------|
| `@diffgazer/schemas/review` | `ReviewIssue`, `ReviewModeSchema`, severity types |
| `@diffgazer/schemas/config` | `Theme`, `SettingsConfig`, `TrustCapabilities` |
| `@diffgazer/schemas/ui` | `ContextInfo`, `Shortcut` |
| `@diffgazer/api` | API client methods, response types |
| `@diffgazer/core` | `Result<T,E>`, error types, labels |
