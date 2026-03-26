# Contract: Hook Sharing Between CLI and Web

## Principle

Hooks in `@diffgazer/api/hooks` are platform-agnostic — they use React + TanStack Query only. Per-app hooks handle platform-specific concerns (terminal input, DOM events, routing).

## New Shared Hooks to Add

### `useReviewLifecycleBase`

Extracts common orchestration from both apps' `useReviewLifecycle`:

```typescript
interface UseReviewLifecycleBaseOptions {
  mode: ReviewMode;
  configLoading: boolean;
  settingsLoading: boolean;
  isConfigured: boolean;
  defaultLenses: string[];
  reviewId?: string;
  startToken?: number;
  start: (mode: ReviewMode, lenses: string[]) => void;
  resume: (id: string) => Promise<Result<void, StreamReviewError>>;
  getActiveSession: (mode?: ReviewMode) => Promise<...>;
  onNotFoundInSession?: () => void;
}

interface UseReviewLifecycleBaseResult {
  // Stream state
  streamState: ReviewStreamState;
  isStreaming: boolean;
  error: StreamReviewError | undefined;
  steps: ReviewStep[];

  // Derived display state
  noDiff: boolean;
  checkingForChanges: boolean;
  loadingMessage: string;

  // Completion
  isCompleting: boolean;
  skipDelay: () => void;

  // Start state
  hasStarted: boolean;
  hasStreamed: boolean;
}
```

### Shared Pure Functions to Extract

| Function | From | To |
|----------|------|-----|
| `buildLensOptions()` | CLI/web inline | `@diffgazer/schemas/events` |
| `mapOpenRouterModels()` | web hook | `@diffgazer/api` or `@diffgazer/core` |
| `isOpenRouterCompatible()` | web hook | `@diffgazer/api` or `@diffgazer/core` |
| `areShortcutsEqual()` | web hook | `@diffgazer/schemas/ui` |
| `getDisplayStatusConfig()` | 4 provider components | `@diffgazer/core` |
| `getBackTarget()` | CLI/web lib | `@diffgazer/core` |

## What Stays Per-App

### CLI-Only
- `useBackHandler` — Ink `useInput` for Escape key
- `useExitHandler` — `process.exit`, SIGINT/SIGTERM
- `useKey` / `useScope` — CLI keyboard scope system
- `useServers` — child process server lifecycle
- `useSettingsZone` — terminal zone navigation
- `useTerminalDimensions` / `useResponsive` — terminal stdout dimensions
- `useReviewKeyboard` — vim-style terminal navigation
- `useReviewLifecycle` (wrapper) — CLI phase state machine

### Web-Only
- `useFooterNavigation` — DOM refs, keyscope
- `useScopedRouteState` — URL-scoped state
- `useScrollIntoView` — DOM scroll operations
- `useTheme` — CSS theme context
- `useViewportBreakpoint` — `window.matchMedia`
- All `*Keyboard` hooks — keyscope DOM integration
- `useReviewLifecycle` (wrapper) — URL sync, router navigation
