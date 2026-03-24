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
  └── hooks/                         # NEW — React hooks layer
      ├── context.ts                 # ApiProvider + useApi
      ├── queries/                   # Query key factories (queryOptions)
      │   ├── config.queries.ts
      │   ├── review.queries.ts
      │   ├── server.queries.ts
      │   ├── trust.queries.ts
      │   └── git.queries.ts
      ├── use-settings.ts           # 14 query hooks (useQuery)
      ├── use-save-settings.ts      # 11 mutation hooks (useMutation)
      ├── use-review-stream.ts      # 1 streaming hook (useReducer)
      └── index.ts                  # Barrel export
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
// packages/api/src/hooks/queries/config.queries.ts
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

Accepts an optional `batchEvents` callback for platform-specific event batching (web can use `requestAnimationFrame`, CLI dispatches synchronously).

### 6. Server Status Hook (shared, with `ServerState`)

The `useServerStatus` hook returns a `ServerState` discriminated union (`"checking" | "connected" | "error"`) with a `retry` function. This is the shared hook — both apps import it directly from `@diffgazer/api/hooks`. There are no per-app wrappers for server status.

### 7. Platform-Specific Wrappers (thin adapters)

Some hooks need platform-specific behavior that wraps the shared hook:

- **`useConfigGuard`** (CLI only): Uses shared `useConfigCheck` for the query, adds CLI-specific navigation to onboarding screen.
- **`useOpenRouterModels`** (web only): Uses shared query for fetching, adds local filtering/mapping logic for model compatibility.

These live in each app's `hooks/` directory, not in the shared package.

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

['trust', projectId]                # single trust entry
['trust', 'list']                   # all trusted projects

['git']                              # all git queries
  ['git', 'status', path?]           # git status
  ['git', 'diff', mode?, path?]      # git diff
```

## Invalidation Map

| Mutation | Invalidates |
|----------|-------------|
| `useSaveSettings` | `['config', 'settings']` |
| `useSaveConfig` | `['config']` (all) |
| `useActivateProvider` | `['config', 'providers']` + `['config', 'init']` |
| `useDeleteProviderCredentials` | `['config']` (all) |
| `useDeleteConfig` | `['config']` (all) |
| `useSaveTrust` | `['trust']` + `['config', 'init']` |
| `useDeleteTrust` | `['trust']` + `['config', 'init']` |
| `useDeleteReview` | `['review']` (all), removes `['review', id]` |
| `useRefreshReviewContext` | `['review', 'context']` |
| `useRunDrilldown` | `['review', reviewId]` |
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

1. Add the query factory to the appropriate `queries/*.queries.ts` file
2. Create `packages/api/src/hooks/use-<name>.ts`:
   ```typescript
   import { useQuery } from "@tanstack/react-query";
   import { domainQueries } from "./queries/domain.queries.js";
   import { useApi } from "./context.js";

   export function useNewThing(arg: string) {
     const api = useApi();
     return useQuery(domainQueries.newThing(api, arg));
   }
   ```
3. Add export to `packages/api/src/hooks/index.ts`
4. Build: `pnpm --filter @diffgazer/api build`

### New Mutation Hook

1. Create `packages/api/src/hooks/use-<action>.ts`:
   ```typescript
   import { useMutation, useQueryClient } from "@tanstack/react-query";
   import { domainQueries } from "./queries/domain.queries.js";
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
