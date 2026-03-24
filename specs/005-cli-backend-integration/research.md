# Research: CLI Backend Integration

**Branch**: `005-cli-backend-integration` | **Date**: 2026-03-24

## 1. API Client Pattern

**Decision**: Module-level singleton via `createApi()` from `@diffgazer/api`, same as web app.

**Rationale**: The web app uses a simple module-level export (`export const api = createApi({ baseUrl })`), imported directly by components and hooks. No React context needed. This works identically in Ink since both are React environments importing from the same module.

**CLI-specific config**:
```typescript
const api = createApi({
  baseUrl: "http://127.0.0.1:3000",
  projectRoot: process.cwd(),
});
```

Key difference from web: CLI passes `projectRoot` (sets `x-diffgazer-project-root` header) since the CLI operates from a specific directory. Web omits this because the server infers it.

**Alternatives considered**:
- React context provider for API — rejected; unnecessary complexity when a module singleton works
- Direct fetch calls — rejected; `@diffgazer/api` already provides typed, bound methods

## 2. Server Connectivity Pattern

**Decision**: Three-state machine (`checking` → `connected` / `error`) that gates all screen rendering, matching the web's `useServerStatus` + root layout pattern.

**Rationale**: The web app blocks ALL child routes behind a server health check. During "checking", it shows a centered spinner. On "error", it shows a retry button. The CLI must do the same since the embedded server takes time to start.

**Implementation approach**:
- Port `useServerStatus` pattern: poll `GET /api/health` on mount, retry on error
- Gate the `ScreenRouter` behind connection status in the `App` component
- Replace `requestAnimationFrame` polling with Node.js `setTimeout` (30s interval)
- Skip visibility check (`document.hidden`) — not applicable in terminal

**Alternatives considered**:
- Optimistic rendering (show screens while server starts) — rejected; API calls would fail, causing cascading errors
- Synchronous server wait before React mount — rejected; blocks terminal output

## 3. Config Guard Pattern

**Decision**: Check config state after server connection, before showing home screen. Redirect to onboarding if not configured.

**Rationale**: Web uses TanStack Router `beforeLoad` guards with a TTL cache. CLI has stack-based navigation, so the guard runs once after server connects, checking `api.checkConfig()`. If not configured, navigates to onboarding.

