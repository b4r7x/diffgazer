# Shared API Hooks (`@diffgazer/api/hooks`)

## What This Is

A shared React hook library that provides the single source of truth for all API data fetching and mutations across the CLI (Ink) and web (Vite) apps. Built on TanStack Query v5. Exported as a subpath from `@diffgazer/api/hooks`.

Before this existed, both apps had hand-rolled hooks with `useState` + `useEffect` + manual caching. The same API calls were duplicated across 20+ files with inconsistent error handling, no deduplication, no cache invalidation, and no retry logic.

## Why TanStack Query

**Problem**: Both apps (CLI and web) call the same backend API through `@diffgazer/api`. Each app had its own hooks that wrapped these calls with manual loading/error state, manual caching (web had a module-level TTL cache with `useSyncExternalStore`), and no coordination between reads and writes.

**Why not SWR**: Weaker mutation support, no explicit `networkMode: 'always'` for Node.js (Ink) environments, less granular cache invalidation.

**Why not custom wrapper**: Would require building caching, deduplication, retry, stale-while-revalidate, and cache invalidation from scratch. TanStack Query solves all of these.

**Key capability**: `networkMode: 'always'` disables all browser API checks (window focus, navigator.onLine), making TanStack Query work in Ink's Node.js terminal renderer without any browser polyfills.

## Architecture

```
@diffgazer/api (transport layer — no React)
  ├── createApi() → BoundApi        # HTTP client with bound methods
  ├── config.ts, review.ts, git.ts  # Domain modules
  └── hooks/                         # React hooks layer
      ├── context.ts                 # ApiProvider + useApi
      ├── queries/                   # Query key factories (queryOptions)
      │   ├── config.ts
      │   ├── review.ts
      │   ├── server.ts
      │   └── trust.ts
      ├── config.ts                  # 9 config hooks (queries + mutations)
      ├── review.ts                  # 6 review hooks
      ├── trust.ts                   # 2 trust mutation hooks
      ├── server.ts                  # 2 server hooks + ServerState type
      ├── use-review-stream.ts       # 1 streaming hook (useReducer)
      ├── use-review-start.ts        # Review start/resume orchestration
      ├── use-review-completion.ts   # Completion detection with delay
      ├── match-query-state.ts       # matchQueryState utility
      └── index.ts                   # Barrel re-exports

@diffgazer/core/review (pure functions — no React)
  └── lifecycle-helpers.ts           # isNoDiffError, isCheckingForChanges, getLoadingMessage
```

React and TanStack Query are `peerDependencies` — only loaded when `@diffgazer/api/hooks` is imported. The root `@diffgazer/api` export remains pure transport with no React dependency.

## Core Patterns

### 1. API Injection via React Context

Both apps create a `BoundApi` instance with different configs. Context injection avoids global singletons and supports testing.

```typescript
// packages/api/src/hooks/context.ts
const ApiContext = createContext<BoundApi | null>(null);
export const ApiProvider = ApiContext.Provider;
export function useApi(): BoundApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi must be used within an <ApiProvider>");
  return api;
}
```

Each app wraps its root in `<QueryClientProvider>` + `<ApiProvider value={api}>`.

### 2. Query Key Factories (queryOptions)

Query keys are hierarchical for targeted invalidation. `queryOptions()` co-locates key + fetch function with full type inference.

```typescript
// packages/api/src/hooks/queries/config.ts
export const configQueries = {
  all: () => ["config"] as const,
  settings: (api: BoundApi) => queryOptions({
    queryKey: [...configQueries.all(), "settings"] as const,
    queryFn: () => api.getSettings(),
    staleTime: 30_000,
  }),
  // ...
};
```

Invalidating `configQueries.all()` (`['config']`) invalidates all config queries. Invalidating `configQueries.settings(api).queryKey` (`['config', 'settings']`) only invalidates settings.

### 3. Query Hooks (thin wrappers)

Each hook is ~5 lines. Calls `useApi()` for the API instance and spreads the factory options into `useQuery`.

```typescript
export function useSettings() {
  const api = useApi();
  return useQuery(configQueries.settings(api));
}
```

Returns standard `UseQueryResult<T>` — callers get `{ data, isLoading, error, refetch }`.

### 4. Mutation Hooks (with cache invalidation)

Each mutation documents which queries it invalidates on success.

```typescript
export function useSaveSettings() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<SettingsConfig>) => api.saveSettings(settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: configQueries.settings(api).queryKey }),
  });
}
```

Returns `UseMutationResult` — callers use `.mutate()` (fire-and-forget) or `.mutateAsync()` (await). Error is stored in `.error`, loading in `.isPending`.

### 5. Streaming Hook (useReducer, NOT TanStack Query)

The review streaming hook manages a long-running SSE stream. TanStack Query is not suited for this (it's designed for request/response). Instead, uses `useReducer` with the shared `reviewReducer` from `@diffgazer/core/review`.

`resume()` returns `Promise<Result<void, StreamReviewError>>`, allowing callers to detect stale or not-found sessions (`SESSION_STALE`, `SESSION_NOT_FOUND`) and fall back to a fresh start.

### 6. Server Status Hook (shared, with `ServerState`)

The `useServerStatus` hook returns a `ServerState` discriminated union (`"checking" | "connected" | "error"`) with a `retry` function. This is the shared hook — both apps import it directly from `@diffgazer/api/hooks`. There are no per-app wrappers for server status.

### 7. Platform-Specific Wrappers (thin adapters)

Some hooks need platform-specific behavior that wraps the shared hook:

- **`useConfigGuard`** (CLI only): Uses shared `useConfigCheck` for the query, adds CLI-specific navigation to onboarding screen.
- **`useOpenRouterModels`** (web only): Uses shared query for fetching, adds local filtering/mapping logic for model compatibility.

These live in each app's `hooks/` directory, not in the shared package.

### 8. Review Start Hook (shared)

`useReviewStart` orchestrates the initial start or resume of a review stream. Both apps import it from `@diffgazer/api/hooks`.

**Options**: `mode`, `configLoading`, `settingsLoading`, `isConfigured`, `defaultLenses`, optional `reviewId`, optional `startToken`, plus callbacks `start`, `resume`, `getActiveSession`, and `onNotFoundInSession`.

**Behavior**:
- Waits for config and settings to finish loading before starting.
- If `reviewId` is provided, resumes that review directly.
- Otherwise, queries for an active session in the given mode — resumes if found, starts fresh if not.
- Resume error handling:
  - `SESSION_STALE` → starts a fresh review.
  - `SESSION_NOT_FOUND` from an active session query → starts fresh.
  - `SESSION_NOT_FOUND` from an explicit `reviewId` → calls `onNotFoundInSession` (web navigates home; CLI has no handler).
- Uses ref-based stable callback pattern (`startRef`, `resumeRef`, etc.) to avoid stale closures without relying on React Compiler (not active in the shared package).
- `startToken` can be incremented to re-trigger the effect after a reset.

**Returns**: `{ hasStarted, hasStreamed, setHasStarted, setHasStreamed }`.

### 9. Review Completion Hook (shared)

`useReviewCompletion` detects when streaming ends, applies a delay for the progress animation to finish, then calls `onComplete`.

**Options**: `isStreaming`, `error`, `hasStreamed`, `steps`, `onComplete`.

**Behavior**:
- Triggers when `isStreaming` transitions from `true` to `false` (and `hasStreamed` is true, no error).
- If the report step completed, uses `REPORT_COMPLETE_DELAY_MS` (2300ms) for the longer animation. Otherwise uses `DEFAULT_COMPLETE_DELAY_MS` (400ms).
- Uses ref-based pattern to avoid re-triggering on `steps` or `onComplete` changes.

**Returns**: `{ isCompleting, skipDelay, reset }`.
- `skipDelay()` — immediately fires `onComplete`, cancelling the timer.
- `reset()` — cancels any pending timer and resets state (used when restarting a review).

### 10. Loading State Utility (matchQueryState)

A pure function that maps `UseQueryResult<T>` to render callbacks. React 19 Compiler compatible (no hooks, no closures over mutable state).

Check order: `isLoading` → `data` (data-first) → `error` → fallback `loading()`. The data-first check means a successful query with stale data won't flash an error state during background refetch.

```typescript
import { useSettings, matchQueryState } from "@diffgazer/api/hooks";

function SettingsScreen() {
  const query = useSettings();
  return matchQueryState(query, {
    loading: () => <Spinner label="Loading..." />,
    error: (err) => <Text color="red">{err.message}</Text>,
    success: (data) => <SettingsForm settings={data} />,
  });
}
```

Guard clause pattern — when `success` returns `null`, use `matchQueryState` to handle only loading/error, then continue with the data:

```typescript
const query = useSettings();
const guard = matchQueryState(query, {
  loading: () => <Spinner />,
  error: (err) => <ErrorBox error={err} />,
  success: () => null,
});
if (guard) return guard;
// query.data is guaranteed defined here
```

Works in both React DOM (web) and Ink (CLI).

## Query Key Hierarchy

```
['config']                           # all config queries
  ['config', 'settings']             # user settings
  ['config', 'init']                 # init/setup data
  ['config', 'check']               # config readiness check
  ['config', 'providers']            # AI provider status
  ['config', 'openrouter-models']    # OpenRouter model list

['review']                           # all review queries
  ['review', 'list', projectPath?]   # review list (filtered)
  ['review', id]                     # single review detail
  ['review', 'active-session', mode?] # active streaming session
  ['review', 'context']              # project context snapshot

['server']                           # all server queries
  ['server', 'health']               # health check (polls every 30s)

['trust']                            # all trust queries (used for invalidation)
```

## Invalidation Map

| Mutation | Invalidates |
|----------|-------------|
| `useSaveSettings` | `['config', 'settings']` |
| `useSaveConfig` | `['config']` (all) |
| `useActivateProvider` | `['config', 'providers']` + `['config', 'init']` |
| `useDeleteProviderCredentials` | `['config']` (all) |
| `useSaveTrust` | `['trust']` + `['config', 'init']` |
| `useDeleteTrust` | `['trust']` + `['config', 'init']` |
| `useDeleteReview` | `['review']` (all), removes `['review', id]` |
| `useRefreshReviewContext` | `['review', 'context']` |
| `useShutdown` | none |

## Platform QueryClient Configs

### CLI (Ink / Node.js)

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "always",        // bypass navigator.onLine check
      refetchOnWindowFocus: false,   // no window object
      refetchOnReconnect: false,     // no navigator.onLine listener
      retry: 1,
      staleTime: 30_000,
    },
    mutations: { networkMode: "always" },
  },
});
```

### Web (Browser)

```typescript
new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 2 },
  },
});
```

## How to Add a New Hook

### New Query Hook

1. Add the query factory to the appropriate `queries/*.ts` file (e.g., `queries/config.ts`)
2. Add the hook function to the matching domain file (e.g., `packages/api/src/hooks/config.ts`):
   ```typescript
   import { useQuery } from "@tanstack/react-query";
   import { domainQueries } from "./queries/domain.js";
   import { useApi } from "./context.js";

   export function useNewThing(arg: string) {
     const api = useApi();
     return useQuery(domainQueries.newThing(api, arg));
   }
   ```
3. Add export to `packages/api/src/hooks/index.ts`
4. Build: `pnpm --filter @diffgazer/api build`

### New Mutation Hook

1. Add the hook to the appropriate domain file (e.g., `packages/api/src/hooks/config.ts`):
   ```typescript
   import { useMutation, useQueryClient } from "@tanstack/react-query";
   import { domainQueries } from "./queries/domain.js";
   import { useApi } from "./context.js";

   export function useDoThing() {
     const api = useApi();
     const qc = useQueryClient();
     return useMutation({
       mutationFn: (args: Args) => api.doThing(args),
       onSuccess: () => qc.invalidateQueries({ queryKey: domainQueries.all() }),
     });
   }
   ```
2. Document which queries it invalidates in the invalidation map above
3. Add export to `packages/api/src/hooks/index.ts`

## Per-App Lifecycle Hooks (Not Shared)

`useReviewLifecycle` exists in both apps but is **not** shared. Each version composes the shared `useReviewStart` and `useReviewCompletion` hooks but adds platform-specific concerns:

- **Web** (`apps/web/src/features/review/hooks/use-review-lifecycle.ts`): Syncs review ID to URL via TanStack Router `useNavigate`, navigates home on `SESSION_NOT_FOUND`, exposes `handleCancel`/`handleSwitchMode`/`handleSetupProvider` that navigate to web routes.
- **CLI** (`apps/cli/src/features/review/hooks/use-review-lifecycle.ts`): Manages a phase state machine (`streaming` → `completing` → `summary` → `results`), computes `durationMs`, exposes `start`/`goToSummary`/`goToResults`/`reset` for the CLI's screen-based navigation.

Both import `isNoDiffError`, `isCheckingForChanges`, and `getLoadingMessage` from `@diffgazer/core/review` — pure functions in `lifecycle-helpers.ts` that derive display state from streaming state without any React dependency.

## What Still Uses Direct API Calls (and Why)

These files intentionally bypass shared hooks because they run outside React component context:

| File | Why |
|------|-----|
| `apps/web/src/lib/config-guards/config-guards.ts` | TanStack Router `beforeLoad` functions — not React components, can't use hooks |
| `apps/web/src/features/review/components/page.tsx` | Imperative `loadSavedOrFresh` async function inside a `useEffect` |
| `apps/web/src/features/home/utils/shutdown.ts` | Utility function, not a component |
| `apps/cli/src/lib/api.ts` / `apps/web/src/lib/api.ts` | API singleton creation — consumed by `ApiProvider` |

## Testing Shared Hooks in Consumer Tests

When testing components that use shared hooks, mock at the module boundary:

```typescript
vi.mock("@diffgazer/api/hooks", () => ({
  useSettings: vi.fn().mockReturnValue({
    data: { theme: "dark" },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useSaveSettings: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));
```

For integration tests that exercise the full provider stack, wrap in `QueryClientProvider` + `ApiProvider` with a mock API object:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});
const mockApi = { getSettings: vi.fn().mockResolvedValue({...}) } as any;

render(
  <QueryClientProvider client={queryClient}>
    <ApiProvider value={mockApi}>
      <ComponentUnderTest />
    </ApiProvider>
  </QueryClientProvider>
);
```

Always set `retry: false` in test QueryClients to avoid unhandled rejections from retried failed requests.