**Implementation approach**:
- After `useServerStatus` reports "connected", call `api.checkConfig()`
- If `configured: false`, auto-navigate to onboarding screen
- After onboarding completes and saves config, navigate to home
- No TTL cache needed in CLI (simpler lifecycle than web's route-per-navigation checks)

**Alternatives considered**:
- Per-screen guards — rejected; overkill for stack-based navigation
- Check on every navigation — rejected; unnecessary overhead for local server

## 4. Review Streaming Architecture

**Decision**: Rewrite CLI review hooks to use shared `@diffgazer/core` review reducer + `@diffgazer/api` streaming methods.

**Rationale**: The web app uses a layered architecture:
1. `@diffgazer/api` → `streamReviewWithEvents()` makes HTTP GET to `/api/review/stream`
2. `@diffgazer/core` → `processReviewStream()` parses SSE, routes events to typed callbacks
3. `@diffgazer/core` → `reviewReducer` reduces events into `ReviewState`
4. Web hook → `useReducer(reviewReducer)` with event dispatching

All layers except the web hook are in shared packages, directly usable by the CLI.

**Key adaptations for CLI**:
- Replace `requestAnimationFrame` event batching with `setTimeout(fn, 16)` or skip entirely (Ink batches React updates)
- No URL sync needed (web syncs reviewId to URL; CLI uses navigation context)
- `AbortController` lifecycle identical (React cleanup in `useEffect`)

**Event taxonomy** (20+ types):
- Step events: `review_started`, `step_start`, `step_complete`, `step_error`
- Agent events: `orchestrator_start/complete`, `agent_queued/start/thinking/progress/complete/error`, `tool_call/result`, `issue_found`, `file_start/complete`
- Enrich events: `enrich_progress`
- Stream-level: `complete`, `error`

**Alternatives considered**:
- Custom CLI-specific SSE parser — rejected; shared `parseSSEStream` works in Node.js
- Polling instead of SSE — rejected; defeats real-time progress purpose

## 5. Settings Data Flow

**Decision**: Simple fetch-on-mount + save-on-action pattern for CLI settings screens, without the web's `useSyncExternalStore` caching layer.

**Rationale**: The web uses a sophisticated module-level cache with `useSyncExternalStore` for settings because multiple components may read settings simultaneously and the web has complex navigation (route changes, config guards). The CLI has simpler navigation (one screen at a time, stack-based) and doesn't need cross-screen reactivity.

**Implementation approach**:
- Each settings screen calls `api.getSettings()` on mount → `useState` for local editing → `api.saveSettings()` on save
- Settings hub calls `api.loadInit()` + `api.getSettings()` on mount to populate current value labels
- Onboarding completion calls `api.saveSettings()` + `api.saveConfig()` in sequence

**Critical field name mappings** (CLI TODOs use wrong names):
| CLI TODO comment | Correct API field | API method |
|---|---|---|
| `secretsStorage: storage` | `secretsStorage` | `api.saveSettings()` |
| `analysisAgents: agents` | `defaultLenses` | `api.saveSettings()` |
| `executionMode: mode` | `agentExecution` | `api.saveSettings()` |
| `trust: capabilities` | Full `TrustConfig` object | `api.saveTrust()` (NOT `saveSettings`) |

**Alternatives considered**:
- Port `useSyncExternalStore` cache — rejected; unnecessary complexity for single-screen-at-a-time CLI
- React context for settings — rejected; fetch-on-mount is simpler and sufficient

## 6. Theme Persistence

**Decision**: CLI theme stays local (CLI arg + in-memory), not persisted via server API.

**Rationale**: The web app stores theme in `localStorage`, NOT via the server API. The CLI already has a `--theme` flag and `CliThemeProvider` context. Theme is a client-side preference, not shared between CLI and web.

**Implementation approach**:
- Theme screen saves to the existing `CliThemeProvider` (in-memory for session)
- The `// TODO: call api.saveSettings({ theme })` comment is incorrect — web doesn't do this either
- Optionally persist to a local CLI config file for cross-session persistence (out of scope per spec assumptions)

**Alternatives considered**:
- Save theme via API — rejected; web doesn't do this, and terminal themes (dark/light/high-contrast) differ from web themes (auto/dark/light)

## 7. Mock Data Inventory

**Decision**: 24 specific locations across 14 files need replacement.

Complete inventory:

| # | File (relative to apps/cli/src/) | Type | Replace with |
|---|---|---|---|
| 1 | `features/review/hooks/use-review-stream.ts:29-73` | MOCK_STEPS, MOCK_LOG_ENTRIES, setTimeout | `api.streamReviewWithEvents()` |
| 2 | `features/review/hooks/use-review-lifecycle.ts:33-78` | MOCK_ISSUES, MOCK_SUMMARY | Stream events + `api.getReview()` |
| 3 | `app/screens/history-screen.tsx:17-62` | MOCK_REVIEWS | `api.getReviews()` |
| 4 | `app/screens/settings/providers-screen.tsx:14-23` | MOCK_PROVIDERS, MOCK_MODELS | `api.getProviderStatus()` |
| 5 | `app/screens/settings/providers-screen.tsx:45` | TODO persist API key | `api.saveConfig()` |
| 6 | `app/screens/settings/providers-screen.tsx:49` | TODO persist model | `api.activateProvider()` |
| 7 | `app/screens/home-screen.tsx:23` | TODO persist trust | `api.saveTrust()` |
| 8 | `app/screens/home-screen.tsx:60` | Hardcoded provider "—" | `api.loadInit()` |
| 9 | `components/layout/global-layout.tsx:24-25` | Hardcoded provider name/status | `api.loadInit()` |
| 10 | `app/screens/settings/storage-screen.tsx:17,21` | Hardcoded default + TODO | `api.getSettings()` + `api.saveSettings()` |
| 11 | `app/screens/settings/theme-screen.tsx:17,21` | Hardcoded default + TODO | Keep local (web also uses localStorage) |
| 12 | `app/screens/settings/trust-permissions-screen.tsx:22-29` | Hardcoded default + TODO | `api.loadInit()` + `api.saveTrust()` |
| 13 | `app/screens/settings/agent-execution-screen.tsx:17,21` | Hardcoded default + TODO | `api.getSettings()` + `api.saveSettings()` |
| 14 | `app/screens/settings/analysis-screen.tsx:17,21` | Hardcoded default + TODO | `api.getSettings()` + `api.saveSettings()` |
| 15 | `app/screens/settings/diagnostics-screen.tsx:20-23` | Hardcoded server status | Health endpoint + `api.loadInit()` |
| 16 | `features/onboarding/components/steps/model-step.tsx:19-35` | Hardcoded models | `api.getProviderStatus()` / `api.getOpenRouterModels()` |
| 17 | `features/onboarding/components/steps/provider-step.tsx:16-32` | Hardcoded providers | `api.getProviderStatus()` |
| 18 | `features/settings/components/analysis-selector.tsx:12-18` | Hardcoded agents | `api.getSettings()` / `api.loadInit()` |
| 19 | `features/onboarding/components/onboarding-wizard.tsx:28,52` | No persistence on complete | `api.saveConfig()` + `api.saveSettings()` |
| 20 | `app/screens/settings/hub-screen.tsx` | Static menu descriptions | `api.loadInit()` + `api.getSettings()` |

## 8. Shared Packages Available to CLI

All these packages are already in the monorepo and can be imported by the CLI:

| Package | Key Exports for CLI |
|---|---|
| `@diffgazer/api` | `createApi()`, all 27 bound methods |
| `@diffgazer/core` | `reviewReducer`, `createInitialReviewState`, `processReviewStream`, `convertAgentEventsToLogEntries`, `parseSSEStream` |
| `@diffgazer/schemas` | All Zod schemas for validation, all TypeScript types |
| `@diffgazer/core` | `Result<T,E>` type, error handling utilities |

## 9. Parallelization Strategy for Implementation

**Decision**: 36 implementation tasks organized in 3 waves, using up to 30 parallel agents per wave.

**Wave 1 — Foundation (4 sequential tasks)**: API client module, config guard, server health gate, shared loading/error patterns. Must complete before Wave 2.

**Wave 2 — Screen Integration (up to 30 parallel tasks)**: Each screen/feature independently connects to the backend. Grouped by feature domain but all parallelizable since they only add API calls to existing UI code.

**Wave 3 — Verification (3 parallel tasks)**: Mock removal verification, web-CLI parity audit, E2E flow test.

**Rationale**: Screens are independent — each has its own hooks, own state, own API calls. No screen depends on another screen's API integration. The only shared dependency is the API client module (Wave 1).
